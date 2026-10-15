import fs from 'fs';
import path from 'path';
import os from 'os';
import { spawn } from 'child_process';
import WebSocket from 'ws';

// Global watchdog timer: 60 seconds hard timeout
const GLOBAL_TIMEOUT_MS = 60000;
const globalWatchdog = setTimeout(() => {
  console.error('[WATCHDOG] 60s hard timeout expired! Forcing exit.');
  process.exit(1);
}, GLOBAL_TIMEOUT_MS);
globalWatchdog.unref();

function findChromePath() {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) {
    return process.env.CHROME_BIN;
  }
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env.PROGRAMFILES || '', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    path.join(process.env.PROGRAMFILES || '', 'Microsoft\\Edge\\Application\\msedge.exe'),
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium'
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return 'chrome';
}

async function run() {
  let chromeProcess = null;
  let ws = null;
  const tempProfileDir = path.join(os.tmpdir(), `chrome_codec_test_${Date.now()}`);

  try {
    console.log('[STEP 1/5] Discovering portable browser executable...');
    const browserPath = findChromePath();
    console.log(`  Browser found: ${browserPath}`);

    console.log('[STEP 2/5] Spawning headless browser on port 9285...');
    fs.mkdirSync(tempProfileDir, { recursive: true });

    chromeProcess = spawn(browserPath, [
      '--headless=new',
      '--remote-debugging-port=9285',
      `--user-data-dir=${tempProfileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--unsafely-treat-insecure-origin-as-secure=http://localhost:5173',
      '--use-gl=angle',
      '--use-angle=d3d11',
      '--enable-gpu-rasterization',
      '--enable-zero-copy',
      '--enable-features=WebCodecs,WebCodecsPlatformAudioDecoder,WebCodecsPlatformAudioEncoder,MediaFoundationVideoCapture'
    ], { stdio: 'ignore' });

    // Wait for CDP endpoint to respond (up to 5 seconds)
    let versionJson = null;
    for (let i = 0; i < 25; i++) {
      try {
        const res = await fetch('http://127.0.0.1:9285/json/version');
        if (res.ok) {
          versionJson = await res.json();
          break;
        }
      } catch (_) {}
      await new Promise(r => setTimeout(r, 200));
    }

    if (!versionJson?.webSocketDebuggerUrl) {
      throw new Error('Could not connect to browser CDP endpoint on port 9285 within 5s');
    }
    console.log(`  CDP endpoint ready: ${versionJson.webSocketDebuggerUrl}`);

    console.log('[STEP 3/5] Connecting WebSocket to CDP...');
    ws = new WebSocket(versionJson.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('WebSocket connection timed out (5s)')), 5000);
      ws.once('open', () => { clearTimeout(t); resolve(); });
      ws.once('error', (err) => { clearTimeout(t); reject(err); });
    });
    console.log('  WebSocket connection established.');

    let reqId = 1;
    const sendCdp = (method, params = {}, sessionId) => {
      return new Promise((resolve, reject) => {
        const id = reqId++;
        const timer = setTimeout(() => {
          ws.off('message', onMsg);
          reject(new Error(`CDP request ${method} timed out after 10s`));
        }, 10000);

        const onMsg = (data) => {
          try {
            const msg = JSON.parse(data.toString());
            if (msg.id === id) {
              clearTimeout(timer);
              ws.off('message', onMsg);
              if (msg.error) reject(new Error(msg.error.message || JSON.stringify(msg.error)));
              else resolve(msg.result);
            }
          } catch (_) {}
        };
        ws.on('message', onMsg);

        const payload = { id, method, params };
        if (sessionId) payload.sessionId = sessionId;
        ws.send(JSON.stringify(payload));
      });
    };

    const target = await sendCdp('Target.createTarget', { url: 'http://localhost:5173/video-editor' });
    const attached = await sendCdp('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    const sessionId = attached.sessionId;
    await new Promise((r) => setTimeout(r, 1500));

    console.log('[STEP 4/5] Executing VideoEncoder capability and flush tests in browser context...');

    const evalResult = await sendCdp('Runtime.evaluate', {
      expression: `(async () => {
        const codecs = [
          'avc1.42001e', 'avc1.42001f', 'avc1.4d001f', 'avc1.64001f',
          'vp8', 'vp09.00.10.08', 'av01.0.04M.08'
        ];

        const report = {
          hasVideoEncoder: typeof VideoEncoder !== 'undefined',
          hasVideoFrame: typeof VideoFrame !== 'undefined',
          codecs: {},
          flushTest: null
        };

        if (!report.hasVideoEncoder) return report;

        // Check each codec with 5s timeout
        for (const codec of codecs) {
          try {
            const checkPromise = VideoEncoder.isConfigSupported({
              codec,
              width: 1920,
              height: 1080,
              bitrate: 8000000,
              framerate: 30
            });
            const timeoutPromise = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 5000));
            const res = await Promise.race([checkPromise, timeoutPromise]);
            report.codecs[codec] = res.supported ? 'SUPPORTED' : 'UNSUPPORTED';
          } catch (e) {
            report.codecs[codec] = 'FAIL/SKIP: ' + e.message;
          }
        }

        // Test real VideoEncoder encoding and flush() on first supported codec
        const supportedCodec = Object.keys(report.codecs).find(c => report.codecs[c] === 'SUPPORTED');
        if (supportedCodec) {
          try {
            let encodedChunks = 0;
            const encoder = new VideoEncoder({
              output: (chunk) => { if (chunk.byteLength > 0) encodedChunks++; },
              error: (err) => { console.error('Encoder error:', err); }
            });

            encoder.configure({
              codec: supportedCodec,
              width: 640,
              height: 360,
              bitrate: 2000000,
              framerate: 30
            });

            // Create a small offscreen canvas to produce a VideoFrame
            const offscreen = new OffscreenCanvas(640, 360);
            const ctx = offscreen.getContext('2d');
            ctx.fillStyle = '#ff0000';
            ctx.fillRect(0, 0, 640, 360);

            const frame = new VideoFrame(offscreen, { timestamp: 0 });
            encoder.encode(frame, { keyFrame: true });
            frame.close();

            const flushTimeout = new Promise((_, rej) => setTimeout(() => rej(new Error('flush timeout')), 5000));
            await Promise.race([encoder.flush(), flushTimeout]);
            encoder.close();

            report.flushTest = {
              testedCodec: supportedCodec,
              encodedChunks,
              status: 'SUCCESS'
            };
          } catch (err) {
            report.flushTest = {
              testedCodec: supportedCodec,
              status: 'FAIL: ' + err.message
            };
          }
        }

        return report;
      })()`,
      awaitPromise: true,
      returnByValue: true
    }, sessionId);

    console.log('[STEP 5/5] Capabilities Result:');
    const resultVal = evalResult?.result?.value;
    console.log(JSON.stringify(resultVal, null, 2));

    console.log('\n[TEST COMPLETE] All capability checks finished successfully.');
    clearTimeout(globalWatchdog);
    process.exit(0);
  } catch (err) {
    console.error('\n[TEST ERROR]:', err);
    clearTimeout(globalWatchdog);
    process.exit(1);
  } finally {
    // Teardown connections and process
    try {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    } catch (_) {}

    if (chromeProcess && !chromeProcess.killed) {
      try {
        chromeProcess.kill('SIGKILL');
      } catch (_) {}
    }

    try {
      if (fs.existsSync(tempProfileDir)) {
        fs.rmSync(tempProfileDir, { recursive: true, force: true });
      }
    } catch (_) {}
  }
}

run();

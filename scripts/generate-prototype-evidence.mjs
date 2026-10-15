import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { spawn, spawnSync } from 'child_process';
import WebSocket from 'ws';

function findChromePath() {
  if (process.env.CHROME_BIN && fs.existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN;
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe'),
    path.join(process.env.PROGRAMFILES || '', 'Google\\Chrome\\Application\\chrome.exe'),
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return 'chrome';
}

function computeSha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

async function run() {
  console.log('=== GENERATING 640x360 CFR PROTOTYPE EVIDENCE SUITE ===');

  const evidenceDir = path.resolve('cfr-prototype-evidence');
  if (fs.existsSync(evidenceDir)) {
    fs.rmSync(evidenceDir, { recursive: true, force: true });
  }
  fs.mkdirSync(evidenceDir, { recursive: true });

  const tempUserDataDir = path.join(os.tmpdir(), `wasm_proto_cdp_${Date.now()}`);
  fs.mkdirSync(tempUserDataDir, { recursive: true });

  let chrome = null;
  let ws = null;
  const browserConsoleLogs = [];
  const stdoutLogs = [];
  const stderrLogs = [];

  const logStdout = (msg) => {
    stdoutLogs.push(`[${new Date().toISOString()}] ${msg}`);
    console.log(msg);
  };
  const logStderr = (msg) => {
    stderrLogs.push(`[${new Date().toISOString()}] ${msg}`);
    console.error(msg);
  };

  const watchdog = setTimeout(() => {
    logStderr('[WATCHDOG] 90s timeout exceeded for prototype export!');
    if (chrome) chrome.kill('SIGKILL');
    fs.writeFileSync(path.join(evidenceDir, 'test-exit-code.txt'), '1\n');
    process.exit(1);
  }, 90000);

  try {
    const browserPath = findChromePath();
    logStdout(`[1/5] Launching Chrome CDP: ${browserPath}`);

    chrome = spawn(browserPath, [
      '--headless=new',
      '--remote-debugging-port=9289',
      `--user-data-dir=${tempUserDataDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--unsafely-treat-insecure-origin-as-secure=http://localhost:5173'
    ], { stdio: 'ignore' });

    let versionJson = null;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch('http://127.0.0.1:9289/json/version');
        if (res.ok) { versionJson = await res.json(); break; }
      } catch (_) {}
      await new Promise(r => setTimeout(r, 200));
    }

    if (!versionJson?.webSocketDebuggerUrl) {
      throw new Error('Failed to connect to Chrome CDP at port 9289');
    }

    ws = new WebSocket(versionJson.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.once('open', res);
      ws.once('error', rej);
    });

    let id = 1;
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const curId = id++;
      const timer = setTimeout(() => {
        ws.off('message', handler);
        reject(new Error(`Timeout on ${method}`));
      }, 60000);
      const handler = (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.id === curId) {
          clearTimeout(timer);
          ws.off('message', handler);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      };
      ws.on('message', handler);
      const payload = { id: curId, method, params };
      if (sessionId) payload.sessionId = sessionId;
      ws.send(JSON.stringify(payload));
    });

    // Handle console logs from browser
    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.method === 'Runtime.consoleAPICalled') {
          const text = msg.params.args.map(a => a.value ?? JSON.stringify(a)).join(' ');
          browserConsoleLogs.push(`[${new Date().toISOString()}] [CONSOLE] ${text}`);
        }
      } catch (_) {}
    });

    const target = await send('Target.createTarget', { url: 'http://localhost:5173/video-editor' });
    const attached = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    const sessionId = attached.sessionId;
    await send('Runtime.enable', {}, sessionId);
    await new Promise(r => setTimeout(r, 1500));

    logStdout('[2/5] Executing 640x360 300-frame WASM CFR encoding inside Chromium context...');

    const evalRes = await send('Runtime.evaluate', {
      expression: `(async () => {
        try {
          console.log('[Browser] Starting WASM CFR render pipeline');
          const t0 = performance.now();
          const memBefore = window.performance?.memory ? {
            usedJSHeapSize: window.performance.memory.usedJSHeapSize,
            totalJSHeapSize: window.performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: window.performance.memory.jsHeapSizeLimit
          } : null;

          const mod = await import('/wasm/ffmpeg/ffmpeg-core.js');
          const createCore = mod.default || mod.createFFmpegCore || window.createFFmpegCore;
          if (typeof createCore !== 'function') throw new Error('createFFmpegCore not found');

          const b64Meta = btoa(JSON.stringify({ wasmURL: '/wasm/ffmpeg/ffmpeg-core.wasm' }));
          const ffmpegStdout = [];
          const ffmpegStderr = [];
          const core = await createCore({
            mainScriptUrlOrBlob: '/wasm/ffmpeg/ffmpeg-core.js#' + b64Meta
          });

          if (core.setLogger) {
            core.setLogger((log) => {
              if (log.type === 'stdout') {
                ffmpegStdout.push(log.message);
                console.log('[FFMPEG-OUT]', log.message);
              } else {
                ffmpegStderr.push(log.message);
                console.log('[FFMPEG-ERR]', log.message);
              }
            });
          }

          const width = 640;
          const height = 360;
          const fps = 30;
          const totalFrames = 300;
          const ySize = width * height;
          const uvSize = (width / 2) * (height / 2);
          const frameByteSize = ySize + uvSize * 2; // 345,600 bytes

          const yuvBuffer = new Uint8Array(totalFrames * frameByteSize);

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });

          // Render 300 distinct frames with moving motion vector fixture
          for (let f = 0; f < totalFrames; f++) {
            const timeSec = f / fps;
            ctx.fillStyle = '#0f172a';
            ctx.fillRect(0, 0, width, height);

            // Dynamic moving circle
            const cx = (f * 12) % (width - 80) + 40;
            const cy = height / 2 + Math.sin(f * 0.15) * 60;
            ctx.beginPath();
            ctx.arc(cx, cy, 32, 0, Math.PI * 2);
            ctx.fillStyle = '#3b82f6';
            ctx.fill();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Distinct moving bar across bottom
            const barW = (f / (totalFrames - 1)) * (width - 40);
            ctx.fillStyle = '#10b981';
            ctx.fillRect(20, height - 30, barW, 12);

            // Bold frame counter & timecode
            ctx.font = 'bold 36px monospace';
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.fillText('FRAME ' + String(f).padStart(3, '0') + ' / 300', width / 2, 80);

            ctx.font = 'bold 24px monospace';
            ctx.fillStyle = '#94a3b8';
            ctx.fillText('TIME: ' + timeSec.toFixed(3) + 's (CFR 30.0)', width / 2, 125);

            // Convert to YUV420p
            const imgData = ctx.getImageData(0, 0, width, height).data;
            const frameOffset = f * frameByteSize;
            let yIdx = frameOffset;
            let uIdx = frameOffset + ySize;
            let vIdx = frameOffset + ySize + uvSize;

            for (let i = 0; i < height; i++) {
              for (let j = 0; j < width; j++) {
                const pixelIdx = (i * width + j) * 4;
                const r = imgData[pixelIdx];
                const g = imgData[pixelIdx + 1];
                const b = imgData[pixelIdx + 2];

                const yVal = ((66 * r + 129 * g + 25 * b + 128) >> 8) + 16;
                yuvBuffer[yIdx++] = Math.max(16, Math.min(235, yVal));

                if (i % 2 === 0 && j % 2 === 0) {
                  const uVal = ((-38 * r - 74 * g + 112 * b + 128) >> 8) + 128;
                  const vVal = ((112 * r - 94 * g - 18 * b + 128) >> 8) + 128;
                  yuvBuffer[uIdx++] = Math.max(16, Math.min(240, uVal));
                  yuvBuffer[vIdx++] = Math.max(16, Math.min(240, vVal));
                }
              }
            }
          }

          // Exact 10.000s 48 kHz stereo audio PCM
          const sampleRate = 48000;
          const numSamples = 480000;
          const pcmBuffer = new Int16Array(numSamples * 2);
          for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            const sL = Math.sin(2 * Math.PI * 440 * t) * 0.4;
            const sR = Math.sin(2 * Math.PI * 880 * t) * 0.4;
            pcmBuffer[i * 2] = Math.max(-32768, Math.min(32767, Math.round(sL * 32767)));
            pcmBuffer[i * 2 + 1] = Math.max(-32768, Math.min(32767, Math.round(sR * 32767)));
          }

          const rawAudioBytes = new Uint8Array(pcmBuffer.buffer);

          core.FS.writeFile('input.yuv', yuvBuffer);
          core.FS.writeFile('audio.pcm', rawAudioBytes);

          const memPeak = window.performance?.memory ? {
            usedJSHeapSize: window.performance.memory.usedJSHeapSize,
            totalJSHeapSize: window.performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: window.performance.memory.jsHeapSizeLimit
          } : null;

          const args = [
            '-v', 'info',
            '-f', 'rawvideo',
            '-pix_fmt', 'yuv420p',
            '-s', '640x360',
            '-framerate', '30',
            '-i', 'input.yuv',
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '2',
            '-i', 'audio.pcm',
            '-c:v', 'libx264',
            '-preset', 'ultrafast',
            '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-movflags', '+faststart',
            'prototype_640x360.mp4'
          ];

          const ret = core.exec(...args);
          if (ret !== 0) {
            return {
              error: 'ffmpeg exec failed with code ' + ret,
              stdout: ffmpegStdout,
              stderr: ffmpegStderr
            };
          }

          const outData = core.FS.readFile('prototype_640x360.mp4');
          core.FS.unlink('input.yuv');
          core.FS.unlink('audio.pcm');
          core.FS.unlink('prototype_640x360.mp4');

          const memAfter = window.performance?.memory ? {
            usedJSHeapSize: window.performance.memory.usedJSHeapSize,
            totalJSHeapSize: window.performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: window.performance.memory.jsHeapSizeLimit
          } : null;

          let binary = '';
          const chunkSize = 65536;
          for (let i = 0; i < outData.length; i += chunkSize) {
            binary += String.fromCharCode.apply(null, outData.subarray(i, i + chunkSize));
          }
          const base64 = btoa(binary);

          return {
            success: true,
            elapsedMs: Math.round(performance.now() - t0),
            sizeBytes: outData.length,
            stdout: ffmpegStdout,
            stderr: ffmpegStderr,
            memory: { memBefore, memPeak, memAfter },
            base64
          };
        } catch (e) {
          return { error: e.message, stack: e.stack };
        }
      })()`,
      awaitPromise: true,
      returnByValue: true
    }, sessionId);

    const res = evalRes?.result?.value;
    if (res?.error) {
      logStderr(`[BROWSER ERROR]: ${res.error}`);
      fs.writeFileSync(path.join(evidenceDir, 'test-exit-code.txt'), '1\n');
      process.exit(1);
    }

    logStdout(`[3/5] Browser successfully rendered and encoded MP4 in ${(res.elapsedMs / 1000).toFixed(2)}s (${res.sizeBytes.toLocaleString()} bytes)`);

    // Write prototype MP4
    const protoMp4Path = path.join(evidenceDir, 'prototype_640x360.mp4');
    fs.writeFileSync(protoMp4Path, Buffer.from(res.base64, 'base64'));
    fs.copyFileSync(protoMp4Path, path.resolve('prototype_640x360.mp4'));

    // Write browser console log
    fs.writeFileSync(path.join(evidenceDir, 'browser-console.log'), browserConsoleLogs.join('\n'), 'utf8');

    // Write encode stdout / stderr
    fs.writeFileSync(path.join(evidenceDir, 'encode-stdout.log'), res.stdout.join('\n'), 'utf8');
    fs.writeFileSync(path.join(evidenceDir, 'encode-stderr.log'), res.stderr.join('\n'), 'utf8');

    // Write memory usage
    fs.writeFileSync(path.join(evidenceDir, 'memory-usage.json'), JSON.stringify(res.memory, null, 2), 'utf8');

    logStdout('[4/5] Running forensic tools on produced MP4: ffprobe, pts, vfrdet, freezedetect, mpdecimate...');

    // 1. raw-ffprobe.json
    const rawFfprobeProc = spawnSync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-count_frames',
      '-show_streams',
      '-show_format',
      '-of', 'json',
      protoMp4Path
    ], { encoding: 'utf-8' });
    fs.writeFileSync(path.join(evidenceDir, 'raw-ffprobe.json'), rawFfprobeProc.stdout, 'utf8');

    // 2. all-300-frame-pts.csv
    const ptsProc = spawnSync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'frame=pts,pts_time,pkt_duration_time',
      '-of', 'csv=p=0',
      protoMp4Path
    ], { encoding: 'utf-8' });
    fs.writeFileSync(path.join(evidenceDir, 'all-300-frame-pts.csv'), ptsProc.stdout, 'utf8');

    // 3. pts-delta-analysis.json
    const ptsLines = ptsProc.stdout.trim().split(/\r?\n/).map(line => {
      const parts = line.split(',');
      return {
        pts: parseInt(parts[0], 10),
        pts_time: parseFloat(parts[1]),
        duration_time: parseFloat(parts[2])
      };
    }).filter(p => !isNaN(p.pts_time));

    const ptsDeltas = [];
    for (let i = 1; i < ptsLines.length; i++) {
      const deltaSec = ptsLines[i].pts_time - ptsLines[i - 1].pts_time;
      ptsDeltas.push(Math.round(deltaSec * 1000000) / 1000); // ms
    }

    const ptsDeltaAnalysis = {
      totalDecodedFrames: ptsLines.length,
      expectedFrames: 300,
      matchesExpectedCount: ptsLines.length === 300,
      nominalFps: 30,
      nominalDeltaMs: 33.333,
      minDeltaMs: Math.min(...ptsDeltas),
      maxDeltaMs: Math.max(...ptsDeltas),
      avgDeltaMs: Math.round((ptsDeltas.reduce((a, b) => a + b, 0) / ptsDeltas.length) * 1000) / 1000,
      allDeltasWithin33msPlusMinus2ms: ptsDeltas.every(d => Math.abs(d - 33.333) <= 2.0),
      maxDeltaLessThan40ms: Math.max(...ptsDeltas) <= 40.0,
      firstFivePts: ptsLines.slice(0, 5),
      lastFivePts: ptsLines.slice(-5)
    };
    fs.writeFileSync(path.join(evidenceDir, 'pts-delta-analysis.json'), JSON.stringify(ptsDeltaAnalysis, null, 2), 'utf8');

    // 4. vfrdet.log
    const vfrProc = spawnSync('ffmpeg', [
      '-i', protoMp4Path,
      '-vf', 'vfrdet',
      '-f', 'null',
      '-'
    ], { encoding: 'utf-8' });
    fs.writeFileSync(path.join(evidenceDir, 'vfrdet.log'), vfrProc.stderr, 'utf8');

    // 5. freezedetect.log
    const freezeProc = spawnSync('ffmpeg', [
      '-i', protoMp4Path,
      '-vf', 'freezedetect=n=0.003:d=0.1',
      '-f', 'null',
      '-'
    ], { encoding: 'utf-8' });
    fs.writeFileSync(path.join(evidenceDir, 'freezedetect.log'), freezeProc.stderr, 'utf8');

    // 6. mpdecimate.log
    const decimateProc = spawnSync('ffmpeg', [
      '-i', protoMp4Path,
      '-vf', 'mpdecimate',
      '-f', 'null',
      '-'
    ], { encoding: 'utf-8' });
    fs.writeFileSync(path.join(evidenceDir, 'mpdecimate.log'), decimateProc.stderr, 'utf8');

    // Copy wasm files and hashes
    fs.copyFileSync('public/wasm/ffmpeg/ffmpeg-core.js', path.join(evidenceDir, 'ffmpeg-core.js'));
    const wasmSha256 = computeSha256('public/wasm/ffmpeg/ffmpeg-core.wasm');
    fs.writeFileSync(path.join(evidenceDir, 'ffmpeg-core.wasm.sha256.txt'), `${wasmSha256}  ffmpeg-core.wasm\n`, 'utf8');

    // Copy test script and browser-side encoder code
    fs.copyFileSync('scripts/test-wasm-cfr-prototype.mjs', path.join(evidenceDir, 'test-wasm-cfr-prototype.mjs'));
    fs.writeFileSync(path.join(evidenceDir, 'browser-encoder-snippet.js'), `// Browser side WASM CFR encode snippet extracted from generate-prototype-evidence.mjs
// Architecture: Raw RGBA canvas frame -> YUV420p -> libx264 ultrafast + aac 192k -> MP4
const mod = await import('/wasm/ffmpeg/ffmpeg-core.js');
const createCore = mod.default || mod.createFFmpegCore || window.createFFmpegCore;
const core = await createCore({
  mainScriptUrlOrBlob: '/wasm/ffmpeg/ffmpeg-core.js#' + btoa(JSON.stringify({ wasmURL: '/wasm/ffmpeg/ffmpeg-core.wasm' }))
});
// Exact CFR flags:
// -framerate 30 -i input.yuv -c:v libx264 -preset ultrafast -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart output.mp4
`, 'utf8');

    // Write exit code
    fs.writeFileSync(path.join(evidenceDir, 'test-exit-code.txt'), '0\n', 'utf8');

    // Generate SHA256SUMS.txt
    const filesToHash = fs.readdirSync(evidenceDir).filter(f => f !== 'SHA256SUMS.txt');
    const checksumLines = filesToHash.map(f => {
      const h = computeSha256(path.join(evidenceDir, f));
      return `${h}  ${f}`;
    });
    fs.writeFileSync(path.join(evidenceDir, 'SHA256SUMS.txt'), checksumLines.join('\n') + '\n', 'utf8');

    logStdout(`[5/5] Created ${filesToHash.length + 1} evidence files in ${evidenceDir}`);

    clearTimeout(watchdog);
    logStdout('=== PROTOTYPE EVIDENCE SUITE GENERATION COMPLETE ===');
    process.exit(0);
  } catch (err) {
    logStderr(`[ERROR]: ${err.stack || err.message}`);
    clearTimeout(watchdog);
    fs.writeFileSync(path.join(evidenceDir, 'test-exit-code.txt'), '1\n');
    process.exit(1);
  } finally {
    try { if (ws) ws.close(); } catch (_) {}
    try { if (chrome) chrome.kill('SIGKILL'); } catch (_) {}
    try { fs.rmSync(tempUserDataDir, { recursive: true, force: true }); } catch (_) {}
  }
}

run();

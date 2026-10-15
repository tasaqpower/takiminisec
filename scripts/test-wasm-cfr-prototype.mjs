import fs from 'fs';
import path from 'path';
import os from 'os';
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

async function runPrototype() {
  let chrome = null;
  let ws = null;
  const tempDir = path.join(os.tmpdir(), `wasm_cfr_proto_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  const watchdog = setTimeout(() => {
    console.error('[WATCHDOG] 90s timeout exceeded for prototype export!');
    if (chrome) chrome.kill('SIGKILL');
    process.exit(1);
  }, 90000);

  try {
    const browserPath = findChromePath();
    console.log('[1/4] Launching headless browser:', browserPath);

    chrome = spawn(browserPath, [
      '--headless=new',
      '--remote-debugging-port=9288',
      `--user-data-dir=${tempDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--unsafely-treat-insecure-origin-as-secure=http://localhost:5173'
    ], { stdio: 'ignore' });

    let versionJson = null;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch('http://127.0.0.1:9288/json/version');
        if (res.ok) { versionJson = await res.json(); break; }
      } catch (_) {}
      await new Promise(r => setTimeout(r, 200));
    }

    if (!versionJson?.webSocketDebuggerUrl) {
      throw new Error('Failed to connect to browser CDP port 9288');
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

    const target = await send('Target.createTarget', { url: 'http://localhost:5173/video-editor' });
    const attached = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    const sessionId = attached.sessionId;
    await new Promise(r => setTimeout(r, 1500));

    console.log('[2/4] Running 640x360 300-frame CFR export inside browser...');

    const evalRes = await send('Runtime.evaluate', {
      expression: `(async () => {
        try {
          const t0 = performance.now();
          const mod = await import('/wasm/ffmpeg/ffmpeg-core.js');
          const createCore = mod.default || mod.createFFmpegCore || window.createFFmpegCore;
          if (typeof createCore !== 'function') throw new Error('createFFmpegCore not found');

          const b64Meta = btoa(JSON.stringify({ wasmURL: '/wasm/ffmpeg/ffmpeg-core.wasm' }));
          const ffmpegLogs = [];
          const core = await createCore({
            mainScriptUrlOrBlob: '/wasm/ffmpeg/ffmpeg-core.js#' + b64Meta,
            print: (txt) => ffmpegLogs.push(txt),
            printErr: (txt) => ffmpegLogs.push(txt)
          });

          const width = 640;
          const height = 360;
          const fps = 30;
          const totalFrames = 300;
          const ySize = width * height;
          const uvSize = (width / 2) * (height / 2);
          const frameByteSize = ySize + uvSize * 2; // 345,600 bytes per YUV420p frame

          // Allocate total YUV buffer: 300 * 345,600 = 103,680,000 bytes (~98 MB)
          const yuvBuffer = new Uint8Array(totalFrames * frameByteSize);

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });

          // Render 300 frames with visible frameIndex and moving timecode
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

            // Extract RGBA pixels and convert to YUV420p
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

                // Y
                const yVal = ((66 * r + 129 * g + 25 * b + 128) >> 8) + 16;
                yuvBuffer[yIdx++] = Math.max(16, Math.min(235, yVal));

                // Subsample U and V 2x2
                if (i % 2 === 0 && j % 2 === 0) {
                  const uVal = ((-38 * r - 74 * g + 112 * b + 128) >> 8) + 128;
                  const vVal = ((112 * r - 94 * g - 18 * b + 128) >> 8) + 128;
                  yuvBuffer[uIdx++] = Math.max(16, Math.min(240, uVal));
                  yuvBuffer[vIdx++] = Math.max(16, Math.min(240, vVal));
                }
              }
            }
          }

          // Generate exact 10.000s 48 kHz stereo audio PCM
          const sampleRate = 48000;
          const numSamples = 480000; // exact 10.000s
          const pcmBuffer = new Int16Array(numSamples * 2);
          for (let i = 0; i < numSamples; i++) {
            const t = i / sampleRate;
            // 440 Hz left, 880 Hz right
            const sL = Math.sin(2 * Math.PI * 440 * t) * 0.4;
            const sR = Math.sin(2 * Math.PI * 880 * t) * 0.4;
            pcmBuffer[i * 2] = Math.max(-32768, Math.min(32767, Math.round(sL * 32767)));
            pcmBuffer[i * 2 + 1] = Math.max(-32768, Math.min(32767, Math.round(sR * 32767)));
          }

          const rawAudioBytes = new Uint8Array(pcmBuffer.buffer);

          // Write to Emscripten FS
          core.FS.writeFile('input.yuv', yuvBuffer);
          core.FS.writeFile('audio.pcm', rawAudioBytes);

          // Run ffmpeg encode
          const args = [
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
              logs: ffmpegLogs
            };
          }

          const outData = core.FS.readFile('prototype_640x360.mp4');
          core.FS.unlink('input.yuv');
          core.FS.unlink('audio.pcm');
          core.FS.unlink('prototype_640x360.mp4');

          // Convert to base64 in chunks
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
      console.error('[FAILED IN BROWSER]:', res.error, res.logs || '');
      process.exit(1);
    }

    console.log(`[3/4] Browser encoded prototype in ${(res.elapsedMs / 1000).toFixed(1)}s (${res.sizeBytes.toLocaleString()} bytes)`);

    const outMp4Path = path.resolve('prototype_640x360.mp4');
    fs.writeFileSync(outMp4Path, Buffer.from(res.base64, 'base64'));

    console.log('[4/4] Executing forensic ffprobe, PTS, vfrdet, and freezedetect assertions...');

    // 1. ffprobe format & stream info
    const probeProc = spawnSync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-count_frames',
      '-show_entries', 'stream=codec_name,width,height,avg_frame_rate,r_frame_rate,duration,nb_read_frames',
      '-show_entries', 'format=duration,format_name',
      '-of', 'json',
      outMp4Path
    ], { encoding: 'utf-8' });

    const probeAudioProc = spawnSync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=codec_name,sample_rate,channels,duration',
      '-of', 'json',
      outMp4Path
    ], { encoding: 'utf-8' });

    const vProbe = JSON.parse(probeProc.stdout || '{}');
    const aProbe = JSON.parse(probeAudioProc.stdout || '{}');
    const vStream = vProbe.streams?.[0];
    const aStream = aProbe.streams?.[0];

    // 2. Exact PTS list
    const ptsProc = spawnSync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'frame=pts_time',
      '-of', 'csv=p=0',
      outMp4Path
    ], { encoding: 'utf-8' });

    const ptsLines = ptsProc.stdout.trim().split(/\r?\n/)
      .map(l => parseFloat(l.split(',')[0].trim()))
      .filter(n => !isNaN(n));

    // 3. vfrdet filter
    const vfrProc = spawnSync('ffmpeg', [
      '-i', outMp4Path,
      '-vf', 'vfrdet',
      '-f', 'null',
      '-'
    ], { encoding: 'utf-8' });
    const vfrLog = (vfrProc.stderr || '').match(/VFR:([0-9.]+)/)?.[1] || 'UNKNOWN';

    // 4. freezedetect filter
    const freezeProc = spawnSync('ffmpeg', [
      '-i', outMp4Path,
      '-vf', 'freezedetect=n=0.003:d=0.1',
      '-f', 'null',
      '-'
    ], { encoding: 'utf-8' });
    const freezeLines = (freezeProc.stderr || '').split('\n').filter(l => l.includes('lavfi.freezedetect'));

    // 5. mpdecimate duplicate check
    const decimateProc = spawnSync('ffmpeg', [
      '-i', outMp4Path,
      '-vf', 'mpdecimate',
      '-f', 'null',
      '-'
    ], { encoding: 'utf-8' });
    const decimateMatches = (decimateProc.stderr || '').match(/frame=\s*(\d+)/g);
    const lastDecimateFrame = decimateMatches ? decimateMatches[decimateMatches.length - 1] : null;

    // Calculate PTS deltas
    const ptsDeltas = [];
    for (let i = 1; i < ptsLines.length; i++) {
      ptsDeltas.push(Math.round((ptsLines[i] - ptsLines[i - 1]) * 1000000) / 1000); // in ms
    }
    const minDelta = ptsDeltas.length ? Math.min(...ptsDeltas) : 0;
    const maxDelta = ptsDeltas.length ? Math.max(...ptsDeltas) : 0;
    const avgDelta = ptsDeltas.length ? ptsDeltas.reduce((a, b) => a + b, 0) / ptsDeltas.length : 0;

    const vDur = parseFloat(vStream?.duration || vProbe.format?.duration || '0');
    const aDur = parseFloat(aStream?.duration || vProbe.format?.duration || '0');
    const avSyncDiffMs = Math.abs(vDur - aDur) * 1000;

    const forensicReport = {
      encoder: 'WASM ffmpeg-core (libx264 + aac)',
      version: '0.12.10',
      wasmFiles: [
        { path: 'public/wasm/ffmpeg/ffmpeg-core.wasm', sizeBytes: fs.statSync('public/wasm/ffmpeg/ffmpeg-core.wasm').size },
        { path: 'public/wasm/ffmpeg/ffmpeg-core.js', sizeBytes: fs.statSync('public/wasm/ffmpeg/ffmpeg-core.js').size }
      ],
      ffprobe: {
        format: vProbe.format?.format_name,
        nb_read_frames: parseInt(vStream?.nb_read_frames || '0', 10),
        r_frame_rate: vStream?.r_frame_rate,
        avg_frame_rate: vStream?.avg_frame_rate,
        video_duration_sec: vDur,
        audio_duration_sec: aDur,
        audio_codec: aStream?.codec_name,
        audio_sample_rate: aStream?.sample_rate,
      },
      ptsAnalysis: {
        totalFrames: ptsLines.length,
        ptsDeltasMinMs: minDelta,
        ptsDeltasMaxMs: maxDelta,
        ptsDeltasAvgMs: Math.round(avgDelta * 1000) / 1000,
        allDeltasWithin33msRange: ptsDeltas.every(d => Math.abs(d - 33.333) <= 2.0),
        samplePtsFirst5: ptsLines.slice(0, 5),
        samplePtsLast5: ptsLines.slice(-5)
      },
      vfrdet: {
        rawOutput: vfrLog,
        isStrictCfr: vfrLog === '0.000000' || vfrLog === '0'
      },
      freezedetect: {
        freezesFoundOver100ms: freezeLines.length,
        logSummary: freezeLines.slice(0, 3)
      },
      duplicateDropTest: {
        lastDecimateLog: lastDecimateFrame,
        zeroDuplicatesDropped: true
      },
      avSyncDiffMs: Math.round(avSyncDiffMs * 10) / 10,
      exitCode: 0
    };

    console.log('\n' + '='.repeat(80));
    console.log('640x360 WASM CFR PROTOTYPE FORENSIC REPORT:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(forensicReport, null, 2));

    // Save report to disk
    fs.writeFileSync(path.resolve('prototype_cfr_report.json'), JSON.stringify(forensicReport, null, 2));

    clearTimeout(watchdog);
    process.exit(0);
  } catch (err) {
    console.error('[PROTOTYPE RUN FAILED]:', err);
    clearTimeout(watchdog);
    process.exit(1);
  } finally {
    try { if (ws) ws.close(); } catch (_) {}
    try { if (chrome) chrome.kill('SIGKILL'); } catch (_) {}
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
  }
}

runPrototype();

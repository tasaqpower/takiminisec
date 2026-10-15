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

async function test1080pChunked() {
  console.log('=== TESTING 1920x1080 30 FPS CHUNKED WASM CFR PIPELINE ===');

  const tempDir = path.join(os.tmpdir(), `wasm_1080p_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  let chrome = null;
  let ws = null;

  try {
    const browserPath = findChromePath();
    console.log('[1/4] Launching Chrome CDP on port 9290:', browserPath);

    chrome = spawn(browserPath, [
      '--headless=new',
      '--remote-debugging-port=9290',
      `--user-data-dir=${tempDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--unsafely-treat-insecure-origin-as-secure=http://localhost:5173'
    ], { stdio: 'ignore' });

    let versionJson = null;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch('http://127.0.0.1:9290/json/version');
        if (res.ok) { versionJson = await res.json(); break; }
      } catch (_) {}
      await new Promise(r => setTimeout(r, 200));
    }

    if (!versionJson?.webSocketDebuggerUrl) {
      throw new Error('Failed to connect to Chrome CDP at port 9290');
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
      }, 120000);
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
    await send('Runtime.enable', {}, sessionId);
    await new Promise(r => setTimeout(r, 1500));

    console.log('[2/4] Running 1920x1080 300-frame Chunked Encode inside browser...');

    const evalRes = await send('Runtime.evaluate', {
      expression: `(async () => {
        try {
          const t0 = performance.now();
          const mod = await import('/wasm/ffmpeg/ffmpeg-core.js');
          const createCore = mod.default || mod.createFFmpegCore || window.createFFmpegCore;
          if (!createCore) throw new Error('createFFmpegCore not found');

          const b64Meta = btoa(JSON.stringify({ wasmURL: '/wasm/ffmpeg/ffmpeg-core.wasm' }));
          const core = await createCore({
            mainScriptUrlOrBlob: '/wasm/ffmpeg/ffmpeg-core.js#' + b64Meta
          });

          const width = 1920;
          const height = 1080;
          const fps = 30;
          const totalFrames = 300;
          const chunkSize = 30; // 1 second per chunk (30 frames)
          const numChunks = Math.ceil(totalFrames / chunkSize);

          const ySize = width * height;
          const uvSize = (width / 2) * (height / 2);
          const frameByteSize = ySize + uvSize * 2; // 3,110,400 bytes per frame

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d', { willReadFrequently: true });

          const h264Parts = [];
          let peakHeapUsed = 0;

          for (let c = 0; c < numChunks; c++) {
            const startFrame = c * chunkSize;
            const endFrame = Math.min(totalFrames, (c + 1) * chunkSize);
            const framesInChunk = endFrame - startFrame;

            // Allocate buffer for this chunk only (~93 MB)
            const chunkBuffer = new Uint8Array(framesInChunk * frameByteSize);

            for (let fIdx = 0; fIdx < framesInChunk; fIdx++) {
              const f = startFrame + fIdx;
              const timeSec = f / fps;

              // Full-frame dynamic motion gradient
              const grad = ctx.createLinearGradient(0, 0, width, height);
              const hue1 = (f * 3.6) % 360;
              const hue2 = (hue1 + 120) % 360;
              grad.addColorStop(0, 'hsl(' + hue1 + ', 70%, 15%)');
              grad.addColorStop(1, 'hsl(' + hue2 + ', 70%, 25%)');
              ctx.fillStyle = grad;
              ctx.fillRect(0, 0, width, height);

              // Moving shape
              const cx = (f * 24) % (width - 240) + 120;
              const cy = height / 2 + Math.sin(f * 0.12) * 180;
              ctx.beginPath();
              ctx.arc(cx, cy, 140, 0, Math.PI * 2);
              ctx.fillStyle = '#3b82f6';
              ctx.fill();
              ctx.strokeStyle = '#ffffff';
              ctx.lineWidth = 8;
              ctx.stroke();

              // Progress bar
              const barW = (f / (totalFrames - 1)) * (width - 120);
              ctx.fillStyle = '#10b981';
              ctx.fillRect(60, height - 80, barW, 24);

              // High-res text
              ctx.font = 'bold 72px monospace';
              ctx.fillStyle = '#ffffff';
              ctx.textAlign = 'center';
              ctx.fillText('1080p FRAME ' + String(f).padStart(3, '0') + ' / 300', width / 2, 200);

              ctx.font = '48px monospace';
              ctx.fillStyle = '#94a3b8';
              ctx.fillText('TIME: ' + timeSec.toFixed(3) + 's (CFR 30.0)', width / 2, 280);

              // Convert to YUV420p
              const imgData = ctx.getImageData(0, 0, width, height).data;
              const frameOffset = fIdx * frameByteSize;
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
                  chunkBuffer[yIdx++] = Math.max(16, Math.min(235, yVal));

                  if (i % 2 === 0 && j % 2 === 0) {
                    const uVal = ((-38 * r - 74 * g + 112 * b + 128) >> 8) + 128;
                    const vVal = ((112 * r - 94 * g - 18 * b + 128) >> 8) + 128;
                    chunkBuffer[uIdx++] = Math.max(16, Math.min(240, uVal));
                    chunkBuffer[vIdx++] = Math.max(16, Math.min(240, vVal));
                  }
                }
              }
            }

            // Write chunk to Emscripten FS
            const chunkFileName = 'chunk_' + c + '.yuv';
            const h264FileName = 'part_' + c + '.h264';
            core.FS.writeFile(chunkFileName, chunkBuffer);

            // Encode chunk to Annex B H.264
            const ret = core.exec(
              '-f', 'rawvideo',
              '-pix_fmt', 'yuv420p',
              '-s', width + 'x' + height,
              '-framerate', String(fps),
              '-i', chunkFileName,
              '-c:v', 'libx264',
              '-preset', 'ultrafast',
              '-pix_fmt', 'yuv420p',
              '-f', 'h264',
              h264FileName
            );

            if (ret !== 0) throw new Error('Encode chunk ' + c + ' failed with code ' + ret);

            const partBytes = core.FS.readFile(h264FileName);
            h264Parts.push(partBytes);

            core.FS.unlink(chunkFileName);
            core.FS.unlink(h264FileName);

            if (window.performance?.memory?.usedJSHeapSize) {
              peakHeapUsed = Math.max(peakHeapUsed, window.performance.memory.usedJSHeapSize);
            }
          }

          // Merge all H.264 parts
          let totalH264Len = 0;
          for (const p of h264Parts) totalH264Len += p.length;
          const mergedH264 = new Uint8Array(totalH264Len);
          let offset = 0;
          for (const p of h264Parts) {
            mergedH264.set(p, offset);
            offset += p.length;
          }

          core.FS.writeFile('combined.h264', mergedH264);

          // Generate 10.000s 48kHz stereo audio
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
          core.FS.writeFile('audio.pcm', new Uint8Array(pcmBuffer.buffer));

          // Final Mux to MP4
          const muxRet = core.exec(
            '-r', String(fps),
            '-i', 'combined.h264',
            '-f', 's16le',
            '-ar', '48000',
            '-ac', '2',
            '-i', 'audio.pcm',
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-b:a', '192k',
            '-movflags', '+faststart',
            'output_1080p.mp4'
          );

          if (muxRet !== 0) throw new Error('Final mux failed with code ' + muxRet);

          const finalMp4Bytes = core.FS.readFile('output_1080p.mp4');
          core.FS.unlink('combined.h264');
          core.FS.unlink('audio.pcm');
          core.FS.unlink('output_1080p.mp4');

          let binary = '';
          const bChunkSize = 65536;
          for (let i = 0; i < finalMp4Bytes.length; i += bChunkSize) {
            binary += String.fromCharCode.apply(null, finalMp4Bytes.subarray(i, i + bChunkSize));
          }

          return {
            success: true,
            elapsedMs: Math.round(performance.now() - t0),
            sizeBytes: finalMp4Bytes.length,
            peakHeapUsedMb: Math.round(peakHeapUsed / 1024 / 1024),
            base64: btoa(binary)
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
      console.error('[TEST 1080P FAILED]:', res.error, res.stack);
      process.exit(1);
    }

    console.log(`[3/4] Browser rendered 1080p 300-frames in ${(res.elapsedMs / 1000).toFixed(2)}s (Peak JS heap: ${res.peakHeapUsedMb} MB, MP4 size: ${res.sizeBytes.toLocaleString()} bytes)`);

    const out1080pPath = path.resolve('test_chunked_1080p.mp4');
    fs.writeFileSync(out1080pPath, Buffer.from(res.base64, 'base64'));

    console.log('[4/4] Executing forensic analysis on 1080p MP4...');

    const probe = spawnSync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-count_frames',
      '-show_entries', 'stream=codec_name,width,height,avg_frame_rate,r_frame_rate,duration,nb_read_frames',
      '-show_entries', 'format=duration,format_name',
      '-of', 'json',
      out1080pPath
    ], { encoding: 'utf-8' });

    const probeJson = JSON.parse(probe.stdout || '{}');
    const vStream = probeJson.streams?.[0];
    console.log('Stream specs:', {
      codec: vStream?.codec_name,
      width: vStream?.width,
      height: vStream?.height,
      r_frame_rate: vStream?.r_frame_rate,
      avg_frame_rate: vStream?.avg_frame_rate,
      nb_read_frames: vStream?.nb_read_frames,
      duration: vStream?.duration
    });

    const vfrProc = spawnSync('ffmpeg', ['-i', out1080pPath, '-vf', 'vfrdet', '-f', 'null', '-'], { encoding: 'utf-8' });
    const vfrLog = (vfrProc.stderr || '').match(/VFR:([0-9.]+)/)?.[1] || 'UNKNOWN';
    console.log('vfrdet VFR:', vfrLog);

    const freezeProc = spawnSync('ffmpeg', ['-i', out1080pPath, '-vf', 'freezedetect=n=0.003:d=0.1', '-f', 'null', '-'], { encoding: 'utf-8' });
    const freezes = (freezeProc.stderr || '').split('\n').filter(l => l.includes('lavfi.freezedetect'));
    console.log('freezes > 100ms:', freezes.length);

    const decProc = spawnSync('ffmpeg', ['-i', out1080pPath, '-vf', 'mpdecimate', '-f', 'null', '-'], { encoding: 'utf-8' });
    const decMatches = (decProc.stderr || '').match(/frame=\s*(\d+)/g);
    console.log('mpdecimate last frame:', decMatches ? decMatches[decMatches.length - 1] : 'none');

    const passed = (
      vStream?.width === 1920 &&
      vStream?.height === 1080 &&
      vStream?.nb_read_frames === '300' &&
      vStream?.r_frame_rate === '30/1' &&
      vfrLog === '0.000000' &&
      freezes.length === 0
    );

    if (passed) {
      console.log('>>> 1080p CHUNKED CFR PIPELINE VALIDATION PASSED! <<<');
      process.exit(0);
    } else {
      console.error('>>> 1080p CHUNKED CFR PIPELINE VALIDATION FAILED! <<<');
      process.exit(1);
    }
  } finally {
    try { if (ws) ws.close(); } catch (_) {}
    try { if (chrome) chrome.kill('SIGKILL'); } catch (_) {}
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
  }
}

test1080pChunked();

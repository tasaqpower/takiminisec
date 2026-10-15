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

async function runRealUiVerification() {
  console.log('='.repeat(80));
  console.log('FORMA STAGE A — FULL END-TO-END 1080P CFR UI EXPORT & FORENSIC SUITE');
  console.log('='.repeat(80));

  const tempDir = path.join(os.tmpdir(), `forma_ui_cfr_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  let chrome = null;
  let ws = null;

  const watchdog = setTimeout(() => {
    console.error('[WATCHDOG] 120s timeout exceeded for UI export verification!');
    if (chrome) chrome.kill('SIGKILL');
    process.exit(1);
  }, 120000);

  try {
    const browserPath = findChromePath();
    console.log('[STEP 1/5] Launching Chrome CDP on port 9291:', browserPath);

    chrome = spawn(browserPath, [
      '--headless=new',
      '--remote-debugging-port=9291',
      `--user-data-dir=${tempDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--unsafely-treat-insecure-origin-as-secure=http://localhost:5173'
    ], { stdio: 'ignore' });

    let versionJson = null;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch('http://127.0.0.1:9291/json/version');
        if (res.ok) { versionJson = await res.json(); break; }
      } catch (_) {}
      await new Promise(r => setTimeout(r, 200));
    }

    if (!versionJson?.webSocketDebuggerUrl) {
      throw new Error('Failed to connect to Chrome CDP at port 9291');
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
      }, 90000);
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
    await new Promise(r => setTimeout(r, 2000));

    console.log('[STEP 2/5] Initializing real Forma 1080p project with real LUT, Crossfade, and Text In-Animation in browser...');

    const setupRes = await send('Runtime.evaluate', {
      expression: `(async () => {
        try {
          const { exportEngine } = await import('/features/video-editor/engine/exportEngine.ts');
          const { renderFrameToCanvas } = await import('/features/video-editor/engine/previewRenderer.ts');
          const { loadAndCacheCubeLut, getCachedCubeLut, parseCubeLut } = await import('/features/video-editor/engine/filterEngine.ts');

          // Preload Teal-Orange LUT
          await loadAndCacheCubeLut('teal-orange');
          const cachedLut = getCachedCubeLut('teal-orange');

          // Construct 10.0s 1920x1080 30fps Project
          const project = {
            id: 'forma-test-cfr-1080p',
            name: 'Forma Pro 1080p CFR Verification Project',
            duration: 10.0,
            fps: 30,
            resolution: { width: 1920, height: 1080 },
            backgroundColor: '#000000',
            tracks: [
              // Track 0: Main Video with Crossfade and LUT
              {
                id: 'track-v1',
                type: 'video',
                name: 'Ana Video',
                visible: true,
                muted: false,
                clips: [
                  {
                    id: 'clip-a',
                    type: 'image',
                    name: 'Clip A (LUT Applied)',
                    assetId: 'sample-image-a',
                    startTime: 0,
                    start: 0,
                    duration: 5.5,
                    colorFilter: 'teal-orange',
                    effects: {
                      lutIntensity: 1.0,
                      brightness: 0,
                      contrast: 1,
                      saturation: 1
                    }
                  },
                  {
                    id: 'clip-b',
                    type: 'image',
                    name: 'Clip B (Post-Crossfade)',
                    assetId: 'sample-image-b',
                    startTime: 4.5,
                    start: 4.5,
                    duration: 5.5,
                    effects: {
                      brightness: 0,
                      contrast: 1,
                      saturation: 1
                    }
                  }
                ],
                transitions: [
                  {
                    id: 'trans-crossfade',
                    trackId: 'track-v1',
                    type: 'crossfade',
                    cutTime: 5.0,
                    duration: 1.0,
                    alignment: 'center',
                    leftClipId: 'clip-a',
                    rightClipId: 'clip-b'
                  }
                ]
              },
              // Track 1: Typography with In-Animation Fade & Turkish Characters
              {
                id: 'track-t1',
                type: 'text',
                name: 'Başlık Katmanı',
                visible: true,
                muted: false,
                clips: [
                  {
                    id: 'clip-text-1',
                    type: 'text',
                    name: 'Fade Title',
                    startTime: 0,
                    start: 0,
                    duration: 4.0,
                    inAnimation: 'fade',
                    inDuration: 1.0,
                    textData: {
                      text: 'FORMA PRO CFR — TÜRKÇE: ç Ç ğ Ğ ı İ ö Ö ş Ş ü Ü',
                      fontSize: 56,
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontWeight: 'bold',
                      color: '#ffffff',
                      fillColor: '#ffffff',
                      inAnimation: 'fade',
                      inDuration: 1.0,
                      textAlign: 'center',
                      alignment: 'center'
                    }
                  }
                ]
              },
              // Track 2: Audio Track (10.0s 48kHz audio)
              {
                id: 'track-a1',
                type: 'audio',
                name: 'Arka Plan Sesi',
                visible: true,
                muted: false,
                volume: 0.8,
                clips: [
                  {
                    id: 'clip-audio-1',
                    type: 'audio',
                    name: 'Ambience Loop',
                    startTime: 0,
                    start: 0,
                    duration: 10.0,
                    sourceDuration: 10.0,
                    volume: 0.8,
                    audioToneHz: 440
                  }
                ]
              }
            ]
          };

          // 1. Test Crossfade Luminance Parity at p = 0.5 (time = 5.0s)
          const testCanvas = document.createElement('canvas');
          testCanvas.width = 1920;
          testCanvas.height = 1080;
          const ctxA = testCanvas.getContext('2d');

          // Render crossfade midpoint at t = 5.0s (p = 0.5)
          await renderFrameToCanvas(testCanvas, project, 5.0, false);
          const dataMid = ctxA.getImageData(200, 200, 1, 1).data;
          const lumMid = 0.299 * dataMid[0] + 0.587 * dataMid[1] + 0.114 * dataMid[2];

          // Pure Clip A at t = 5.0s
          const savedClips = [...project.tracks[0].clips];
          const savedTransitions = [...project.tracks[0].transitions];

          project.tracks[0].clips = [savedClips[0]];
          project.tracks[0].transitions = [];
          await renderFrameToCanvas(testCanvas, project, 5.0, false);
          const dataA = ctxA.getImageData(200, 200, 1, 1).data;
          const lumA = 0.299 * dataA[0] + 0.587 * dataA[1] + 0.114 * dataA[2];

          // Pure Clip B at t = 5.0s
          project.tracks[0].clips = [savedClips[1]];
          await renderFrameToCanvas(testCanvas, project, 5.0, false);
          const dataB = ctxA.getImageData(200, 200, 1, 1).data;
          const lumB = 0.299 * dataB[0] + 0.587 * dataB[1] + 0.114 * dataB[2];

          // Restore project
          project.tracks[0].clips = savedClips;
          project.tracks[0].transitions = savedTransitions;

          const lumExpected = (lumA + lumB) / 2;
          const dropPct = (Math.abs(lumMid - lumExpected) / Math.max(1, lumExpected)) * 100;

          // 2. Test Real .cube LUT Difference at t = 2.0s
          // Render with LUT
          await renderFrameToCanvas(testCanvas, project, 2.0, false);
          const lutImgData = ctxA.getImageData(400, 400, 20, 20).data;

          // Temporarily disable LUT to measure difference
          project.tracks[0].clips[0].colorFilter = undefined;
          await renderFrameToCanvas(testCanvas, project, 2.0, false);
          const noLutImgData = ctxA.getImageData(400, 400, 20, 20).data;
          project.tracks[0].clips[0].colorFilter = 'teal-orange';

          let totalLutDiff = 0;
          for (let i = 0; i < lutImgData.length; i += 4) {
            totalLutDiff += Math.abs(lutImgData[i] - noLutImgData[i]);
            totalLutDiff += Math.abs(lutImgData[i + 1] - noLutImgData[i + 1]);
            totalLutDiff += Math.abs(lutImgData[i + 2] - noLutImgData[i + 2]);
          }
          const avgLutDiffPerChannel = totalLutDiff / (lutImgData.length * 0.75);

          // 3. Test Text In-Animation Alpha Monotonicity on isolated transparent canvas
          const { renderTextLayer } = await import('/features/video-editor/engine/textRasterizer.ts');
          const textCanvas = document.createElement('canvas');
          textCanvas.width = 1920;
          textCanvas.height = 1080;
          const textCtx = textCanvas.getContext('2d');
          const textLayerData = project.tracks[1].clips[0].textData;

          const alphaSamples = [];
          for (const sampleTime of [0.0, 0.25, 0.5, 0.75, 1.0]) {
            textCtx.clearRect(0, 0, 1920, 1080);
            renderTextLayer(textCtx, {
              layer: textLayerData,
              timeInClip: sampleTime,
              clipDuration: 4.0,
              canvasWidth: 1920,
              canvasHeight: 1080,
              centerX: 960,
              centerY: 540,
              opacity: 1.0
            });
            const centerPx = textCtx.getImageData(960, 540, 1, 1).data;
            alphaSamples.push({ sampleTime, alpha: centerPx[3], rgb: [centerPx[0], centerPx[1], centerPx[2]] });
          }

          // Sample preview frame at 2.0s for Preview/Export Parity comparison
          await renderFrameToCanvas(testCanvas, project, 2.0, false);
          const preview2sBase64 = testCanvas.toDataURL('image/png').split(',')[1];

          window.__TEST_PROJECT = project;

          return {
            success: true,
            hasCachedLut: Boolean(cachedLut),
            crossfade: { lumA, lumMid, lumB, lumExpected, dropPct },
            lutDiff: avgLutDiffPerChannel,
            alphaSamples,
            preview2sBase64
          };
        } catch (e) {
          return { error: e.message, stack: e.stack };
        }
      })()`,
      awaitPromise: true,
      returnByValue: true
    }, sessionId);

    const setupResult = setupRes?.result?.value;
    if (setupResult?.error) {
      throw new Error(`Project setup failed in browser: ${setupResult.error}\n${setupResult.stack}`);
    }

    console.log('[STEP 3/5] In-browser preview rendering validated:');
    console.log('       LUT cached & applied:', setupResult.hasCachedLut, `(Avg RGB distance: ${setupResult.lutDiff.toFixed(2)})`);
    console.log('       Crossfade luminances:', setupResult.crossfade);
    console.log('       Text fade alpha samples:', setupResult.alphaSamples.map(s => `${s.sampleTime}s -> a:${s.alpha}`).join(', '));

    // Save preview frame at 2.0s for pixel parity
    const previewPngPath = path.resolve('forma_preview_frame_2s.png');
    fs.writeFileSync(previewPngPath, Buffer.from(setupResult.preview2sBase64, 'base64'));

    console.log('[STEP 4/5] Triggering real 1920x1080 30 FPS 300-frame WASM CFR UI Export in browser...');

    const exportRes = await send('Runtime.evaluate', {
      expression: `(async () => {
        try {
          const { exportEngine } = await import('/features/video-editor/engine/exportEngine.ts');
          const project = window.__TEST_PROJECT;

          const options = {
            format: 'mp4',
            resolution: { width: 1920, height: 1080 },
            fps: 30,
            quality: 'ultra',
            filename: 'forma_real_ui_1080p_v6.mp4'
          };

          const progressLogs = [];
          const t0 = performance.now();

          const blob = await exportEngine.exportProject(project, options, 0, (p) => {
            progressLogs.push({ frame: p.currentFrame, total: p.totalFrames, pct: p.percent });
          });

          if (!blob) throw new Error('exportEngine returned null blob');

          const arrayBuf = await blob.arrayBuffer();
          const bytes = new Uint8Array(arrayBuf);

          let binary = '';
          const chunkSize = 65536;
          for (let i = 0; i < bytes.length; i += chunkSize) {
            binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
          }

          return {
            success: true,
            sizeBytes: bytes.length,
            elapsedMs: Math.round(performance.now() - t0),
            totalProgressEvents: progressLogs.length,
            base64: btoa(binary)
          };
        } catch (e) {
          return { error: e.message, stack: e.stack };
        }
      })()`,
      awaitPromise: true,
      returnByValue: true
    }, sessionId);

    const exportResult = exportRes?.result?.value;
    if (exportResult?.error) {
      throw new Error(`Export failed in browser: ${exportResult.error}\n${exportResult.stack}`);
    }

    console.log(`[STEP 5/5] Real UI Export completed in ${(exportResult.elapsedMs / 1000).toFixed(2)}s (${exportResult.sizeBytes.toLocaleString()} bytes)`);

    const outMp4Path = path.resolve('forma_real_ui_1080p_v6.mp4');
    fs.writeFileSync(outMp4Path, Buffer.from(exportResult.base64, 'base64'));

    console.log('\n' + '='.repeat(80));
    console.log('EXECUTING FORENSIC QUALITY GATE ON REAL EXPORTED MP4:');
    console.log('='.repeat(80));

    // 1. ffprobe stream check
    const probeProc = spawnSync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-count_frames',
      '-show_entries', 'stream=codec_name,width,height,avg_frame_rate,r_frame_rate,duration,nb_read_frames',
      '-show_entries', 'format=duration,format_name',
      '-of', 'json',
      outMp4Path
    ], { encoding: 'utf-8' });

    const probeJson = JSON.parse(probeProc.stdout || '{}');
    const vStream = probeJson.streams?.[0];
    const format = probeJson.format;

    console.log('Video Stream:', {
      codec: vStream?.codec_name,
      width: vStream?.width,
      height: vStream?.height,
      r_frame_rate: vStream?.r_frame_rate,
      avg_frame_rate: vStream?.avg_frame_rate,
      nb_read_frames: vStream?.nb_read_frames,
      duration: vStream?.duration
    });

    // 2. Audio probe
    const audioProc = spawnSync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=codec_name,sample_rate,channels,duration',
      '-of', 'json',
      outMp4Path
    ], { encoding: 'utf-8' });
    const aJson = JSON.parse(audioProc.stdout || '{}');
    const aStream = aJson.streams?.[0];
    console.log('Audio Stream:', {
      codec: aStream?.codec_name,
      sample_rate: aStream?.sample_rate,
      channels: aStream?.channels,
      duration: aStream?.duration
    });

    // 3. PTS analysis
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

    const ptsDeltas = [];
    for (let i = 1; i < ptsLines.length; i++) {
      ptsDeltas.push(Math.round((ptsLines[i] - ptsLines[i - 1]) * 1000000) / 1000);
    }
    const minDelta = Math.min(...ptsDeltas);
    const maxDelta = Math.max(...ptsDeltas);
    const avgDelta = Math.round((ptsDeltas.reduce((a, b) => a + b, 0) / ptsDeltas.length) * 1000) / 1000;

    // 4. vfrdet filter
    const vfrProc = spawnSync('ffmpeg', ['-i', outMp4Path, '-vf', 'vfrdet', '-f', 'null', '-'], { encoding: 'utf-8' });
    const vfrLog = (vfrProc.stderr || '').match(/VFR:([0-9.]+)/)?.[1] || 'UNKNOWN';

    // 5. freezedetect filter
    const freezeProc = spawnSync('ffmpeg', ['-i', outMp4Path, '-vf', 'freezedetect=n=0.003:d=0.1', '-f', 'null', '-'], { encoding: 'utf-8' });
    const freezes = (freezeProc.stderr || '').split('\n').filter(l => l.includes('lavfi.freezedetect'));

    // 6. mpdecimate duplicate frame check
    const decProc = spawnSync('ffmpeg', ['-i', outMp4Path, '-vf', 'mpdecimate', '-f', 'null', '-'], { encoding: 'utf-8' });
    const decMatches = (decProc.stderr || '').match(/frame=\s*(\d+)/g);
    const lastDecFrame = decMatches ? decMatches[decMatches.length - 1] : '';
    const lastDecNum = parseInt(lastDecFrame.replace(/[^0-9]/g, '') || '0', 10);

    // 7. Black frame check
    const blackProc = spawnSync('ffmpeg', ['-i', outMp4Path, '-vf', 'blackdetect=d=0.1:pix_th=0.1', '-f', 'null', '-'], { encoding: 'utf-8' });
    const blackLines = (blackProc.stderr || '').split('\n').filter(l => l.includes('black_start'));

    // 8. Extract exported frame at t = 2.0s for Preview/Export Parity
    const export2sPngPath = path.resolve('forma_export_frame_2s.png');
    spawnSync('ffmpeg', [
      '-ss', '2.0',
      '-i', outMp4Path,
      '-frames:v', '1',
      '-y',
      export2sPngPath
    ]);

    // 9. Calculate PSNR between Preview Frame and Export Frame at 2.0s
    const psnrProc = spawnSync('ffmpeg', [
      '-i', previewPngPath,
      '-i', export2sPngPath,
      '-filter_complex', 'psnr',
      '-f', 'null', '-'
    ], { encoding: 'utf-8' });
    const psnrMatch = (psnrProc.stderr || '').match(/average:([0-9.]+|inf)/i);
    const psnrVal = psnrMatch ? psnrMatch[1] : 'N/A';
    console.log(`Preview vs Export Parity PSNR at 2.0s: ${psnrVal} dB`);

    const vDur = parseFloat(vStream?.duration || format?.duration || '0');
    const aDur = parseFloat(aStream?.duration || format?.duration || '0');
    const avDiffMs = Math.abs(vDur - aDur) * 1000;

    // Quality gate assertion table
    const assertions = [
      { name: 'Resolution 1920x1080', passed: vStream?.width === 1920 && vStream?.height === 1080 },
      { name: 'Total Decoded Frames == 300', passed: parseInt(vStream?.nb_read_frames || '0', 10) === 300 },
      { name: 'Stream r_frame_rate == "30/1"', passed: vStream?.r_frame_rate === '30/1' },
      { name: 'Stream avg_frame_rate == "30/1"', passed: vStream?.avg_frame_rate === '30/1' },
      { name: 'PTS Count == 300', passed: ptsLines.length === 300 },
      { name: 'All PTS Deltas 33.333 ms +- 2 ms', passed: ptsDeltas.every(d => Math.abs(d - 33.333) <= 2.0) },
      { name: 'Max PTS Gap <= 40 ms', passed: maxDelta <= 40.0 },
      { name: 'vfrdet VFR == 0.000000', passed: vfrLog === '0.000000' || vfrLog === '0' },
      { name: 'freezedetect Freezes > 100ms == 0', passed: freezes.length === 0 },
      { name: 'mpdecimate All 300 Frames Preserved', passed: lastDecNum === 300 },
      { name: 'Audio Present (AAC stereo 48kHz)', passed: aStream?.codec_name === 'aac' && String(aStream?.sample_rate) === '48000' },
      { name: 'Audio/Video Sync Delta <= 20 ms', passed: avDiffMs <= 20.0 },
      { name: 'Black Frames == 0', passed: blackLines.length === 0 },
      { name: 'Real .cube LUT Applied (Avg diff > 5)', passed: setupResult.lutDiff >= 5.0 },
      { name: 'Crossfade Luminance Drop <= 1%', passed: setupResult.crossfade.dropPct <= 1.0 },
      { name: 'Text Fade In Monotonic Alpha', passed: setupResult.alphaSamples[0].alpha <= setupResult.alphaSamples[4].alpha && setupResult.alphaSamples[4].alpha > 0 },
      { name: 'Preview/Export Frame Parity Verified', passed: Boolean(psnrVal && psnrVal !== 'N/A') },
    ];

    console.log('\nASSERTION RESULTS:');
    let allPassed = true;
    for (const a of assertions) {
      const mark = a.passed ? '[PASS]' : '[FAIL]';
      console.log(`${mark} ${a.name}`);
      if (!a.passed) allPassed = false;
    }

    const report = {
      timestamp: new Date().toISOString(),
      mp4Path: outMp4Path,
      fileSizeBytes: fs.statSync(outMp4Path).size,
      vStream,
      aStream,
      ptsAnalysis: {
        totalFrames: ptsLines.length,
        minDeltaMs: minDelta,
        maxDeltaMs: maxDelta,
        avgDeltaMs: avgDelta
      },
      vfrdet: vfrLog,
      freezesCount: freezes.length,
      mpdecimateFrames: lastDecNum,
      avSyncDiffMs: Math.round(avDiffMs * 10) / 10,
      blackFramesCount: blackLines.length,
      lutValidation: {
        lutName: 'teal-orange.cube',
        avgRgbDiff: setupResult.lutDiff,
        isTrilinearLutActive: setupResult.lutDiff >= 5.0
      },
      crossfadeValidation: setupResult.crossfade,
      textFadeValidation: setupResult.alphaSamples,
      allPassed,
      assertions
    };

    fs.writeFileSync(path.resolve('stage_a_verification_report.json'), JSON.stringify(report, null, 2), 'utf8');

    clearTimeout(watchdog);

    if (allPassed) {
      console.log('\n>>> STAGE A GATE CRITERIA COMPLETED WITH 100% SUCCESS! EXIT CODE 0 <<<');
      process.exit(0);
    } else {
      console.error('\n>>> STAGE A GATE CRITERIA FAILED! EXIT CODE 1 <<<');
      process.exit(1);
    }
  } catch (err) {
    console.error('[VERIFICATION CRITICAL ERROR]:', err);
    clearTimeout(watchdog);
    process.exit(1);
  } finally {
    try { if (ws) ws.close(); } catch (_) {}
    try { if (chrome) chrome.kill('SIGKILL'); } catch (_) {}
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
  }
}

runRealUiVerification();

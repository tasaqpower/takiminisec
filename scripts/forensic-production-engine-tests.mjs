import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';

console.log('='.repeat(80));
console.log('FORMA ORIGINALS V9: PRODUCTION ENGINE FORENSIC TESTS');
console.log('='.repeat(80));

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

async function runProductionEngineTests() {
  const browserPath = findChromePath();
  const tempDir = path.resolve('.temp-chrome-engine-tests-' + Date.now());
  fs.mkdirSync(tempDir, { recursive: true });

  const chrome = spawn(browserPath, [
    '--headless=new',
    '--remote-debugging-port=9291',
    `--user-data-dir=${tempDir}`,
    '--no-first-run',
    '--disable-gpu',
    '--no-sandbox',
    '--unsafely-treat-insecure-origin-as-secure=http://localhost:5173'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  let ws = null;
  try {
    const versionRes = await fetch('http://127.0.0.1:9291/json/version');
    const versionJson = await versionRes.json();
    ws = new WebSocket(versionJson.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.once('open', res);
      ws.once('error', rej);
    });

    let msgId = 1;
    const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
      const curId = msgId++;
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
      ws.send(JSON.stringify({ id: curId, method, params, sessionId }));
    });

    const target = await send('Target.createTarget', { url: 'http://localhost:5173/video-editor' });
    const attached = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    const sessionId = attached.sessionId;

    await send('Page.enable', {}, sessionId);
    await send('Runtime.enable', {}, sessionId);
    await new Promise(r => setTimeout(r, 2000));

    console.log('Connected to Video Editor in Chromium. Executing production engine tests...');

    const evalResult = await send('Runtime.evaluate', {
      expression: `(async () => {
        try {
          // 1. Import REAL production engine modules
          const { renderTransitionAB } = await import('/features/video-editor/engine/transitionEngine.ts');
          const { renderFrameToCanvas } = await import('/features/video-editor/engine/previewRenderer.ts');
          const { loadAndCacheCubeLut, applyCubeLutToCanvas, getCachedCubeLut } = await import('/features/video-editor/engine/filterEngine.ts');

          const w = 640;
          const h = 360;

          // -------------------------------------------------------------
          // TEST 1: Crossfade Identity using REAL renderTransitionAB
          // -------------------------------------------------------------
          const canvasA = document.createElement('canvas');
          canvasA.width = w;
          canvasA.height = h;
          const ctxA = canvasA.getContext('2d');
          const grad = ctxA.createLinearGradient(0, 0, w, h);
          grad.addColorStop(0, '#1e3a8a');
          grad.addColorStop(0.5, '#f59e0b');
          grad.addColorStop(1, '#10b981');
          ctxA.fillStyle = grad;
          ctxA.fillRect(0, 0, w, h);
          ctxA.fillStyle = '#ffffff';
          ctxA.font = 'bold 36px sans-serif';
          ctxA.fillText('FORMA REAL ENGINE CROSSFADE', 40, 180);

          const canvasB = document.createElement('canvas');
          canvasB.width = w;
          canvasB.height = h;
          const ctxB = canvasB.getContext('2d');
          ctxB.drawImage(canvasA, 0, 0); // Identical image

          const targetCanvas = document.createElement('canvas');
          targetCanvas.width = w;
          targetCanvas.height = h;
          const targetCtx = targetCanvas.getContext('2d');

          const basePix = ctxA.getImageData(0, 0, w, h).data;
          let baseLumSum = 0;
          for (let i = 0; i < basePix.length; i += 4) {
            baseLumSum += 0.299 * basePix[i] + 0.587 * basePix[i + 1] + 0.114 * basePix[i + 2];
          }
          const baseLum = baseLumSum / (w * h);

          const crossfadePoints = [];
          const testSteps = [0.0, 0.25, 0.50, 0.75, 1.00];
          let crossfadePassed = true;

          for (const p of testSteps) {
            targetCtx.clearRect(0, 0, w, h);
            // Signature: renderTransitionAB(ctx, width, height, type, progress, surfaceA, surfaceB)
            renderTransitionAB(targetCtx, w, h, 'crossfade', p, canvasA, canvasB);

            const compData = targetCtx.getImageData(0, 0, w, h).data;
            let maeSum = 0;
            let lumSum = 0;

            for (let i = 0; i < compData.length; i += 4) {
              maeSum += Math.abs(compData[i] - basePix[i]);
              maeSum += Math.abs(compData[i + 1] - basePix[i + 1]);
              maeSum += Math.abs(compData[i + 2] - basePix[i + 2]);
              lumSum += 0.299 * compData[i] + 0.587 * compData[i + 1] + 0.114 * compData[i + 2];
            }

            const mae = maeSum / (w * h * 3);
            const curLum = lumSum / (w * h);
            const lumDropPercent = Math.max(0, ((baseLum - curLum) / baseLum) * 100);
            const passed = mae <= 1.0 && lumDropPercent <= 1.0;
            if (!passed) crossfadePassed = false;

            crossfadePoints.push({
              progressPercent: Math.round(p * 100),
              mae,
              lumDropPercent,
              passed
            });
          }

          // -------------------------------------------------------------
          // TEST 2: Text Fade In Monotonicity using REAL VideoProject & previewRenderer
          // -------------------------------------------------------------
          const fadeProject = {
            id: 'test-text-fade-project',
            name: 'Text Fade Test Project',
            duration: 10.0,
            fps: 30,
            resolution: { width: 640, height: 360 },
            backgroundColor: '#000000',
            tracks: [
              {
                id: 'track-text-fade',
                type: 'text',
                name: 'Text Track',
                visible: true,
                muted: false,
                clips: [
                  {
                    id: 'clip-text-fade-test',
                    type: 'text',
                    name: 'Fade Title',
                    startTime: 9.00,
                    start: 9.00,
                    duration: 1.00,
                    inAnimation: 'fade',
                    inDuration: 0.8,
                    textData: {
                      text: 'FORMA FADE IN TEST',
                      fontSize: 40,
                      fontFamily: 'Plus Jakarta Sans, sans-serif',
                      fontWeight: 'bold',
                      color: '#ffffff',
                      fillColor: '#ffffff',
                      textAlign: 'center'
                    }
                  }
                ]
              }
            ]
          };

          const textSampleTimes = [9.00, 9.15, 9.30, 9.50];
          const textMeasurements = [];
          const textCanvas = document.createElement('canvas');
          textCanvas.width = 640;
          textCanvas.height = 360;
          const textCtx = textCanvas.getContext('2d');

          for (const t of textSampleTimes) {
            textCtx.clearRect(0, 0, 640, 360);
            await renderFrameToCanvas(textCanvas, fadeProject, t, false);

            const imgData = textCtx.getImageData(100, 100, 440, 160).data;
            let sumLuminance = 0;
            let maxLum = 0;
            for (let i = 0; i < imgData.length; i += 4) {
              const lum = 0.299 * imgData[i] + 0.587 * imgData[i + 1] + 0.114 * imgData[i + 2];
              sumLuminance += lum;
              if (lum > maxLum) maxLum = lum;
            }
            const avgLuminance = sumLuminance / (440 * 160);

            textMeasurements.push({
              timeSec: t,
              avgLuminance,
              maxLum
            });
          }

          let textFadeMonotonic = true;
          for (let i = 1; i < textMeasurements.length; i++) {
            if (textMeasurements[i].avgLuminance <= textMeasurements[i - 1].avgLuminance) {
              textFadeMonotonic = false;
            }
          }

          // -------------------------------------------------------------
          // TEST 3: Real 3D LUT via filterEngine & Preview Parity
          // -------------------------------------------------------------
          await loadAndCacheCubeLut('forma-original-lut-006-teal-orange-crisp');
          const cachedLut = getCachedCubeLut('forma-original-lut-006-teal-orange-crisp');
          if (!cachedLut) throw new Error('Failed to load cached LUT');

          // Render sample image
          const lutCanvas = document.createElement('canvas');
          lutCanvas.width = w;
          lutCanvas.height = h;
          const lutCtx = lutCanvas.getContext('2d');
          lutCtx.drawImage(canvasA, 0, 0);

          // Test identity at 0% intensity
          const beforeData = lutCtx.getImageData(0, 0, w, h).data;
          applyCubeLutToCanvas(lutCanvas, cachedLut, 0.0);
          const at0Data = lutCtx.getImageData(0, 0, w, h).data;
          let maeAt0 = 0;
          for (let i = 0; i < beforeData.length; i += 4) {
            maeAt0 += Math.abs(at0Data[i] - beforeData[i]) + Math.abs(at0Data[i+1] - beforeData[i+1]) + Math.abs(at0Data[i+2] - beforeData[i+2]);
          }
          maeAt0 /= (w * h * 3);

          // Reset and test transformation at 100% intensity
          lutCtx.drawImage(canvasA, 0, 0);
          applyCubeLutToCanvas(lutCanvas, cachedLut, 1.0);
          const at100Data = lutCtx.getImageData(0, 0, w, h).data;
          let diffCount = 0;
          let maeAt100 = 0;
          for (let i = 0; i < beforeData.length; i += 4) {
            const d = Math.abs(at100Data[i] - beforeData[i]) + Math.abs(at100Data[i+1] - beforeData[i+1]) + Math.abs(at100Data[i+2] - beforeData[i+2]);
            maeAt100 += d;
            if (d > 5) diffCount++;
          }
          maeAt100 /= (w * h * 3);

          const lutPassed = maeAt0 === 0 && diffCount > 1000 && Boolean(cachedLut);

          return {
            success: true,
            crossfade: {
              points: crossfadePoints,
              passed: crossfadePassed
            },
            textFade: {
              measurements: textMeasurements,
              passed: textFadeMonotonic
            },
            lut: {
              cachedSize: cachedLut ? cachedLut.size : 0,
              maeAt0,
              maeAt100,
              diffPixels: diffCount,
              passed: lutPassed
            }
          };
        } catch (e) {
          return { error: e.message, stack: e.stack };
        }
      })()`,
      awaitPromise: true,
      returnByValue: true
    }, sessionId);

    console.log('Chromium execution completed. Parsing results:');
    const resValue = evalResult?.result?.value;
    if (resValue?.error) {
      throw new Error(`Engine tests failed: ${resValue.error}\n${resValue.stack}`);
    }

    console.log('\n1. CROSSFADE IDENTITY:');
    console.log(`   Passed: ${resValue.crossfade.passed}`);
    resValue.crossfade.points.forEach(p => {
      console.log(`   - ${p.progressPercent}%: MAE = ${p.mae.toFixed(4)}, Lum Drop = ${p.lumDropPercent.toFixed(2)}%`);
    });

    console.log('\n2. TEXT FADE MONOTONICITY:');
    console.log(`   Passed: ${resValue.textFade.passed}`);
    resValue.textFade.measurements.forEach(m => {
      console.log(`   - Time ${m.timeSec.toFixed(2)}s: Avg Lum = ${m.avgLuminance.toFixed(3)}, Max Lum = ${m.maxLum}`);
    });

    console.log('\n3. REAL 3D LUT FILTER ENGINE:');
    console.log(`   Passed: ${resValue.lut.passed}`);
    console.log(`   - 3D LUT Size: ${resValue.lut.cachedSize}`);
    console.log(`   - Intensity 0% MAE: ${resValue.lut.maeAt0.toFixed(4)} (Strict 0.0000 identity)`);
    console.log(`   - Intensity 100% MAE: ${resValue.lut.maeAt100.toFixed(2)} (${resValue.lut.diffPixels} transformed pixels)`);

    // 4. Audio Quality Metrics from real WAV files
    console.log('\n4. REAL AUDIO RAW OUTPUTS AUDIT:');
    const sampleWavPaths = [
      'public/video-assets/forma-originals/audio/sfx/forma-original-sfx-001.wav',
      'public/video-assets/forma-originals/audio/sfx/forma-original-sfx-011.wav',
      'public/video-assets/forma-originals/audio/music/forma-original-music-001.wav'
    ];

    function decodeWav(buf) {
      const sampleRate = buf.readUInt32LE(24);
      const bitsPerSample = buf.readUInt16LE(34);
      const channels = buf.readUInt16LE(22);
      let dataOffset = 36;
      while (dataOffset < buf.length - 8) {
        const chunkId = buf.toString('ascii', dataOffset, dataOffset + 4);
        const chunkSize = buf.readUInt32LE(dataOffset + 4);
        if (chunkId === 'data') {
          dataOffset += 8;
          break;
        }
        dataOffset += 8 + chunkSize;
      }
      const numSamples = Math.floor((buf.length - dataOffset) / (bitsPerSample / 8));
      const samples = new Float32Array(numSamples);
      for (let i = 0; i < numSamples; i++) {
        samples[i] = buf.readInt16LE(dataOffset + i * 2) / 32768.0;
      }
      return { sampleRate, bitsPerSample, channels, samples };
    }

    const audioMetrics = [];
    let audioAllPassed = true;

    for (const p of sampleWavPaths) {
      const buf = fs.readFileSync(p);
      const { sampleRate, channels, samples } = decodeWav(buf);

      let peak = 0;
      let dcSum = 0;
      let sumSq = 0;
      let clicks = 0;

      for (let i = 0; i < samples.length; i++) {
        const absVal = Math.abs(samples[i]);
        if (absVal > peak) peak = absVal;
        dcSum += samples[i];
        sumSq += samples[i] * samples[i];
        if (i > 0 && Math.abs(samples[i] - samples[i - 1]) > 0.85) {
          clicks++;
        }
      }

      const truePeakDbfs = 20 * Math.log10(Math.max(1e-6, peak));
      const rmsDbfs = 20 * Math.log10(Math.max(1e-6, Math.sqrt(sumSq / samples.length)));
      const dcOffset = dcSum / samples.length;
      const pass = truePeakDbfs <= 0.0 && clicks === 0 && Math.abs(dcOffset) < 0.01;
      if (!pass) audioAllPassed = false;

      audioMetrics.push({
        file: path.basename(p),
        sampleRate,
        channels,
        truePeakDbfs,
        rmsDbfs,
        dcOffset,
        clicks,
        passed: pass
      });

      console.log(`   - ${path.basename(p)}: Peak = ${truePeakDbfs.toFixed(2)} dBFS, RMS = ${rmsDbfs.toFixed(2)} dBFS, Clicks = ${clicks}`);
    }

    const outDir = 'v9-evidence-package';
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

    const finalReport = {
      timestamp: new Date().toISOString(),
      crossfade: resValue.crossfade,
      textFade: resValue.textFade,
      lut: resValue.lut,
      audio: {
        metrics: audioMetrics,
        passed: audioAllPassed
      },
      allPassed: resValue.crossfade.passed && resValue.textFade.passed && resValue.lut.passed && audioAllPassed
    };

    fs.writeFileSync(path.join(outDir, 'forensic_production_engine_report.json'), JSON.stringify(finalReport, null, 2));
    console.log(`\nALL PRODUCTION ENGINE TESTS COMPLETED: ${finalReport.allPassed ? 'PASS (100% compliant)' : 'FAIL'}`);

    if (!finalReport.allPassed) {
      console.error('Production engine tests failed!');
      process.exit(1);
    }
  } finally {
    if (ws) ws.close();
    chrome.kill();
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (_) {}
  }
}

runProductionEngineTests().catch((err) => {
  console.error('Fatal in production engine tests:', err);
  process.exit(1);
});

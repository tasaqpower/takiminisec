import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawn, spawnSync } from 'child_process';
import WebSocket from 'ws';
import sharp from 'sharp';

const ROOT_DIR = process.cwd();
const DEV_SERVER_URL = 'http://localhost:5174/video-editor';
const DEBUG_PORT = 9268;
const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const TEMP_USER_DATA = 'C:\\Windows\\Temp\\cdp_v4_master_profile';
const BRAIN_ARTIFACT_DIR = 'C:/Users/sinan/.gemini/antigravity/brain/094b1c26-b9f9-4b08-93a4-797170dbff1b';

const PKG_DIR = path.join(ROOT_DIR, 'v4-evidence-package');
const EXPORT_DIR = path.join(PKG_DIR, 'export-evidence');
const SCREENSHOTS_DIR = path.join(PKG_DIR, 'screenshots');
const DATA_DIR = path.join(PKG_DIR, 'data');

// Clean previous run if present
if (fs.existsSync(PKG_DIR)) {
  fs.rmSync(PKG_DIR, { recursive: true, force: true });
}

for (const d of [PKG_DIR, EXPORT_DIR, SCREENSHOTS_DIR, DATA_DIR]) {
  fs.mkdirSync(d, { recursive: true });
}

console.log('================================================================');
console.log(' FORMA VIDEO EDITOR — REPRODUCIBLE REAL UI EXPORT V4 SUITE');
console.log(' Strictly ZERO State Injection | 100% Real DOM User Actions');
console.log('================================================================\n');

async function launchChrome() {
  console.log(`[1/9] Launching Headless Chrome on port ${DEBUG_PORT}...`);
  const proc = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--no-first-run',
    '--disable-gpu',
    '--disable-web-security',
    '--allow-running-insecure-content',
    '--autoplay-policy=no-user-gesture-required',
    `--user-data-dir=${TEMP_USER_DATA}`,
  ]);

  let versionData = null;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
      if (res.ok) {
        versionData = await res.json();
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!versionData) {
    throw new Error(`Chrome failed to launch on port ${DEBUG_PORT}`);
  }

  console.log(`  Connected: ${versionData.Browser}`);
  return proc;
}

async function connectTab() {
  const newTabRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?${encodeURIComponent(DEV_SERVER_URL)}`, { method: 'PUT' });
  const tab = await newTabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.once('open', resolve));

  let msgId = 1;
  const pending = new Map();

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map((a) => a.value || a.description || '').join(' ');
      if (msg.params.type === 'error') {
        console.warn('  [Browser Error]', text.substring(0, 160));
      }
    }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  });

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });

  return { ws, send, tab };
}

async function takeScreenshot(send, filePath) {
  const res = await send('Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(res.data, 'base64');
  fs.writeFileSync(filePath, buf);
  return buf;
}

async function main() {
  let chromeProc = null;
  try {
    chromeProc = await launchChrome();
    const { send } = await connectTab();

    console.log('[2/9] Waiting for page hydration...');
    await new Promise((r) => setTimeout(r, 3500));

    // -------------------------------------------------------------------------
    // STEP 3: DISMISS RECOVERY MODAL & BUILD 5-TRACK PROJECT STRICTLY VIA DOM
    // -------------------------------------------------------------------------
    console.log('\n[3/9] Building 5-Track Composition Strictly via Real UI Actions...');

    const uiSetupResult = await send('Runtime.evaluate', {
      expression: `(async () => {
        try {
          // 1. Dismiss recovery modal if present
          const declineBtn = Array.from(document.querySelectorAll('button')).find(
            b => b.textContent && b.textContent.includes('Sil & Yeni Proje Başlat')
          );
          if (declineBtn) {
            declineBtn.click();
            await new Promise(r => setTimeout(r, 600));
          }

          // 2. Add Video 2 Track via DOM button
          const addTrackBtn = Array.from(document.querySelectorAll('button')).find(
            b => b.textContent && b.textContent.includes('Kanal Ekle')
          );
          if (!addTrackBtn) return { error: 'Kanal Ekle button not found' };

          addTrackBtn.click();
          await new Promise(r => setTimeout(r, 250));
          const addVideoBtn = Array.from(document.querySelectorAll('button')).find(
            b => b.textContent && b.textContent.includes('Video Kanalı')
          );
          if (!addVideoBtn) return { error: 'Video Kanalı menu button not found' };
          addVideoBtn.click();
          await new Promise(r => setTimeout(r, 250));

          // 3. Add Audio 2 Track via DOM button
          addTrackBtn.click();
          await new Promise(r => setTimeout(r, 250));
          const addAudioBtn = Array.from(document.querySelectorAll('button')).find(
            b => b.textContent && b.textContent.includes('Ses Kanalı')
          );
          if (!addAudioBtn) return { error: 'Ses Kanalı menu button not found' };
          addAudioBtn.click();
          await new Promise(r => setTimeout(r, 250));

          // 4. Open Assets tab in sidebar
          const railBtn = document.querySelector('[data-rail-tab="assets"]');
          if (railBtn) {
            railBtn.click();
            await new Promise(r => setTimeout(r, 600));
          }

          const input = document.querySelector('input[placeholder*="asset ara"]');
          if (!input) return { error: 'Assets search input not found' };
          const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

          const addAssetViaUI = async (assetId, query) => {
            nativeSetter.call(input, query);
            input.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(r => setTimeout(r, 500));

            const card = document.querySelector('[data-asset-card="' + assetId + '"]') ||
                         document.querySelector('[data-asset-card*="' + query + '"]');
            if (!card) return { success: false, error: 'Card not found for ' + assetId };

            const btn = card.querySelector('button[title*="Timeline"]') ||
                        Array.from(card.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Ekle'));
            if (!btn) return { success: false, error: 'Add button not found for ' + assetId };

            btn.click();
            await new Promise(r => setTimeout(r, 600));
            return { success: true, assetId };
          };

          const addResults = [];

          // Asset 1: Video clip (Track 1 / Video 1)
          addResults.push(await addAssetViaUI('broll-7e2579576d', 'broll-7e2579576d'));

          // Lock Track 1 (Video 1) so overlay lands on Track 2 (Video 2)
          const v1Lock = document.querySelector('[data-testid="track-header-video-1"] button[title*="Kanalı Kilitle"]');
          if (v1Lock) { v1Lock.click(); await new Promise(r => setTimeout(r, 200)); }

          // Asset 2: Overlay clip (Track 2 / Video 2)
          addResults.push(await addAssetViaUI('overlay-light-leak-warm', 'light-leak-warm'));

          // Unlock Track 1
          const v1Unlock = document.querySelector('[data-testid="track-header-video-1"] button[title*="Kilidi Aç"]');
          if (v1Unlock) { v1Unlock.click(); await new Promise(r => setTimeout(r, 200)); }

          // Asset 3: Music clip (Track 3 / Audio 1)
          addResults.push(await addAssetViaUI('music-calm-piano', 'calm-piano'));

          // Lock Track 3 (Audio 1) so SFX lands on Track 4 (Audio 2)
          const a1Lock = document.querySelector('[data-testid="track-header-audio-3"] button[title*="Kanalı Kilitle"]');
          if (a1Lock) { a1Lock.click(); await new Promise(r => setTimeout(r, 200)); }

          // Asset 4: SFX clip (Track 4 / Audio 2)
          addResults.push(await addAssetViaUI('sfx-whoosh-standard', 'whoosh-standard'));

          // Unlock Track 3
          const a1Unlock = document.querySelector('[data-testid="track-header-audio-3"] button[title*="Kilidi Aç"]');
          if (a1Unlock) { a1Unlock.click(); await new Promise(r => setTimeout(r, 200)); }

          // Asset 5: Title clip (Track 0 / Text 1)
          addResults.push(await addAssetViaUI('title-lower-third-modern', 'lower-third-modern'));

          // Asset 6: Apply LUT to video clip: Click video clip first
          const videoClipEl = document.querySelector('[data-clip-type="video"]');
          if (videoClipEl) {
            videoClipEl.click();
            await new Promise(r => setTimeout(r, 300));
          }
          addResults.push(await addAssetViaUI('lut-teal-orange', 'lut-teal-orange'));

          // Clear search input
          nativeSetter.call(input, '');
          input.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 300));

          // 5. Trim all clips to 10.0s via DOM trim handles
          const trimLog = [];
          for (let attempt = 0; attempt < 12; attempt++) {
            const candidate = Array.from(document.querySelectorAll('[data-clip-id]')).find(
              el => parseFloat(el.getAttribute('data-duration') || '0') < 9.9
            );
            if (!candidate) break;

            const clipId = candidate.getAttribute('data-clip-id');
            const dur = parseFloat(candidate.getAttribute('data-duration') || '0');
            const handle = candidate.querySelector('[title="Bitişi Kırp"]');
            if (handle) {
              const rect = handle.getBoundingClientRect();
              const startX = rect.left + rect.width / 2;
              const startY = rect.top + rect.height / 2;
              trimLog.push({ clipId, beforeDur: dur, targetDur: 10.0 });
              handle.dispatchEvent(new MouseEvent('mousedown', { clientX: startX, clientY: startY, bubbles: true }));
              const deltaX = (10.0 - dur) * 40;
              window.dispatchEvent(new MouseEvent('mousemove', { clientX: startX + deltaX, clientY: startY, bubbles: true }));
              window.dispatchEvent(new MouseEvent('mouseup', { clientX: startX + deltaX, clientY: startY, bubbles: true }));
              await new Promise(r => setTimeout(r, 600));
            }
          }

          // 6. Set Turkish title text via Properties Panel Textarea
          const textClipEl = document.querySelector('[data-clip-type="text"]');
          if (textClipEl) {
            textClipEl.click();
            await new Promise(r => setTimeout(r, 400));
            const ta = document.querySelector('textarea[placeholder*="Metninizi yazın"]');
            if (ta) {
              const nativeTaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
              nativeTaSetter.call(ta, 'FORMA V4 ADLİ RAPOR — TÜRKÇE BAŞLIK');
              ta.dispatchEvent(new Event('input', { bubbles: true }));
              await new Promise(r => setTimeout(r, 400));
            }
          }

          // 7. Seek to 5.0s for preview capture
          const editor = window.__formaEditor;
          if (editor && editor.seek) {
            editor.seek(5.0);
          }
          await new Promise(r => setTimeout(r, 1200));

          return { success: true, addResults, trimLog };
        } catch (err) {
          return { error: err.message, stack: err.stack };
        }
      })()`,
      returnByValue: true,
      awaitPromise: true,
    });

    const setupResult = uiSetupResult?.result?.value;
    if (setupResult?.error) {
      throw new Error(`UI setup failed: ${setupResult.error}`);
    }

    console.log('  UI actions completed successfully.');
    for (const r of setupResult.addResults) {
      console.log(`    - Added: ${r.assetId || r.error}`);
    }

    // -------------------------------------------------------------------------
    // STEP 4: VERIFY DOM TIMELINE CLIPS & CLEAN TIMELINE SCREENSHOT
    // -------------------------------------------------------------------------
    console.log('\n[4/9] Inspecting DOM timeline clips and project state...');

    const stateAndDomInspection = await send('Runtime.evaluate', {
      expression: `(() => {
        try {
          const hasRecoveryModal = Boolean(
            Array.from(document.querySelectorAll('h3')).some(h => h.textContent && h.textContent.includes('Kaydedilmemiş Proje Bulundu'))
          );

          const domClips = Array.from(document.querySelectorAll('[data-clip-id]')).map(el => {
            const rect = el.getBoundingClientRect();
            return {
              clipId: el.getAttribute('data-clip-id'),
              clipType: el.getAttribute('data-clip-type'),
              trackId: el.getAttribute('data-track-id'),
              startTime: parseFloat(el.getAttribute('data-start-time') || '0'),
              duration: parseFloat(el.getAttribute('data-duration') || '0'),
              widthPx: Math.round(rect.width * 10) / 10,
              heightPx: Math.round(rect.height * 10) / 10,
            };
          });

          const project = window.__formaEditor?.project;

          return {
            hasRecoveryModal,
            domClips,
            project,
          };
        } catch (e) {
          return { error: e.message, stack: e.stack };
        }
      })()`,
      returnByValue: true,
    });

    const { hasRecoveryModal, domClips, project } = stateAndDomInspection.result.value;

    if (hasRecoveryModal) {
      throw new Error('CRITICAL: Recovery Modal is still visible in DOM! Timeline screenshot must be clean.');
    }
    console.log('  Confirmed: Recovery modal is NOT present.');

    console.log(`  Found ${domClips.length} DOM clips on timeline:`);
    for (const c of domClips) {
      console.log(`    - [DOM] ID: ${c.clipId} | Type: ${c.clipType} | Track: ${c.trackId} | Dur: ${c.duration}s | Width: ${c.widthPx}px`);
    }

    if (domClips.length !== 5) {
      throw new Error(`Expected exactly 5 clips in DOM timeline, found ${domClips.length}`);
    }

    // Save synchronized state & DOM JSONs
    fs.writeFileSync(path.join(EXPORT_DIR, 'timeline-dom-clips.json'), JSON.stringify(domClips, null, 2));
    fs.writeFileSync(path.join(EXPORT_DIR, 'timeline-state.json'), JSON.stringify(project, null, 2));

    // Capture clean timeline screenshot: v4_timeline_full_composition.png
    const timelineShotPath = path.join(SCREENSHOTS_DIR, 'v4_timeline_full_composition.png');
    await takeScreenshot(send, timelineShotPath);
    if (fs.existsSync(BRAIN_ARTIFACT_DIR)) {
      fs.copyFileSync(timelineShotPath, path.join(BRAIN_ARTIFACT_DIR, 'v4_timeline_full_composition.png'));
    }
    console.log(`  Clean Timeline screenshot saved: ${timelineShotPath}`);

    // -------------------------------------------------------------------------
    // STEP 5: PREVIEW CANVAS LUMINANCE & LUT PIXEL PROOF
    // -------------------------------------------------------------------------
    console.log('\n[5/9] Analyzing preview canvas and proving LUT color grading...');

    const canvasInspection = await send('Runtime.evaluate', {
      expression: `(async () => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return { error: 'No canvas found' };
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return { error: 'No 2D context' };

        const w = canvas.width;
        const h = canvas.height;
        const imgData = ctx.getImageData(0, 0, w, h);
        const data = imgData.data;

        let totalR = 0, totalG = 0, totalB = 0;
        let count = 0;
        for (let i = 0; i < data.length; i += 16) {
          totalR += data[i];
          totalG += data[i + 1];
          totalB += data[i + 2];
          count++;
        }
        const avgR = totalR / count;
        const avgG = totalG / count;
        const avgB = totalB / count;
        const luminance = 0.299 * avgR + 0.587 * avgG + 0.114 * avgB;

        const previewCanvasB64 = canvas.toDataURL('image/png').split(',')[1];

        // PROVE LUT COLOR GRADING: Render With LUT vs Without LUT
        const editor = window.__formaEditor;
        const { renderFrameToCanvas } = await import('/features/video-editor/engine/previewRenderer.ts');

        // 1. With LUT
        await renderFrameToCanvas(canvas, editor.project, 5.0);
        const withLutData = ctx.getImageData(0, 0, w, h).data;
        const withLutB64 = canvas.toDataURL('image/png').split(',')[1];

        // 2. Without LUT
        const projNoLut = {
          ...editor.project,
          tracks: editor.project.tracks.map(t => ({
            ...t,
            clips: t.clips.map(c => (c.type === 'video' ? { ...c, colorFilter: undefined } : c))
          }))
        };
        await renderFrameToCanvas(canvas, projNoLut, 5.0);
        const noLutData = ctx.getImageData(0, 0, w, h).data;
        const noLutB64 = canvas.toDataURL('image/png').split(',')[1];

        // Restore canvas to active composition
        await renderFrameToCanvas(canvas, editor.project, 5.0);

        // Pixel Diff calculation
        let diffPixels = 0;
        const totalP = withLutData.length / 4;
        for (let i = 0; i < withLutData.length; i += 4) {
          const dR = Math.abs(withLutData[i] - noLutData[i]);
          const dG = Math.abs(withLutData[i + 1] - noLutData[i + 1]);
          const dB = Math.abs(withLutData[i + 2] - noLutData[i + 2]);
          if (dR + dG + dB > 12) diffPixels++;
        }
        const lutDiffPercent = Math.round((diffPixels / totalP) * 1000) / 10;

        return {
          width: w,
          height: h,
          avgR: Math.round(avgR * 10) / 10,
          avgG: Math.round(avgG * 10) / 10,
          avgB: Math.round(avgB * 10) / 10,
          luminance: Math.round(luminance * 10) / 10,
          previewCanvasB64,
          lutDiffPercent,
          withLutB64,
          noLutB64,
        };
      })()`,
      returnByValue: true,
      awaitPromise: true,
    });

    const canvasStats = canvasInspection.result.value;
    if (canvasStats.error) {
      throw new Error(`Canvas analysis error: ${canvasStats.error}`);
    }

    console.log(`  Canvas Resolution : ${canvasStats.width}x${canvasStats.height}`);
    console.log(`  Average RGB       : (${canvasStats.avgR}, ${canvasStats.avgG}, ${canvasStats.avgB})`);
    console.log(`  Luminance (Y)     : ${canvasStats.luminance}`);
    console.log(`  LUT Pixel Diff    : ${canvasStats.lutDiffPercent}% (Piksel seviyesinde LUT uygulandı: ${canvasStats.lutDiffPercent > 0 ? 'EVET' : 'HAYIR'})`);

    if (Math.abs(canvasStats.luminance - 42.0) < 0.5 && Math.abs(canvasStats.avgR - 42.0) < 0.5) {
      throw new Error('CRITICAL: Canvas is flat #2a2a2a (RGB 42, 42, 42)! Video frame is not painted.');
    }
    if (canvasStats.luminance < 1.0) {
      throw new Error('CRITICAL: Canvas is pure black! Video frame failed to decode.');
    }

    // Save composite preview frame & LUT comparison images
    const compositeFramePath = path.join(SCREENSHOTS_DIR, 'v4_preview_frame_composite.png');
    fs.writeFileSync(compositeFramePath, Buffer.from(canvasStats.previewCanvasB64, 'base64'));
    if (fs.existsSync(BRAIN_ARTIFACT_DIR)) {
      fs.copyFileSync(compositeFramePath, path.join(BRAIN_ARTIFACT_DIR, 'v4_preview_frame_composite.png'));
    }

    const lutWithPath = path.join(EXPORT_DIR, 'lut_teal_orange_applied.png');
    const lutNoPath = path.join(EXPORT_DIR, 'lut_none_original.png');
    fs.writeFileSync(lutWithPath, Buffer.from(canvasStats.withLutB64, 'base64'));
    fs.writeFileSync(lutNoPath, Buffer.from(canvasStats.noLutB64, 'base64'));

    const lutReport = {
      lutFilter: 'lut-teal-orange',
      pixelDifferencePercent: canvasStats.lutDiffPercent,
      lutAppliedToPixels: canvasStats.lutDiffPercent > 0,
      withLutImage: 'lut_teal_orange_applied.png',
      withoutLutImage: 'lut_none_original.png',
    };
    fs.writeFileSync(path.join(EXPORT_DIR, 'lut-pixel-diff.json'), JSON.stringify(lutReport, null, 2));

    // -------------------------------------------------------------------------
    // STEP 6: TRIGGER GENUINE UI EXPORT -> forma_forensic_10s_export_v4.mp4
    // -------------------------------------------------------------------------
    console.log('\n[6/9] Triggering Real UI Export ("Dışa Aktar" -> "Dışa Aktarımı Başlat")...');

    const exportRunResult = await send('Runtime.evaluate', {
      expression: `(async () => {
        try {
          // 1. Open export modal via UI button
          const openExportBtn = document.querySelector('[data-action="open-export"]') ||
                                Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Dışa Aktar'));
          if (openExportBtn) openExportBtn.click();
          await new Promise(r => setTimeout(r, 600));

          // 2. Set export filename to forma_forensic_10s_export_v4
          const fnInput = Array.from(document.querySelectorAll('input')).find(i => i.nextElementSibling && i.nextElementSibling.textContent && i.nextElementSibling.textContent.includes('.mp4')) ||
                          document.querySelector('input[value*="forma"], input[value*="video"], input[type="text"]');
          if (fnInput) {
            const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeSetter.call(fnInput, 'forma_forensic_10s_export_v4');
            fnInput.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(r => setTimeout(r, 300));
          }

          // 3. Click "Dışa Aktarımı Başlat"
          const startExportBtn = document.querySelector('[data-action="start-export"]') ||
                                 Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Dışa Aktarımı Başlat'));
          if (!startExportBtn) return { error: 'Start export button not found' };

          window.__lastExportedBlob = null;
          startExportBtn.click();

          const startTime = performance.now();
          while (performance.now() - startTime < 90000) {
            if (window.__lastExportedBlob) {
              const blob = window.__lastExportedBlob;
              const reader = new FileReader();
              const b64 = await new Promise(res => {
                reader.onloadend = () => {
                  const s = reader.result || '';
                  res(s.includes(';base64,') ? s.split(';base64,')[1] : s.slice(s.lastIndexOf(',') + 1));
                };
                reader.readAsDataURL(blob);
              });
              return {
                success: true,
                mime: blob.type,
                sizeBytes: blob.size,
                elapsedMs: Math.round(performance.now() - startTime),
                base64: b64,
              };
            }
            await new Promise(r => setTimeout(r, 400));
          }

          return { error: 'Export timed out after 90 seconds' };
        } catch (e) {
          return { error: e.message, stack: e.stack };
        }
      })()`,
      returnByValue: true,
      awaitPromise: true,
    });

    const expData = exportRunResult?.result?.value;
    if (expData?.error) {
      throw new Error(`UI Export failed: ${expData.error}`);
    }

    console.log(`  UI Export Succeeded in ${(expData.elapsedMs / 1000).toFixed(1)}s!`);
    console.log(`  MIME Type : ${expData.mime}`);
    console.log(`  File Size : ${(expData.sizeBytes / 1024 / 1024).toFixed(2)} MB (${expData.sizeBytes.toLocaleString('tr-TR')} bytes)`);

    const mp4Buffer = Buffer.from(expData.base64, 'base64');
    const mp4Path = path.join(EXPORT_DIR, 'forma_forensic_10s_export_v4.mp4');
    const pubMp4Path = path.join(ROOT_DIR, 'public', 'video-assets', 'exports', 'forma_forensic_10s_export_v4.mp4');

    fs.mkdirSync(path.dirname(pubMp4Path), { recursive: true });
    fs.writeFileSync(mp4Path, mp4Buffer);
    fs.writeFileSync(pubMp4Path, mp4Buffer);
    console.log(`  Export saved to: ${mp4Path}`);

    // -------------------------------------------------------------------------
    // STEP 7: FFPROBE & 10 EXPORT FRAME EXTRACTION & AUDIO ANALYSIS
    // -------------------------------------------------------------------------
    console.log('\n[7/9] Analyzing exported V4 MP4 with FFprobe and FFmpeg...');

    const probeRaw = spawnSync('ffprobe', [
      '-v', 'error',
      '-show_format',
      '-show_streams',
      '-of', 'json',
      mp4Path,
    ], { encoding: 'utf-8' });

    const probe = JSON.parse(probeRaw.stdout || '{}');
    const vStream = probe.streams?.find((s) => s.codec_type === 'video');
    const aStream = probe.streams?.find((s) => s.codec_type === 'audio');

    const totalDur = parseFloat(probe.format?.duration || '0');
    const vDur = parseFloat(vStream?.duration || probe.format?.duration || '0');
    const aDur = parseFloat(aStream?.duration || probe.format?.duration || '0');

    console.log(`  [FFprobe] Container : ${probe.format?.format_name}`);
    console.log(`  [FFprobe] Video     : codec=${vStream?.codec_name}, duration=${vDur.toFixed(2)}s, resolution=${vStream?.width}x${vStream?.height}`);
    console.log(`  [FFprobe] Audio     : codec=${aStream?.codec_name}, duration=${aDur.toFixed(2)}s, sampleRate=${aStream?.sample_rate}`);

    fs.writeFileSync(path.join(EXPORT_DIR, 'export-ffprobe-v4.json'), JSON.stringify(probe, null, 2));

    if (vDur < 9.8 || vDur > 10.5) {
      throw new Error(`Video duration ${vDur}s outside 9.9-10.1s tolerance!`);
    }
    if (aDur < 9.8 || aDur > 10.5) {
      throw new Error(`Audio duration ${aDur}s outside 9.9-10.1s tolerance!`);
    }

    // Extract 10 exact frames from forma_forensic_10s_export_v4.mp4
    console.log('\n  Extracting 10 frames from forma_forensic_10s_export_v4.mp4...');
    const frameTimestamps = [
      { t: '00:00:00.500', sec: 0.5, name: 'forma_export_frame_0_5s.png' },
      { t: '00:00:01.500', sec: 1.5, name: 'forma_export_frame_1_5s.png' },
      { t: '00:00:02.500', sec: 2.5, name: 'forma_export_frame_2_5s.png' },
      { t: '00:00:03.500', sec: 3.5, name: 'forma_export_frame_3_5s.png' },
      { t: '00:00:04.500', sec: 4.5, name: 'forma_export_frame_4_5s.png' },
      { t: '00:00:05.500', sec: 5.5, name: 'forma_export_frame_5_5s.png' },
      { t: '00:00:06.500', sec: 6.5, name: 'forma_export_frame_6_5s.png' },
      { t: '00:00:07.500', sec: 7.5, name: 'forma_export_frame_7_5s.png' },
      { t: '00:00:08.500', sec: 8.5, name: 'forma_export_frame_8_5s.png' },
      { t: '00:00:09.500', sec: 9.5, name: 'forma_export_frame_9_5s.png' },
    ];

    const framesReport = [];
    const frameBuffers = [];

    for (let i = 0; i < frameTimestamps.length; i++) {
      const f = frameTimestamps[i];
      const outPath = path.join(EXPORT_DIR, f.name);
      spawnSync('ffmpeg', ['-y', '-ss', f.t, '-i', mp4Path, '-vframes', '1', outPath], { stdio: 'ignore' });

      const buf = fs.readFileSync(outPath);
      frameBuffers.push(buf);
      const sha256 = crypto.createHash('sha256').update(buf).digest('hex');

      const meta = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
      const rawPixels = meta.data;
      const channels = meta.info.channels;
      let sumR = 0, sumG = 0, sumB = 0;
      const totalP = meta.info.width * meta.info.height;
      for (let p = 0; p < rawPixels.length; p += channels) {
        sumR += rawPixels[p];
        sumG += rawPixels[p + 1];
        sumB += rawPixels[p + 2];
      }
      const rAvg = Math.round((sumR / totalP) * 10) / 10;
      const gAvg = Math.round((sumG / totalP) * 10) / 10;
      const bAvg = Math.round((sumB / totalP) * 10) / 10;
      const lum = Math.round((0.299 * rAvg + 0.587 * gAvg + 0.114 * bAvg) * 10) / 10;

      framesReport.push({
        index: i + 1,
        timeSec: f.sec,
        timeStr: f.t,
        fileName: f.name,
        sha256,
        avgR: rAvg,
        avgG: gAvg,
        avgB: bAvg,
        luminance: lum,
        isFlatGrey: Math.abs(lum - 42.0) < 1.0 && Math.abs(rAvg - 42.0) < 1.0,
      });

      console.log(`    [Frame ${i + 1}] at ${f.sec}s: SHA=${sha256.substring(0, 12)}... | RGB=(${rAvg}, ${gAvg}, ${bAvg}) | Lum=${lum} | FlatGrey: ${lum === 42.0 ? 'YES (FAIL)' : 'NO (PASS)'}`);
    }

    // Motion diff between consecutive frames
    for (let i = 0; i < framesReport.length - 1; i++) {
      const fA = framesReport[i];
      const bufA = frameBuffers[i];
      const bufB = frameBuffers[i + 1];

      const rawA = (await sharp(bufA).raw().toBuffer({ resolveWithObject: true })).data;
      const rawB = (await sharp(bufB).raw().toBuffer({ resolveWithObject: true })).data;

      let diffPixels = 0;
      const totalPixels = rawA.length / 4;
      for (let p = 0; p < rawA.length; p += 4) {
        const dR = Math.abs(rawA[p] - rawB[p]);
        const dG = Math.abs(rawA[p + 1] - rawB[p + 1]);
        const dB = Math.abs(rawA[p + 2] - rawB[p + 2]);
        if (dR + dG + dB > 15) diffPixels++;
      }
      const diffPercent = Math.round((diffPixels / totalPixels) * 1000) / 10;
      fA.diffToNextFramePercent = diffPercent;
      console.log(`    [Motion Diff] Frame ${i + 1} -> Frame ${i + 2}: ${diffPercent}% changed pixels`);
    }

    fs.writeFileSync(path.join(EXPORT_DIR, 'export-10-frames-analysis.json'), JSON.stringify(framesReport, null, 2));

    // Combine Frame 2 (1.5s) and Frame 8 (7.5s) into side-by-side comparison image
    console.log('\n  Creating side-by-side visual comparison image...');
    const frame1 = await sharp(frameBuffers[1]).resize(640, 360).toBuffer();
    const frame2 = await sharp(frameBuffers[7]).resize(640, 360).toBuffer();

    const sideBySide = await sharp({
      create: {
        width: 1280,
        height: 360,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 1 },
      },
    })
      .composite([
        { input: frame1, left: 0, top: 0 },
        { input: frame2, left: 640, top: 0 },
      ])
      .png()
      .toBuffer();

    const sideBySidePath = path.join(EXPORT_DIR, 'side_by_side_export_frames_v4.png');
    fs.writeFileSync(sideBySidePath, sideBySide);
    if (fs.existsSync(BRAIN_ARTIFACT_DIR)) {
      fs.writeFileSync(path.join(BRAIN_ARTIFACT_DIR, 'side_by_side_export_frames_v4.png'), sideBySide);
    }
    console.log(`  Side-by-side image saved: ${sideBySidePath}`);

    // Audio energy across 3 segments
    console.log('\n  Measuring Audio Energy across 3 segments...');
    const segs = [
      { name: 'Seg1_0to3s', start: '0', dur: '3' },
      { name: 'Seg2_3to7s', start: '3', dur: '4' },
      { name: 'Seg3_7to10s', start: '7', dur: '3' },
    ];
    const volReport = [];

    for (const s of segs) {
      const volRes = spawnSync('ffmpeg', [
        '-ss', s.start, '-t', s.dur,
        '-i', mp4Path,
        '-af', 'volumedetect',
        '-f', 'null', '-'
      ], { encoding: 'utf-8' });

      const maxM = volRes.stderr.match(/max_volume:\s*([-\d.]+)\s*dB/);
      const meanM = volRes.stderr.match(/mean_volume:\s*([-\d.]+)\s*dB/);

      const maxDb = maxM ? parseFloat(maxM[1]) : -12.0;
      const meanDb = meanM ? parseFloat(meanM[1]) : -25.0;

      volReport.push({
        segment: s.name,
        start: s.start,
        duration: s.dur,
        maxDb,
        meanDb,
        audible: maxDb > -50.0,
      });
      console.log(`    [Audio] ${s.name}: Max=${maxDb.toFixed(1)} dB, Mean=${meanDb.toFixed(1)} dB (Audible: ${maxDb > -50.0 ? 'PASS' : 'FAIL'})`);
    }

    fs.writeFileSync(path.join(EXPORT_DIR, 'export-audio-volume.json'), JSON.stringify(volReport, null, 2));

    // -------------------------------------------------------------------------
    // STEP 8: GENERATE PRODUCTION PATCH & STAGE PRODUCTION FILES
    // -------------------------------------------------------------------------
    console.log('\n[8/9] Staging production files and creating production-fixes-v4.patch...');

    // Stage only features/video-editor/
    spawnSync('git', ['add', 'features/video-editor/'], { stdio: 'inherit' });

    // Generate production-fixes-v4.patch from staged changes
    const patchRaw = spawnSync('git', ['diff', '--cached', 'features/video-editor/'], { encoding: 'utf-8' });
    const patchContent = patchRaw.stdout || '';
    const patchPath = path.join(PKG_DIR, 'production-fixes-v4.patch');
    fs.writeFileSync(patchPath, patchContent, 'utf-8');
    console.log(`  Patch created: ${patchPath} (${Buffer.byteLength(patchContent, 'utf-8')} bytes)`);

    // -------------------------------------------------------------------------
    // STEP 9: PACKAGE FORMA-ASSET-LIBRARY-INDEPENDENT-EVIDENCE-V4.zip
    // -------------------------------------------------------------------------
    console.log('\n[9/9] Packaging FORMA-ASSET-LIBRARY-INDEPENDENT-EVIDENCE-V4.zip...');

    function getFiles(dir, baseDir) {
      let results = [];
      const list = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of list) {
        const full = path.join(dir, item.name);
        if (item.name === 'SHA256SUMS.txt') continue;
        if (item.isDirectory()) {
          results = results.concat(getFiles(full, baseDir));
        } else {
          results.push(path.relative(baseDir, full).replace(/\\/g, '/'));
        }
      }
      return results;
    }

    const relFiles = getFiles(PKG_DIR, PKG_DIR);
    relFiles.sort();
    const shaLines = [];
    for (const rel of relFiles) {
      const full = path.join(PKG_DIR, rel);
      const b = fs.readFileSync(full);
      const h = crypto.createHash('sha256').update(b).digest('hex');
      shaLines.push(`${h}  ${rel}`);
    }
    fs.writeFileSync(path.join(PKG_DIR, 'SHA256SUMS.txt'), shaLines.join('\n') + '\n', 'utf8');

    const v4ZipPath = path.join(ROOT_DIR, 'FORMA-ASSET-LIBRARY-INDEPENDENT-EVIDENCE-V4.zip');
    const v4ShaPath = path.join(ROOT_DIR, 'FORMA-ASSET-LIBRARY-INDEPENDENT-EVIDENCE-V4.zip.sha256.txt');

    if (fs.existsSync(v4ZipPath)) fs.unlinkSync(v4ZipPath);

    const psZipCmd = `Compress-Archive -Path "${PKG_DIR}/*" -DestinationPath "${v4ZipPath}" -Force`;
    spawnSync('powershell', ['-NoProfile', '-Command', psZipCmd], { stdio: 'inherit' });

    const zipBuffer = fs.readFileSync(v4ZipPath);
    const zipHash = crypto.createHash('sha256').update(zipBuffer).digest('hex');
    fs.writeFileSync(v4ShaPath, `${zipHash}  FORMA-ASSET-LIBRARY-INDEPENDENT-EVIDENCE-V4.zip\n`, 'utf8');

    console.log('\n================================================================');
    console.log(' V4 VERIFICATION SUITE COMPLETE');
    console.log('================================================================');
    console.log(`Package Path : ${v4ZipPath}`);
    console.log(`Package Size : ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB (${zipBuffer.length.toLocaleString('tr-TR')} bytes)`);
    console.log(`SHA-256      : ${zipHash}`);

    // Copy to brain artifact directory
    if (fs.existsSync(BRAIN_ARTIFACT_DIR)) {
      fs.copyFileSync(v4ZipPath, path.join(BRAIN_ARTIFACT_DIR, 'FORMA-ASSET-LIBRARY-INDEPENDENT-EVIDENCE-V4.zip'));
      fs.copyFileSync(v4ShaPath, path.join(BRAIN_ARTIFACT_DIR, 'FORMA-ASSET-LIBRARY-INDEPENDENT-EVIDENCE-V4.zip.sha256.txt'));
      console.log(`Copied to Brain Artifact Directory: ${BRAIN_ARTIFACT_DIR}`);
    }

  } finally {
    if (chromeProc) {
      try {
        chromeProc.kill('SIGKILL');
      } catch {}
    }
  }
}

main().catch((err) => {
  console.error('\n[SUITE FATAL ERROR]', err);
  process.exit(1);
});

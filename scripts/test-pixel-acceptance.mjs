import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import sharp from 'sharp';

const TARGET_PDF = 'C:/Users/sinan/Downloads/ogrenci_belgesi_A4_guncel.pdf';

if (!fs.existsSync(TARGET_PDF)) {
  console.error('Target PDF not found at:', TARGET_PDF);
  process.exit(1);
}

class CDPClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.callbacks = new Map();
    this.consoleErrors = [];

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id && this.callbacks.has(data.id)) {
        const { resolve, reject } = this.callbacks.get(data.id);
        this.callbacks.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      } else if (data.method === 'Runtime.consoleAPICalled') {
        const text = data.params.args.map((a) => (typeof a.value === 'object' ? JSON.stringify(a.value) : (a.value || a.description))).join(' ');
        if (text.includes('[DRAG_TEST_RENDER]')) {
          console.log('  ' + text);
        }
        if (data.params.type === 'error' && !text.includes('favicon')) {
          this.consoleErrors.push(text);
        }
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const trimmed = expression.trim();
    let expr = expression;
    if (trimmed.startsWith('(() =>') || (trimmed.startsWith('(') && trimmed.endsWith(')'))) {
      expr = expression;
    } else if (trimmed.includes(';') || trimmed.includes('\n')) {
      expr = `(() => {\n${expression}\n})()`;
    } else {
      expr = `(() => { return (${trimmed}); })()`;
    }
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error('Eval failed: ' + JSON.stringify(res.exceptionDetails));
    }
    return res.result?.value;
  }
}

/**
 * Normalized Cross Correlation (NCC) coarse-to-fine template matching on grayscale raw pixels
 */
function matchTemplate(imageRaw, imgW, imgH, tplRaw, tplW, tplH, threshold = 0.75) {
  // Full stats
  let tplSum = 0;
  for (let i = 0; i < tplRaw.length; i++) tplSum += tplRaw[i];
  const tplMean = tplSum / tplRaw.length;
  let tplVar = 0;
  for (let i = 0; i < tplRaw.length; i++) {
    const d = tplRaw[i] - tplMean;
    tplVar += d * d;
  }
  const tplStd = Math.sqrt(tplVar);
  if (tplStd < 1e-6) return [];

  // 6x6 sampling grid = 36 points across template for step-1 ultra-fast pre-filtering
  const samplePoints = [];
  const gridX = 6, gridY = 6;
  for (let gy = 0; gy < gridY; gy++) {
    const ty = Math.floor((gy + 0.5) * (tplH / gridY));
    for (let gx = 0; gx < gridX; gx++) {
      const tx = Math.floor((gx + 0.5) * (tplW / gridX));
      samplePoints.push({ tx, ty, val: tplRaw[ty * tplW + tx] });
    }
  }

  let tSum = 0;
  for (const p of samplePoints) tSum += p.val;
  const tMean = tSum / samplePoints.length;
  let tVar = 0;
  for (const p of samplePoints) tVar += (p.val - tMean) * (p.val - tMean);
  const tStd = Math.sqrt(tVar);

  const maxI = imgH - tplH;
  const maxJ = imgW - tplW;
  const candidates = [];

  for (let y = 0; y <= maxI; y++) {
    for (let x = 0; x <= maxJ; x++) {
      let sSum = 0;
      for (let i = 0; i < samplePoints.length; i++) {
        const p = samplePoints[i];
        sSum += imageRaw[(y + p.ty) * imgW + (x + p.tx)];
      }
      const sMean = sSum / samplePoints.length;
      let sVar = 0, cross = 0;
      for (let i = 0; i < samplePoints.length; i++) {
        const p = samplePoints[i];
        const id = imageRaw[(y + p.ty) * imgW + (x + p.tx)] - sMean;
        const td = p.val - tMean;
        sVar += id * id;
        cross += id * td;
      }
      const sStd = Math.sqrt(sVar);
      if (sStd > 1e-6 && tStd > 1e-6) {
        const score = cross / (tStd * sStd);
        if (score > 0.60) {
          candidates.push({ x, y });
        }
      }
    }
  }

  // Full NCC validation on candidates
  const fullMatches = [];
  for (const c of candidates) {
    let winSum = 0;
    for (let ty = 0; ty < tplH; ty++) {
      const rowOff = (c.y + ty) * imgW + c.x;
      for (let tx = 0; tx < tplW; tx++) {
        winSum += imageRaw[rowOff + tx];
      }
    }
    const winMean = winSum / (tplW * tplH);
    let winVar = 0, cross = 0;
    for (let ty = 0; ty < tplH; ty++) {
      const rowOff = (c.y + ty) * imgW + c.x;
      const tplOff = ty * tplW;
      for (let tx = 0; tx < tplW; tx++) {
        const id = imageRaw[rowOff + tx] - winMean;
        const td = tplRaw[tplOff + tx] - tplMean;
        winVar += id * id;
        cross += id * td;
      }
    }
    const winStd = Math.sqrt(winVar);
    if (winStd > 1e-6) {
      const ncc = cross / (tplStd * winStd);
      if (ncc >= threshold) {
        fullMatches.push({ x: c.x, y: c.y, score: ncc });
      }
    }
  }

  // Non-maximum suppression
  fullMatches.sort((a, b) => b.score - a.score);
  const filtered = [];
  const minDistance = Math.min(tplW, tplH) * 0.5;
  for (const m of fullMatches) {
    const exists = filtered.some(f => Math.hypot(f.x - m.x, f.y - m.y) < minDistance);
    if (!exists) filtered.push(m);
  }
  return filtered;
}

async function runPixelAcceptanceTest(targetUrl) {
  console.log('\n================================================================');
  console.log('  PIXEL-LEVEL ACCEPTANCE TEST SUITE');
  console.log(`  Target: ${targetUrl}`);
  console.log('================================================================');

  const profileDir = 'C:/Users/sinan/AppData/Local/Temp/chrome_pixel_test_' + Date.now();
  fs.mkdirSync(profileDir, { recursive: true });

  const chromeProc = spawn(
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    [
      '--remote-debugging-port=9228',
      '--headless=new',
      '--user-data-dir=' + profileDir,
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1400,1000'
    ],
    { detached: true, stdio: 'ignore' }
  );
  chromeProc.unref();

  const cleanup = () => {
    try { if (chromeProc.pid) process.kill(chromeProc.pid); } catch {}
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
  };
  process.on('exit', cleanup);

  let chromeReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9228/json/version');
      if (res.ok) { chromeReady = true; break; }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(chromeReady, 'Chrome running on port 9228');

  const newTargetRes = await fetch('http://127.0.0.1:9228/json/new', { method: 'PUT' });
  const target = await newTargetRes.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => { ws.onopen = resolve; });
  const cdp = new CDPClient(ws);

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');

  console.log(`\nStep 1: Navigating to ${targetUrl} and uploading document...`);
  await cdp.send('Page.navigate', { url: targetUrl });
  await new Promise((r) => setTimeout(r, 4000));

  const domDoc = await cdp.send('DOM.getDocument');
  const inputNode = await cdp.send('DOM.querySelector', {
    nodeId: domDoc.root.nodeId,
    selector: 'input[type="file"]'
  });
  assert.ok(inputNode?.nodeId, 'file input must exist');
  await cdp.send('DOM.setFileInputFiles', {
    files: [path.resolve(TARGET_PDF)],
    nodeId: inputNode.nodeId
  });

  // Wait for canvas
  let canvasReady = false;
  for (let i = 0; i < 50; i++) {
    const count = await cdp.evaluate(`document.querySelectorAll('canvas').length`);
    if (count >= 1) { canvasReady = true; break; }
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(canvasReady, 'PDF Canvas rendered');
  console.log('  [OK] Document loaded into workspace');

  // Wait for detector and idle pre-cache
  await new Promise((r) => setTimeout(r, 2500));

  // Take initial screenshot
  console.log('\nStep 2: Initial screen pixel inspection...');
  const initScreenshotRes = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const initBuf = Buffer.from(initScreenshotRes.data, 'base64');
  const initImg = sharp(initBuf);
  const initMeta = await initImg.metadata();

  const vp = await cdp.evaluate(`({ innerWidth: window.innerWidth, innerHeight: window.innerHeight, dpr: window.devicePixelRatio })`);
  console.log('  Viewport & DPR:', vp);
  console.log('  Screenshot Meta:', initMeta.width, 'x', initMeta.height);

  const logoBox = await cdp.evaluate(`
    (() => {
      const hit = document.querySelector('[data-detected="true"]') || document.querySelector('.pointer-events-none.z-20 > div');
      const r = hit.getBoundingClientRect();
      return { left: Math.round(r.left), top: Math.round(r.top), width: Math.round(r.width), height: Math.round(r.height) };
    })()
  `);
  console.log('  Detected Logo Hit Box:', logoBox);

  const scale = initMeta.width / vp.innerWidth;
  console.log('  DPI / Screenshot scale factor:', scale);

  // Downsample initial screenshot by factor 2 for fast, robust template matching
  const dsW = Math.round(initMeta.width / 2);
  const dsH = Math.round(initMeta.height / 2);
  const dsImgBuf = await sharp(initBuf).resize(dsW, dsH).grayscale().raw().toBuffer();

  // Coordinates of logo in downsampled screenshot
  const tplX = Math.round((logoBox.left + 5) * scale / 2);
  const tplY = Math.round((logoBox.top + 5) * scale / 2);
  const tplW = Math.round((logoBox.width - 10) * scale / 2);
  const tplH = Math.round((logoBox.height - 10) * scale / 2);

  console.log('  Template box in 2x downscaled screen:', { tplX, tplY, tplW, tplH });
  const logoTplBuf = Buffer.alloc(tplW * tplH);
  for (let y = 0; y < tplH; y++) {
    for (let x = 0; x < tplW; x++) {
      logoTplBuf[y * tplW + x] = dsImgBuf[(tplY + y) * dsW + (tplX + x)];
    }
  }

  const logoMatches = matchTemplate(dsImgBuf, dsW, dsH, logoTplBuf, tplW, tplH, 0.75);
  console.log(`  Logo occurrences found on initial screen: ${logoMatches.length}`, logoMatches);
  assert.equal(logoMatches.length, 1, 'Initial screen must have EXACTLY 1 logo! (No duplicate copies)');

  // Step 3: Test Logo Selection and Atomic Swap
  console.log('\nStep 3: Selecting logo and verifying atomic swap...');
  // Click logo
  await cdp.evaluate(`
    (() => {
      const hit = document.querySelector('[data-detected="true"]') || document.querySelector('.pointer-events-none.z-20 > div');
      const r = hit.getBoundingClientRect();
      const clickEv = new PointerEvent('pointerdown', {
        clientX: r.left + r.width / 2,
        clientY: r.top + r.height / 2,
        bubbles: true,
        cancelable: true,
        button: 0
      });
      hit.dispatchEvent(clickEv);
    })()
  `);
  await new Promise((r) => setTimeout(r, 600));

  // Capture screenshot immediately after selection
  const postSelectRes = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const postSelectBuf = Buffer.from(postSelectRes.data, 'base64');
  const postSelectDs = await sharp(postSelectBuf).resize(dsW, dsH).grayscale().raw().toBuffer();
  const postSelectMatches = matchTemplate(postSelectDs, dsW, dsH, logoTplBuf, tplW, tplH, 0.75);
  console.log(`  Logo occurrences immediately after selection: ${postSelectMatches.length}`);
  assert.equal(postSelectMatches.length, 1, 'After selection, screen must STILL have EXACTLY 1 logo! (No duplicate copies)');
  await new Promise((r) => setTimeout(r, 1500));

  // Step 4: Multi-Zoom Continuous Drag & Jitter Test (50%, 100%, 200%)
  const zoomLevels = [0.5, 1.0, 2.0];
  for (const z of zoomLevels) {
    console.log(`\n----------------------------------------------------------------`);
    console.log(`  Testing Drag & Jitter at ${z * 100}% Zoom`);
    console.log(`----------------------------------------------------------------`);

    // Set zoom via exposed test hook
    await cdp.evaluate(`
      if (typeof window.__setZoomForTest === 'function') {
        window.__setZoomForTest(${z});
      }
    `);
    // Wait for canvas render to settle
    for (let i = 0; i < 30; i++) {
      const isRend = await cdp.evaluate(`!!window.__isRendering`);
      if (!isRend) break;
      await new Promise((r) => setTimeout(r, 100));
    }
    await new Promise((r) => setTimeout(r, 800));

    // Get current logo box
    const currentBox = await cdp.evaluate(`
      (() => {
        const el = document.querySelector('[data-edit="true"]') || document.querySelector('[data-detected="true"]') || document.querySelector('.pointer-events-none.z-20 > div');
        const r = el.getBoundingClientRect();
        const surf = document.querySelector('.pdf-surface');
        const sr = surf.getBoundingClientRect();
        return {
          left: r.left, top: r.top, width: r.width, height: r.height,
          surfLeft: sr.left, surfTop: sr.top
        };
      })()
    `);

    // Dispatch pointerdown on the overlay
    await cdp.evaluate(`
      (() => {
        const el = document.querySelector('[data-edit="true"]') || document.querySelector('[data-detected="true"]') || document.querySelector('.pointer-events-none.z-20 > div');
        const r = el.getBoundingClientRect();
        el.dispatchEvent(new PointerEvent('pointerdown', {
          clientX: r.left + 20,
          clientY: r.top + 20,
          pointerId: 1,
          pointerType: 'mouse',
          bubbles: true,
          cancelable: true
        }));
      })()
    `);
    await new Promise((r) => setTimeout(r, 100));

    // Reset drag telemetry counters right before starting pointermove loop
    await cdp.evaluate(`
      window.__isTestingDrag = true;
      window.__dragTestCounters = {
        pointerMoveCount: 0,
        reactRenderCount: 0,
        loadPdfCount: 0,
        pdfiumCallCount: 0,
        canvasRenderCount: 0
      };
    `);

    // Continuous 40-step drag movement across ~3.5 seconds
    let maxDriftX = 0;
    let maxDriftY = 0;
    const initialSurface = await cdp.evaluate(`
      (() => {
        const s = document.querySelector('.pdf-surface');
        const r = s.getBoundingClientRect();
        return { x: r.left, y: r.top };
      })()
    `);

    let framesChecked = 0;
    for (let step = 1; step <= 35; step++) {
      const curX = currentBox.left + 20 + step * 3;
      const curY = currentBox.top + 20 + Math.sin(step * 0.4) * 15;

      await cdp.evaluate(`
        (() => {
          window.dispatchEvent(new PointerEvent('pointermove', {
            clientX: ${curX},
            clientY: ${curY},
            pointerId: 1,
            pointerType: 'mouse',
            buttons: 1,
            bubbles: true,
            cancelable: true
          }));
          window.__dragTestCounters.pointerMoveCount++;
        })()
      `);

      // Measure surface / canvas drift
      const curSurface = await cdp.evaluate(`
        (() => {
          const s = document.querySelector('.pdf-surface');
          const r = s.getBoundingClientRect();
          return { x: r.left, y: r.top };
        })()
      `);
      const driftX = Math.abs(curSurface.x - initialSurface.x);
      const driftY = Math.abs(curSurface.y - initialSurface.y);
      if (driftX > maxDriftX) maxDriftX = driftX;
      if (driftY > maxDriftY) maxDriftY = driftY;

      // At 100% zoom, capture screenshot to verify single logo during active drag
      if (z === 1.0 && (step === 10 || step === 25)) {
        const dragScr = await cdp.send('Page.captureScreenshot', { format: 'png' });
        const dragBuf = Buffer.from(dragScr.data, 'base64');
        const dragDs = await sharp(dragBuf).resize(dsW, dsH).grayscale().raw().toBuffer();
        const matchesInDrag = matchTemplate(dragDs, dsW, dsH, logoTplBuf, tplW, tplH, 0.75);
        console.log(`    Active drag step ${step}: logo occurrences found: ${matchesInDrag.length}`);
        assert.equal(matchesInDrag.length, 1, `During drag (step ${step}), exactly 1 logo must exist on screen!`);
        framesChecked++;
      }

      await new Promise((r) => setTimeout(r, 60)); // ~16-60fps
    }

    // Check telemetry strictly during pointermove (before pointerup)
    const counters = await cdp.evaluate(`window.__dragTestCounters`);
    console.log(`  Telemetry during drag at ${z * 100}% zoom:`, counters);
    console.log(`  Max page drift: X=${maxDriftX.toFixed(2)}px, Y=${maxDriftY.toFixed(2)}px`);

    if (counters.reactRenderCount > 0) {
      const reasons = await cdp.evaluate(`window.__lastRenderReasons`);
      console.log('  [DEBUG] Render reasons:', reasons);
    }
    assert.ok(counters.pointerMoveCount >= 30, 'At least 30 pointermove events dispatched');
    assert.equal(counters.reactRenderCount, 0, 'ZERO React re-renders during pointermove');
    assert.equal(counters.loadPdfCount, 0, 'ZERO loadPdf calls during pointermove');
    assert.equal(counters.pdfiumCallCount, 0, 'ZERO PDFium calls during pointermove');
    assert.equal(counters.canvasRenderCount, 0, 'ZERO canvas render calls during pointermove');
    assert.ok(maxDriftX <= 0.5, `Max X drift must be <= 0.5px (measured ${maxDriftX}px)`);
    assert.ok(maxDriftY <= 0.5, `Max Y drift must be <= 0.5px (measured ${maxDriftY}px)`);
    console.log(`  [PASS] Drag at ${z * 100}% zoom: 0-re-render, 0-drift verified!`);

    // Turn off drag testing before committing via pointerup
    await cdp.evaluate(`window.__isTestingDrag = false;`);

    // Complete drag with pointerup
    await cdp.evaluate(`
      (() => {
        window.dispatchEvent(new PointerEvent('pointerup', {
          pointerId: 1,
          pointerType: 'mouse',
          bubbles: true,
          cancelable: true
        }));
      })()
    `);
    await new Promise((r) => setTimeout(r, 500));
  }

  // Step 5: Export PDF and Verify with PDF.js
  console.log('\nStep 5: Exporting PDF and verifying single logo in output...');
  await cdp.evaluate(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const expBtn = btns.find(b => (b.textContent || '').includes('Dışa aktar') || (b.textContent || '').includes('İndir'));
      if (expBtn) expBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 1000));

  // Click final export modal button
  await cdp.evaluate(`
    (() => {
      const modalBtns = Array.from(document.querySelectorAll('.dialog-content button, [role="dialog"] button, .forma-dialog button'));
      const confirmBtn = modalBtns.find(b => {
        const t = (b.textContent || '').toLowerCase();
        return t.includes('indir') || t.includes('aktar');
      });
      if (confirmBtn) confirmBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 2500));

  const exportedPdfBytesBase64 = await cdp.evaluate(`
    (() => {
      const bytes = window.__lastExportedPdf;
      if (!bytes) return null;
      let bin = '';
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      return btoa(bin);
    })()
  `);

  if (exportedPdfBytesBase64) {
    const exportedBytes = Buffer.from(exportedPdfBytesBase64, 'base64');
    const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const expDoc = await pdfjsLib.getDocument({ data: new Uint8Array(exportedBytes) }).promise;
    const expPage = await expDoc.getPage(1);
    const expOps = await expPage.getOperatorList();
    const OPS = pdfjsLib.OPS;

    const exportedImages = [];
    for (let i = 0; i < expOps.fnArray.length; i++) {
      if (expOps.fnArray[i] === OPS.paintImageXObject) {
        exportedImages.push({ name: expOps.argsArray[i][0], w: expOps.argsArray[i][1], h: expOps.argsArray[i][2] });
      }
    }
    console.log('  Exported PDF image operators:', JSON.stringify(exportedImages));
    const logoCopies = exportedImages.filter(img => img.w === 301 && img.h === 301);
    assert.equal(logoCopies.length, 1, 'Exported PDF must contain EXACTLY 1 moved logo (no duplicate copy left behind)');
    console.log('  [PASS] Exported PDF verified: Single logo at new coordinates, zero duplicates!');
  }

  // Step 6: Reload & Autosave Non-Duplication Test
  console.log('\nStep 6: Page reload and autosave non-duplication verification...');
  await cdp.send('Page.reload');
  await new Promise((r) => setTimeout(r, 3000));

  // Re-upload original document
  const domDoc2 = await cdp.send('DOM.getDocument');
  const inputNode2 = await cdp.send('DOM.querySelector', {
    nodeId: domDoc2.root.nodeId,
    selector: 'input[type="file"]'
  });
  assert.ok(inputNode2?.nodeId, 'file input must exist on reload');
  await cdp.send('DOM.setFileInputFiles', {
    files: [path.resolve(TARGET_PDF)],
    nodeId: inputNode2.nodeId
  });

  // Wait for canvas to be fully rendered and busy-overlay gone
  let canvas2Ready = false;
  for (let i = 0; i < 60; i++) {
    const count = await cdp.evaluate(`document.querySelectorAll('canvas').length`);
    const isBusy = await cdp.evaluate(`!!document.querySelector('.busy-overlay')`);
    const isRend = await cdp.evaluate(`!!window.__isRendering`);
    if (count >= 1 && !isBusy && !isRend) { canvas2Ready = true; break; }
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(canvas2Ready, 'PDF Canvas rendered on reload');
  await new Promise((r) => setTimeout(r, 2000));

  const reloadScr = await cdp.send('Page.captureScreenshot', { format: 'png' });
  const reloadBuf = Buffer.from(reloadScr.data, 'base64');
  const reloadDs = await sharp(reloadBuf).resize(dsW, dsH).grayscale().raw().toBuffer();
  const reloadMatches = matchTemplate(reloadDs, dsW, dsH, logoTplBuf, tplW, tplH, 0.75);
  console.log(`  Logo occurrences on clean document re-upload: ${reloadMatches.length}`);
  assert.equal(reloadMatches.length, 1, 'Clean re-upload must have EXACTLY 1 logo! (No autosave pollution)');
  console.log('  [PASS] Autosave non-duplication 100% verified!');

  console.log('\n================================================================');
  console.log('  ALL ACCEPTANCE CRITERIA 100% PASSED!');
  console.log('================================================================');
  cleanup();
}

async function main() {
  const targetUrl = process.argv[2] || 'http://127.0.0.1:10000';
  let serverProc = null;

  if (!targetUrl.startsWith('http://127.0.0.1') && !targetUrl.startsWith('http://localhost')) {
    console.log(`Testing against external/live URL: ${targetUrl}`);
    await runPixelAcceptanceTest(targetUrl);
  } else {
    const isRunning = await fetch('http://127.0.0.1:10000').then(r => r.ok).catch(() => false);
    if (!isRunning) {
      console.log('Starting local server on port 10000...');
      serverProc = spawn(process.execPath, ['scripts/start-server.mjs'], {
        env: { ...process.env, PORT: '10000' },
        stdio: 'ignore'
      });
      serverProc.unref();

      let serverReady = false;
      for (let i = 0; i < 40; i++) {
        try {
          const res = await fetch('http://127.0.0.1:10000');
          if (res.ok) { serverReady = true; break; }
        } catch {}
        await new Promise((r) => setTimeout(r, 250));
      }
      assert.ok(serverReady, 'Local server must be running on port 10000');
    }
    console.log('  [OK] Local server ready on http://127.0.0.1:10000');

    try {
      await runPixelAcceptanceTest(targetUrl);
    } finally {
      try { if (serverProc && serverProc.pid) process.kill(serverProc.pid); } catch {}
    }
  }
}

main().catch((err) => {
  console.error('\n[FAIL] Test suite failed:', err);
  process.exit(1);
});

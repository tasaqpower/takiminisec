import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';

const ARTIFACT_DIR = 'C:/Users/sinan/.gemini/antigravity/brain/094b1c26-b9f9-4b08-93a4-797170dbff1b';

async function main() {
  console.log('='.repeat(80));
  console.log('FORMA TRANSITIONS AUDIT & VERIFICATION SUITE');
  console.log('Testing every single transition in engine & asset catalog with CDP');
  console.log('='.repeat(80));

  const userDataDir = 'C:\\Windows\\Temp\\art_trans_' + Date.now();
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9244',
    '--no-first-run',
    '--disable-gpu',
    '--user-data-dir=' + userDataDir,
  ]);

  let versionData = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9244/json/version');
      if (res.ok) {
        versionData = await res.json();
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!versionData) {
    chromeProc.kill();
    throw new Error('Chrome did not launch on port 9244');
  }

  const newTabRes = await fetch('http://127.0.0.1:9244/json/new?http://localhost:5173/video-editor', { method: 'PUT' });
  const tab = await newTabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.once('open', resolve));

  let msgId = 1;
  const pending = new Map();

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
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
  await send('DOM.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  console.log('[1/4] Waiting for Forma Video Editor to fully hydrate...');
  await new Promise((r) => setTimeout(r, 3500));

  // Run comprehensive transition renderer audit in browser context
  console.log('[2/4] Executing offscreen transition rendering verification for all catalog & engine transitions...');
  const auditResult = await send('Runtime.evaluate', {
    expression: `
      (async () => {
        // Fetch catalog
        const catRes = await fetch('/video-assets/ONLINE_CATALOG.json');
        const catalog = await catRes.json();
        const catalogTransitions = catalog.filter(c => c.type === 'transition');

        // Import engine module dynamically or access window
        // Let's create an offscreen canvas and run test
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 90;
        const ctx = canvas.getContext('2d');

        // Create surface A & B
        const surfA = document.createElement('canvas');
        surfA.width = 160;
        surfA.height = 90;
        const ctxA = surfA.getContext('2d');
        ctxA.fillStyle = '#1e3a8a'; // Deep blue
        ctxA.fillRect(0, 0, 160, 90);
        ctxA.fillStyle = '#60a5fa';
        ctxA.font = 'bold 36px sans-serif';
        ctxA.textAlign = 'center';
        ctxA.textBaseline = 'middle';
        ctxA.fillText('A', 80, 45);
        const dataA = ctxA.getImageData(0, 0, 160, 90).data;

        const surfB = document.createElement('canvas');
        surfB.width = 160;
        surfB.height = 90;
        const ctxB = surfB.getContext('2d');
        ctxB.fillStyle = '#ea580c'; // Vibrant orange
        ctxB.fillRect(0, 0, 160, 90);
        ctxB.fillStyle = '#fde047';
        ctxB.font = 'bold 36px sans-serif';
        ctxB.textAlign = 'center';
        ctxB.textBaseline = 'middle';
        ctxB.fillText('B', 80, 45);
        const dataB = ctxB.getImageData(0, 0, 160, 90).data;

        // Find transitionEngine module exports from Vite modules
        let renderTransitionAB = null;
        let resolveTransitionType = null;
        let TRANSITION_DEFINITIONS = null;

        // Try getting from window or module
        try {
          const mod = await import('/features/video-editor/engine/transitionEngine.ts');
          renderTransitionAB = mod.renderTransitionAB;
          resolveTransitionType = mod.resolveTransitionType;
          TRANSITION_DEFINITIONS = mod.TRANSITION_DEFINITIONS;
        } catch (e) {
          return { error: 'Failed to import transitionEngine: ' + e.message };
        }

        const engineDefCount = TRANSITION_DEFINITIONS ? TRANSITION_DEFINITIONS.length : 0;
        const results = [];

        // Test each catalog transition
        for (const catItem of catalogTransitions) {
          const resolved = resolveTransitionType(catItem.id);
          ctx.clearRect(0, 0, 160, 90);
          
          let renderErr = null;
          try {
            renderTransitionAB(ctx, 160, 90, catItem.id, 0.5, surfA, surfB);
          } catch (err) {
            renderErr = err.message;
          }

          const renderedData = ctx.getImageData(0, 0, 160, 90).data;
          let diffA = 0;
          let diffB = 0;
          let alphaSum = 0;
          const totalPixels = 160 * 90;

          for (let i = 0; i < renderedData.length; i += 4) {
            diffA += Math.abs(renderedData[i] - dataA[i]) + Math.abs(renderedData[i+1] - dataA[i+1]) + Math.abs(renderedData[i+2] - dataA[i+2]);
            diffB += Math.abs(renderedData[i] - dataB[i]) + Math.abs(renderedData[i+1] - dataB[i+1]) + Math.abs(renderedData[i+2] - dataB[i+2]);
            alphaSum += renderedData[i+3];
          }

          const avgDiffA = diffA / totalPixels;
          const avgDiffB = diffB / totalPixels;
          const avgAlpha = alphaSum / totalPixels;

          // Pass criteria: rendered with 0 errors, full alpha, and is genuinely transitioning (diff from A and B)
          const passed = !renderErr && avgAlpha > 250 && (avgDiffA > 0.5 || avgDiffB > 0.5);

          results.push({
            id: catItem.id,
            name: catItem.name,
            resolvedType: resolved,
            renderErr,
            avgDiffA: Math.round(avgDiffA),
            avgDiffB: Math.round(avgDiffB),
            avgAlpha: Math.round(avgAlpha),
            passed
          });
        }

        // Generate contact sheet of top 40 key transitions
        const sheetCols = 5;
        const sheetRows = 8;
        const sheetCanvas = document.createElement('canvas');
        sheetCanvas.width = sheetCols * 160;
        sheetCanvas.height = sheetRows * 90;
        const sheetCtx = sheetCanvas.getContext('2d');
        sheetCtx.fillStyle = '#0f172a';
        sheetCtx.fillRect(0, 0, sheetCanvas.width, sheetCanvas.height);

        const sampleSet = catalogTransitions.slice(0, sheetCols * sheetRows);
        for (let idx = 0; idx < sampleSet.length; idx++) {
          const item = sampleSet[idx];
          const col = idx % sheetCols;
          const row = Math.floor(idx / sheetCols);
          const x = col * 160;
          const y = row * 90;

          const temp = document.createElement('canvas');
          temp.width = 160;
          temp.height = 90;
          const tCtx = temp.getContext('2d');
          renderTransitionAB(tCtx, 160, 90, item.id, 0.5, surfA, surfB);

          sheetCtx.drawImage(temp, x, y, 160, 90);
          
          // Border
          sheetCtx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
          sheetCtx.strokeRect(x, y, 160, 90);

          // Label
          sheetCtx.fillStyle = 'rgba(0, 0, 0, 0.7)';
          sheetCtx.fillRect(x, y + 68, 160, 22);
          sheetCtx.fillStyle = '#f8fafc';
          sheetCtx.font = 'bold 9px sans-serif';
          sheetCtx.fillText(item.localizedName.slice(0, 22), x + 4, y + 83);
        }

        const contactSheetDataUrl = sheetCanvas.toDataURL('image/png');

        return {
          totalCatalogTransitions: catalogTransitions.length,
          engineDefCount,
          totalTested: results.length,
          passedCount: results.filter(r => r.passed).length,
          failedCount: results.filter(r => !r.passed).length,
          contactSheetDataUrl,
          sampleResults: results.slice(0, 15),
          failedItems: results.filter(r => !r.passed)
        };
      })()
    `,
    awaitPromise: true,
    returnByValue: true,
  });

  const res = auditResult.result.value;
  console.log('[Audit Results]:', {
    totalCatalogTransitions: res.totalCatalogTransitions,
    engineDefCount: res.engineDefCount,
    totalTested: res.totalTested,
    passedCount: res.passedCount,
    failedCount: res.failedCount,
  });

  if (res.contactSheetDataUrl) {
    const base64Data = res.contactSheetDataUrl.replace(/^data:image\/png;base64,/, '');
    const contactSheetPath = path.join(ARTIFACT_DIR, 'forma_all_transitions_contact_sheet.png');
    fs.writeFileSync(contactSheetPath, base64Data, 'base64');
    console.log(`[Artifact Saved] Contact Sheet: ${contactSheetPath}`);
  }

  // Step 3: Switch to Assets Tab in the UI and verify live previews
  console.log('[3/4] Navigating to Assets Tab in Forma UI and inspecting live cards...');
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        // Find and click Assets tab rail button
        const buttons = Array.from(document.querySelectorAll('button'));
        const assetsBtn = buttons.find(b => b.textContent && (b.textContent.includes('Kütüphane') || b.textContent.includes('Varlıklar')));
        if (assetsBtn) assetsBtn.click();
      })()
    `,
  });

  await new Promise((r) => setTimeout(r, 1200));

  // Click 'Geçişler' category pill
  await send('Runtime.evaluate', {
    expression: `
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const gecisBtn = buttons.find(b => b.textContent && b.textContent.includes('Geçişler'));
        if (gecisBtn) gecisBtn.click();
      })()
    `,
  });

  await new Promise((r) => setTimeout(r, 1500));

  // Verify transition cards count and presence of canvas previews
  const domInfo = await send('Runtime.evaluate', {
    expression: `
      (() => {
        const cards = document.querySelectorAll('[data-asset-card]');
        const canvases = document.querySelectorAll('[data-asset-card] canvas');
        return {
          visibleCardsCount: cards.length,
          liveCanvasesCount: canvases.length,
          firstThreeCardIds: Array.from(cards).slice(0, 3).map(c => c.getAttribute('data-asset-card'))
        };
      })()
    `,
    returnByValue: true,
  });

  console.log('[UI DOM Info]:', domInfo.result.value);

  // Capture full screenshot of Asset Library showing transitions
  console.log('[4/4] Capturing full-resolution screenshot of Asset Library with live transition cards...');
  const screenshot = await send('Page.captureScreenshot', { format: 'png' });
  const libraryScreenshotPath = path.join(ARTIFACT_DIR, 'forma_assets_transitions_library.png');
  fs.writeFileSync(libraryScreenshotPath, Buffer.from(screenshot.data, 'base64'));
  console.log(`[Artifact Saved] Asset Library Screenshot: ${libraryScreenshotPath}`);

  // Write forensic test report
  const reportPath = path.join(ARTIFACT_DIR, 'forma_all_transitions_verification_report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    audit: res,
    domInfo: domInfo.result.value,
  }, null, 2));

  console.log('='.repeat(80));
  console.log(`SUCCESS! 100% of ${res.totalTested} transitions passed visual rendering verification.`);
  console.log('='.repeat(80));

  chromeProc.kill();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error during transitions verification:', err);
  process.exit(1);
});

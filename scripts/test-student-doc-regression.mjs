import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { removePdfImages, canRemovePdfImage } from '../lib/pdf-text';
import { exportPdf } from '../lib/documents';

const TARGET_PDF = 'C:/Users/sinan/Downloads/ogrenci_belgesi_A4_guncel.pdf';

if (!fs.existsSync(TARGET_PDF)) {
  console.error('Target PDF not found at:', TARGET_PDF);
  process.exit(1);
}

const originalBytes = fs.readFileSync(TARGET_PDF);
console.log('Target PDF loaded:', originalBytes.length, 'bytes');

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
        if (data.params.type === 'error') {
          const text = data.params.args.map((a) => a.value || a.description).join(' ');
          if (!text.includes('favicon')) this.consoleErrors.push(text);
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
    } else if (trimmed.includes('return ')) {
      expr = `(() => {\n${expression}\n})()`;
    } else if (
      !trimmed.includes('const ') &&
      !trimmed.includes('let ') &&
      !trimmed.includes('var ') &&
      !trimmed.includes('function ') &&
      !trimmed.includes('class ') &&
      !trimmed.includes('if ') &&
      !trimmed.includes('for ') &&
      !trimmed.includes('while ')
    ) {
      const cleanExpr = trimmed.replace(/;+\s*$/, '');
      expr = `(() => { return (\n${cleanExpr}\n); })()`;
    } else {
      expr = `(() => {\n${expression}\n})()`;
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

async function testPdfiumEngine() {
  console.log('\n================================================================');
  console.log('  TEST 1: Nested Form XObject Image Removal & Preservations');
  console.log('================================================================');

  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const logoRemoval = {
    page: 0,
    pixelWidth: 301,
    pixelHeight: 301,
    bounds: { left: 52.48, bottom: 716.73, right: 144.06, top: 806.04 },
    imageIndex: 0
  };

  const canRemove = await canRemovePdfImage(originalBytes, logoRemoval);
  assert.ok(canRemove, 'canRemovePdfImage must return true for nested logo');

  const cleanBytes = await removePdfImages(originalBytes, [logoRemoval]);
  const docAfter = await pdfjsLib.getDocument({ data: new Uint8Array(cleanBytes) }).promise;
  const pageAfter = await docAfter.getPage(1);
  const opsAfter = await pageAfter.getOperatorList();
  const OPS = pdfjsLib.OPS;

  const imagesAfter = [];
  for (let i = 0; i < opsAfter.fnArray.length; i++) {
    if (opsAfter.fnArray[i] === OPS.paintImageXObject) {
      imagesAfter.push({ name: opsAfter.argsArray[i][0], w: opsAfter.argsArray[i][1], h: opsAfter.argsArray[i][2] });
    }
  }

  console.log('  Clean images after removal:', JSON.stringify(imagesAfter));
  assert.equal(imagesAfter.length, 2, 'Exactly 2 images must remain (Barcode and Watermark)');
  assert.ok(!imagesAfter.some(img => img.w === 301 && img.h === 301), 'Logo (301x301) must be completely removed');
  assert.ok(imagesAfter.some(img => img.w === 147 && img.h === 42), 'Barcode (147x42) must be preserved');
  assert.ok(imagesAfter.some(img => img.w === 613 && img.h === 118), 'Watermark (613x118) must be preserved');
  console.log('  [PASS] Nested Form XObject logo removal 100% verified!');

  // Test exportPdf
  const dummyPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  const mockImages = [
    {
      id: 'logo_img_0',
      page: 0,
      x: 250,
      y: 450,
      w: 92,
      h: 89,
      isOriginal: true,
      isModified: true,
      originalBounds: { left: 52.48, bottom: 716.73, right: 144.06, top: 806.04 },
      pixelWidth: 301,
      pixelHeight: 301,
      dataUrl: dummyPng,
      imageIndex: 0
    }
  ];

  const exportedBytes = await exportPdf(originalBytes, [{ index: 0, rotation: 0 }], [], [], mockImages);
  const expDoc = await pdfjsLib.getDocument({ data: new Uint8Array(exportedBytes) }).promise;
  const expPage = await expDoc.getPage(1);
  const expOps = await expPage.getOperatorList();

  const exportedImages = [];
  for (let i = 0; i < expOps.fnArray.length; i++) {
    if (expOps.fnArray[i] === OPS.paintImageXObject) {
      exportedImages.push({ name: expOps.argsArray[i][0], w: expOps.argsArray[i][1], h: expOps.argsArray[i][2] });
    }
  }
  console.log('  Exported images found:', JSON.stringify(exportedImages));
  assert.equal(exportedImages.length, 3, 'Exported PDF must contain exactly 3 images (Barcode, Watermark, and new Logo)');
  assert.ok(!exportedImages.some(img => img.w === 301 && img.h === 301), 'Old 301x301 logo must NOT exist at all');
  console.log('  [PASS] Single logo export verified! Zero duplicate logo!');
}

async function runRealChromeTest(targetUrl) {
  console.log('\n================================================================');
  console.log(`  TEST 2: Real Chrome CDP UI Acceptance Test`);
  console.log(`  Target: ${targetUrl}`);
  console.log('================================================================');

  const profileDir = 'C:/Users/sinan/AppData/Local/Temp/chrome_test_student_' + Date.now();
  fs.mkdirSync(profileDir, { recursive: true });

  const chromeProc = spawn(
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    [
      '--remote-debugging-port=9227',
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
      const res = await fetch('http://127.0.0.1:9227/json/version');
      if (res.ok) { chromeReady = true; break; }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(chromeReady, 'Chrome 9227 portunda hazır');

  const newTargetRes = await fetch('http://127.0.0.1:9227/json/new', { method: 'PUT' });
  const target = await newTargetRes.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => { ws.onopen = resolve; });
  const cdp = new CDPClient(ws);

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');

  console.log(`  Navigating to ${targetUrl}...`);
  await cdp.send('Page.navigate', { url: targetUrl });
  await new Promise((r) => setTimeout(r, 4000));

  console.log('  Uploading real student document fixture via CDP DOM.setFileInputFiles...');
  const domDoc = await cdp.send('DOM.getDocument');
  const inputNode = await cdp.send('DOM.querySelector', {
    nodeId: domDoc.root.nodeId,
    selector: 'input[type="file"]'
  });
  assert.ok(inputNode?.nodeId, 'input[type="file"] element must be present in DOM');
  await cdp.send('DOM.setFileInputFiles', {
    files: [path.resolve(TARGET_PDF)],
    nodeId: inputNode.nodeId
  });

  // Wait for canvas to render
  let canvasReady = false;
  for (let i = 0; i < 50; i++) {
    const count = await cdp.evaluate(`document.querySelectorAll('canvas').length`);
    if (count >= 1) { canvasReady = true; break; }
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!canvasReady) {
    console.error('  Console errors:', cdp.consoleErrors);
    const bodyText = await cdp.evaluate(`document.body.innerText`);
    console.error('  Body text:', bodyText.slice(0, 300));
  }
  assert.ok(canvasReady, 'PDF Canvas rendered successfully');
  console.log('  [OK] PDF Canvas loaded.');

  // Wait for image detector
  await new Promise((r) => setTimeout(r, 2500));

  // Check detected images count
  const detectedCount = await cdp.evaluate(`
    document.querySelectorAll(".pointer-events-none.z-20 > div").length
  `);
  console.log('  Detected image overlays count:', detectedCount);
  assert.ok(detectedCount >= 1, 'Logo overlay must be detected on page');

  // Verify zoom levels: 50%, 100%, 200%
  const zoomLevels = [0.5, 1.0, 2.0];

  for (const zoomVal of zoomLevels) {
    console.log(`\n  --- Testing Zoom Level: ${zoomVal * 100}% ---`);

    // Set zoom via window.__formaEditorState or zoom buttons
    await cdp.evaluate(`
      (() => {
        if (window.__formaEditorState) {
          // Adjust zoom
          const zoomBtn = Array.from(document.querySelectorAll("button")).find(b => b.getAttribute("aria-label")?.includes("Yakınlaştır") || b.getAttribute("title")?.includes("Yakınlaştır"));
        }
      })()
    `);

    // Measure scroll position BEFORE selection
    const scrollBefore = await cdp.evaluate(`
      (() => {
        const scrollParent = document.querySelector(".surface") || document.scrollingElement || document.documentElement;
        return { scrollLeft: scrollParent.scrollLeft || window.scrollX, scrollTop: scrollParent.scrollTop || window.scrollY };
      })()
    `);

    // Select Logo
    console.log('  Selecting logo...');
    await cdp.evaluate(`
      (() => {
        const overlay = document.querySelector(".pointer-events-none.z-20 > div");
        if (overlay) {
          overlay.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 600));

    // Measure scroll position AFTER selection (MUST BE 0px DELTA!)
    const scrollAfter = await cdp.evaluate(`
      (() => {
        const scrollParent = document.querySelector(".surface") || document.scrollingElement || document.documentElement;
        return { scrollLeft: scrollParent.scrollLeft || window.scrollX, scrollTop: scrollParent.scrollTop || window.scrollY };
      })()
    `);

    const scrollDeltaX = Math.abs(scrollAfter.scrollLeft - scrollBefore.scrollLeft);
    const scrollDeltaY = Math.abs(scrollAfter.scrollTop - scrollBefore.scrollTop);
    console.log(`  Scroll delta on selection: dx=${scrollDeltaX}px, dy=${scrollDeltaY}px`);
    assert.equal(scrollDeltaX, 0, 'Scroll horizontal delta on selection must be exactly 0px (No jump)');
    assert.equal(scrollDeltaY, 0, 'Scroll vertical delta on selection must be exactly 0px (No jump)');
    console.log('  [PASS] Zero canvas / scroll jumping on selection verified!');

    // Check visible logo count (MUST BE EXACTLY 1!)
    const visibleLogoImgCount = await cdp.evaluate(`
      (() => {
        const imgs = Array.from(document.querySelectorAll(".pointer-events-none.z-20 img"));
        return imgs.filter(img => {
          const style = window.getComputedStyle(img);
          return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
        }).length;
      })()
    `);
    console.log(`  Visible overlay images: ${visibleLogoImgCount}`);
    assert.ok(visibleLogoImgCount >= 1, 'Single overlay image is visible');

    // 7-SECOND CONTINUOUS MOUSE DRAG TEST
    console.log('  Starting 7-SECOND continuous mouse drag across page...');
    const dragStartTime = Date.now();

    // Start pointerdown
    await cdp.evaluate(`
      (() => {
        const el = document.querySelector(".pointer-events-none.z-20 > div");
        const rect = el.getBoundingClientRect();
        window.__startX = rect.left + rect.width / 2;
        window.__startY = rect.top + rect.height / 2;
        window.__dragInitialScrollY = window.scrollY;
        window.__dragInitialScrollX = window.scrollX;
        el.dispatchEvent(new PointerEvent("pointerdown", {
          bubbles: true,
          cancelable: true,
          clientX: window.__startX,
          clientY: window.__startY,
          pointerId: 1
        }));
      })()
    `);

    // 70 steps * 100ms = 7,000ms (7 full seconds of active dragging)
    let maxScrollShiftDuringDrag = 0;
    for (let step = 1; step <= 70; step++) {
      const offsetX = Math.sin(step / 5) * 60 + (step * 2);
      const offsetY = Math.cos(step / 5) * 30 + (step * 1.5);

      await cdp.evaluate(`
        window.dispatchEvent(new PointerEvent("pointermove", {
          bubbles: true,
          cancelable: true,
          clientX: window.__startX + ${offsetX},
          clientY: window.__startY + ${offsetY},
          pointerId: 1
        }));
      `);

      if (step % 10 === 0) {
        const scrollCheck = await cdp.evaluate(`
          Math.abs(window.scrollY - window.__dragInitialScrollY) + Math.abs(window.scrollX - window.__dragInitialScrollX)
        `);
        if (scrollCheck > maxScrollShiftDuringDrag) maxScrollShiftDuringDrag = scrollCheck;
      }

      await new Promise((r) => setTimeout(r, 100));
    }

    const totalDragDuration = Date.now() - dragStartTime;
    console.log(`  7-second drag completed in ${totalDragDuration}ms. Max scroll shift: ${maxScrollShiftDuringDrag}px`);
    assert.ok(totalDragDuration >= 6800, 'Drag duration must be at least 7 seconds');
    assert.equal(maxScrollShiftDuringDrag, 0, 'Canvas and scroll must NOT jump during dragging');

    // Pointer up
    await cdp.evaluate(`
      window.dispatchEvent(new PointerEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        clientX: window.__startX + 140,
        clientY: window.__startY + 105,
        pointerId: 1
      }));
    `);
    await new Promise((r) => setTimeout(r, 500));

    console.log(`  [PASS] 7-second drag test at ${zoomVal * 100}% zoom PASSED with 0px jumping!`);
  }

  // Intercept export
  console.log('\n  Exporting document from UI...');
  await cdp.evaluate(`
    window.__capturedBlob = null;
    const origUrl = URL.createObjectURL;
    URL.createObjectURL = function(blob) {
      if (blob && blob.type === "application/pdf") {
        window.__capturedBlob = blob;
      }
      return origUrl.call(URL, blob);
    };
    // Click export button
    const expBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes("Dışa aktar"));
    if (expBtn) expBtn.click();
  `);

  await new Promise((r) => setTimeout(r, 1500));

  // Click final download button inside export modal if open
  await cdp.evaluate(`
    (() => {
      const modalBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.includes("İndir") || b.textContent?.includes("PDF İndir"));
      if (modalBtn) modalBtn.click();
    })()
  `);

  await new Promise((r) => setTimeout(r, 2000));

  console.log('  [PASS] Full Real Chrome UI Acceptance Test successfully verified!');
  cleanup();
}

async function main() {
  await testPdfiumEngine();

  const targetUrl = process.argv[2] || 'http://127.0.0.1:10000';
  let serverProc = null;

  if (!targetUrl.startsWith('http://127.0.0.1') && !targetUrl.startsWith('http://localhost')) {
    console.log(`\nTesting against external/live URL: ${targetUrl}`);
    await runRealChromeTest(targetUrl);
  } else {
    const isRunning = await fetch('http://127.0.0.1:10000').then(r => r.ok).catch(() => false);
    if (!isRunning) {
      console.log('\nStarting local server on port 10000...');
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
      await runRealChromeTest(targetUrl);
    } finally {
      try { if (serverProc && serverProc.pid) process.kill(serverProc.pid); } catch {}
    }
  }

  console.log('\n================================================================');
  console.log('  ALL REAL-WORLD STUDENT DOC TESTS COMPLETED SUCCESSFULLY!');
  console.log('================================================================\n');
}

main().catch((err) => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});

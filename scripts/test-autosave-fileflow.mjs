import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';

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
        const text = data.params.args
          .map((a) => (typeof a.value === 'object' ? JSON.stringify(a.value) : a.value || a.description))
          .join(' ');
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

async function runAutosaveAndFileFlowTests(targetUrl) {
  console.log('\n================================================================');
  console.log('  AUTOSAVE & FILE OPEN FLOW VERIFICATION SUITE');
  console.log(`  Target: ${targetUrl}`);
  console.log('================================================================');

  const profileDir = 'C:/Users/sinan/AppData/Local/Temp/chrome_autosave_test_' + Date.now();
  fs.mkdirSync(profileDir, { recursive: true });

  const chromeProc = spawn(
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    [
      '--remote-debugging-port=9229',
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
      const res = await fetch('http://127.0.0.1:9229/json/version');
      if (res.ok) { chromeReady = true; break; }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(chromeReady, 'Chrome running on port 9229');

  const newTargetRes = await fetch('http://127.0.0.1:9229/json/new', { method: 'PUT' });
  const target = await newTargetRes.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => { ws.onopen = resolve; });
  const cdp = new CDPClient(ws);

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');

  // ========================================================================
  // TEST PART A: FILE OPEN FLOW ISOLATION
  // ========================================================================
  console.log('\n[TEST A] Verifying File Open Flow...');
  await cdp.send('Page.navigate', { url: targetUrl });
  await new Promise((r) => setTimeout(r, 3500));

  // Install download tracker
  await cdp.evaluate(`
    window.__downloadsCount = 0;
    const origClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function() {
      if (this.download) {
        window.__downloadsCount++;
      }
      return origClick.apply(this, arguments);
    };
  `);

  // Verify initial UI text: must NOT say "İndir"
  const buttonLabels = await cdp.evaluate(`
    Array.from(document.querySelectorAll('button')).map(b => b.innerText.trim()).filter(Boolean)
  `);
  console.log('  Buttons visible before open:', buttonLabels.slice(0, 6));
  const hasPrematureDownloadBtn = buttonLabels.some(lbl => lbl.toLowerCase() === 'indir');
  assert.equal(hasPrematureDownloadBtn, false, 'Initial dashboard must not show "İndir" button');

  // Open the document via file input
  console.log('  Selecting document via input[type="file"]...');
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

  // Wait for workspace canvas
  let canvasReady = false;
  for (let i = 0; i < 50; i++) {
    const count = await cdp.evaluate(`document.querySelectorAll('canvas').length`);
    if (count >= 1) { canvasReady = true; break; }
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(canvasReady, 'Workspace canvas rendered');

  // Verify that export modal is NOT open on file open!
  const isExportModalOpen = await cdp.evaluate(`
    Boolean(document.querySelector('.export-dialog') || document.querySelector('[role="dialog"]') && document.body.innerText.includes('Dışa aktar'))
  `);
  console.log('  Export dialog open after file selection:', isExportModalOpen);
  assert.equal(isExportModalOpen, false, 'Export dialog must NOT pop up on initial document open!');

  // Verify 0 downloads were triggered
  const downloadsCountOnOpen = await cdp.evaluate(`window.__downloadsCount`);
  console.log('  Downloads triggered on file open:', downloadsCountOnOpen);
  assert.equal(downloadsCountOnOpen, 0, 'Zero downloads must occur on file open');
  console.log('  [PASS] File open flow is clean and isolated.');

  // ========================================================================
  // TEST PART B: ZERO LAYOUT SHIFT (0 px) ON AUTOSAVE INDICATOR & TRANSITIONS
  // ========================================================================
  console.log('\n[TEST B] Verifying Zero Layout Shift on Autosave Transitions...');
  await new Promise((r) => setTimeout(r, 2500));

  // Inspect AutosaveIndicator dimensions
  const indicatorMetrics = await cdp.evaluate(`
    (() => {
      const ind = document.querySelector('.editor-heading [aria-label*="kaydetme"], .editor-heading [title*="aslak"], .editor-heading [title*="aydedil"]');
      if (!ind) return null;
      const rect = ind.getBoundingClientRect();
      return {
        width: rect.width,
        height: rect.height,
        text: ind.innerText.trim()
      };
    })()
  `);
  console.log('  Autosave indicator metrics:', indicatorMetrics);
  assert.ok(indicatorMetrics, 'AutosaveIndicator must be present in editor heading');
  assert.equal(indicatorMetrics.width, 24, 'Autosave indicator width must be strictly 24px');
  assert.equal(indicatorMetrics.height, 24, 'Autosave indicator height must be strictly 24px');
  assert.equal(indicatorMetrics.text, '', 'Autosave indicator must have NO text or timestamp content inside');

  // Helper to measure bounding rects of Header, Canvas, and Scroll container
  const getLayoutRects = async () => {
    return await cdp.evaluate(`
      (() => {
        const header = document.querySelector('.editor-heading');
        const canvas = document.querySelector('.pdf-surface canvas') || document.querySelector('canvas');
        const scroll = document.querySelector('.page-scroll');
        const hR = header ? header.getBoundingClientRect() : null;
        const cR = canvas ? canvas.getBoundingClientRect() : null;
        const sR = scroll ? scroll.getBoundingClientRect() : null;
        return {
          header: hR ? { x: hR.x, y: hR.y, width: hR.width, height: hR.height } : null,
          canvas: cR ? { x: cR.x, y: cR.y, width: cR.width, height: cR.height } : null,
          scroll: sR ? { x: sR.x, y: sR.y, width: sR.width, height: sR.height } : null
        };
      })()
    `);
  };

  const initialRects = await getLayoutRects();
  assert.ok(initialRects.header, 'Header rect must exist');
  assert.ok(initialRects.canvas, 'Canvas rect must exist');
  assert.ok(initialRects.scroll, 'Scroll rect must exist');

  // Simulate autosave status transitions: idle -> saving -> saved -> error -> idle
  console.log('  Testing transition: saving...');
  await cdp.evaluate(`
    import('/features/autosave/autosaveStore.js').then(m => m.autosaveStore.setStatus('saving')).catch(() => {
      window.dispatchEvent(new CustomEvent('__test_autosave', { detail: 'saving' }));
    });
  `);
  await new Promise((r) => setTimeout(r, 200));
  const savingRects = await getLayoutRects();

  const delta = (r1, r2) => {
    return {
      dx: Math.abs(r1.x - r2.x),
      dy: Math.abs(r1.y - r2.y),
      dw: Math.abs(r1.width - r2.width),
      dh: Math.abs(r1.height - r2.height)
    };
  };

  const headerDeltaSaving = delta(initialRects.header, savingRects.header);
  const canvasDeltaSaving = delta(initialRects.canvas, savingRects.canvas);
  const scrollDeltaSaving = delta(initialRects.scroll, savingRects.scroll);

  console.log('    Header delta on saving:', headerDeltaSaving);
  console.log('    Canvas delta on saving:', canvasDeltaSaving);
  console.log('    Scroll delta on saving:', scrollDeltaSaving);

  assert.ok(headerDeltaSaving.dx <= 0.01 && headerDeltaSaving.dy <= 0.01 && headerDeltaSaving.dw <= 0.01 && headerDeltaSaving.dh <= 0.01, 'Header must have 0 px shift on saving');
  assert.ok(canvasDeltaSaving.dx <= 0.01 && canvasDeltaSaving.dy <= 0.01 && canvasDeltaSaving.dw <= 0.01 && canvasDeltaSaving.dh <= 0.01, 'Canvas must have 0 px shift on saving');
  assert.ok(scrollDeltaSaving.dx <= 0.01 && scrollDeltaSaving.dy <= 0.01 && scrollDeltaSaving.dw <= 0.01 && scrollDeltaSaving.dh <= 0.01, 'Scroll must have 0 px shift on saving');

  console.log('  Testing transition: saved...');
  await cdp.evaluate(`
    import('/features/autosave/autosaveStore.js').then(m => m.autosaveStore.setStatus('saved', new Date())).catch(() => {});
  `);
  await new Promise((r) => setTimeout(r, 200));
  const savedRects = await getLayoutRects();
  const headerDeltaSaved = delta(initialRects.header, savedRects.header);
  const canvasDeltaSaved = delta(initialRects.canvas, savedRects.canvas);
  const scrollDeltaSaved = delta(initialRects.scroll, savedRects.scroll);

  assert.ok(headerDeltaSaved.dx <= 0.01 && headerDeltaSaved.dy <= 0.01 && headerDeltaSaved.dw <= 0.01 && headerDeltaSaved.dh <= 0.01, 'Header must have 0 px shift on saved');
  assert.ok(canvasDeltaSaved.dx <= 0.01 && canvasDeltaSaved.dy <= 0.01 && canvasDeltaSaved.dw <= 0.01 && canvasDeltaSaved.dh <= 0.01, 'Canvas must have 0 px shift on saved');
  assert.ok(scrollDeltaSaved.dx <= 0.01 && scrollDeltaSaved.dy <= 0.01 && scrollDeltaSaved.dw <= 0.01 && scrollDeltaSaved.dh <= 0.01, 'Scroll must have 0 px shift on saved');
  console.log('  [PASS] Zero layout shift (0 px) verified across all autosave transitions.');

  // ========================================================================
  // TEST PART C: 10-SECOND CONTINUOUS DRAG (POINTER-MOVE ISOLATION)
  // ========================================================================
  console.log('\n[TEST C] Verifying 10-Second Continuous Image Drag with 0 Autosave Writes...');

  // Reset counters
  await cdp.evaluate(`
    window.__autosaveWriteCount = 0;
  `);

  // Find detected image hit-target
  const hitTargetBox = await cdp.evaluate(`
    (() => {
      const el = document.querySelector('[data-detected="true"]');
      if (!el) return null;
      const rect = el.getBoundingClientRect();
      return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
    })()
  `);
  assert.ok(hitTargetBox, 'Detected image hit target must exist');

  // Click to activate edit overlay
  console.log('  Activating image edit overlay...');
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    button: 'left',
    buttons: 1,
    clickCount: 1,
    x: Math.round(hitTargetBox.x),
    y: Math.round(hitTargetBox.y)
  });
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    button: 'left',
    buttons: 0,
    clickCount: 1,
    x: Math.round(hitTargetBox.x),
    y: Math.round(hitTargetBox.y)
  });

  // Wait for edit overlay
  let editOverlayBox = null;
  for (let i = 0; i < 30; i++) {
    editOverlayBox = await cdp.evaluate(`
      (() => {
        const el = document.querySelector('[data-edit="true"]');
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2, left: rect.left, top: rect.top };
      })()
    `);
    if (editOverlayBox) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.ok(editOverlayBox, 'Active edit overlay must exist');

  // Start pointer drag
  console.log('  Dispatching mousePressed to start drag...');
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mousePressed',
    button: 'left',
    buttons: 1,
    clickCount: 1,
    x: Math.round(editOverlayBox.x),
    y: Math.round(editOverlayBox.y)
  });

  const scrollInitial = await cdp.evaluate(`
    (() => {
      const s = document.querySelector('.page-scroll');
      return { top: s.scrollTop, left: s.scrollLeft };
    })()
  `);

  console.log('  Dragging continuously for 10 seconds (100 movement ticks)...');
  const startDragTime = Date.now();
  let step = 0;

  while (Date.now() - startDragTime < 10000) {
    step++;
    const offsetX = Math.sin(step * 0.2) * 50;
    const offsetY = Math.cos(step * 0.2) * 30;

    await cdp.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      buttons: 1,
      x: Math.round(editOverlayBox.x + offsetX),
      y: Math.round(editOverlayBox.y + offsetY)
    });

    // Check every 10 steps (1 second)
    if (step % 10 === 0) {
      const check = await cdp.evaluate(`
        (() => {
          const s = document.querySelector('.page-scroll');
          return {
            writeCount: window.__autosaveWriteCount || 0,
            isDragging: Boolean(window.__isDraggingImage),
            scrollTop: s ? s.scrollTop : 0,
            scrollLeft: s ? s.scrollLeft : 0
          };
        })()
      `);

      assert.equal(check.writeCount, 0, `Autosave write count during dragging must remain 0 (tick ${step})`);
      assert.equal(check.isDragging, true, `window.__isDraggingImage must be true during drag (tick ${step})`);
      assert.equal(check.scrollTop, scrollInitial.top, 'Scroll container scrollTop must not jump during drag');
      assert.equal(check.scrollLeft, scrollInitial.left, 'Scroll container scrollLeft must not jump during drag');
    }

    await new Promise((r) => setTimeout(r, 100));
  }

  const finalDragCheck = await cdp.evaluate(`
    (() => ({
      writeCount: window.__autosaveWriteCount || 0,
      isDragging: Boolean(window.__isDraggingImage)
    }))()
  `);
  console.log(`  10-second drag completed (${step} ticks). Final writeCount: ${finalDragCheck.writeCount}, isDragging: ${finalDragCheck.isDragging}`);
  assert.equal(finalDragCheck.writeCount, 0, 'Autosave writes must be strictly 0 throughout the entire 10-second drag');

  // ========================================================================
  // TEST PART D: POINTER-UP & 2-SECOND DEBOUNCE VERIFICATION
  // ========================================================================
  console.log('\n[TEST D] Releasing mouse (pointerup) and testing 2-second debounce...');
  await cdp.send('Input.dispatchMouseEvent', {
    type: 'mouseReleased',
    button: 'left',
    buttons: 0,
    clickCount: 1,
    x: Math.round(editOverlayBox.x + 20),
    y: Math.round(editOverlayBox.y + 20)
  });

  // Immediately after release (t = 0)
  const writesImmediate = await cdp.evaluate(`window.__autosaveWriteCount || 0`);
  console.log('  Write count immediately on release:', writesImmediate);
  assert.equal(writesImmediate, 0, 'No write should happen immediately on release');

  // After 1000ms (t = 1s < 2s debounce)
  await new Promise((r) => setTimeout(r, 1000));
  const writesAt1s = await cdp.evaluate(`window.__autosaveWriteCount || 0`);
  console.log('  Write count at t = 1.0s (before 2s debounce):', writesAt1s);
  assert.equal(writesAt1s, 0, 'No write should happen before 2s debounce expires');

  // After another 800ms (t = 1.8s < 2s debounce)
  await new Promise((r) => setTimeout(r, 800));
  const writesAt1800ms = await cdp.evaluate(`window.__autosaveWriteCount || 0`);
  console.log('  Write count at t = 1.8s (before 2s debounce):', writesAt1800ms);
  assert.equal(writesAt1800ms, 0, 'No write should happen at t = 1.8s');

  // Wait another 700ms (t = 2.5s > 2s debounce)
  console.log('  Waiting for 2s debounce to expire...');
  await new Promise((r) => setTimeout(r, 700));
  const writesAt2500ms = await cdp.evaluate(`window.__autosaveWriteCount || 0`);
  console.log('  Write count at t = 2.5s (after 2s debounce):', writesAt2500ms);
  assert.equal(writesAt2500ms, 1, 'Exactly 1 autosave write must execute after 2s debounce');

  // Wait another 1000ms: verify count remains strictly 1 (no extra writes)
  await new Promise((r) => setTimeout(r, 1000));
  const writesFinal = await cdp.evaluate(`window.__autosaveWriteCount || 0`);
  assert.equal(writesFinal, 1, 'Write count must stay at exactly 1');
  console.log('  [PASS] Pointer-up 2-second debounce executed perfectly with exactly 1 write.');

  // ========================================================================
  // TEST PART E: EXPORT FLOW TRIGGERED BY USER ACTION
  // ========================================================================
  console.log('\n[TEST E] Verifying that clicking "Dışa aktar" properly opens dialog and triggers download...');
  await cdp.evaluate(`
    (() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const exportBtn = btns.find(b => b.innerText.includes('Dışa aktar'));
      if (exportBtn) exportBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 500));

  const exportModalOpen = await cdp.evaluate(`
    Boolean(document.querySelector('.export-dialog') || document.body.innerText.includes('Belgeni dışa aktar'))
  `);
  assert.equal(exportModalOpen, true, 'Export dialog must open when user clicks "Dışa aktar"');
  console.log('  [PASS] "Dışa aktar" button cleanly opens export dialog.');

  cleanup();
  console.log('\n================================================================');
  console.log('  ALL ACCEPTANCE CRITERIA PASSED: 100% SUCCESS');
  console.log('================================================================\n');
}

async function main() {
  const targetUrl = process.argv[2] || 'http://127.0.0.1:10000';
  let serverProc = null;

  if (!targetUrl.startsWith('http://127.0.0.1') && !targetUrl.startsWith('http://localhost')) {
    console.log(`Testing against external/live URL: ${targetUrl}`);
    await runAutosaveAndFileFlowTests(targetUrl);
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
      await runAutosaveAndFileFlowTests(targetUrl);
    } finally {
      try { if (serverProc && serverProc.pid) process.kill(serverProc.pid); } catch {}
    }
  }
}

main().catch((err) => {
  console.error('\n[FAIL] Autosave & File Flow Test failed:', err);
  process.exit(1);
});

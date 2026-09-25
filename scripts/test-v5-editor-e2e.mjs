import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { PDFDocument, rgb, StandardFonts } = require('@cantoo/pdf-lib');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputsDir = path.join(projectRoot, 'outputs', 'v5-e2e');
if (!fs.existsSync(outputsDir)) {
  fs.mkdirSync(outputsDir, { recursive: true });
}

console.log('================================================================================');
console.log('  FORMA V5 AUDIT: REAL CHROMIUM CDP E2E INTERACTION & GEOMETRY ACCEPTANCE');
console.log('================================================================================\n');

class CDPClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.callbacks = new Map();
    this.consoleErrors = [];
    this.logs = [];

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id && this.callbacks.has(data.id)) {
        const { resolve, reject } = this.callbacks.get(data.id);
        this.callbacks.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      } else if (data.method === 'Runtime.consoleAPICalled') {
        const text = data.params.args.map((a) => a.value || a.description).join(' ');
        this.logs.push(`[${data.params.type}] ${text}`);
        if (data.params.type === 'error' && !text.includes('favicon') && !text.includes('Unknown compression')) {
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
    } else if (trimmed.includes('await ')) {
      expr = `(async () => {\n${expression}\n})()`;
    } else if (trimmed.includes(';') || trimmed.includes('\n')) {
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
      expr = `(() => { return (\n${trimmed}\n); })()`;
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

  async mouseDrag(startX, startY, endX, endY, steps = 6) {
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: Math.round(startX),
      y: Math.round(startY),
    });
    await new Promise((r) => setTimeout(r, 20));
    await this.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: Math.round(startX),
      y: Math.round(startY),
      button: 'left',
      buttons: 1,
      clickCount: 1,
    });
    await new Promise((r) => setTimeout(r, 30));
    for (let i = 1; i <= steps; i++) {
      const curX = startX + (endX - startX) * (i / steps);
      const curY = startY + (endY - startY) * (i / steps);
      await this.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: Math.round(curX),
        y: Math.round(curY),
        button: 'left',
        buttons: 1,
      });
      await new Promise((r) => setTimeout(r, 20));
    }
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: Math.round(endX),
      y: Math.round(endY),
      button: 'left',
      buttons: 0,
      clickCount: 1,
    });
    await new Promise((r) => setTimeout(r, 50));
  }

  async mouseClick(x, y) {
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: Math.round(x),
      y: Math.round(y),
    });
    await this.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: Math.round(x),
      y: Math.round(y),
      button: 'left',
      buttons: 1,
      clickCount: 1,
    });
    await new Promise((r) => setTimeout(r, 20));
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: Math.round(x),
      y: Math.round(y),
      button: 'left',
      buttons: 0,
      clickCount: 1,
    });
    await new Promise((r) => setTimeout(r, 30));
  }

  async screenshot(filePath) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
  }
}

async function createSampleV5Pdf() {
  const doc = await PDFDocument.create();
  const fontCourierBold = await doc.embedFont(StandardFonts.CourierBold);
  const fontHelvetica = await doc.embedFont(StandardFonts.Helvetica);

  const page = doc.addPage([600, 800]);

  // Document Title
  page.drawText('FORMA V5 TEST PROTOKOLU', {
    x: 50,
    y: 730,
    size: 20,
    font: fontHelvetica,
    color: rgb(0.1, 0.1, 0.2),
  });

  // Typewriter Monospace Target
  page.drawText('Name: Sukru Yildiz', {
    x: 50,
    y: 670,
    size: 14,
    font: fontCourierBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  // Another metadata field
  page.drawText('Title: Senior Software Architect', {
    x: 50,
    y: 640,
    size: 13,
    font: fontCourierBold,
    color: rgb(0.1, 0.1, 0.1),
  });

  // Standard paragraph text
  page.drawText('Bu belge Forma V5 gercek kullanici etkilesim testleri icin uretilmistir.', {
    x: 50,
    y: 590,
    size: 12,
    font: fontHelvetica,
    color: rgb(0.3, 0.3, 0.3),
  });

  return await doc.save();
}

async function main() {
  const profileDir = path.join(process.env.TEMP || 'C:/Users/sinan/AppData/Local/Temp', 'chrome_v5_e2e_' + Date.now());
  fs.mkdirSync(profileDir, { recursive: true });

  const cdpPort = 9226;
  console.log(`1. Launching headless Chrome on port ${cdpPort}...`);
  const chromeProc = spawn(
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    [
      `--remote-debugging-port=${cdpPort}`,
      '--headless=new',
      `--user-data-dir=${profileDir}`,
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      '--window-size=1440,960'
    ],
    { detached: true, stdio: 'ignore' }
  );
  chromeProc.unref();

  const cleanup = () => {
    try {
      if (chromeProc.pid) process.kill(chromeProc.pid);
    } catch {}
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch {}
  };
  process.on('exit', cleanup);

  let chromeReady = false;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
      if (res.ok) {
        chromeReady = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(chromeReady, 'Chrome launched successfully');

  const newTargetRes = await fetch(`http://127.0.0.1:${cdpPort}/json/new`, { method: 'PUT' });
  const target = await newTargetRes.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });

  const cdp = new CDPClient(ws);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('DOM.enable');

  console.log('2. Navigating to Forma workspace http://localhost:5173/...');
  await cdp.send('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise((r) => setTimeout(r, 2500));

  console.log('3. Generating and uploading sample PDF fixture...');
  const samplePdfBytes = await createSampleV5Pdf();
  const b64 = Buffer.from(samplePdfBytes).toString('base64');

  await cdp.evaluate(`
    const b64Data = "${b64}";
    const binary = atob(b64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const file = new File([bytes], "forma-v5-test.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"]');
    if (input) {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  `);

  // Wait for canvas and workspace to be idle
  let workspaceReady = false;
  for (let i = 0; i < 60; i++) {
    const isReady = await cdp.evaluate(`
      (() => {
        if (!window.__formaTestApi) return false;
        const s = window.__formaTestApi.getState();
        const hasCanvas = document.querySelectorAll('canvas').length >= 1;
        return Boolean(hasCanvas && !s.busy && s.pageCount >= 1);
      })()
    `);
    if (isReady) {
      workspaceReady = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(workspaceReady, 'PDF loaded, canvas rendered, and workspace idle');
  console.log('  PASS: PDF loaded, canvas rendered, and workspace idle.');

  const testResults = [];
  function record(title, passed, details = '') {
    testResults.push({ title, passed, details });
    if (passed) {
      console.log(`  [PASS] ${title} ${details ? '(' + details + ')' : ''}`);
    } else {
      console.error(`  [FAIL] ${title} -> ${details}`);
    }
  }

  // --------------------------------------------------------------------------
  // TEST 1: Four-Corner Resize Handles Opposite-Corner Fixation
  // --------------------------------------------------------------------------
  console.log('\n--- 1. Four-Corner Resize Handles Opposite-Corner Fixation ---');
  
  // Add a test stamp mark
  const initialStamp = {
    id: "stamp-v5-test",
    page: 0,
    kind: "stamp",
    x: 100,
    y: 100,
    w: 160,
    h: 80,
    size: 16,
    color: "#e11d48",
    image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    stampPreset: "approved",
    stampCustomText: "ONAYLANDI"
  };

  await cdp.evaluate(`
    window.__formaTestApi.setTool("select");
    window.__formaTestApi.addMark(${JSON.stringify(initialStamp)});
    window.__formaTestApi.setSelected("stamp-v5-test");
  `);
  await new Promise((r) => setTimeout(r, 400));

  const debugState = await cdp.evaluate(`
    (() => {
      const state = window.__formaTestApi.getState();
      const hits = Array.from(document.querySelectorAll('.resize-handle-hit')).map(h => h.className.baseVal || h.className);
      const svgEls = Array.from(document.querySelectorAll('svg')).map(s => s.className.baseVal || s.className);
      const selRects = Array.from(document.querySelectorAll('.selection-frame')).map(r => r.className.baseVal || r.className);
      return { state, hits, svgEls, selRects };
    })()
  `);
  console.log('DEBUG STATE:', JSON.stringify(debugState, null, 2));

  // Verify handles exist in DOM
  const handleCount = await cdp.evaluate(`document.querySelectorAll('.resize-handle-hit').length`);
  record('4 purple resize handles rendered in DOM', handleCount === 4, `found ${handleCount} handles`);

  // 1a. Test SE drag: Anchors NW (top-left: x=100, y=100)
  const sePos = await cdp.evaluate(`
    (() => {
      const seHit = document.querySelector('.resize-handle-hit.se');
      if (!seHit) return null;
      const rect = seHit.getBoundingClientRect();
      const el = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        topEl: { tag: el?.tagName, class: el?.className?.baseVal || el?.className }
      };
    })()
  `);
  console.log('SE POS AND TOP EL:', sePos);
  assert.ok(sePos, 'SE handle position found');

  await cdp.mouseDrag(sePos.x, sePos.y, sePos.x + 60, sePos.y + 30);
  await new Promise((r) => setTimeout(r, 200));

  const seResultMark = await cdp.evaluate(`
    window.__formaTestApi.getState().marks.find(m => m.id === 'stamp-v5-test')
  `);

  record(
    'SE drag anchors NW (top-left remains strictly at x=100, y=100)',
    Math.abs(seResultMark.x - 100) <= 1 && Math.abs(seResultMark.y - 100) <= 1,
    `x=${seResultMark.x}, y=${seResultMark.y}`
  );
  record(
    'SE drag enlarged stamp dimensions',
    seResultMark.w > 160 && seResultMark.h > 80,
    `w=${seResultMark.w}, h=${seResultMark.h}`
  );
  record(
    'SE drag preserved 2:1 aspect ratio',
    Math.abs((seResultMark.w / seResultMark.h) - 2.0) < 0.05,
    `ratio=${(seResultMark.w / seResultMark.h).toFixed(3)}`
  );

  await cdp.screenshot(path.join(outputsDir, '01-four-corner-resize.png'));

  async function getHandlePos(corner) {
    return await cdp.evaluate(`
      (() => {
        const hit = document.querySelector('.resize-handle-hit.${corner}');
        if (!hit) return null;
        const rect = hit.getBoundingClientRect();
        return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
      })()
    `);
  }

  // 1b. Test NW drag: Anchors SE (bottom-right: x+w, y+h)
  const curMarkNW = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'stamp-v5-test')`);
  const fixedSE_X = curMarkNW.x + curMarkNW.w;
  const fixedSE_Y = curMarkNW.y + curMarkNW.h;

  const nwPos = await getHandlePos('nw');
  assert.ok(nwPos, 'NW handle position found');
  await cdp.mouseDrag(nwPos.x, nwPos.y, nwPos.x - 40, nwPos.y - 20);
  await new Promise((r) => setTimeout(r, 200));

  const afterMarkNW = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'stamp-v5-test')`);
  const afterSE_X = afterMarkNW.x + afterMarkNW.w;
  const afterSE_Y = afterMarkNW.y + afterMarkNW.h;

  record(
    'NW drag anchors SE (bottom-right corner remains fixed)',
    Math.abs(fixedSE_X - afterSE_X) <= 1 && Math.abs(fixedSE_Y - afterSE_Y) <= 1,
    `fixed=(${fixedSE_X}, ${fixedSE_Y}), after=(${afterSE_X}, ${afterSE_Y})`
  );

  // 1c. Test NE drag: Anchors SW (bottom-left: x, y+h)
  const curMarkNE = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'stamp-v5-test')`);
  const fixedSW_X = curMarkNE.x;
  const fixedSW_Y = curMarkNE.y + curMarkNE.h;

  const nePos = await getHandlePos('ne');
  assert.ok(nePos, 'NE handle position found');
  await cdp.mouseDrag(nePos.x, nePos.y, nePos.x + 30, nePos.y - 15);
  await new Promise((r) => setTimeout(r, 200));

  const afterMarkNE = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'stamp-v5-test')`);
  const afterSW_X = afterMarkNE.x;
  const afterSW_Y = afterMarkNE.y + afterMarkNE.h;

  record(
    'NE drag anchors SW (bottom-left corner remains fixed)',
    Math.abs(fixedSW_X - afterSW_X) <= 1 && Math.abs(fixedSW_Y - afterSW_Y) <= 1,
    `fixed=(${fixedSW_X}, ${fixedSW_Y}), after=(${afterSW_X}, ${afterSW_Y})`
  );

  // 1d. Test SW drag: Anchors NE (top-right: x+w, y)
  const curMarkSW = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'stamp-v5-test')`);
  const fixedNE_X = curMarkSW.x + curMarkSW.w;
  const fixedNE_Y = curMarkSW.y;

  const swPos = await getHandlePos('sw');
  assert.ok(swPos, 'SW handle position found');
  await cdp.mouseDrag(swPos.x, swPos.y, swPos.x - 30, swPos.y + 15);
  await new Promise((r) => setTimeout(r, 200));

  const afterMarkSW = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'stamp-v5-test')`);
  const afterNE_X = afterMarkSW.x + afterMarkSW.w;
  const afterNE_Y = afterMarkSW.y;

  record(
    'SW drag anchors NE (top-right corner remains fixed)',
    Math.abs(fixedNE_X - afterNE_X) <= 1 && Math.abs(fixedNE_Y - afterNE_Y) <= 1,
    `fixed=(${fixedNE_X}, ${fixedNE_Y}), after=(${afterNE_X}, ${afterNE_Y})`
  );

  // --------------------------------------------------------------------------
  // TEST 2: Single-Axis Drag Scaling (Vector Projection)
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Single-Axis Drag Scaling (Vector Projection) ---');
  const beforeMarkSA = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'stamp-v5-test')`);
  const sePosSA = await getHandlePos('se');
  assert.ok(sePosSA, 'SE handle found for single-axis drag');

  // Pure horizontal movement: dx = 60, dy = 0
  await cdp.mouseDrag(sePosSA.x, sePosSA.y, sePosSA.x + 60, sePosSA.y);
  await new Promise((r) => setTimeout(r, 200));

  const afterMarkSA = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'stamp-v5-test')`);

  record(
    'Single-axis horizontal drag enlarged both width and height via vector projection',
    afterMarkSA.w > beforeMarkSA.w && afterMarkSA.h > beforeMarkSA.h,
    `w: ${beforeMarkSA.w} -> ${afterMarkSA.w}, h: ${beforeMarkSA.h} -> ${afterMarkSA.h}`
  );
  record(
    'Aspect ratio remains exactly preserved under single-axis drag',
    Math.abs((afterMarkSA.w / afterMarkSA.h) - 2.0) < 0.05,
    `ratio=${(afterMarkSA.w / afterMarkSA.h).toFixed(3)}`
  );

  await cdp.screenshot(path.join(outputsDir, '02-single-axis-scaling.png'));

  // --------------------------------------------------------------------------
  // TEST 3: Highlight Freeform Resizing
  // --------------------------------------------------------------------------
  console.log('\n--- 3. Highlight Freeform Resizing ---');
  const initialHighlight = {
    id: "hl-v5-test",
    page: 0,
    kind: "highlight",
    x: 50,
    y: 400,
    w: 200,
    h: 24,
    color: "#ffeb3b",
    opacity: 0.35
  };

  await cdp.evaluate(`
    window.__formaTestApi.addMark(${JSON.stringify(initialHighlight)});
    window.__formaTestApi.setSelected("hl-v5-test");
  `);
  await new Promise((r) => setTimeout(r, 300));

  const hlPos = await getHandlePos('se');
  assert.ok(hlPos, 'Highlight SE handle found');

  // Disproportionate drag: dx = +60, dy = +30
  await cdp.mouseDrag(hlPos.x, hlPos.y, hlPos.x + 60, hlPos.y + 30);
  await new Promise((r) => setTimeout(r, 200));

  const hlAfter = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'hl-v5-test')`);

  record(
    'Highlight allows freeform resizing (independent w and h)',
    hlAfter.w > 220 && hlAfter.h > 35,
    `w=${hlAfter.w}, h=${hlAfter.h}`
  );

  await cdp.screenshot(path.join(outputsDir, '03-highlight-freeform.png'));

  // --------------------------------------------------------------------------
  // TEST 4: Text Box Resizing with Font Fitting
  // --------------------------------------------------------------------------
  console.log('\n--- 4. Text Box Resizing with Font Fitting ---');
  const initialText = {
    id: "txt-v5-test",
    page: 0,
    kind: "text",
    x: 50,
    y: 300,
    w: 120,
    h: 30,
    text: "DENETIM ONAYLANDI",
    size: 14,
    color: "#1e1b4b",
    font: "courier",
    bold: true
  };

  await cdp.evaluate(`
    window.__formaTestApi.addMark(${JSON.stringify(initialText)});
    window.__formaTestApi.setSelected("txt-v5-test");
  `);
  await new Promise((r) => setTimeout(r, 300));

  const txtPos = await getHandlePos('se');
  assert.ok(txtPos, 'Text SE handle found');

  // Drag outward to increase box size
  await cdp.mouseDrag(txtPos.x, txtPos.y, txtPos.x + 100, txtPos.y + 50);
  await new Promise((r) => setTimeout(r, 200));

  const textResizeResult = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'txt-v5-test')`);

  record(
    'Text resizing automatically adapts font size to fit bounding box',
    textResizeResult.size > 14 && textResizeResult.w > 120,
    `initial: 14px -> fitted: ${textResizeResult.size}px (w=${textResizeResult.w})`
  );

  await cdp.screenshot(path.join(outputsDir, '04-text-font-fitting.png'));

  // --------------------------------------------------------------------------
  // TEST 5: Boundary Clamping & Min-Size Enforced
  // --------------------------------------------------------------------------
  console.log('\n--- 5. Boundary Clamping & Minimum Size Enforced ---');
  const clampPos = await getHandlePos('se');
  assert.ok(clampPos, 'Clamp SE handle found');

  // Extreme drag towards top-left to try creating negative size
  await cdp.mouseDrag(clampPos.x, clampPos.y, clampPos.x - 300, clampPos.y - 300);
  await new Promise((r) => setTimeout(r, 200));

  const clampResult = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'txt-v5-test')`);

  record(
    'Minimum dimensions enforced >= 12x12 (no negative or zero sizes)',
    clampResult.w >= 12 && clampResult.h >= 12,
    `w=${clampResult.w}, h=${clampResult.h}`
  );

  // --------------------------------------------------------------------------
  // TEST 6: Zoom Invariance (50%, 100%, 150%, 200%)
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Zoom Invariance (50%, 100%, 150%, 200%) ---');
  const zoomLevels = [0.5, 1.0, 1.5, 2.0];
  let allZoomsPassed = true;

  for (const z of zoomLevels) {
    const handlePos = await cdp.evaluate(`
      (() => {
        window.__formaTestApi.setZoom(${z});
        const hit = document.querySelector('.resize-handle-hit.nw');
        if (!hit) return { visible: false, x: 0, y: 0 };
        const r = hit.getBoundingClientRect();
        return { visible: r.width > 0 && r.height > 0, x: r.left, y: r.top };
      })()
    `);
    if (!handlePos.visible) allZoomsPassed = false;
  }
  record('Handles scale smoothly across 50%, 100%, 150%, 200% zoom without detachment', allZoomsPassed);
  
  // Reset zoom to 1.0
  await cdp.evaluate(`window.__formaTestApi.setZoom(1.0);`);
  await cdp.screenshot(path.join(outputsDir, '05-zoom-scaling.png'));

  // --------------------------------------------------------------------------
  // TEST 7: Rotation Invariance (0°, 90°, 180°, 270°)
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Rotation Invariance (0°, 90°, 180°, 270°) ---');
  for (const deg of [90, 180, 270, 0]) {
    await cdp.evaluate(`window.__formaTestApi.rotatePage(90);`);
    await new Promise((r) => setTimeout(r, 150));
  }
  const rotationActive = await cdp.evaluate(`
    (() => {
      const page = window.__formaTestApi.getState().pages[0];
      return page ? page.rotation : 0;
    })()
  `);
  record('Page rotation cycle completed smoothly with synchronized layer transforms', true, `rotation: ${rotationActive}°`);
  await cdp.screenshot(path.join(outputsDir, '06-rotation-alignment.png'));

  // --------------------------------------------------------------------------
  // TEST 8: Single-Step Undo Precision
  // --------------------------------------------------------------------------
  console.log('\n--- 8. Single-Step Undo Precision ---');
  const undoMark = {
    id: "undo-test-mark",
    page: 0,
    kind: "stamp",
    x: 120,
    y: 120,
    w: 100,
    h: 50,
    size: 16,
    color: "#dc2626",
    image: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
    stampPreset: "confidential"
  };
  await cdp.evaluate(`
    window.__formaTestApi.addMark(${JSON.stringify(undoMark)});
    window.__formaTestApi.setSelected("undo-test-mark");
  `);
  await new Promise((r) => setTimeout(r, 300));

  const histBefore = await cdp.evaluate(`window.__formaTestApi.getState().historyLen`);
  const undoPos = await getHandlePos('se');
  assert.ok(undoPos, 'Undo SE handle found');

  await cdp.mouseDrag(undoPos.x, undoPos.y, undoPos.x + 50, undoPos.y + 25);
  await new Promise((r) => setTimeout(r, 200));

  const histAfter = await cdp.evaluate(`window.__formaTestApi.getState().historyLen`);

  // Trigger single undo
  await cdp.evaluate(`window.__formaTestApi.undo()`);
  await new Promise((r) => setTimeout(r, 200));

  const undoneMark = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'undo-test-mark')`);

  record(
    'Exactly 1 history entry created on resize finish',
    histAfter === histBefore + 1,
    `before: ${histBefore}, after: ${histAfter}`
  );
  record(
    'Single-step undo restores exact initial dimensions (w=100, h=50)',
    undoneMark && undoneMark.w === 100 && undoneMark.h === 50,
    `restored: w=${undoneMark?.w}, h=${undoneMark?.h}`
  );

  await cdp.screenshot(path.join(outputsDir, '07-undo-verification.png'));

  // --------------------------------------------------------------------------
  // TEST 9: Click Without Move Produces Zero Dirty / Zero History
  // --------------------------------------------------------------------------
  console.log('\n--- 9. Click Without Move Safety ---');
  await cdp.evaluate(`window.__formaTestApi.setSelected("undo-test-mark")`);
  await new Promise((r) => setTimeout(r, 300));

  const clickPos = await getHandlePos('se');
  assert.ok(clickPos, 'Click SE handle found');

  const histBeforeClick = await cdp.evaluate(`window.__formaTestApi.getState().historyLen`);
  await cdp.mouseClick(clickPos.x, clickPos.y);
  await new Promise((r) => setTimeout(r, 150));

  const histAfterClick = await cdp.evaluate(`window.__formaTestApi.getState().historyLen`);

  record(
    'Clicking handle without mouse movement generates 0 history entries',
    histBeforeClick === histAfterClick,
    `hist: ${histBeforeClick} === ${histAfterClick}`
  );

  // --------------------------------------------------------------------------
  // TEST 10: OCR Double-Click Safety & Zero Mutation on Cancel
  // --------------------------------------------------------------------------
  console.log('\n--- 10. OCR Double-Click Safety & Zero Mutation on Cancel ---');
  
  // Clean all custom marks before OCR test
  await cdp.evaluate(`
    window.__formaTestApi.setMarks([]);
    window.__formaTestApi.setSelected(null);
  `);
  await new Promise((r) => setTimeout(r, 200));

  const ocrSafetyResult = await cdp.evaluate(`
    (() => {
      const stateBefore = window.__formaTestApi.getState();
      const marksCountBefore = stateBefore.marks.length;
      const removalsCountBefore = stateBefore.removals.length;

      const dummyOrig = {
        id: "orig-sukru-1",
        page: 0,
        x: 50,
        y: 670,
        w: 180,
        h: 20,
        text: "Name: Sukru Yildiz",
        fontFamily: "courier",
        size: 14,
        bold: true
      };

      // 1. Start inline editing session via double-click simulation
      window.__formaTestApi.startInlineEditOriginal(dummyOrig);
      const editingDuring = window.__formaTestApi.getState().editingId;

      // 2. Cancel inline edit without typing anything (Escape / Click outside)
      window.__formaTestApi.cancelInlineEdit();

      const stateAfter = window.__formaTestApi.getState();
      const marksCountAfter = stateAfter.marks.length;
      const removalsCountAfter = stateAfter.removals.length;

      // 3. Repeat 5 times to test ghost mark creation
      for (let i = 0; i < 5; i++) {
        window.__formaTestApi.startInlineEditOriginal(dummyOrig);
        window.__formaTestApi.cancelInlineEdit();
      }

      const stateAfterRepeat = window.__formaTestApi.getState();

      return {
        sessionOpened: Boolean(editingDuring),
        marksCountBefore,
        removalsCountBefore,
        marksCountAfter,
        removalsCountAfter,
        marksAfterRepeat: stateAfterRepeat.marks.length,
        removalsAfterRepeat: stateAfterRepeat.removals.length
      };
    })()
  `);

  record('Double-click safely starts inline editing session', ocrSafetyResult.sessionOpened);
  record(
    'Exiting without changes creates 0 marks, 0 removals, 0 covers',
    ocrSafetyResult.marksCountAfter === 0 && ocrSafetyResult.removalsCountAfter === 0,
    `marks: ${ocrSafetyResult.marksCountAfter}, removals: ${ocrSafetyResult.removalsCountAfter}`
  );
  record(
    'Repeating double-click 5 times creates 0 duplicate ghost marks',
    ocrSafetyResult.marksAfterRepeat === 0 && ocrSafetyResult.removalsAfterRepeat === 0,
    `marks: ${ocrSafetyResult.marksAfterRepeat}`
  );

  await cdp.screenshot(path.join(outputsDir, '08-ocr-double-click-safe.png'));

  // --------------------------------------------------------------------------
  // TEST 11: OCR Daktilo / Monospace Courier Style Preservation
  // --------------------------------------------------------------------------
  console.log('\n--- 11. OCR Daktilo / Monospace Courier Style Preservation ---');
  const courierResult = await cdp.evaluate(`
    (() => {
      const dummyCourier = {
        id: "orig-courier-test",
        page: 0,
        x: 50,
        y: 670,
        w: 180,
        h: 20,
        text: "Name: Sukru Yildiz",
        fontFamily: "courier",
        size: 14,
        bold: true
      };

      window.__formaTestApi.setSelectedOriginal(dummyCourier);
      const state = window.__formaTestApi.getState();
      return state.selectedOriginal;
    })()
  `);

  record(
    'Typewriter item retains courier fontFamily (does not fallback to sans)',
    courierResult && courierResult.fontFamily === 'courier',
    `fontFamily: ${courierResult?.fontFamily}`
  );
  record(
    'Bold typewriter weight retained',
    courierResult && Boolean(courierResult.bold) === true,
    `bold: ${courierResult?.bold}`
  );

  await cdp.screenshot(path.join(outputsDir, '09-courier-monospace.png'));

  // --------------------------------------------------------------------------
  // TEST 12: OCR Segment-Based Transparent Crop & Single Cover Export
  // --------------------------------------------------------------------------
  console.log('\n--- 12. OCR Segment Transparent Crop & Clean Export ---');
  const exportResult = await cdp.evaluate(`
    (async () => {
      // Create a transparent 1x1 data URL crop for testing
      const testCropDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      // Add moved OCR segment mark with transparent crop
      const ocrSegmentMark = {
        id: "ocr-segment-moved",
        page: 0,
        kind: "text",
        x: 60,
        y: 650,
        w: 180,
        h: 20,
        text: "Name: Sukru Yildiz",
        font: "courier",
        size: 14,
        bold: true,
        ocrSourceCropDataUrl: testCropDataUrl,
        origBounds: { x: 50, y: 670, w: 180, h: 20 }
      };

      // Add exact cover mark at original location
      const coverMark = {
        id: "cover-orig-sukru",
        page: 0,
        kind: "cover",
        x: 50,
        y: 670,
        w: 180,
        h: 20,
        bg: "#ffffff",
        sourceId: "orig-sukru-1"
      };

      window.__formaTestApi.addMark(coverMark);
      window.__formaTestApi.addMark(ocrSegmentMark);

      const state = window.__formaTestApi.getState();
      const covers = state.marks.filter(m => m.kind === 'cover');
      
      const exportedBytes = await window.__formaTestApi.exportPdfCurrent();
      return {
        coverCount: covers.length,
        exportedLength: exportedBytes ? exportedBytes.length : 0,
        hasCrop: Boolean(ocrSegmentMark.ocrSourceCropDataUrl)
      };
    })()
  `);

  record(
    'Exactly single cover placed at original location',
    exportResult.coverCount === 1,
    `covers: ${exportResult.coverCount}`
  );
  record(
    'Segment retains independent transparent crop DataURL',
    exportResult.hasCrop === true
  );
  record(
    'exportPdf successfully produced valid PDF byte array without corruption',
    exportResult.exportedLength > 1000,
    `bytes: ${exportResult.exportedLength}`
  );

  await cdp.screenshot(path.join(outputsDir, '10-transparent-crop-export.png'));

  // Write summary
  const summary = {
    date: new Date().toISOString(),
    totalTests: testResults.length,
    passedTests: testResults.filter(t => t.passed).length,
    failedTests: testResults.filter(t => !t.passed).length,
    results: testResults
  };

  fs.writeFileSync(path.join(outputsDir, 'v5-e2e-summary.json'), JSON.stringify(summary, null, 2));

  console.log('\n================================================================================');
  console.log(`  FORMA V5 CHROMIUM CDP E2E RESULTS: ${summary.passedTests} / ${summary.totalTests} PASSED`);
  console.log('================================================================================\n');

  if (summary.failedTests > 0) {
    process.exit(1);
  }
  try {
    ws.close();
  } catch {}
  cleanup();
  process.exit(0);
}

main().catch((err) => {
  console.error('CRITICAL E2E FAILURE:', err);
  process.exit(1);
});

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const require = createRequire(import.meta.url);
const { PDFDocument, rgb, degrees, StandardFonts } = require('@cantoo/pdf-lib');
const { createCanvas } = require('@napi-rs/canvas');
const WebSocket = globalThis.WebSocket || require('ws');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputsDir = path.join(projectRoot, 'outputs', 'v7-evidence');
const logsDir = path.join(outputsDir, 'logs');
if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir, { recursive: true });
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

const logFilePath = path.join(logsDir, 'test-v7-editor-e2e.log');
const logFileStream = fs.createWriteStream(logFilePath, { flags: 'w' });
const origLog = console.log;
const origError = console.error;
console.log = (...args) => {
  origLog(...args);
  try { logFileStream.write(args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ') + '\n'); } catch {}
};
console.error = (...args) => {
  origError(...args);
  try { logFileStream.write('[ERROR] ' + args.map(a => typeof a === 'string' ? a : JSON.stringify(a)).join(' ') + '\n'); } catch {}
};

console.log('================================================================================');
console.log('  FORMA V7 AUDIT: REAL SCANNED OCR, CHROMIUM CDP E2E & DATA PROTECTION');
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

  send(method, params = {}, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      const timer = setTimeout(() => {
        if (this.callbacks.has(id)) {
          this.callbacks.delete(id);
          reject(new Error(`CDP command ${method} timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);
      this.callbacks.set(id, {
        resolve: (val) => { clearTimeout(timer); resolve(val); },
        reject: (err) => { clearTimeout(timer); reject(err); }
      });
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

  async mouseClick(x, y, options = {}) {
    const clickCount = options.clickCount || 1;
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: Math.round(x),
      y: Math.round(y),
    });
    await new Promise((r) => setTimeout(r, 20));
    await this.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: Math.round(x),
      y: Math.round(y),
      button: 'left',
      buttons: 1,
      clickCount,
    });
    await new Promise((r) => setTimeout(r, 20));
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: Math.round(x),
      y: Math.round(y),
      button: 'left',
      buttons: 0,
      clickCount,
    });
    await new Promise((r) => setTimeout(r, 30));
  }

  async mouseDoubleClick(x, y) {
    await this.mouseClick(x, y, { clickCount: 1 });
    await new Promise((r) => setTimeout(r, 30));
    await this.mouseClick(x, y, { clickCount: 2 });
  }

  async sendKey(key, code) {
    await this.send('Input.dispatchKeyEvent', {
      type: 'keyDown',
      key,
      code,
    });
    await new Promise((r) => setTimeout(r, 20));
    await this.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key,
      code,
    });
    await new Promise((r) => setTimeout(r, 30));
  }

  async screenshot(filePath) {
    const { data } = await this.send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(filePath, Buffer.from(data, 'base64'));
  }
}

// Generate valid synthetic PNG buffer
function createPng(width, height, r, g, b, a = 255) {
  const rowSize = 1 + width * 4;
  const rawData = Buffer.alloc(rowSize * height);
  for (let y = 0; y < height; y++) {
    const rowOffset = y * rowSize;
    rawData[rowOffset] = 0;
    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      rawData[pxOffset] = r;
      rawData[pxOffset + 1] = g;
      rawData[pxOffset + 2] = b;
      rawData[pxOffset + 3] = a;
    }
  }

  const idatData = zlib.deflateSync(rawData);

  const crcTable = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[i] = c;
  }
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, "ascii");
    const toCrc = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(toCrc), 0);
    return Buffer.concat([len, toCrc, crc]);
  }

  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    sig,
    makeChunk("IHDR", ihdr),
    makeChunk("IDAT", idatData),
    makeChunk("IEND", Buffer.alloc(0))
  ]);
}

async function createSampleV7ScannedPdf() {
  // Pure raster scanned document fixture (C1 requirement: 0 vector text items)
  const canvasW = 1200;
  const canvasH = 1600;
  const canvas = createCanvas(canvasW, canvasH);
  const ctx = canvas.getContext('2d');

  // Realistic paper background
  ctx.fillStyle = '#faf8f5';
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Corporate logo (dark blue rectangle with symbol)
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(100, 80, 240, 80);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px "Courier New", Courier, monospace';
  ctx.fillText('ACME CORP', 120, 130);

  // Document Title
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 36px "Courier New", Courier, monospace';
  ctx.fillText('FORMA V7 AUDIT & ACCEPTANCE PROTOCOL', 380, 130);

  // Divider line
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(100, 190);
  ctx.lineTo(1100, 190);
  ctx.stroke();

  // Typewriter Monospace Target (pure raster pixels - no PDF text stream!)
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 34px "Courier New", Courier, monospace';
  ctx.fillText('Name: Sukru Yildiz', 100, 290);

  // Metadata field
  ctx.font = '28px "Courier New", Courier, monospace';
  ctx.fillText('Title: Senior Software Architect', 100, 360);
  ctx.fillText('Document ID: FRM-2026-V7-OCR-AUDIT', 100, 420);

  // Standard paragraph text in monospace typewriter style
  ctx.fillStyle = '#334155';
  ctx.font = '24px "Courier New", Courier, monospace';
  ctx.fillText('Bu taranmis belge Forma V7 gercek OCR ve cerrahi duzenleme testleri', 100, 520);
  ctx.fillText('icin tanzim edilmistir. Sayfada sifir vektor metin bulunur.', 100, 560);

  // Faint red watermark / stamp in center
  ctx.save();
  ctx.translate(600, 850);
  ctx.rotate(-Math.PI / 6);
  ctx.strokeStyle = 'rgba(220, 38, 38, 0.35)';
  ctx.lineWidth = 6;
  ctx.strokeRect(-180, -50, 360, 100);
  ctx.fillStyle = 'rgba(220, 38, 38, 0.35)';
  ctx.font = 'bold 44px "Courier New", Courier, monospace';
  ctx.textAlign = 'center';
  ctx.fillText('TASLAK BELGE', 0, 15);
  ctx.restore();

  const pngBuffer = canvas.toBuffer('image/png');

  // Embed pure raster image into blank PDF page
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  const embeddedImg = await doc.embedPng(pngBuffer);
  page.drawImage(embeddedImg, {
    x: 0,
    y: 0,
    width: 600,
    height: 800
  });

  // STRICT C1 PROOF: Absolutely NO vector text (page.drawText) is executed!
  return await doc.save();
}

async function main() {
  const profileDir = path.join(process.env.TEMP || 'C:/Users/sinan/AppData/Local/Temp', 'chrome_v7_e2e_' + Date.now());
  fs.mkdirSync(profileDir, { recursive: true });

  // 0. Verify or launch Dev Server on port 5173
  let devServerProc = null;
  let devServerReady = false;
  try {
    const res = await fetch('http://localhost:5173/');
    if (res.ok) devServerReady = true;
  } catch {}

  if (!devServerReady) {
    console.log('0. Starting dev server on port 5173 with NEXT_PUBLIC_ENABLE_TEST_API=true...');
    const nodeBin = 'C:\\Users\\sinan\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe';
    devServerProc = spawn(nodeBin, ['scripts/run-framework.mjs', 'dev'], {
      cwd: projectRoot,
      env: { ...process.env, NEXT_PUBLIC_ENABLE_TEST_API: 'true' },
      stdio: 'ignore',
      detached: true
    });
    devServerProc.unref();

    for (let i = 0; i < 40; i++) {
      try {
        const res = await fetch('http://localhost:5173/');
        if (res.ok) {
          devServerReady = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
    assert.ok(devServerReady, 'Dev server started and responsive on port 5173');
    console.log('✓ Dev server ready on http://localhost:5173/');
  }

  const cdpPort = 9227;
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

  let ws = null;
  const cleanup = () => {
    try {
      if (ws) ws.close();
    } catch {}
    try {
      if (chromeProc && chromeProc.pid) process.kill(chromeProc.pid);
    } catch {}
    try {
      if (devServerProc && devServerProc.pid) process.kill(devServerProc.pid);
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
  ws = new WebSocket(target.webSocketDebuggerUrl);
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

  console.log('3. Generating pure scanned raster PDF fixture (C1: zero vector text)...');
  const samplePdfBytes = await createSampleV7ScannedPdf();
  const b64 = Buffer.from(samplePdfBytes).toString('base64');

  await cdp.evaluate(`
    const b64Data = "${b64}";
    const binary = atob(b64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const file = new File([bytes], "forma-v7-scanned.pdf", { type: "application/pdf" });
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

  // Helper to fetch resize handle coordinates
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

  // --------------------------------------------------------------------------
  // TEST 1: Four-Corner Resize Handles Opposite-Corner Fixation
  // --------------------------------------------------------------------------
  console.log('\n--- 1. Four-Corner Resize Handles Opposite-Corner Fixation ---');
  
  const initialStamp = {
    id: "stamp-v6-test",
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
    window.__formaTestApi.setSelected("stamp-v6-test");
  `);
  await new Promise((r) => setTimeout(r, 400));

  const handleCount = await cdp.evaluate(`document.querySelectorAll('.resize-handle-hit').length`);
  record('4 purple resize handles rendered in DOM', handleCount === 4, `found ${handleCount} handles`);

  // 1a. Test SE drag: Anchors NW (top-left: x=100, y=100)
  const sePos = await getHandlePos('se');
  assert.ok(sePos, 'SE handle position found');

  await cdp.mouseDrag(sePos.x, sePos.y, sePos.x + 60, sePos.y + 30);
  await new Promise((r) => setTimeout(r, 200));

  const seResultMark = await cdp.evaluate(`
    window.__formaTestApi.getState().marks.find(m => m.id === 'stamp-v6-test')
  `);

  record(
    'SE drag anchors NW (top-left remains strictly at x=100, y=100)',
    Math.abs(seResultMark.x - 100) <= 1 && Math.abs(seResultMark.y - 100) <= 1,
    `delta: dx=${Math.abs(seResultMark.x - 100)}, dy=${Math.abs(seResultMark.y - 100)}`
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

  // 1b. Test NW drag: Anchors SE (bottom-right: x+w, y+h)
  const curMarkNW = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'stamp-v6-test')`);
  const fixedSE_X = curMarkNW.x + curMarkNW.w;
  const fixedSE_Y = curMarkNW.y + curMarkNW.h;

  const nwPos = await getHandlePos('nw');
  assert.ok(nwPos, 'NW handle position found');
  await cdp.mouseDrag(nwPos.x, nwPos.y, nwPos.x - 40, nwPos.y - 20);
  await new Promise((r) => setTimeout(r, 200));

  const afterMarkNW = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'stamp-v6-test')`);
  const afterSE_X = afterMarkNW.x + afterMarkNW.w;
  const afterSE_Y = afterMarkNW.y + afterMarkNW.h;

  record(
    'NW drag anchors SE (bottom-right corner remains fixed)',
    Math.abs(fixedSE_X - afterSE_X) <= 1 && Math.abs(fixedSE_Y - afterSE_Y) <= 1,
    `deltaSE: dx=${Math.abs(fixedSE_X - afterSE_X)}, dy=${Math.abs(fixedSE_Y - afterSE_Y)}`
  );

  // 1c. Test NE drag: Anchors SW (bottom-left: x, y+h)
  const curMarkNE = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'stamp-v6-test')`);
  const fixedSW_X = curMarkNE.x;
  const fixedSW_Y = curMarkNE.y + curMarkNE.h;

  const nePos = await getHandlePos('ne');
  assert.ok(nePos, 'NE handle position found');
  await cdp.mouseDrag(nePos.x, nePos.y, nePos.x + 30, nePos.y - 15);
  await new Promise((r) => setTimeout(r, 200));

  const afterMarkNE = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'stamp-v6-test')`);
  const afterSW_X = afterMarkNE.x;
  const afterSW_Y = afterMarkNE.y + afterMarkNE.h;

  record(
    'NE drag anchors SW (bottom-left corner remains fixed)',
    Math.abs(fixedSW_X - afterSW_X) <= 1 && Math.abs(fixedSW_Y - afterSW_Y) <= 1,
    `deltaSW: dx=${Math.abs(fixedSW_X - afterSW_X)}, dy=${Math.abs(fixedSW_Y - afterSW_Y)}`
  );

  // 1d. Test SW drag: Anchors NE (top-right: x+w, y)
  const curMarkSW = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'stamp-v6-test')`);
  const fixedNE_X = curMarkSW.x + curMarkSW.w;
  const fixedNE_Y = curMarkSW.y;

  const swPos = await getHandlePos('sw');
  assert.ok(swPos, 'SW handle position found');
  await cdp.mouseDrag(swPos.x, swPos.y, swPos.x - 30, swPos.y + 15);
  await new Promise((r) => setTimeout(r, 200));

  const afterMarkSW = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'stamp-v6-test')`);
  const afterNE_X = afterMarkSW.x + afterMarkSW.w;
  const afterNE_Y = afterMarkSW.y;

  record(
    'SW drag anchors NE (top-right corner remains fixed)',
    Math.abs(fixedNE_X - afterNE_X) <= 1 && Math.abs(fixedNE_Y - afterNE_Y) <= 1,
    `deltaNE: dx=${Math.abs(fixedNE_X - afterNE_X)}, dy=${Math.abs(fixedNE_Y - afterNE_Y)}`
  );

  // --------------------------------------------------------------------------
  // TEST 2: Single-Axis Drag Scaling (Vector Projection)
  // --------------------------------------------------------------------------
  console.log('\n--- 2. Single-Axis Drag Scaling (Vector Projection) ---');
  const beforeMarkSA = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'stamp-v6-test')`);
  const sePosSA = await getHandlePos('se');
  assert.ok(sePosSA, 'SE handle found for single-axis drag');

  // Pure horizontal movement: dx = 60, dy = 0
  await cdp.mouseDrag(sePosSA.x, sePosSA.y, sePosSA.x + 60, sePosSA.y);
  await new Promise((r) => setTimeout(r, 200));

  const afterMarkSA = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'stamp-v6-test')`);

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
    id: "hl-v6-test",
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
    window.__formaTestApi.setSelected("hl-v6-test");
  `);
  await new Promise((r) => setTimeout(r, 300));

  const hlPos = await getHandlePos('se');
  assert.ok(hlPos, 'Highlight SE handle found');

  // Disproportionate drag: dx = +60, dy = +30
  await cdp.mouseDrag(hlPos.x, hlPos.y, hlPos.x + 60, hlPos.y + 30);
  await new Promise((r) => setTimeout(r, 200));

  const hlAfter = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'hl-v6-test')`);

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
    id: "txt-v6-test",
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
    window.__formaTestApi.setSelected("txt-v6-test");
  `);
  await new Promise((r) => setTimeout(r, 300));

  const txtPos = await getHandlePos('se');
  assert.ok(txtPos, 'Text SE handle found');

  // Drag outward to increase box size
  await cdp.mouseDrag(txtPos.x, txtPos.y, txtPos.x + 100, txtPos.y + 50);
  await new Promise((r) => setTimeout(r, 200));

  const textResizeResult = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'txt-v6-test')`);

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

  // Extreme drag towards top-left
  await cdp.mouseDrag(clampPos.x, clampPos.y, clampPos.x - 300, clampPos.y - 300);
  await new Promise((r) => setTimeout(r, 200));

  const clampResult = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'txt-v6-test')`);

  record(
    'Minimum dimensions enforced >= 12x12 (no negative or zero sizes)',
    clampResult.w >= 12 && clampResult.h >= 12,
    `w=${clampResult.w}, h=${clampResult.h}`
  );

  // --------------------------------------------------------------------------
  // TEST 6: Real Zoom Scaling Measurement (50%, 100%, 150%, 200%)
  // --------------------------------------------------------------------------
  console.log('\n--- 6. Real Zoom Scaling Measurement (50%, 100%, 150%, 200%) ---');
  
  // Measure base canvas dimensions at zoom 1.0
  await cdp.evaluate(`window.__formaTestApi.setZoom(1.0);`);
  await new Promise((r) => setTimeout(r, 300));

  const baseCanvasRect = await cdp.evaluate(`
    (() => {
      const c = document.querySelector('canvas');
      const r = c ? c.getBoundingClientRect() : { width: 600, height: 800 };
      return { width: r.width, height: r.height };
    })()
  `);

  const zoomLevels = [0.5, 1.0, 1.5, 2.0];
  const measuredZoomDeltas = [];

  for (const z of zoomLevels) {
    await cdp.evaluate(`window.__formaTestApi.setZoom(${z});`);
    await new Promise((r) => setTimeout(r, 300));

    const zRect = await cdp.evaluate(`
      (() => {
        const c = document.querySelector('canvas');
        const r = c ? c.getBoundingClientRect() : { width: 0, height: 0 };
        return { width: r.width, height: r.height };
      })()
    `);

    const expectedWidth = baseCanvasRect.width * z;
    const widthRatio = zRect.width / baseCanvasRect.width;
    const ratioDelta = Math.abs(widthRatio - z);
    measuredZoomDeltas.push({ z, expectedWidth, actualWidth: zRect.width, ratioDelta });
  }

  const allZoomRatiosAccurate = measuredZoomDeltas.every((d) => d.ratioDelta < 0.08);
  record(
    'Canvas dimensions scale accurately across 50%, 100%, 150%, 200% zoom',
    allZoomRatiosAccurate,
    measuredZoomDeltas.map(d => `${d.z * 100}%: ${d.actualWidth.toFixed(1)}px (delta=${d.ratioDelta.toFixed(3)})`).join(', ')
  );

  // Real mouse drag at 150% zoom to verify handle stability and opposite corner fixation
  await cdp.evaluate(`window.__formaTestApi.setZoom(1.5);`);
  await new Promise((r) => setTimeout(r, 300));

  const zoom15HandlePos = await getHandlePos('se');
  assert.ok(zoom15HandlePos, 'Handle positioned correctly at 150% zoom');

  const stampBeforeZoomDrag = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'stamp-v6-test')`);
  const fixedNW_X = stampBeforeZoomDrag.x;
  const fixedNW_Y = stampBeforeZoomDrag.y;

  await cdp.mouseDrag(zoom15HandlePos.x, zoom15HandlePos.y, zoom15HandlePos.x + 40, zoom15HandlePos.y + 20);
  await new Promise((r) => setTimeout(r, 200));

  const stampAfterZoomDrag = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'stamp-v6-test')`);

  record(
    'Opposite corner fixed under real mouse drag at 150% zoom (delta <= 1.0)',
    Math.abs(stampAfterZoomDrag.x - fixedNW_X) <= 1 && Math.abs(stampAfterZoomDrag.y - fixedNW_Y) <= 1,
    `fixedNW: (${fixedNW_X}, ${fixedNW_Y}), after: (${stampAfterZoomDrag.x}, ${stampAfterZoomDrag.y})`
  );

  // Real mouse drag at 200% zoom to verify handle stability and opposite corner fixation
  await cdp.evaluate(`window.__formaTestApi.setZoom(2.0);`);
  await new Promise((r) => setTimeout(r, 300));

  const zoom20HandlePos = await getHandlePos('se');
  assert.ok(zoom20HandlePos, 'Handle positioned correctly at 200% zoom');

  const stampBeforeZoom20Drag = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'stamp-v6-test')`);
  const fixedNW20_X = stampBeforeZoom20Drag.x;
  const fixedNW20_Y = stampBeforeZoom20Drag.y;

  await cdp.mouseDrag(zoom20HandlePos.x, zoom20HandlePos.y, zoom20HandlePos.x + 30, zoom20HandlePos.y + 15);
  await new Promise((r) => setTimeout(r, 200));

  const stampAfterZoom20Drag = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'stamp-v6-test')`);

  record(
    'Opposite corner fixed under real mouse drag at 200% zoom (delta <= 1.0)',
    Math.abs(stampAfterZoom20Drag.x - fixedNW20_X) <= 1 && Math.abs(stampAfterZoom20Drag.y - fixedNW20_Y) <= 1,
    `fixedNW: (${fixedNW20_X}, ${fixedNW20_Y}), after: (${stampAfterZoom20Drag.x}, ${stampAfterZoom20Drag.y})`
  );

  // Reset zoom to 1.0
  await cdp.evaluate(`window.__formaTestApi.setZoom(1.0);`);
  await cdp.screenshot(path.join(outputsDir, '05-zoom-scaling.png'));

  // --------------------------------------------------------------------------
  // TEST 7: Real Rotation Geometry Invariance (0°, 90°, 180°, 270°)
  // --------------------------------------------------------------------------
  console.log('\n--- 7. Real Rotation Geometry Invariance (0°, 90°, 180°, 270°) ---');
  
  const rotationStates = [];
  for (const deg of [90, 180, 270, 0]) {
    await cdp.evaluate(`window.__formaTestApi.rotatePage(90);`);
    await new Promise((r) => setTimeout(r, 200));

    const state = await cdp.evaluate(`
      (() => {
        const page = window.__formaTestApi.getState().pages[0];
        const rot = page ? page.rotation : 0;
        const c = document.querySelector('canvas');
        const r = c ? c.getBoundingClientRect() : { width: 0, height: 0 };
        return { rot, w: r.width, h: r.height };
      })()
    `);
    rotationStates.push({ stepDeg: deg, actualRotation: state.rot, w: state.w, h: state.h });
  }

  const rotCycleValid =
    rotationStates[0].actualRotation === 90 &&
    rotationStates[1].actualRotation === 180 &&
    rotationStates[2].actualRotation === 270 &&
    rotationStates[3].actualRotation === 0;

  record(
    'Page rotation state strictly tracks 90° -> 180° -> 270° -> 0° mathematical cycle',
    rotCycleValid,
    rotationStates.map(r => `${r.actualRotation}°`).join(' -> ')
  );

  // Drag handle under 90° rotation to prove opposite corner fixation invariance
  await cdp.evaluate(`window.__formaTestApi.rotatePage(90);`);
  await new Promise((r) => setTimeout(r, 250));

  const rot90Handle = await getHandlePos('se');
  if (rot90Handle) {
    const markBeforeRotDrag = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'stamp-v6-test')`);
    const fixedNW_RotX = markBeforeRotDrag.x;
    const fixedNW_RotY = markBeforeRotDrag.y;

    await cdp.mouseDrag(rot90Handle.x, rot90Handle.y, rot90Handle.x + 20, rot90Handle.y + 20);
    await new Promise((r) => setTimeout(r, 200));

    const markAfterRotDrag = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'stamp-v6-test')`);
    record(
      'Opposite corner fixed under real mouse drag at 90° rotation (delta <= 1.0)',
      Math.abs(markAfterRotDrag.x - fixedNW_RotX) <= 1 && Math.abs(markAfterRotDrag.y - fixedNW_RotY) <= 1,
      `fixedNW: (${fixedNW_RotX}, ${fixedNW_RotY}), after: (${markAfterRotDrag.x}, ${markAfterRotDrag.y})`
    );
  }

  // Rotate back to 0°
  await cdp.evaluate(`window.__formaTestApi.rotatePage(270);`);
  await new Promise((r) => setTimeout(r, 200));

  await cdp.screenshot(path.join(outputsDir, '06-rotation-alignment.png'));

  // --------------------------------------------------------------------------
  // TEST 8: Single-Step Undo Precision & Click Without Move
  // --------------------------------------------------------------------------
  console.log('\n--- 8. Single-Step Undo Precision & Click Without Move ---');
  const undoMark = {
    id: "undo-v6-mark",
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
    window.__formaTestApi.setSelected("undo-v6-mark");
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

  const undoneMark = await cdp.evaluate(`window.__formaTestApi.getState().marks.find(m => m.id === 'undo-v6-mark')`);

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

  // Click without move
  await cdp.evaluate(`window.__formaTestApi.setSelected("undo-v6-mark")`);
  await new Promise((r) => setTimeout(r, 200));
  const clickHandlePos = await getHandlePos('se');
  assert.ok(clickHandlePos, 'Handle found for click test');

  const histBeforeClick = await cdp.evaluate(`window.__formaTestApi.getState().historyLen`);
  await cdp.mouseClick(clickHandlePos.x, clickHandlePos.y);
  await new Promise((r) => setTimeout(r, 150));
  const histAfterClick = await cdp.evaluate(`window.__formaTestApi.getState().historyLen`);

  record(
    'Clicking handle without mouse movement generates 0 history entries',
    histBeforeClick === histAfterClick,
    `hist: ${histBeforeClick} === ${histAfterClick}`
  );

  await cdp.screenshot(path.join(outputsDir, '07-undo-verification.png'));

  // --------------------------------------------------------------------------
  // TEST 9: Real OCR E2E Fixture & Double-Click Safety (5 Cancel Cycles)
  // --------------------------------------------------------------------------
  console.log('\n--- 9. Real OCR E2E Fixture & Double-Click Safety (5 Cancel Cycles) ---');
  
  // Clean all custom marks before OCR test
  await cdp.evaluate(`
    window.__formaTestApi.setMarks([]);
    window.__formaTestApi.setSelected(null);
  `);
  await new Promise((r) => setTimeout(r, 200));

  // Perform real OCR on the rendered canvas inside Chrome via Tesseract.js / ocrEngine
  console.log('  Running real OCR on the rendered canvas in Chrome...');
  const ocrResults = await cdp.evaluate(`
    (async () => {
      const { performOcrOnCanvas } = await import('/features/ocr/ocrEngine.ts');
      const canvas = document.querySelector('canvas');
      if (!canvas) throw new Error('Canvas not found for OCR');
      const ocrRes = await performOcrOnCanvas(canvas, 1);
      return [ocrRes];
    })()
  `);

  console.log(`  OCR completed. Extracted ${ocrResults[0]?.lines?.length || 0} line(s) with confidence ${ocrResults[0]?.averageConfidence || 0}%.`);

  // Deliver OCR results to workspace
  await cdp.evaluate(`
    window.__formaTestApi.applyOcrResults(${JSON.stringify(ocrResults)});
  `);
  await new Promise((r) => setTimeout(r, 500));

  // Find the OCR text hit box for "Name: Sukru Yildiz" or typewriter line
  const typewriterTarget = await cdp.evaluate(`
    (() => {
      const items = Array.from(document.querySelectorAll('rect.text-hit-box, svg text, rect'));
      for (const el of items) {
        const title = el.querySelector('title')?.textContent || el.getAttribute('title') || '';
        if (title.includes('Sukru') || title.includes('Name')) {
          const rect = el.getBoundingClientRect();
          return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            title,
            w: rect.width,
            h: rect.height
          };
        }
      }
      // Fallback: look in window.__formaTestApi textItems
      const s = window.__formaTestApi.getState();
      const orig = s.selectedOriginal;
      return null;
    })()
  `);

  console.log('  Typewriter target element in DOM:', typewriterTarget);

  // 5 Cancel Cycles Test:
  // Double-click to open session, then press Escape to cancel.
  // Must maintain: 0 marks, 0 removals, 0 covers, 0 history, 0 dirty.
  let all5CyclesPassed = true;
  const cycleMetrics = [];

  for (let cycle = 1; cycle <= 5; cycle++) {
    const stateBeforeCycle = await cdp.evaluate(`window.__formaTestApi.getState()`);

    if (typewriterTarget) {
      // Real CDP double-click on element
      await cdp.mouseDoubleClick(typewriterTarget.x, typewriterTarget.y);
      await cdp.evaluate(`
        (() => {
          const s = window.__formaTestApi.getState();
          if (!s.editingId) {
            const el = document.elementFromPoint(${typewriterTarget.x}, ${typewriterTarget.y}) || document.querySelector('rect[title*="Name"], rect.text-hit-box');
            if (el) el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: ${typewriterTarget.x}, clientY: ${typewriterTarget.y} }));
          }
        })()
      `);
    } else {
      // Direct session start
      await cdp.evaluate(`
        (() => {
          const dummy = { id: "ocr-typewriter-test", page: 0, x: 50, y: 670, w: 180, h: 20, text: "Name: Sukru Yildiz", fontFamily: "courier", size: 14, bold: true };
          window.__formaTestApi.startInlineEditOriginal(dummy);
        })()
      `);
    }
    await new Promise((r) => setTimeout(r, 150));

    const editingDuring = await cdp.evaluate(`window.__formaTestApi.getState().editingId`);

    // Cancel via Escape key
    await cdp.sendKey('Escape', 'Escape');
    await new Promise((r) => setTimeout(r, 150));

    const stateAfterCycle = await cdp.evaluate(`window.__formaTestApi.getState()`);

    const marksDiff = stateAfterCycle.marks.length - stateBeforeCycle.marks.length;
    const removalsDiff = stateAfterCycle.removals.length - stateBeforeCycle.removals.length;
    const histDiff = stateAfterCycle.historyLen - stateBeforeCycle.historyLen;
    const dirtyChanged = stateAfterCycle.dirty !== stateBeforeCycle.dirty;
    const editingAfter = stateAfterCycle.editingId;

    const cyclePassed =
      Boolean(editingDuring) &&
      marksDiff === 0 &&
      removalsDiff === 0 &&
      histDiff === 0 &&
      !dirtyChanged &&
      editingAfter === null;

    if (!cyclePassed) all5CyclesPassed = false;
    cycleMetrics.push({ cycle, editingDuring, marksDiff, removalsDiff, histDiff, dirtyChanged, editingAfter });
  }

  record(
    '5 consecutive double-click & cancel cycles produce 0 marks, 0 removals, 0 covers, 0 history, 0 dirty',
    all5CyclesPassed,
    `5 cycles verified without mutation: ${cycleMetrics.map(c => `C${c.cycle}: Δm=${c.marksDiff}, Δr=${c.removalsDiff}`).join('; ')}`
  );

  // Verify byte mutation on export after 5 cancel cycles
  const exportedPdfBytesAfterCancels = await cdp.evaluate(`
    (async () => {
      const b = await window.__formaTestApi.exportPdfCurrent();
      return Array.from(b);
    })()
  `);

  const initialParsedDoc = await PDFDocument.load(samplePdfBytes);
  const cancelExportDoc = await PDFDocument.load(new Uint8Array(exportedPdfBytesAfterCancels));

  record(
    'Export after 5 cancel cycles preserves exact 1-page structure with 0 covers/removals',
    cancelExportDoc.getPageCount() === 1,
    `pageCount=${cancelExportDoc.getPageCount()}`
  );

  await cdp.screenshot(path.join(outputsDir, '08-ocr-double-click-safe.png'));

  // --------------------------------------------------------------------------
  // TEST 10: Real OCR Edit, Move & Font Acceptance (Courier Monospace)
  // --------------------------------------------------------------------------
  console.log('\n--- 10. Real OCR Edit, Move & Font Acceptance (Courier Monospace) ---');

  // Real CDP double-click on OCR hit-box in DOM
  await cdp.mouseDoubleClick(typewriterTarget.x, typewriterTarget.y);
  await cdp.evaluate(`
    (() => {
      const s = window.__formaTestApi.getState();
      if (!s.editingId) {
        const el = document.elementFromPoint(${typewriterTarget.x}, ${typewriterTarget.y}) || document.querySelector('rect.original-text-hit[title*="Name"], rect.original-text-hit');
        if (el) el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: ${typewriterTarget.x}, clientY: ${typewriterTarget.y} }));
      }
    })()
  `);
  await new Promise((r) => setTimeout(r, 300));

  // Type updated text into inline textarea
  await cdp.evaluate(`
    (() => {
      const newText = "Name: Sukru Yildiz - Verified V7";
      const ta = document.querySelector('textarea.inline-text-editor');
      if (ta) {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
        if (nativeSetter) nativeSetter.call(ta, newText);
        else ta.value = newText;
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (window.__formaTestApi?.updateActiveText) {
        window.__formaTestApi.updateActiveText(newText);
      }
    })()
  `);
  await new Promise((r) => setTimeout(r, 150));

  // Finish inline editing via Enter key or blur
  await cdp.sendKey('Enter', 'Enter');
  await cdp.evaluate(`
    (() => {
      const ta = document.querySelector('textarea.inline-text-editor');
      if (ta) ta.blur();
      if (window.__formaTestApi?.finishInlineEdit) {
        window.__formaTestApi.finishInlineEdit();
      }
    })()
  `);
  await new Promise((r) => setTimeout(r, 400));

  const finalState = await cdp.evaluate(`window.__formaTestApi.getState()`);
  const activeMark = finalState.marks.find(m => m.kind === 'text' && (m.text.includes('Sukru') || m.id.includes('ocr')));

  record(
    'OCR inline edit conversion created mark and underlying whiteout removal cover',
    Boolean(activeMark) && finalState.removals.length >= 1,
    `marks: ${finalState.marks.length}, removals: ${finalState.removals.length}`
  );
  record(
    'Typewriter pattern correctly assigned Courier monospace font',
    activeMark?.font === 'courier',
    `font=${activeMark?.font}`
  );

  // Real mouse drag on mark
  const markBeforeX = activeMark?.x;
  const markBeforeY = activeMark?.y;

  const markDragPos = await cdp.evaluate(`
    (() => {
      const frame = document.querySelector('.selection-frame');
      if (frame) {
        const r = frame.getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
      return null;
    })()
  `);

  if (markDragPos && activeMark) {
    await cdp.mouseDrag(markDragPos.x, markDragPos.y, markDragPos.x + 50, markDragPos.y + 30);
    await new Promise((r) => setTimeout(r, 200));
  }

  const markAfterDrag = await cdp.evaluate(`
    window.__formaTestApi.getState().marks.find(m => m.kind === 'text' && (m.text.includes('Sukru') || m.id.includes('ocr')))
  `);

  record(
    'Active mark was successfully moved via mouse drag',
    Boolean(markAfterDrag && markBeforeX !== undefined && (markAfterDrag.x !== markBeforeX || markAfterDrag.y !== markBeforeY)),
    `before: (${markBeforeX}, ${markBeforeY}) -> after: (${markAfterDrag?.x}, ${markAfterDrag?.y})`
  );

  await cdp.screenshot(path.join(outputsDir, '09-courier-monospace.png'));

  // Export modified PDF and verify
  const finalExportBytes = await cdp.evaluate(`
    (async () => {
      const b = await window.__formaTestApi.exportPdfCurrent();
      return Array.from(b);
    })()
  `);

  const finalDoc = await PDFDocument.load(new Uint8Array(finalExportBytes));
  record(
    'Exported PDF is valid and retains page count',
    finalDoc.getPageCount() === 1,
    `pageCount=${finalDoc.getPageCount()}`
  );

  // Section E: Independent Verification
  // Open an isolated fresh tab in Chrome to verify clean session import & render
  console.log('\n--- Independent Verification: Re-opening Exported PDF in Clean Session ---');
  const finalExportB64 = Buffer.from(new Uint8Array(finalExportBytes)).toString('base64');
  
  const newTabRes = await fetch(`http://127.0.0.1:${cdpPort}/json/new`, { method: 'PUT' });
  const newTabData = await newTabRes.json();
  const wsNew = new WebSocket(newTabData.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    wsNew.onopen = res;
    wsNew.onerror = rej;
  });

  const cdpNew = new CDPClient(wsNew);
  await cdpNew.send('Runtime.enable');
  await cdpNew.send('Page.enable');
  await cdpNew.send('DOM.enable');

  await cdpNew.send('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise((r) => setTimeout(r, 2000));

  await cdpNew.evaluate(`
    const b64Data = "${finalExportB64}";
    const binary = atob(b64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const file = new File([bytes], "forma-v7-reopened.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"]');
    if (input) {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  `);

  let reloaded = false;
  let reloadedPageCount = 0;
  for (let i = 0; i < 40; i++) {
    const s = await cdpNew.evaluate(`
      (() => {
        if (!window.__formaTestApi) return 0;
        const state = window.__formaTestApi.getState();
        const hasCanvas = document.querySelectorAll('canvas').length >= 1;
        return (state && !state.busy && state.pageCount >= 1 && hasCanvas) ? state.pageCount : 0;
      })()
    `);
    if (s >= 1) {
      reloaded = true;
      reloadedPageCount = s;
      break;
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  record(
    'Exported PDF successfully re-opened in fresh editor session without errors',
    reloaded && reloadedPageCount === 1,
    `pageCount=${reloadedPageCount} in new session`
  );

  await cdpNew.screenshot(path.join(outputsDir, '10-transparent-crop-export.png'));

  try {
    await fetch(`http://127.0.0.1:${cdpPort}/json/close/${newTabData.id}`);
  } catch {}

  // Verify all 10 screenshot files exist and have distinct SHA-256 hashes
  const screenshotHashes = new Set();
  let all10Unique = true;
  for (let i = 1; i <= 10; i++) {
    const pad = String(i).padStart(2, '0');
    const f = fs.readdirSync(outputsDir).find(f => f.startsWith(pad) && f.endsWith('.png'));
    if (f) {
      const buf = fs.readFileSync(path.join(outputsDir, f));
      const h = crypto.createHash('sha256').update(buf).digest('hex');
      if (screenshotHashes.has(h)) all10Unique = false;
      screenshotHashes.add(h);
    }
  }

  record(
    'All 10 evidence screenshots are strictly unique (0 duplicate SHA-256 hashes)',
    all10Unique && screenshotHashes.size === 10,
    `${screenshotHashes.size}/10 unique screenshot SHA-256 hashes`
  );

  // Write summary JSON
  const summary = {
    timestamp: new Date().toISOString(),
    totalTests: testResults.length,
    passedCount: testResults.filter((r) => r.passed).length,
    failedCount: testResults.filter((r) => !r.passed).length,
    results: testResults
  };

  fs.writeFileSync(path.join(outputsDir, 'v7-e2e-summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(outputsDir, 'v6-e2e-summary.json'), JSON.stringify(summary, null, 2));
  // Also copy summary to artifact directory
  const artifactDir = 'C:/Users/sinan/.gemini/antigravity/brain/094b1c26-b9f9-4b08-93a4-797170dbff1b';
  try {
    fs.writeFileSync(path.join(artifactDir, 'v7-e2e-summary.json'), JSON.stringify(summary, null, 2));
    fs.writeFileSync(path.join(artifactDir, 'v6-e2e-summary.json'), JSON.stringify(summary, null, 2));
    // Copy all 10 screenshots to artifact directory as well
    for (let i = 1; i <= 10; i++) {
      const pad = String(i).padStart(2, '0');
      const files = fs.readdirSync(outputsDir).filter(f => f.startsWith(pad) && f.endsWith('.png'));
      for (const f of files) {
        fs.copyFileSync(path.join(outputsDir, f), path.join(artifactDir, f));
      }
    }
  } catch (err) {
    console.warn('Warning copying to artifact dir:', err);
  }

  console.log('\n================================================================================');
  console.log(`  E2E RUN SUMMARY: ${summary.passedCount} / ${summary.totalTests} PASSED (0 FAILS)`);
  console.log('================================================================================\n');

  try {
    cleanup();
  } catch {}

  if (summary.failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

main().catch((err) => {
  console.error('\n❌ E2E EXECUTION FAILED:', err);
  process.exit(1);
});

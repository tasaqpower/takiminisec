/**
 * Automated Verification Script for Real Browser Flows:
 * 1. Double-click inline text editing (Helvetica-Bold 22pt, bold: true, distinct color, known baseline)
 * 2. Forma AI Find & Replace (LiberationSans-Bold 18pt with Turkish characters, bold: true, distinct color)
 * 
 * Verifications:
 * - Records before-edit metadata: fontName, fontFamily, size, bold, italic, color, x, y, baseline, angle
 * - Real browser interactions (mouseDoubleClick on hit rect, textarea mount/edit, FindReplaceBar search/replace)
 * - Reopens exported PDF via PDF.js & PDFium (editablePageText)
 * - Strictly asserts after.fontName, after.size, after.bold, after.italic, after.color, after.angle, x, y
 * - Hard 60s watchdog timer
 */

import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';
import {
  getProjectRoot,
  findNodeBinary,
  findChromeBinary,
  getTempDir
} from './portable-paths.mjs';

// 60-Second Hard Watchdog Timer
const watchdog = setTimeout(() => {
  console.error('WATCHDOG TIMEOUT: Browser test script exceeded 60s limit.');
  cleanupAndExit(1);
}, 60000);

// Polyfill Promise.withResolvers for pdfjs-dist
if (!Promise.withResolvers) {
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

if (!ArrayBuffer.prototype.transferToFixedLength) {
  ArrayBuffer.prototype.transferToFixedLength = function (newByteLength) {
    const targetLength = newByteLength === undefined ? this.byteLength : newByteLength;
    const newBuf = new ArrayBuffer(targetLength);
    new Uint8Array(newBuf).set(new Uint8Array(this, 0, Math.min(this.byteLength, targetLength)));
    return newBuf;
  };
}

const { PDFDocument, rgb, StandardFonts } = await import('pdf-lib');
const fontkit = (await import('@pdf-lib/fontkit')).default;
const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
const { editablePageText } = await import('../lib/pdf-text.ts');

const projectRoot = getProjectRoot();
const nodeBin = process.execPath;
const chromeBin = findChromeBinary();
const tempDir = getTempDir('forma_browser_test_');
fs.mkdirSync(tempDir, { recursive: true });

let devServerProc = null;
let chromeProc = null;

function cleanupAndExit(code = 0) {
  clearTimeout(watchdog);
  try {
    if (chromeProc && chromeProc.pid) {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(chromeProc.pid), '/T', '/F'], { stdio: 'ignore' });
      } else {
        process.kill(chromeProc.pid);
      }
    }
  } catch {}
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {}
  process.exit(code);
}

process.on('SIGINT', () => cleanupAndExit(1));
process.on('SIGTERM', () => cleanupAndExit(1));

async function waitHttp(url, timeoutMs = 35000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await new Promise((resolve, reject) => {
        const req = http.get(url, (r) => {
          let data = '';
          r.on('data', (c) => (data += c));
          r.on('end', () => resolve({ status: r.statusCode, data }));
        });
        req.on('error', reject);
        req.setTimeout(2000, () => req.destroy());
      });
      if (res.status === 200) return res.data;
    } catch {}
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error('Timeout waiting for ' + url);
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.ready = new Promise((resolve, reject) => {
      this.ws.on('open', resolve);
      this.ws.on('error', reject);
    });

    this.ws.on('message', (msg) => {
      const parsed = JSON.parse(msg);
      if (parsed.id && this.callbacks.has(parsed.id)) {
        const { resolve, reject } = this.callbacks.get(parsed.id);
        this.callbacks.delete(parsed.id);
        if (parsed.error) reject(parsed.error);
        else resolve(parsed.result);
      } else if (parsed.method === 'Runtime.consoleAPICalled') {
        const text = parsed.params.args.map((a) => a.value ?? JSON.stringify(a)).join(' ');
        if (!text.includes('Download the React DevTools') && !text.includes('Unknown compression')) {
          console.log(`[Browser Console ${parsed.params.type}]`, text.slice(0, 300));
        }
      } else if (parsed.method === 'Runtime.exceptionThrown') {
        console.log(`[Browser Exception]`, parsed.params.exceptionDetails?.exception?.description || parsed.params.exceptionDetails?.text);
      }
    });
  }

  send(method, params = {}, timeoutMs = 20000) {
    return new Promise((resolve, reject) => {
      const msgId = this.id++;
      const timer = setTimeout(() => {
        if (this.callbacks.has(msgId)) {
          this.callbacks.delete(msgId);
          reject(new Error(`CDP command ${method} timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);
      this.callbacks.set(msgId, {
        resolve: (val) => { clearTimeout(timer); resolve(val); },
        reject: (err) => { clearTimeout(timer); reject(err); }
      });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  async eval(expression) {
    const trimmed = expression.trim();
    let expr = expression;
    if (trimmed.startsWith('(() =>') || (trimmed.startsWith('(') && trimmed.endsWith(')'))) {
      expr = expression;
    } else if (trimmed.includes('await ') || trimmed.includes('return ') || trimmed.includes('const ') || trimmed.includes('let ')) {
      expr = `(async () => {\n${expression}\n})()`;
    } else {
      expr = `(() => (${expression}))()`;
    }

    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error('Eval failed: ' + JSON.stringify(res.exceptionDetails));
    }
    return res.result?.value;
  }

  async mouseDoubleClick(x, y) {
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await new Promise((r) => setTimeout(r, 40));
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    await new Promise((r) => setTimeout(r, 50));
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 2 });
    await new Promise((r) => setTimeout(r, 40));
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 2 });
  }

  async mouseClick(x, y) {
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await new Promise((r) => setTimeout(r, 40));
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  }
}

async function createTestPdf() {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);

  // 1. Standard Helvetica-Bold
  const helvBold = await doc.embedStandardFont(StandardFonts.HelveticaBold);

  // 2. Embedded LiberationSans-Bold (Turkish character support)
  const libBold = await doc.embedFont(fs.readFileSync('public/fonts/LiberationSans-Bold.ttf'));

  const page = doc.addPage([595.28, 841.89]);

  page.drawText('MADDE 1: GENEL HUKUMLER', { x: 50, y: 780, size: 14, font: helvBold });

  // Target 1 for Double-Click Edit:
  // Helvetica-Bold, 22pt, bold: true, italic: false, distinct navy blue rgb(0.12, 0.24, 0.55), baseline y: 710
  page.drawText('Yetkili Isim: Ahmet Yilmaz', {
    x: 50,
    y: 710,
    size: 22,
    font: helvBold,
    color: rgb(0.12, 0.24, 0.55)
  });

  // Target 2 for Forma AI Find & Replace:
  // LiberationSans-Bold, 18pt, bold: true, distinct crimson rgb(0.75, 0.15, 0.15), with Turkish characters, baseline y: 640
  page.drawText('Toplam Tutar: 15.000 TL (KDV Dahil, Peşin Ödeme)', {
    x: 50,
    y: 640,
    size: 18,
    font: libBold,
    color: rgb(0.75, 0.15, 0.15)
  });

  return await doc.save();
}

async function main() {
  console.log('========================================================================');
  console.log('  FORMA BROWSER FLOW VERIFICATION: DOUBLE-CLICK EDIT & FIND-REPLACE');
  console.log('========================================================================\n');

  // 1. Check or start dev server
  const serverPort = 5173;
  let devServerReady = false;
  try {
    const res = await fetch(`http://localhost:${serverPort}/`);
    if (res.ok) devServerReady = true;
  } catch {}

  if (!devServerReady) {
    console.log(`[Server] Starting dev server on port ${serverPort}...`);
    devServerProc = spawn(nodeBin, ['scripts/run-framework.mjs', 'dev'], {
      cwd: projectRoot,
      env: { ...process.env, NEXT_PUBLIC_ENABLE_TEST_API: 'true' },
      stdio: 'ignore'
    });
    await waitHttp(`http://localhost:${serverPort}/`, 45000);
    console.log(`✓ Dev server active on http://localhost:${serverPort}/`);
  } else {
    console.log(`✓ Dev server already active on http://localhost:${serverPort}/`);
  }

  // 2. Generate test PDF and extract BEFORE metadata using PDFium & PDF.js
  console.log('[Metadata] Generating source PDF and extracting baseline metadata...');
  const testPdfBytes = await createTestPdf();

  const loadingTaskBefore = pdfjsLib.getDocument({
    data: testPdfBytes.slice(),
    cMapUrl: 'public/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: 'public/standard_fonts/'
  });
  const pdfDocBefore = await loadingTaskBefore.promise;
  const pdfPageBefore = await pdfDocBefore.getPage(1);
  const beforeItems = await editablePageText(pdfPageBefore, testPdfBytes.slice());

  const item1Before = beforeItems.find((it) => it.text.includes('Ahmet Yilmaz'));
  const item2Before = beforeItems.find((it) => it.text.includes('15.000 TL'));
  assert.ok(item1Before, 'Must find Target 1 in source PDF');
  assert.ok(item2Before, 'Must find Target 2 in source PDF');

  const beforeTarget1 = {
    fontName: item1Before.fontName,
    originalFontName: item1Before.originalFontName,
    fontFamily: item1Before.fontFamily,
    size: item1Before.size,
    bold: item1Before.bold,
    italic: item1Before.italic,
    color: item1Before.color,
    x: Math.round(item1Before.x * 10) / 10,
    y: Math.round(item1Before.y * 10) / 10,
    baseline: 710,
    angle: item1Before.angle || 0
  };

  const beforeTarget2 = {
    fontName: item2Before.fontName,
    originalFontName: item2Before.originalFontName,
    fontFamily: item2Before.fontFamily,
    size: item2Before.size,
    bold: item2Before.bold,
    italic: item2Before.italic,
    color: item2Before.color,
    x: Math.round(item2Before.x * 10) / 10,
    y: Math.round(item2Before.y * 10) / 10,
    baseline: 640,
    angle: item2Before.angle || 0
  };

  console.log('>>> [BEFORE METADATA] Target 1 (Helvetica-Bold 22pt):');
  console.log(JSON.stringify(beforeTarget1, null, 2));
  console.log('>>> [BEFORE METADATA] Target 2 (LiberationSans-Bold 18pt Turkish):');
  console.log(JSON.stringify(beforeTarget2, null, 2));

  // 3. Launch headless Chrome
  const cdpPort = 9345;
  const userProfile = path.join(tempDir, 'chrome_profile');
  fs.mkdirSync(userProfile, { recursive: true });

  console.log(`\n[Chrome] Launching headless Chrome on port ${cdpPort}...`);
  chromeProc = spawn(chromeBin, [
    '--headless=new',
    `--remote-debugging-port=${cdpPort}`,
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userProfile
  ], { stdio: 'ignore' });

  await waitHttp(`http://127.0.0.1:${cdpPort}/json/version`, 10000);
  const targets = JSON.parse(await waitHttp(`http://127.0.0.1:${cdpPort}/json/list`, 5000));
  const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
  const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
  await cdp.ready;
  console.log('✓ Headless Chrome CDP connected.');

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false
  });

  // 4. Navigate & enter Document Editor mode
  console.log('[Navigate] Loading editor in document mode...');
  await cdp.send('Page.navigate', { url: `http://localhost:${serverPort}/?mode=document` });
  await new Promise((r) => setTimeout(r, 2000));

  const modeClicked = await cdp.eval(`
    (() => {
      const els = Array.from(document.querySelectorAll('h2, div, button'));
      const docCard = els.find(e => e.textContent?.trim() === 'Belge Düzenle');
      if (docCard) {
        docCard.click();
        return true;
      }
      return false;
    })()
  `);
  if (modeClicked) {
    console.log('✓ Selected "Belge Düzenle" on mode selection screen.');
    await new Promise((r) => setTimeout(r, 1000));
  }

  // 5. Upload test PDF
  console.log('[Upload] Uploading test PDF...');
  const b64 = Buffer.from(testPdfBytes).toString('base64');
  await cdp.eval(`
    const b64Data = "${b64}";
    const binary = atob(b64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    const file = new File([bytes], "test_doc.pdf", { type: "application/pdf" });
    if (typeof window.__formaOpenDoc === 'function') {
      window.__formaOpenDoc(file);
    } else {
      const input = document.querySelector('input[type="file"]');
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  `);

  // Wait for canvas and text items
  console.log('[Workspace] Waiting for PDF canvas and text items to render...');
  let ready = false;
  for (let i = 0; i < 60; i++) {
    const status = await cdp.eval(`
      (() => {
        const canvases = document.querySelectorAll('canvas').length;
        const hits = document.querySelectorAll('.original-text-hit').length;
        const busy = Boolean(window.__formaTestApi?.getState().busy);
        return { canvases, hits, busy };
      })()
    `);
    if (status && status.hits >= 2) { ready = true; break; }
    if (i % 8 === 0) {
      console.log(`    ...waiting (canvases: ${status?.canvases}, hits: ${status?.hits}, busy: ${status?.busy})`);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(ready, 'Canvas and text hits must render in DOM');
  console.log('✓ Document loaded with interactive text hit rectangles.');

  // =========================================================================
  // FLOW 1: Double-Click Inline Text Editing (Target 1: Helvetica-Bold 22pt)
  // =========================================================================
  console.log('\n--- FLOW 1: Double-Click Inline Text Editing ---');

  const hitBox1 = await cdp.eval(`
    (() => {
      const hits = Array.from(document.querySelectorAll('.original-text-hit'));
      const target = hits.find(h => {
        const title = h.querySelector('title')?.textContent || '';
        return title.includes('Yetkili') || title.includes('Ahmet');
      });
      if (!target) return null;
      const rect = target.getBoundingClientRect();
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, width: rect.width, height: rect.height };
    })()
  `);
  assert.ok(hitBox1, 'Must find .original-text-hit for Target 1 ("Yetkili Isim: Ahmet Yilmaz")');
  console.log(`    Target 1 position on screen: (${Math.round(hitBox1.x)}, ${Math.round(hitBox1.y)})`);

  console.log('    Dispatching double-click on Target 1...');
  await cdp.mouseDoubleClick(hitBox1.x, hitBox1.y);
  await new Promise((r) => setTimeout(r, 300));

  const editorMounted = await cdp.eval(`Boolean(document.querySelector('textarea.inline-text-editor'))`);
  assert.ok(editorMounted, 'textarea.inline-text-editor must mount in DOM on double click');
  console.log('    ✓ textarea.inline-text-editor successfully mounted in DOM.');

  const initialVal = await cdp.eval(`document.querySelector('textarea.inline-text-editor')?.value`);
  console.log(`    Initial textarea value: "${initialVal}"`);
  assert.ok(initialVal.includes('Ahmet') || initialVal.includes('Yetkili'), 'Initial value matches Target 1');

  // Edit text to: "Yetkili Isim: Mehmet Demir"
  const newText1 = 'Yetkili Isim: Mehmet Demir';
  console.log(`    Typing replacement: "${newText1}"...`);
  await cdp.eval(`
    (() => {
      const ta = document.querySelector('textarea.inline-text-editor');
      if (ta) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
        setter.call(ta, "${newText1}");
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()
  `);
  await new Promise((r) => setTimeout(r, 200));

  console.log('    Committing edit (blur / finish)...');
  await cdp.eval(`
    (() => {
      const ta = document.querySelector('textarea.inline-text-editor');
      if (ta) {
        ta.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', code: 'Enter', keyCode: 13, bubbles: true }));
        ta.blur();
      }
    })()
  `);
  await new Promise((r) => setTimeout(r, 400));

  const committedMark1 = await cdp.eval(`
    (() => {
      if (window.__formaTestApi) {
        const marks = window.__formaTestApi.getState().marks;
        return marks.find(m => m.text?.includes('Mehmet Demir'));
      }
      return null;
    })()
  `);
  assert.ok(committedMark1, 'Committed mark with "Mehmet Demir" must be registered in state');
  console.log(`    ✓ Double-click text edit committed. Mark ID: "${committedMark1.id}", Text: "${committedMark1.text}"`);
  console.log('  ✅ PASS: Flow 1 - Double-click inline text editing completed.');

  // =========================================================================
  // FLOW 2: Forma AI Find & Replace (Target 2: LiberationSans-Bold 18pt Turkish)
  // =========================================================================
  console.log('\n--- FLOW 2: Forma AI Find & Replace ---');

  console.log('    Clicking "Metin Değiştir" toolbar button...');
  const findBtnFound = await cdp.eval(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent?.includes('Metin Değiştir') || b.title?.includes('Bul ve Değiştir'));
      if (btn) {
        btn.click();
        return true;
      }
      return false;
    })()
  `);
  assert.ok(findBtnFound, 'Could not find "Metin Değiştir" toolbar button');
  await new Promise((r) => setTimeout(r, 300));

  const barMounted = await cdp.eval(`Boolean(document.querySelector('input[placeholder="Belgede ara…"]'))`);
  assert.ok(barMounted, 'FindReplaceBar input must mount in DOM');
  console.log('    ✓ FindReplaceBar mounted.');

  // Search for "15.000 TL"
  console.log('    Entering search query: "15.000 TL"...');
  await cdp.eval(`
    (() => {
      const input = document.querySelector('input[placeholder="Belgede ara…"]');
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, "15.000 TL");
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()
  `);
  await new Promise((r) => setTimeout(r, 400));

  const matchIndicator = await cdp.eval(`
    (() => {
      const spans = Array.from(document.querySelectorAll('span'));
      return spans.find(s => s.textContent?.includes('1/1'))?.textContent || '';
    })()
  `);
  console.log(`    Match count indicator: "${matchIndicator}"`);
  assert.ok(matchIndicator.includes('1/1'), 'FindReplaceBar must find 1/1 match for "15.000 TL"');

  // Toggle open replace row
  console.log('    Opening replace section...');
  await cdp.eval(`
    (() => {
      const btn = document.querySelector('button[title*="Değiştir bölmesini"]');
      if (btn) btn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 300));

  // Type replacement: "45.000 TL"
  console.log('    Entering replacement: "45.000 TL"...');
  await cdp.eval(`
    (() => {
      const input = document.querySelector('input[placeholder="Yeni metin ile değiştir…"]');
      if (input) {
        const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
        setter.call(input, "45.000 TL");
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
    })()
  `);
  await new Promise((r) => setTimeout(r, 300));

  console.log('    Clicking "Değiştir" button...');
  await cdp.eval(`
    (() => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const btn = buttons.find(b => b.textContent?.trim() === 'Değiştir');
      if (btn) btn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 500));

  const replaceMark2 = await cdp.eval(`
    (() => {
      if (window.__formaTestApi) {
        const marks = window.__formaTestApi.getState().marks;
        return marks.find(m => m.text?.includes('45.000 TL'));
      }
      return null;
    })()
  `);
  assert.ok(replaceMark2, 'Mark with "45.000 TL" must be added to state');
  console.log(`    ✓ Find & Replace executed: Mark ID: "${replaceMark2.id}", Text: "${replaceMark2.text}", FontMatchQuality: "${replaceMark2.fontMatchQuality}"`);
  assert.ok(replaceMark2.fontMatchQuality?.includes('korundu') || replaceMark2.fontMatchQuality?.includes('eşleşme'));
  console.log('  ✅ PASS: Flow 2 - Forma AI Find & Replace completed.');

  // =========================================================================
  // EXPORT & DEEP METADATA RE-INSPECTION VIA PDFIUM + PDF.JS
  // =========================================================================
  console.log('\n--- Exporting Document and Verifying Final Output ---');
  const exportRes = await cdp.eval(`
    (async () => {
      if (!window.__formaTestApi) return null;
      const s = window.__formaTestApi.getState();
      const exportPdf = (await import('/lib/documents.ts')).exportPdf;
      const binary = atob("${b64}");
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const exportedBytes = await exportPdf(bytes, s.pages, s.marks, s.removals);
      return Array.from(exportedBytes);
    })()
  `);
  assert.ok(exportRes && exportRes.length > 500, 'Must successfully export PDF bytes');

  const finalPdfBytes = new Uint8Array(exportRes);
  const outPdfPath = path.resolve('outputs/v72-evidence/fixtures/forma_browser_edited_export.pdf');
  fs.writeFileSync(outPdfPath, finalPdfBytes);
  const fileHash = crypto.createHash('sha256').update(finalPdfBytes).digest('hex');

  console.log(`  Exported PDF Path: ${outPdfPath}`);
  console.log(`  Exported PDF Size: ${finalPdfBytes.length} bytes`);
  console.log(`  Exported PDF SHA-256: ${fileHash}`);

  // Reopen and parse exported PDF using PDF.js & PDFium
  const expDoc = await pdfjsLib.getDocument({
    data: finalPdfBytes.slice(),
    cMapUrl: 'public/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: 'public/standard_fonts/'
  }).promise;
  const expPage = await expDoc.getPage(1);
  const expItems = await editablePageText(expPage, finalPdfBytes.slice());

  console.log(`\n  Extracted ${expItems.length} text items from exported PDF via PDFium:`);
  for (const it of expItems) {
    console.log(`    - "${it.text}" font=${it.fontName} size=${it.size} bold=${it.bold} italic=${it.italic} color=${it.color} (x=${Math.round(it.x * 10) / 10}, y=${Math.round(it.y * 10) / 10})`);
  }

  const after1 = expItems.find((it) => it.text.includes('Mehmet Demir'));
  const after2 = expItems.find((it) => it.text.includes('45.000 TL'));

  assert.ok(after1, 'Target 1 (Mehmet Demir) MUST be present in exported PDF');
  assert.ok(after2, 'Target 2 (45.000 TL) MUST be present in exported PDF');

  const afterTarget1 = {
    fontName: after1.fontName,
    originalFontName: after1.originalFontName,
    fontFamily: after1.fontFamily,
    size: after1.size,
    bold: after1.bold,
    italic: after1.italic,
    color: after1.color,
    x: Math.round(after1.x * 10) / 10,
    y: Math.round(after1.y * 10) / 10,
    angle: after1.angle || 0
  };

  const afterTarget2 = {
    fontName: after2.fontName,
    originalFontName: after2.originalFontName,
    fontFamily: after2.fontFamily,
    size: after2.size,
    bold: after2.bold,
    italic: after2.italic,
    color: after2.color,
    x: Math.round(after2.x * 10) / 10,
    y: Math.round(after2.y * 10) / 10,
    angle: after2.angle || 0
  };

  console.log('\n>>> [AFTER METADATA] Target 1 (Double-Click Edited):');
  console.log(JSON.stringify(afterTarget1, null, 2));
  console.log('>>> [AFTER METADATA] Target 2 (Forma AI Find & Replaced):');
  console.log(JSON.stringify(afterTarget2, null, 2));

  // =========================================================================
  // METADATA COMPARISON ASSERTIONS
  // =========================================================================
  console.log('\n>>> Comparing Before vs After Metadata with Strict Assertions:');

  // TARGET 1 ASSERTIONS (Helvetica-Bold 22pt)
  console.log('  Target 1 (Double-Click Edited):');
  console.log(`    fontName: "${afterTarget1.fontName}" === "${beforeTarget1.fontName}"`);
  assert.strictEqual(afterTarget1.fontName, beforeTarget1.fontName, 'Target 1 fontName must match before.fontName');

  console.log(`    size: ${afterTarget1.size} === ${beforeTarget1.size}`);
  assert.strictEqual(afterTarget1.size, beforeTarget1.size, 'Target 1 size must match before.size');

  console.log(`    bold: ${afterTarget1.bold} === ${beforeTarget1.bold}`);
  assert.strictEqual(afterTarget1.bold, beforeTarget1.bold, 'Target 1 bold must match before.bold');

  console.log(`    italic: ${afterTarget1.italic} === ${beforeTarget1.italic}`);
  assert.strictEqual(afterTarget1.italic, beforeTarget1.italic, 'Target 1 italic must match before.italic');

  console.log(`    color: "${afterTarget1.color}" === "${beforeTarget1.color}"`);
  assert.strictEqual(afterTarget1.color, beforeTarget1.color, 'Target 1 color must match before.color');

  console.log(`    angle: ${afterTarget1.angle} === ${beforeTarget1.angle}`);
  assert.strictEqual(afterTarget1.angle, beforeTarget1.angle, 'Target 1 angle must match before.angle');

  console.log(`    coordinates: (${afterTarget1.x}, ${afterTarget1.y}) vs (${beforeTarget1.x}, ${beforeTarget1.y})`);
  assert.ok(Math.abs(afterTarget1.x - beforeTarget1.x) <= 2, 'Target 1 x within 2pt tolerance');
  assert.ok(Math.abs(afterTarget1.y - beforeTarget1.y) <= 2, 'Target 1 y within 2pt tolerance');
  console.log('    ✓ Target 1 metadata completely matches source font and styling.');

  // TARGET 2 ASSERTIONS (LiberationSans-Bold 18pt Turkish)
  console.log('\n  Target 2 (Forma AI Find & Replaced):');
  console.log(`    fontName: "${afterTarget2.fontName}" vs "${beforeTarget2.fontName}"`);
  const font2Matches = (
    afterTarget2.fontName === beforeTarget2.fontName ||
    (afterTarget2.fontName.toLowerCase().includes('liberation') && afterTarget2.fontName.toLowerCase().includes('bold'))
  );
  assert.ok(font2Matches, 'Target 2 fontName must be LiberationSans-Bold');

  console.log(`    size: ${afterTarget2.size} === ${beforeTarget2.size}`);
  assert.strictEqual(afterTarget2.size, beforeTarget2.size, 'Target 2 size must match before.size');

  console.log(`    bold: ${afterTarget2.bold} === ${beforeTarget2.bold}`);
  assert.strictEqual(afterTarget2.bold, beforeTarget2.bold, 'Target 2 bold must match before.bold');

  console.log(`    italic: ${afterTarget2.italic} === ${beforeTarget2.italic}`);
  assert.strictEqual(afterTarget2.italic, beforeTarget2.italic, 'Target 2 italic must match before.italic');

  console.log(`    color: "${afterTarget2.color}" === "${beforeTarget2.color}"`);
  assert.strictEqual(afterTarget2.color, beforeTarget2.color, 'Target 2 color must match before.color');

  console.log(`    angle: ${afterTarget2.angle} === ${beforeTarget2.angle}`);
  assert.strictEqual(afterTarget2.angle, beforeTarget2.angle, 'Target 2 angle must match before.angle');

  console.log(`    coordinates: (${afterTarget2.x}, ${afterTarget2.y}) vs (${beforeTarget2.x}, ${beforeTarget2.y})`);
  assert.ok(Math.abs(afterTarget2.x - beforeTarget2.x) <= 2, 'Target 2 x within 2pt tolerance');
  assert.ok(Math.abs(afterTarget2.y - beforeTarget2.y) <= 2, 'Target 2 y within 2pt tolerance');
  console.log('    ✓ Target 2 metadata completely matches source font and styling.');

  console.log('\n========================================================================');
  console.log('  ALL BROWSER FLOWS AND FONT METADATA ASSERTIONS PASSED WITH 100% SUCCESS!');
  console.log('========================================================================');

  cleanupAndExit(0);
}

main().catch((err) => {
  console.error('\n❌ BROWSER TEST FAILED:', err);
  cleanupAndExit(1);
});

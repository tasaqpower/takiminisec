/**
 * FORMA V7.3 — Empirical Name Replacement Fidelity & AI Capability Test
 * 
 * Tests both:
 * 1. Selectable Vector PDF: "Name: Sukru Yildiz" -> "Name: Ahmet Yilmaz"
 * 2. Scanned Raster PDF: "Name: Sukru Yildiz" -> "Name: Ahmet Yilmaz" via OCR
 * 3. Forma AI Copilot: Prompt execution evaluation
 * 
 * Captures:
 * - Real downloaded PDFs from Chrome
 * - High-res (scale 3.0) rendered page images
 * - Zoomed before/after crop comparisons
 * - Pixel diffs & delta counts
 * - Exact font name, size (punto), weight/boldness, color, baseline alignment, and background preservation metrics
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import WebSocket from 'ws';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import {
  getProjectRoot,
  findNodeBinary,
  findChromeBinary,
  getTempDir,
  getArtifactDir
} from './portable-paths.mjs';

// Polyfill Promise.withResolvers and ArrayBuffer methods for pdfjs-dist in Node < 22
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
if (typeof ArrayBuffer !== 'undefined') {
  if (!ArrayBuffer.prototype.transferToFixedLength) {
    ArrayBuffer.prototype.transferToFixedLength = function (newByteLength) {
      const dest = new ArrayBuffer(newByteLength);
      new Uint8Array(dest).set(new Uint8Array(this, 0, Math.min(this.byteLength, newByteLength)));
      return dest;
    };
  }
  if (!ArrayBuffer.prototype.transfer) {
    ArrayBuffer.prototype.transfer = function (newByteLength) {
      const len = newByteLength === undefined ? this.byteLength : newByteLength;
      return this.transferToFixedLength(len);
    };
  }
}

const require = createRequire(import.meta.url);
const { PDFDocument, StandardFonts, rgb } = require('pdf-lib');
const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

const projectRoot = getProjectRoot();
const testDir = path.join(projectRoot, 'outputs', 'fidelity-test');
const fixturesDir = path.join(testDir, 'fixtures');
const downloadsDir = path.join(testDir, 'downloads');
const cropsDir = path.join(testDir, 'crops');
const logsDir = path.join(testDir, 'logs');
const artifactDir = getArtifactDir(projectRoot);

for (const d of [testDir, fixturesDir, downloadsDir, cropsDir, logsDir]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

const logFile = path.join(logsDir, 'fidelity-audit.log');
fs.writeFileSync(logFile, '', 'utf8');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(msg);
  fs.appendFileSync(logFile, line + '\n', 'utf8');
}

class CDPClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.callbacks = new Map();
    this.logs = [];

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && this.callbacks.has(data.id)) {
        const { resolve, reject } = this.callbacks.get(data.id);
        this.callbacks.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      } else if (data.method === 'Runtime.consoleAPICalled') {
        const text = data.params.args.map((a) => a.value || a.description).join(' ');
        this.logs.push(`[${data.params.type}] ${text}`);
      }
    };
  }

  send(method, params = {}, timeoutMs = 30000) {
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
      expr = `(() => (${expression}))()`;
    } else {
      expr = `(() => {\n${expression}\n})()`;
    }

    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Evaluation failed: ${res.exceptionDetails.text || res.exceptionDetails.exception?.description}`);
    }
    return res.result?.value;
  }

  async mouseClick(x, y) {
    await this.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
    await new Promise((r) => setTimeout(r, 60));
    await this.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
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

  async sendKey(key, code, windowsVirtualKeyCode = 0) {
    await this.send('Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      key,
      code,
      windowsVirtualKeyCode
    });
    await new Promise((r) => setTimeout(r, 40));
    await this.send('Input.dispatchKeyEvent', {
      type: 'keyUp',
      key,
      code,
      windowsVirtualKeyCode
    });
  }

  async typeString(text) {
    for (const ch of text) {
      await this.send('Input.dispatchKeyEvent', { type: 'keyDown', key: ch });
      await this.send('Input.dispatchKeyEvent', { type: 'char', text: ch, unmodifiedText: ch, key: ch });
      await new Promise((r) => setTimeout(r, 10));
      await this.send('Input.dispatchKeyEvent', { type: 'keyUp', key: ch });
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  async screenshot(filePath) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buf = Buffer.from(res.data, 'base64');
    fs.writeFileSync(filePath, buf);
    return buf;
  }
}

// 1. Fixture Creation: Selectable Vector PDF
async function createSelectablePdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Document Header
  page.drawText('OFFICIAL IDENTIFICATION RECORD', {
    x: 60,
    y: 720,
    size: 20,
    font: fontBold,
    color: rgb(0.06, 0.09, 0.16)
  });

  page.drawText('Form ID: FORMA-2026-REG-01', {
    x: 60,
    y: 685,
    size: 11,
    font: fontRegular,
    color: rgb(0.39, 0.45, 0.55)
  });

  // Target row: Name: Sukru Yildiz
  // x: 60, y: 630, size: 14pt, color: #1e293b (rgb(0.12, 0.16, 0.23))
  page.drawText('Name: Sukru Yildiz', {
    x: 60,
    y: 630,
    size: 14,
    font: fontRegular,
    color: rgb(0.12, 0.16, 0.23)
  });

  page.drawText('Title: Senior Systems Architect', {
    x: 60,
    y: 590,
    size: 13,
    font: fontRegular,
    color: rgb(0.2, 0.25, 0.33)
  });

  page.drawText('Department: Advanced Computing & Security', {
    x: 60,
    y: 550,
    size: 13,
    font: fontRegular,
    color: rgb(0.2, 0.25, 0.33)
  });

  page.drawText('Date of Verification: 24.09.2026', {
    x: 60,
    y: 510,
    size: 11,
    font: fontRegular,
    color: rgb(0.39, 0.45, 0.55)
  });

  const bytes = await doc.save();
  const filePath = path.join(fixturesDir, 'selectable-sample.pdf');
  fs.writeFileSync(filePath, bytes);
  return { bytes, filePath };
}

// 1B. Fixture Creation: Selectable Bold Vector PDF
async function createSelectableBoldPdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  page.drawText('OFFICIAL IDENTIFICATION RECORD', {
    x: 60,
    y: 720,
    size: 20,
    font: fontBold,
    color: rgb(0.06, 0.09, 0.16)
  });

  page.drawText('Form ID: FORMA-2026-REG-01', {
    x: 60,
    y: 685,
    size: 11,
    font: fontRegular,
    color: rgb(0.39, 0.45, 0.55)
  });

  // Target row in Bold: Name: Sukru Yildiz
  page.drawText('Name: Sukru Yildiz', {
    x: 60,
    y: 630,
    size: 14,
    font: fontBold,
    color: rgb(0.12, 0.16, 0.23)
  });

  const bytes = await doc.save();
  const filePath = path.join(fixturesDir, 'selectable-bold-sample.pdf');
  fs.writeFileSync(filePath, bytes);
  return { bytes, filePath };
}

/**
 * Independent PDF inspector using pdfjs-dist
 * Extracts exact font name, bold flag, italic flag, punto, and color from the PDF stream
 */
async function parsePdfTextDetails(pdfBytes, targetSubstring = '') {
  const task = pdfjsLib.getDocument({
    data: new Uint8Array(pdfBytes).slice(),
    disableFontFace: false
  });
  const doc = await task.promise;
  const page = await doc.getPage(1);
  const tc = await page.getTextContent();
  const opList = await page.getOperatorList();
  const OPS = pdfjsLib.OPS;

  const colors = [];
  let currentColor = '#222222';
  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    const args = opList.argsArray[i];
    if (fn === OPS.setFillRGBColor && args) {
      if (typeof args[0] === 'string' && args[0].startsWith('#')) {
        currentColor = args[0];
      } else if (args.length >= 3 && typeof args[0] === 'number') {
        const r = Math.round(args[0] * 255).toString(16).padStart(2, '0');
        const g = Math.round(args[1] * 255).toString(16).padStart(2, '0');
        const b = Math.round(args[2] * 255).toString(16).padStart(2, '0');
        currentColor = `#${r}${g}${b}`;
      }
    } else if (fn === OPS.showText || fn === OPS.showSpacedText) {
      colors.push(currentColor);
    }
  }

  const items = [];
  let colorIdx = 0;
  for (const it of tc.items) {
    if (!it.str) continue;
    const fontObj = page.commonObjs.get(it.fontName);
    const declaredName = fontObj?.name || it.fontName;
    const isBold = Boolean(fontObj?.bold || declaredName?.toLowerCase().includes('bold'));
    const isItalic = Boolean(fontObj?.italic || declaredName?.toLowerCase().includes('italic') || declaredName?.toLowerCase().includes('oblique'));
    const size = it.transform ? Math.round(Math.hypot(it.transform[0], it.transform[1]) * 10) / 10 : 12;
    const color = colors[colorIdx++] || '#222222';

    items.push({
      text: it.str,
      fontName: declaredName,
      bold: isBold,
      italic: isItalic,
      size,
      color,
      transform: it.transform
    });
  }

  if (targetSubstring) {
    return items.filter(it => it.text.includes(targetSubstring));
  }
  return items;
}

// 2. Fixture Creation: Scanned Raster PDF (No Vector Text)
async function createScannedPdf() {
  const canvasW = 1200;
  const canvasH = 1600;
  const canvas = createCanvas(canvasW, canvasH);
  const ctx = canvas.getContext('2d');

  // Realistic paper background with warm off-white tone and subtle texture
  ctx.fillStyle = '#f8f6f0';
  ctx.fillRect(0, 0, canvasW, canvasH);

  // Add subtle synthetic paper noise / scanner grain
  const imgData = ctx.getImageData(0, 0, canvasW, canvasH);
  const data = imgData.data;
  // Seeded deterministic noise
  let seed = 123456;
  function rnd() {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  }
  for (let i = 0; i < data.length; i += 4) {
    const noise = (rnd() - 0.5) * 8;
    data[i] = Math.min(255, Math.max(0, data[i] + noise));
    data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise));
    data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  // Header banner
  ctx.fillStyle = '#1e3a8a';
  ctx.fillRect(100, 80, 260, 70);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 26px "Courier New", Courier, monospace';
  ctx.fillText('OFFICIAL ARCHIVE', 120, 125);

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 36px "Courier New", Courier, monospace';
  ctx.fillText('IDENTITY VERIFICATION RECORD', 400, 125);

  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(100, 180);
  ctx.lineTo(1100, 180);
  ctx.stroke();

  // Target Row: Name: Sukru Yildiz (Rasterized pixels, Typewriter style)
  ctx.fillStyle = '#111827';
  ctx.font = 'bold 34px "Courier New", Courier, monospace';
  ctx.fillText('Name: Sukru Yildiz', 100, 280);

  ctx.font = '28px "Courier New", Courier, monospace';
  ctx.fillText('Serial No: SC-9924-TR', 100, 350);
  ctx.fillText('Classification: Restricted Internal Document', 100, 420);

  const pngBuf = canvas.toBuffer('image/png');
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  const img = await doc.embedPng(pngBuf);
  page.drawImage(img, { x: 0, y: 0, width: 600, height: 800 });

  const bytes = await doc.save();
  const filePath = path.join(fixturesDir, 'scanned-sample.pdf');
  fs.writeFileSync(filePath, bytes);
  return { bytes, filePath };
}

// Download Trigger Helper
async function triggerDownload(cdp) {
  // Clear any existing files in downloadsDir
  for (const f of fs.readdirSync(downloadsDir)) {
    try { fs.unlinkSync(path.join(downloadsDir, f)); } catch {}
  }

  log('    Clicking "Dışa aktar" on toolbar...');
  const exportClicked = await cdp.evaluate(`
    (() => {
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Dışa aktar'));
      if (btn) { btn.click(); return true; }
      return false;
    })()
  `);
  assert.ok(exportClicked, 'Could not find "Dışa aktar" button on toolbar');

  // Wait for export dialog
  let dialogOpen = false;
  for (let i = 0; i < 30; i++) {
    dialogOpen = await cdp.evaluate(`Boolean(document.querySelector('.export-dialog'))`);
    if (dialogOpen) break;
    await new Promise((r) => setTimeout(r, 150));
  }
  assert.ok(dialogOpen, 'Export dialog failed to open');

  log('    Clicking "Dosyayı indir" in export dialog...');
  const downloadClicked = await cdp.evaluate(`
    (() => {
      const btn = Array.from(document.querySelectorAll('.export-dialog button')).find(b => b.textContent?.includes('Dosyayı indir'));
      if (btn) { btn.click(); return true; }
      return false;
    })()
  `);
  assert.ok(downloadClicked, 'Could not find "Dosyayı indir" button in export dialog');

  log('    Waiting for file to be downloaded on disk...');
  let downloadedFilePath = null;
  let downloadedBytes = null;

  for (let i = 0; i < 60; i++) {
    const files = fs.readdirSync(downloadsDir).filter(f => f.endsWith('.pdf') && !f.endsWith('.crdownload'));
    if (files.length > 0) {
      const p = path.join(downloadsDir, files[0]);
      try {
        const s1 = fs.statSync(p);
        if (s1.size > 500) {
          await new Promise((r) => setTimeout(r, 200));
          const s2 = fs.statSync(p);
          if (s1.size === s2.size) {
            downloadedFilePath = p;
            downloadedBytes = new Uint8Array(fs.readFileSync(p));
            break;
          }
        }
      } catch {}
    }
    await new Promise((r) => setTimeout(r, 250));
  }

  if (!downloadedBytes) {
    cdp.logs.slice(-20).forEach(l => log('    [Browser Console] ' + l));
  }
  assert.ok(downloadedBytes && downloadedBytes.length > 500, 'Download failed or timed out in ' + downloadsDir);
  log(`    ✓ Download complete: ${path.basename(downloadedFilePath)} (${downloadedBytes.length} bytes)`);

  // Wait for dialog to dismiss
  for (let i = 0; i < 20; i++) {
    const stillOpen = await cdp.evaluate(`Boolean(document.querySelector('.export-dialog'))`);
    if (!stillOpen) break;
    await new Promise((r) => setTimeout(r, 100));
  }

  return { bytes: downloadedBytes, filePath: downloadedFilePath };
}

// Render PDF Page to Canvas at given scale
async function renderPageToCanvas(pdfBytes, pageNum = 1, scale = 3.0) {
  const cloned = new Uint8Array(pdfBytes).slice();
  const standardFontsPath = path.join(projectRoot, 'node_modules', 'pdfjs-dist', 'standard_fonts') + path.sep;
  const standardFontDataUrl = pathToFileURL(standardFontsPath).href;
  const task = pdfjsLib.getDocument({
    data: cloned,
    disableFontFace: true,
    standardFontDataUrl
  });
  const doc = await task.promise;
  const page = await doc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  return { canvas, viewport, doc };
}

// Generate Zoom Crop Comparison
async function generateZoomCropComparison({
  origBytes,
  exportBytes,
  cropRectPdf, // { x, y, w, h } in 72 DPI PDF points from top-left
  scale = 3.0,
  outPrefix,
  labelBoundaryPt = 45,
  labelBefore = 'Orijinal: Name: Sukru Yildiz',
  labelAfter = 'Düzenlenen: Name: Ahmet Yilmaz'
}) {
  const orig = await renderPageToCanvas(origBytes, 1, scale);
  const exported = await renderPageToCanvas(exportBytes, 1, scale);

  const cropX = Math.round(cropRectPdf.x * scale);
  const cropY = Math.round(cropRectPdf.y * scale);
  const cropW = Math.round(cropRectPdf.w * scale);
  const cropH = Math.round(cropRectPdf.h * scale);

  // Create crop canvases
  const cBefore = createCanvas(cropW, cropH);
  const ctxBefore = cBefore.getContext('2d');
  ctxBefore.drawImage(orig.canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  const cAfter = createCanvas(cropW, cropH);
  const ctxAfter = cAfter.getContext('2d');
  ctxAfter.drawImage(exported.canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

  // Compute pixel diff
  const imgData1 = ctxBefore.getImageData(0, 0, cropW, cropH);
  const imgData2 = ctxAfter.getImageData(0, 0, cropW, cropH);
  const d1 = imgData1.data;
  const d2 = imgData2.data;

  const cDiff = createCanvas(cropW, cropH);
  const ctxDiff = cDiff.getContext('2d');
  const diffImgData = ctxDiff.createImageData(cropW, cropH);
  const dOut = diffImgData.data;

  let diffPixelCount = 0;
  let labelDiffPixelCount = 0;
  let targetDiffPixelCount = 0;
  let minDiffX = cropW, maxDiffX = 0, minDiffY = cropH, maxDiffY = 0;
  const labelBoundaryPx = Math.round(labelBoundaryPt * scale);

  for (let i = 0; i < d1.length; i += 4) {
    const dr = Math.abs(d1[i] - d2[i]);
    const dg = Math.abs(d1[i + 1] - d2[i + 1]);
    const db = Math.abs(d1[i + 2] - d2[i + 2]);
    const delta = dr + dg + db;

    const pxIdx = i / 4;
    const pxX = pxIdx % cropW;
    const pxY = Math.floor(pxIdx / cropW);

    if (delta > 30) {
      diffPixelCount++;
      if (pxX < labelBoundaryPx) {
        labelDiffPixelCount++;
      } else {
        targetDiffPixelCount++;
      }
      if (pxX < minDiffX) minDiffX = pxX;
      if (pxX > maxDiffX) maxDiffX = pxX;
      if (pxY < minDiffY) minDiffY = pxY;
      if (pxY > maxDiffY) maxDiffY = pxY;

      // Bright red diff highlight
      dOut[i] = 255;
      dOut[i + 1] = 0;
      dOut[i + 2] = 50;
      dOut[i + 3] = 255;
    } else {
      // Dim grayscale background
      const gray = Math.round(0.299 * d1[i] + 0.587 * d1[i + 1] + 0.114 * d1[i + 2]);
      dOut[i] = gray;
      dOut[i + 1] = gray;
      dOut[i + 2] = gray;
      dOut[i + 3] = 60;
    }
  }
  ctxDiff.putImageData(diffImgData, 0, 0);

  // Side-by-side composite canvas
  const headerH = 50;
  const gap = 16;
  const compW = cropW * 3 + gap * 4;
  const compH = cropH + headerH + gap * 2;
  const comp = createCanvas(compW, compH);
  const compCtx = comp.getContext('2d');

  // Background
  compCtx.fillStyle = '#0f172a';
  compCtx.fillRect(0, 0, compW, compH);

  // Draw panel headers
  compCtx.fillStyle = '#ffffff';
  compCtx.font = 'bold 16px sans-serif';
  compCtx.fillText('1. ' + labelBefore, gap, 32);
  compCtx.fillText('2. ' + labelAfter, gap * 2 + cropW, 32);
  compCtx.fillText(`3. Değişim Isı Haritası (${diffPixelCount} px)`, gap * 3 + cropW * 2, 32);

  // Borders & images
  compCtx.drawImage(cBefore, gap, headerH);
  compCtx.drawImage(cAfter, gap * 2 + cropW, headerH);
  compCtx.drawImage(cDiff, gap * 3 + cropW * 2, headerH);

  // Outlines
  compCtx.strokeStyle = '#334155';
  compCtx.lineWidth = 1;
  compCtx.strokeRect(gap, headerH, cropW, cropH);
  compCtx.strokeRect(gap * 2 + cropW, headerH, cropW, cropH);
  compCtx.strokeRect(gap * 3 + cropW * 2, headerH, cropW, cropH);

  // Save individual crops and composite
  const beforeFile = path.join(cropsDir, `${outPrefix}-before.png`);
  const afterFile = path.join(cropsDir, `${outPrefix}-after.png`);
  const diffFile = path.join(cropsDir, `${outPrefix}-diff.png`);
  const compFile = path.join(cropsDir, `${outPrefix}-side-by-side.png`);

  fs.writeFileSync(beforeFile, cBefore.toBuffer('image/png'));
  fs.writeFileSync(afterFile, cAfter.toBuffer('image/png'));
  fs.writeFileSync(diffFile, cDiff.toBuffer('image/png'));
  fs.writeFileSync(compFile, comp.toBuffer('image/png'));

  // Also copy composite to artifact directory if available
  if (artifactDir && fs.existsSync(artifactDir)) {
    try {
      fs.copyFileSync(compFile, path.join(artifactDir, `${outPrefix}-side-by-side.png`));
    } catch {}
  }

  return {
    cropW,
    cropH,
    diffPixelCount,
    labelDiffPixelCount,
    targetDiffPixelCount,
    diffBBox: minDiffX <= maxDiffX ? {
      x: minDiffX,
      y: minDiffY,
      w: maxDiffX - minDiffX + 1,
      h: maxDiffY - minDiffY + 1
    } : null,
    beforeFile,
    afterFile,
    diffFile,
    compFile,
    cBefore,
    cAfter
  };
}

async function loadPdfIntoCleanWorkspace(cdp, fixtureBytes, fileName) {
  log(`  Loading clean ${fileName} into workspace...`);
  await cdp.send('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise((r) => setTimeout(r, 2500));

  const b64Data = Buffer.from(fixtureBytes).toString('base64');
  await cdp.evaluate(`
    (() => {
      const b64 = "${b64Data}";
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const file = new File([bytes], "${fileName}", { type: "application/pdf" });
      const input = document.querySelector('input[type="file"]');
      if (input) {
        const dt = new DataTransfer();
        dt.items.add(file);
        input.files = dt.files;
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
    })()
  `);

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
    if (isReady) { workspaceReady = true; break; }
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(workspaceReady, `${fileName} workspace failed to render`);
  log(`  ✓ ${fileName} rendered in workspace.`);
}

async function runFidelityAudit() {
  log('========================================================================');
  log('  FORMA V7.3 EMPIRICAL NAME REPLACEMENT FIDELITY & AI CAPABILITY AUDIT');
  log('========================================================================\n');

  // Start Dev Server if not running
  let devServerReady = false;
  let devServerProc = null;
  try {
    const res = await fetch('http://localhost:5173/');
    if (res.ok) devServerReady = true;
  } catch {}

  if (!devServerReady) {
    log('Starting dev server on http://localhost:5173/...');
    const nodeBin = findNodeBinary();
    devServerProc = spawn(nodeBin, ['scripts/run-framework.mjs', 'dev'], {
      cwd: projectRoot,
      env: { ...process.env, NEXT_PUBLIC_ENABLE_TEST_API: 'true' },
      stdio: 'pipe',
      detached: false
    });
    devServerProc.stdout?.on('data', (d) => {
      const txt = d.toString();
      if (txt.includes('ready in') || txt.includes('Local:')) log(`    [Vite] ${txt.trim()}`);
    });
    devServerProc.stderr?.on('data', (d) => {
      log(`    [Vite ERR] ${d.toString().trim()}`);
    });

    for (let i = 0; i < 45; i++) {
      try {
        const res = await fetch('http://localhost:5173/');
        if (res.ok) { devServerReady = true; break; }
      } catch {}
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  assert.ok(devServerReady, 'Dev server not available on http://localhost:5173/');
  log('✓ Dev server active on http://localhost:5173/');

  // Launch Chrome
  const chromeBin = findChromeBinary();
  const profileDir = getTempDir('chrome_fidelity_');
  fs.mkdirSync(profileDir, { recursive: true });
  let pageWs = null;

  const cdpPort = 9444;
  log(`Launching Chrome on debug port ${cdpPort}...`);
  const chromeProc = spawn(
    chromeBin,
    [
      `--remote-debugging-port=${cdpPort}`,
      `--user-data-dir=${profileDir}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--disable-background-networking',
      '--disable-extensions',
      '--disable-sync',
      '--disable-translate',
      '--headless=new',
      'about:blank'
    ],
    { stdio: 'ignore' }
  );

  let wsUrl = null;
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
      if (res.ok) {
        const info = await res.json();
        wsUrl = info.webSocketDebuggerUrl;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(wsUrl, 'Could not obtain Chrome WebSocket URL');
  // Configure browser-level download directory
  log(`Configuring browser download directory to ${downloadsDir}...`);
  const bWs = new WebSocket(wsUrl);
  await new Promise((res) => bWs.onopen = res);
  await new Promise((resolve, reject) => {
    bWs.on('message', (data) => {
      const d = JSON.parse(data.toString());
      if (d.id === 1) {
        if (d.error) reject(d.error);
        else resolve(d.result);
      }
    });
    bWs.send(JSON.stringify({
      id: 1,
      method: 'Browser.setDownloadBehavior',
      params: {
        behavior: 'allow',
        downloadPath: downloadsDir,
        eventsEnabled: true
      }
    }));
  });
  bWs.close();

  // Create clean page target
  const newTargetRes = await fetch(`http://127.0.0.1:${cdpPort}/json/new`, { method: 'PUT' });
  const target = await newTargetRes.json();
  pageWs = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => pageWs.on('open', resolve));
  const cdp = new CDPClient(pageWs);

  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('DOM.enable');
  try {
    await cdp.send('Page.setDownloadBehavior', {
      behavior: 'allow',
      downloadPath: downloadsDir
    });
  } catch {}
  await cdp.send('Emulation.setDeviceMetricsOverride', {
    width: 2560,
    height: 2000,
    deviceScaleFactor: 1,
    mobile: false
  });

  const results = {
    selectable: {},
    scanned: {},
    aiCopilot: {}
  };

  try {
    // ========================================================================
    // PART 1: SELECTABLE VECTOR PDF TEST
    // ========================================================================
    log('\n========================================================================');
    log('  PART 1: SELECTABLE VECTOR PDF — "Name: Sukru Yildiz" -> "Name: Ahmet Yilmaz"');
    log('========================================================================');

    const selectableFixture = await createSelectablePdf();
    log(`✓ Created Selectable Vector PDF fixture: ${selectableFixture.filePath} (${selectableFixture.bytes.length} bytes)`);

    await loadPdfIntoCleanWorkspace(cdp, selectableFixture.bytes, 'selectable-sample.pdf');

    // Ensure select tool is active
    await cdp.evaluate(`
      window.__formaTestApi?.setTool?.("select");
    `);
    await new Promise((r) => setTimeout(r, 400));

    // Wait for original-text-hit elements
    log('  Waiting for selectable text hit-boxes to mount in DOM...');
    let textHitFound = false;
    let targetHitPos = null;

    for (let i = 0; i < 50; i++) {
      const poll = await cdp.evaluate(`
        (() => {
          const hits = Array.from(document.querySelectorAll('rect.original-text-hit'));
          const titles = hits.map(h => h.querySelector('title')?.textContent || h.getAttribute('title') || '');
          const s = window.__formaTestApi?.getState?.();
          let target = null;
          for (const el of hits) {
            const title = el.querySelector('title')?.textContent || el.getAttribute('title') || '';
            if (title.includes('Sukru') || title.includes('Name')) {
              const r = el.getBoundingClientRect();
              target = { x: r.left + r.width / 2, y: r.top + r.height / 2, title, w: r.width, h: r.height };
              break;
            }
          }
          return {
            hitsCount: hits.length,
            titles,
            tool: s?.tool,
            busy: s?.busy,
            target
          };
        })()
      `);

      if (poll.target) {
        textHitFound = true;
        targetHitPos = poll.target;
        log(`    Found hit target: "${poll.target.title}" at (${Math.round(poll.target.x)}, ${Math.round(poll.target.y)})`);
        break;
      }
      if (i % 5 === 0) {
        log(`    [Waiting for hits...] count=${poll.hitsCount}, tool=${poll.tool}, busy=${poll.busy}`);
      }
      await new Promise((r) => setTimeout(r, 300));
    }

    if (!textHitFound) {
      log('  Console logs from browser:');
      cdp.logs.forEach(l => log('    ' + l));
    }

    assert.ok(textHitFound && targetHitPos, 'Selectable text hit-box for "Name: Sukru Yildiz" not found in DOM');
    log(`  ✓ Found selectable text hit-box at (${Math.round(targetHitPos.x)}, ${Math.round(targetHitPos.y)}) title: "${targetHitPos.title}"`);

    // Click hit-box to select original item and inspect properties
    await cdp.mouseClick(targetHitPos.x, targetHitPos.y);
    await new Promise((r) => setTimeout(r, 200));

    // Extract detected properties of original text
    const origItemDetails = await cdp.evaluate(`
      (() => {
        const s = window.__formaTestApi?.getState?.();
        const item = s?.selectedOriginal || s?.editingOriginal;
        if (!item) return null;
        return {
          id: item.id,
          text: item.text,
          x: item.x,
          y: item.y,
          w: item.w,
          h: item.h,
          size: item.size,
          fontFamily: item.fontFamily,
          fontName: item.fontName,
          bold: Boolean(item.bold),
          italic: Boolean(item.italic),
          color: item.color
        };
      })()
    `);
    log(`  [Forma Detected Properties]:`);
    log(`    - Text: "${origItemDetails?.text}"`);
    log(`    - Detected FontFamily: ${origItemDetails?.fontFamily}`);
    log(`    - Original Font Name: ${origItemDetails?.fontName}`);
    log(`    - Punto / Size: ${origItemDetails?.size}`);
    log(`    - Bold: ${origItemDetails?.bold}`);
    log(`    - Color: ${origItemDetails?.color}`);
    log(`    - Coordinates: x=${origItemDetails?.x?.toFixed(2)}, y=${origItemDetails?.y?.toFixed(2)}, w=${origItemDetails?.w?.toFixed(2)}, h=${origItemDetails?.h?.toFixed(2)}`);

    // Double click to open inline textarea
    log('  Double-clicking hit-box to trigger inline edit...');
    await cdp.mouseDoubleClick(targetHitPos.x, targetHitPos.y);
    await new Promise((r) => setTimeout(r, 300));

    // Verify textarea mounted
    const taMounted = await cdp.evaluate(`
      (() => {
        const ta = document.querySelector('textarea.inline-text-editor');
        if (ta) {
          ta.focus();
          ta.select();
          return { mounted: true, currentVal: ta.value };
        }
        return { mounted: false };
      })()
    `);
    assert.ok(taMounted.mounted, 'Inline textarea failed to mount on double click');
    log(`  ✓ Textarea mounted with initial value: "${taMounted.currentVal}"`);

    // Step 1A: Attempt to type unsupported Turkish character "Name: Ahmet Yılmaz" (with 'ı')
    log('  [Step 1A: Unsupported Character Test] Typing "Name: Ahmet Yılmaz" into standard Helvetica...');
    await cdp.typeString("Name: Ahmet Yılmaz");
    await new Promise((r) => setTimeout(r, 150));
    log('  Committing inline edit via Enter key event...');
    await cdp.sendKey('Enter', 'Enter', 13);
    await new Promise((r) => setTimeout(r, 400));

    // Verify fail-closed stop: no marks added, original text untouched
    const failClosedState = await cdp.evaluate(`
      (() => {
        const s = window.__formaTestApi?.getState?.() || {};
        return { marks: s.marks || [], removals: s.removals || [] };
      })()
    `);
    assert.equal(failClosedState.marks.length, 0, 'Fail-closed: No marks must be created when character is unsupported by font');
    log('  ✓ Fail-closed verified in UI: Operation safely stopped, original text preserved, 0 marks created.');

    // Step 1B: Double click again and type supported text "Name: Ahmet Yilmaz"
    log('  [Step 1B: Exact Source Font Preservation] Double clicking and typing "Name: Ahmet Yilmaz"...');
    await cdp.mouseDoubleClick(targetHitPos.x, targetHitPos.y);
    await new Promise((r) => setTimeout(r, 300));
    await cdp.evaluate(`
      (() => {
        const ta = document.querySelector('textarea.inline-text-editor');
        if (ta) { ta.focus(); ta.select(); }
      })()
    `);
    await cdp.sendKey('Backspace', 'Backspace', 8);
    await new Promise((r) => setTimeout(r, 100));

    const updatedSelectableText = "Name: Ahmet Yilmaz";
    await cdp.typeString(updatedSelectableText);
    await new Promise((r) => setTimeout(r, 150));
    await cdp.sendKey('Enter', 'Enter', 13);
    await new Promise((r) => setTimeout(r, 400));

    const postEditStateVector = await cdp.evaluate(`
      (() => {
        const s = window.__formaTestApi?.getState?.() || {};
        return { marks: s.marks || [], removals: s.removals || [] };
      })()
    `);
    const newVectorMark = postEditStateVector.marks.find(m => m.text?.includes('Ahmet'));
    assert.ok(newVectorMark, 'Mark for "Name: Ahmet Yilmaz" must be created');
    log(`  ✓ Edit committed. Created Mark: "${newVectorMark?.text}", Font: ${newVectorMark?.font}, Size: ${newVectorMark?.size}, MatchQuality: ${newVectorMark?.fontMatchQuality}`);

    // UI Export & Download
    log('  Triggering pure UI export and browser download...');
    const vectorDownload = await triggerDownload(cdp);

    const selectableExportPath = path.join(fixturesDir, 'selectable-exported.pdf');
    fs.writeFileSync(selectableExportPath, vectorDownload.bytes);

    // Independent inspection of exported PDF via parsePdfTextDetails
    const parsedExportedNormal = await parsePdfTextDetails(vectorDownload.bytes, 'Ahmet');
    assert.ok(parsedExportedNormal.length >= 1, 'Target text not found in exported PDF');
    const targetItem = parsedExportedNormal[0];
    log(`  [Independent Parser Verification (Normal PDF)]:`);
    log(`    - Text: "${targetItem.text}"`);
    log(`    - Font Name: "${targetItem.fontName}"`);
    log(`    - Bold: ${targetItem.bold}`);
    log(`    - Size (Punto): ${targetItem.size}`);
    log(`    - Color: ${targetItem.color}`);

    // Strict checks: MUST NOT contain duplicate "Name: Name:" and MUST be exactly "Name: Ahmet Yilmaz"
    const allItemsNormal = await parsePdfTextDetails(vectorDownload.bytes);
    const fullTextNormal = allItemsNormal.map(it => it.text).join(' ');
    log(`    - Full text stream (Normal): "${fullTextNormal}"`);
    assert.ok(!fullTextNormal.includes('Name: Name:'), 'Exported Normal PDF MUST NOT contain duplicate "Name: Name:"');
    assert.equal(targetItem.text, 'Name: Ahmet Yilmaz', 'Target text MUST be exactly "Name: Ahmet Yilmaz" once');

    // Strict checks: font changed on supported text -> FAIL!
    assert.equal(targetItem.fontName, 'Helvetica', 'Font family MUST be preserved as Helvetica');
    assert.equal(targetItem.bold, false, 'Font variant MUST be normal (bold === false)');
    assert.equal(targetItem.size, 14, 'Punto MUST be preserved as 14');
    assert.equal(newVectorMark.fontMatchQuality, 'aynı font korundu', 'Match quality must be "aynı font korundu"');

    // Crop & Diff analysis
    const vectorCropResult = await generateZoomCropComparison({
      origBytes: selectableFixture.bytes,
      exportBytes: vectorDownload.bytes,
      cropRectPdf: { x: 50, y: 140, w: 320, h: 45 },
      scale: 3.0,
      outPrefix: 'selectable-zoom',
      labelBefore: 'Orijinal: Name: Sukru Yildiz (Helvetica 14pt)',
      labelAfter: 'Çıktı: Name: Ahmet Yilmaz (Helvetica 14pt - Aynı Font Korundu)'
    });
    log(`  ✓ Selectable Zoom Crop generated: ${vectorCropResult.diffPixelCount} pixel differences.`);

    results.selectable = {
      original: {
        text: 'Name: Sukru Yildiz',
        fontDeclared: 'Helvetica (Type 1)',
        fontDetectedByForma: origItemDetails?.fontFamily,
        punto: origItemDetails?.size,
        color: origItemDetails?.color,
        bold: origItemDetails?.bold,
        x: origItemDetails?.x,
        y: origItemDetails?.y
      },
      exported: {
        text: targetItem.text,
        fontInExportPdf: targetItem.fontName,
        embedFontFamilyUsed: newVectorMark?.font,
        fontMatchQuality: newVectorMark?.fontMatchQuality,
        puntoUsed: targetItem.size,
        colorUsed: targetItem.color,
        bold: targetItem.bold,
        diffPixelCount: vectorCropResult.diffPixelCount,
        sideBySideCropFile: vectorCropResult.compFile
      }
    };

    // ------------------------------------------------------------------------
    // PART 1B: KALIN (BOLD) VECTOR PDF TEST
    // ------------------------------------------------------------------------
    log('\n========================================================================');
    log('  PART 1B: KALIN (BOLD) VECTOR PDF — "Name: Sukru Yildiz" -> "Name: Ahmet Yilmaz"');
    log('========================================================================');

    const selectableBoldFixture = await createSelectableBoldPdf();
    log(`✓ Created Selectable Bold Vector PDF fixture: ${selectableBoldFixture.filePath}`);

    await loadPdfIntoCleanWorkspace(cdp, selectableBoldFixture.bytes, 'selectable-bold-sample.pdf');
    await cdp.evaluate(`window.__formaTestApi?.setTool?.("select");`);
    await new Promise((r) => setTimeout(r, 400));

    // Find hit target in bold PDF
    let boldTargetHitPos = null;
    for (let i = 0; i < 40; i++) {
      const poll = await cdp.evaluate(`
        (() => {
          const hits = Array.from(document.querySelectorAll('rect.original-text-hit'));
          for (const el of hits) {
            const title = el.querySelector('title')?.textContent || el.getAttribute('title') || '';
            if (title.includes('Sukru') || title.includes('Name')) {
              const r = el.getBoundingClientRect();
              return { x: r.left + r.width / 2, y: r.top + r.height / 2, title };
            }
          }
          return null;
        })()
      `);
      if (poll) { boldTargetHitPos = poll; break; }
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.ok(boldTargetHitPos, 'Bold hit-box not found in workspace');
    log(`  ✓ Found bold text hit-box at (${boldTargetHitPos.x}, ${boldTargetHitPos.y})`);

    await cdp.mouseDoubleClick(boldTargetHitPos.x, boldTargetHitPos.y);
    await new Promise((r) => setTimeout(r, 300));
    await cdp.evaluate(`
      (() => {
        const ta = document.querySelector('textarea.inline-text-editor');
        if (ta) { ta.focus(); ta.select(); }
      })()
    `);
    await cdp.sendKey('Backspace', 'Backspace', 8);
    await new Promise((r) => setTimeout(r, 100));
    await cdp.typeString("Name: Ahmet Yilmaz");
    await new Promise((r) => setTimeout(r, 150));
    await cdp.sendKey('Enter', 'Enter', 13);
    await new Promise((r) => setTimeout(r, 400));

    const postEditBoldState = await cdp.evaluate(`
      (() => {
        const s = window.__formaTestApi?.getState?.() || {};
        return { marks: s.marks || [], removals: s.removals || [] };
      })()
    `);
    const boldMark = postEditBoldState.marks.find(m => m.text?.includes('Ahmet'));
    assert.ok(boldMark, 'Bold replacement mark must be created');
    log(`  ✓ Bold Edit committed: text="${boldMark?.text}", bold=${boldMark?.bold}, font=${boldMark?.font}, quality=${boldMark?.fontMatchQuality}`);

    log('  Triggering download for bold PDF...');
    const boldDownload = await triggerDownload(cdp);
    const parsedExportedBold = await parsePdfTextDetails(boldDownload.bytes, 'Ahmet');
    assert.ok(parsedExportedBold.length >= 1, 'Target text not found in exported bold PDF');
    const boldItem = parsedExportedBold[0];
    log(`  [Independent Parser Verification (Bold PDF)]:`);
    log(`    - Text: "${boldItem.text}"`);
    log(`    - Font Name: "${boldItem.fontName}"`);
    log(`    - Bold: ${boldItem.bold}`);
    log(`    - Size (Punto): ${boldItem.size}`);
    log(`    - Color: ${boldItem.color}`);

    // Strict checks: MUST NOT contain duplicate "Name: Name:" and MUST be exactly "Name: Ahmet Yilmaz"
    const allItemsBold = await parsePdfTextDetails(boldDownload.bytes);
    const fullTextBold = allItemsBold.map(it => it.text).join(' ');
    log(`    - Full text stream (Bold): "${fullTextBold}"`);
    assert.ok(!fullTextBold.includes('Name: Name:'), 'Exported Bold PDF MUST NOT contain duplicate "Name: Name:"');
    assert.equal(boldItem.text, 'Name: Ahmet Yilmaz', 'Exported bold text MUST be exactly "Name: Ahmet Yilmaz" once');

    // Strict checks: bold changed or converted to normal -> FAIL!
    assert.equal(boldItem.fontName, 'Helvetica-Bold', 'Font family MUST be preserved as Helvetica-Bold');
    assert.equal(boldItem.bold, true, 'Font variant MUST remain BOLD (bold === true)');
    assert.equal(boldItem.size, 14, 'Punto MUST be preserved as 14');
    assert.equal(boldMark.fontMatchQuality, 'aynı font korundu', 'Match quality must be "aynı font korundu"');
    log('  ✓ Bold PDF verified: BOLD VARIANT AND FONT PRESERVED 100% (Not converted to normal).');

    results.selectableBold = {
      original: { text: 'Name: Sukru Yildiz', font: 'Helvetica-Bold', bold: true, punto: 14, color: '#1f293b' },
      exported: { text: boldItem.text, font: boldItem.fontName, bold: boldItem.bold, punto: boldItem.size, color: boldItem.color, matchQuality: boldMark.fontMatchQuality }
    };

    // ========================================================================
    // PART 2: SCANNED RASTER PDF TEST (OCR FLOW)
    // ========================================================================
    log('\n========================================================================');
    log('  PART 2: SCANNED RASTER PDF — "Name: Sukru Yildiz" -> "Name: Ahmet Yilmaz" (OCR)');
    log('========================================================================');

    const scannedFixture = await createScannedPdf();
    log(`✓ Created Scanned Raster PDF fixture: ${scannedFixture.filePath} (${scannedFixture.bytes.length} bytes)`);

    // Upload clean scanned PDF
    await loadPdfIntoCleanWorkspace(cdp, scannedFixture.bytes, 'scanned-sample.pdf');

    // Trigger OCR toolbar button
    log('  Clicking "OCR ile Metinleri Düzenle" toolbar button...');
    const ocrBtnClicked = await cdp.evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const btn = buttons.find(b => b.textContent?.includes('OCR ile Metinleri Düzenle'));
        if (btn) { btn.click(); return true; }
        return false;
      })()
    `);
    assert.ok(ocrBtnClicked, 'Toolbar button "OCR ile Metinleri Düzenle" not found');

    // Wait for OcrModal
    let ocrModalOpen = false;
    for (let i = 0; i < 30; i++) {
      ocrModalOpen = await cdp.evaluate(`
        (() => {
          const d = document.querySelector('[role="dialog"]');
          return Boolean(d && d.textContent.includes('Yerel OCR'));
        })()
      `);
      if (ocrModalOpen) break;
      await new Promise((r) => setTimeout(r, 200));
    }
    assert.ok(ocrModalOpen, 'OcrModal failed to open');
    log('  ✓ OcrModal opened.');

    // Click "Metni Tanı ve Başlat"
    log('  Clicking "Metni Tanı ve Başlat"...');
    await cdp.evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('[role="dialog"] button'));
        const btn = buttons.find(b => b.textContent?.includes('Metni Tanı ve Başlat') || (b.textContent?.includes('Metni Tanı') && b.textContent?.includes('Başlat')));
        if (btn) btn.click();
      })()
    `);

    // Wait for OCR recognition to finish and click "Sayfada Düzenlemeye Başla"
    log('  Waiting for Tesseract OCR recognition to complete in browser...');
    let ocrFinished = false;
    for (let i = 0; i < 90; i++) {
      ocrFinished = await cdp.evaluate(`
        (() => {
          const buttons = Array.from(document.querySelectorAll('[role="dialog"] button'));
          const btn = buttons.find(b => b.textContent?.includes('Sayfada Düzenlemeye Başla'));
          if (btn) { btn.click(); return true; }
          return false;
        })()
      `);
      if (ocrFinished) break;
      await new Promise((r) => setTimeout(r, 1000));
    }
    assert.ok(ocrFinished, 'OCR recognition timed out or "Sayfada Düzenlemeye Başla" not clickable');
    log('  ✓ OCR completed and applied to workspace.');
    await new Promise((r) => setTimeout(r, 800));

    // Find OCR hit-box in SVG / textItems
    const ocrHitInfo = await cdp.evaluate(`
      (() => {
        const s = window.__formaTestApi?.getState?.();
        const items = s?.textItems || [];
        const match = items.find(it => (it.isOcr || it.id?.startsWith('ocr-')) && (it.text?.includes('Sukru') || it.text?.includes('Name')));
        if (match) {
          window.__formaTestApi?.setSelectedOriginal?.(match);
        }
        const hits = Array.from(document.querySelectorAll('rect.original-text-hit, rect.is-ocr'));
        for (const el of hits) {
          const title = el.querySelector('title')?.textContent || el.getAttribute('title') || '';
          if (title.includes('Sukru') || title.includes('Name')) {
            const r = el.getBoundingClientRect();
            return {
              x: r.left + r.width / 2,
              y: r.top + r.height / 2,
              title,
              item: match ? {
                id: match.id,
                text: match.text,
                x: match.x,
                y: match.y,
                w: match.w,
                h: match.h,
                size: match.size,
                fontFamily: match.fontFamily,
                originalFontName: match.originalFontName,
                ocrBackgroundColor: match.ocrBackgroundColor,
                ocrOriginalBounds: match.ocrOriginalBounds
              } : null
            };
          }
        }
        if (match) {
          return {
            x: 0,
            y: 0,
            title: match.text,
            item: {
              id: match.id,
              text: match.text,
              x: match.x,
              y: match.y,
              w: match.w,
              h: match.h,
              size: match.size,
              fontFamily: match.fontFamily,
              originalFontName: match.originalFontName,
              ocrBackgroundColor: match.ocrBackgroundColor,
              ocrOriginalBounds: match.ocrOriginalBounds
            }
          };
        }
        return null;
      })()
    `);
    assert.ok(ocrHitInfo && ocrHitInfo.item, 'OCR hit-box for "Name: Sukru Yildiz" not found');
    log(`  ✓ Found OCR hit-box title: "${ocrHitInfo.title}"`);
    const ocrItemDetails = ocrHitInfo.item;

    log(`  [OCR Detected Properties]:`);
    log(`    - Text: "${ocrItemDetails?.text}"`);
    log(`    - Detected FontFamily: ${ocrItemDetails?.fontFamily}`);
    log(`    - Original Font Name: ${ocrItemDetails?.originalFontName}`);
    log(`    - Punto / Size: ${ocrItemDetails?.size}`);
    log(`    - Sampled Background Color: ${ocrItemDetails?.ocrBackgroundColor}`);
    log(`    - Original Bounds: ${JSON.stringify(ocrItemDetails?.ocrOriginalBounds)}`);

    // Double click to open inline textarea
    log('  Double-clicking OCR hit-box to trigger inline edit...');
    await cdp.evaluate(`
      (() => {
        const s = window.__formaTestApi?.getState?.();
        const items = s?.textItems || [];
        const match = items.find(it => (it.isOcr || it.id?.startsWith('ocr-')) && (it.text?.includes('Sukru') || it.text?.includes('Name')));
        if (match) {
          window.__formaTestApi?.setSelectedOriginal?.(match);
          const rect = Array.from(document.querySelectorAll('rect.original-text-hit, rect.is-ocr')).find(r => {
            const t = r.querySelector('title')?.textContent || r.getAttribute('title') || '';
            return t.includes('Sukru') || t.includes('Name');
          });
          if (rect) {
            rect.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
          }
        }
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    // Verify textarea mounted and select all
    await cdp.evaluate(`
      (() => {
        const ta = document.querySelector('textarea.inline-text-editor');
        if (ta) {
          ta.focus();
          ta.select();
        }
      })()
    `);

    // Clear and type "Name: Ahmet Yilmaz"
    log('  Clearing text via Backspace key event...');
    await cdp.sendKey('Backspace', 'Backspace', 8);
    await new Promise((r) => setTimeout(r, 100));

    const updatedOcrText = "Name: Ahmet Yılmaz";
    log(`  Typing "${updatedOcrText}" via CDP keyboard events...`);
    await cdp.typeString(updatedOcrText);
    await new Promise((r) => setTimeout(r, 150));

    // Commit via Enter
    log('  Committing inline edit via Enter key event...');
    await cdp.sendKey('Enter', 'Enter', 13);
    await new Promise((r) => setTimeout(r, 150));
    await cdp.evaluate(`
      (() => {
        const ta = document.querySelector('textarea.inline-text-editor');
        if (ta) ta.blur();
      })()
    `);
    await new Promise((r) => setTimeout(r, 400));

    // Check post-edit marks in scanned mode
    const postEditStateScanned = await cdp.evaluate(`
      (() => {
        const s = window.__formaTestApi?.getState?.() || {};
        return {
          marks: s.marks || [],
          removals: s.removals || []
        };
      })()
    `);
    const scannedTextMark = postEditStateScanned.marks.find(m => m.kind === 'text' && m.text?.includes('Ahmet'));
    const scannedCoverMark = postEditStateScanned.marks.find(m => m.kind === 'highlight' && (m.id?.startsWith('cover-') || m.sourceId?.startsWith('ocr-') || m.image));
    log(`  ✓ Edit committed.`);
    log(`    - Cover Mark: id=${scannedCoverMark?.id}, color=${scannedCoverMark?.color}, w=${scannedCoverMark?.w}, h=${scannedCoverMark?.h}, hasImage=${Boolean(scannedCoverMark?.image)}`);
    log(`    - Text Mark: text="${scannedTextMark?.text}", font=${scannedTextMark?.font}, size=${scannedTextMark?.size}`);

    // UI Export & Download
    log('  Triggering pure UI export and browser download for scanned document...');
    const scannedDownload = await triggerDownload(cdp);

    const scannedExportPath = path.join(fixturesDir, 'scanned-exported.pdf');
    fs.writeFileSync(scannedExportPath, scannedDownload.bytes);

    // 300 DPI Rendering and Quantitative Visual Matching (300 DPI = scale 300 / 72)
    const scannedScale = 300 / 72;
    const scannedCropResult = await generateZoomCropComparison({
      origBytes: scannedFixture.bytes,
      exportBytes: scannedDownload.bytes,
      cropRectPdf: { x: 40, y: 110, w: 320, h: 50 },
      scale: scannedScale,
      labelBoundaryPt: 68,
      outPrefix: 'scanned-zoom',
      labelBefore: 'Orijinal: Taranmış Name: Sukru Yildiz (300 DPI)',
      labelAfter: 'Çıktı: Name: Ahmet Yılmaz (300 DPI - Görsel Eşleştirme)'
    });
    log(`  ✓ Scanned 300 DPI Zoom Crop generated: ${scannedCropResult.diffPixelCount} pixel differences in crop region.`);

    // Verify with pdfjs that the scanned exported PDF has no duplicated text
    const scannedDocTask = pdfjsLib.getDocument({ data: new Uint8Array(scannedDownload.bytes).slice(), disableFontFace: true });
    const scannedDoc = await scannedDocTask.promise;
    const scannedPage = await scannedDoc.getPage(1);
    const scannedContent = await scannedPage.getTextContent();
    const scannedItems = scannedContent.items.map(it => it.str);
    log(`  Text items in exported scanned PDF: ${JSON.stringify(scannedItems)}`);
    const ahmetItems = scannedItems.filter(s => s.includes('Ahmet'));
    assert.equal(ahmetItems.length, 1, 'Scanned PDF text duplication detected');
    assert.ok(scannedTextMark?.text === 'Ahmet Yılmaz', `Scanned text mark must only replace the name, leaving "Name:" untouched. Got: "${scannedTextMark?.text}"`);

    const scannedHasExactAhmet = scannedItems.some(s => s.includes('Ahmet Yılmaz') || s.includes('Yılmaz'));
    const scannedHasAsciiAhmet = scannedItems.some(s => s.includes('Ahmet Yilmaz') || s.includes('Yilmaz'));
    const scannedHasOldSukru = scannedItems.some(s => s.includes('Sukru Yildiz'));
    assert.ok(scannedHasExactAhmet, 'Exported scanned PDF did not contain exact Turkish string "Ahmet Yılmaz"');
    assert.ok(!scannedHasAsciiAhmet, 'Exported scanned PDF contained ASCII fallback "Ahmet Yilmaz"');
    assert.ok(!scannedHasOldSukru, 'Exported scanned PDF still contained original name "Sukru Yildiz"');

    // Strict visual matching quality check: MUST be "görsel eşleştirme"
    assert.equal(scannedTextMark?.fontMatchQuality, 'görsel eşleştirme', 'Scanned PDF replacement MUST be classified as "görsel eşleştirme"');
    assert.equal(scannedTextMark?.bold, true, 'Scanned replacement mark MUST be bold (matching bold typewriter source)');
    assert.ok((scannedTextMark?.size || 0) >= 16, `Scanned replacement mark size MUST match source line letter height (~16-17pt), got ${scannedTextMark?.size}`);

    // Strict visual & geometry check: cover mark must fully blanket all ascenders and descenders of the old name
    assert.ok(scannedCoverMark && scannedCoverMark.h >= 18, `Cover mark height must be >= 18 to fully enclose typewriter ascenders/descenders, got ${scannedCoverMark?.h}`);

    // ------------------------------------------------------------------------
    // Quantitative 300 DPI Empirical Measurements
    // ------------------------------------------------------------------------
    const cBefore = scannedCropResult.cBefore;
    const cAfter = scannedCropResult.cAfter;
    const dBefore = cBefore.getContext('2d').getImageData(0, 0, cBefore.width, cBefore.height).data;
    const dAfter = cAfter.getContext('2d').getImageData(0, 0, cAfter.width, cAfter.height).data;

    const labelBoundaryPx = Math.round(68 * scannedScale);
    const nameEndPx = Math.round((240 - 40) * scannedScale);

    // 1. Measure letter height of "Sukru Yildiz" in original at 300 DPI
    let origMinY = cBefore.height, origMaxY = 0;
    for (let y = 0; y < cBefore.height; y++) {
      for (let x = labelBoundaryPx + 10; x < nameEndPx; x++) {
        const idx = (y * cBefore.width + x) * 4;
        if (dBefore[idx] < 100 && dBefore[idx+1] < 100 && dBefore[idx+2] < 100) {
          if (y < origMinY) origMinY = y;
          if (y > origMaxY) origMaxY = y;
        }
      }
    }
    const origLetterHeightPx = origMaxY >= origMinY ? (origMaxY - origMinY + 1) : 0;
    const origLetterHeightPt = Math.round((origLetterHeightPx / scannedScale) * 10) / 10;

    // 2. Measure letter height and stroke thickness of "Ahmet Yılmaz" in new output at 300 DPI
    let newMinY = cAfter.height, newMaxY = 0;
    let newStrokeRuns = 0, newTotalRun = 0;
    for (let y = 0; y < cAfter.height; y++) {
      let curRun = 0;
      for (let x = labelBoundaryPx + 10; x < nameEndPx; x++) {
        const idx = (y * cAfter.width + x) * 4;
        if (dAfter[idx] < 100 && dAfter[idx+1] < 100 && dAfter[idx+2] < 100) {
          if (y < newMinY) newMinY = y;
          if (y > newMaxY) newMaxY = y;
          curRun++;
        } else {
          if (curRun > 0) { newTotalRun += curRun; newStrokeRuns++; curRun = 0; }
        }
      }
      if (curRun > 0) { newTotalRun += curRun; newStrokeRuns++; }
    }
    const newLetterHeightPx = newMaxY >= newMinY ? (newMaxY - newMinY + 1) : 0;
    const newLetterHeightPt = Math.round((newLetterHeightPx / scannedScale) * 10) / 10;
    const newStrokeThicknessPx = newStrokeRuns > 0 ? (newTotalRun / newStrokeRuns) : 0;

    log(`  [Quantitative 300 DPI Visual Matching Metrics]:`);
    log(`    - "Name:" Label Region Pixel Difference: ${scannedCropResult.labelDiffPixelCount} px (Must be <= 5, untouched)`);
    log(`    - Original Text Letter Height: ${origLetterHeightPx} px (~${origLetterHeightPt} pt at 300 DPI)`);
    log(`    - New Text Letter Height: ${newLetterHeightPx} px (~${newLetterHeightPt} pt at 300 DPI)`);
    log(`    - Letter Height Match Ratio: ${(newLetterHeightPx / Math.max(1, origLetterHeightPx) * 100).toFixed(1)}%`);
    log(`    - New Text Stroke Thickness: ${newStrokeThicknessPx.toFixed(2)} px (Bold typewriter >= 5px)`);

    // Strict assertions:
    assert.ok(scannedCropResult.labelDiffPixelCount <= 5, `"Name:" label pixels were modified! Expected <= 5, got ${scannedCropResult.labelDiffPixelCount}`);
    assert.ok(newLetterHeightPx >= 40, `New text is visibly small! Expected height >= 40px at 300 DPI, got ${newLetterHeightPx}px`);
    assert.ok(Math.abs(newLetterHeightPx - origLetterHeightPx) <= 6, `New text height does not match source line! Orig: ${origLetterHeightPx}px, New: ${newLetterHeightPx}px`);
    assert.ok(newStrokeThicknessPx >= 5.0, `New text is visibly thin! Expected stroke thickness >= 5.0px at 300 DPI, got ${newStrokeThicknessPx.toFixed(2)}px`);
    log('  ✓ Quantitative 300 DPI visual matching PASSED: "Name:" untouched, letter height & stroke thickness visually matched!');

    // Visual crop inspection: verify no dark ink remnants or dashed patch traces remain past the replacement name
    const pastNameXStart = Math.round((235 - 40) * scannedScale);
    const pastNameXEnd = Math.round((280 - 40) * scannedScale);
    let remnantDarkPixels = 0;
    for (let py = Math.round(10 * scannedScale); py < Math.round(40 * scannedScale); py++) {
      for (let px = pastNameXStart; px < pastNameXEnd; px++) {
        const idx = (py * cAfter.width + px) * 4;
        const r = dAfter[idx], g = dAfter[idx+1], b = dAfter[idx+2];
        if (r < 120 && g < 120 && b < 120) {
          remnantDarkPixels++;
        }
      }
    }
    assert.equal(remnantDarkPixels, 0, `Detected ${remnantDarkPixels} old letter remnants/patch traces past the replaced name!`);
    log('  ✓ Scanned visual verification: ZERO old letter remnants or dashed patch traces detected!');

    results.scanned = {
      original: {
        text: 'Name: Sukru Yildiz',
        nature: 'Pure Raster Image (Taranmış Piksel / No Vector Stream)',
        detectedFontFamily: ocrItemDetails?.fontFamily,
        detectedPunto: ocrItemDetails?.size,
        sampledBackground: ocrItemDetails?.ocrBackgroundColor,
        letterHeight300Dpi: origLetterHeightPx,
        paperTexturePresent: true
      },
      exported: {
        text: scannedTextMark?.text,
        fontUsed: scannedTextMark?.font,
        fontMatchQuality: scannedTextMark?.fontMatchQuality,
        puntoUsed: scannedTextMark?.size,
        bold: scannedTextMark?.bold,
        textDuplicationPrevented: ahmetItems.length === 1,
        labelUntouched: scannedCropResult.labelDiffPixelCount <= 5,
        labelDiffPixels: scannedCropResult.labelDiffPixelCount,
        newLetterHeight300Dpi: newLetterHeightPx,
        newStrokeThickness300Dpi: Math.round(newStrokeThicknessPx * 10) / 10,
        coverMarkPresent: Boolean(scannedCoverMark),
        coverHasTextureImage: Boolean(scannedCoverMark?.image),
        coverColor: scannedCoverMark?.color,
        coverBounds: { x: scannedCoverMark?.x, y: scannedCoverMark?.y, w: scannedCoverMark?.w, h: scannedCoverMark?.h },
        paperTexturePreserved: Boolean(scannedCoverMark?.image),
        diffPixelCount: scannedCropResult.diffPixelCount,
        sideBySideCropFile: scannedCropResult.compFile
      }
    };

    // ========================================================================
    // PART 3: FORMA AI COPILOT EVALUATION
    // ========================================================================
    log('\n========================================================================');
    log('  PART 3: FORMA AI COPILOT CAPABILITY EVALUATION');
    log('========================================================================');

    // Reload selectable PDF so we have a clean target with "Name: Sukru Yildiz"
    log('  Reloading selectable-sample.pdf to workspace for AI Copilot evaluation...');
    await loadPdfIntoCleanWorkspace(cdp, selectableFixture.bytes, 'selectable-sample.pdf');
    log('  ✓ Selectable PDF active in workspace for Copilot.');

    // Add prior user annotation to workspace to verify non-wiping/preservation across AI action
    log('  Adding an independent prior annotation ("PRIOR-AUDIT-STAMP-2026") before running Copilot...');
    const priorMarkAdded = await cdp.evaluate(`
      (() => {
        const mark = {
          id: 'prior-audit-stamp-id',
          page: 0,
          kind: 'text',
          x: 60,
          y: 450,
          w: 240,
          h: 22,
          size: 12,
          color: '#047857',
          text: 'PRIOR-AUDIT-STAMP-2026',
          font: 'sans',
          bold: true,
          italic: false
        };
        if (window.__formaTestApi?.addMark) {
          window.__formaTestApi.addMark(mark);
        } else if (window.__formaTestApi?.setState) {
          const s = window.__formaTestApi.getState?.() || {};
          window.__formaTestApi.setState({
            ...s,
            marks: [...(s.marks || []), mark]
          });
        }
        const check = window.__formaTestApi?.getState?.() || {};
        return Boolean(check.marks?.some(m => m.text?.includes('PRIOR-AUDIT-STAMP-2026')));
      })()
    `);
    assert.ok(priorMarkAdded, 'Failed to inject prior annotation into workspace state');
    log('  ✓ Prior annotation successfully added and verified in state.marks.');

    const aiPrompt1 = "Name: Sukru Yildiz satırındaki Sukru Yildiz ismini Ahmet Yılmaz ile değiştir";
    const aiPrompt2 = "belgedeki Sukru Yildiz yazısını Ahmet Yilmaz olarak değiştir";

    // Click floating trigger button to open AI Copilot if not open
    log('  Opening Copilot panel...');
    let isModalOpen = await cdp.evaluate(`Boolean(document.querySelector('.forma-ai-modal'))`);
    if (!isModalOpen) {
      await cdp.evaluate(`
        (() => {
          const btn = document.querySelector('.forma-ai-trigger');
          if (btn) btn.click();
        })()
      `);
      for (let i = 0; i < 20; i++) {
        isModalOpen = await cdp.evaluate(`Boolean(document.querySelector('.forma-ai-modal'))`);
        if (isModalOpen) break;
        await new Promise((r) => setTimeout(r, 200));
      }
    }
    assert.ok(isModalOpen, 'Forma AI modal failed to open');
    log('  ✓ Forma AI modal open in DOM.');

    // Type prompt into Copilot input and send
    log(`  Sending user message to Copilot: "${aiPrompt1}"...`);
    const sendResult = await cdp.evaluate(`
      (() => {
        const modal = document.querySelector('.forma-ai-modal');
        if (!modal) return { ok: false, error: 'Modal not found in DOM' };
        const input = modal.querySelector('input[type="text"]');
        if (!input) return { ok: false, error: 'Input inside modal not found' };

        // Set value via native prototype setter so React picks up the change
        const valSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
        if (valSetter) {
          valSetter.call(input, "${aiPrompt1}");
        } else {
          input.value = "${aiPrompt1}";
        }
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));

        const form = input.closest('form');
        if (form) {
          form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
          return { ok: true, via: 'form_submit' };
        }

        const sendBtn = modal.querySelector('button[type="submit"]') || Array.from(modal.querySelectorAll('button')).find(b => b.querySelector('svg.lucide-send') || b.getAttribute('aria-label') === 'Gönder');
        if (sendBtn) {
          sendBtn.click();
          return { ok: true, via: 'send_btn' };
        }
        return { ok: false, error: 'Neither form nor sendBtn found' };
      })()
    `);
    log(`  Copilot message submission result: ${JSON.stringify(sendResult)}`);

    // Wait for Copilot response and Action Plan Confirmation Card
    log('  Waiting for Copilot Action Plan Preview Card...');
    let planCardFound = false;
    let planTitle = '';
    for (let i = 0; i < 40; i++) {
      const poll = await cdp.evaluate(`
        (() => {
          const btns = Array.from(document.querySelectorAll('button'));
          const confirmBtn = btns.find(b => b.textContent?.includes('Onayla ve Uygula'));
          const divs = Array.from(document.querySelectorAll('div'));
          const cardEl = divs.find(d => d.textContent?.includes('Akıllı Metin') || d.textContent?.includes('Değiştirme') || d.textContent?.includes('Sukru Yildiz'));
          if (confirmBtn) {
            return { found: true, title: cardEl?.textContent?.trim() || '' };
          }
          return { found: false };
        })()
      `);
      if (poll.found) {
        planCardFound = true;
        planTitle = poll.title;
        break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    assert.ok(planCardFound, 'Action Plan Preview Card with "Onayla ve Uygula" not displayed');
    log(`  ✓ Action Plan Preview Card verified in DOM.`);

    // Capture screenshot of Action Plan Confirmation Card
    const confirmCardShotPath = path.join(cropsDir, 'ai-copilot-confirm-card.png');
    await cdp.screenshot(confirmCardShotPath);
    log(`  ✓ Action Plan Confirmation Card screenshot saved to: ${confirmCardShotPath}`);

    // Click "Onayla ve Uygula"
    log('  Clicking "Onayla ve Uygula" button...');
    await cdp.evaluate(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const confirmBtn = btns.find(b => b.textContent?.includes('Onayla ve Uygula'));
        if (confirmBtn) confirmBtn.click();
      })()
    `);

    // Wait for execution to trigger fail-closed character warning
    log('  Waiting for fail-closed character warning message in Copilot...');
    let warningFound = false;
    for (let i = 0; i < 40; i++) {
      const poll = await cdp.evaluate(`
        (() => {
          const text = document.body.innerText || '';
          const hasWarning = text.includes('Bu karakter mevcut yazı tipiyle yazılamıyor');
          const approxBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Yaklaşık Yazı Tipi İle Uygula'));
          return { hasWarning, hasApproxBtn: Boolean(approxBtn) };
        })()
      `);
      if (poll.hasWarning && poll.hasApproxBtn) {
        warningFound = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    assert.ok(warningFound, 'Copilot failed to display fail-closed warning "Bu karakter mevcut yazı tipiyle yazılamıyor" and approx button');
    log('  ✓ Fail-closed character stop verified in Copilot: "Bu karakter mevcut yazı tipiyle yazılamıyor" displayed with [Yaklaşık Yazı Tipi İle Uygula] button.');

    // Step 3B: Click [Yaklaşık Yazı Tipi İle Uygula]
    log('  Clicking [Yaklaşık Yazı Tipi İle Uygula] button to test explicit approximate font opt-in...');
    await cdp.evaluate(`
      (() => {
        const approxBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Yaklaşık Yazı Tipi İle Uygula'));
        if (approxBtn) approxBtn.click();
      })()
    `);

    // Wait for execution with approximate font to complete
    log('  Waiting for approximate font replacement execution to complete...');
    let assistantDone = false;
    let doneText = '';
    for (let i = 0; i < 60; i++) {
      const poll = await cdp.evaluate(`
        (() => {
          const messages = Array.from(document.querySelectorAll('.rounded-2xl, div[class*="assistant"]'));
          const successMsg = messages.find(m => m.textContent?.includes('güncellendi') || m.textContent?.includes('başarıyla'));
          if (successMsg) return { done: true, text: successMsg.textContent.trim() };
          const errorMsg = messages.find(m => m.textContent?.includes('hata oluştu'));
          if (errorMsg) return { done: true, text: errorMsg.textContent.trim(), error: true };
          return { done: false };
        })()
      `);
      if (poll.done) {
        assistantDone = true;
        doneText = poll.text;
        assert.ok(!poll.error, `AI Action execution failed: ${poll.text}`);
        break;
      }
      await new Promise((r) => setTimeout(r, 400));
    }
    assert.ok(assistantDone, 'AI Action execution timed out without success confirmation');
    log(`  ✓ AI Action confirmed: "${doneText}"`);

    // Trigger download of AI-modified PDF from workspace toolbar
    log('  Triggering download of AI-modified PDF via toolbar...');
    const aiDownload = await triggerDownload(cdp);
    const aiExportPath = path.join(fixturesDir, 'ai-modified-exported.pdf');
    fs.writeFileSync(aiExportPath, aiDownload.bytes);
    log(`  ✓ Downloaded AI-modified PDF: ${aiExportPath} (${aiDownload.bytes.length} bytes)`);

    // Verify downloaded PDF with pdfjs
    const aiCloned = new Uint8Array(aiDownload.bytes).slice();
    const aiPdfDoc = await pdfjsLib.getDocument({ data: aiCloned, disableFontFace: true }).promise;
    const aiP1 = await aiPdfDoc.getPage(1);
    const aiContent = await aiP1.getTextContent();
    const aiStrs = aiContent.items.map(it => it.str).filter(s => s.trim().length > 0);
    log(`  Extracted text items in AI-exported PDF: ${JSON.stringify(aiStrs)}`);

    const hasNameLabel = aiStrs.some(s => s.includes('Name:') || s.trim() === 'Name');
    const aiHasExactAhmet = aiStrs.some(s => s.includes('Ahmet Yılmaz'));
    const aiHasAsciiAhmet = aiStrs.some(s => s.includes('Ahmet Yilmaz'));
    const aiHasOldSukru = aiStrs.some(s => s.includes('Sukru Yildiz'));
    const hasPriorStamp = aiStrs.some(s => s.includes('PRIOR-AUDIT-STAMP-2026'));

    assert.ok(hasNameLabel, 'Label "Name:" was accidentally removed from PDF by AI replacement');
    assert.ok(aiHasExactAhmet, 'New name "Ahmet Yılmaz" not found in AI-exported PDF');
    assert.ok(!aiHasAsciiAhmet, 'Exported AI PDF contained ASCII fallback "Ahmet Yilmaz"');
    assert.ok(!aiHasOldSukru, 'Exported AI PDF still contained original name "Sukru Yildiz"');
    assert.ok(hasPriorStamp, 'CRITICAL: Prior user annotation ("PRIOR-AUDIT-STAMP-2026") was LOST after AI action!');
    log('  ✓ Verified: AI replacement kept "Name:" intact and successfully replaced "Sukru Yildiz" with "Ahmet Yılmaz"!');
    log('  ✓ Verified: Prior user annotation ("PRIOR-AUDIT-STAMP-2026") was 100% PRESERVED alongside AI modification (ZERO DATA LOSS)!');

    // Test Undo / Rollback in Copilot
    log('  Testing Copilot undo / rollback capability...');
    const undoClicked = await cdp.evaluate(`
      (() => {
        const btns = Array.from(document.querySelectorAll('button'));
        const undoBtn = btns.find(b => b.textContent?.includes('Geri Al') || b.querySelector('.lucide-undo'));
        if (undoBtn) { undoBtn.click(); return true; }
        return false;
      })()
    `);
    if (undoClicked) {
      await new Promise((r) => setTimeout(r, 600));
      log('  ✓ Rollback action triggered successfully.');
    }

    // Direct module intent parser verification via node runtime with esbuild
    const esbuild = require('esbuild');
    const tsCode = fs.readFileSync(path.join(projectRoot, 'features', 'ai-copilot', 'aiIntentEngine.ts'), 'utf8');
    const jsCode = esbuild.transformSync(tsCode, { loader: 'ts', format: 'esm' }).code;
    const dataUri = 'data:text/javascript;base64,' + Buffer.from(jsCode).toString('base64');
    const { parseUserIntent } = await import(dataUri);

    const parsedIntent1 = parseUserIntent(aiPrompt1);
    const parsedIntent2 = parseUserIntent(aiPrompt2);
    const parsedIntent3 = parseUserIntent("Sukru Yildiz yazisini Ahmet Yilmaz olarak degistir");

    log(`\n  [AI Intent Engine Direct Analysis]:`);
    log(`    Prompt 1 (Kullanıcının tam cümlesi): "${aiPrompt1}"`);
    log(`      -> Action: ${parsedIntent1.action}`);
    log(`      -> Confidence: ${parsedIntent1.confidence}`);
    log(`      -> Parameters: ${JSON.stringify(parsedIntent1.parameters)}`);
    log(`      -> Explanation: ${parsedIntent1.explanation}`);

    log(`    Prompt 2: "${aiPrompt2}"`);
    log(`      -> Action: ${parsedIntent2.action}`);
    log(`      -> Confidence: ${parsedIntent2.confidence}`);
    log(`      -> Parameters: ${JSON.stringify(parsedIntent2.parameters)}`);

    results.aiCopilot = {
      promptTested: aiPrompt1,
      userPromptIntent: {
        action: parsedIntent1.action,
        confidence: parsedIntent1.confidence,
        parameters: parsedIntent1.parameters,
        explanation: parsedIntent1.explanation
      },
      matchedAsciiPromptIntent: {
        action: parsedIntent3.action,
        confidence: parsedIntent3.confidence,
        parameters: parsedIntent3.parameters,
        suggestedReply: parsedIntent3.suggestedReply
      },
      dispatcherHasHandler: true,
      documentModifiedByAi: true,
      confirmationCardVerified: true,
      exportedPdfVerified: true,
      priorUserEditPreserved: true,
      copilotUiReply: doneText,
      confirmCardScreenshot: confirmCardShotPath
    };

    // ========================================================================
    // PART 4: GEOMETRY, MULTI-MATCH & LENGTH VARIATION VERIFICATION
    // ========================================================================
    log('\n========================================================================');
    log('  PART 4: GEOMETRY, MULTI-MATCH & LENGTH VARIATION VERIFICATION');
    log('========================================================================');

    // Create a multi-match vector fixture
    const multiDoc = await PDFDocument.create();
    const mPage = multiDoc.addPage([600, 400]);
    const helv = await multiDoc.embedFont(StandardFonts.Helvetica);
    mPage.drawText("Name: Sukru Yildiz / Ref: Sukru Yildiz", { x: 50, y: 300, size: 14, font: helv });
    const multiPdfBytes = await multiDoc.save();

    // Import dispatcher directly
    const tempBundlePath = path.join(testDir, 'temp-dispatcher.mjs');
    esbuild.buildSync({
      entryPoints: [path.join(projectRoot, 'features', 'ai-copilot', 'aiActionDispatcher.ts')],
      outfile: tempBundlePath,
      bundle: true,
      format: 'esm',
      platform: 'node',
      packages: 'external'
    });
    const { dispatchAiAction } = await import(pathToFileURL(tempBundlePath).href);

    // Fail-Closed Character Check
    log('  Testing fail-closed character stop when replacing with unsupported Turkish "ı" without approx flag...');
    const failClosedCheck = await dispatchAiAction(
      {
        action: 'find_replace',
        parameters: { searchTerm: 'Sukru Yildiz', replaceTerm: 'Ahmet Yılmaz' },
        confidence: 1,
        explanation: 'Fail-closed check',
        suggestedReply: ''
      },
      { pdfBytes: multiPdfBytes, allowApproximateFont: false }
    );
    assert.equal(failClosedCheck.success, false, 'Must stop when character unsupported');
    assert.equal(failClosedCheck.stoppedDueToUnsupportedChars, true, 'stoppedDueToUnsupportedChars flag must be true');
    assert.ok(failClosedCheck.message.includes('Bu karakter mevcut yazı tipiyle yazılamıyor'));
    log('  ✓ Fail-closed verified: safely stopped with "Bu karakter mevcut yazı tipiyle yazılamıyor".');

    log('  Testing multi-match on same line ("Name: Sukru Yildiz / Ref: Sukru Yildiz") with approx font opt-in...');
    const multiResult = await dispatchAiAction(
      {
        action: 'find_replace',
        parameters: { searchTerm: 'Sukru Yildiz', replaceTerm: 'Ahmet Yılmaz', allowApproximateFont: true },
        confidence: 1,
        explanation: 'Multi match test',
        suggestedReply: ''
      },
      { pdfBytes: multiPdfBytes, allowApproximateFont: true }
    );
    assert.ok(multiResult.success, 'Multi-match execution failed');
    assert.equal(multiResult.metadata?.matchCount, 2, 'Expected exactly 2 matches on line');
    assert.equal(multiResult.newMarks?.length, 2, 'Expected exactly 2 replacement marks');
    assert.equal(multiResult.newRemovals?.length, 2, 'Expected exactly 2 removals');
    assert.notEqual(multiResult.newMarks[0].x, multiResult.newMarks[1].x, 'Mark X positions must not be identical');
    assert.ok(multiResult.metadata?.fontMatchQuality === 'yaklaşık eşleşme', 'Must be marked as yaklaşık eşleşme');
    log('  ✓ Multi-match verified: 2 distinct matches, 2 non-overlapping marks with exact sub-quads.');

    log('  Testing length variation: shorter replacement ("Can")...');
    const shortResult = await dispatchAiAction(
      {
        action: 'find_replace',
        parameters: { searchTerm: 'Sukru Yildiz', replaceTerm: 'Can' },
        confidence: 1,
        explanation: 'Short test',
        suggestedReply: ''
      },
      { pdfBytes: multiPdfBytes }
    );
    assert.ok(shortResult.success);
    assert.ok(shortResult.newMarks[0].w < multiResult.newMarks[0].w, 'Shorter replacement width must be smaller');

    log('  Testing length variation: longer replacement ("Prof. Dr. Ahmet Yılmaz")...');
    const longResult = await dispatchAiAction(
      {
        action: 'find_replace',
        parameters: { searchTerm: 'Sukru Yildiz', replaceTerm: 'Prof. Dr. Ahmet Yılmaz', allowApproximateFont: true },
        confidence: 1,
        explanation: 'Long test',
        suggestedReply: ''
      },
      { pdfBytes: multiPdfBytes, allowApproximateFont: true }
    );
    assert.ok(longResult.success);
    assert.ok(longResult.newMarks[0].w > multiResult.newMarks[0].w, 'Longer replacement width must be larger');
    log('  ✓ Geometry scaling verified: shorter ("Can") < target ("Ahmet Yılmaz") < longer ("Prof. Dr. Ahmet Yılmaz").');

    results.geometryAndMultiMatch = {
      multiMatchHandled: true,
      matchCount: multiResult.metadata?.matchCount,
      marksCreated: multiResult.newMarks?.length,
      mark1X: multiResult.newMarks[0].x,
      mark2X: multiResult.newMarks[1].x,
      shortWidth: shortResult.newMarks[0].w,
      targetWidth: multiResult.newMarks[0].w,
      longWidth: longResult.newMarks[0].w,
      widthScalingValid: shortResult.newMarks[0].w < multiResult.newMarks[0].w && multiResult.newMarks[0].w < longResult.newMarks[0].w
    };

    // Save full JSON audit results
    const resultsJsonPath = path.join(testDir, 'fidelity-results.json');
    fs.writeFileSync(resultsJsonPath, JSON.stringify(results, null, 2), 'utf8');
    log(`\n✓ Audit results written to: ${resultsJsonPath}`);

    log('\n========================================================================');
    log('  AUDIT COMPLETE: All empirical tests passed without error.');
    log('========================================================================\n');

  } finally {
    try { pageWs?.close(); } catch {}
    if (chromeProc && chromeProc.pid) {
      log('Shutting down Chrome cleanly...');
      try {
        if (process.platform === 'win32') {
          spawnSync('taskkill', ['/pid', chromeProc.pid.toString(), '/f', '/t'], { stdio: 'ignore' });
        } else {
          chromeProc.kill('SIGTERM');
        }
      } catch {}
    }
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
    if (devServerProc && devServerProc.pid) {
      log('Shutting down dev server cleanly...');
      try {
        if (process.platform === 'win32') {
          spawnSync('taskkill', ['/pid', devServerProc.pid.toString(), '/f', '/t'], { stdio: 'ignore' });
        } else {
          devServerProc.kill('SIGTERM');
        }
      } catch {}
    }
  }
}

runFidelityAudit()
  .then(() => {
    log('Done with exit code 0.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ AUDIT FAILED WITH ERROR:', err);
    fs.appendFileSync(logFile, `\n[FATAL ERROR] ${err.stack || err.message}\n`);
    process.exit(1);
  });

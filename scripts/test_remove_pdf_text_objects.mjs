import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import sharp from 'sharp';

// 60-Second Watchdog Timer
const watchdog = setTimeout(() => {
  console.error('WATCHDOG TIMEOUT: removePdfTextObjects test exceeded 60s limit.');
  process.exit(1);
}, 60000);

// Node 20 Polyfills for pdfjs-dist
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
    const len = newByteLength !== undefined ? newByteLength : this.byteLength;
    const newBuf = new ArrayBuffer(len);
    const copyLen = Math.min(this.byteLength, len);
    new Uint8Array(newBuf).set(new Uint8Array(this, 0, copyLen));
    return newBuf;
  };
}

if (!ArrayBuffer.prototype.transfer) {
  ArrayBuffer.prototype.transfer = function (newByteLength) {
    const len = newByteLength !== undefined ? newByteLength : this.byteLength;
    const newBuf = new ArrayBuffer(len);
    const copyLen = Math.min(this.byteLength, len);
    new Uint8Array(newBuf).set(new Uint8Array(this, 0, copyLen));
    return newBuf;
  };
}

const { PDFDocument, rgb, degrees } = await import('pdf-lib');
const fontkit = (await import('@pdf-lib/fontkit')).default;
const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

import { removePdfTextObjects, clearPdfiumDocCache } from '../lib/pdf-text.ts';

async function renderPageTo300Dpi(pdfBytes, pageNumber = 1) {
  const pureBytes = new Uint8Array(pdfBytes.buffer, pdfBytes.byteOffset, pdfBytes.byteLength);
  const loadingTask = pdfjsLib.getDocument({
    data: pureBytes.slice(),
    cMapUrl: 'public/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: 'public/standard_fonts/'
  });
  const doc = await loadingTask.promise;
  try {
    const page = await doc.getPage(pageNumber);
    const scale = 300 / 72; // 300 DPI
    const viewport = page.getViewport({ scale });
    const width = Math.round(viewport.width);
    const height = Math.round(viewport.height);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toBuffer('image/png');
  } finally {
    try { await doc.destroy(); } catch {}
  }
}

async function runTest() {
  console.log('=== TEST: removePdfTextObjects ===');
  clearPdfiumDocCache();

  // 1. Generate test PDF containing legitimate contract clauses and a diagonal TASLAK watermark
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const liberationRegular = await doc.embedFont(fs.readFileSync('public/fonts/LiberationSans-Regular.ttf'));
  const liberationBold = await doc.embedFont(fs.readFileSync('public/fonts/LiberationSans-Bold.ttf'));

  const p1 = doc.addPage([595.28, 841.89]);
  p1.drawText('MADDE 1: GENEL HÜKÜMLER', { x: 50, y: 780, size: 14, font: liberationBold });
  p1.drawText('Bu sözleşme taraflar arasındaki hizmet alımını düzenler.', { x: 50, y: 750, size: 11, font: liberationRegular });
  p1.drawText('TASLAK', {
    x: 180,
    y: 420,
    size: 64,
    font: liberationBold,
    color: rgb(0.82, 0.82, 0.82),
    rotate: degrees(45)
  });

  const originalBytes = await doc.save();
  console.log(`Original PDF generated: ${originalBytes.length} bytes`);

  // Verify text content before removal
  const docBefore = await pdfjsLib.getDocument({ data: originalBytes.slice() }).promise;
  const pageBefore = await docBefore.getPage(1);
  const textBefore = await pageBefore.getTextContent();
  const stringsBefore = textBefore.items.map(it => it.str).filter(Boolean);
  console.log('Text items before removal:', JSON.stringify(stringsBefore));
  assert.ok(stringsBefore.includes('TASLAK'), 'Watermark TASLAK must be present before removal');
  assert.ok(stringsBefore.includes('MADDE 1: GENEL HÜKÜMLER'), 'Contract title must be present');

  // Render before image at 300 DPI
  const imgBefore = await renderPageTo300Dpi(originalBytes, 1);

  // 2. Execute removePdfTextObjects targeting the watermark
  const target = {
    candidateTexts: ['TASLAK'],
    candidateItems: [{ id: 'target-cand-1', text: 'TASLAK' }],
    targetPages: [0],
    keywords: ['TASLAK']
  };

  const startTime = Date.now();
  const res = await removePdfTextObjects(originalBytes.slice(), target);
  const durationMs = Date.now() - startTime;

  console.log(`removePdfTextObjects completed in ${durationMs}ms`);
  console.log(`  removedCount: ${res.removedCount}`);
  console.log(`  removedCandidateIds: ${JSON.stringify(res.removedCandidateIds)}`);
  console.log(`  result PDF bytes: ${res.bytes.length}`);

  // Assertions
  assert.strictEqual(res.removedCount, 1, 'Exactly 1 text object must be removed');
  assert.ok(res.removedCandidateIds.includes('target-cand-1'), 'Candidate ID must be marked removed');

  // Verify text content after removal
  const docAfter = await pdfjsLib.getDocument({ data: res.bytes.slice() }).promise;
  const pageAfter = await docAfter.getPage(1);
  const textAfter = await pageAfter.getTextContent();
  const stringsAfter = textAfter.items.map(it => it.str).filter(Boolean);
  console.log('Text items after removal:', JSON.stringify(stringsAfter));

  assert.ok(!stringsAfter.includes('TASLAK'), 'Watermark TASLAK must be completely absent from PDF stream');
  assert.ok(stringsAfter.includes('MADDE 1: GENEL HÜKÜMLER'), 'Contract title must be strictly preserved');
  assert.ok(stringsAfter.includes('Bu sözleşme taraflar arasındaki hizmet alımını düzenler.'), 'Contract body must be strictly preserved');

  // Render after image at 300 DPI and compare
  const imgAfter = await renderPageTo300Dpi(res.bytes, 1);
  const [metaA] = await Promise.all([sharp(imgBefore).metadata()]);
  const [rawBefore, rawAfter] = await Promise.all([
    sharp(imgBefore).raw().toBuffer(),
    sharp(imgAfter).raw().toBuffer()
  ]);

  const width = metaA.width;
  const height = metaA.height;
  const scale = 300 / 72;

  // Watermark TASLAK PDF bounding box: x: 180, y: 420, size: 64, rotate: 45°
  // Generates bounds x: ~130..380, y: ~400..660 in PDF coords
  // Converted to viewport coordinates (top-left origin):
  const roiX1 = Math.floor(115 * scale);
  const roiX2 = Math.ceil(400 * scale);
  const roiY1 = Math.floor((841.89 - 675) * scale);
  const roiY2 = Math.ceil((841.89 - 380) * scale);

  let totalChangedPixels = 0;
  let insideTargetChangedPixels = 0;
  let outsideTargetChangedPixels = 0;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const dr = Math.abs(rawBefore[idx] - rawAfter[idx]);
      const dg = Math.abs(rawBefore[idx + 1] - rawAfter[idx + 1]);
      const db = Math.abs(rawBefore[idx + 2] - rawAfter[idx + 2]);
      const isDiff = Math.max(dr, dg, db) > 2;

      if (isDiff) {
        totalChangedPixels++;
        const isInside = (x >= roiX1 && x <= roiX2 && y >= roiY1 && y <= roiY2);
        if (isInside) {
          insideTargetChangedPixels++;
        } else {
          outsideTargetChangedPixels++;
        }
      }
    }
  }

  console.log(`300 DPI pixel comparison:`);
  console.log(`  totalChangedPixels: ${totalChangedPixels}`);
  console.log(`  insideTargetChangedPixels: ${insideTargetChangedPixels}`);
  console.log(`  outsideTargetChangedPixels: ${outsideTargetChangedPixels}`);

  assert.ok(insideTargetChangedPixels > 0, 'Target watermark pixels must be removed');
  assert.strictEqual(outsideTargetChangedPixels, 0, 'outsideTargetChangedPixels MUST be exactly 0 (zero collateral damage)');

  clearTimeout(watchdog);
  console.log('=== TEST RESULT: SUCCESS ===');
  process.exit(0);
}

runTest().catch(err => {
  clearTimeout(watchdog);
  console.error('=== TEST RESULT: FAILED ===');
  console.error(err);
  process.exit(1);
});

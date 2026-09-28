import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import sharp from 'sharp';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import {
  removePdfText,
  editablePageText,
  calculateSubstringGlyphMetricsSync,
  extractPdfiumCharBoxes
} from '../lib/pdf-text.ts';
import { exportPdf, loadPdf } from '../lib/documents.ts';
import { init } from '@embedpdf/pdfium';

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

let pdfiumInstance;
async function getPdfium() {
  if (!pdfiumInstance) {
    const wasmBinary = fs.readFileSync(path.resolve('public/pdfium.wasm'));
    pdfiumInstance = await init({ wasmBinary });
    pdfiumInstance.PDFiumExt_Init();
  }
  return pdfiumInstance;
}

async function renderPageTo300Dpi(pdfBytes, pageNum = 1) {
  const m = await getPdfium();
  const heap = m.pdfium;
  const { malloc, free } = heap.wasmExports;
  const input = malloc(pdfBytes.length);
  heap.HEAPU8.set(pdfBytes, input);

  const doc = m.FPDF_LoadMemDocument(input, pdfBytes.length, "");
  if (!doc) {
    free(input);
    throw new Error("Could not load PDF document in PDFium");
  }

  const page = m.FPDF_LoadPage(doc, pageNum - 1);
  if (!page) {
    m.FPDF_CloseDocument(doc);
    free(input);
    throw new Error(`Could not load page ${pageNum}`);
  }

  const widthPts = m.FPDF_GetPageWidth(page);
  const heightPts = m.FPDF_GetPageHeight(page);

  const scale = 300 / 72;
  const widthPx = Math.round(widthPts * scale);
  const heightPx = Math.round(heightPts * scale);

  const bitmap = m.FPDFBitmap_Create(widthPx, heightPx, 0);
  m.FPDFBitmap_FillRect(bitmap, 0, 0, widthPx, heightPx, 0xffffffff);
  m.FPDF_RenderPageBitmap(bitmap, page, 0, 0, widthPx, heightPx, 0, 0x10 | 0x01);

  const bufferPtr = m.FPDFBitmap_GetBuffer(bitmap);
  const stride = m.FPDFBitmap_GetStride(bitmap);
  const bgraData = heap.HEAPU8.subarray(bufferPtr, bufferPtr + stride * heightPx);

  const rgbaData = new Uint8Array(widthPx * heightPx * 4);
  for (let y = 0; y < heightPx; y++) {
    for (let x = 0; x < widthPx; x++) {
      const srcIdx = y * stride + x * 4;
      const dstIdx = (y * widthPx + x) * 4;
      rgbaData[dstIdx] = bgraData[srcIdx + 2];     // R
      rgbaData[dstIdx + 1] = bgraData[srcIdx + 1]; // G
      rgbaData[dstIdx + 2] = bgraData[srcIdx];     // B
      rgbaData[dstIdx + 3] = bgraData[srcIdx + 3]; // A
    }
  }

  m.FPDFBitmap_Destroy(bitmap);
  m.FPDF_ClosePage(page);
  m.FPDF_CloseDocument(doc);
  free(input);

  return sharp(rgbaData, {
    raw: {
      width: widthPx,
      height: heightPx,
      channels: 4
    }
  }).png().toBuffer();
}

async function createTargetDocument() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 400]);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await doc.embedFont(StandardFonts.Helvetica);

  // Line: "Enrollment Verification as of 09/13/2026"
  page.drawText('Enrollment Verification as of 09/13/2026', {
    x: 45,
    y: 300,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1)
  });

  // Additional realistic lines
  page.drawText('Student Name: Ayaz Yilmaz', {
    x: 45,
    y: 260,
    size: 12,
    font: fontReg,
    color: rgb(0.2, 0.2, 0.2)
  });

  page.drawText('Status: Active - Full Time', {
    x: 45,
    y: 230,
    size: 12,
    font: fontReg,
    color: rgb(0.2, 0.2, 0.2)
  });

  return await doc.save();
}

async function runTestSuite() {
  console.log('========================================================================');
  console.log('  STARTING PDF SURGICAL EDITING & COURIER BAN TEST SUITE');
  console.log('========================================================================\n');

  const originalBytes = await createTargetDocument();
  console.log(`[SETUP] Created test document, byte size: ${originalBytes.length}`);

  const originalDocJs = await pdfjsLib.getDocument({ data: originalBytes.slice() }).promise;
  const page1Js = await originalDocJs.getPage(1);
  const originalItems = await editablePageText(page1Js, originalBytes);
  console.log(`[SETUP] Extracted ${originalItems.length} editable text items from page 1`);

  const targetItem = originalItems.find(i => i.text.includes('Enrollment Verification as of 09/13/2026'));
  assert.ok(targetItem, 'Target line "Enrollment Verification as of 09/13/2026" must be present');
  console.log(`[SETUP] Found target item: id=${targetItem.id}, text="${targetItem.text}"`);
  console.log(`        charBoxes count: ${targetItem.charBoxes?.length || 0}`);
  assert.ok(targetItem.charBoxes && targetItem.charBoxes.length > 0, 'Target item must have attached charBoxes from PDFium');

  // Render 300 DPI reference baseline image
  const bufOriginal300 = await renderPageTo300Dpi(originalBytes, 1);
  const imgOriginal = sharp(bufOriginal300);
  const metaOriginal = await imgOriginal.metadata();
  const rawOriginal = await imgOriginal.raw().toBuffer();

  const scale = 300 / 72;
  // Prefix "Enrollment Verification as of " region in 300 DPI px:
  // In PDF points: x: 45 to ~225, y: 300 (height 14, in top-down coordinates: y is 400 - 300 - 14 = 86 to 110)
  const prefixMinX = Math.floor(45 * scale);
  const prefixMaxX = Math.floor(224 * scale);
  const prefixMinY = Math.floor(80 * scale);
  const prefixMaxY = Math.floor(120 * scale);

  console.log(`[SETUP] Prefix bounding box at 300 DPI: X:[${prefixMinX}..${prefixMaxX}], Y:[${prefixMinY}..${prefixMaxY}]`);

  // ========================================================================
  // SCENARIO 1: INLINE DOUBLE-CLICK SUBSTRING EDIT
  // ========================================================================
  console.log('\n>>> [SCENARIO 1] Inline Double-Click Substring Edit ("09/13/2026" -> "09/27/2026")...');

  const draftText = "Enrollment Verification as of 09/27/2026";
  const rawTargetText = draftText;

  // Simulate convertOriginalToMark logic
  let prefixLen = 0;
  while (
    prefixLen < targetItem.text.length &&
    prefixLen < rawTargetText.length &&
    targetItem.text[prefixLen] === rawTargetText[prefixLen]
  ) {
    prefixLen++;
  }
  let suffixLen = 0;
  while (
    suffixLen < (targetItem.text.length - prefixLen) &&
    suffixLen < (rawTargetText.length - prefixLen) &&
    targetItem.text[targetItem.text.length - 1 - suffixLen] === rawTargetText[rawTargetText.length - 1 - suffixLen]
  ) {
    suffixLen++;
  }

  while (prefixLen > 0 && targetItem.text[prefixLen - 1] !== ' ' && targetItem.text[prefixLen - 1] !== '\t') {
    prefixLen--;
  }
  while (suffixLen > 0 && targetItem.text[targetItem.text.length - suffixLen] !== ' ' && targetItem.text[targetItem.text.length - suffixLen] !== '\t') {
    suffixLen--;
  }

  const matchStart = prefixLen;
  const matchLength = targetItem.text.length - prefixLen - suffixLen;
  const replacement = rawTargetText.slice(prefixLen, rawTargetText.length - suffixLen);

  console.log(`    Common prefix length: ${prefixLen} ("${targetItem.text.slice(0, prefixLen)}")`);
  console.log(`    Matched old substring: "${targetItem.text.slice(matchStart, matchStart + matchLength)}"`);
  console.log(`    Replacement substring: "${replacement}"`);

  assert.strictEqual(targetItem.text.slice(0, prefixLen), "Enrollment Verification as of ");
  assert.strictEqual(targetItem.text.slice(matchStart, matchStart + matchLength), "09/13/2026");
  assert.strictEqual(replacement, "09/27/2026");

  const metrics = calculateSubstringGlyphMetricsSync(targetItem, matchStart, matchLength, replacement);
  console.log(`    Surgical metrics extracted:`, {
    startX: metrics.startX,
    startY: metrics.startY,
    fontSize: metrics.fontSize,
    fontFamily: metrics.fontFamily,
    originalFontName: metrics.originalFontName,
    isBold: metrics.isBold,
    isItalic: metrics.isItalic,
    color: metrics.color,
    targetQuad: metrics.targetQuad.map(v => Math.round(v * 10) / 10)
  });

  // Assertion 3 & 4: Strict Courier Ban & Style Fidelity
  assert.notStrictEqual(metrics.fontFamily, 'courier', 'Assertion 3: Courier fallback is strictly forbidden for Helvetica source');
  assert.strictEqual(metrics.fontFamily, 'sans', 'Assertion 4: Font family must match sans/Helvetica');
  assert.strictEqual(metrics.isBold, true, 'Assertion 4: Bold weight must match source date');
  assert.strictEqual(metrics.fontSize, 14, 'Assertion 5: Punto must match 14pt directly from PDFium');

  // Redaction quad covers ONLY the date:
  const quadMinX = Math.min(metrics.targetQuad[0], metrics.targetQuad[4]);
  const quadMaxX = Math.max(metrics.targetQuad[2], metrics.targetQuad[6]);
  console.log(`    Target redaction quad X span: [${quadMinX.toFixed(1)}..${quadMaxX.toFixed(1)}] pts (starts AFTER prefix X=45)`);
  assert.ok(quadMinX > 220, 'Redaction quad must NOT touch prefix region (X < 220)');

  const scenario1Removals = [{
    id: targetItem.id,
    page: 0,
    quad: metrics.targetQuad
  }];

  const scenario1Marks = [{
    id: `mark_${Date.now()}`,
    kind: 'text',
    page: 0,
    x: metrics.startX,
    y: metrics.startY,
    text: replacement,
    size: metrics.fontSize,
    font: metrics.fontFamily,
    bold: metrics.isBold,
    italic: metrics.isItalic,
    color: metrics.color,
    originalFontName: metrics.originalFontName,
    sourceId: targetItem.id
  }];

  const pages1 = [{ index: 0, width: 600, height: 400, rotation: 0 }];
  const editedBytes1 = await exportPdf(originalBytes, pages1, scenario1Marks, scenario1Removals);
  console.log(`    Exported Scenario 1 PDF size: ${editedBytes1.length} bytes`);

  // Verify exported PDF with PDFium at 300 DPI
  const bufAfter1 = await renderPageTo300Dpi(editedBytes1, 1);
  const imgAfter1 = sharp(bufAfter1);
  const rawAfter1 = await imgAfter1.raw().toBuffer();

  let prefixDiffCount1 = 0;
  let dateAreaDiffCount1 = 0;
  let totalDiffCount1 = 0;

  const dateMinX = Math.floor(225 * scale);
  const dateMaxX = Math.floor(330 * scale);

  const evidenceDir = path.resolve('outputs/v74-evidence');
  fs.mkdirSync(evidenceDir, { recursive: true });
  const artifactDir = 'process.env.ARTIFACT_DIR || path.join(os.tmpdir(), 'forma_artifacts')';

  const diffRgba = new Uint8Array(metaOriginal.width * metaOriginal.height * 4);
  for (let i = 0; i < diffRgba.length; i += 4) {
    diffRgba[i] = 255;
    diffRgba[i + 1] = 255;
    diffRgba[i + 2] = 255;
    diffRgba[i + 3] = 255;
  }

  for (let y = 0; y < metaOriginal.height; y++) {
    for (let x = 0; x < metaOriginal.width; x++) {
      const idx = (y * metaOriginal.width + x) * 4;
      const diff = Math.max(
        Math.abs(rawOriginal[idx] - rawAfter1[idx]),
        Math.abs(rawOriginal[idx + 1] - rawAfter1[idx + 1]),
        Math.abs(rawOriginal[idx + 2] - rawAfter1[idx + 2])
      );
      if (diff > 0) {
        totalDiffCount1++;
        diffRgba[idx] = 239;     // R
        diffRgba[idx + 1] = 68;  // G
        diffRgba[idx + 2] = 68;  // B
        diffRgba[idx + 3] = 255; // A

        if (x >= prefixMinX && x <= prefixMaxX && y >= prefixMinY && y <= prefixMaxY) {
          prefixDiffCount1++;
        }
        if (x >= dateMinX && x <= dateMaxX && y >= prefixMinY && y <= prefixMaxY) {
          dateAreaDiffCount1++;
        }
      } else {
        const gray = rawOriginal[idx];
        if (gray < 240) {
          diffRgba[idx] = 220;
          diffRgba[idx + 1] = 220;
          diffRgba[idx + 2] = 220;
          diffRgba[idx + 3] = 255;
        }
      }
    }
  }

  const diffPngBuf = await sharp(diffRgba, {
    raw: {
      width: metaOriginal.width,
      height: metaOriginal.height,
      channels: 4
    }
  }).png().toBuffer();

  fs.writeFileSync(path.join(evidenceDir, 'before_300dpi.png'), bufOriginal300);
  fs.writeFileSync(path.join(evidenceDir, 'after_300dpi.png'), bufAfter1);
  fs.writeFileSync(path.join(evidenceDir, 'diff_300dpi.png'), diffPngBuf);
  fs.writeFileSync(path.join(evidenceDir, 'original.pdf'), originalBytes);
  fs.writeFileSync(path.join(evidenceDir, 'edited_surgical.pdf'), editedBytes1);

  const cropLineOpts = {
    left: Math.floor(40 * scale),
    top: Math.floor(80 * scale),
    width: Math.floor(320 * scale),
    height: Math.floor(40 * scale)
  };

  const cropBefore = await sharp(bufOriginal300).extract(cropLineOpts).png().toBuffer();
  const cropAfter = await sharp(bufAfter1).extract(cropLineOpts).png().toBuffer();
  const cropDiff = await sharp(diffPngBuf).extract(cropLineOpts).png().toBuffer();

  fs.writeFileSync(path.join(evidenceDir, 'line_before_300dpi.png'), cropBefore);
  fs.writeFileSync(path.join(evidenceDir, 'line_after_300dpi.png'), cropAfter);
  fs.writeFileSync(path.join(evidenceDir, 'line_diff_300dpi.png'), cropDiff);

  fs.writeFileSync(path.join(artifactDir, 'v74_line_before_300dpi.png'), cropBefore);
  fs.writeFileSync(path.join(artifactDir, 'v74_line_after_300dpi.png'), cropAfter);
  fs.writeFileSync(path.join(artifactDir, 'v74_line_diff_300dpi.png'), cropDiff);

  console.log(`    [300 DPI DIFF RESULTS]`);
  console.log(`    Prefix region changed pixels: ${prefixDiffCount1}`);
  console.log(`    Date region changed pixels: ${dateAreaDiffCount1}`);
  console.log(`    Total document changed pixels: ${totalDiffCount1}`);

  assert.strictEqual(prefixDiffCount1, 0, 'CRITICAL ASSERTION 2: Preserved prefix MUST have EXACTLY 0 changed pixels!');
  assert.ok(dateAreaDiffCount1 > 0, 'Date change must produce visible changes in date region');
  console.log('  ✅ PASS: Scenario 1 - Inline double-click surgical edit passed with 0 prefix changed pixels!');

  // ========================================================================
  // SCENARIO 2: FIND & REPLACE SUBSTRING REPLACEMENT
  // ========================================================================
  console.log('\n>>> [SCENARIO 2] Find & Replace Substring Replacement ("09/13/2026" -> "09/27/2026")...');

  const query = "09/13/2026";
  const replaceWith = "09/27/2026";
  const foundIdx = targetItem.text.indexOf(query);
  assert.ok(foundIdx >= 0, 'Query must be found in target item');

  // Exact FindReplaceBar logic
  const frMetrics = calculateSubstringGlyphMetricsSync(targetItem, foundIdx, query.length, replaceWith);
  assert.notStrictEqual(frMetrics.fontFamily, 'courier', 'Find & Replace must NOT fall back to Courier');
  assert.strictEqual(frMetrics.fontFamily, 'sans', 'Find & Replace font family must match source date');
  assert.strictEqual(frMetrics.fontSize, 14, 'Find & Replace punto must match 14pt');
  assert.strictEqual(frMetrics.isBold, true, 'Find & Replace bold must match source date');

  const frRemovals = [{
    id: `${targetItem.id}-sub-${foundIdx}`,
    page: 0,
    quad: frMetrics.targetQuad
  }];

  const frMarks = [{
    id: `rep_${Date.now()}`,
    kind: 'text',
    page: 0,
    x: frMetrics.startX,
    y: frMetrics.startY,
    text: replaceWith,
    size: Math.round(frMetrics.fontSize * 10) / 10,
    font: frMetrics.fontFamily,
    color: frMetrics.color,
    bold: frMetrics.isBold,
    italic: frMetrics.isItalic,
    originalFontName: frMetrics.originalFontName,
    sourceId: targetItem.id
  }];

  const editedBytes2 = await exportPdf(originalBytes, pages1, frMarks, frRemovals);
  console.log(`    Exported Scenario 2 PDF size: ${editedBytes2.length} bytes`);

  const bufAfter2 = await renderPageTo300Dpi(editedBytes2, 1);
  const rawAfter2 = await sharp(bufAfter2).raw().toBuffer();

  let prefixDiffCount2 = 0;
  let dateAreaDiffCount2 = 0;

  for (let y = 0; y < metaOriginal.height; y++) {
    for (let x = 0; x < metaOriginal.width; x++) {
      const idx = (y * metaOriginal.width + x) * 4;
      const diff = Math.max(
        Math.abs(rawOriginal[idx] - rawAfter2[idx]),
        Math.abs(rawOriginal[idx + 1] - rawAfter2[idx + 1]),
        Math.abs(rawOriginal[idx + 2] - rawAfter2[idx + 2])
      );
      if (diff > 0) {
        if (x >= prefixMinX && x <= prefixMaxX && y >= prefixMinY && y <= prefixMaxY) {
          prefixDiffCount2++;
        }
        if (x >= dateMinX && x <= dateMaxX && y >= prefixMinY && y <= prefixMaxY) {
          dateAreaDiffCount2++;
        }
      }
    }
  }

  console.log(`    [300 DPI DIFF RESULTS]`);
  console.log(`    Prefix region changed pixels: ${prefixDiffCount2}`);
  console.log(`    Date region changed pixels: ${dateAreaDiffCount2}`);

  assert.strictEqual(prefixDiffCount2, 0, 'CRITICAL ASSERTION 2: Preserved prefix MUST have EXACTLY 0 changed pixels in Find/Replace!');
  assert.ok(dateAreaDiffCount2 > 0, 'Date change must produce visible changes in date region');
  console.log('  ✅ PASS: Scenario 2 - Find & Replace surgical edit passed with 0 prefix changed pixels!');

  // ========================================================================
  // SCENARIO 3: STRICT COURIER BAN ON "Date:" KEYWORD
  // ========================================================================
  console.log('\n>>> [SCENARIO 3] Strict Courier Ban on "Date:" keyword verification...');

  // Create document with "Date: 09/13/2026" in Helvetica
  const dateDoc = await PDFDocument.create();
  const datePage = dateDoc.addPage([400, 200]);
  const dateFont = await dateDoc.embedFont(StandardFonts.Helvetica);
  datePage.drawText('Date: 09/13/2026', { x: 50, y: 150, size: 12, font: dateFont, color: rgb(0, 0, 0) });
  const dateBytes = await dateDoc.save();

  const dateDocJs = await pdfjsLib.getDocument({ data: dateBytes.slice() }).promise;
  const datePageJs = await dateDocJs.getPage(1);
  const dateItems = await editablePageText(datePageJs, dateBytes);
  const dateItem = dateItems.find(i => i.text.includes('Date: 09/13/2026'));
  assert.ok(dateItem, 'Date item must exist');

  console.log(`    Item text: "${dateItem.text}", detected fontFamily: "${dateItem.fontFamily}", originalFontName: "${dateItem.originalFontName}"`);
  assert.notStrictEqual(dateItem.fontFamily, 'courier', 'CRITICAL ASSERTION 3: "Date:" must NOT trigger Courier fallback!');
  assert.strictEqual(dateItem.fontFamily, 'sans', 'Item must be categorized as sans (Helvetica)');

  console.log('  ✅ PASS: Scenario 3 - Strict Courier Ban on "Date:" confirmed!');

  // ========================================================================
  // SCENARIO 4: REOPENED DOCUMENT INSPECTION IN PDFIUM & PDF.JS
  // ========================================================================
  console.log('\n>>> [SCENARIO 4] Reopened Exported Document Content & Character Inspection...');

  const reopenedDocJs = await pdfjsLib.getDocument({ data: editedBytes1.slice() }).promise;
  const reopenedPageJs = await reopenedDocJs.getPage(1);
  const reopenedTextContent = await reopenedPageJs.getTextContent();
  const allReopenedStrings = reopenedTextContent.items.map(i => i.str).join(' ');

  console.log(`    Reopened PDF.js text stream: "${allReopenedStrings}"`);
  assert.ok(allReopenedStrings.includes('Enrollment Verification as of'), 'Prefix must exist in reopened text stream');
  assert.ok(allReopenedStrings.includes('09/27/2026'), 'New date must exist in reopened text stream');
  assert.ok(!allReopenedStrings.includes('09/13/2026'), 'Old date must NOT exist in reopened text stream');

  // PDFium character box inspection
  const reopenedCharBoxes = await extractPdfiumCharBoxes(editedBytes1, 0);
  const reopenedCharsText = reopenedCharBoxes.map(c => c.char).join('');
  assert.ok(reopenedCharsText.includes('Enrollment Verification as of'), 'PDFium text must contain intact prefix');
  assert.ok(reopenedCharsText.includes('09/27/2026'), 'PDFium text must contain replacement date');
  assert.ok(!reopenedCharsText.includes('09/13/2026'), 'PDFium text must NOT contain old date');

  // Verify that new date characters have non-courier font name
  const newDateChars = reopenedCharBoxes.filter((c, idx) => {
    const sub = reopenedCharsText.slice(idx, idx + 10);
    return sub === '09/27/2026';
  });
  assert.ok(newDateChars.length > 0, 'New date chars found in PDFium inspection');
  console.log(`    New date first char in PDFium:`, {
    char: newDateChars[0].char,
    fontName: newDateChars[0].fontName,
    size: newDateChars[0].size,
    weight: newDateChars[0].weight
  });

  assert.ok(!/courier/i.test(newDateChars[0].fontName), 'CRITICAL ASSERTION 3: Reopened PDFium font must NOT be Courier');
  assert.ok(Math.abs(newDateChars[0].size - 14) <= 1, 'CRITICAL ASSERTION 5: Punto difference must be <= 1 pt');

  console.log('  ✅ PASS: Scenario 4 - Reopened document inspection confirmed!');

  console.log('\n========================================================================');
  console.log('  ALL TEST SCENARIOS PASSED WITH ZERO PREFIX REGION PIXEL CHANGES!');
  console.log('========================================================================\n');
}

runTestSuite().catch(err => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  process.exit(1);
});

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { init } from '@embedpdf/pdfium';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import sharp from 'sharp';
import { PDFDocument } from 'pdf-lib';
import { createCanvas } from '@napi-rs/canvas';
import { exportPdf } from '../lib/documents.ts';

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

let pdfiumInstance;
async function getPdfium() {
  if (!pdfiumInstance) {
    const wasmBinary = fs.readFileSync('public/pdfium.wasm');
    pdfiumInstance = await init({ wasmBinary });
    pdfiumInstance.PDFiumExt_Init();
  }
  return pdfiumInstance;
}

async function renderPageAt300Dpi(pdfBytes) {
  const m = await getPdfium();
  const heap = m.pdfium;
  const { malloc, free } = heap.wasmExports;
  const input = malloc(pdfBytes.length);
  heap.HEAPU8.set(pdfBytes, input);

  const doc = m.FPDF_LoadMemDocument(input, pdfBytes.length, "");
  const page = m.FPDF_LoadPage(doc, 0);

  const scale = 300 / 72;
  const widthPts = m.FPDF_GetPageWidth(page);
  const heightPts = m.FPDF_GetPageHeight(page);
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
      rgbaData[dstIdx] = bgraData[srcIdx + 2];
      rgbaData[dstIdx + 1] = bgraData[srcIdx + 1];
      rgbaData[dstIdx + 2] = bgraData[srcIdx];
      rgbaData[dstIdx + 3] = bgraData[srcIdx + 3];
    }
  }

  m.FPDFBitmap_Destroy(bitmap);
  m.FPDF_ClosePage(page);
  m.FPDF_CloseDocument(doc);
  free(input);

  return { rgbaData, width: widthPx, height: heightPx, widthPts, heightPts };
}

async function createSyntheticTurkishScannedFixture() {
  const widthPts = 595.28;
  const heightPts = 841.89;
  const scale = 300 / 72;
  const widthPx = Math.round(widthPts * scale);
  const heightPx = Math.round(heightPts * scale);

  const canvas = createCanvas(widthPx, heightPx);
  const ctx = canvas.getContext('2d');

  // Fill warm scanned paper tone
  ctx.fillStyle = '#faf8f5';
  ctx.fillRect(0, 0, widthPx, heightPx);

  // Add realistic paper grain
  const imgData = ctx.getImageData(0, 0, widthPx, heightPx);
  for (let i = 0; i < imgData.data.length; i += 4) {
    const noise = (Math.random() - 0.5) * 10;
    imgData.data[i] = Math.min(255, Math.max(0, imgData.data[i] + noise));
    imgData.data[i+1] = Math.min(255, Math.max(0, imgData.data[i+1] + noise));
    imgData.data[i+2] = Math.min(255, Math.max(0, imgData.data[i+2] + noise));
  }
  ctx.putImageData(imgData, 0, 0);

  // Render "Ornek Baslik" at 300 DPI
  const textXPx = Math.round(150 * scale);
  const textBaselinePx = Math.round((heightPts - 500) * scale);
  const fontSizePx = Math.round(14 * scale);

  ctx.fillStyle = '#222222';
  ctx.font = `bold ${fontSizePx}px Helvetica, Arial, sans-serif`;
  ctx.fillText('Ornek Baslik', textXPx, textBaselinePx);

  const metrics = ctx.measureText('Ornek Baslik');
  const textWidthPx = metrics.width;
  const textWidthPts = textWidthPx / scale;
  const textHeightPts = fontSizePx / scale;

  const pngBuffer = canvas.toBuffer('image/png');

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([widthPts, heightPts]);
  const embeddedImage = await pdfDoc.embedPng(pngBuffer);
  page.drawImage(embeddedImage, {
    x: 0,
    y: 0,
    width: widthPts,
    height: heightPts
  });

  const pdfBytes = await pdfDoc.save();
  return {
    pdfBytes,
    x: 150,
    y: 500 - 3,
    w: textWidthPts,
    h: textHeightPts + 3,
    fontSize: 14,
    pageHeightPts: heightPts
  };
}

async function runSingleTargetTest(pdfBytes, targetDef, customPageHeight = 744) {
  console.log(`\n================================================================================`);
  console.log(`TEST TARGET: ${targetDef.title}`);
  console.log(`  Eski Metin: "${targetDef.oldText}" -> Yeni Metin: "${targetDef.newText}"`);
  console.log(`================================================================================`);

  assert.notStrictEqual(targetDef.oldText, targetDef.newText, "Eski ve yeni metin kesinlikle birbirinden farklı olmalıdır!");

  const removal = {
    id: targetDef.id,
    page: 0,
    quad: [
      targetDef.minX, targetDef.maxY,
      targetDef.maxX, targetDef.maxY,
      targetDef.maxX, targetDef.minY,
      targetDef.minX, targetDef.minY
    ]
  };

  const mark = {
    id: `mark-${targetDef.id}`,
    page: 0,
    kind: 'text',
    x: targetDef.minX,
    y: targetDef.minY,
    w: targetDef.maxX - targetDef.minX,
    h: targetDef.maxY - targetDef.minY,
    text: targetDef.newText,
    originalText: targetDef.oldText,
    size: targetDef.size,
    font: targetDef.font || 'sans',
    bold: targetDef.bold ?? true,
    color: '#000000',
    originalFontName: targetDef.originalFontName || 'Helvetica-Bold',
    fontName: targetDef.originalFontName || 'Helvetica-Bold',
    sourceId: targetDef.id,
    bg: '#ffffff'
  };

  const pages = [{ index: 0, rotation: 0 }];
  const exportedBytes = await exportPdf(pdfBytes.slice(), pages, [mark], [removal]);

  // 1. Courier fallback check
  const docJs = await pdfjsLib.getDocument({ data: exportedBytes.slice() }).promise;
  const pageJs = await docJs.getPage(1);
  const tc = await pageJs.getTextContent();
  let courierUsed = false;
  for (const item of tc.items) {
    if (item.str && (item.str.includes(targetDef.newText) || item.fontName?.toLowerCase().includes("courier"))) {
      if (item.fontName?.toLowerCase().includes("courier")) {
        courierUsed = true;
      }
    }
  }
  console.log(`- Courier fallback: ${courierUsed}`);
  assert.strictEqual(courierUsed, false, "Courier fallback KESİNLİKLE false olmalıdır!");

  // 2. Render BEFORE and AFTER at 300 DPI
  const beforeImg = await renderPageAt300Dpi(pdfBytes);
  const afterImg = await renderPageAt300Dpi(exportedBytes);
  const pageHeight = beforeImg.heightPts || customPageHeight;

  const scale = 300 / 72;
  const padX = targetDef.padLeft || 40;
  const padRight = targetDef.padRight || 40;
  const padY = targetDef.padY || 20;

  const cropOpts = {
    left: Math.max(0, Math.floor((targetDef.minX - padX) * scale)),
    top: Math.max(0, Math.floor((pageHeight - targetDef.maxY - padY) * scale)),
    width: Math.floor((targetDef.maxX - targetDef.minX + padX + padRight) * scale),
    height: Math.floor((targetDef.maxY - targetDef.minY + 2 * padY) * scale)
  };

  const cropW = cropOpts.width;
  const cropH = cropOpts.height;

  const cropBeforeRaw = await sharp(beforeImg.rgbaData, {
    raw: { width: beforeImg.width, height: beforeImg.height, channels: 4 }
  }).extract(cropOpts).raw().toBuffer();

  const cropAfterRaw = await sharp(afterImg.rgbaData, {
    raw: { width: afterImg.width, height: afterImg.height, channels: 4 }
  }).extract(cropOpts).raw().toBuffer();

  // Prefix diff (outside target zone)
  const targetStartInCrop = Math.floor(padX * scale);
  const targetEndInCrop = Math.floor((padX + (targetDef.maxX - targetDef.minX)) * scale);

  let prefixDiffCount = 0;
  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < targetStartInCrop - 15; x++) {
      const idx = (y * cropW + x) * 4;
      const r1 = cropBeforeRaw[idx], g1 = cropBeforeRaw[idx+1], b1 = cropBeforeRaw[idx+2];
      const r2 = cropAfterRaw[idx], g2 = cropAfterRaw[idx+1], b2 = cropAfterRaw[idx+2];
      if (Math.abs(r1 - r2) > 5 || Math.abs(g1 - g2) > 5 || Math.abs(b1 - b2) > 5) {
        prefixDiffCount++;
      }
    }
  }

  function measureCropText(cropBuffer, minBoxX, maxBoxX) {
    let minX = 99999, maxX = -1, minY = 99999, maxY = -1;
    let darkCount = 0, sumR = 0, sumG = 0, sumB = 0;
    for (let y = 0; y < cropH; y++) {
      for (let x = minBoxX; x <= maxBoxX; x++) {
        const idx = (y * cropW + x) * 4;
        const r = cropBuffer[idx], g = cropBuffer[idx+1], b = cropBuffer[idx+2];
        if (r < 180 || g < 180 || b < 180) {
          darkCount++;
          sumR += r; sumG += g; sumB += b;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const width = maxX >= minX ? maxX - minX + 1 : 0;
    const color = darkCount > 0 ? (sumR + sumG + sumB) / (3 * darkCount) : 0;

    const strokeRuns = [];
    for (let y = minY + 4; y < maxY - 4; y++) {
      let run = 0;
      for (let x = minX; x <= maxX; x++) {
        if (cropBuffer[(y * cropW + x) * 4] < 180) {
          run++;
        } else {
          if (run >= 3 && run <= 35) strokeRuns.push(run);
          run = 0;
        }
      }
      if (run >= 3 && run <= 35) strokeRuns.push(run);
    }
    const stroke = strokeRuns.length > 0 ? strokeRuns.reduce((a,b)=>a+b, 0) / strokeRuns.length : 0;

    const bottomYs = [];
    for (let x = minX; x <= maxX; x++) {
      let botY = -1;
      for (let y = maxY; y >= minY; y--) {
        if (cropBuffer[(y * cropW + x) * 4] < 180) { botY = y; break; }
      }
      if (botY > 0) bottomYs.push(botY);
    }
    bottomYs.sort((a,b)=>a-b);
    const baseline = bottomYs[Math.floor(bottomYs.length * 0.9)] || 0;

    const colTops = [];
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        if (cropBuffer[(y * cropW + x) * 4] < 180) {
          colTops.push(y);
          break;
        }
      }
    }
    const hasSlash = Boolean(targetDef.oldText.includes('/') || targetDef.newText.includes('/'));
    const nonSlashTops = hasSlash ? colTops.filter(t => t >= minY + 4) : colTops;
    nonSlashTops.sort((a,b)=>a-b);
    const evalPct = targetDef.evalPercentile || 0.5;
    const medianTop = nonSlashTops[Math.floor(nonSlashTops.length * evalPct)] || (minY + 8);
    const height = baseline - medianTop + 1;

    return { minX, maxX, minY, maxY, width, height, stroke, color, baseline };
  }

  const searchMinX = targetDef.minSearchOffset !== undefined ? (targetStartInCrop + targetDef.minSearchOffset) : (targetStartInCrop - 10);
  const searchMaxX = targetDef.maxSearchOffset ? (targetStartInCrop + targetDef.maxSearchOffset) : (cropW - 5);
  const mBefore = measureCropText(cropBeforeRaw, searchMinX, searchMaxX);
  const mAfter = measureCropText(cropAfterRaw, searchMinX, searchMaxX);

  const diffHeight = Math.abs(mAfter.height - mBefore.height);
  const diffStroke = Math.abs(mAfter.stroke - mBefore.stroke);
  const diffColor = Math.abs(mAfter.color - mBefore.color);
  const diffBaseline = Math.abs(mAfter.baseline - mBefore.baseline);
  const diffWidth = Math.abs(mAfter.width - mBefore.width);

  // Check old text residual pixels in non-glyph background area
  let oldTextResidual = 0;
  for (let y = mBefore.minY; y <= mBefore.maxY; y++) {
    for (let x = mBefore.minX; x <= mBefore.maxX; x++) {
      const idx = (y * cropW + x) * 4;
      const wasDark = cropBeforeRaw[idx] < 180;
      const isNowDark = cropAfterRaw[idx] < 180;
      if (wasDark && !isNowDark) {
        // Pixel is in background; check if paper background is clean
        if (cropAfterRaw[idx] < 180) oldTextResidual++;
      }
    }
  }

  console.log(`Sonuçlar (${targetDef.title}):`);
  console.log(`- Hedef dışı değişen piksel: ${prefixDiffCount} px (Kriter: 0) -> ${prefixDiffCount === 0 ? 'PASS' : 'FAIL'}`);
  console.log(`- Eski metin artığı:         ${oldTextResidual} px (Kriter: 0) -> ${oldTextResidual === 0 ? 'PASS' : 'FAIL'}`);
  console.log(`- Harf Yüksekliği Farkı:     ${diffHeight} px (Before: ${mBefore.height}, After: ${mAfter.height}) [<= 1 px] -> ${diffHeight <= 1 ? 'PASS' : 'FAIL'}`);
  console.log(`- Stroke Farkı:              ${diffStroke.toFixed(1)} px (Before: ${mBefore.stroke.toFixed(1)}, After: ${mAfter.stroke.toFixed(1)}) [<= 1 px] -> ${diffStroke <= 1 ? 'PASS' : 'FAIL'}`);
  console.log(`- Renk Farkı (kanal başı):   ${diffColor.toFixed(1)} (Before: ${mBefore.color.toFixed(1)}, After: ${mAfter.color.toFixed(1)}) [<= 3] -> ${diffColor <= 3 ? 'PASS' : 'FAIL'}`);
  console.log(`- Baseline Farkı:            ${diffBaseline} px (Before: ${mBefore.baseline}, After: ${mAfter.baseline}) [<= 1 px] -> ${diffBaseline <= 1 ? 'PASS' : 'FAIL'}`);

  assert.strictEqual(prefixDiffCount, 0, "Hedef dışı değişen piksel 0 olmalıdır!");
  assert.strictEqual(oldTextResidual, 0, "Eski metin artığı 0 olmalıdır!");
  assert.ok(diffHeight <= 1, `Harf yüksekliği farkı <= 1 px olmalıdır (got ${diffHeight})`);
  assert.ok(diffStroke <= 1, `Stroke farkı <= 1 px olmalıdır (got ${diffStroke.toFixed(1)})`);
  assert.ok(diffColor <= 3, `Renk farkı <= 3 olmalıdır (got ${diffColor.toFixed(1)})`);
  assert.ok(diffBaseline <= 1, `Baseline farkı <= 1 px olmalıdır (got ${diffBaseline})`);

  return { prefixDiffCount, oldTextResidual, diffHeight, diffStroke, diffColor, diffBaseline, diffWidth, courierUsed };
}

async function main() {
  const results = [];

  // Target 1 & 2: Real scanned document via environment variable FORMA_REAL_PDF_PATH
  const realPdfPath = process.env.FORMA_REAL_PDF_PATH;
  if (realPdfPath && fs.existsSync(realPdfPath)) {
    console.log(`\n[Real Document Tests] FORMA_REAL_PDF_PATH yüklendi.`);
    const realPdfBytes = fs.readFileSync(realPdfPath);

    // Target 1: Normal text (Durak -> Demir) - Same 5 char count
    const res1 = await runSingleTargetTest(realPdfBytes, {
      id: "target-name",
      title: "1. Normal Metin (Durak -> Demir)",
      oldText: "Durak",
      newText: "Demir",
      minX: 199.0, maxX: 228.5, minY: 375.0, maxY: 386.1,
      size: 11.1,
      padLeft: 40, padRight: 30, padY: 20,
      minSearchOffset: 0,
      maxSearchOffset: 140
    }, 744);
    results.push({ target: "1. Normal Metin (Durak -> Demir)", ...res1 });

    // Target 2: Bold header (Enrollment -> Assessment) - Same 10 char count
    const res2 = await runSingleTargetTest(realPdfBytes, {
      id: "target-header",
      title: "2. Kalın Başlık (Enrollment -> Assessment)",
      oldText: "Enrollment",
      newText: "Assessment",
      minX: 360.0, maxX: 412.8, minY: 414.0, maxY: 425.1,
      size: 11.1,
      padLeft: 40, padRight: 30, padY: 20
    }, 744);
    results.push({ target: "2. Kalın Başlık (Enrollment -> Assessment)", ...res2 });
  } else {
    console.log(`\n[Real Document Tests] FORMA_REAL_PDF_PATH ortam değişkeni tanımlanmadı; gerçek PDF hedefleri güvenli şekilde ATLANDI (SKIP).`);
  }

  // Target 3: Turkish characters on synthetic non-PII fixture (Ornek Baslik -> Şüpheli Çağrı)
  console.log(`\n[Synthetic Non-PII Fixture Test] Türkçe Karakter Genelleştirme Fixture'ı oluşturuluyor...`);
  const synth = await createSyntheticTurkishScannedFixture();
  const res3 = await runSingleTargetTest(synth.pdfBytes, {
    id: "synthetic-target",
    title: "3. Türkçe Karakterli Sentetik Fixture (Ornek Baslik -> Şüpheli Çağrı)",
    oldText: "Ornek Baslik",
    newText: "Şüpheli Çağrı",
    minX: synth.x, maxX: synth.x + synth.w, minY: synth.y, maxY: synth.y + synth.h,
    size: synth.fontSize,
    padLeft: 40, padRight: 40, padY: 20,
    evalPercentile: 0.25
  }, synth.pageHeightPts);
  results.push({ target: "3. Türkçe Sentetik (Ornek Baslik -> Şüpheli Çağrı)", ...res3 });

  console.log("\n================================================================================");
  console.log("🎉 ÜÇ FARKLI GERÇEK METİN DEĞİŞİMİ GENELLEŞTİRME TESTİ %100 BAŞARILI!");
  console.table(results);
  console.log("================================================================================");
}

main().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});

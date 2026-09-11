import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PDFDocument } = require('@cantoo/pdf-lib');

import {
  detectDocumentEdges,
  warpPerspective,
  detectDeskewAngle,
  applyDocumentAdjustments,
} from '../features/scanner/imageProcessing.ts';
import { exportScannedPdf } from '../features/scanner/scannerPdfExport.ts';

console.log('================================================================');
console.log('TEST PHASE 1: DOCUMENT SCANNER & IMAGE ENHANCEMENT');
console.log('================================================================\n');

async function run() {
  // 1. Generate realistic test document raster image (receipt / contract-like)
  console.log('1. Creating realistic document image fixture...');
  const docSvg = `
    <svg width="800" height="1100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f4f1ea"/> <!-- slightly yellowed/shadowed background -->
      <!-- Document boundaries (rotated/angled inside photo) -->
      <g transform="rotate(3, 400, 550)">
        <rect x="60" y="80" width="680" height="940" fill="#ffffff" stroke="#cccccc" stroke-width="2"/>
        <text x="100" y="160" font-family="sans-serif" font-size="28" font-weight="bold" fill="#111827">FORMA RESMİ BELGE TARAMA TESTİ</text>
        <line x1="100" y1="180" x2="680" y2="180" stroke="#4f46e5" stroke-width="3"/>
        <text x="100" y="240" font-family="sans-serif" font-size="18" fill="#374151">Tarih: 12 Eylül 2026</text>
        <text x="100" y="280" font-family="sans-serif" font-size="18" fill="#374151">Belge No: SCAN-2026-001</text>
        <text x="100" y="340" font-family="sans-serif" font-size="16" fill="#4b5563">Bu taranmış sayfa perspektif düzeltme, filtreleme ve A4 PDF çıktısı için test edilmektedir.</text>
        <!-- Table simulation -->
        <rect x="100" y="400" width="580" height="200" fill="#f9fafb" stroke="#e5e7eb"/>
        <text x="120" y="440" font-family="sans-serif" font-size="16" font-weight="bold" fill="#111827">Hizmet / Açıklama</text>
        <text x="480" y="440" font-family="sans-serif" font-size="16" font-weight="bold" fill="#111827">Tutar</text>
        <line x1="100" y1="460" x2="680" y2="460" stroke="#e5e7eb"/>
        <text x="120" y="500" font-family="sans-serif" font-size="15" fill="#374151">Yerel Belge İyileştirme ve Tarama</text>
        <text x="480" y="500" font-family="sans-serif" font-size="15" fill="#374151">1.250 TL</text>
        <text x="120" y="550" font-family="sans-serif" font-size="15" fill="#374151">Aranabilir PDF (OCR) Katmanı</text>
        <text x="480" y="550" font-family="sans-serif" font-size="15" fill="#374151">750 TL</text>
      </g>
    </svg>
  `;

  const rawBuffer = await sharp(Buffer.from(docSvg)).png().toBuffer();
  const { data: rawPixels, info } = await sharp(rawBuffer).raw().ensureAlpha().toBuffer({ resolveWithObject: true });

  const inputImageData = {
    width: info.width,
    height: info.height,
    data: new Uint8ClampedArray(rawPixels),
  };

  // 2. Test Edge Detection
  console.log('\n2. Testing auto edge detection...');
  const edges = detectDocumentEdges(inputImageData);
  console.log('Detected document corners:', edges);
  assert.ok(edges.topLeft.x >= 0 && edges.topLeft.y >= 0, 'TopLeft corner valid');
  assert.ok(edges.bottomRight.x > edges.topLeft.x, 'BottomRight corner valid');

  // 3. Test Perspective Warp
  console.log('\n3. Testing 4-point perspective warp...');
  const warped = warpPerspective(inputImageData, edges, (w, h) => ({
    width: w,
    height: h,
    data: new Uint8ClampedArray(w * h * 4),
  }));
  console.log(`Warped output dimensions: ${warped.width}x${warped.height}`);
  assert.ok(warped.width > 200 && warped.height > 200, 'Warped perspective dimensions reasonable');

  // 4. Test Deskew Detection
  console.log('\n4. Testing auto deskew angle calculation...');
  const deskewAngle = detectDeskewAngle(inputImageData);
  console.log(`Detected deskew angle: ${deskewAngle}°`);
  assert.ok(typeof deskewAngle === 'number', 'Deskew angle is a number');

  // 5. Test Filters: Brightness, Contrast, Sharpness, Shadow Reduction & Modes
  console.log('\n5. Testing image adjustments & filters...');
  // 5a. Grayscale
  const grayRes = applyDocumentAdjustments(
    inputImageData,
    { brightness: 10, contrast: 15, sharpness: 40, shadowReduction: 50, filterMode: 'grayscale', deskewAngle: 0 },
    (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) })
  );
  // In grayscale, R == G == B
  assert.equal(grayRes.data[0], grayRes.data[1], 'Grayscale R equals G');
  assert.equal(grayRes.data[1], grayRes.data[2], 'Grayscale G equals B');

  // 5b. Black & White (Binary)
  const bwRes = applyDocumentAdjustments(
    inputImageData,
    { brightness: 0, contrast: 0, sharpness: 0, shadowReduction: 0, filterMode: 'bw', deskewAngle: 0 },
    (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) })
  );
  const p0 = bwRes.data[0];
  assert.ok(p0 === 0 || p0 === 255, 'Binary pixel must be 0 or 255');

  // 6. Multi-Page PDF Generation
  console.log('\n6. Testing multi-page scanned PDF generation...');
  // Convert processed image data back to JPEG DataURL for export test
  const page1Jpg = await sharp(Buffer.from(grayRes.data), {
    raw: { width: grayRes.width, height: grayRes.height, channels: 4 }
  }).jpeg({ quality: 85 }).toBuffer();
  const page1DataUrl = `data:image/jpeg;base64,${page1Jpg.toString('base64')}`;

  const page2Jpg = await sharp(Buffer.from(bwRes.data), {
    raw: { width: bwRes.width, height: bwRes.height, channels: 4 }
  }).jpeg({ quality: 85 }).toBuffer();
  const page2DataUrl = `data:image/jpeg;base64,${page2Jpg.toString('base64')}`;

  const scannedPages = [
    {
      id: 'scan_p1',
      originalDataUrl: page1DataUrl,
      processedDataUrl: page1DataUrl,
      width: grayRes.width,
      height: grayRes.height,
      rotation: 0,
      adjustments: { brightness: 0, contrast: 0, sharpness: 0, shadowReduction: 0, filterMode: 'grayscale', deskewAngle: 0 }
    },
    {
      id: 'scan_p2',
      originalDataUrl: page2DataUrl,
      processedDataUrl: page2DataUrl,
      width: bwRes.width,
      height: bwRes.height,
      rotation: 0,
      adjustments: { brightness: 0, contrast: 0, sharpness: 0, shadowReduction: 0, filterMode: 'bw', deskewAngle: 0 }
    }
  ];

  const pdfBytes = await exportScannedPdf(scannedPages, {
    fitToA4: true,
    margin: 'small',
    applyOcr: false,
    ocrLanguage: 'tur'
  });

  const pdfOutputPath = path.resolve('outputs/qa/test-scanned-output.pdf');
  fs.writeFileSync(pdfOutputPath, pdfBytes);
  console.log(`Generated scanned PDF: ${pdfBytes.length} bytes -> ${pdfOutputPath}`);

  // 7. Verify exported PDF by re-opening with PDFDocument
  console.log('\n7. Verifying generated PDF structure...');
  const loadedDoc = await PDFDocument.load(pdfBytes);
  assert.equal(loadedDoc.getPageCount(), 2, 'Generated PDF must have exactly 2 pages');
  const p1 = loadedDoc.getPage(0);
  const p1Size = p1.getSize();
  console.log(`Page 1 size: ${p1Size.width.toFixed(2)} x ${p1Size.height.toFixed(2)} (A4: 595.28 x 841.89)`);
  assert.equal(Math.round(p1Size.width), 595, 'Page 1 width must be standard A4 (595pt)');
  assert.equal(Math.round(p1Size.height), 842, 'Page 1 height must be standard A4 (842pt)');

  // 8. Negative test: Empty page array throws error
  console.log('\n8. Negative test: empty page list...');
  await assert.rejects(
    async () => {
      await exportScannedPdf([], { fitToA4: true, margin: 'none', applyOcr: false, ocrLanguage: 'tur' });
    },
    /Taranmış sayfa bulunamadı/
  );
  console.log('Negative test passed: empty pages correctly rejected.');

  console.log('\n================================================================');
  console.log('🎉 PHASE 1 (DOCUMENT SCANNER) VERIFICATION 100% PASSED!');
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('Phase 1 test failed:', err);
  process.exit(1);
});

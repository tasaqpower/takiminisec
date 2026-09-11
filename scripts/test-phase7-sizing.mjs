import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from '@cantoo/pdf-lib';
import {
  cropPdfPages,
  resizePdfPages,
  detectWhiteMargins,
  STANDARD_SIZES,
} from '../features/page-sizing/pageSizingEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

async function runPhase7Tests() {
  console.log('--- Phase 7: Page Sizing & Crop Test Suite ---');
  const outputsDir = path.join(projectRoot, 'outputs');
  if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir, { recursive: true });

  // 1. Create a 2-page test PDF
  const testDoc = await PDFDocument.create();
  const page1 = testDoc.addPage([595.28, 841.89]); // A4
  page1.drawText('Page 1 Original Content', { x: 100, y: 700, size: 20 });
  const page2 = testDoc.addPage([595.28, 841.89]); // A4
  page2.drawText('Page 2 Original Content', { x: 100, y: 700, size: 20 });
  const originalBytes = await testDoc.save();

  // Test 1: Auto detect white margins
  console.log('Testing detectWhiteMargins...');
  const detected = await detectWhiteMargins(originalBytes, 0);
  if (!detected || detected.top <= 0 || detected.left <= 0) {
    throw new Error('detectWhiteMargins failed to return valid margin numbers');
  }
  console.log('  PASS: detectWhiteMargins returned:', detected);

  // Test 2: Crop PDF pages (single page scope)
  console.log('Testing cropPdfPages (page 1 only)...');
  const cropOptions = {
    margins: { top: 50, bottom: 50, left: 40, right: 40 },
    scope: 'single',
    selectedPages: [1],
  };
  const croppedBytes = await cropPdfPages(originalBytes, cropOptions);
  const croppedDoc = await PDFDocument.load(croppedBytes);

  const croppedP1 = croppedDoc.getPage(0);
  const cBox1 = croppedP1.getCropBox();
  console.log(`  Page 1 CropBox: x=${cBox1.x}, y=${cBox1.y}, w=${cBox1.width}, h=${cBox1.height}`);

  if (Math.abs(cBox1.x - 40) > 1 || Math.abs(cBox1.y - 50) > 1) {
    throw new Error(`CropBox position mismatch: expected (40, 50), got (${cBox1.x}, ${cBox1.y})`);
  }
  const expectedW = 595.28 - 80;
  const expectedH = 841.89 - 100;
  if (Math.abs(cBox1.width - expectedW) > 1 || Math.abs(cBox1.height - expectedH) > 1) {
    throw new Error(`CropBox size mismatch: expected (${expectedW}, ${expectedH}), got (${cBox1.width}, ${cBox1.height})`);
  }

  // Verify page 2 was untouched
  const croppedP2 = croppedDoc.getPage(1);
  const cBox2 = croppedP2.getCropBox();
  if (Math.abs(cBox2.width - 595.28) > 1 || Math.abs(cBox2.height - 841.89) > 1) {
    throw new Error('Page 2 cropbox was unexpectedly modified!');
  }
  console.log('  PASS: Page 1 cropped accurately and Page 2 preserved');

  // Test 3: Resize PDF pages to A3 Landscape
  console.log('Testing resizePdfPages (A3 Landscape, fit-proportional)...');
  const resizeA3Options = {
    standardSize: 'A3',
    orientation: 'landscape',
    scalingMode: 'fit-proportional',
    margin: 20,
    scope: 'all',
  };
  const resizedA3Bytes = await resizePdfPages(originalBytes, resizeA3Options);
  const resizedA3Doc = await PDFDocument.load(resizedA3Bytes);
  if (resizedA3Doc.getPageCount() !== 2) {
    throw new Error(`Resized page count mismatch: expected 2, got ${resizedA3Doc.getPageCount()}`);
  }
  const rA3P1 = resizedA3Doc.getPage(0);
  const { width: a3W, height: a3H } = rA3P1.getSize();
  console.log(`  Resized Page 1 size: ${a3W} x ${a3H}`);

  // A3 is 841.89 x 1190.55. In landscape: width=1190.55, height=841.89
  if (Math.abs(a3W - 1190.55) > 1 || Math.abs(a3H - 841.89) > 1) {
    throw new Error(`A3 Landscape size mismatch: expected ~1190.55x841.89, got ${a3W}x${a3H}`);
  }
  console.log('  PASS: A3 Landscape resize dimensions verified');

  // Test 4: Resize PDF pages to Letter Portrait with custom margins
  console.log('Testing resizePdfPages (Letter Portrait)...');
  const resizeLetterOptions = {
    standardSize: 'Letter',
    orientation: 'portrait',
    scalingMode: 'extend-page',
    margin: 10,
    scope: 'all',
  };
  const resizedLetterBytes = await resizePdfPages(originalBytes, resizeLetterOptions);
  const resizedLetterDoc = await PDFDocument.load(resizedLetterBytes);
  const rLetterP1 = resizedLetterDoc.getPage(0);
  const { width: letterW, height: letterH } = rLetterP1.getSize();
  console.log(`  Resized Page 1 size: ${letterW} x ${letterH}`);

  // Letter is 612 x 792
  if (Math.abs(letterW - 612) > 1 || Math.abs(letterH - 792) > 1) {
    throw new Error(`Letter Portrait size mismatch: expected 612x792, got ${letterW}x${letterH}`);
  }
  console.log('  PASS: Letter Portrait resize dimensions verified');

  // Test 5: Negative bounds protection
  console.log('Testing bounds protection (oversized crop margins)...');
  const overcropOptions = {
    margins: { top: 500, bottom: 500, left: 400, right: 400 },
    scope: 'all',
  };
  const overcroppedBytes = await cropPdfPages(originalBytes, overcropOptions);
  const overcroppedDoc = await PDFDocument.load(overcroppedBytes);
  const overcroppedP1 = overcroppedDoc.getPage(0);
  const ocBox = overcroppedP1.getCropBox();
  if (ocBox.width < 10 || ocBox.height < 10) {
    throw new Error('Oversized crop margins failed to enforce minimum safe dimensions (10pt)!');
  }
  console.log('  PASS: Crop safely clamped to minimum dimensions');

  // Save output sample files
  const cropPath = path.join(outputsDir, 'test-phase7-cropped.pdf');
  const resizePath = path.join(outputsDir, 'test-phase7-resized.pdf');
  fs.writeFileSync(cropPath, Buffer.from(croppedBytes));
  fs.writeFileSync(resizePath, Buffer.from(resizedA3Bytes));
  console.log(`  Saved cropped sample: ${cropPath} (${croppedBytes.length} bytes)`);
  console.log(`  Saved resized sample: ${resizePath} (${resizedA3Bytes.length} bytes)`);

  console.log('--- ALL PHASE 7 TESTS PASSED SUCCESSFULLY ---');
  return {
    success: true,
    croppedBytesLength: croppedBytes.length,
    resizedBytesLength: resizedA3Bytes.length,
  };
}

runPhase7Tests().catch((err) => {
  console.error('Phase 7 Test Failed:', err);
  process.exit(1);
});

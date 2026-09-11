import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PDFDocument } = require('@cantoo/pdf-lib');

import {
  computeLineDiff,
  diffPixelBuffers,
  comparePdfs,
  exportCompareReport,
} from '../features/compare/compareEngine.ts';

console.log('================================================================');
console.log('TEST PHASE 4: PDF COMPARE (TEXT, VISUAL & COMBINED)');
console.log('================================================================\n');

async function run() {
  // 1. Test LCS Line Diff Algorithm
  console.log('1. Testing LCS line diff algorithm...');
  const linesOld = [
    'MADDE 1: TARAFLAR',
    'Bu sozlesme Sirket A ile Musteri B arasinda imzalanmistir.',
    'MADDE 2: UCRET',
    'Hizmet bedeli aylik 10.000 TL olarak belirlenmistir.',
    'MADDE 3: SURE',
    'Sozlesme suresi 1 yildir.',
  ];

  const linesNew = [
    'MADDE 1: TARAFLAR',
    'Bu sozlesme Sirket A ile Musteri B ve Ortaklari arasinda imzalanmistir.', // modified
    'MADDE 2: UCRET',
    'Hizmet bedeli aylik 15.000 TL olarak belirlenmistir.', // modified
    'MADDE 2.1: EK ODEME', // added
    'Yillik prim tutari 2.000 TL dir.', // added
    'MADDE 3: SURE',
    'Sozlesme suresi 2 yildir.', // modified
  ];

  const diffs = computeLineDiff(linesOld, linesNew, true, true);
  console.log('Line diff results:');
  diffs.forEach((d) => console.log(`  [${d.type.toUpperCase()}] ${d.text}`));

  assert.ok(diffs.some((d) => d.type === 'modified'), 'Detects modified lines');
  assert.ok(diffs.some((d) => d.type === 'added'), 'Detects added lines');
  assert.ok(diffs.some((d) => d.type === 'unchanged'), 'Detects unchanged lines');

  // 2. Test Pixel Buffer Diff
  console.log('\n2. Testing pixel-level difference calculation...');
  const w = 100, h = 100;
  const pA = new Uint8ClampedArray(w * h * 4).fill(255); // all white
  const pB = new Uint8ClampedArray(w * h * 4).fill(255);
  // Introduce a 20x20 red square in pB
  for (let y = 10; y < 30; y++) {
    for (let x = 10; x < 30; x++) {
      const idx = (y * w + x) * 4;
      pB[idx] = 255;   // R
      pB[idx + 1] = 0; // G
      pB[idx + 2] = 0; // B
    }
  }

  const pxDiff = diffPixelBuffers(pA, pB, w, h, 30);
  console.log(`Pixel diff detected: ${pxDiff.diffPixelCount} changed pixels (${pxDiff.diffPercent.toFixed(2)}%)`);
  assert.equal(pxDiff.diffPixelCount, 400, 'Expected exactly 20x20 = 400 changed pixels');
  assert.equal(pxDiff.diffPercent, 4, 'Expected exactly 4% area difference');

  // 3. Test Full PDF Compare with Mismatched Page Counts
  console.log('\n3. Testing PDF compare with mismatched page counts (2 pages vs 3 pages)...');
  const docA = await PDFDocument.create();
  const pA1 = docA.addPage([500, 700]);
  pA1.drawText('Forma V1 - Sayfa 1', { x: 50, y: 650, size: 20 });
  const pA2 = docA.addPage([500, 700]);
  pA2.drawText('Forma V1 - Sayfa 2', { x: 50, y: 650, size: 20 });
  const bytesA = await docA.save();

  const docB = await PDFDocument.create();
  const pB1 = docB.addPage([500, 700]);
  pB1.drawText('Forma V2 - Sayfa 1 Guncellendi', { x: 50, y: 650, size: 20 });
  const pB2 = docB.addPage([500, 700]);
  pB2.drawText('Forma V1 - Sayfa 2', { x: 50, y: 650, size: 20 });
  const pB3 = docB.addPage([500, 700]);
  pB3.drawText('Forma V2 - Yeni Eklenen Sayfa 3', { x: 50, y: 650, size: 20 });
  const bytesB = await docB.save();

  const summary = await comparePdfs(bytesA, bytesB, {
    mode: 'combined',
    ignoreWhitespace: true,
    caseSensitive: true,
    pixelThreshold: 35,
    dpi: 100,
  });

  console.log('Compare Summary:');
  console.log(`  Doc A Pages: ${summary.leftPageCount}, Doc B Pages: ${summary.rightPageCount}`);
  console.log(`  Differences: ${summary.totalDifferences} pages, +${summary.addedCount} added, -${summary.deletedCount} deleted, ~${summary.modifiedCount} modified`);
  assert.equal(summary.leftPageCount, 2, 'Doc A has 2 pages');
  assert.equal(summary.rightPageCount, 3, 'Doc B has 3 pages');
  assert.equal(summary.pageDiffs.length, 3, 'Reconciled to 3 total pages');
  assert.ok(summary.pageDiffs[2].hasDifferences, 'Page 3 is correctly identified as different/added');

  // 4. Test Export Formats (JSON, HTML, Summary PDF)
  console.log('\n4. Testing export formats...');
  // JSON
  const jsonReport = await exportCompareReport(summary, 'json', 'Doc_v1.pdf', 'Doc_v2.pdf');
  assert.equal(typeof jsonReport, 'string', 'JSON is string');
  assert.ok(jsonReport.includes('"totalDifferences"'), 'JSON contains summary');

  // HTML
  const htmlReport = await exportCompareReport(summary, 'html', 'Doc_v1.pdf', 'Doc_v2.pdf');
  assert.ok(htmlReport.includes('<!DOCTYPE html>'), 'HTML contains doctype');
  assert.ok(htmlReport.includes('Doc_v1.pdf'), 'HTML contains doc names');
  fs.writeFileSync('outputs/qa/test-compare-report.html', htmlReport);

  // Summary PDF
  const summaryPdfBytes = await exportCompareReport(summary, 'summaryPdf', 'Doc_v1.pdf', 'Doc_v2.pdf');
  assert.ok(summaryPdfBytes instanceof Uint8Array, 'PDF summary is Uint8Array');
  const summaryDoc = await PDFDocument.load(summaryPdfBytes);
  assert.equal(summaryDoc.getPageCount(), 1, 'PDF summary has 1 page');
  fs.writeFileSync('outputs/qa/test-compare-report.pdf', summaryPdfBytes);
  console.log(`Generated HTML & PDF compare reports in outputs/qa/`);

  // 5. Negative test: Corrupted bytes
  console.log('\n5. Negative test: Corrupted bytes...');
  await assert.rejects(
    async () => {
      await comparePdfs(new Uint8Array([1, 2, 3]), bytesB, {
        mode: 'text',
        ignoreWhitespace: true,
        caseSensitive: true,
        pixelThreshold: 35,
        dpi: 100,
      });
    },
    /Failed to parse/
  );
  console.log('Negative test passed: Corrupted PDF rejected gracefully.');

  console.log('\n================================================================');
  console.log('🎉 PHASE 4 (PDF COMPARE) VERIFICATION 100% PASSED!');
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('Phase 4 test failed:', err);
  process.exit(1);
});

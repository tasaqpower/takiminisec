import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PDFDocument } = require('@cantoo/pdf-lib');

import {
  runBatchQueue,
  createBatchZip,
  generateBatchCsvReport,
} from '../features/batch/batchProcessor.ts';

console.log('================================================================');
console.log('TEST PHASE 5: BATCH PROCESSING QUEUE (5+ FILES & ISOLATION)');
console.log('================================================================\n');

async function run() {
  // 1. Create sample PDF files for batch queue
  console.log('1. Preparing 5 batch test items (including 1 intentionally corrupted file)...');

  const createSamplePdf = async (title) => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([500, 700]);
    page.drawText(title, { x: 50, y: 650, size: 20 });
    return await doc.save();
  };

  const pdf1 = await createSamplePdf('Toplu Belge 1 - Finans');
  const pdf2 = await createSamplePdf('Toplu Belge 2 - Hukuk');
  const pdf3 = await createSamplePdf('Toplu Belge 3 - İK');
  const pdf4 = await createSamplePdf('Toplu Belge 4 - Rapor');
  const brokenPdf = new Uint8Array([0, 1, 2, 3, 4, 5]); // deliberately corrupted

  const batchItems = [
    { id: 'item_1', name: 'finans_raporu.pdf', size: pdf1.length, status: 'pending', progress: 0, bytes: pdf1 },
    { id: 'item_2', name: 'hukuk_sozlesme.pdf', size: pdf2.length, status: 'pending', progress: 0, bytes: pdf2 },
    { id: 'item_3', name: 'ik_bordro.pdf', size: pdf3.length, status: 'pending', progress: 0, bytes: pdf3 },
    { id: 'item_4', name: 'bozuk_belge.pdf', size: brokenPdf.length, status: 'pending', progress: 0, bytes: brokenPdf },
    { id: 'item_5', name: 'faaliyet_ozeti.pdf', size: pdf4.length, status: 'pending', progress: 0, bytes: pdf4 },
  ];

  assert.equal(batchItems.length, 5, 'Queue has exactly 5 files');

  // 2. Execute Batch Queue with Watermark operation & concurrency limit of 2
  console.log('\n2. Executing batch queue with concurrency limit = 2...');
  const results = await runBatchQueue(
    batchItems,
    {
      operation: 'watermark',
      watermarkText: 'TOPLU ONAY',
      watermarkOpacity: 0.25,
      maxConcurrent: 2,
    },
    (itemId, prog, done, total, msg) => {
      console.log(`  Progress: [${done}/${total}] ${msg}`);
    }
  );

  // 3. Verify Error Isolation: 4 succeeded, 1 failed, queue completed fully
  console.log('\n3. Verifying error isolation & results...');
  const successItems = results.filter((r) => r.status === 'success');
  const errorItems = results.filter((r) => r.status === 'error');

  console.log(`  Success count: ${successItems.length}/5`);
  console.log(`  Error count  : ${errorItems.length}/5`);

  assert.equal(successItems.length, 4, 'Expected 4 items to succeed');
  assert.equal(errorItems.length, 1, 'Expected 1 corrupted item to fail gracefully');
  assert.equal(errorItems[0].name, 'bozuk_belge.pdf', 'Corrupted file was isolated');
  console.log('Error isolation verified: Corrupted file did NOT break queue.');

  // 4. Verify Success Outputs by loading them back with PDFDocument
  console.log('\n4. Verifying valid PDF structure of processed outputs...');
  for (const item of successItems) {
    assert.ok(item.resultBytes && item.resultBytes.length > 0, `${item.name} produced output bytes`);
    const verifiedDoc = await PDFDocument.load(item.resultBytes);
    assert.equal(verifiedDoc.getPageCount(), 1, `${item.name} has valid 1-page PDF structure`);
  }
  console.log('All 4 output files reloaded and verified as valid PDFs.');

  // 5. Test ZIP Archive Generation
  console.log('\n5. Testing ZIP archive generation of successful batch outputs...');
  const zipBytes = await createBatchZip(results);
  assert.ok(zipBytes.length > 0, 'ZIP bytes generated');
  const zipPath = path.resolve('outputs/qa/test-batch-outputs.zip');
  fs.writeFileSync(zipPath, zipBytes);
  console.log(`Generated ZIP archive: ${zipBytes.length} bytes -> ${zipPath}`);

  // 6. Test CSV & JSON Reports
  console.log('\n6. Testing CSV and JSON batch execution reports...');
  const csvReport = generateBatchCsvReport(results, 'watermark');
  assert.ok(csvReport.includes('finans_raporu.pdf'), 'CSV includes file 1');
  assert.ok(csvReport.includes('bozuk_belge.pdf'), 'CSV includes broken file');
  assert.ok(csvReport.includes('error'), 'CSV includes error status');
  fs.writeFileSync('outputs/qa/test-batch-report.csv', csvReport);

  const jsonReport = JSON.stringify(
    results.map((r) => ({ name: r.name, status: r.status, time: r.executionTimeMs, err: r.error })),
    null,
    2
  );
  fs.writeFileSync('outputs/qa/test-batch-report.json', jsonReport);
  console.log('CSV and JSON reports written to outputs/qa/');

  console.log('\n================================================================');
  console.log('🎉 PHASE 5 (BATCH PROCESSING) VERIFICATION 100% PASSED!');
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('Phase 5 test failed:', err);
  process.exit(1);
});

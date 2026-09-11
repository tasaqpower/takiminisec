import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PDFDocument } = require('@cantoo/pdf-lib');

import {
  writeAnnotationsToPdf,
  readAnnotationsFromPdf,
  exportAnnotationsReport,
} from '../features/annotations/annotationEngine.ts';

console.log('================================================================');
console.log('TEST PHASE 3: PDF ANNOTATIONS & REVIEW TOOLS');
console.log('================================================================\n');

async function run() {
  // 1. Create a 3-page base PDF document
  console.log('1. Creating 3-page sample PDF document...');
  const baseDoc = await PDFDocument.create();
  for (let i = 0; i < 3; i++) {
    const page = baseDoc.addPage([595.28, 841.89]);
    page.drawText(`Forma Sozlesme Sayfasi ${i + 1}`, { x: 50, y: 750, size: 22 });
    page.drawText('Bu paragraf hukuki inceleme altindadir. Onay ve duzeltmeler buraya islenecektir.', { x: 50, y: 700, size: 12 });
  }
  const basePdfBytes = await baseDoc.save();

  // 2. Build 11 distinct annotations representing all requested types
  console.log('\n2. Creating all requested annotation types...');
  const annotations = [
    // 1. Sticky Note
    {
      id: 'annot_1_note',
      pageIndex: 0,
      type: 'text',
      rect: [50, 720, 72, 742],
      author: 'Av. Mehmet Kaya',
      date: new Date().toISOString(),
      color: '#eab308',
      opacity: 0.9,
      contents: 'Madde 3 yeniden degerlendirilmeli.',
      resolved: false,
    },
    // 2. Highlight
    {
      id: 'annot_2_highlight',
      pageIndex: 0,
      type: 'highlight',
      rect: [50, 695, 300, 715],
      author: 'Av. Mehmet Kaya',
      date: new Date().toISOString(),
      color: '#facc15',
      opacity: 0.4,
      contents: 'Vurgulanan hukuki sart.',
      resolved: false,
    },
    // 3. Underline
    {
      id: 'annot_3_underline',
      pageIndex: 0,
      type: 'underline',
      rect: [50, 680, 250, 685],
      author: 'Denetçi Ayşe',
      date: new Date().toISOString(),
      color: '#3b82f6',
      opacity: 0.8,
      contents: 'Önemli şartın altı çizildi.',
      resolved: false,
    },
    // 4. Strikeout
    {
      id: 'annot_4_strikeout',
      pageIndex: 0,
      type: 'strikeout',
      rect: [260, 680, 380, 690],
      author: 'Denetçi Ayşe',
      date: new Date().toISOString(),
      color: '#ef4444',
      opacity: 0.8,
      contents: 'Hatalı ibare silindi.',
      resolved: true,
    },
    // 5. Ink / Freehand
    {
      id: 'annot_5_ink',
      pageIndex: 1,
      type: 'ink',
      rect: [100, 500, 200, 600],
      author: 'Teknik Ekip',
      date: new Date().toISOString(),
      color: '#8b5cf6',
      opacity: 0.8,
      contents: 'Serbest paraflama.',
      resolved: false,
      inkPaths: [
        [{ x: 100, y: 500 }, { x: 120, y: 530 }, { x: 150, y: 520 }, { x: 180, y: 560 }]
      ]
    },
    // 6. Arrow
    {
      id: 'annot_6_arrow',
      pageIndex: 1,
      type: 'arrow',
      rect: [200, 400, 350, 450],
      author: 'Teknik Ekip',
      date: new Date().toISOString(),
      color: '#06b6d4',
      opacity: 0.9,
      contents: 'Bu tabloya dikkat ediniz.',
      resolved: false,
      linePoints: { x1: 200, y1: 400, x2: 350, y2: 450 }
    },
    // 7. Line
    {
      id: 'annot_7_line',
      pageIndex: 1,
      type: 'line',
      rect: [50, 300, 500, 305],
      author: 'Teknik Ekip',
      date: new Date().toISOString(),
      color: '#64748b',
      opacity: 0.7,
      contents: 'Ayrım çizgisi.',
      resolved: false,
      linePoints: { x1: 50, y1: 300, x2: 500, y2: 300 }
    },
    // 8. Rectangle
    {
      id: 'annot_8_rect',
      pageIndex: 2,
      type: 'rectangle',
      rect: [60, 550, 260, 650],
      author: 'Mali Müşavir',
      date: new Date().toISOString(),
      color: '#10b981',
      opacity: 0.8,
      contents: 'Bütçe onay kutusu.',
      resolved: false,
    },
    // 9. Circle
    {
      id: 'annot_9_circle',
      pageIndex: 2,
      type: 'circle',
      rect: [300, 550, 450, 650],
      author: 'Mali Müşavir',
      date: new Date().toISOString(),
      color: '#f97316',
      opacity: 0.8,
      contents: 'Önemli tutar dairesi.',
      resolved: false,
    },
    // 10. FreeText / Callout
    {
      id: 'annot_10_freetext',
      pageIndex: 2,
      type: 'freetext',
      rect: [60, 400, 350, 460],
      author: 'Yönetim',
      date: new Date().toISOString(),
      color: '#4f46e5',
      opacity: 0.9,
      contents: 'Özel Not: Sözleşme 1 yıl süreyle yürürlüktedir.',
      resolved: false,
      fontSize: 10,
    },
    // 11. Stamp (ONAYLANDI)
    {
      id: 'annot_11_stamp',
      pageIndex: 2,
      type: 'stamp',
      rect: [400, 380, 540, 440],
      author: 'Genel Müdür',
      date: new Date().toISOString(),
      color: '#16a34a',
      opacity: 0.95,
      contents: 'Yönetim Kurulu Onayı',
      resolved: true,
      stampPreset: 'onaylandi',
    },
  ];

  // 3. Write annotations to PDF
  console.log('\n3. Writing annotations to PDF structure and appearance streams...');
  const annotatedBytes = await writeAnnotationsToPdf(basePdfBytes, annotations);
  const outAnnotatedPath = path.resolve('outputs/qa/test-annotated-output.pdf');
  fs.writeFileSync(outAnnotatedPath, annotatedBytes);
  console.log(`Generated annotated PDF: ${annotatedBytes.length} bytes -> ${outAnnotatedPath}`);

  // 4. Verify by reading back annotations from PDF
  console.log('\n4. Reading annotations back from PDF dictionaries...');
  const readAnnots = await readAnnotationsFromPdf(annotatedBytes);
  console.log(`Successfully extracted ${readAnnots.length} annotations from PDF structure.`);
  assert.ok(readAnnots.length >= 10, 'Expected at least 10 annotations extracted from PDF');

  // 5. Test JSON Export
  console.log('\n5. Testing JSON report export...');
  const jsonReport = (await exportAnnotationsReport(annotations, 'json'));
  assert.equal(typeof jsonReport, 'string', 'JSON report is string');
  const parsedJson = JSON.parse(jsonReport);
  assert.equal(parsedJson.length, 11, 'JSON contains all 11 annotations');

  // 6. Test Summary PDF Report Export
  console.log('\n6. Testing Summary PDF report export...');
  const summaryPdfBytes = (await exportAnnotationsReport(annotations, 'summaryPdf', 'sozlesme.pdf'));
  assert.ok(summaryPdfBytes instanceof Uint8Array, 'Summary PDF is Uint8Array');
  const summaryDoc = await PDFDocument.load(summaryPdfBytes);
  assert.equal(summaryDoc.getPageCount(), 1, 'Summary PDF has 1 page');

  // 7. Negative test: Corrupted bytes
  console.log('\n7. Negative test: Corrupted bytes...');
  await assert.rejects(
    async () => {
      await writeAnnotationsToPdf(new Uint8Array([9, 8, 7, 6]), annotations);
    },
    /Failed to parse/
  );
  console.log('Negative test passed: Corrupted PDF bytes cleanly rejected.');

  console.log('\n================================================================');
  console.log('🎉 PHASE 3 (ANNOTATIONS & REVIEW) VERIFICATION 100% PASSED!');
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('Phase 3 test failed:', err);
  process.exit(1);
});

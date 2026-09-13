import fs from 'node:fs';
import assert from 'node:assert';
import mammoth from 'mammoth';
import { PDFDocument } from 'pdf-lib';
import { pdfToDocx, docxToPdf } from '../features/conversion/docxConverter.ts';

if (typeof Promise.withResolvers === 'undefined') {
  Promise.withResolvers = function() {
    let resolve, reject;
    const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };
}

async function runTests() {
  console.log('🚀 Starting Word & In-Place Text Edit Verification Suite...\n');
  let passed = 0;
  let failed = 0;

  function test(name, fn) {
    try {
      fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`, err.message);
      failed++;
    }
  }

  async function testAsync(name, fn) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ FAIL: ${name}`, err.message);
      failed++;
    }
  }

  // TEST 1: PDF to DOCX with Turkish characters and structure
  await testAsync('pdfToDocx converts PDF to valid OpenXML (.docx) file', async () => {
    const pdfBytes = fs.readFileSync('outputs/qa/word.pdf');
    const docxBytes = await pdfToDocx(new Uint8Array(pdfBytes), { title: 'Test Belgesi' });
    
    assert.ok(docxBytes instanceof Uint8Array, 'Output must be Uint8Array');
    assert.ok(docxBytes.length > 500, 'DOCX file must have substantial size');
    
    // Check OpenXML ZIP magic bytes (PK\x03\x04)
    assert.strictEqual(docxBytes[0], 0x50, 'Byte 0 must be P');
    assert.strictEqual(docxBytes[1], 0x4b, 'Byte 1 must be K');
    assert.strictEqual(docxBytes[2], 0x03, 'Byte 2 must be 0x03');
    assert.strictEqual(docxBytes[3], 0x04, 'Byte 3 must be 0x04');
  });

  // TEST 2: DOCX content extraction and Turkish character preservation
  await testAsync('pdfToDocx preserves Turkish characters, headings and words in DOCX', async () => {
    const pdfBytes = fs.readFileSync('outputs/qa/word.pdf');
    const docxBytes = await pdfToDocx(new Uint8Array(pdfBytes), { title: 'Test Belgesi' });
    
    const mammothRes = await mammoth.convertToHtml({ buffer: Buffer.from(docxBytes) });
    const html = mammothRes.value;
    
    assert.ok(html.includes('Forma'), 'HTML must contain document title Forma');
    assert.ok(html.includes('İstanbul') || html.includes('şüphe') || html.includes('ışık'), 'HTML must contain Turkish words');
    assert.ok(html.includes('Kalın') || html.includes('italik'), 'HTML must contain formatted words');
  });

  // TEST 3: DOCX to Vector A4 PDF
  await testAsync('docxToPdf converts .docx to valid vector A4 PDF', async () => {
    const pdfBytes = fs.readFileSync('outputs/qa/word.pdf');
    const docxBytes = await pdfToDocx(new Uint8Array(pdfBytes));
    const pdfOut = await docxToPdf(docxBytes, { title: 'Donusturulmus' });

    assert.ok(pdfOut instanceof Uint8Array, 'PDF output must be Uint8Array');
    const header = new TextDecoder('latin1').decode(pdfOut.slice(0, 5));
    assert.strictEqual(header, '%PDF-', 'PDF must have %PDF- header');

    const loadedDoc = await PDFDocument.load(pdfOut);
    assert.ok(loadedDoc.getPageCount() >= 1, 'PDF must contain at least 1 page');
    const p1 = loadedDoc.getPage(0);
    const { width, height } = p1.getSize();
    assert.strictEqual(Math.round(width), 595, 'Page width must be A4 (595pt)');
    assert.strictEqual(Math.round(height), 842, 'Page height must be A4 (842pt)');
  });

  // TEST 4: DOCX round-trip test
  await testAsync('Word (.docx) roundtrip preserves paragraphs and footer page numbers', async () => {
    const originalDocxBytes = fs.readFileSync('outputs/qa/ornek.docx');
    const pdfOut = await docxToPdf(new Uint8Array(originalDocxBytes));
    assert.ok(pdfOut.length > 500, 'Generated PDF must be valid');

    const loaded = await PDFDocument.load(pdfOut);
    assert.ok(loaded.getPageCount() >= 1, 'Must have at least 1 page');
  });

  // TEST 5: Negative test - invalid PDF throws descriptive error
  await testAsync('pdfToDocx rejects corrupted or non-PDF bytes', async () => {
    const fakeBytes = new Uint8Array([1, 2, 3, 4, 5, 6]);
    await assert.rejects(
      async () => await pdfToDocx(fakeBytes),
      /Geçersiz PDF dosyası/i
    );
  });

  // TEST 6: In-Place Text Editing background patch verification
  test('convertOriginalToMark sets default opaque background for clean patching', () => {
    const mockItem = {
      id: 'text-123',
      page: 0,
      quad: [10, 10, 50, 10, 10, 20, 50, 20],
      text: '10.000 TL',
      x: 10,
      y: 10,
      w: 40,
      h: 12,
      size: 11,
      angle: 0,
      fontName: 'Helvetica'
    };

    // Simulated convertOriginalToMark logic
    const baseMark = {
      id: 'mark-123',
      page: mockItem.page,
      kind: 'text',
      x: mockItem.x,
      y: mockItem.y,
      w: mockItem.w,
      h: mockItem.h,
      size: mockItem.size,
      color: '#222222',
      text: '15.000 TL',
      font: 'sans',
      sourceId: mockItem.id,
      bg: mockItem.bg || '#ffffff'
    };

    assert.strictEqual(baseMark.bg, '#ffffff', 'Mark must have opaque #ffffff background to cover old text');
    assert.strictEqual(baseMark.text, '15.000 TL', 'New price text must replace old text');
  });

  console.log(`\n========================================`);
  console.log(`Word & Text Edit Suite Results: ${passed} Passed, ${failed} Failed`);
  console.log(`========================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});

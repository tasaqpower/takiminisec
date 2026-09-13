import { PDFDocument, rgb, StandardFonts, degrees } from 'pdf-lib';
import assert from 'node:assert';

// Import compiled or source modules
import { parseUserIntent } from '../features/ai-copilot/aiIntentEngine.ts';
import { dispatchAiAction } from '../features/ai-copilot/aiActionDispatcher.ts';

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

console.log('--- STARTING FORMA AI COPILOT TEST SUITE ---');

// Phase 1: Intent Classification Tests
const testCases = [
  { prompt: 'koyu mod yap', expectedAction: 'theme_dark' },
  { prompt: 'gece moduna gec', expectedAction: 'theme_dark' },
  { prompt: 'ekrani karanlik yap', expectedAction: 'theme_dark' },
  { prompt: 'acik mod yap', expectedAction: 'theme_light' },
  { prompt: 'gunduz moduna cevir', expectedAction: 'theme_light' },
  { prompt: 'bu belgedeki filigrani ve taslak damgalarini kaldir', expectedAction: 'watermark_remove' },
  { prompt: 'fligrani sil', expectedAction: 'watermark_remove' },
  { prompt: 'taslak damgasini kaldir', expectedAction: 'watermark_remove' },
  { prompt: 'yazilari netlestir soluk cikmis okunmuyor', expectedAction: 'enhance_document', expectedMode: 'document' },
  { prompt: 'fotografi ve resimleri netlestir', expectedAction: 'enhance_document', expectedMode: 'photo' },
  { prompt: 'PDF dosyasini sikistir boyutu cok buyuk', expectedAction: 'compress_pdf' },
  { prompt: 'mb dusur hafiflet', expectedAction: 'compress_pdf' },
  { prompt: 'belgedeki TC kimlik ve IBAN numaralarini sansurle', expectedAction: 'redact_pii' },
  { prompt: 'kvkk kapsaminda kisisel verileri maskele', expectedAction: 'redact_pii' },
  { prompt: 'bu PDF belgesini Word docx formatina cevir', expectedAction: 'convert_word' },
  { prompt: 'tablolari Excel e aktar xlsx yap', expectedAction: 'convert_excel' },
  { prompt: 'sayfalari gorsel yap png olarak kaydet', expectedAction: 'convert_img' },
  { prompt: 'belgeye resmi ASLI GIBIDIR kasesi bas', expectedAction: 'stamp_document', expectedStamp: 'asli_gibidir' },
  { prompt: 'belgeyi onaylandi kasesi ile damgala', expectedAction: 'stamp_document', expectedStamp: 'onaylandi' },
  { prompt: 'sayfalari 90 derece dondur yan duruyor', expectedAction: 'rotate_pages', expectedAngle: 90 },
  { prompt: 'bu belgede kac sayfa var analiz et', expectedAction: 'document_info' },
];

let passedIntents = 0;
for (const tc of testCases) {
  const result = parseUserIntent(tc.prompt);
  assert.strictEqual(
    result.action,
    tc.expectedAction,
    `Failed for prompt: "${tc.prompt}". Expected ${tc.expectedAction}, got ${result.action}`
  );

  if (tc.expectedMode) {
    assert.strictEqual(result.parameters?.enhanceMode, tc.expectedMode);
  }
  if (tc.expectedStamp) {
    assert.strictEqual(result.parameters?.stampType, tc.expectedStamp);
  }
  if (tc.expectedAngle) {
    assert.strictEqual(result.parameters?.angle, tc.expectedAngle);
  }
  passedIntents++;
}
console.log(`[PASS] All ${passedIntents}/${testCases.length} Natural Language Intent classifications passed!`);

// Phase 2: Action Dispatcher Execution Tests on Real PDF Bytes
async function testDispatcherExecution() {
  console.log('\n--- TESTING DISPATCHER EXECUTION ON REAL PDF BYTES ---');

  // Create test PDF document
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const page1 = pdfDoc.addPage([595, 842]);
  page1.drawText('Forma Test Sozlesmesi', { x: 50, y: 800, size: 18, font, color: rgb(0, 0, 0) });
  page1.drawText('Musteri TC Kimlik No: 12345678901', { x: 50, y: 760, size: 12, font, color: rgb(0, 0, 0) });
  page1.drawText('Banka Hesap TR330006100519786457841326', { x: 50, y: 740, size: 12, font, color: rgb(0, 0, 0) });
  page1.drawText('GECERSIZ TASLAK', { x: 150, y: 450, size: 40, font, color: rgb(0.8, 0.8, 0.8), rotate: degrees(45) });

  const initialBytes = await pdfDoc.save();
  assert.ok(initialBytes.byteLength > 0, 'Initial PDF bytes generated');
  console.log(`[OK] Generated sample test PDF (${initialBytes.byteLength} bytes)`);

  const ctx = {
    pdfBytes: initialBytes,
    fileName: 'test_sozlesme.pdf',
    currentPage: 0,
  };

  // 1. Theme Dark
  const darkRes = await dispatchAiAction(parseUserIntent('koyu mod yap'), ctx);
  assert.strictEqual(darkRes.action, 'theme_dark');
  assert.strictEqual(darkRes.success, true);
  console.log('[PASS] Action: theme_dark executed successfully');

  // 2. Theme Light
  const lightRes = await dispatchAiAction(parseUserIntent('acik mod yap'), ctx);
  assert.strictEqual(lightRes.action, 'theme_light');
  assert.strictEqual(lightRes.success, true);
  console.log('[PASS] Action: theme_light executed successfully');

  // 3. Watermark Removal
  const wmRes = await dispatchAiAction(parseUserIntent('filigran kaldir'), ctx);
  assert.strictEqual(wmRes.action, 'watermark_remove');
  assert.strictEqual(wmRes.success, true);
  console.log('[PASS] Action: watermark_remove executed successfully');

  // 4. Document Enhancement
  const enhRes = await dispatchAiAction(parseUserIntent('yazilari netlestir'), ctx);
  assert.strictEqual(enhRes.action, 'enhance_document');
  assert.strictEqual(enhRes.success, true);
  assert.ok(enhRes.newPdfBytes && enhRes.newPdfBytes.byteLength > 0);
  console.log(`[PASS] Action: enhance_document executed successfully (result: ${enhRes.newPdfBytes.byteLength} bytes)`);

  // 5. Compression
  const compRes = await dispatchAiAction(parseUserIntent('sikistir'), ctx);
  assert.strictEqual(compRes.action, 'compress_pdf');
  assert.strictEqual(compRes.success, true);
  assert.ok(compRes.newPdfBytes && compRes.newPdfBytes.byteLength > 0);
  console.log(`[PASS] Action: compress_pdf executed successfully (result: ${compRes.newPdfBytes.byteLength} bytes)`);

  // 6. KVKK / PII Redaction
  const piiRes = await dispatchAiAction(parseUserIntent('TC ve IBAN sansurle'), ctx);
  assert.strictEqual(piiRes.action, 'redact_pii');
  assert.strictEqual(piiRes.success, true);
  console.log(`[PASS] Action: redact_pii executed successfully: ${piiRes.message}`);

  // 7. Stamping
  const stampRes = await dispatchAiAction(parseUserIntent('ASLI GIBIDIR kasesi bas'), ctx);
  assert.strictEqual(stampRes.action, 'stamp_document');
  assert.strictEqual(stampRes.success, true);
  assert.ok(stampRes.newPdfBytes && stampRes.newPdfBytes.byteLength > 0);
  console.log(`[PASS] Action: stamp_document executed successfully (result: ${stampRes.newPdfBytes.byteLength} bytes)`);

  // 7. Page Rotation
  const rotRes = await dispatchAiAction(parseUserIntent('sayfalari 90 derece dondur'), ctx);
  assert.strictEqual(rotRes.action, 'rotate_pages');
  assert.strictEqual(rotRes.success, true);
  assert.ok(rotRes.newPdfBytes && rotRes.newPdfBytes.byteLength > 0);
  // Verify rotation with pdf-lib
  const rotatedDoc = await PDFDocument.load(rotRes.newPdfBytes);
  const rotPage = rotatedDoc.getPage(0);
  assert.strictEqual(rotPage.getRotation().angle, 90);
  console.log(`[PASS] Action: rotate_pages executed successfully (page rotation angle: ${rotPage.getRotation().angle}°)`);

  // 8. Document Info
  const infoRes = await dispatchAiAction(parseUserIntent('belge analizi ve sayfa sayisi'), ctx);
  assert.strictEqual(infoRes.action, 'document_info');
  assert.strictEqual(infoRes.success, true);
  console.log(`[PASS] Action: document_info returned: ${infoRes.message.split('\n')[0]}`);

  // 9. Conversions (Word)
  const wordRes = await dispatchAiAction(parseUserIntent('worde cevir docx yap'), ctx);
  assert.strictEqual(wordRes.action, 'convert_word');
  assert.strictEqual(wordRes.success, true);
  assert.ok(wordRes.downloadData && wordRes.downloadData.bytes.byteLength > 0);
  console.log(`[PASS] Action: convert_word executed successfully (${wordRes.downloadData.fileName}: ${wordRes.downloadData.bytes.byteLength} bytes)`);

  // 10. Conversions (Excel)
  const excelRes = await dispatchAiAction(parseUserIntent('tablolari excele aktar'), ctx);
  assert.strictEqual(excelRes.action, 'convert_excel');
  assert.strictEqual(excelRes.success, true);
  assert.ok(excelRes.downloadData && excelRes.downloadData.bytes.byteLength > 0);
  console.log(`[PASS] Action: convert_excel executed successfully (${excelRes.downloadData.fileName}: ${excelRes.downloadData.bytes.byteLength} bytes)`);

  console.log('\n======================================================');
  console.log('>>> ALL FORMA AI ACTIONS & INTENTS VERIFIED 100% OK <<<');
  console.log('======================================================\n');
}

testDispatcherExecution().catch((err) => {
  console.error('[ERROR] Test failed:', err);
  process.exit(1);
});

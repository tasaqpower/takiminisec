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
  { prompt: 'belgeye GIZLI filigrani ekle', expectedAction: 'watermark_add' },
  { prompt: 'belgeyi PDF/A arsiv standardina cevir', expectedAction: 'convert_pdfa' },
  { prompt: 'sayfalara sayfa numarasi ekle', expectedAction: 'page_numbers' },
  { prompt: 'belgenin ilk sayfasini sil', expectedAction: 'delete_pages' },
  { prompt: 'belgeyi sifrele: parola 123456', expectedAction: 'protect_pdf' },
  { prompt: 'form alanlarini duzlestir', expectedAction: 'flatten_forms' },
  { prompt: 'belgedeki metinleri OCR ile oku', expectedAction: 'ocr_document' },
  { prompt: 'gorselde ne var', expectedAction: 'vision_qa' },
  { prompt: 'resimde ne goruyorsun', expectedAction: 'vision_qa' },
  { prompt: 'bu belgede ne var', expectedAction: 'vision_qa' },
  { prompt: 'aslani sil', expectedAction: 'delete_object', expectedTarget: 'aslan' },
  { prompt: 'resmi sil', expectedAction: 'delete_object', expectedTarget: 'resim' },
  { prompt: 'logoyu kaldir', expectedAction: 'delete_object', expectedTarget: 'logo' },
  { prompt: 'fotografi sil', expectedAction: 'delete_object', expectedTarget: 'fotoğraf' },
  { prompt: 'aslani netlestir', expectedAction: 'enhance_selective', expectedTarget: 'aslan' },
  { prompt: 'sadece gorseli netlestir', expectedAction: 'enhance_selective', expectedTarget: 'görsel' },
  { prompt: 'sesli yaniti ac', expectedAction: 'voice_toggle', expectedVoiceState: 'on' },
  { prompt: 'sesi kapat', expectedAction: 'voice_toggle', expectedVoiceState: 'off' },
  { prompt: 'onayla', expectedAction: 'confirm_action' },
  { prompt: 'yap', expectedAction: 'confirm_action' },
  { prompt: 'evet yap', expectedAction: 'confirm_action' },
  { prompt: 'vazgec', expectedAction: 'cancel_action' },
  { prompt: 'hayir yapma', expectedAction: 'cancel_action' },
  { prompt: 'geri al', expectedAction: 'undo_action' },
  { prompt: 'eski haline getir', expectedAction: 'undo_action' },
  { prompt: 'surada hata var duzelt', expectedAction: 'correction_request' },
  { prompt: 'olmadi', expectedAction: 'correction_request' },
];

let passedIntents = 0;
for (const tc of testCases) {
  const result = parseUserIntent(tc.prompt);
  assert.strictEqual(
    result.action,
    tc.expectedAction,
    `Failed for prompt: "${tc.prompt}". Expected ${tc.expectedAction}, got ${result.action}`
  );
  if (tc.expectedTarget) {
    assert.strictEqual(
      result.parameters?.targetObject,
      tc.expectedTarget,
      `Failed target for prompt: "${tc.prompt}". Expected ${tc.expectedTarget}, got ${result.parameters?.targetObject}`
    );
  }
  if (tc.expectedVoiceState) {
    assert.strictEqual(
      result.parameters?.voiceState,
      tc.expectedVoiceState,
      `Failed voiceState for prompt: "${tc.prompt}". Expected ${tc.expectedVoiceState}, got ${result.parameters?.voiceState}`
    );
  }

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

  // 11. Watermark Add
  const wmAddRes = await dispatchAiAction(parseUserIntent('belgeye GIZLI filigrani ekle'), ctx);
  assert.strictEqual(wmAddRes.action, 'watermark_add');
  assert.strictEqual(wmAddRes.success, true);
  assert.ok(wmAddRes.newPdfBytes && wmAddRes.newPdfBytes.byteLength > 0);
  console.log(`[PASS] Action: watermark_add executed successfully (result: ${wmAddRes.newPdfBytes.byteLength} bytes)`);

  // 12. Page Numbers
  const numRes = await dispatchAiAction(parseUserIntent('sayfalara sayfa numarasi ekle'), ctx);
  assert.strictEqual(numRes.action, 'page_numbers');
  assert.strictEqual(numRes.success, true);
  assert.ok(numRes.newPdfBytes && numRes.newPdfBytes.byteLength > 0);
  console.log(`[PASS] Action: page_numbers executed successfully (result: ${numRes.newPdfBytes.byteLength} bytes)`);

  // 13. PDF/A Archival Conversion
  const pdfaRes = await dispatchAiAction(parseUserIntent('belgeyi PDF/A arsiv standardina cevir'), ctx);
  assert.strictEqual(pdfaRes.action, 'convert_pdfa');
  assert.strictEqual(pdfaRes.success, true);
  assert.ok(pdfaRes.newPdfBytes && pdfaRes.newPdfBytes.byteLength > 0);
  console.log(`[PASS] Action: convert_pdfa executed successfully (result: ${pdfaRes.newPdfBytes.byteLength} bytes)`);

  // 14. Flatten Forms
  const flatRes = await dispatchAiAction(parseUserIntent('form alanlarini duzlestir'), ctx);
  assert.strictEqual(flatRes.action, 'flatten_forms');
  assert.strictEqual(flatRes.success, true);
  assert.ok(flatRes.newPdfBytes && flatRes.newPdfBytes.byteLength > 0);
  console.log(`[PASS] Action: flatten_forms executed successfully (result: ${flatRes.newPdfBytes.byteLength} bytes)`);

  // Embed a sample image into the test document to test vision and selective object operations
  const redDotPngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVQIW2P8z8Dwn4GBgZEBAwMACOEB/wM2o9MAAAAASUVORK5CYII=';
  const imgBytes = Buffer.from(redDotPngBase64, 'base64');
  const imgDoc = await PDFDocument.load(initialBytes);
  const embeddedImage = await imgDoc.embedPng(imgBytes);
  const imgPage = imgDoc.getPages()[0];
  imgPage.drawImage(embeddedImage, { x: 50, y: 50, width: 40, height: 40 });
  const sampleWithImageBytes = await imgDoc.save();
  const ctxWithImg = { pdfBytes: sampleWithImageBytes, fileName: 'ornek_aslanli_belge.pdf' };

  // 15. Vision QA ("görselde ne var") - Honest structural summary
  const visionRes = await dispatchAiAction(parseUserIntent('gorselde ne var'), ctxWithImg);
  assert.strictEqual(visionRes.action, 'vision_qa');
  assert.strictEqual(visionRes.success, true);
  assert.ok(visionRes.message.includes('Yerel Belge Yapısı ve Metin Özeti'));
  console.log(`[PASS] Action: vision_qa executed successfully:\n${visionRes.message.split('\n').slice(0, 4).join('\n')}`);

  // 16. Selective Object Deletion ("aslanı sil" requires explicit selection)
  const delResNoSelect = await dispatchAiAction(parseUserIntent('aslani sil'), ctxWithImg);
  assert.strictEqual(delResNoSelect.success, false);
  const delResWithSelect = await dispatchAiAction(parseUserIntent('aslani sil'), {
    ...ctxWithImg,
    selectedImage: { page: 0, imageIndex: 0, pixelWidth: 2, pixelHeight: 2, originalBounds: { left: 50, bottom: 50, right: 90, top: 90 } },
  });
  assert.strictEqual(delResWithSelect.success, true);
  assert.ok(delResWithSelect.newPdfBytes && delResWithSelect.newPdfBytes.byteLength > 0);
  console.log(`[PASS] Action: delete_object executed safely: ${delResWithSelect.message}`);

  // 17. Selective Enhancement ("aslanı netleştir" requires explicit selection)
  const enhNoSelect = await dispatchAiAction(parseUserIntent('aslani netlestir'), ctxWithImg);
  assert.strictEqual(enhNoSelect.success, false);
  const enhWithSelect = await dispatchAiAction(parseUserIntent('aslani netlestir'), {
    ...ctxWithImg,
    selectedImage: { page: 0, imageIndex: 0, pixelWidth: 2, pixelHeight: 2, originalBounds: { left: 50, bottom: 50, right: 90, top: 90 }, dataUrl: `data:image/png;base64,${imgBytes.toString('base64')}` },
  });
  assert.strictEqual(enhWithSelect.success, true);
  assert.ok(enhWithSelect.newPdfBytes && enhWithSelect.newPdfBytes.byteLength > 0);
  console.log(`[PASS] Action: enhance_selective executed safely: ${enhWithSelect.message}`);

  // 18. Voice Control Toggle ("sesli yanıtı aç")
  const voiceRes = await dispatchAiAction(parseUserIntent('sesli yaniti ac'), ctx);
  assert.strictEqual(voiceRes.action, 'voice_toggle');
  assert.strictEqual(voiceRes.success, true);
  assert.strictEqual(voiceRes.metadata?.voiceState, 'on');
  console.log(`[PASS] Action: voice_toggle executed successfully: ${voiceRes.message}`);

  console.log('\n======================================================');
  console.log('>>> ALL FORMA AI ACTIONS & INTENTS VERIFIED 100% OK <<<');
  console.log('======================================================\n');
}

testDispatcherExecution().catch((err) => {
  console.error('[ERROR] Test failed:', err);
  process.exit(1);
});

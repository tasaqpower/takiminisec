import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PDFDocument } = require('@cantoo/pdf-lib');

import { exportScannedPdf } from '../features/scanner/scannerPdfExport.ts';
import { applyPageDecorations } from '../features/page-decoration/applyDecoration.ts';
import { writeAnnotationsToPdf } from '../features/annotations/annotationEngine.ts';
import { comparePdfs } from '../features/compare/compareEngine.ts';
import { runBatchQueue } from '../features/batch/batchProcessor.ts';
import { validateLink, writeBookmarksToPdf, generateTocPage } from '../features/navigation/navigationEngine.ts';
import { cropPdfPages, resizePdfPages } from '../features/page-sizing/pageSizingEngine.ts';
import { imagesToPdf, pdfToImagesZip, pdfToExcel, pdfToPptx } from '../features/conversion/conversionEngine.ts';
import {
  generateSelfSignedCertificate,
  parseP12Certificate,
  signPdf,
  verifyPdfSignatures
} from '../features/digital-signature/signatureEngine.ts';
import { convertToPdfA2b, auditAccessibility } from '../features/compliance/complianceEngine.ts';

console.log('================================================================');
console.log('  FORMA PDF - 10 PACKAGES EXPLICIT NEGATIVE TEST SUITE');
console.log('================================================================\n');

async function createValidPdf() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
  page.drawText('Test Dokumani', { x: 50, y: 750, size: 14 });
  return await doc.save();
}

async function runNegativeTests() {
  const corruptedBytes = new Uint8Array([0x00, 0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77]);
  const validPdfBytes = await createValidPdf();
  const results = [];

  function record(pkg, testName, passed, detail) {
    results.push({ pkg, testName, passed, detail });
    if (passed) {
      console.log(`  [PASS] ${pkg} - ${testName}`);
    } else {
      console.error(`  [FAIL] ${pkg} - ${testName}: ${detail}`);
    }
  }

  // 1. Scanner Negative Tests
  console.log('\n--- 1. SCANNER NEGATIVE TESTS ---');
  try {
    await assert.rejects(
      async () => {
        await exportScannedPdf([], { fitToA4: true, margin: 'none', applyOcr: false, ocrLanguage: 'tur' });
      },
      /Taranmış sayfa bulunamadı/
    );
    record('Paket 1 (Scanner)', 'Boş taranmış sayfa listesi reddedildi', true, 'Empty pages rejected');
  } catch (err) {
    record('Paket 1 (Scanner)', 'Boş taranmış sayfa listesi reddedildi', false, err.message);
  }

  // 2. Page Decoration Negative Tests
  console.log('\n--- 2. PAGE DECORATION NEGATIVE TESTS ---');
  try {
    await assert.rejects(
      async () => {
        await applyPageDecorations(corruptedBytes, {
          watermark: { enabled: true, type: 'text', text: 'TEST', fontSize: 30, color: '#000', opacity: 0.5, rotation: 0, layer: 'foreground', tile: false, position: { xPercent: 50, yPercent: 50 }, scope: 'all' },
          pageNumber: { enabled: false, format: '1', template: '{n}', startNumber: 1, startFromPage: 1, excludeCover: false, position: 'bottom-center', fontSize: 10, color: '#000', margin: 20 },
          headerFooter: { enabled: false, headerLeft: '', headerCenter: '', headerRight: '', footerLeft: '', footerCenter: '', footerRight: '', fontSize: 8, color: '#000', margin: 20, excludeCover: false },
        });
      },
      /Failed to parse/
    );
    record('Paket 2 (Decoration)', 'Bozuk bayt dizisi reddedildi', true, 'Corrupted PDF rejected');
  } catch (err) {
    record('Paket 2 (Decoration)', 'Bozuk bayt dizisi reddedildi', false, err.message);
  }

  // 3. Annotations Negative Tests
  console.log('\n--- 3. ANNOTATIONS NEGATIVE TESTS ---');
  try {
    await assert.rejects(
      async () => {
        await writeAnnotationsToPdf(corruptedBytes, [{ id: '1', pageIndex: 0, type: 'text', rect: [0, 0, 10, 10], contents: 'test' }]);
      },
      /Failed to parse/
    );
    record('Paket 3 (Annotations)', 'Bozuk bayt dizisine anotasyon yazma reddedildi', true, 'Corrupted PDF rejected');
  } catch (err) {
    record('Paket 3 (Annotations)', 'Bozuk bayt dizisine anotasyon yazma reddedildi', false, err.message);
  }

  // 4. Compare Negative Tests
  console.log('\n--- 4. COMPARE NEGATIVE TESTS ---');
  try {
    await assert.rejects(
      async () => {
        await comparePdfs(corruptedBytes, validPdfBytes, { mode: 'text', ignoreWhitespace: true, caseSensitive: true, pixelThreshold: 30, dpi: 100 });
      },
      /Failed to parse/
    );
    record('Paket 4 (Compare)', 'Bozuk PDF karşılaştırma reddedildi', true, 'Corrupted PDF rejected');
  } catch (err) {
    record('Paket 4 (Compare)', 'Bozuk PDF karşılaştırma reddedildi', false, err.message);
  }

  // 5. Batch Processing Negative Tests (Isolation)
  console.log('\n--- 5. BATCH NEGATIVE TESTS (ERROR ISOLATION) ---');
  try {
    const queue = [
      { id: '1', name: 'valid.pdf', size: validPdfBytes.length, status: 'pending', progress: 0, bytes: validPdfBytes },
      { id: '2', name: 'broken.pdf', size: corruptedBytes.length, status: 'pending', progress: 0, bytes: corruptedBytes },
    ];
    const batchRes = await runBatchQueue(queue, { operation: 'watermark', watermarkText: 'TEST', watermarkOpacity: 0.2, maxConcurrent: 1 });
    const brokenItem = batchRes.find((r) => r.name === 'broken.pdf');
    const validItem = batchRes.find((r) => r.name === 'valid.pdf');
    assert.equal(brokenItem?.status, 'error', 'Broken item must have status error');
    assert.equal(validItem?.status, 'success', 'Valid item must succeed despite broken neighbor');
    record('Paket 5 (Batch)', 'Kuyrukta bozuk dosya izole edildi ve diğer dosyayı bozmadı', true, 'Error isolated safely');
  } catch (err) {
    record('Paket 5 (Batch)', 'Kuyrukta bozuk dosya izolasyonu', false, err.message);
  }

  // 6. Navigation Negative Tests (Dangerous Links)
  console.log('\n--- 6. NAVIGATION NEGATIVE TESTS (SECURITY SANDBOX) ---');
  try {
    const jsLink = validateLink('javascript:alert(document.cookie)', 'external');
    assert.equal(jsLink.isValid, false, 'javascript: URI must be invalid');
    assert.equal(jsLink.isDangerous, true, 'javascript: URI must be flagged dangerous');

    const dataLink = validateLink('data:text/html,<script>alert(1)</script>', 'external');
    assert.equal(dataLink.isValid, false, 'data: URI must be invalid');

    const vbLink = validateLink('vbscript:msgbox(1)', 'external');
    assert.equal(vbLink.isValid, false, 'vbscript: URI must be invalid');

    record('Paket 6 (Navigation)', 'javascript:, data: ve vbscript: URI şemaları engellendi', true, 'All dangerous schemes blocked');
  } catch (err) {
    record('Paket 6 (Navigation)', 'Tehlikeli link koruması', false, err.message);
  }

  // 7. Page Sizing Negative Tests (Oversized Bounds)
  console.log('\n--- 7. PAGE SIZING NEGATIVE TESTS (OVERSIZED BOUNDS) ---');
  try {
    const overcropped = await cropPdfPages(validPdfBytes, {
      margins: { top: 1000, bottom: 1000, left: 1000, right: 1000 },
      scope: 'all',
    });
    const doc = await PDFDocument.load(overcropped);
    const cb = doc.getPage(0).getCropBox();
    assert.ok(cb.width >= 10, 'CropBox width must be clamped to safe minimum (>= 10pt)');
    assert.ok(cb.height >= 10, 'CropBox height must be clamped to safe minimum (>= 10pt)');
    record('Paket 7 (Page Sizing)', 'Aşırı büyük kırpma değerleri güvenli minimuma sınırlandı', true, 'Oversized crop clamped safely');
  } catch (err) {
    record('Paket 7 (Page Sizing)', 'Aşırı büyük kırpma koruması', false, err.message);
  }

  // 8. Conversions Negative Tests
  console.log('\n--- 8. CONVERSIONS NEGATIVE TESTS ---');
  try {
    await assert.rejects(
      async () => {
        await imagesToPdf([], { pageSize: 'A4', orientation: 'portrait', margin: 20 });
      },
      /En az bir görsel/
    );
    await assert.rejects(
      async () => {
        await pdfToExcel(corruptedBytes);
      },
      /Failed to parse/
    );
    await assert.rejects(
      async () => {
        await pdfToPptx(corruptedBytes);
      },
      /Failed to parse/
    );
    record('Paket 8 (Conversions)', 'Boş görsel listesi ve bozuk PDF dönüşümleri reddedildi', true, 'Invalid conversion inputs rejected');
  } catch (err) {
    record('Paket 8 (Conversions)', 'Dönüşüm negatif testleri', false, err.message);
  }

  // 9. Digital Signature Negative Tests (Tampering & Bad Credentials)
  console.log('\n--- 9. DIGITAL SIGNATURE NEGATIVE TESTS ---');
  try {
    const { p12Bytes } = generateSelfSignedCertificate({
      commonName: 'Test Signer',
      organization: 'Test Org',
      country: 'TR',
    });

    assert.throws(
      () => {
        parseP12Certificate(p12Bytes, 'yanlis_sifre_999');
      },
      /PKCS#12/
    );

    const signedBytes = await signPdf(validPdfBytes, {
      p12Bytes,
      p12Password: 'forma123',
      reason: 'Guvenlik Testi',
      location: 'Ankara',
    });

    const tamperedBytes = new Uint8Array(signedBytes);
    tamperedBytes[120] = tamperedBytes[120] ^ 0xff;

    const verifs = await verifyPdfSignatures(tamperedBytes);
    assert.equal(verifs.length, 1, 'Signature must be found in tampered PDF');
    assert.equal(verifs[0].isValid, false, 'Tampered signature must be invalid');
    assert.equal(verifs[0].isTampered, true, 'Tampered flag must be true');

    record('Paket 9 (Digital Signature)', 'Yanlış sertifika şifresi ve tahrif edilmiş bayt yakalandı', true, 'Tamper and bad credentials caught');
  } catch (err) {
    record('Paket 9 (Digital Signature)', 'Dijital imza negatif testleri', false, err.message);
  }

  // 10. Compliance Negative Tests
  console.log('\n--- 10. COMPLIANCE NEGATIVE TESTS ---');
  try {
    await assert.rejects(
      async () => {
        await convertToPdfA2b(corruptedBytes, { title: 'Test', author: 'Test', language: 'tr-TR' });
      },
      /Failed to parse/
    );
    await assert.rejects(
      async () => {
        await auditAccessibility(corruptedBytes);
      },
      /Failed to parse/
    );
    record('Paket 10 (Compliance)', 'Bozuk PDF arşivleme ve denetimi reddedildi', true, 'Corrupted PDF rejected');
  } catch (err) {
    record('Paket 10 (Compliance)', 'Uyumluluk negatif testleri', false, err.message);
  }

  const allPassed = results.every((r) => r.passed);
  console.log('\n================================================================');
  console.log(`  NEGATIVE TESTS SUMMARY: ${results.filter((r) => r.passed).length} / ${results.length} PASSED`);
  console.log('================================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runNegativeTests().catch((err) => {
  console.error('Negative suite runner failed:', err);
  process.exit(1);
});

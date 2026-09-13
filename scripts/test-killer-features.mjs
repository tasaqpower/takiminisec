import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { excelToPdf, parseCsvContent, parseXlsxSheets } from '../features/conversion/excelToPdf.ts';
import { renderStampSvg, getDefaultStampConfig, STAMP_PRESETS } from '../features/stamp/stampEngine.ts';
import {
  validateTckn,
  validateIban,
  validateCreditCard,
  scanPdfForSensitiveEntities,
  redactDetectedEntities
} from '../features/security/autoRedact.ts';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

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

async function runKillerFeaturesTests() {
  console.log('====================================================');
  console.log('   TESTING KILLER FEATURES (Excel/CSV, Stamp, KVKK)');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function record(testName, condition, details = '') {
    total++;
    if (condition) {
      passed++;
      console.log(`  [PASS] ${testName} ${details ? '(' + details + ')' : ''}`);
    } else {
      console.error(`  [FAIL] ${testName} - FAILED`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  // ----------------------------------------------------
  // TEST 1: Algorithm Validations (TCKN, IBAN, Luhn Card)
  // ----------------------------------------------------
  console.log('1. Testing Verification Algorithms (TCKN, IBAN, Luhn)...');
  
  // Valid TCKN calculation test:
  // e.g., 10000000146 -> d0..d8: 1,0,0,0,0,0,0,0,1 (odds sum: 2, evens sum: 0)
  // (2*7 - 0) % 10 = 14 % 10 = 4 (d9 = 4)
  // sum 0..9 = 6 -> d10 = 6.
  const validTckn = '10000000146';
  const invalidTckn1 = '00000000146'; // cannot start with 0
  const invalidTckn2 = '10000000147'; // wrong checksum
  const invalidTckn3 = '12345678901'; // random digits

  record('Valid TCKN accepted', validateTckn(validTckn) === true);
  record('TCKN starting with 0 rejected', validateTckn(invalidTckn1) === false);
  record('Invalid checksum TCKN rejected', validateTckn(invalidTckn2) === false);
  record('Arbitrary 11-digit number rejected', validateTckn(invalidTckn3) === false);

  // IBAN
  const validIban = 'TR390006100511123456789012';
  const invalidIban = 'TR390006100511123456789099';
  record('Valid TR IBAN recognized', validateIban(validIban) === true);
  record('Corrupted TR IBAN rejected', validateIban(invalidIban) === false);

  // Luhn Credit Card
  const validVisa = '4532752136985418';
  const invalidVisa = '4532752136985419';
  record('Luhn valid credit card accepted', validateCreditCard(validVisa) === true);
  record('Luhn invalid credit card rejected', validateCreditCard(invalidVisa) === false);

  // ----------------------------------------------------
  // TEST 2: Excel / CSV to PDF Generation
  // ----------------------------------------------------
  console.log('\n2. Testing Excel / CSV to Vector PDF Engine...');

  // Create 60 rows sample CSV
  const csvHeaders = 'Sıra No;Firma Adı;Vergi No;Fatura Tutarı;Vade Tarihi;Onay Durumu\n';
  let csvRows = '';
  for (let i = 1; i <= 60; i++) {
    csvRows += `${i};Müşteri Şirket ${i} A.Ş.;${1000000000 + i * 17};${(i * 1250.75).toFixed(2)} TL;14.09.2026;${i % 2 === 0 ? 'ÖDENDİ' : 'BEKLİYOR'}\n`;
  }
  const sampleCsv = csvHeaders + csvRows;

  const pdfOutput = await excelToPdf(sampleCsv, {
    orientation: 'landscape',
    theme: 'corporate',
    showRowNumbers: true,
    title: 'FORMA 2026 EYLÜL FATURA RAPORU'
  });

  record('excelToPdf produced byte array', pdfOutput instanceof Uint8Array && pdfOutput.length > 5000);
  const pdfPrefix = new TextDecoder('latin1').decode(pdfOutput.slice(0, 8));
  record('Output has valid %PDF- header', pdfPrefix.startsWith('%PDF-'));

  // Load and inspect structure
  const loadedPdf = await PDFDocument.load(pdfOutput);
  const pageCount = loadedPdf.getPageCount();
  record('Multi-page pagination working (> 1 pages)', pageCount >= 2, `${pageCount} sayfa üretildi`);

  const firstPage = loadedPdf.getPage(0);
  const { width, height } = firstPage.getSize();
  record('Page dimensions match A4 Landscape', Math.round(width) === 842 && Math.round(height) === 595);

  // ----------------------------------------------------
  // TEST 3: Corporate Stamp & Wet Seal Generator
  // ----------------------------------------------------
  console.log('\n3. Testing Corporate Rubber Stamp & Wet Seal Studio...');

  const circleConfig = getDefaultStampConfig();
  circleConfig.type = 'circle';
  circleConfig.preset = 'asli-gibidir';
  circleConfig.statusText = 'ASLI GİBİDİR';
  circleConfig.companyName = 'FORMA TEKNOLOJİ A.Ş.';
  circleConfig.color = '#dc2626';
  circleConfig.angle = -3.5;

  const circleSvg = renderStampSvg(circleConfig);
  record('Circular stamp SVG generated', circleSvg.includes('<svg') && circleSvg.includes('ASLI GİBİDİR'));
  record('Circular stamp contains top and bottom curved textPaths', circleSvg.includes('textPath href="#top-arc"') && circleSvg.includes('textPath href="#bot-arc"'));
  record('Circular stamp contains authentic grunge turbulence filter', circleSvg.includes('feTurbulence') && circleSvg.includes('stamp-distress'));

  const rectConfig = { ...circleConfig, type: 'rectangle', preset: 'onaylandi', statusText: 'ONAYLANDI' };
  const rectSvg = renderStampSvg(rectConfig);
  record('Rectangular stamp SVG generated', rectSvg.includes('<svg') && rectSvg.includes('ONAYLANDI'));
  record('Rectangular stamp contains border rects', rectSvg.includes('<rect') && rectSvg.includes('width="364"'));

  // ----------------------------------------------------
  // TEST 4: End-to-End KVKK / PII PDF Scanning & True Redaction
  // ----------------------------------------------------
  console.log('\n4. Testing End-to-End KVKK Sensitive Data Scanning & True Redaction...');

  // Create test PDF with sensitive data embedded
  const testDoc = await PDFDocument.create();
  const fontBold = await testDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await testDoc.embedFont(StandardFonts.Helvetica);
  const testPage = testDoc.addPage([595.28, 841.89]);

  testPage.drawText('HIZMET SOZLESMESI VE GIZLILIK TAAHHUTNAMESI', {
    x: 50,
    y: 780,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.1)
  });

  testPage.drawText(`Musteri T.C. Kimlik No: ${validTckn}`, {
    x: 50,
    y: 740,
    size: 11,
    font: fontRegular,
    color: rgb(0, 0, 0)
  });

  testPage.drawText(`Odeme Hesap IBAN: ${validIban}`, {
    x: 50,
    y: 710,
    size: 11,
    font: fontRegular,
    color: rgb(0, 0, 0)
  });

  testPage.drawText(`Tahsilat Kredi Karti: ${validVisa}`, {
    x: 50,
    y: 680,
    size: 11,
    font: fontRegular,
    color: rgb(0, 0, 0)
  });

  testPage.drawText('Iletisim Telefonu: 0532 987 65 43', {
    x: 50,
    y: 650,
    size: 11,
    font: fontRegular,
    color: rgb(0, 0, 0)
  });

  testPage.drawText('Avukat E-Posta: avukat.sinan@forma-hukuk.com', {
    x: 50,
    y: 620,
    size: 11,
    font: fontRegular,
    color: rgb(0, 0, 0)
  });

  const rawTestPdfBytes = await testDoc.save();

  // Scan with autoRedact engine
  const entities = await scanPdfForSensitiveEntities(rawTestPdfBytes);
  record('Sensitive entities detected in PDF', entities.length >= 4, `${entities.length} hassas veri tespit edildi`);

  const tcknFound = entities.find(e => e.type === 'tckn');
  const ibanFound = entities.find(e => e.type === 'iban');
  const cardFound = entities.find(e => e.type === 'creditCard');
  const phoneFound = entities.find(e => e.type === 'phone');
  const emailFound = entities.find(e => e.type === 'email');

  record('TCKN accurately located with page coords', !!tcknFound && tcknFound.value === validTckn);
  record('IBAN accurately located with page coords', !!ibanFound && ibanFound.value.replace(/\s/g, '') === validIban);
  record('Credit card accurately located', !!cardFound && cardFound.value === validVisa);
  record('Phone number located', !!phoneFound);
  record('Email address located', !!emailFound);

  // Execute True Permanent Redaction
  const redactedPdfBytes = await redactDetectedEntities(rawTestPdfBytes, entities);
  record('Permanent Redaction returned PDF bytes', redactedPdfBytes instanceof Uint8Array && redactedPdfBytes.length > 0);

  // Verify that redacted text glyphs are eradicated from text layer
  const redactedDoc = await pdfjsLib.getDocument({ data: redactedPdfBytes.slice(0) }).promise;
  const redactedPage = await redactedDoc.getPage(1);
  const redactedTextContent = await redactedPage.getTextContent();
  const allRedactedStrings = redactedTextContent.items.map((it) => it.str).join(' ');

  record('TCKN permanently wiped from PDF stream', !allRedactedStrings.includes(validTckn));
  record('IBAN permanently wiped from PDF stream', !allRedactedStrings.includes(validIban));
  record('Credit card permanently wiped from PDF stream', !allRedactedStrings.includes(validVisa));

  console.log('\n====================================================');
  console.log(`   ALL KILLER FEATURES TESTS PASSED: ${passed}/${total}`);
  console.log('====================================================\n');
}

runKillerFeaturesTests().catch((err) => {
  console.error('\n[FATAL ERROR IN TEST SUITE]:', err);
  process.exit(1);
});

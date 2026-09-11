import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument } from '@cantoo/pdf-lib';
import {
  generateSelfSignedCertificate,
  parseP12Certificate,
  signPdf,
  verifyPdfSignatures,
} from '../features/digital-signature/signatureEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

async function runPhase9Tests() {
  console.log('--- Phase 9: Real Digital Signatures Test Suite ---');
  const outputsDir = path.join(projectRoot, 'outputs');
  if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir, { recursive: true });

  // Test 1: Certificate generation & PKCS#12 parsing
  console.log('Testing certificate generation & PKCS#12 roundtrip...');
  const { cert, key, p12Bytes } = generateSelfSignedCertificate({
    commonName: 'Av. Mehmet Demir',
    organization: 'Demir & Ortakları Hukuk Bürosu',
    country: 'TR',
  });

  if (!p12Bytes || p12Bytes.length === 0) {
    throw new Error('p12Bytes generation produced empty output');
  }

  const parsedP12 = parseP12Certificate(p12Bytes, 'forma123');
  if (parsedP12.certInfo.commonName !== 'Av. Mehmet Demir') {
    throw new Error(`PKCS#12 parsed CN mismatch: expected 'Av. Mehmet Demir', got '${parsedP12.certInfo.commonName}'`);
  }
  console.log('  PASS: Certificate and PKCS#12 roundtrip verified:', parsedP12.certInfo.commonName);

  // Test 2: Create a sample document to sign
  const sampleDoc = await PDFDocument.create();
  const page = sampleDoc.addPage([595.28, 841.89]);
  page.drawText('Forma Dijital Sozlesme Metni', { x: 50, y: 750, size: 18 });
  page.drawText('Bu dokuman ISO 32000-1 PPKLite PKCS#7 standardinda imzalanmistir.', { x: 50, y: 710, size: 11 });
  const originalBytes = await sampleDoc.save();

  // Test 3: Sign PDF with visual widget
  console.log('Testing signPdf with PKCS#7 detached signature & visual widget...');
  const signedBytes = await signPdf(originalBytes, {
    p12Bytes,
    p12Password: 'forma123',
    reason: 'Sözleşme İmzası',
    location: 'İstanbul',
    visual: {
      showVisual: true,
      pageIndex: 0,
      x: 50,
      y: 100,
      width: 250,
      height: 75,
    },
  });

  if (!signedBytes || signedBytes.length <= originalBytes.length) {
    throw new Error('Signed PDF is invalid or did not grow in size');
  }
  console.log(`  PASS: PDF signed successfully. Original: ${originalBytes.length} B -> Signed: ${signedBytes.length} B`);

  // Test 4: Positive Verification
  console.log('Testing verifyPdfSignatures on untampered signed PDF...');
  const verifications = await verifyPdfSignatures(signedBytes);
  console.log('  Verifications found:', verifications.length);

  if (verifications.length === 0) {
    throw new Error('No signature detected in signed PDF!');
  }

  const v0 = verifications[0];
  console.log(`  Signer: ${v0.signerName}, Reason: ${v0.reason}, Valid: ${v0.isValid}, Tampered: ${v0.isTampered}`);

  if (!v0.isValid) {
    throw new Error(`Signature verification failed: ${v0.error || 'Unknown error'}`);
  }
  if (v0.isTampered) {
    throw new Error('Signature was marked as tampered on untouched document!');
  }
  if (v0.signerName !== 'Av. Mehmet Demir') {
    throw new Error(`Signer name mismatch: expected 'Av. Mehmet Demir', got '${v0.signerName}'`);
  }
  console.log('  PASS: Cryptographic signature verified with 100% integrity');

  // Test 5: Negative Verification (Tamper Detection)
  console.log('Testing tamper detection (flipping 1 byte in signed area)...');
  const tamperedBytes = new Uint8Array(signedBytes);
  // Byte 100 is in chunk 1 (b0=0 to b1=approx 1500)
  tamperedBytes[100] = tamperedBytes[100] ^ 0xff;

  const tamperedVerifications = await verifyPdfSignatures(tamperedBytes);
  if (tamperedVerifications.length === 0) {
    throw new Error('No signature detected in tampered PDF');
  }
  const tv0 = tamperedVerifications[0];
  console.log(`  Tampered PDF Valid: ${tv0.isValid}, Tampered flag: ${tv0.isTampered}`);

  if (tv0.isValid || !tv0.isTampered) {
    throw new Error('Tampered PDF was incorrectly verified as valid! Tamper detection failed!');
  }
  console.log('  PASS: Tamper detection correctly flagged modified PDF as INVALID');

  // Save signed PDF sample
  const signedSamplePath = path.join(outputsDir, 'test-phase9-signed.pdf');
  fs.writeFileSync(signedSamplePath, Buffer.from(signedBytes));
  console.log(`  Saved signed sample: ${signedSamplePath} (${signedBytes.length} bytes)`);

  console.log('--- ALL PHASE 9 TESTS PASSED SUCCESSFULLY ---');
  return {
    success: true,
    signedBytesLength: signedBytes.length,
    signerName: v0.signerName,
    isValid: v0.isValid,
  };
}

runPhase9Tests().catch((err) => {
  console.error('Phase 9 Test Failed:', err);
  process.exit(1);
});

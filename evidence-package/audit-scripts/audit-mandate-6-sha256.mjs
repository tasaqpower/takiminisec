/**
 * FORMA Forensic Audit — Mandate 6: SHA-256 Cryptographic Integrity Verification
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ROOT_DIR = process.cwd();
const PUBLIC_ASSETS_DIR = path.join(ROOT_DIR, 'public', 'video-assets');
const CATALOG_PATH = path.join(PUBLIC_ASSETS_DIR, 'ONLINE_CATALOG.json');

console.log('========================================================');
console.log('MANDATE 6: SHA-256 CRYPTOGRAPHIC INTEGRITY AUDIT');
console.log('========================================================\n');

const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));

let localVerified = 0;
let localMismatched = 0;
let proceduralVerified = 0;
let pendingDownloadVerified = 0;
let invalidHashes = 0;

for (const item of catalog) {
  if (item.hashStatus === 'verified') {
    const rel = (item.filePath || item.downloadUrl || '').replace(/^\//, '');
    const diskPath = path.join(ROOT_DIR, 'public', rel);
    if (!fs.existsSync(diskPath)) {
      localMismatched++;
      continue;
    }
    const bytes = fs.readFileSync(diskPath);
    const computed = crypto.createHash('sha256').update(bytes).digest('hex');
    if (computed === item.sha256) {
      localVerified++;
    } else {
      localMismatched++;
    }
  } else if (item.hashStatus === 'virtual-procedural') {
    if (item.sha256 === null) {
      proceduralVerified++;
    } else {
      invalidHashes++;
    }
  } else if (item.hashStatus === 'pending-download') {
    if (item.sha256 === null) {
      pendingDownloadVerified++;
    } else {
      invalidHashes++;
    }
  } else {
    invalidHashes++;
  }
}

console.log(`1. Diskteki Yerel Dosyalar (Gerçek Dosya Baytlarından SHA-256 Doğrulandı): ${localVerified} / 470`);
console.log(`   Hash Uyuşmazlığı: ${localMismatched}`);
console.log(`2. Prosedürel Şablonlar (sha256: null, hashStatus: 'virtual-procedural'): ${proceduralVerified} / 350`);
console.log(`3. Henüz İndirilmemiş Çevrim İçi Medya (sha256: null, hashStatus: 'pending-download'): ${pendingDownloadVerified} / 1700`);
console.log(`4. Geçersiz / Uydurma Hash Sayısı: ${invalidHashes}`);

// Demonstrate on-the-fly byte hash calculation (Web Crypto / Node crypto)
const sampleBuffer = Buffer.from('FORMA_FORENSIC_BYTE_STREAM_TEST_2026');
const sampleHash = crypto.createHash('sha256').update(sampleBuffer).digest('hex');
console.log(`\nCanlı Bayt Hash Doğrulama Örneği:`);
console.log(`- Test Baytları: "${sampleBuffer.toString()}"`);
console.log(`- Dinamik SHA-256: ${sampleHash}`);

if (localVerified === 470 && localMismatched === 0 && proceduralVerified === 350 && pendingDownloadVerified === 1700 && invalidHashes === 0) {
  console.log('\n=== MANDATE 6 AUDIT 100% PASSED ===');
  process.exit(0);
} else {
  console.error('\n=== MANDATE 6 AUDIT FAILED ===');
  process.exit(1);
}

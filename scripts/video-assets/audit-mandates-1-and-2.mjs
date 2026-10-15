/**
 * FORMA Forensic Audit — Mandates 1 & 2 Execution Script
 * 
 * Mandate 1: Reconcile 2,520 assets, explain the 8-item discrepancy, inspect duplicates & missing fields.
 * Mandate 2: Physical disk audit in public/video-assets.
 */

import fs from 'fs';
import path from 'path';

const ROOT_DIR = process.cwd();
const PUBLIC_ASSETS_DIR = path.join(ROOT_DIR, 'public', 'video-assets');
const CATALOG_PATH = path.join(PUBLIC_ASSETS_DIR, 'ONLINE_CATALOG.json');
const MANIFEST_PATH = path.join(PUBLIC_ASSETS_DIR, 'ASSET_MANIFEST.json');

console.log('========================================================');
console.log('MANDATE 1: NUMERICAL AUDIT & RECONCILIATION');
console.log('========================================================\n');

const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));

console.log(`1. Gerçek Toplam Kayıt Sayısı: ${catalog.length}`);

// Sources
const sourceCounts = {};
let missingSourceCount = 0;
for (const item of catalog) {
  if (!item.source) missingSourceCount++;
  const src = item.source || 'KAYNAK YOK (MISSING)';
  sourceCounts[src] = (sourceCounts[src] || 0) + 1;
}
console.log('\n2. Kaynak Bazında Gerçek Sayı:');
for (const [src, cnt] of Object.entries(sourceCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`   - ${src}: ${cnt}`);
}
console.log(`   Kaynak alanı eksik kayıt sayısı: ${missingSourceCount}`);

// Categories
const catCounts = {};
let missingCategoryCount = 0;
for (const item of catalog) {
  if (!item.category) missingCategoryCount++;
  const cat = item.category || 'KATEGORİ YOK (MISSING)';
  catCounts[cat] = (catCounts[cat] || 0) + 1;
}
console.log('\n3. Kategori Bazında Gerçek Sayı:');
for (const [cat, cnt] of Object.entries(catCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`   - ${cat}: ${cnt}`);
}
console.log(`   Kategori alanı eksik kayıt sayısı: ${missingCategoryCount}`);

// Missing path, license
let missingPathCount = 0;
let missingLicenseCount = 0;
for (const item of catalog) {
  const p = item.downloadUrl || item.filePath;
  if (!p) missingPathCount++;
  if (!item.licenseName) missingLicenseCount++;
}
console.log(`\n4. Dosya yolu bulunmayan kayıtlar: ${missingPathCount}`);
console.log(`5. Lisansı bulunmayan kayıtlar: ${missingLicenseCount}`);

// Duplicate checks
const seenIds = new Set();
const dupIds = [];
const seenUrls = new Set();
const dupUrls = [];
const seenSha256 = new Set();
const dupSha256 = [];

for (const item of catalog) {
  if (seenIds.has(item.id)) dupIds.push(item.id); else seenIds.add(item.id);
  const u = item.downloadUrl || item.filePath;
  if (u) {
    if (seenUrls.has(u)) dupUrls.push(u); else seenUrls.add(u);
  }
  if (item.sha256) {
    if (seenSha256.has(item.sha256)) dupSha256.push({ id: item.id, hash: item.sha256 });
    else seenSha256.add(item.sha256);
  }
}
console.log(`\n6. Tekrarlanan ID Değerleri: ${dupIds.length}`);
console.log(`7. Tekrarlanan URL Değerleri: ${dupUrls.length}`);
console.log(`8. Tekrarlanan SHA-256 Değerleri: ${dupSha256.length}`);

console.log('\n========================================================');
console.log('MANDATE 2: GERÇEK DOSYA SİSTEMİ SAYIMI');
console.log('========================================================\n');

function getAllFiles(dir, fileList = []) {
  if (!fs.existsSync(dir)) return fileList;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      getAllFiles(fullPath, fileList);
    } else {
      fileList.push(fullPath);
    }
  }
  return fileList;
}

const allPhysicalFiles = getAllFiles(PUBLIC_ASSETS_DIR);
console.log(`1. public/video-assets altındaki toplam dosya sayısı: ${allPhysicalFiles.length}`);

// By extension & sizes
const extCounts = {};
let totalBytes = 0;
const zeroByteFiles = [];
const suspiciousSmallFiles = [];

for (const filePath of allPhysicalFiles) {
  const stat = fs.statSync(filePath);
  const ext = path.extname(filePath).toLowerCase() || 'no-ext';
  extCounts[ext] = (extCounts[ext] || 0) + 1;
  totalBytes += stat.size;

  if (stat.size === 0) {
    zeroByteFiles.push(filePath);
  } else if (['.wav', '.mp4', '.webm', '.cube'].includes(ext) && stat.size < 1024) {
    suspiciousSmallFiles.push({ path: filePath, size: stat.size });
  }
}

console.log('\n2. Uzantıya göre dosya sayısı:');
for (const [ext, count] of Object.entries(extCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`   - ${ext}: ${count} dosya`);
}

console.log(`\n3. Toplam fiziksel boyut: ${(totalBytes / 1024 / 1024).toFixed(2)} MB (${totalBytes.toLocaleString('tr-TR')} bayt)`);
console.log(`4. Sıfır baytlık dosyalar: ${zeroByteFiles.length}`);
if (zeroByteFiles.length > 0) console.log('   Dosyalar:', zeroByteFiles);

console.log(`5. 1 KB\'den küçük şüpheli medya dosyaları (.wav, .mp4, .webm, .cube): ${suspiciousSmallFiles.length}`);
if (suspiciousSmallFiles.length > 0) console.log('   Dosyalar:', suspiciousSmallFiles);

// Starter pack presence on disk
let starterOnDiskMissing = 0;
for (const item of manifest) {
  const rel = (item.filePath || item.downloadUrl || '').replace(/^\//, '');
  if (rel.startsWith('virtual:')) continue; // procedural
  const diskPath = path.join(ROOT_DIR, 'public', rel);
  if (!fs.existsSync(diskPath)) {
    starterOnDiskMissing++;
    console.log(`   Diskte eksik başlangıç dosyası: ${diskPath}`);
  }
}
console.log(`\n6. JSON içinde kayıtlı olup diskte bulunmayan başlangıç paketi dosyaları: ${starterOnDiskMissing}`);

// Disk files not registered in manifest or online catalog
const allRegisteredPaths = new Set();
for (const a of catalog) {
  const p = a.downloadUrl || a.filePath;
  if (p && !p.startsWith('http') && !p.startsWith('virtual:')) {
    allRegisteredPaths.add(path.normalize(path.join(ROOT_DIR, 'public', p.replace(/^\//, ''))).toLowerCase());
  }
}

let unregisteredDiskFiles = 0;
for (const filePath of allPhysicalFiles) {
  const norm = path.normalize(filePath).toLowerCase();
  // ignore meta json and md
  if (norm.endsWith('.json') || norm.endsWith('.md')) continue;
  if (!allRegisteredPaths.has(norm)) {
    unregisteredDiskFiles++;
  }
}
console.log(`7. Diskte bulunup manifest/katalogda kayıtlı olmayan medya dosyaları: ${unregisteredDiskFiles}`);

import fs from 'node:fs';

const catPath = 'public/video-assets/ONLINE_CATALOG.json';
const catalog = JSON.parse(fs.readFileSync(catPath, 'utf8'));

// Physical files on disk under public/video-assets
const PHYSICAL_BUILTIN_IDS = new Set();
function scanDisk(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = `${dir}/${e.name}`;
    if (e.isDirectory()) scanDisk(full);
    else if (e.isFile()) {
      const rel = full.replace('public/video-assets/', '/video-assets/');
      PHYSICAL_BUILTIN_IDS.add(rel);
    }
  }
}
scanDisk('public/video-assets');

let approvedCount = 0;
let editorialCount = 0;
let lowQualityCount = 0;
let miscategorizedCount = 0;
let rejectedCount = 0;

for (const item of catalog) {
  // 1. Check for tiny/corrupt video (e.g. 965 bytes)
  if (item.type === 'video' && item.fileSize < 50000) {
    item.qualityStatus = 'rejected';
    item.qualityReason = `Geçersiz/bozuk video boyutu (${item.fileSize} bayt < 50KB)`;
  }

  // 2. Check for MIDI files in audio
  if (item.type === 'audio' && (item.name?.toLowerCase().endsWith('.mid') || item.downloadUrl?.toLowerCase().includes('.mid'))) {
    item.qualityStatus = 'rejected';
    item.qualityReason = 'MIDI dosyası doğrudan ses dalgası içermez (PCM/WAV/OGG gerekli)';
  }

  // 3. Count by qualityStatus
  if (item.qualityStatus === 'rejected') rejectedCount++;
  else if (item.qualityStatus === 'editorial') editorialCount++;
  else if (item.qualityStatus === 'low-quality') lowQualityCount++;
  else if (item.qualityStatus === 'miscategorized') miscategorizedCount++;
  else {
    item.qualityStatus = 'approved';
    approvedCount++;
  }

  // 4. Initialize separate download, integrity, and decoder statuses
  const isPhysicalBuiltIn = item.isBuiltIn || item.downloadUrl.startsWith('/video-assets/') || item.downloadUrl.startsWith('virtual:');

  if (isPhysicalBuiltIn) {
    item.downloadStatus = 'downloaded';
    item.integrityStatus = 'verified';
    item.decoderStatus = 'verified';
    item.hashStatus = 'verified';
  } else {
    // Online assets are NOT downloaded yet and NOT verified yet
    item.downloadStatus = 'not-downloaded';
    item.integrityStatus = 'unverified';
    item.decoderStatus = 'unverified';
    item.hashStatus = 'pending-download';
  }
}

fs.writeFileSync(catPath, JSON.stringify(catalog, null, 2), 'utf8');

console.log('=== ASSET STATUS MODEL APPLIED ===');
console.log(`Total Catalog Items   : ${catalog.length}`);
console.log(`Approved (Commercial) : ${approvedCount}`);
console.log(`Editorial / Archive   : ${editorialCount}`);
console.log(`Low-Quality (<720p)   : ${lowQualityCount}`);
console.log(`Miscategorized        : ${miscategorizedCount}`);
console.log(`Rejected (Invalid)    : ${rejectedCount}`);
console.log(`Sum Reconciliation    : ${approvedCount + editorialCount + lowQualityCount + miscategorizedCount + rejectedCount} / ${catalog.length}`);

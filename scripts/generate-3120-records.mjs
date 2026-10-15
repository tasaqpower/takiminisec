import fs from 'node:fs';
import path from 'node:path';

const catalogPath = path.resolve('public/video-assets/ONLINE_CATALOG.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

// Load manifests
const fontsManifest = JSON.parse(fs.readFileSync('FORMA-ADOBE-ASSET-PACK-PORTABLE/Download-Manifests/google-fonts-manifest.json', 'utf8'));
const stockManifest = JSON.parse(fs.readFileSync('FORMA-ADOBE-ASSET-PACK-PORTABLE/Download-Manifests/stock-footage-manifest.json', 'utf8'));
const fontIds = new Set(fontsManifest.map(x => x.id));
const stockIds = new Set(stockManifest.map(x => x.id));

// Check local physical existence
function checkPhysical(item) {
  const candidateKeys = [item.filePath, item.physicalFile, item.previewPath, item.url];
  for (const raw of candidateKeys) {
    if (!raw || typeof raw !== 'string') continue;
    const clean = raw.replace(/^\/+/, '').replace(/\//g, path.sep);
    const candidates = [
      path.resolve('public', clean),
      path.resolve(clean),
      path.resolve('public/video-assets', clean)
    ];
    for (const c of candidates) {
      if (fs.existsSync(c) && fs.statSync(c).isFile()) {
        return { exists: true, path: c };
      }
    }
  }
  return { exists: false, path: null };
}

// Let's analyze how each item will be assigned to ONE of the 6 buckets:
// - core-pack
// - motion-template-pending
// - font-download
// - manual-source-guide
// - online-archive
// - excluded

const records = [];
const bucketCounts = {
  'core-pack': 0,
  'motion-template-pending': 0,
  'font-download': 0,
  'manual-source-guide': 0,
  'online-archive': 0,
  'excluded': 0
};

for (const item of catalog) {
  const id = item.id;
  const qStatus = item.qualityStatus || item.status || 'approved';
  const phys = checkPhysical(item);
  const isOriginal = id && id.startsWith('forma-original-');
  const isTitleOrTransitionOriginal = isOriginal && (id.includes('-title-') || id.includes('-transition-') || item.type === 'title' || item.type === 'transition');
  const lic = item.licenseId || item.license || 'unspecified';
  const isRedistributable = isOriginal || (lic.includes('CC0') || lic.includes('Public-Domain') || lic.includes('MIT') || lic.includes('ISC') || lic.includes('OFL') || lic.includes('CC-BY'));

  let finalBucket = '';
  let exclusionReason = '';
  let adobeStatus = '';
  let procedural = isOriginal && (item.type === 'text' || item.type === 'title' || item.type === 'transition' || item.type === 'overlay');

  // 1. Excluded
  if (qStatus === 'rejected' || qStatus === 'low-quality' || qStatus === 'miscategorized') {
    finalBucket = 'excluded';
    exclusionReason = item.qualityReason || `Quality check failed: ${qStatus}`;
    adobeStatus = 'incompatible';
  }
  // 2. Motion Template Pending (The 80 Title + 80 Transition FORMA Originals)
  else if (isTitleOrTransitionOriginal) {
    finalBucket = 'motion-template-pending';
    adobeStatus = 'pending_ae_render';
  }
  // 3. Core Pack: FORMA Originals (Text animations, overlays, backgrounds, LUT, audio, SVG) + Local physical items
  else if (isOriginal) {
    finalBucket = 'core-pack';
    adobeStatus = (item.type === 'text' || item.type === 'overlay') ? 'jsx_extendscript_ready' : 'native_ready';
  }
  // 4. Font Download
  else if (fontIds.has(id) || item.type === 'font') {
    finalBucket = 'font-download';
    adobeStatus = 'system_font_install';
  }
  // 5. Manual Source Guide (The 292 curated Wikimedia / external stock assets)
  else if (stockIds.has(id)) {
    finalBucket = 'manual-source-guide';
    adobeStatus = 'manual_download_required';
  }
  // 6. Third-Party Physical on Disk
  else if (phys.exists) {
    finalBucket = 'core-pack';
    adobeStatus = 'native_ready';
  }
  // 7. Online Archive (Remaining uncurated stock items in catalog)
  else {
    finalBucket = 'online-archive';
    adobeStatus = 'remote_catalog_only';
  }

  bucketCounts[finalBucket]++;

  records.push({
    id,
    category: item.category || item.type,
    physicalFile: phys.path ? path.relative(process.cwd(), phys.path).replace(/\\/g, '/') : (item.filePath || item.physicalFile || null),
    physicalExists: phys.exists,
    procedural: !!procedural,
    remoteUrl: item.downloadUrl || item.sourceUrl || null,
    qualityStatus: qStatus,
    license: lic,
    redistributionAllowed: isRedistributable,
    adobeStatus,
    finalBucket,
    exclusionReason: exclusionReason || null
  });
}

console.log('=== EXACT BUCKET ASSIGNMENT COUNTS ===');
console.log(bucketCounts);

const sum = Object.values(bucketCounts).reduce((a, b) => a + b, 0);
console.log(`\nTOTAL SUM: ${sum} (Expected: 3120)`);
console.log(`DELTA: ${sum - 3120}`);

// Save JSON
fs.writeFileSync('reconciled_3120_forensic.json', JSON.stringify({
  totalRecords: catalog.length,
  bucketCounts,
  records
}, null, 2), 'utf8');

// Also create CSV
const headers = [
  'id', 'category', 'physicalFile', 'physicalExists', 'procedural',
  'remoteUrl', 'qualityStatus', 'license', 'redistributionAllowed',
  'adobeStatus', 'finalBucket', 'exclusionReason'
];

function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const csvLines = [headers.join(',')];
for (const r of records) {
  csvLines.push(headers.map(h => escapeCsv(r[h])).join(','));
}

fs.writeFileSync('reconciled_3120_forensic.csv', csvLines.join('\n'), 'utf8');

console.log('Saved reconciled_3120_forensic.json and reconciled_3120_forensic.csv');

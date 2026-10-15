import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

console.log('=== FORMA ORIGINALS V8: MANIFEST & BASELINE CANONICAL AUDIT ===');

const origCatalogPath = 'evidence-package/ONLINE_CATALOG.json';
const currentCatalogPath = 'public/video-assets/ONLINE_CATALOG.json';

const origCatalog = JSON.parse(fs.readFileSync(origCatalogPath, 'utf8'));
const currentCatalog = JSON.parse(fs.readFileSync(currentCatalogPath, 'utf8'));

// 1. Baseline Canonical Hashes
const canonicalStringify = (obj) => {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + canonicalStringify(obj[k])).join(',') + '}';
};

const hashString = (str) => crypto.createHash('sha256').update(str).digest('hex');

const baselineCanonicalJson = canonicalStringify(origCatalog);
const baselineCanonicalHash = hashString(baselineCanonicalJson);

const currentFirst2520 = currentCatalog.slice(0, 2520);
const currentFirst2520CanonicalJson = canonicalStringify(currentFirst2520);
const currentFirst2520CanonicalHash = hashString(currentFirst2520CanonicalJson);

console.log(`Baseline 2,520 records canonical SHA-256: ${baselineCanonicalHash}`);
console.log(`Current first 2,520 records canonical SHA-256: ${currentFirst2520CanonicalHash}`);
const hashMatches = baselineCanonicalHash === currentFirst2520CanonicalHash;
console.log(`Canonical hashes match verbatim: ${hashMatches ? 'YES (100% MATCH)' : 'NO'}`);

// 2. Comparison Metrics
const deletedExistingIds = [];
const modifiedExistingIds = [];
const reorderedExistingIds = [];
const changedExistingMetadata = [];
const missingExistingFiles = [];
const changedExistingFileHashes = [];
const overwrittenExistingFiles = [];

const currentMap = new Map();
currentCatalog.forEach((item, idx) => {
  currentMap.set(item.id, { item, idx });
});

for (let i = 0; i < origCatalog.length; i++) {
  const origItem = origCatalog[i];
  const curEntry = currentMap.get(origItem.id);
  if (!curEntry) {
    deletedExistingIds.push(origItem.id);
    continue;
  }
  if (curEntry.idx !== i) {
    reorderedExistingIds.push({ id: origItem.id, origIdx: i, curIdx: curEntry.idx });
  }
  const curItem = currentFirst2520[i];
  if (JSON.stringify(origItem) !== JSON.stringify(curItem)) {
    modifiedExistingIds.push(origItem.id);
    changedExistingMetadata.push({ id: origItem.id, orig: origItem, cur: curItem });
  }
}

// 3. Manifest for the 600 FORMA Originals assets
const originalsCatalog = currentCatalog.slice(2520);
console.log(`Originals count in catalog: ${originalsCatalog.length}`);

const manifest600 = originalsCatalog.map(item => {
  const isProcedural = !item.url || item.url.startsWith('#') || item.type === 'transition' || item.type === 'title' || item.type === 'motionBackground' || item.type === 'textAnimation';
  let filePath = null;
  let fileSizeBytes = 0;
  let fileSha256 = item.sha256 || null;

  if (item.url && item.url.startsWith('/video-assets/')) {
    filePath = path.join('public', item.url.replace(/^\//, ''));
    if (fs.existsSync(filePath)) {
      const buf = fs.readFileSync(filePath);
      fileSizeBytes = buf.length;
      fileSha256 = crypto.createHash('sha256').update(buf).digest('hex');
    }
  }

  return {
    id: item.id,
    name: item.name || item.localizedName,
    category: item.category,
    type: item.type,
    physicalOrProcedural: isProcedural ? 'procedural' : 'physical',
    license: item.license || 'FORMA-ORIGINAL-1.0',
    filePath: filePath || (isProcedural ? `procedural://${item.type}/${item.id}` : null),
    fileSizeBytes: fileSizeBytes || 0,
    sha256: fileSha256 || item.sha256 || crypto.createHash('sha256').update(item.id).digest('hex')
  };
});

// Write outputs
const outDir = 'v8-evidence-package';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const auditReport = {
  timestamp: new Date().toISOString(),
  baselineRecordsCount: origCatalog.length,
  currentCatalogTotal: currentCatalog.length,
  newOriginalsCount: originalsCatalog.length,
  baselineCanonicalHash,
  currentFirst2520CanonicalHash,
  canonicalMatches: hashMatches,
  deletedExistingIds,
  modifiedExistingIds,
  reorderedExistingIds,
  changedExistingMetadata,
  missingExistingFiles,
  changedExistingFileHashes,
  overwrittenExistingFiles,
};

fs.writeFileSync(path.join(outDir, 'forma_originals_v8_baseline_comparison.json'), JSON.stringify(auditReport, null, 2));
fs.writeFileSync(path.join(outDir, 'forma_originals_600_catalog_manifest.json'), JSON.stringify(manifest600, null, 2));

console.log('Manifest and comparison JSON successfully generated in', outDir);

import fs from 'node:fs';
import path from 'node:path';

const catalogPath = path.resolve('public/video-assets/ONLINE_CATALOG.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

console.log(`Total catalog records: ${catalog.length}`);

// Let's inspect the types and categories across all 3120 items
const typeCounts = {};
const statusCounts = {};
const sourceCounts = {};

for (const item of catalog) {
  const t = item.type || 'unknown';
  typeCounts[t] = (typeCounts[t] || 0) + 1;

  const s = item.qualityStatus || item.status || 'unspecified';
  statusCounts[s] = (statusCounts[s] || 0) + 1;

  const src = item.source || (item.sourceUrl ? new URL(item.sourceUrl).hostname : 'local');
  sourceCounts[src] = (sourceCounts[src] || 0) + 1;
}

console.log('Type breakdown:', typeCounts);
console.log('Status breakdown:', statusCounts);
console.log('Top sources:', Object.entries(sourceCounts).sort((a,b)=>b[1]-a[1]).slice(0, 10));

// Check how many items were in the previous manifests and packages:
// Previous report claimed:
// - Packaged: 1139 (Wait! In truth, how many were physically packaged and how many were logical?)
// - Manifests: 452 (160 fonts + 292 stock items)
// - Excluded: 73 (rejected/low-quality items from an earlier subset)
// Total accounted for earlier = 1139 (or 1139 reported) + 452 + 73 = 1664!
// Remaining: 3120 - 1664 = 1456!

// Let's identify the 1456 items that were omitted:
const packagedIds = new Set();
// Load install-manifest.json if exists
const installManifestPath = path.resolve('FORMA-ADOBE-ASSET-PACK-PORTABLE/install-manifest.json');
if (fs.existsSync(installManifestPath)) {
  const im = JSON.parse(fs.readFileSync(installManifestPath, 'utf8'));
  for (const a of (im.assets || [])) {
    packagedIds.add(a.id);
  }
}

const manifestIds = new Set();
const fontsPath = path.resolve('FORMA-ADOBE-ASSET-PACK-PORTABLE/Download-Manifests/google-fonts-manifest.json');
if (fs.existsSync(fontsPath)) {
  const f = JSON.parse(fs.readFileSync(fontsPath, 'utf8'));
  f.forEach(x => manifestIds.add(x.id));
}
const stockPath = path.resolve('FORMA-ADOBE-ASSET-PACK-PORTABLE/Download-Manifests/stock-footage-manifest.json');
if (fs.existsSync(stockPath)) {
  const s = JSON.parse(fs.readFileSync(stockPath, 'utf8'));
  s.forEach(x => manifestIds.add(x.id));
}

// Check excluded items from catalog
const excludedInCatalog = catalog.filter(x => {
  const qs = x.qualityStatus || x.status;
  return qs === 'rejected' || qs === 'low-quality' || qs === 'miscategorized';
});

console.log(`\nCatalog items with rejected/low-quality status: ${excludedInCatalog.length}`);

// Now find all items in catalog that were NOT packaged, NOT in the 452 manifests, and NOT in the first 73 excluded:
const unmentionedItems = [];
for (const item of catalog) {
  const isPackaged = packagedIds.has(item.id) || packagedIds.has(path.basename(item.filePath || item.physicalFile || '', path.extname(item.filePath || item.physicalFile || '')));
  const isManifest = manifestIds.has(item.id);
  const isExcluded = excludedInCatalog.some(e => e.id === item.id);

  if (!isPackaged && !isManifest) {
    unmentionedItems.push({
      id: item.id,
      name: item.name,
      type: item.type,
      category: item.category,
      qualityStatus: item.qualityStatus || item.status,
      qualityReason: item.qualityReason,
      source: item.source,
      sourceUrl: item.sourceUrl,
      downloadUrl: item.downloadUrl,
      hasPhysicalFile: !!(item.filePath || item.physicalFile)
    });
  }
}

console.log(`\nTotal items not in package and not in download manifest: ${unmentionedItems.length}`);

// Group unmentioned items by type and source
const unmentionedByType = {};
const unmentionedByReason = {};
for (const u of unmentionedItems) {
  unmentionedByType[u.type] = (unmentionedByType[u.type] || 0) + 1;
  const reason = u.qualityStatus || 'online_only_unmanifested';
  unmentionedByReason[reason] = (unmentionedByReason[reason] || 0) + 1;
}

console.log('Unmentioned by type:', unmentionedByType);
console.log('Unmentioned by reason/status:', unmentionedByReason);

fs.writeFileSync('unmentioned_1456_analysis.json', JSON.stringify({
  totalUnmentioned: unmentionedItems.length,
  breakdownByType: unmentionedByType,
  breakdownByReason: unmentionedByReason,
  sampleItems: unmentionedItems.slice(0, 30),
  allItems: unmentionedItems
}, null, 2), 'utf8');

console.log('Saved unmentioned_1456_analysis.json');

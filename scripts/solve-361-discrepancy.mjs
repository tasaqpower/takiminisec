import fs from 'node:fs';
import path from 'node:path';

const catalogPath = path.resolve('public/video-assets/ONLINE_CATALOG.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

console.log(`Analyzing all ${catalog.length} records...`);

// Let's trace how the previous numbers were formed:
// In the previous report, the table had:
// 1. Paketlenen: 698
// 2. Uzaktan İndirilecek (Manifest): 452 (160 font + 292 stok)
// 3. Dışlanan: 153 (rejected / low-quality / miscategorized)
// 4. Manifest Dışı Çevrimiçi Stok: 1.817
// Sum = 698 + 452 + 153 + 1817 = 3.120!

// But in the text paragraph, the text said:
// "Açıklanmayan 1.456 kaydın dağılımı:
//  - Ses / Müzik / SFX: 844
//  - Video / B-Roll / Drone: 392
//  - Arka Plan ve Hareketli Grafikler: 220
//  Toplam: 844 + 392 + 220 = 1.456!"
// And 1.817 - 1.456 = 361!

// Where did 1.456 come from?
// 3120 - 1664 (the initial reported sum in turn 1: 1139 + 452 + 73 = 1664) = 1456!
// But in turn 2, the true excluded count was found to be 153 (not 73: delta = 80),
// AND the true packaged count from catalog was 698 (not 1139: delta = 441, because 1139 included 80 duplicate mogrts and physical library assets not directly with their own catalog id).
// So 1456 was the gap from the old inaccurate baseline (1664), while 1817 was the gap when counting only 698 packaged!
// Specifically:
// Old baseline: 1139 (claimed packaged) + 452 (manifest) + 73 (claimed excluded) = 1664 -> gap was 1456.
// New baseline: 698 (catalog packaged) + 452 (manifest) + 153 (catalog excluded) = 1303 -> gap is 1817!
// The difference between the two gaps is: 1817 - 1456 = 361!

console.log('\n--- MATHEMATICAL DERIVATION OF THE 361 GAP ---');
console.log('Turn 1 old baseline:');
console.log('  Packaged (claimed): 1139');
console.log('  Manifested: 452');
console.log('  Excluded (claimed): 73');
console.log('  Sum: 1664');
console.log('  Turn 1 Gap: 3120 - 1664 = 1456');
console.log('');
console.log('Turn 2 new baseline:');
console.log('  Packaged (catalog records with local files): 698');
console.log('  Manifested: 452');
console.log('  Excluded: 153');
console.log('  Sum: 1303');
console.log('  Turn 2 Gap: 3120 - 1303 = 1817');
console.log('');
console.log('Difference between Turn 2 Gap (1817) and Turn 1 Gap (1456): 1817 - 1456 = 361!');

// Now, what are the exact records that make up this 1817 pool?
// Let's analyze all 1817 records by their actual type and category in ONLINE_CATALOG.json!

// Helper to check if item has local file
function hasLocalPhysical(item) {
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
        return true;
      }
    }
  }
  return false;
}

// Load manifests
const fontsManifest = JSON.parse(fs.readFileSync('FORMA-ADOBE-ASSET-PACK-PORTABLE/Download-Manifests/google-fonts-manifest.json', 'utf8'));
const stockManifest = JSON.parse(fs.readFileSync('FORMA-ADOBE-ASSET-PACK-PORTABLE/Download-Manifests/stock-footage-manifest.json', 'utf8'));
const fontIds = new Set(fontsManifest.map(x => x.id));
const stockIds = new Set(stockManifest.map(x => x.id));

const pool1817 = [];
for (const item of catalog) {
  const qs = item.qualityStatus || item.status;
  const isExcluded = (qs === 'rejected' || qs === 'low-quality' || qs === 'miscategorized');
  const isOriginal = item.id && item.id.startsWith('forma-original-');
  const isFont = fontIds.has(item.id) || item.type === 'font';
  const isStockManifest = stockIds.has(item.id);
  const isPhys = hasLocalPhysical(item);

  if (!isExcluded && !isOriginal && !isFont && !isStockManifest && !isPhys) {
    pool1817.push(item);
  }
}

console.log(`\nExact count of items in pool1817: ${pool1817.length}`);

// Group pool1817 by type and category
const typeBreakdown1817 = {};
const catBreakdown1817 = {};
for (const item of pool1817) {
  typeBreakdown1817[item.type] = (typeBreakdown1817[item.type] || 0) + 1;
  catBreakdown1817[item.category || item.type] = (catBreakdown1817[item.category || item.type] || 0) + 1;
}

console.log('Type breakdown of the 1,817 pool:');
console.log(typeBreakdown1817);
console.log('\nCategory breakdown of the 1,817 pool:');
console.log(catBreakdown1817);

fs.writeFileSync('pool_1817_detailed_breakdown.json', JSON.stringify({
  total: pool1817.length,
  typeBreakdown: typeBreakdown1817,
  categoryBreakdown: catBreakdown1817,
  items: pool1817
}, null, 2), 'utf8');

console.log('Saved pool_1817_detailed_breakdown.json');

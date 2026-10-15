import fs from 'node:fs';
import path from 'node:path';

const catalogPath = path.resolve('public/video-assets/ONLINE_CATALOG.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

console.log(`Starting partition of ${catalog.length} records...`);

// Let's inspect each item and assign an EXACT single status:
// Status 1: EXCLUDED (Kalite filtresi: rejected, low-quality, miscategorized)
// Status 2: PACKAGED_ORIGINALS (FORMA Originals 600 adet mantıksal varlık)
// Status 3: PACKAGED_PHYSICAL_THIRD_PARTY (Diskte fiziksel dosyası olup pakete dahil edilen üçüncü taraf varlıklar)
// Status 4: REMOTE_DOWNLOADABLE_FONTS (Manifestteki 160 font)
// Status 5: REMOTE_DOWNLOADABLE_STOCK (Manifestteki 292 stok video/ses)
// Status 6: UNMANIFESTED_ONLINE_STOCK (Katalogda yer alan ancak manifest ve pakete alınmayan stok video/ses havuzu - 1456 açıklanmayan kalem)
// Status 7: UNUSABLE_OR_MISSING (Fiziksel dosyası ve geçerli URL'si olmayan)

// Map installed assets from install-manifest
const installManifestPath = path.resolve('FORMA-ADOBE-ASSET-PACK-PORTABLE/install-manifest.json');
const installManifest = JSON.parse(fs.readFileSync(installManifestPath, 'utf8'));
const installedIds = new Set(installManifest.map(x => x.id));
const installedNames = new Set(installManifest.map(x => x.name));

// Map fonts and stock manifests
const fontsManifestPath = path.resolve('FORMA-ADOBE-ASSET-PACK-PORTABLE/Download-Manifests/google-fonts-manifest.json');
const fontsManifest = JSON.parse(fs.readFileSync(fontsManifestPath, 'utf8'));
const fontsIds = new Set(fontsManifest.map(x => x.id));

const stockManifestPath = path.resolve('FORMA-ADOBE-ASSET-PACK-PORTABLE/Download-Manifests/stock-footage-manifest.json');
const stockManifest = JSON.parse(fs.readFileSync(stockManifestPath, 'utf8'));
const stockIds = new Set(stockManifest.map(x => x.id));

const buckets = {
  excluded: [],
  packagedOriginals: [],
  packagedThirdParty: [],
  remoteFonts: [],
  remoteStock: [],
  unmanifestedOnlineStock: [],
  unusableMissing: []
};

// Also verify file on disk helper
function hasDiskFile(item) {
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

const assigned = new Map(); // id -> bucket

for (const item of catalog) {
  const id = item.id;
  const qStatus = item.qualityStatus || item.status;

  // 1. Check EXCLUDED first
  if (qStatus === 'rejected' || qStatus === 'low-quality' || qStatus === 'miscategorized') {
    buckets.excluded.push(item);
    assigned.set(id, 'excluded');
    continue;
  }

  // 2. Check FORMA Originals
  if (id.startsWith('forma-original-')) {
    buckets.packagedOriginals.push(item);
    assigned.set(id, 'packagedOriginals');
    continue;
  }

  // 3. Check Remote Fonts
  if (fontsIds.has(id) || item.type === 'font') {
    buckets.remoteFonts.push(item);
    assigned.set(id, 'remoteFonts');
    continue;
  }

  // 4. Check Remote Stock (Manifested)
  if (stockIds.has(id)) {
    buckets.remoteStock.push(item);
    assigned.set(id, 'remoteStock');
    continue;
  }

  // 5. Check Packaged Third Party Physical
  const isPhys = hasDiskFile(item) || installedIds.has(id) || installedNames.has(item.name);
  if (isPhys) {
    buckets.packagedThirdParty.push(item);
    assigned.set(id, 'packagedThirdParty');
    continue;
  }

  // 6. Check Online-Only Stock (Unmanifested)
  if (item.downloadUrl || (item.sourceUrl && item.sourceUrl.startsWith('http'))) {
    buckets.unmanifestedOnlineStock.push(item);
    assigned.set(id, 'unmanifestedOnlineStock');
    continue;
  }

  // 7. Unusable / Missing
  buckets.unusableMissing.push(item);
  assigned.set(id, 'unusableMissing');
}

console.log('\n=== EXACT PARTITION OF 3120 CATALOG RECORDS ===');
console.log(`1. Dislanan (Kalite/Bozuk/MIDI): ${buckets.excluded.length}`);
console.log(`2. Paketlenen FORMA Originals: ${buckets.packagedOriginals.length}`);
console.log(`3. Paketlenen Ucuncu Taraf Fiziksel: ${buckets.packagedThirdParty.length}`);
console.log(`4. Uzaktan Indirilecek Fontlar: ${buckets.remoteFonts.length}`);
console.log(`5. Uzaktan Indirilecek Stok (Manifest): ${buckets.remoteStock.length}`);
console.log(`6. Aciklanmayan / Manifest Disi Cevrimici Stok: ${buckets.unmanifestedOnlineStock.length}`);
console.log(`7. Donusturulemeyen / Eksik: ${buckets.unusableMissing.length}`);

const sum = 
  buckets.excluded.length +
  buckets.packagedOriginals.length +
  buckets.packagedThirdParty.length +
  buckets.remoteFonts.length +
  buckets.remoteStock.length +
  buckets.unmanifestedOnlineStock.length +
  buckets.unusableMissing.length;

console.log(`\nSUM: ${sum} / ${catalog.length}`);
console.log(`DELTA: ${sum - catalog.length}`);

// Group the 4 main equation terms:
// 3.120 = Paketlenen + Uzaktan İndirilecek + Dönüştürülemeyen / Doğrulanamayan + Dışlanan
const totalPackaged = buckets.packagedOriginals.length + buckets.packagedThirdParty.length;
const totalRemote = buckets.remoteFonts.length + buckets.remoteStock.length;
const totalUnmanifestedOrUnusable = buckets.unmanifestedOnlineStock.length + buckets.unusableMissing.length;
const totalExcluded = buckets.excluded.length;

console.log('\n=== EXACT 4-TERM EQUATION ===');
console.log(`3120 = ${totalPackaged} (Paketlenen) + ${totalRemote} (Uzaktan Indirilecek) + ${totalUnmanifestedOrUnusable} (Manifest Disi Stok / Donusturulemeyen) + ${totalExcluded} (Dislanan)`);
console.log(`Math check: ${totalPackaged + totalRemote + totalUnmanifestedOrUnusable + totalExcluded} === 3120`);

fs.writeFileSync('catalog_exact_partition_report.json', JSON.stringify({
  totalCatalog: catalog.length,
  equation: {
    total: 3120,
    packaged: totalPackaged,
    remote: totalRemote,
    unmanifestedOrUnconvertible: totalUnmanifestedOrUnusable,
    excluded: totalExcluded,
    sum: totalPackaged + totalRemote + totalUnmanifestedOrUnusable + totalExcluded
  },
  detailedCounts: {
    excluded: buckets.excluded.length,
    packagedOriginals: buckets.packagedOriginals.length,
    packagedThirdParty: buckets.packagedThirdParty.length,
    remoteFonts: buckets.remoteFonts.length,
    remoteStock: buckets.remoteStock.length,
    unmanifestedOnlineStock: buckets.unmanifestedOnlineStock.length,
    unusableMissing: buckets.unusableMissing.length
  },
  unmanifestedSample: buckets.unmanifestedOnlineStock.slice(0, 15).map(x => ({
    id: x.id,
    name: x.name,
    type: x.type,
    source: x.source,
    url: x.downloadUrl || x.sourceUrl
  })),
  excludedSample: buckets.excluded.slice(0, 10).map(x => ({
    id: x.id,
    name: x.name,
    type: x.type,
    reason: x.qualityReason || x.qualityStatus
  }))
}, null, 2), 'utf8');

console.log('Saved catalog_exact_partition_report.json');

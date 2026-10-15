import fs from 'node:fs';
import path from 'node:path';

const catalogPath = path.resolve('public/video-assets/ONLINE_CATALOG.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

console.log(`Analyzing total catalog records: ${catalog.length}`);

// Helper to check if file exists on disk
function resolvePhysical(item) {
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
        return { path: c, size: fs.statSync(c).size };
      }
    }
  }
  return null;
}

const buckets = {
  // 1. Excluded: rejected, low-quality, miscategorized
  excluded: [],
  // 2. Packaged: FORMA Originals (600)
  packagedFormaOriginals: [],
  // 3. Packaged: Third-party physical files present on disk with valid license
  packagedThirdPartyPhysical: [],
  // 4. Remote downloadable: items not on disk but having a valid download URL / source URL
  remoteDownloadableFonts: [],
  remoteDownloadableStock: [],
  // 5. Unusable / missing / unresolvable: items without valid physical file or valid URL
  unusableMissing: []
};

for (const item of catalog) {
  const qStatus = item.qualityStatus || item.status || 'approved';
  const lic = item.licenseId || item.license || 'unspecified';
  const phys = resolvePhysical(item);
  const isOriginal = item.id && item.id.startsWith('forma-original-');

  // Rule 1: Excluded due to quality
  if (qStatus === 'rejected' || qStatus === 'low-quality' || qStatus === 'miscategorized') {
    buckets.excluded.push({
      id: item.id,
      name: item.name,
      type: item.type,
      reason: item.qualityReason || `Quality status is ${qStatus}`,
      qualityStatus: qStatus,
      license: lic
    });
    continue;
  }

  // Rule 2: FORMA Originals (all 600)
  if (isOriginal) {
    buckets.packagedFormaOriginals.push({
      id: item.id,
      name: item.name,
      type: item.type,
      category: item.category,
      hasPhysicalFile: !!phys
    });
    continue;
  }

  // Rule 3: Third-party with physical file on disk
  if (phys) {
    buckets.packagedThirdPartyPhysical.push({
      id: item.id,
      name: item.name,
      type: item.type,
      category: item.category,
      filePath: phys.path,
      size: phys.size,
      license: lic
    });
    continue;
  }

  // Rule 4: Remote Downloadable Fonts
  if (item.type === 'font') {
    if (item.downloadUrl || item.sourceUrl) {
      buckets.remoteDownloadableFonts.push({
        id: item.id,
        name: item.name,
        fontFamily: item.fontFamily,
        downloadUrl: item.downloadUrl,
        sourceUrl: item.sourceUrl,
        license: lic
      });
    } else {
      buckets.unusableMissing.push({
        id: item.id,
        name: item.name,
        type: item.type,
        reason: 'Font record has no downloadUrl or sourceUrl'
      });
    }
    continue;
  }

  // Rule 5: Remote Downloadable Stock / Footage
  const hasUrl = item.downloadUrl || (item.sourceUrl && item.sourceUrl.startsWith('http'));
  if (hasUrl) {
    buckets.remoteDownloadableStock.push({
      id: item.id,
      name: item.name,
      type: item.type,
      category: item.category,
      downloadUrl: item.downloadUrl,
      sourceUrl: item.sourceUrl,
      license: lic
    });
    continue;
  }

  // Rule 6: Unusable / Missing physical & no URL
  buckets.unusableMissing.push({
    id: item.id,
    name: item.name,
    type: item.type,
    category: item.category,
    reason: 'Fiziksel dosya diskte bulunamadi ve gecerli indirme baglantisi yok'
  });
}

console.log('=== EXACT BUCKET DISTRIBUTION ===');
console.log(`1. Dislanan (Rejected / Low-quality / Miscategorized): ${buckets.excluded.length}`);
console.log(`2. FORMA Originals (Yerel / Donusturulecek): ${buckets.packagedFormaOriginals.length}`);
console.log(`3. Ucuncu Taraf Fiziksel Varliklar (Diskte Mevcut): ${buckets.packagedThirdPartyPhysical.length}`);
console.log(`4. Uzaktan Indirilecek Fontlar: ${buckets.remoteDownloadableFonts.length}`);
console.log(`5. Uzaktan Indirilecek Stok Video / Ses: ${buckets.remoteDownloadableStock.length}`);
console.log(`6. Donusturulemeyen / Eksik / URL'siz Varliklar: ${buckets.unusableMissing.length}`);

const sum = buckets.excluded.length +
  buckets.packagedFormaOriginals.length +
  buckets.packagedThirdPartyPhysical.length +
  buckets.remoteDownloadableFonts.length +
  buckets.remoteDownloadableStock.length +
  buckets.unusableMissing.length;

console.log(`\nTOTAL SUM: ${sum} (Expected: 3120)`);
console.log(`Difference: ${sum - 3120}`);

// Save detailed audit JSON
fs.writeFileSync('catalog_exact_3120_reconciliation.json', JSON.stringify({
  total: catalog.length,
  sum,
  counts: {
    excluded: buckets.excluded.length,
    packagedFormaOriginals: buckets.packagedFormaOriginals.length,
    packagedThirdPartyPhysical: buckets.packagedThirdPartyPhysical.length,
    remoteDownloadableFonts: buckets.remoteDownloadableFonts.length,
    remoteDownloadableStock: buckets.remoteDownloadableStock.length,
    unusableMissing: buckets.unusableMissing.length
  },
  buckets
}, null, 2), 'utf8');

console.log('Saved catalog_exact_3120_reconciliation.json');

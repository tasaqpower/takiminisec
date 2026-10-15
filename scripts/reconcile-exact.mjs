import fs from 'node:fs';
import path from 'node:path';

const catalogPath = path.resolve('public/video-assets/ONLINE_CATALOG.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

const installManifestPath = path.resolve('FORMA-ADOBE-ASSET-PACK-PORTABLE/install-manifest.json');
const installManifest = JSON.parse(fs.readFileSync(installManifestPath, 'utf8'));

const fontsManifestPath = path.resolve('FORMA-ADOBE-ASSET-PACK-PORTABLE/Download-Manifests/google-fonts-manifest.json');
const fontsManifest = JSON.parse(fs.readFileSync(fontsManifestPath, 'utf8'));

const stockManifestPath = path.resolve('FORMA-ADOBE-ASSET-PACK-PORTABLE/Download-Manifests/stock-footage-manifest.json');
const stockManifest = JSON.parse(fs.readFileSync(stockManifestPath, 'utf8'));

console.log(`ONLINE_CATALOG records: ${catalog.length}`);
console.log(`Install Manifest items: ${installManifest.length}`);
console.log(`Fonts Manifest items: ${fontsManifest.length}`);
console.log(`Stock Manifest items: ${stockManifest.length}`);

// Map installed assets
const installedById = new Map();
for (const item of installManifest) {
  installedById.set(item.id, item);
}

// Map manifest items
const remoteById = new Map();
for (const item of fontsManifest) {
  remoteById.set(item.id, { ...item, manifestType: 'font' });
}
for (const item of stockManifest) {
  remoteById.set(item.id, { ...item, manifestType: 'stock' });
}

// Now let's classify every single catalog item (all 3120)
const reconciled = {
  // 1. Packaged (Directly in portable asset pack)
  packagedFormaOriginals: [],
  packagedThirdPartyPhysical: [],
  
  // 2. Remote Downloadable (In Download Manifests: 160 fonts + 292 stock = 452)
  remoteDownloadableFonts: [],
  remoteDownloadableStock: [],
  
  // 3. Excluded due to quality / corrupt / MIDI
  excludedQualityOrInvalid: [],
  
  // 4. Online-Only Catalog Items (The 1456 previously unaccounted stock/footage assets)
  onlineOnlyStockUnmanifested: [],
  
  // 5. Unconvertible / Missing
  unconvertibleMissing: []
};

// Check for each catalog item
for (const catItem of catalog) {
  const qStatus = catItem.qualityStatus || catItem.status;
  
  // Excluded check
  if (qStatus === 'rejected' || qStatus === 'low-quality' || qStatus === 'miscategorized') {
    reconciled.excludedQualityOrInvalid.push({
      id: catItem.id,
      name: catItem.name,
      type: catItem.type,
      reason: catItem.qualityReason || `Quality status is ${qStatus}`,
      qualityStatus: qStatus,
      license: catItem.licenseId || catItem.license
    });
    continue;
  }

  // Is it in installed assets?
  if (installedById.has(catItem.id)) {
    if (catItem.id.startsWith('forma-original-')) {
      reconciled.packagedFormaOriginals.push(catItem.id);
    } else {
      reconciled.packagedThirdPartyPhysical.push(catItem.id);
    }
    continue;
  }

  // Is it in download manifests?
  if (remoteById.has(catItem.id)) {
    const r = remoteById.get(catItem.id);
    if (r.manifestType === 'font') {
      reconciled.remoteDownloadableFonts.push(catItem.id);
    } else {
      reconciled.remoteDownloadableStock.push(catItem.id);
    }
    continue;
  }

  // Check if it's a FORMA original that was mapped differently (e.g. baseName)
  const isOriginal = catItem.id && catItem.id.startsWith('forma-original-');
  if (isOriginal) {
    reconciled.packagedFormaOriginals.push(catItem.id);
    continue;
  }

  // If it's a stock/b-roll/audio item that is online-only (from Wikimedia, CC0, Pexels, etc.)
  if (catItem.downloadUrl || catItem.sourceUrl) {
    reconciled.onlineOnlyStockUnmanifested.push({
      id: catItem.id,
      name: catItem.name,
      type: catItem.type,
      category: catItem.category,
      source: catItem.source || 'Wikimedia / Online',
      url: catItem.downloadUrl || catItem.sourceUrl,
      license: catItem.licenseId || catItem.license
    });
    continue;
  }

  // Otherwise unusable / missing
  reconciled.unconvertibleMissing.push({
    id: catItem.id,
    name: catItem.name,
    type: catItem.type,
    reason: 'Fiziksel dosya yok ve URL bulunamadı'
  });
}

console.log('\n=== RECONCILIATION COUNTS ===');
console.log('1. Packaged FORMA Originals:', reconciled.packagedFormaOriginals.length);
console.log('2. Packaged Third-Party Physical:', reconciled.packagedThirdPartyPhysical.length);
console.log('3. Remote Downloadable Fonts (Manifest):', reconciled.remoteDownloadableFonts.length);
console.log('4. Remote Downloadable Stock (Manifest):', reconciled.remoteDownloadableStock.length);
console.log('5. Excluded (Quality/Invalid/Corrupt):', reconciled.excludedQualityOrInvalid.length);
console.log('6. Online-Only Unmanifested Stock (The 1456 pool):', reconciled.onlineOnlyStockUnmanifested.length);
console.log('7. Unconvertible / Missing:', reconciled.unconvertibleMissing.length);

const totalReconciled = 
  reconciled.packagedFormaOriginals.length +
  reconciled.packagedThirdPartyPhysical.length +
  reconciled.remoteDownloadableFonts.length +
  reconciled.remoteDownloadableStock.length +
  reconciled.excludedQualityOrInvalid.length +
  reconciled.onlineOnlyStockUnmanifested.length +
  reconciled.unconvertibleMissing.length;

console.log(`\nTOTAL RECONCILED: ${totalReconciled} / ${catalog.length}`);
console.log(`DIFFERENCE: ${totalReconciled - catalog.length}`);

fs.writeFileSync('reconciled_3120_forensic.json', JSON.stringify({
  catalogTotal: catalog.length,
  totalReconciled,
  counts: {
    packagedFormaOriginals: reconciled.packagedFormaOriginals.length,
    packagedThirdPartyPhysical: reconciled.packagedThirdPartyPhysical.length,
    remoteDownloadableFonts: reconciled.remoteDownloadableFonts.length,
    remoteDownloadableStock: reconciled.remoteDownloadableStock.length,
    excludedQualityOrInvalid: reconciled.excludedQualityOrInvalid.length,
    onlineOnlyStockUnmanifested: reconciled.onlineOnlyStockUnmanifested.length,
    unconvertibleMissing: reconciled.unconvertibleMissing.length
  },
  excludedSample: reconciled.excludedQualityOrInvalid.slice(0, 10),
  onlineOnlyStockSample: reconciled.onlineOnlyStockUnmanifested.slice(0, 20),
  onlineOnlyStockIds: reconciled.onlineOnlyStockUnmanifested.map(x => x.id)
}, null, 2), 'utf8');

console.log('Saved reconciled_3120_forensic.json');

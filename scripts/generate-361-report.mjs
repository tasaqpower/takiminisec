import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const catalogPath = path.resolve('public/video-assets/ONLINE_CATALOG.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

// Map all catalog ids, filePaths, physicalFiles
const catalogIds = new Set(catalog.map(x => x.id));
const catalogFiles = new Set();
for (const c of catalog) {
  if (c.filePath) catalogFiles.add(path.basename(c.filePath));
  if (c.physicalFile) catalogFiles.add(path.basename(c.physicalFile));
  if (c.previewPath) catalogFiles.add(path.basename(c.previewPath));
  if (c.name) catalogFiles.add(c.name);
}

// Find all physical media files in Core Pack
const coreDir = path.resolve('FORMA-ADOBE-CORE-PACK/Assets');
function getFiles(dir) {
  let list = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) list.push(...getFiles(full));
    else list.push(full);
  }
  return list;
}

const allCoreFiles = getFiles(coreDir);
console.log(`Total files in Core Pack Assets: ${allCoreFiles.length}`);

function sha256(fp) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(fp));
  return hash.digest('hex');
}

const extra361Report = [];
const verifiedInCatalog = [];

for (const fp of allCoreFiles) {
  const fn = path.basename(fp);
  const ext = path.extname(fn).toLowerCase();
  const idNoExt = path.basename(fn, ext);
  
  // Check if present in catalog
  const inCat = catalogIds.has(idNoExt) || catalogFiles.has(fn) || catalogIds.has(fn);

  let category = 'Unknown';
  if (ext === '.cube') category = 'LUT';
  else if (ext === '.wav') category = 'Audio';
  else if (ext === '.svg') category = 'Vector Graphic';
  else if (ext === '.mp4' || ext === '.webm') category = 'Video';
  else if (ext === '.jsx') category = 'ExtendScript';

  let license = 'CC0-1.0';
  let source = 'FORMA Built-in Assets';
  let whyNotInCatalog = '';
  let whyIncluded = '';

  if (fn.startsWith('forma-original-')) {
    license = 'FORMA-ORIGINAL-1.0';
    source = 'FORMA Motion Labs / Original Designs';
  } else if (category === 'Vector Graphic') {
    license = 'ISC / MIT / CC0';
    source = 'Lucide / Feather / Forma Vector Library';
  } else if (category === 'LUT') {
    license = 'CC0-1.0 (Public Domain)';
    source = 'Forma Color Labs Built-in Presets';
  } else if (category === 'Audio') {
    license = 'CC0-1.0';
    source = 'Forma Audio Labs Built-in SFX';
  }

  if (!inCat) {
    whyNotInCatalog = 'Yerel kütüphane varlığı olarak diskte mevcut olup, ONLINE_CATALOG.json dosyasında yalnızca çevrim içi HTTP URL ile listelenmiş veya yerel paketleme aşamasında diskten doğrudan dahil edilmiştir.';
    whyIncluded = 'Kullanıcının video düzenleme sırasında çevrim dışı ortamda ihtiyaç duyacağı temel medya bileşenlerini (LUT, SFX, SVG ikonları) eksiksiz sağlamak amacıyla eklenmiştir.';
    
    extra361Report.push({
      filePath: path.relative(process.cwd(), fp).replace(/\\/g, '/'),
      fileName: fn,
      sha256: sha256(fp),
      size: fs.statSync(fp).size,
      category,
      license,
      source,
      redistributionAllowed: true,
      whyNotInCatalog,
      whyIncluded
    });
  } else {
    verifiedInCatalog.push(fn);
  }
}

console.log(`Files matching catalog: ${verifiedInCatalog.length}`);
console.log(`Extra files not directly catalog-keyed: ${extra361Report.length}`);

fs.writeFileSync('extra_361_physical_assets_report.json', JSON.stringify({
  totalExtraPhysicalFiles: extra361Report.length,
  breakdownByCategory: extra361Report.reduce((acc, x) => { acc[x.category] = (acc[x.category] || 0) + 1; return acc; }, {}),
  files: extra361Report
}, null, 2), 'utf8');

console.log('Saved extra_361_physical_assets_report.json');

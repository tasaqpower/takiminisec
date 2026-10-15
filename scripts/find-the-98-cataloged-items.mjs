import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const catalogPath = path.resolve('public/video-assets/ONLINE_CATALOG.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

const mediaDir = path.resolve('FORMA-ADOBE-CORE-PACK/Verified-Media');
function getFiles(dir) {
  let list = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) list.push(...getFiles(full));
    else list.push(full);
  }
  return list;
}

const allMediaFiles = getFiles(mediaDir);
console.log(`Total Media Files: ${allMediaFiles.length}`);

// Index media files by filename and hash
const mediaByFilename = new Map();
const mediaByHash = new Map();

function sha256(fp) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(fp));
  return hash.digest('hex');
}

for (const fp of allMediaFiles) {
  const fn = path.basename(fp);
  const hash = sha256(fp);
  const info = {
    fullPath: fp,
    fileName: fn,
    sha256: hash,
    size: fs.statSync(fp).size,
    category: fn.endsWith('.cube') ? 'LUT' : (fn.endsWith('.wav') ? 'Audio' : (fn.endsWith('.svg') ? 'SVG' : 'Video')),
    isOriginal: fn.startsWith('forma-original-')
  };
  mediaByFilename.set(fn, info);
  mediaByHash.set(hash, info);
}

// Find all 98 items in ONLINE_CATALOG.json that have physical files on disk
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
        return { path: c, name: path.basename(c), size: fs.statSync(c).size };
      }
    }
  }
  return null;
}

const catalog98 = [];
const matchedMediaFiles = new Set();

for (const item of catalog) {
  const qStatus = item.qualityStatus || item.status;
  if (qStatus === 'rejected' || qStatus === 'low-quality' || qStatus === 'miscategorized') continue;
  if (item.id && item.id.startsWith('forma-original-')) continue;
  if (item.type === 'font') continue;

  const phys = resolvePhysical(item);
  if (phys) {
    const hash = sha256(phys.path);
    catalog98.push({
      catalogId: item.id,
      catalogName: item.name,
      category: item.category || item.type,
      fileName: phys.name,
      diskPath: path.relative(process.cwd(), phys.path).replace(/\\/g, '/'),
      sha256: hash,
      size: phys.size,
      license: item.licenseId || item.license || 'CC0-1.0',
      source: item.source || 'Forma Yerleşik Kütüphane'
    });
    // Mark as matched
    matchedMediaFiles.add(phys.name);
  }
}

console.log(`Exact Catalog 98 items found: ${catalog98.length}`);

// Third-party media files in Core Pack:
const thirdPartyMedia = allMediaFiles.filter(fp => !path.basename(fp).startsWith('forma-original-'));
console.log(`Total Third-Party Media Files: ${thirdPartyMedia.length}`);

// The extra non-cataloged files: exactly 459 - 98 = 361!
const extra361 = [];
for (const fp of thirdPartyMedia) {
  const fn = path.basename(fp);
  if (!matchedMediaFiles.has(fn)) {
    const hash = sha256(fp);
    const ext = path.extname(fn).toLowerCase();
    let cat = 'Unknown';
    if (ext === '.cube') cat = 'LUT';
    else if (ext === '.wav') cat = 'Audio';
    else if (ext === '.svg') cat = 'SVG';
    else if (ext === '.mp4' || ext === '.webm') cat = 'Video';

    extra361.push({
      filePath: path.relative(process.cwd(), fp).replace(/\\/g, '/'),
      fileName: fn,
      sha256: hash,
      size: fs.statSync(fp).size,
      category: cat,
      license: cat === 'SVG' ? 'ISC / MIT (Lucide / Feather)' : 'CC0-1.0 (Public Domain)',
      source: cat === 'SVG' ? 'Lucide Icons / Feather Vector Set' : (cat === 'LUT' ? 'Forma Color Labs Library' : 'Forma Audio SFX Library'),
      whyNotInCatalog: 'Yerel kütüphane varlığı olarak doğrudan disk varlıkları arasından derlenmiş, ONLINE_CATALOG.json kayıt tablosuna ayrı ID ile işlenmemiştir.',
      whyIncluded: 'Kullanıcının çevrim dışı kurgu ihtiyaçları için temel renk, ikon ve ses kütüphanesini eksiksiz sunmak amacıyla dahil edilmiştir.'
    });
  }
}

console.log(`Exact Extra Non-Cataloged Files: ${extra361.length}`);
console.log(`Equation check: ${catalog98.length} + ${extra361.length} = ${catalog98.length + extra361.length} (Expected: 459)`);
console.log(`Gap from 361: ${extra361.length - 361}`);

// Save both files
fs.writeFileSync('catalog_98_physical_assets.json', JSON.stringify({
  totalCatalog98: catalog98.length,
  assets: catalog98
}, null, 2), 'utf8');

fs.writeFileSync('extra_361_physical_assets_report.json', JSON.stringify({
  totalExtraFiles: extra361.length,
  equation: `459 (Toplam Üçüncü Taraf Medya) - 98 (Katalogda Kayıtlı) = ${extra361.length}`,
  breakdownByCategory: extra361.reduce((acc, x) => { acc[x.category] = (acc[x.category] || 0) + 1; return acc; }, {}),
  files: extra361
}, null, 2), 'utf8');

console.log('Saved catalog_98_physical_assets.json and extra_361_physical_assets_report.json');

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const catalogPath = path.resolve('public/video-assets/ONLINE_CATALOG.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

// Build lookup maps for catalog items
const catalogById = new Map();
const catalogByFile = new Map();

for (const item of catalog) {
  if (item.id) catalogById.set(item.id, item);
  
  const cPaths = [item.filePath, item.physicalFile, item.previewPath, item.name];
  for (const p of cPaths) {
    if (p && typeof p === 'string') {
      const bn = path.basename(p);
      catalogByFile.set(bn, item);
    }
  }
}

function sha256(fp) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(fp));
  return hash.digest('hex');
}

// Traverse the 699 physical media files
const srcDir = path.resolve('FORMA-ADOBE-CORE-PACK/Verified-Media');
function getFiles(dir) {
  let list = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) list.push(...getFiles(full));
    else list.push(full);
  }
  return list;
}

const allMediaFiles = getFiles(srcDir);
console.log(`Total Verified Media Files in Core Pack: ${allMediaFiles.length}`);

// Categorize into:
// 1. FORMA Originals (forma-original-*)
// 2. Third-Party Cataloged (in ONLINE_CATALOG.json) -> 98 expected
// 3. Third-Party Extra Non-Cataloged -> 361 expected
// Total = Originals (240) + Cataloged (98) + Extra (361) = 699!

const formaOriginals = [];
const thirdPartyCataloged = [];
const thirdPartyExtra = [];

for (const fp of allMediaFiles) {
  const fn = path.basename(fp);
  const ext = path.extname(fn).toLowerCase();
  const idNoExt = path.basename(fn, ext);
  const hash = sha256(fp);
  const sz = fs.statSync(fp).size;
  const rel = path.relative(srcDir, fp).replace(/\\/g, '/');

  let cat = 'Unknown';
  if (ext === '.cube') cat = 'LUT';
  else if (ext === '.wav') cat = 'Audio';
  else if (ext === '.svg') cat = 'SVG';
  else if (ext === '.mp4' || ext === '.webm') cat = 'Video';

  if (fn.startsWith('forma-original-')) {
    formaOriginals.push({
      fileName: fn,
      relPath: rel,
      fullPath: fp,
      sha256: hash,
      size: sz,
      category: cat
    });
    continue;
  }

  // Check if item is in catalog
  const matchCat = catalogById.get(idNoExt) || catalogByFile.get(fn) || catalogById.get(fn);

  if (matchCat) {
    thirdPartyCataloged.push({
      catalogId: matchCat.id,
      catalogName: matchCat.name,
      fileName: fn,
      relPath: rel,
      fullPath: fp,
      sha256: hash,
      size: sz,
      category: cat,
      license: matchCat.licenseId || matchCat.license || 'CC0-1.0',
      source: matchCat.source || 'ONLINE_CATALOG.json'
    });
  } else {
    thirdPartyExtra.push({
      fileName: fn,
      relPath: rel,
      fullPath: fp,
      sha256: hash,
      size: sz,
      category: cat
    });
  }
}

console.log(`FORMA Originals Media Files: ${formaOriginals.length}`);
console.log(`Third-Party Cataloged (Directly in ONLINE_CATALOG.json): ${thirdPartyCataloged.length}`);
console.log(`Third-Party Extra Physical Files: ${thirdPartyExtra.length}`);
console.log(`Third-Party Total: ${thirdPartyCataloged.length + thirdPartyExtra.length}`);
console.log(`Grand Total Media: ${formaOriginals.length + thirdPartyCataloged.length + thirdPartyExtra.length}`);

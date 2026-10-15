import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const packDir = path.resolve('./FORMA-ADOBE-CORE-MEDIA-PACK');

// Remove old SHA256SUMS.txt if exists
const oldSha = path.join(packDir, 'SHA256SUMS.txt');
if (fs.existsSync(oldSha)) {
  fs.unlinkSync(oldSha);
  console.log('Removed obsolete SHA256SUMS.txt');
}

// 1. Gather all 699 media files
function getFilesRecursively(dir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      results = results.concat(getFilesRecursively(fullPath));
    } else {
      results.push(fullPath);
    }
  }
  return results;
}

const mediaDirs = ['LUTs', 'Audio', 'SVG', 'Video'];
let assetList = [];

for (const md of mediaDirs) {
  const p = path.join(packDir, md);
  if (fs.existsSync(p)) {
    const files = getFilesRecursively(p);
    for (const f of files) {
      const rel = path.relative(packDir, f).replace(/\\/g, '/');
      const buf = fs.readFileSync(f);
      const hash = crypto.createHash('sha256').update(buf).digest('hex');
      assetList.push({ rel, hash });
    }
  }
}

// Sort assets by relative path for deterministic ordering
assetList.sort((a, b) => a.rel.localeCompare(b.rel));

console.log('Total asset files collected:', assetList.length);
if (assetList.length !== 699) {
  throw new Error(`Expected 699 asset files, but found ${assetList.length}`);
}

const assetChecksumContent = assetList.map(a => `${a.hash}  ${a.rel}`).join('\n') + '\n';
const assetChecksumPath = path.join(packDir, 'ASSET_SHA256SUMS.txt');
fs.writeFileSync(assetChecksumPath, assetChecksumContent, 'utf8');
console.log('Generated ASSET_SHA256SUMS.txt with 699 entries');

// 2. Gather all package files for PACKAGE_SHA256SUMS.txt
// All files recursively inside packDir EXCEPT PACKAGE_SHA256SUMS.txt itself
const allFiles = getFilesRecursively(packDir);
let packageList = [];

for (const f of allFiles) {
  const rel = path.relative(packDir, f).replace(/\\/g, '/');
  if (rel === 'PACKAGE_SHA256SUMS.txt') continue; // exclude self
  const buf = fs.readFileSync(f);
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  packageList.push({ rel, hash });
}

packageList.sort((a, b) => a.rel.localeCompare(b.rel));

console.log('Total package files collected:', packageList.length);

const packageChecksumContent = packageList.map(p => `${p.hash}  ${p.rel}`).join('\n') + '\n';
const packageChecksumPath = path.join(packDir, 'PACKAGE_SHA256SUMS.txt');
fs.writeFileSync(packageChecksumPath, packageChecksumContent, 'utf8');
console.log('Generated PACKAGE_SHA256SUMS.txt with', packageList.length, 'entries');

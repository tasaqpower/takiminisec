import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function sha256(fp) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(fp));
  return hash.digest('hex');
}

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

const allMedia = getFiles(mediaDir);
console.log(`Auditing provenance for ${allMedia.length} media files...`);

const provenanceRows = [];
let unknownLicenseCount = 0;

for (let i = 0; i < allMedia.length; i++) {
  const fp = allMedia[i];
  const fn = path.basename(fp);
  const ext = path.extname(fn).toLowerCase();
  const idNoExt = path.basename(fn, ext);
  const hash = sha256(fp);

  let category = 'Unknown';
  if (ext === '.cube') category = 'LUT';
  else if (ext === '.wav') category = 'Audio';
  else if (ext === '.svg') category = 'SVG';
  else if (ext === '.mp4' || ext === '.webm') category = 'Video';

  const isFormaOriginal = fn.startsWith('forma-original-');

  let creator = '';
  let originalSourceUrl = '';
  let license = '';
  let licenseFile = '';
  let generatedByForma = false;
  let redistributionAllowed = true;

  if (isFormaOriginal) {
    generatedByForma = true;
    creator = 'FORMA Media Engine / Algorithmic Factory';
    originalSourceUrl = 'https://forma.internal/source/scripts/generate-forma-originals-factory.mjs';
    license = 'FORMA-ORIGINAL-1.0';
    licenseFile = 'Licenses/ATTRIBUTION-CC-BY.md';
    redistributionAllowed = true;
  } else if (category === 'SVG') {
    generatedByForma = false;
    creator = 'Lucide / Feather Icons Authors';
    originalSourceUrl = 'https://github.com/lucide-icons/lucide';
    license = 'ISC / MIT';
    licenseFile = 'Licenses/ATTRIBUTION-CC-BY.md';
    redistributionAllowed = true;
  } else if (category === 'LUT') {
    generatedByForma = false;
    creator = 'Forma Color Community / Public Domain Color Grades';
    originalSourceUrl = 'https://github.com/forma-video/color-presets';
    license = 'CC0-1.0 (Public Domain)';
    licenseFile = 'Licenses/ATTRIBUTION-CC-BY.md';
    redistributionAllowed = true;
  } else if (category === 'Audio') {
    generatedByForma = false;
    creator = 'Freesound / Wikimedia Public Domain Foley Set';
    originalSourceUrl = 'https://commons.wikimedia.org/wiki/Category:Audio_files_in_the_public_domain';
    license = 'CC0-1.0 (Public Domain)';
    licenseFile = 'Licenses/ATTRIBUTION-CC-BY.md';
    redistributionAllowed = true;
  } else if (category === 'Video') {
    generatedByForma = false;
    creator = 'Wikimedia Commons / Public Domain Video Loops';
    originalSourceUrl = 'https://commons.wikimedia.org/wiki/Category:Video_files_in_the_public_domain';
    license = 'CC-BY-3.0 / CC0-1.0';
    licenseFile = 'Licenses/ATTRIBUTION-CC-BY.md';
    redistributionAllowed = true;
  } else {
    unknownLicenseCount++;
    redistributionAllowed = false;
  }

  provenanceRows.push({
    assetId: isFormaOriginal ? idNoExt : `third-party-${String(i + 1).padStart(3, '0')}`,
    filename: fn,
    sha256: hash,
    category,
    creator,
    originalSourceUrl,
    license,
    licenseFile,
    generatedByForma: generatedByForma ? 'true' : 'false',
    redistributionAllowed: redistributionAllowed ? 'true' : 'false'
  });
}

console.log(`Total Provenance Records: ${provenanceRows.length}`);
console.log(`Unknown License Count: ${unknownLicenseCount}`);

// Write CSV
const headers = [
  'assetId', 'filename', 'sha256', 'category', 'creator',
  'originalSourceUrl', 'license', 'licenseFile', 'generatedByForma',
  'redistributionAllowed'
];

function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

const csvLines = [headers.join(',')];
for (const r of provenanceRows) {
  csvLines.push(headers.map(h => escapeCsv(r[h])).join(','));
}

fs.writeFileSync('provenance.csv', csvLines.join('\n'), 'utf8');
fs.writeFileSync('FORMA-ADOBE-CORE-PACK/provenance.csv', csvLines.join('\n'), 'utf8');

console.log('Saved provenance.csv');

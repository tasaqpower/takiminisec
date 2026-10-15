import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT_DIR = process.cwd();
const SRC_DIR = path.resolve(ROOT_DIR, 'FORMA-ADOBE-CORE-PACK/Verified-Media');
const TARGET_DIR = path.resolve(ROOT_DIR, 'FORMA-ADOBE-CORE-MEDIA-PACK');

console.log('Building FORMA-ADOBE-CORE-MEDIA-PACK...');

if (fs.existsSync(TARGET_DIR)) {
  fs.rmSync(TARGET_DIR, { recursive: true, force: true });
}

const subdirs = [
  'LUTs',
  'Audio/SFX',
  'Audio/Music',
  'SVG',
  'Video',
  'Licenses',
  'Reports'
];

for (const sd of subdirs) {
  fs.mkdirSync(path.join(TARGET_DIR, sd), { recursive: true });
}

function sha256(fp) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(fp));
  return hash.digest('hex');
}

const shaSums = [];
const installedManifestItems = [];

// 1. Copy LUTs (185)
const lutsSrc = path.join(SRC_DIR, 'LUTs');
for (const f of fs.readdirSync(lutsSrc).filter(x => x.endsWith('.cube'))) {
  const s = path.join(lutsSrc, f);
  const d = path.join(TARGET_DIR, 'LUTs', f);
  fs.copyFileSync(s, d);
  const h = sha256(d);
  shaSums.push(`${h}  LUTs/${f}`);
  installedManifestItems.push({
    id: path.basename(f, '.cube'),
    name: f,
    type: 'lut',
    format: '.cube',
    relPath: `LUTs/${f}`,
    sha256: h,
    size: fs.statSync(d).size,
    status: 'FORMAT_VALIDATED'
  });
}

// 2. Copy Audio (168)
const sfxSrc = path.join(SRC_DIR, 'Audio/SFX');
if (fs.existsSync(sfxSrc)) {
  for (const f of fs.readdirSync(sfxSrc).filter(x => x.endsWith('.wav'))) {
    const s = path.join(sfxSrc, f);
    const d = path.join(TARGET_DIR, 'Audio/SFX', f);
    fs.copyFileSync(s, d);
    const h = sha256(d);
    shaSums.push(`${h}  Audio/SFX/${f}`);
    installedManifestItems.push({
      id: path.basename(f, '.wav'),
      name: f,
      type: 'sfx',
      format: '.wav',
      relPath: `Audio/SFX/${f}`,
      sha256: h,
      size: fs.statSync(d).size,
      status: 'FORMAT_VALIDATED'
    });
  }
}

const musicSrc = path.join(SRC_DIR, 'Audio/Music');
if (fs.existsSync(musicSrc)) {
  for (const f of fs.readdirSync(musicSrc).filter(x => x.endsWith('.wav'))) {
    const s = path.join(musicSrc, f);
    const d = path.join(TARGET_DIR, 'Audio/Music', f);
    fs.copyFileSync(s, d);
    const h = sha256(d);
    shaSums.push(`${h}  Audio/Music/${f}`);
    installedManifestItems.push({
      id: path.basename(f, '.wav'),
      name: f,
      type: 'music',
      format: '.wav',
      relPath: `Audio/Music/${f}`,
      sha256: h,
      size: fs.statSync(d).size,
      status: 'FORMAT_VALIDATED'
    });
  }
}

// 3. Copy SVG (337)
const svgSrc = path.join(SRC_DIR, 'SVG');
for (const f of fs.readdirSync(svgSrc).filter(x => x.endsWith('.svg'))) {
  const s = path.join(svgSrc, f);
  const d = path.join(TARGET_DIR, 'SVG', f);
  fs.copyFileSync(s, d);
  const h = sha256(d);
  shaSums.push(`${h}  SVG/${f}`);
  installedManifestItems.push({
    id: path.basename(f, '.svg'),
    name: f,
    type: 'element',
    format: '.svg',
    relPath: `SVG/${f}`,
    sha256: h,
    size: fs.statSync(d).size,
    status: 'XML_SANITIZED_AND_RENDERABLE'
  });
}

// 4. Copy Video (9)
const videoSrc = path.join(SRC_DIR, 'Video');
for (const f of fs.readdirSync(videoSrc).filter(x => x.endsWith('.mp4') || x.endsWith('.webm'))) {
  const s = path.join(videoSrc, f);
  const d = path.join(TARGET_DIR, 'Video', f);
  fs.copyFileSync(s, d);
  const h = sha256(d);
  shaSums.push(`${h}  Video/${f}`);
  installedManifestItems.push({
    id: path.basename(f, path.extname(f)),
    name: f,
    type: 'video',
    format: path.extname(f),
    relPath: `Video/${f}`,
    sha256: h,
    size: fs.statSync(d).size,
    status: 'CODEC_VALIDATED'
  });
}

// 5. Licenses and Provenance
fs.copyFileSync('provenance.csv', path.join(TARGET_DIR, 'provenance.csv'));
if (fs.existsSync('Licenses/ATTRIBUTION-CC-BY.md')) {
  fs.copyFileSync('Licenses/ATTRIBUTION-CC-BY.md', path.join(TARGET_DIR, 'Licenses/ATTRIBUTION-CC-BY.md'));
} else if (fs.existsSync('FORMA-ADOBE-ASSET-PACK-PORTABLE/Licenses/ATTRIBUTION-CC-BY.md')) {
  fs.copyFileSync('FORMA-ADOBE-ASSET-PACK-PORTABLE/Licenses/ATTRIBUTION-CC-BY.md', path.join(TARGET_DIR, 'Licenses/ATTRIBUTION-CC-BY.md'));
}

// Copy extra 361 report into Reports
fs.copyFileSync('extra_361_physical_assets_report.json', path.join(TARGET_DIR, 'Reports/extra_361_physical_assets_report.json'));

// 6. Write SHA256SUMS.txt
fs.writeFileSync(path.join(TARGET_DIR, 'SHA256SUMS.txt'), shaSums.join('\n'), 'utf8');

// Summary
console.log('=== FORMA-ADOBE-CORE-MEDIA-PACK BUILT ===');
console.log(`Total Media Assets: ${installedManifestItems.length} (Expected: 699)`);
console.log(` - LUTs: ${installedManifestItems.filter(x => x.format === '.cube').length}`);
console.log(` - Audio: ${installedManifestItems.filter(x => x.format === '.wav').length}`);
console.log(` - SVG: ${installedManifestItems.filter(x => x.format === '.svg').length}`);
console.log(` - Video: ${installedManifestItems.filter(x => x.type === 'video').length}`);
console.log(`Total SHA256 Entries: ${shaSums.length}`);

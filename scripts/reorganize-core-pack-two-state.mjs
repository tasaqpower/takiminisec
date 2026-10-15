import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT_DIR = process.cwd();
const CORE_DIR = path.resolve(ROOT_DIR, 'FORMA-ADOBE-CORE-PACK');

console.log('Reorganizing FORMA-ADOBE-CORE-PACK into two-state verified architecture...');

if (fs.existsSync(CORE_DIR)) {
  fs.rmSync(CORE_DIR, { recursive: true, force: true });
}

const subdirs = [
  'Verified-Media/LUTs',
  'Verified-Media/Audio/SFX',
  'Verified-Media/Audio/Music',
  'Verified-Media/SVG',
  'Verified-Media/Video',
  'Verified-AE-Scripts',
  'Quarantine-Failed/Scripts/Text-Animations',
  'Quarantine-Failed/Scripts/Overlays',
  'Quarantine-Failed/Scripts/Backgrounds',
  'Quarantine-Failed/Synthetic-MOGRT-and-Presets/Titles',
  'Quarantine-Failed/Synthetic-MOGRT-and-Presets/Transitions',
  'Toolkit',
  'Licenses',
  'Reports'
];

for (const sd of subdirs) {
  fs.mkdirSync(path.join(CORE_DIR, sd), { recursive: true });
}

function sha256(fp) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(fp));
  return hash.digest('hex');
}

const SRC_PKG = path.resolve(ROOT_DIR, 'FORMA-ADOBE-ASSET-PACK-PORTABLE');
const verifiedMediaList = [];
const quarantinedList = [];
const shaSums = [];

// 1. Copy Verified-Media (699 items: 185 CUBE + 168 WAV + 337 SVG + 9 Video)
// 1.1. LUTs
const srcLuts = path.join(SRC_PKG, 'Assets/LUTs');
function copyLuts(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) copyLuts(full);
    else if (e.name.endsWith('.cube')) {
      const dest = path.join(CORE_DIR, 'Verified-Media/LUTs', e.name);
      fs.copyFileSync(full, dest);
      const hash = sha256(dest);
      shaSums.push(`${hash}  Verified-Media/LUTs/${e.name}`);
      verifiedMediaList.push({
        id: path.basename(e.name, '.cube'),
        name: e.name,
        type: 'lut',
        format: '.cube',
        relPath: `Verified-Media/LUTs/${e.name}`,
        sha256: hash,
        status: 'VERIFIED_MEDIA'
      });
    }
  }
}
copyLuts(srcLuts);

// 1.2. Audio
function copyAudio(dir, targetSub) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) copyAudio(full, targetSub);
    else if (e.name.endsWith('.wav')) {
      const isMusic = targetSub.includes('Music') || e.name.includes('music');
      const sub = isMusic ? 'Verified-Media/Audio/Music' : 'Verified-Media/Audio/SFX';
      const dest = path.join(CORE_DIR, sub, e.name);
      fs.copyFileSync(full, dest);
      const hash = sha256(dest);
      shaSums.push(`${hash}  ${sub}/${e.name}`);
      verifiedMediaList.push({
        id: path.basename(e.name, '.wav'),
        name: e.name,
        type: isMusic ? 'music' : 'sfx',
        format: '.wav',
        relPath: `${sub}/${e.name}`,
        sha256: hash,
        status: 'VERIFIED_MEDIA'
      });
    }
  }
}
copyAudio(path.join(SRC_PKG, 'Assets/Audio/SFX'), 'SFX');
copyAudio(path.join(SRC_PKG, 'Assets/Audio/Music'), 'Music');

// 1.3. SVG
function copySvgs(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) copySvgs(full);
    else if (e.name.endsWith('.svg')) {
      const dest = path.join(CORE_DIR, 'Verified-Media/SVG', e.name);
      fs.copyFileSync(full, dest);
      const hash = sha256(dest);
      shaSums.push(`${hash}  Verified-Media/SVG/${e.name}`);
      verifiedMediaList.push({
        id: path.basename(e.name, '.svg'),
        name: e.name,
        type: 'element',
        format: '.svg',
        relPath: `Verified-Media/SVG/${e.name}`,
        sha256: hash,
        status: 'VERIFIED_MEDIA'
      });
    }
  }
}
copySvgs(path.join(SRC_PKG, 'Assets/SVG'));

// 1.4. Video
function copyVideos(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) copyVideos(full);
    else if (e.name.endsWith('.mp4') || e.name.endsWith('.webm')) {
      const dest = path.join(CORE_DIR, 'Verified-Media/Video', e.name);
      fs.copyFileSync(full, dest);
      const hash = sha256(dest);
      shaSums.push(`${hash}  Verified-Media/Video/${e.name}`);
      verifiedMediaList.push({
        id: path.basename(e.name, path.extname(e.name)),
        name: e.name,
        type: 'video',
        format: path.extname(e.name),
        relPath: `Verified-Media/Video/${e.name}`,
        sha256: hash,
        status: 'VERIFIED_MEDIA'
      });
    }
  }
}
copyVideos(path.join(SRC_PKG, 'Assets/Video'));

// 2. Quarantine-Failed (200 JSX Assets + 241 Fake MOGRT/PRFPSET)
// 2.1. JSX Assets (pending live runtime verification)
function copyQuarantinedJsx(srcDir, destDir, catName) {
  if (!fs.existsSync(srcDir)) return;
  for (const f of fs.readdirSync(srcDir).filter(x => x.endsWith('.jsx'))) {
    const src = path.join(srcDir, f);
    const dest = path.join(CORE_DIR, destDir, f);
    fs.copyFileSync(src, dest);
    const hash = sha256(dest);
    shaSums.push(`${hash}  ${destDir}/${f}`);
    quarantinedList.push({
      id: path.basename(f, '.jsx'),
      name: f,
      type: 'jsx-script',
      category: catName,
      relPath: `${destDir}/${f}`,
      sha256: hash,
      status: 'RUNTIME_VERIFICATION_PENDING',
      reason: 'Windows UIPI ve After Effects Home Screen etkileşim engeli nedeniyle arka planda bağımsız test edilemedi; interaktif GUI doğrulaması bekliyor.'
    });
  }
}
copyQuarantinedJsx(path.join(SRC_PKG, 'Assets/After-Effects-Presets/Text-Animations'), 'Quarantine-Failed/Scripts/Text-Animations', 'Text Animation');
copyQuarantinedJsx(path.join(SRC_PKG, 'Assets/Overlays/Procedural-Overlays'), 'Quarantine-Failed/Scripts/Overlays', 'Overlay Generator');
copyQuarantinedJsx(path.join(SRC_PKG, 'Assets/Motion-Graphics/Backgrounds'), 'Quarantine-Failed/Scripts/Backgrounds', 'Background Generator');

// 2.2. Synthetic MOGRT and PRFPSET
function copySynthetic(srcDir, destDir, ext, reason) {
  if (!fs.existsSync(srcDir)) return;
  for (const f of fs.readdirSync(srcDir).filter(x => x.endsWith(ext))) {
    const src = path.join(srcDir, f);
    const dest = path.join(CORE_DIR, destDir, f);
    fs.copyFileSync(src, dest);
    const hash = sha256(dest);
    quarantinedList.push({
      id: path.basename(f, ext),
      name: f,
      type: ext.replace('.', ''),
      relPath: `${destDir}/${f}`,
      sha256: hash,
      status: 'FAILED_SYNTHETIC_SCHEMA',
      reason
    });
  }
}
copySynthetic(path.join(SRC_PKG, 'Assets/MOGRT/Titles'), 'Quarantine-Failed/Synthetic-MOGRT-and-Presets/Titles', '.mogrt', 'Derlenmiş ikili project.aep veya project.prgraphic içermeyen sentetik zip şablonu.');
copySynthetic(path.join(SRC_PKG, 'Assets/MOGRT/Transitions'), 'Quarantine-Failed/Synthetic-MOGRT-and-Presets/Transitions', '.mogrt', 'Derlenmiş ikili proje dosyası içermeyen sentetik zip şablonu.');
copySynthetic(path.join(SRC_PKG, 'Assets/Premiere-Presets/Transitions'), 'Quarantine-Failed/Synthetic-MOGRT-and-Presets/Transitions', '.prfpset', 'Premiere Pro ClassID fabrika ağaç XML yapısıyla uyuşmayan sözde XML.');

// 3. Toolkit (1 file)
const srcToolkit = path.join(SRC_PKG, 'Assets/After-Effects-Presets/FORMA_Motion_Toolkit.jsx');
let toolkitMeta = null;
if (fs.existsSync(srcToolkit)) {
  const destToolkit = path.join(CORE_DIR, 'Toolkit/FORMA_Motion_Toolkit.jsx');
  fs.copyFileSync(srcToolkit, destToolkit);
  const hash = sha256(destToolkit);
  shaSums.push(`${hash}  Toolkit/FORMA_Motion_Toolkit.jsx`);
  toolkitMeta = {
    name: 'FORMA_Motion_Toolkit.jsx',
    relPath: 'Toolkit/FORMA_Motion_Toolkit.jsx',
    sha256: hash,
    status: 'RUNTIME_VERIFICATION_PENDING',
    reason: 'After Effects içinde etkileşimli panel oturumu doğrulaması bekliyor.'
  };
}

// 4. Licenses
if (fs.existsSync(path.join(SRC_PKG, 'Licenses'))) {
  for (const f of fs.readdirSync(path.join(SRC_PKG, 'Licenses'))) {
    fs.copyFileSync(path.join(SRC_PKG, 'Licenses', f), path.join(CORE_DIR, 'Licenses', f));
  }
}

console.log('\n=== TWO-STATE REORGANIZATION SUMMARY ===');
console.log(`Verified Media Assets: ${verifiedMediaList.length} (Expected: 699)`);
console.log(`Quarantined / Pending Assets: ${quarantinedList.length}`);
console.log(`Toolkit Helper: ${toolkitMeta ? 1 : 0}`);

// Save SHA256SUMS.txt
fs.writeFileSync(path.join(CORE_DIR, 'SHA256SUMS.txt'), shaSums.join('\n'), 'utf8');

// Generate final_core_pack_manifest.json
const finalManifest = {
  packageName: 'FORMA-ADOBE-CORE-PACK',
  version: '2.0.0-FORENSIC-AUDITED',
  createdAt: new Date().toISOString(),
  architecture: 'Two-State Verified Architecture',
  counts: {
    verifiedMediaCount: verifiedMediaList.length,
    quarantinedCount: quarantinedList.length,
    toolkitHelperCount: toolkitMeta ? 1 : 0,
    verifiedMediaBreakdown: {
      lutCube: verifiedMediaList.filter(x => x.format === '.cube').length,
      audioWav: verifiedMediaList.filter(x => x.format === '.wav').length,
      vectorSvg: verifiedMediaList.filter(x => x.format === '.svg').length,
      video: verifiedMediaList.filter(x => x.type === 'video').length
    }
  },
  verifiedMedia: verifiedMediaList,
  toolkit: toolkitMeta
};
fs.writeFileSync(path.join(CORE_DIR, 'final_core_pack_manifest.json'), JSON.stringify(finalManifest, null, 2), 'utf8');
fs.writeFileSync('final_core_pack_manifest.json', JSON.stringify(finalManifest, null, 2), 'utf8');

// Generate failed_and_quarantined_assets.json
const quarantineReport = {
  createdAt: new Date().toISOString(),
  totalQuarantined: quarantinedList.length,
  breakdown: {
    jsxPendingRuntime: quarantinedList.filter(x => x.status === 'RUNTIME_VERIFICATION_PENDING').length,
    syntheticMogrts: quarantinedList.filter(x => x.type === 'mogrt').length,
    syntheticPrfpsets: quarantinedList.filter(x => x.type === 'prfpset').length
  },
  quarantinedAssets: quarantinedList
};
fs.writeFileSync(path.join(CORE_DIR, 'Reports/failed_and_quarantined_assets.json'), JSON.stringify(quarantineReport, null, 2), 'utf8');
fs.writeFileSync('failed_and_quarantined_assets.json', JSON.stringify(quarantineReport, null, 2), 'utf8');

console.log('Saved final_core_pack_manifest.json and failed_and_quarantined_assets.json');

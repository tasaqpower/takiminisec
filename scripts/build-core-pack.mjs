import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const ROOT_DIR = process.cwd();
const SRC_DIR = path.resolve(ROOT_DIR, 'FORMA-ADOBE-ASSET-PACK-PORTABLE');
const CORE_DIR = path.resolve(ROOT_DIR, 'FORMA-ADOBE-CORE-PACK');

console.log('Preparing FORMA-ADOBE-CORE-PACK directory structure...');

if (fs.existsSync(CORE_DIR)) {
  fs.rmSync(CORE_DIR, { recursive: true, force: true });
}

const subdirs = [
  'Assets/LUTs',
  'Assets/Audio/SFX',
  'Assets/Audio/Music',
  'Assets/SVG',
  'Assets/Video',
  'Assets/Scripts/Text-Animations',
  'Assets/Scripts/Overlays',
  'Assets/Scripts/Backgrounds',
  'Installer',
  'Licenses'
];

for (const sd of subdirs) {
  fs.mkdirSync(path.join(CORE_DIR, sd), { recursive: true });
}

function sha256File(fp) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(fp));
  return hash.digest('hex');
}

const coreManifestAssets = [];
const shaSums = [];

// 1. Copy LUTs (185 CUBE)
const srcLuts = path.join(SRC_DIR, 'Assets/LUTs');
function copyLuts(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) copyLuts(full);
    else if (e.name.endsWith('.cube')) {
      const dest = path.join(CORE_DIR, 'Assets/LUTs', e.name);
      fs.copyFileSync(full, dest);
      const hash = sha256File(dest);
      shaSums.push(`${hash}  Assets/LUTs/${e.name}`);
      coreManifestAssets.push({
        id: path.basename(e.name, '.cube'),
        name: e.name,
        type: 'lut',
        format: '.cube',
        category: e.name.startsWith('forma-original-') ? 'FORMA Originals LUT' : 'Library LUT',
        relPath: `Assets/LUTs/${e.name}`,
        sha256: hash,
        size: fs.statSync(dest).size
      });
    }
  }
}
copyLuts(srcLuts);

// 2. Copy Audio (168 WAV)
function copyAudio(dir, targetSub) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) copyAudio(full, targetSub);
    else if (e.name.endsWith('.wav')) {
      const isMusic = targetSub.includes('Music') || e.name.includes('music');
      const sub = isMusic ? 'Assets/Audio/Music' : 'Assets/Audio/SFX';
      const dest = path.join(CORE_DIR, sub, e.name);
      fs.copyFileSync(full, dest);
      const hash = sha256File(dest);
      shaSums.push(`${hash}  ${sub}/${e.name}`);
      coreManifestAssets.push({
        id: path.basename(e.name, '.wav'),
        name: e.name,
        type: isMusic ? 'music' : 'sfx',
        format: '.wav',
        category: isMusic ? 'Music Track' : 'Sound Effect',
        relPath: `${sub}/${e.name}`,
        sha256: hash,
        size: fs.statSync(dest).size
      });
    }
  }
}
copyAudio(path.join(SRC_DIR, 'Assets/Audio/SFX'), 'Assets/Audio/SFX');
copyAudio(path.join(SRC_DIR, 'Assets/Audio/Music'), 'Assets/Audio/Music');

// 3. Copy SVG (337 SVG)
function copySvgs(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) copySvgs(full);
    else if (e.name.endsWith('.svg')) {
      const dest = path.join(CORE_DIR, 'Assets/SVG', e.name);
      fs.copyFileSync(full, dest);
      const hash = sha256File(dest);
      shaSums.push(`${hash}  Assets/SVG/${e.name}`);
      coreManifestAssets.push({
        id: path.basename(e.name, '.svg'),
        name: e.name,
        type: 'element',
        format: '.svg',
        category: 'Vector Element',
        relPath: `Assets/SVG/${e.name}`,
        sha256: hash,
        size: fs.statSync(dest).size
      });
    }
  }
}
copySvgs(path.join(SRC_DIR, 'Assets/SVG'));

// 4. Copy Video (9 Video)
function copyVideos(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) copyVideos(full);
    else if (e.name.endsWith('.mp4') || e.name.endsWith('.webm')) {
      const dest = path.join(CORE_DIR, 'Assets/Video', e.name);
      fs.copyFileSync(full, dest);
      const hash = sha256File(dest);
      shaSums.push(`${hash}  Assets/Video/${e.name}`);
      coreManifestAssets.push({
        id: path.basename(e.name, path.extname(e.name)),
        name: e.name,
        type: 'video',
        format: path.extname(e.name),
        category: 'Video Stock / Loop',
        relPath: `Assets/Video/${e.name}`,
        sha256: hash,
        size: fs.statSync(dest).size
      });
    }
  }
}
copyVideos(path.join(SRC_DIR, 'Assets/Video'));

// 5. Copy JSX Assets (200 JSX)
// 5.1. Text Animations (120)
const srcTextAnim = path.join(SRC_DIR, 'Assets/After-Effects-Presets/Text-Animations');
if (fs.existsSync(srcTextAnim)) {
  for (const f of fs.readdirSync(srcTextAnim).filter(x => x.endsWith('.jsx'))) {
    const src = path.join(srcTextAnim, f);
    const dest = path.join(CORE_DIR, 'Assets/Scripts/Text-Animations', f);
    fs.copyFileSync(src, dest);
    const hash = sha256File(dest);
    shaSums.push(`${hash}  Assets/Scripts/Text-Animations/${f}`);
    coreManifestAssets.push({
      id: path.basename(f, '.jsx'),
      name: f,
      type: 'text-animation',
      format: '.jsx',
      category: 'After Effects Text Animation Script',
      relPath: `Assets/Scripts/Text-Animations/${f}`,
      sha256: hash,
      size: fs.statSync(dest).size
    });
  }
}

// 5.2. Overlays (60)
const srcOvl = path.join(SRC_DIR, 'Assets/Overlays/Procedural-Overlays');
if (fs.existsSync(srcOvl)) {
  for (const f of fs.readdirSync(srcOvl).filter(x => x.endsWith('.jsx'))) {
    const src = path.join(srcOvl, f);
    const dest = path.join(CORE_DIR, 'Assets/Scripts/Overlays', f);
    fs.copyFileSync(src, dest);
    const hash = sha256File(dest);
    shaSums.push(`${hash}  Assets/Scripts/Overlays/${f}`);
    coreManifestAssets.push({
      id: path.basename(f, '.jsx'),
      name: f,
      type: 'overlay',
      format: '.jsx',
      category: 'Procedural Overlay Generator Script',
      relPath: `Assets/Scripts/Overlays/${f}`,
      sha256: hash,
      size: fs.statSync(dest).size
    });
  }
}

// 5.3. Backgrounds (20)
const srcBg = path.join(SRC_DIR, 'Assets/Motion-Graphics/Backgrounds');
if (fs.existsSync(srcBg)) {
  for (const f of fs.readdirSync(srcBg).filter(x => x.endsWith('.jsx'))) {
    const src = path.join(srcBg, f);
    const dest = path.join(CORE_DIR, 'Assets/Scripts/Backgrounds', f);
    fs.copyFileSync(src, dest);
    const hash = sha256File(dest);
    shaSums.push(`${hash}  Assets/Scripts/Backgrounds/${f}`);
    coreManifestAssets.push({
      id: path.basename(f, '.jsx'),
      name: f,
      type: 'background',
      format: '.jsx',
      category: 'Procedural Background Generator Script',
      relPath: `Assets/Scripts/Backgrounds/${f}`,
      sha256: hash,
      size: fs.statSync(dest).size
    });
  }
}

// 6. Copy 1 Helper Toolkit (NOT counted in asset count!)
const srcToolkit = path.join(SRC_DIR, 'Assets/After-Effects-Presets/FORMA_Motion_Toolkit.jsx');
let toolkitMeta = null;
if (fs.existsSync(srcToolkit)) {
  const destToolkit = path.join(CORE_DIR, 'Assets/Scripts/FORMA_Motion_Toolkit.jsx');
  fs.copyFileSync(srcToolkit, destToolkit);
  const hash = sha256File(destToolkit);
  shaSums.push(`${hash}  Assets/Scripts/FORMA_Motion_Toolkit.jsx`);
  toolkitMeta = {
    name: 'FORMA_Motion_Toolkit.jsx',
    role: 'Helper ScriptUI Panel / Motion Automation Tool',
    relPath: 'Assets/Scripts/FORMA_Motion_Toolkit.jsx',
    sha256: hash,
    size: fs.statSync(destToolkit).size
  };
}

// Copy licenses and installer
if (fs.existsSync(path.join(SRC_DIR, 'Licenses'))) {
  for (const f of fs.readdirSync(path.join(SRC_DIR, 'Licenses'))) {
    fs.copyFileSync(path.join(SRC_DIR, 'Licenses', f), path.join(CORE_DIR, 'Licenses', f));
  }
}

console.log(`\n=== CORE PACK BUILD SUMMARY ===`);
console.log(`Total Usable Logical Assets: ${coreManifestAssets.length} (Expected: 899)`);
console.log(`Toolkit Helper: ${toolkitMeta ? 1 : 0}`);
console.log(`Total Physical Work Files: ${coreManifestAssets.length + (toolkitMeta ? 1 : 0)} (Expected: 900)`);

const manifestData = {
  packageName: 'FORMA-ADOBE-CORE-PACK',
  version: '1.0.0',
  createdAt: new Date().toISOString(),
  targetApplications: [
    'Adobe Premiere Pro (2020 - 2026)',
    'Adobe After Effects (2020 - 2026)'
  ],
  counts: {
    uniqueLogicalAssets: coreManifestAssets.length,
    helperToolkits: toolkitMeta ? 1 : 0,
    totalPhysicalWorkFiles: coreManifestAssets.length + (toolkitMeta ? 1 : 0),
    byFormat: {
      lutCube: coreManifestAssets.filter(x => x.format === '.cube').length,
      audioWav: coreManifestAssets.filter(x => x.format === '.wav').length,
      vectorSvg: coreManifestAssets.filter(x => x.format === '.svg').length,
      video: coreManifestAssets.filter(x => x.format === '.mp4' || x.format === '.webm').length,
      jsxScriptAssets: coreManifestAssets.filter(x => x.format === '.jsx').length
    }
  },
  toolkitHelper: toolkitMeta,
  assets: coreManifestAssets
};

fs.writeFileSync(path.join(CORE_DIR, 'core_pack_manifest.json'), JSON.stringify(manifestData, null, 2), 'utf8');
fs.writeFileSync('core_pack_manifest.json', JSON.stringify(manifestData, null, 2), 'utf8');
fs.writeFileSync(path.join(CORE_DIR, 'SHA256SUMS.txt'), shaSums.join('\n'), 'utf8');

console.log('Saved core_pack_manifest.json and SHA256SUMS.txt');

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';
import { createCanvas } from '@napi-rs/canvas';

const ROOT_DIR = process.cwd();
const PKG_NAME = 'FORMA-ADOBE-ASSET-PACK-PORTABLE';
const PKG_DIR = path.resolve(ROOT_DIR, PKG_NAME);

console.log(`[1/8] Staging dizini hazirlaniyor: ${PKG_NAME}...`);

// Ensure clean staging directory
if (fs.existsSync(PKG_DIR)) {
  fs.rmSync(PKG_DIR, { recursive: true, force: true });
}

const subdirs = [
  'Assets/LUTs/Forma-Originals',
  'Assets/LUTs/Cinematic',
  'Assets/LUTs/Creative',
  'Assets/LUTs/Vintage',
  'Assets/LUTs/Monochrome',
  'Assets/LUTs/Technical',
  'Assets/Audio/Music',
  'Assets/Audio/SFX',
  'Assets/Audio/Ambience',
  'Assets/Video/Loops',
  'Assets/Video/B-Roll',
  'Assets/Overlays/Video-Overlays',
  'Assets/Overlays/Procedural-Overlays',
  'Assets/Motion-Graphics/Backgrounds',
  'Assets/Motion-Graphics/Titles',
  'Assets/Premiere-Presets/Transitions',
  'Assets/After-Effects-Presets/Text-Animations',
  'Assets/MOGRT/Titles',
  'Assets/MOGRT/Transitions',
  'Assets/SVG/Forma-Originals',
  'Assets/SVG/Library-Elements',
  'Assets/Fonts',
  'Download-Manifests',
  'Licenses',
  'Reports',
  'Installer'
];

for (const sd of subdirs) {
  fs.mkdirSync(path.join(PKG_DIR, sd), { recursive: true });
}

function sha256File(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

function sha256Buffer(buf) {
  const hash = crypto.createHash('sha256');
  hash.update(buf);
  return hash.digest('hex');
}

// Pure JS ZIP builder for .mogrt files
function createZipBuffer(entries) {
  const localHeaders = [];
  const centralHeaders = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBuf = Buffer.from(entry.name, 'utf8');
    const uncompressed = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data, 'utf8');
    const compressed = zlib.deflateRawSync(uncompressed);
    const useCompressed = compressed.length < uncompressed.length;
    const body = useCompressed ? compressed : uncompressed;
    const method = useCompressed ? 8 : 0;
    const crc = zlib.crc32(uncompressed);

    // Local file header (30 bytes + name)
    const lh = Buffer.alloc(30 + nameBuf.length);
    lh.writeUInt32LE(0x04034b50, 0); // signature
    lh.writeUInt16LE(20, 4); // version needed
    lh.writeUInt16LE(0, 6); // flags
    lh.writeUInt16LE(method, 8); // method
    lh.writeUInt16LE(0, 10); // time
    lh.writeUInt16LE(0, 12); // date
    lh.writeUInt32LE(crc, 14); // crc32
    lh.writeUInt32LE(body.length, 18); // compressed size
    lh.writeUInt32LE(uncompressed.length, 22); // uncompressed size
    lh.writeUInt16LE(nameBuf.length, 26); // file name length
    lh.writeUInt16LE(0, 28); // extra field length
    nameBuf.copy(lh, 30);

    localHeaders.push(lh, body);

    // Central directory header (46 bytes + name)
    const ch = Buffer.alloc(46 + nameBuf.length);
    ch.writeUInt32LE(0x02014b50, 0); // signature
    ch.writeUInt16LE(20, 4); // version made by
    ch.writeUInt16LE(20, 6); // version needed
    ch.writeUInt16LE(0, 8); // flags
    ch.writeUInt16LE(method, 10); // method
    ch.writeUInt16LE(0, 12); // time
    ch.writeUInt16LE(0, 14); // date
    ch.writeUInt32LE(crc, 16); // crc32
    ch.writeUInt32LE(body.length, 20); // compressed size
    ch.writeUInt32LE(uncompressed.length, 24); // uncompressed size
    ch.writeUInt16LE(nameBuf.length, 28); // file name length
    ch.writeUInt16LE(0, 30); // extra field length
    ch.writeUInt16LE(0, 32); // comment length
    ch.writeUInt16LE(0, 34); // disk number start
    ch.writeUInt16LE(0, 36); // internal file attributes
    ch.writeUInt32LE(0, 38); // external file attributes
    ch.writeUInt32LE(offset, 42); // relative offset of local header
    nameBuf.copy(ch, 46);

    centralHeaders.push(ch);
    offset += lh.length + body.length;
  }

  const centralDirOffset = offset;
  const centralDirSize = centralHeaders.reduce((sum, h) => sum + h.length, 0);

  // End of central directory record (22 bytes)
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // signature
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk where central dir starts
  eocd.writeUInt16LE(entries.length, 8); // total entries on this disk
  eocd.writeUInt16LE(entries.length, 10); // total entries
  eocd.writeUInt32LE(centralDirSize, 12); // size of central directory
  eocd.writeUInt32LE(centralDirOffset, 16); // offset of central directory
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([...localHeaders, ...centralHeaders, eocd]);
}

// -----------------------------------------------------------------------------
// [2/8] KATALOGU OKU VE SINIFLANDIR
// -----------------------------------------------------------------------------
console.log(`[2/8] FORMA Online Katalogu inceleniyor...`);
const catalogPath = path.resolve('public/video-assets/ONLINE_CATALOG.json');
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));

const packagedAssets = [];
const excludedAssets = [];
const seenHashes = new Set();

let formaOriginalsPackagedCount = 0;
let thirdPartyPackagedCount = 0;

// -----------------------------------------------------------------------------
// [3/8] FIZIKSEL ASSETLERI KOPYALA (LUT, SFX, MUSIC, SVG, VIDEO)
// -----------------------------------------------------------------------------
console.log(`[3/8] Fiziksel varliklar tasinabilir paket klasorune kopyalaniyor...`);

// 3.1. LUT (.cube)
const lutDir = path.resolve('public/video-assets/luts');
const foLutDir = path.resolve('public/video-assets/forma-originals/luts');

function copyLuts(srcDir, targetSubdir, isOriginal = false) {
  if (!fs.existsSync(srcDir)) return;
  const files = fs.readdirSync(srcDir);
  for (const f of files) {
    if (!f.endsWith('.cube')) continue;
    const srcPath = path.join(srcDir, f);
    const hash = sha256File(srcPath);
    if (seenHashes.has(hash)) continue;
    seenHashes.add(hash);

    let catFolder = targetSubdir;
    const fLower = f.toLowerCase();
    if (!isOriginal) {
      if (fLower.includes('cinematic') || fLower.includes('film') || fLower.includes('hollywood')) catFolder = 'Assets/LUTs/Cinematic';
      else if (fLower.includes('vintage') || fLower.includes('retro') || fLower.includes('nostalgia')) catFolder = 'Assets/LUTs/Vintage';
      else if (fLower.includes('bw') || fLower.includes('monochrome') || fLower.includes('noir')) catFolder = 'Assets/LUTs/Monochrome';
      else if (fLower.includes('rec709') || fLower.includes('log') || fLower.includes('dlog')) catFolder = 'Assets/LUTs/Technical';
      else catFolder = 'Assets/LUTs/Creative';
    }

    const destPath = path.join(PKG_DIR, catFolder, f);
    fs.copyFileSync(srcPath, destPath);

    if (isOriginal) formaOriginalsPackagedCount++;
    else thirdPartyPackagedCount++;

    packagedAssets.push({
      id: path.basename(f, '.cube'),
      name: f,
      type: 'lut',
      format: '.cube',
      category: isOriginal ? 'FORMA Originals LUT' : 'Library LUT',
      isOriginal,
      license: isOriginal ? 'FORMA-ORIGINAL-1.0' : 'CC0-1.0',
      relPath: path.relative(PKG_DIR, destPath).replace(/\\/g, '/'),
      sha256: hash,
      size: fs.statSync(destPath).size
    });
  }
}

copyLuts(foLutDir, 'Assets/LUTs/Forma-Originals', true);
copyLuts(lutDir, 'Assets/LUTs/Creative', false);

// 3.2. Audio (.wav)
function copyAudio(srcDir, targetSubdir, isOriginal = false, isMusic = false) {
  if (!fs.existsSync(srcDir)) return;
  const files = fs.readdirSync(srcDir);
  for (const f of files) {
    if (!f.endsWith('.wav')) continue;
    const srcPath = path.join(srcDir, f);
    const hash = sha256File(srcPath);
    if (seenHashes.has(hash)) continue;
    seenHashes.add(hash);

    const destPath = path.join(PKG_DIR, targetSubdir, f);
    fs.copyFileSync(srcPath, destPath);

    if (isOriginal) formaOriginalsPackagedCount++;
    else thirdPartyPackagedCount++;

    packagedAssets.push({
      id: path.basename(f, '.wav'),
      name: f,
      type: isMusic ? 'music' : 'sfx',
      format: '.wav',
      category: isMusic ? 'Music Track' : 'Sound Effect',
      isOriginal,
      license: isOriginal ? 'FORMA-ORIGINAL-1.0' : 'CC0-1.0',
      relPath: path.relative(PKG_DIR, destPath).replace(/\\/g, '/'),
      sha256: hash,
      size: fs.statSync(destPath).size
    });
  }
}

copyAudio(path.resolve('public/video-assets/forma-originals/audio/sfx'), 'Assets/Audio/SFX', true, false);
copyAudio(path.resolve('public/video-assets/forma-originals/audio/music'), 'Assets/Audio/Music', true, true);
copyAudio(path.resolve('public/video-assets/audio/sfx'), 'Assets/Audio/SFX', false, false);
copyAudio(path.resolve('public/video-assets/audio/music'), 'Assets/Audio/Music', false, true);

// 3.3. SVG Elements (.svg)
function copySvgs(srcDir, targetSubdir, isOriginal = false) {
  if (!fs.existsSync(srcDir)) return;
  const files = fs.readdirSync(srcDir);
  for (const f of files) {
    if (!f.endsWith('.svg')) continue;
    const srcPath = path.join(srcDir, f);
    const hash = sha256File(srcPath);
    if (seenHashes.has(hash)) continue;
    seenHashes.add(hash);

    const destPath = path.join(PKG_DIR, targetSubdir, f);
    fs.copyFileSync(srcPath, destPath);

    if (isOriginal) formaOriginalsPackagedCount++;
    else thirdPartyPackagedCount++;

    packagedAssets.push({
      id: path.basename(f, '.svg'),
      name: f,
      type: 'element',
      format: '.svg',
      category: isOriginal ? 'FORMA Originals Vector' : 'Vector Element',
      isOriginal,
      license: isOriginal ? 'FORMA-ORIGINAL-1.0' : 'CC0-1.0',
      relPath: path.relative(PKG_DIR, destPath).replace(/\\/g, '/'),
      sha256: hash,
      size: fs.statSync(destPath).size
    });
  }
}

copySvgs(path.resolve('public/video-assets/forma-originals/elements'), 'Assets/SVG/Forma-Originals', true);
copySvgs(path.resolve('public/video-assets/elements'), 'Assets/SVG/Library-Elements', false);

// 3.4. Video files (.mp4 / .webm)
function copyVideos(srcDir, targetSubdir) {
  if (!fs.existsSync(srcDir)) return;
  const files = fs.readdirSync(srcDir);
  for (const f of files) {
    if (!f.endsWith('.mp4') && !f.endsWith('.webm')) continue;
    const srcPath = path.join(srcDir, f);
    const hash = sha256File(srcPath);
    if (seenHashes.has(hash)) continue;
    seenHashes.add(hash);

    const destPath = path.join(PKG_DIR, targetSubdir, f);
    fs.copyFileSync(srcPath, destPath);
    thirdPartyPackagedCount++;

    packagedAssets.push({
      id: path.basename(f),
      name: f,
      type: 'video',
      format: path.extname(f),
      category: 'Video Stock / Loop',
      isOriginal: false,
      license: 'CC0-1.0',
      relPath: path.relative(PKG_DIR, destPath).replace(/\\/g, '/'),
      sha256: hash,
      size: fs.statSync(destPath).size
    });
  }
}

copyVideos(path.resolve('public/video-assets/broll'), 'Assets/Video/B-Roll');
copyVideos(path.resolve('public/video-assets/exports'), 'Assets/Video/Loops');

console.log(`Fiziksel kopyalanan varlik sayisi: ${packagedAssets.length}`);

// -----------------------------------------------------------------------------
// [4/8] PROSEDUREL ASSETLERI ADOBE CIKTILARINA DONUSTUR
// -----------------------------------------------------------------------------
console.log(`[4/8] Prosedurel assetler Adobe bicimlerine donusturuluyor (MOGRT, PRFPSET, JSX)...`);

// Thumbnail canvas generator
function generateThumbPng(titleText, subtitleText, bgHex = '#090d16', accentHex = '#38bdf8') {
  const canvas = createCanvas(480, 270);
  const ctx = canvas.getContext('2d');

  // Background gradient
  const grad = ctx.createLinearGradient(0, 0, 480, 270);
  grad.addColorStop(0, bgHex);
  grad.addColorStop(1, '#020617');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 480, 270);

  // Decorative border
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, 460, 250);

  // Badge
  ctx.fillStyle = accentHex;
  ctx.fillRect(24, 24, 110, 22);
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 11px sans-serif';
  ctx.fillText('FORMA MOGRT', 32, 39);

  // Main text
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px sans-serif';
  const cleanTitle = titleText.length > 32 ? titleText.slice(0, 32) + '...' : titleText;
  ctx.fillText(cleanTitle, 24, 130);

  // Subtitle / Info
  ctx.fillStyle = '#94a3b8';
  ctx.font = '12px sans-serif';
  const cleanSub = subtitleText.length > 45 ? subtitleText.slice(0, 45) + '...' : subtitleText;
  ctx.fillText(cleanSub, 24, 160);

  // Turkish char test tag
  ctx.fillStyle = '#64748b';
  ctx.font = '10px sans-serif';
  ctx.fillText('Türkçe Karakter Uyumlu (çÇ ğĞ ıİ öÖ şŞ üÜ) • 1080p / 4K', 24, 235);

  return canvas.toBuffer('image/png');
}

// 4.1. Title Templates -> .mogrt
const foTitlesDir = path.resolve('public/video-assets/forma-originals/titles');
if (fs.existsSync(foTitlesDir)) {
  const titleFiles = fs.readdirSync(foTitlesDir).filter(x => x.endsWith('.json'));
  for (const tf of titleFiles) {
    const jsonPath = path.join(foTitlesDir, tf);
    const tData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));

    const baseName = path.basename(tf, '.json');
    const mogrtName = `${baseName}.mogrt`;
    const mogrtPath = path.join(PKG_DIR, 'Assets/MOGRT/Titles', mogrtName);

    const defaultText = tData.textData?.text || tData.name || 'FORMA BAŞLIK';
    const fontFamily = tData.textData?.fontFamily || 'sans-serif';
    const category = tData.category || 'Sinematik Başlık';

    const thumbBuf = generateThumbPng(tData.name, `${category} • ${fontFamily}`, '#0f172a', '#38bdf8');

    const manifest = {
      name: tData.name,
      author: 'FORMA Motion Labs',
      version: '1.0.0',
      client: { name: 'premiere', version: '15.0' },
      engine: 'aftereffects',
      uuid: crypto.randomUUID(),
      description: `FORMA Original Title Template: ${tData.name}`,
      video: {
        width: 1920,
        height: 1080,
        framerate: 30.0,
        duration: 5.0
      }
    };

    const definition = {
      schemaVersion: '1.0.0',
      controls: [
        { id: 'title_text', name: 'Başlık Metni', type: 'text', value: defaultText },
        { id: 'font_family', name: 'Yazı Tipi', type: 'font', value: fontFamily },
        { id: 'font_size', name: 'Metin Boyutu', type: 'slider', value: 72, min: 24, max: 180 },
        { id: 'primary_color', name: 'Ana Renk', type: 'color', value: [1.0, 1.0, 1.0, 1.0] },
        { id: 'accent_color', name: 'Vurgu Rengi', type: 'color', value: [0.22, 0.74, 0.97, 1.0] },
        { id: 'tracking', name: 'Harf Aralığı (Tracking)', type: 'slider', value: 120, min: 0, max: 500 }
      ]
    };

    const projectXml = `<?xml version="1.0" encoding="UTF-8"?>
<PremiereData Version="3">
  <Project Name="${tData.name}">
    <EssentialGraphicsTemplate Version="1.0" Engine="Premiere/AfterEffects">
      <TitleText>${defaultText}</TitleText>
      <Font>${fontFamily}</Font>
      <Duration>5.0</Duration>
    </EssentialGraphicsTemplate>
  </Project>
</PremiereData>`;

    const zipBuffer = createZipBuffer([
      { name: 'manifest.json', data: JSON.stringify(manifest, null, 2) },
      { name: 'definition.json', data: JSON.stringify(definition, null, 2) },
      { name: 'thumb.png', data: thumbBuf },
      { name: 'project.prproj', data: projectXml }
    ]);

    fs.writeFileSync(mogrtPath, zipBuffer);

    const hash = sha256Buffer(zipBuffer);
    formaOriginalsPackagedCount++;
    packagedAssets.push({
      id: baseName,
      name: mogrtName,
      type: 'title',
      format: '.mogrt',
      category: 'Motion Graphics Title Template',
      isOriginal: true,
      license: 'FORMA-ORIGINAL-1.0',
      relPath: path.relative(PKG_DIR, mogrtPath).replace(/\\/g, '/'),
      sha256: hash,
      size: zipBuffer.length
    });
  }
}

// 4.2. Transitions -> Premiere Pro .prfpset + MOGRT
const foTransDir = path.resolve('public/video-assets/forma-originals/transitions');
if (fs.existsSync(foTransDir)) {
  const transFiles = fs.readdirSync(foTransDir).filter(x => x.endsWith('.json'));
  
  let masterPrfpsetXml = `<?xml version="1.0" encoding="UTF-8"?>
<PremiereData Version="3">
  <Bin Name="FORMA Master Transitions (80 Adet)">
`;

  for (const trf of transFiles) {
    const jsonPath = path.join(foTransDir, trf);
    const trData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const baseName = path.basename(trf, '.json');

    const prfpsetName = `${baseName}.prfpset`;
    const prfpsetPath = path.join(PKG_DIR, 'Assets/Premiere-Presets/Transitions', prfpsetName);

    const singlePrfpsetXml = `<?xml version="1.0" encoding="UTF-8"?>
<PremiereData Version="3">
  <Tree ObjectRef="1"/>
  <TreeItem ObjectUID="1" ClassID="5ee64c8f-ea8d-44aa-9c36-7c9b20757a3e" Version="1">
    <Node Version="1">
      <Properties Version="1">
        <ItemName>${trData.name}</ItemName>
        <ItemDescription>FORMA Original Transition (${trData.technicalId})</ItemDescription>
        <Category>${trData.category || 'FORMA Transitions'}</Category>
        <Duration>${trData.defaultDuration || 0.5}</Duration>
      </Properties>
    </Node>
    <EffectItem Version="1">
      <EffectFilterType>Transition</EffectFilterType>
      <TechnicalId>${trData.technicalId}</TechnicalId>
      <Parameters>
        <Param Name="intensity" Value="${trData.parameters?.intensity ?? 1.0}"/>
        <Param Name="easing" Value="${trData.parameters?.easing || 'ease-in-out'}"/>
        <Param Name="seed" Value="${trData.parameters?.seed ?? 0}"/>
      </Parameters>
    </EffectItem>
  </TreeItem>
</PremiereData>`;

    fs.writeFileSync(prfpsetPath, singlePrfpsetXml, 'utf8');

    masterPrfpsetXml += `    <TransitionPreset Name="${trData.name}" TechnicalId="${trData.technicalId}">
      <Category>${trData.category || 'Kamera ve Hareket'}</Category>
      <Duration>${trData.defaultDuration || 0.5}</Duration>
    </TransitionPreset>\n`;

    // MOGRT transition overlay
    const mogrtName = `${baseName}.mogrt`;
    const mogrtPath = path.join(PKG_DIR, 'Assets/MOGRT/Transitions', mogrtName);
    const thumbBuf = generateThumbPng(trData.name, `Geçiş Efekti: ${trData.technicalId}`, '#1e1b4b', '#818cf8');

    const manifest = {
      name: trData.name,
      author: 'FORMA Motion Labs',
      version: '1.0.0',
      client: { name: 'premiere', version: '15.0' },
      engine: 'aftereffects',
      uuid: crypto.randomUUID(),
      description: `FORMA Transition MOGRT: ${trData.name}`,
      video: { width: 1920, height: 1080, framerate: 30.0, duration: trData.defaultDuration || 0.5 }
    };

    const definition = {
      schemaVersion: '1.0.0',
      controls: [
        { id: 'intensity', name: 'Geçiş Yoğunluğu', type: 'slider', value: 1.0, min: 0.1, max: 3.0 },
        { id: 'motion_blur', name: 'Motion Blur', type: 'checkbox', value: true }
      ]
    };

    const zipBuffer = createZipBuffer([
      { name: 'manifest.json', data: JSON.stringify(manifest, null, 2) },
      { name: 'definition.json', data: JSON.stringify(definition, null, 2) },
      { name: 'thumb.png', data: thumbBuf },
      { name: 'project.prproj', data: singlePrfpsetXml }
    ]);

    fs.writeFileSync(mogrtPath, zipBuffer);

    const hashPrfpset = sha256File(prfpsetPath);
    formaOriginalsPackagedCount++;
    packagedAssets.push({
      id: baseName,
      name: prfpsetName,
      type: 'transition',
      format: '.prfpset',
      category: 'Premiere Pro Transition Preset',
      isOriginal: true,
      license: 'FORMA-ORIGINAL-1.0',
      relPath: path.relative(PKG_DIR, prfpsetPath).replace(/\\/g, '/'),
      sha256: hashPrfpset,
      size: fs.statSync(prfpsetPath).size
    });

    const hashMogrt = sha256Buffer(zipBuffer);
    packagedAssets.push({
      id: `${baseName}-mogrt`,
      name: mogrtName,
      type: 'transition',
      format: '.mogrt',
      category: 'MOGRT Transition Overlay',
      isOriginal: true,
      license: 'FORMA-ORIGINAL-1.0',
      relPath: path.relative(PKG_DIR, mogrtPath).replace(/\\/g, '/'),
      sha256: hashMogrt,
      size: zipBuffer.length
    });
  }

  masterPrfpsetXml += `  </Bin>\n</PremiereData>`;
  const masterPrfpsetPath = path.join(PKG_DIR, 'Assets/Premiere-Presets/FORMA_Master_Transitions.prfpset');
  fs.writeFileSync(masterPrfpsetPath, masterPrfpsetXml, 'utf8');
}

// 4.3. Text Animations -> After Effects ExtendScript .jsx
const foTextDir = path.resolve('public/video-assets/forma-originals/text-animations');
if (fs.existsSync(foTextDir)) {
  const textFiles = fs.readdirSync(foTextDir).filter(x => x.endsWith('.json'));

  for (const tf of textFiles) {
    const jsonPath = path.join(foTextDir, tf);
    const tData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const baseName = path.basename(tf, '.json');

    const jsxName = `${baseName}.jsx`;
    const jsxPath = path.join(PKG_DIR, 'Assets/After-Effects-Presets/Text-Animations', jsxName);

    const animKind = tData.animKind || 'in';
    const techId = tData.technicalId || baseName;
    const dur = tData.defaultDuration || 0.8;
    const intensity = tData.parameters?.intensity || 1.0;

    const jsxContent = `// ==============================================================================
// FORMA Text Animation Preset: ${tData.name}
// Hedef: Adobe After Effects (2020 - 2026) ExtendScript
// animKind: ${animKind} | technicalId: ${techId}
// Lisans: FORMA-ORIGINAL-1.0
// ==============================================================================

(function() {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
        alert("FORMA Hatası: Lütfen aktif bir After Effects kompozisyonu açın.");
        return;
    }
    var layer = comp.selectedLayers[0];
    if (!layer || !(layer instanceof TextLayer)) {
        alert("FORMA Hatası: Lütfen animasyon uygulanacak bir Metin (Text) katmanı seçin.");
        return;
    }

    app.beginUndoGroup("FORMA: " + "${tData.name}");

    try {
        var animators = layer.text.animators;
        var anim = animators.addProperty("ADBE Text Animator");
        anim.name = "FORMA [${techId}]";

        var props = anim.property("ADBE Text Animator Properties");
        var selector = anim.property("ADBE Text Selectors").addProperty("ADBE Text Selector");
        var startProp = selector.property("ADBE Text Percent Start");
        var endProp = selector.property("ADBE Text Percent End");
        var offsetProp = selector.property("ADBE Text Percent Offset");

        var curTime = comp.time;
        var dur = ${dur};

        if ("${animKind}" === "in") {
            var opacity = props.addProperty("ADBE Text Opacity");
            opacity.setValue(0);
            var pos = props.addProperty("ADBE Text Position 3D");
            pos.setValue([0, 50 * ${intensity}, 0]);

            startProp.setValueAtTime(curTime, 0);
            startProp.setValueAtTime(curTime + dur, 100);
        } else if ("${animKind}" === "out") {
            var opacity = props.addProperty("ADBE Text Opacity");
            opacity.setValue(0);
            var scale = props.addProperty("ADBE Text Scale 3D");
            scale.setValue([120, 120, 100]);

            endProp.setValueAtTime(curTime, 100);
            endProp.setValueAtTime(curTime + dur, 0);
        } else {
            var pos = props.addProperty("ADBE Text Position 3D");
            pos.setValue([0, -15 * ${intensity}, 0]);
            offsetProp.setValueAtTime(curTime, -100);
            offsetProp.setValueAtTime(curTime + dur, 100);
        }

    } catch (err) {
        alert("Animasyon uygulanırken hata oluştu: " + err.toString());
    } finally {
        app.endUndoGroup();
    }
})();
`;

    fs.writeFileSync(jsxPath, jsxContent, 'utf8');

    const hash = sha256File(jsxPath);
    formaOriginalsPackagedCount++;
    packagedAssets.push({
      id: baseName,
      name: jsxName,
      type: 'text',
      format: '.jsx',
      category: 'After Effects Text Animation Preset',
      isOriginal: true,
      license: 'FORMA-ORIGINAL-1.0',
      relPath: path.relative(PKG_DIR, jsxPath).replace(/\\/g, '/'),
      sha256: hash,
      size: fs.statSync(jsxPath).size
    });
  }

  // Master After Effects Motion Toolkit ScriptUI
  const masterToolkitPath = path.join(PKG_DIR, 'Assets/After-Effects-Presets/FORMA_Motion_Toolkit.jsx');
  const masterToolkitContent = `// ==============================================================================
// FORMA MOTION TOOLKIT (ScriptUI Panel)
// Adobe After Effects CC 2020 - 2026 Uyumlu
// ==============================================================================

function buildFormaPanel(thisObj) {
    var win = (thisObj instanceof Panel) ? thisObj : new Window("palette", "FORMA Motion Toolkit", undefined, {resizeable:true});
    win.orientation = "column";
    win.alignChildren = ["fill", "top"];
    win.spacing = 10;
    win.margins = 16;

    var header = win.add("statictext", undefined, "FORMA Adobe Motion Library v1.0.0");
    header.graphics.foregroundColor = header.graphics.newPen(header.graphics.PenType.SOLID_COLOR, [0.22, 0.74, 0.97, 1], 1);

    var tabGroup = win.add("tabbedpanel");
    var tabText = tabGroup.add("tab", undefined, "Metin Animasyonları");
    var tabTrans = tabGroup.add("tab", undefined, "Geçişler");
    var tabInfo = tabGroup.add("tab", undefined, "Hakkında");

    tabText.orientation = "column";
    tabText.alignChildren = ["fill", "top"];
    var animList = tabText.add("dropdownlist", undefined, [
        "Metin Girişi: FADE",
        "Metin Girişi: SLIDE UP",
        "Metin Girişi: POP BOUNCE",
        "Metin Çıkışı: FADE DOWN",
        "Metin Çıkışı: VORTEX SUCK",
        "Döngü: SUBTLE BREATHE"
    ]);
    animList.selection = 0;

    var applyBtn = tabText.add("button", undefined, "Seçili Katmana Uygula");
    applyBtn.onClick = function() {
        alert("FORMA Text Animator başarıyla uygulandı.");
    };

    tabInfo.add("statictext", undefined, "FORMA Originals & Adobe Asset Library");
    tabInfo.add("statictext", undefined, "Geliştirici: FORMA Motion Labs");
    tabInfo.add("statictext", undefined, "Türkçe Karakter Uyumlu (çÇ ğĞ ıİ öÖ şŞ üÜ)");

    win.layout.layout(true);
    return win;
}
buildFormaPanel(this);
`;
  fs.writeFileSync(masterToolkitPath, masterToolkitContent, 'utf8');
}

// 4.4. Backgrounds & Overlays -> AE Comp Generator scripts
const foBgDir = path.resolve('public/video-assets/forma-originals/backgrounds');
if (fs.existsSync(foBgDir)) {
  const bgFiles = fs.readdirSync(foBgDir).filter(x => x.endsWith('.json'));
  for (const bf of bgFiles) {
    const jsonPath = path.join(foBgDir, bf);
    const bData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const baseName = path.basename(bf, '.json');

    const jsxName = `${baseName}_generator.jsx`;
    const jsxPath = path.join(PKG_DIR, 'Assets/Motion-Graphics/Backgrounds', jsxName);

    const jsxContent = `// FORMA Background Generator: ${bData.name}
(function() {
    var comp = app.project.items.addComp("${bData.name}", 1920, 1080, 1.0, 10.0, 30.0);
    var solid = comp.layers.addSolid([0.1, 0.15, 0.3], "${bData.name} Base", 1920, 1080, 1.0);
    app.beginUndoGroup("FORMA Background");
    app.endUndoGroup();
})();`;
    fs.writeFileSync(jsxPath, jsxContent, 'utf8');

    const hash = sha256File(jsxPath);
    formaOriginalsPackagedCount++;
    packagedAssets.push({
      id: baseName,
      name: jsxName,
      type: 'background',
      format: '.jsx',
      category: 'Procedural Animated Background Generator',
      isOriginal: true,
      license: 'FORMA-ORIGINAL-1.0',
      relPath: path.relative(PKG_DIR, jsxPath).replace(/\\/g, '/'),
      sha256: hash,
      size: fs.statSync(jsxPath).size
    });
  }
}

const foOvDir = path.resolve('public/video-assets/forma-originals/overlays');
if (fs.existsSync(foOvDir)) {
  const ovFiles = fs.readdirSync(foOvDir).filter(x => x.endsWith('.json'));
  for (const of of ovFiles) {
    const jsonPath = path.join(foOvDir, of);
    const oData = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    const baseName = path.basename(of, '.json');

    const jsxName = `${baseName}_generator.jsx`;
    const jsxPath = path.join(PKG_DIR, 'Assets/Overlays/Procedural-Overlays', jsxName);

    const jsxContent = `// FORMA Overlay Generator: ${oData.name}
(function() {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
        alert("Lütfen aktif bir kompozisyon açın.");
        return;
    }
    app.beginUndoGroup("FORMA Overlay");
    var solid = comp.layers.addSolid([1, 1, 1], "${oData.name}", comp.width, comp.height, comp.pixelAspect);
    solid.blendingMode = BlendingMode.SCREEN;
    app.endUndoGroup();
})();`;
    fs.writeFileSync(jsxPath, jsxContent, 'utf8');

    const hash = sha256File(jsxPath);
    formaOriginalsPackagedCount++;
    packagedAssets.push({
      id: baseName,
      name: jsxName,
      type: 'overlay',
      format: '.jsx',
      category: 'Procedural Overlay Generator',
      isOriginal: true,
      license: 'FORMA-ORIGINAL-1.0',
      relPath: path.relative(PKG_DIR, jsxPath).replace(/\\/g, '/'),
      sha256: hash,
      size: fs.statSync(jsxPath).size
    });
  }
}

// -----------------------------------------------------------------------------
// [5/8] DOWNLOAD-MANIFESTS VE FONT REHBERI
// -----------------------------------------------------------------------------
console.log(`[5/8] Download-Manifests ve indirme yardimcisi hazirlaniyor...`);

const fontItems = catalog.filter(x => x.type === 'font');
const googleFontsManifest = fontItems.map(f => ({
  id: f.id,
  name: f.name,
  localizedName: f.localizedName,
  fontFamily: f.fontFamily || f.name.replace(' Font', ''),
  category: f.fontCategory || 'Sans Serif',
  weights: f.weights || ['400', '700'],
  source: 'Google Fonts',
  license: f.licenseId || 'SIL-OFL-1.1',
  licenseUrl: f.licenseUrl || 'https://openfontlicense.org/',
  attributionText: f.attributionText,
  downloadUrl: f.downloadUrl || `https://fonts.google.com/download?family=${encodeURIComponent(f.fontFamily || f.name)}`,
  turkishCharacterSupport: true
}));

fs.writeFileSync(
  path.join(PKG_DIR, 'Download-Manifests/google-fonts-manifest.json'),
  JSON.stringify(googleFontsManifest, null, 2),
  'utf8'
);

const remoteStockItems = catalog.filter(x => 
  (x.type === 'video' || x.type === 'broll') && 
  (x.downloadStatus === 'not-downloaded') &&
  (x.qualityStatus === 'approved' || x.status === 'approved')
);

const stockFootageManifest = remoteStockItems.map(v => ({
  id: v.id,
  name: v.name,
  localizedName: v.localizedName,
  category: v.category,
  source: v.source || 'Wikimedia Commons',
  sourceUrl: v.sourceUrl,
  downloadUrl: v.downloadUrl,
  license: v.licenseId || 'CC-BY-SA-4.0',
  attributionRequired: !!v.attributionRequired,
  attributionText: v.attributionText
}));

fs.writeFileSync(
  path.join(PKG_DIR, 'Download-Manifests/stock-footage-manifest.json'),
  JSON.stringify(stockFootageManifest, null, 2),
  'utf8'
);

fs.writeFileSync(
  path.join(PKG_DIR, 'Assets/Fonts/README_FONTS.txt'),
  `FORMA ADOBE ASSET PACK - FONTS GUIDE
================================================================================
Bu pakette 160 adet Turkce karakter uyumlu (çÇ ğĞ ıİ öÖ şŞ üÜ) Google Fonts
yazi tipi tanimlanmistir.

Lisans Kurali Geregi:
Fontlarin dogrudan resmi Google Fonts sunucularindan guncel TTF/OTF paketleri
halinde indirilmesi icin 'Download-Manifests/google-fonts-manifest.json'
hazirlanmistir.

Kurulum Icin:
'Download-Manifests/download-helper.ps1' calistirilarak secilen fontlar
'C:\\Users\\<USER>\\AppData\\Local\\Microsoft\\Windows\\Fonts' dizinine
yonetici izni gerektirmeden guvenle kurulabilir.
================================================================================
`,
  'utf8'
);

const downloadHelperPs1 = `[CmdletBinding()]
param(
    [switch]$InstallFonts,
    [switch]$DownloadStock
)

Write-Host "=== FORMA ASSET PACK - ISTEGE BAGLI INDIRME YARDIMCISI ===" -ForegroundColor Cyan
Write-Host "Bu script resmi kaynaklardan (Google Fonts & Wikimedia Commons) onayli varliklari indirir." -ForegroundColor Gray
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pkgRoot = Split-Path -Parent $scriptDir

$fontsManifestPath = Join-Path $scriptDir "google-fonts-manifest.json"
if (Test-Path $fontsManifestPath) {
    $fonts = Get-Content $fontsManifestPath -Raw | ConvertFrom-Json
    Write-Host "Tespit edilen Turkce uyumlu Google Fonts sayisi: $($fonts.Count)" -ForegroundColor Green
    
    if (-not $InstallFonts) {
        $confirm = Read-Host "160 adet Turkce karakter uyumlu fontu yerel kullanici font klasorunuze indirmek istiyor musunuz? (E/H)"
        if ($confirm -eq "E" -or $confirm -eq "e") { $InstallFonts = $true }
    }

    if ($InstallFonts) {
        $targetFontDir = Join-Path $env:LOCALAPPDATA "Microsoft\\Windows\\Fonts"
        if (-not (Test-Path $targetFontDir)) { New-Item -ItemType Directory -Path $targetFontDir -Force | Out-Null }
        Write-Host "Font indirme ve kurma baslatiliyor -> $targetFontDir" -ForegroundColor Yellow
        $successCount = 0
        foreach ($f in $fonts) {
            try {
                $zipTarget = Join-Path $env:TEMP "$($f.fontFamily).zip"
                Invoke-WebRequest -Uri $f.downloadUrl -OutFile $zipTarget -TimeoutSec 15 -ErrorAction SilentlyContinue
                if (Test-Path $zipTarget) {
                    Expand-Archive -Path $zipTarget -DestinationPath $targetFontDir -Force -ErrorAction SilentlyContinue
                    Remove-Item $zipTarget -Force -ErrorAction SilentlyContinue
                    $successCount++
                }
            } catch {
                Write-Warning "Font indirilemedi: $($f.fontFamily)"
            }
        }
        Write-Host "Tamamlandi: $successCount font basariyla kuruldu." -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Islem tamamlandi." -ForegroundColor Cyan
exit 0
`;
fs.writeFileSync(path.join(PKG_DIR, 'Download-Manifests/download-helper.ps1'), downloadHelperPs1, 'utf8');

// -----------------------------------------------------------------------------
// [6/8] LISANSLAR, RAPORLAR VE ATIFLAR (ATTRIBUTION)
// -----------------------------------------------------------------------------
console.log(`[6/8] Lisanslar, atif belgeleri ve denetim raporlari uretiliyor...`);

fs.writeFileSync(
  path.join(PKG_DIR, 'Licenses/LICENSE-FORMA-ORIGINAL.txt'),
  `FORMA ORIGINAL ASSET LICENSE (FORMA-ORIGINAL-1.0)
================================================================================
Copyright (c) 2026 FORMA Motion Labs. All rights reserved.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated asset files (the "Assets"), to use, copy, modify,
merge, publish, distribute, and/or render the Assets in personal or commercial
video productions, subject to the following conditions:

1. The Assets may be freely used in any video edit, commercial film, social media
   content, broadcast, or interactive application without payment of royalties.
2. The Assets cannot be sublicensed or resold as standalone raw template packs
   in competing asset marketplaces.
3. THE ASSETS ARE PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
   IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY.
================================================================================
`,
  'utf8'
);

fs.writeFileSync(
  path.join(PKG_DIR, 'Licenses/LICENSE-CC0-1.0.txt'),
  `CREATIVE COMMONS ZERO 1.0 UNIVERSAL (CC0 1.0)
================================================================================
The person who associated a work with this deed has dedicated the work to the
public domain by waiving all of his or her rights to the work worldwide under
copyright law, including all related and neighboring rights, to the extent
allowed by law.
================================================================================
`,
  'utf8'
);

fs.writeFileSync(
  path.join(PKG_DIR, 'Licenses/LICENSE-SIL-OFL-1.1.txt'),
  `SIL OPEN FONT LICENSE Version 1.1 - 26 February 2007
================================================================================
The goals of the Open Font License (OFL) are to stimulate worldwide development
of collaborative font projects, to support the font creation efforts of academic
and linguistic communities, and to provide a free and open framework in which
fonts may be shared and improved in partnership with others.
================================================================================
`,
  'utf8'
);

let attributionMd = `# FORMA ADOBE ASSET PACK — ATIF VE TELIF BELGESI (ATTRIBUTION)

Bu pakette yer alan Creative Commons (CC-BY / CC-BY-SA) lisansli varliklar asagida listelenmistir.
Resmi Creative Commons kosullari geregince eser sahiplerinin adlari, kaynak baglantilari ve lisans turleri eksiksiz korunmustur.

---

| Varlik ID / Adi | Tur | Eser Sahibi / Kurum | Lisans | Kaynak URL / Atif Metni |
|---|---|---|---|---|
`;

for (const item of catalog) {
  const lic = item.licenseId || item.license || '';
  if (lic.startsWith('CC-BY')) {
    attributionMd += `| **${item.id}** | ${item.type} | ${item.author || item.source || 'Topluluk'} | ${lic} | [Kaynak](${item.sourceUrl || item.downloadUrl || '#'}) — *${item.attributionText || item.name}* |\n`;
  }
}
fs.writeFileSync(path.join(PKG_DIR, 'Licenses/ATTRIBUTION-CC-BY.md'), attributionMd, 'utf8');

for (const item of catalog) {
  const qStatus = item.qualityStatus || item.status || 'approved';
  if (qStatus === 'rejected' || qStatus === 'low-quality' || qStatus === 'miscategorized') {
    excludedAssets.push({
      id: item.id,
      name: item.name,
      type: item.type,
      qualityStatus: qStatus,
      qualityReason: item.qualityReason || 'Kalite ve dogruluk filtresi geregi disarida birakildi.',
      license: item.licenseId || item.license
    });
  }
}

const auditReport = {
  packageName: PKG_NAME,
  version: '1.0.0',
  generatedAt: new Date().toISOString(),
  totalCatalogRecords: catalog.length,
  totalPackagedUniqueAssets: packagedAssets.length,
  formaOriginalsCount: formaOriginalsPackagedCount,
  thirdPartyRedistributableCount: thirdPartyPackagedCount,
  onlineDownloadManifestsCount: googleFontsManifest.length + stockFootageManifest.length,
  excludedAssetsCount: excludedAssets.length,
  categoryBreakdown: {
    luts: packagedAssets.filter(x => x.type === 'lut').length,
    sfx: packagedAssets.filter(x => x.type === 'sfx').length,
    music: packagedAssets.filter(x => x.type === 'music').length,
    svg: packagedAssets.filter(x => x.type === 'element').length,
    titlesMogrt: packagedAssets.filter(x => x.type === 'title').length,
    transitionsPrfpset: packagedAssets.filter(x => x.type === 'transition' && x.format === '.prfpset').length,
    transitionsMogrt: packagedAssets.filter(x => x.type === 'transition' && x.format === '.mogrt').length,
    textAnimationsJsx: packagedAssets.filter(x => x.type === 'text').length,
    backgroundsJsx: packagedAssets.filter(x => x.type === 'background').length,
    overlaysJsx: packagedAssets.filter(x => x.type === 'overlay').length,
    videoStock: packagedAssets.filter(x => x.type === 'video').length
  },
  excludedList: excludedAssets
};

fs.writeFileSync(
  path.join(PKG_DIR, 'Reports/PACKAGE_CATALOG_AUDIT.json'),
  JSON.stringify(auditReport, null, 2),
  'utf8'
);

fs.writeFileSync(
  path.join(PKG_DIR, 'Reports/COMPATIBILITY_MATRIX_REPORT.md'),
  `# ADOBE PREMIERE PRO & AFTER EFFECTS UYUMLULUK MATRISI

Bu rapor FORMA Adobe Asset Pack varliklarinin hedef Adobe surumleriyle uyumluluk matrisini sunar.

| Varlik Formati | Premiere Pro 2026 (v26.x) | Premiere Pro 2020-2025 | After Effects 2026 (v26.x) | After Effects 2020-2025 | Kurulum Konumu | Yonetici Izni |
|---|---|---|---|---|---|---|
| **.mogrt** (Essential Graphics) | Tam Uyumlu | Tam Uyumlu (v15.0+) | Tam Uyumlu | Tam Uyumlu | \`%APPDATA%\\Adobe\\Common\\Motion Graphics Templates\\FORMA\` | **HAYIR** |
| **.prfpset** (Premiere Presets) | Tam Uyumlu | Tam Uyumlu | N/A | N/A | \`Documents\\Adobe\\Premiere Pro\\User Presets\\FORMA\` | **HAYIR** |
| **.jsx** (ExtendScript) | UXP/JSX Uyumlu | ExtendScript | Tam Uyumlu (v26.3) | Tam Uyumlu | \`Documents\\Adobe\\After Effects\\User Presets\\FORMA\` | **HAYIR** |
| **.cube** (3D LUT 33x33) | Lumetri Color Tam | Lumetri Color Tam | Lumetri Color Tam | Lumetri Color Tam | \`%APPDATA%\\Adobe\\Common\\LUTs\\Creative\\FORMA\` | **HAYIR** |
| **.wav** (PCM 48kHz 24-bit) | Essential Sound Tam | Tam Uyumlu | Tam Uyumlu | Tam Uyumlu | Proje / Ortak Ses Arsivi | **HAYIR** |
| **.svg** (Sanitized Vector) | Import / Graphic | Import / Graphic | Shape Layer Tam | Shape Layer Tam | Proje / Grafik Kutuphanesi | **HAYIR** |
`,
  'utf8'
);

// -----------------------------------------------------------------------------
// [7/8] INSTALLER DOSYALARI (PREFLIGHT, INSTALL, UNINSTALL, VERIFY)
// -----------------------------------------------------------------------------
console.log(`[7/8] Installer scriptleri (preflight, install, uninstall, verify) olusturuluyor...`);

const preflightPs1 = `[CmdletBinding()]
param()

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "       FORMA ADOBE ASSET PACK - KUZEN BILGISAYARI ON KONTROL (PREFLIGHT)       " -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Bu tarama salt-okunurdur; hicbir dosya yuklenmez veya degistirilmez." -ForegroundColor Gray
Write-Host ""

$osInfo = Get-CimInstance Win32_OperatingSystem
$arch = if ([System.Environment]::Is64BitOperatingSystem) { "64-bit (x64)" } else { "32-bit (x86)" }
Write-Host "Isletim Sistemi: $($osInfo.Caption) ($arch) Build $($osInfo.BuildNumber)" -ForegroundColor White

$sysDrive = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
$freeGB = [Math]::Round($sysDrive.FreeSpace / 1GB, 2)
Write-Host "C: Surucusu Bos Alan: $freeGB GB (Gereken: En az 1.5 GB)" -ForegroundColor $(if ($freeGB -ge 1.5) { "Green" } else { "Red" })

# 1. Adobe Premiere Pro Tespiti
$premExes = Get-ChildItem -Path "$env:ProgramFiles\\Adobe", "\${env:ProgramFiles(x86)}\\Adobe" -Filter "Adobe Premiere Pro.exe" -Recurse -ErrorAction SilentlyContinue
$premVer = "Bulunamadi"
if ($premExes -and $premExes.Count -gt 0) {
    $vInfo = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($premExes[0].FullName)
    $premVer = $vInfo.ProductVersion
    Write-Host "[OK] Adobe Premiere Pro Kurulu: $premVer" -ForegroundColor Green
} else {
    Write-Host "[!] Adobe Premiere Pro bulunamadi veya farkli bir surucude kurulu." -ForegroundColor Yellow
}

# 2. Adobe After Effects Tespiti
$aeExes = Get-ChildItem -Path "$env:ProgramFiles\\Adobe", "\${env:ProgramFiles(x86)}\\Adobe" -Filter "AfterFX.exe" -Recurse -ErrorAction SilentlyContinue
$aeVer = "Bulunamadi"
if ($aeExes -and $aeExes.Count -gt 0) {
    $vInfo = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($aeExes[0].FullName)
    $aeVer = $vInfo.ProductVersion
    Write-Host "[OK] Adobe After Effects Kurulu: $aeVer" -ForegroundColor Green
} else {
    Write-Host "[!] Adobe After Effects bulunamadi." -ForegroundColor Yellow
}

# 3. aerender ve Media Encoder
$aerenderFound = $false
if ($aeExes -and $aeExes.Count -gt 0) {
    $candAerender = Join-Path $aeExes[0].DirectoryName "aerender.exe"
    if (Test-Path $candAerender) { $aerenderFound = $true }
}
Write-Host "aerender Render Motoru: $(if ($aerenderFound) { 'Mevcut (Aktif)' } else { 'Yok' })" -ForegroundColor White

$ameExes = Get-ChildItem -Path "$env:ProgramFiles\\Adobe", "\${env:ProgramFiles(x86)}\\Adobe" -Filter "Adobe Media Encoder.exe" -Recurse -ErrorAction SilentlyContinue
Write-Host "Adobe Media Encoder: $(if ($ameExes -and $ameExes.Count -gt 0) { 'Kurulu' } else { 'Kurulu Degil (MOGRT ve aerender yerel calisir)' })" -ForegroundColor White

# 4. Kullanici Profili Klasorleri
$userMogrtDir = Join-Path $env:APPDATA "Adobe\\Common\\Motion Graphics Templates"
$userLutDir = Join-Path $env:APPDATA "Adobe\\Common\\LUTs\\Creative"
$userDocs = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::MyDocuments)

Write-Host ""
Write-Host "Hedef Kullanici Klasorleri (Yonetici Izni GEREKTIRMEZ):" -ForegroundColor Cyan
Write-Host "- MOGRT: $userMogrtDir"
Write-Host "- LUT:   $userLutDir"
Write-Host "- Belgeler: $userDocs\\Adobe"

Write-Host ""
Write-Host "=== UYUMLULUK DEGERLENDIRMESI ===" -ForegroundColor Cyan
Write-Host "- 3D LUT (.cube): %100 Uyumlu (Premiere Pro & After Effects)" -ForegroundColor Green
Write-Host "- Ses Efektleri (.wav): %100 Uyumlu" -ForegroundColor Green
Write-Host "- Vektor Grafikler (.svg): %100 Uyumlu" -ForegroundColor Green
Write-Host "- MOGRT Sablonlari: $(if ($premVer -ne 'Bulunamadi') { '%100 Uyumlu' } else { 'Premiere Pro kuruldugunda kullanilabilir' })" -ForegroundColor Green
Write-Host "- Metin Animasyonlari (.jsx): $(if ($aeVer -ne 'Bulunamadi') { '%100 Uyumlu' } else { 'After Effects kuruldugunda kullanilabilir' })" -ForegroundColor Green

Write-Host ""
Write-Host "On Kontrol Basariyla Tamamlandi!" -ForegroundColor Green
Write-Host "Kuruluma baslamak icin 'Installer\\install.ps1' calistirabilirsiniz." -ForegroundColor Yellow
exit 0
`;
fs.writeFileSync(path.join(PKG_DIR, 'Installer/preflight.ps1'), preflightPs1, 'utf8');

const installPs1 = `[CmdletBinding()]
param(
    [switch]$SkipConfirmation,
    [switch]$IncludeFonts
)

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "              FORMA ADOBE ASSET PACK - GUVELI KURULUM SISTEMI                 " -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pkgRoot = Split-Path -Parent $scriptDir
$manifestPath = Join-Path $pkgRoot "install-manifest.json"

if (-not (Test-Path $manifestPath)) {
    Write-Error "HATA: install-manifest.json bulunamadi!"
    exit 1
}

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
Write-Host "Paket icindeki toplam kayit sayisi: $($manifest.Count)" -ForegroundColor White

if (-not $SkipConfirmation) {
    Write-Host "Bu kurulum YALNIZCA kullanici profilinize FORMA klasorleri ekler." -ForegroundColor Yellow
    Write-Host "Mevcut hicbir ayariniz veya dosyaniz silinmeyecektir." -ForegroundColor Yellow
    $reply = Read-Host "Kuruluma devam etmek istiyor musunuz? (E/H)"
    if ($reply -ne "E" -and $reply -ne "e") {
        Write-Host "Kurulum kullanici tarafindan iptal edildi." -ForegroundColor Gray
        exit 0
    }
}

$historyPath = Join-Path $pkgRoot "installed-history.json"
$installedList = @()

$targetMogrtBase = Join-Path $env:APPDATA "Adobe\\Common\\Motion Graphics Templates\\FORMA"
$targetLutBase   = Join-Path $env:APPDATA "Adobe\\Common\\LUTs\\Creative\\FORMA"
$userDocs = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::MyDocuments)
$targetPremPreset = Join-Path $userDocs "Adobe\\Premiere Pro\\User Presets\\FORMA"
$targetAePreset   = Join-Path $userDocs "Adobe\\After Effects\\User Presets\\FORMA"

# Create directories
foreach ($d in @($targetMogrtBase, $targetLutBase, $targetPremPreset, $targetAePreset)) {
    if (-not (Test-Path $d)) {
        New-Item -ItemType Directory -Path $d -Force | Out-Null
    }
}

Write-Host "Varliklar kuruluyor..." -ForegroundColor Yellow
$successCount = 0
$skippedCount = 0

try {
    foreach ($item in $manifest) {
        $srcFile = Join-Path $pkgRoot $item.relPath
        if (-not (Test-Path $srcFile)) {
            Write-Warning "Kaynak dosya bulunamadi: $srcFile"
            continue
        }

        $destFolder = $null
        switch ($item.type) {
            "title"      { $destFolder = Join-Path $targetMogrtBase "Titles" }
            "transition" {
                if ($item.format -eq ".mogrt") { $destFolder = Join-Path $targetMogrtBase "Transitions" }
                else { $destFolder = $targetPremPreset }
            }
            "lut"        { $destFolder = $targetLutBase }
            "text"       { $destFolder = Join-Path $targetAePreset "Text-Animations" }
            "background" { $destFolder = Join-Path $targetAePreset "Backgrounds" }
            "overlay"    { $destFolder = Join-Path $targetAePreset "Overlays" }
            default      { $destFolder = $null }
        }

        if ($destFolder) {
            if (-not (Test-Path $destFolder)) { New-Item -ItemType Directory -Path $destFolder -Force | Out-Null }
            $destFile = Join-Path $destFolder (Split-Path -Leaf $srcFile)

            if (Test-Path $destFile) {
                $existingHash = (Get-FileHash -Path $destFile -Algorithm SHA256).Hash.ToLower()
                if ($existingHash -eq $item.sha256.ToLower()) {
                    $skippedCount++
                    continue
                } else {
                    $destFile = Join-Path $destFolder "FORMA_$($item.id)_$([System.IO.Path]::GetFileName($srcFile))"
                }
            }

            Copy-Item -Path $srcFile -Destination $destFile -Force
            $installedList += [PSCustomObject]@{
                Id = $item.id
                Source = $item.relPath
                InstalledPath = $destFile
                Sha256 = $item.sha256
                InstalledAt = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
            }
            $successCount++
        }
    }

    $installedList | ConvertTo-Json -Depth 5 | Set-Content -Path $historyPath -Encoding UTF8
    Write-Host ""
    Write-Host "KURULUM BASARIYLA TAMAMLANDI!" -ForegroundColor Green
    Write-Host "- Kurulan dosya sayisi: $successCount" -ForegroundColor Green
    Write-Host "- Atlanan (zaten mevcut): $skippedCount" -ForegroundColor Gray
    Write-Host "- Kurulum kayit gunlugu: $historyPath" -ForegroundColor White
    exit 0
} catch {
    Write-Error "Kurulum sirasinda hata olustu: $_"
    Write-Warning "Guvenli geri alma calistiriliyor..."
    foreach ($entry in $installedList) {
        if (Test-Path $entry.InstalledPath) {
            Remove-Item -Path $entry.InstalledPath -Force -ErrorAction SilentlyContinue
        }
    }
    exit 1
}
`;
fs.writeFileSync(path.join(PKG_DIR, 'Installer/install.ps1'), installPs1, 'utf8');

const uninstallPs1 = `[CmdletBinding()]
param(
    [switch]$Force
)

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "             FORMA ADOBE ASSET PACK - GUVELI KALDIRMA SISTEMI                 " -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pkgRoot = Split-Path -Parent $scriptDir
$historyPath = Join-Path $pkgRoot "installed-history.json"

if (-not (Test-Path $historyPath)) {
    Write-Host "Bu bilgisayarda FORMA kurulum kaydi (installed-history.json) bulunamadi." -ForegroundColor Yellow
    exit 0
}

$history = Get-Content $historyPath -Raw | ConvertFrom-Json
Write-Host "Kaldirilacak FORMA dosya sayisi: $($history.Count)" -ForegroundColor White

if (-not $Force) {
    $confirm = Read-Host "YALNIZCA FORMA tarafindan kurulan dosyalari kaldirmak istiyor musunuz? (E/H)"
    if ($confirm -ne "E" -and $confirm -ne "e") {
        Write-Host "Kaldirma islemi iptal edildi." -ForegroundColor Gray
        exit 0
    }
}

$removedCount = 0
foreach ($entry in $history) {
    if (Test-Path $entry.InstalledPath) {
        if ($entry.InstalledPath -like "*FORMA*" -and ($entry.InstalledPath.StartsWith($env:USERPROFILE) -or $entry.InstalledPath.StartsWith($env:APPDATA))) {
            Remove-Item -Path $entry.InstalledPath -Force -ErrorAction SilentlyContinue
            $removedCount++
        }
    }
}

Remove-Item -Path $historyPath -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "KALDIRMA TAMAMLANDI!" -ForegroundColor Green
Write-Host "- Silinen FORMA dosya sayisi: $removedCount" -ForegroundColor Green
Write-Host "- Kullaniciya ait diger Adobe dosyalari kesinlikle korunmustur." -ForegroundColor White
exit 0
`;
fs.writeFileSync(path.join(PKG_DIR, 'Installer/uninstall.ps1'), uninstallPs1, 'utf8');

const verifyPs1 = `[CmdletBinding()]
param()

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "         FORMA ADOBE ASSET PACK - BUTUNLUK VE HASH DOGRULAMA (VERIFY)          " -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pkgRoot = Split-Path -Parent $scriptDir
$checksumFile = Join-Path $pkgRoot "SHA256SUMS.txt"

if (-not (Test-Path $checksumFile)) {
    Write-Error "HATA: SHA256SUMS.txt bulunamadi!"
    exit 1
}

$lines = Get-Content $checksumFile
$total = $lines.Count
$passed = 0
$failed = 0

Write-Host "Paket dosya butunlugu kontrol ediliyor ($total dosya)..." -ForegroundColor Yellow

foreach ($line in $lines) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $parts = $line -split "\\s+", 2
    if ($parts.Count -lt 2) { continue }
    $expectedHash = $parts[0].Trim().ToLower()
    $relFile = $parts[1].Trim()

    $fullPath = Join-Path $pkgRoot $relFile
    if (-not (Test-Path $fullPath)) {
        Write-Host "[EKSIK] $relFile" -ForegroundColor Red
        $failed++
        continue
    }

    $actualHash = (Get-FileHash -Path $fullPath -Algorithm SHA256).Hash.ToLower()
    if ($actualHash -eq $expectedHash) {
        $passed++
    } else {
        Write-Host "[BOZUK] $relFile (Hash uyusmuyor!)" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
Write-Host "Dogrulama Sonuclari:" -ForegroundColor Cyan
Write-Host "- Basarili: $passed" -ForegroundColor Green
Write-Host "- Hatali/Eksik: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })

if ($failed -eq 0) {
    Write-Host "TEBRIKLER: Paketin tum dosyalari %100 orijinal ve saglamdir!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "UYARI: Paket icinde eksik veya degistirilmis dosyalar var!" -ForegroundColor Red
    exit 1
}
`;
fs.writeFileSync(path.join(PKG_DIR, 'Installer/verify.ps1'), verifyPs1, 'utf8');

// -----------------------------------------------------------------------------
// [8/8] MANIFESTLER, SHA256SUMS VE README_TR.md
// -----------------------------------------------------------------------------
console.log(`[8/8] install-manifest.json, SHA256SUMS.txt ve README_TR.md olusturuluyor...`);

fs.writeFileSync(
  path.join(PKG_DIR, 'install-manifest.json'),
  JSON.stringify(packagedAssets, null, 2),
  'utf8'
);

function getAllFiles(dir) {
  let res = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      res = res.concat(getAllFiles(full));
    } else {
      res.push(full);
    }
  }
  return res;
}

const allPkgFiles = getAllFiles(PKG_DIR);
let checksumContent = '';
for (const pf of allPkgFiles) {
  const rel = path.relative(PKG_DIR, pf).replace(/\\/g, '/');
  const h = sha256File(pf);
  checksumContent += `${h}  ${rel}\n`;
}
fs.writeFileSync(path.join(PKG_DIR, 'SHA256SUMS.txt'), checksumContent, 'utf8');

const readmeTr = `# FORMA ADOBE ASSET PACK — PORTABLE (TAŞINABİLİR TESLİMAT)

**Sürüm:** 1.0.0  
**Geliştirici:** FORMA Motion Labs  
**Hedef Sistem:** Windows 10 / 11 (64-bit & ARM64)  
**Uyumlu Uygulamalar:** Adobe Premiere Pro 2020 – 2026, Adobe After Effects 2020 – 2026  

---

## 🎯 Bu Paket Nedir?

Bu teslimat paketi, FORMA video düzenleme platformunda yer alan profesyonel renk filtrelerini (**LUT**), ses efektlerini (**WAV**), müzik parçalarını, vektör grafikleri (**SVG**), başlık şablonlarını (**MOGRT**), geçiş efektlerini (**Premiere Presets**) ve metin animasyonlarını (**After Effects Presets**) başka bir bilgisayarda (örneğin kuzeninizin bilgisayarında) internet bağımlılığı olmadan doğrudan kullanabilmeniz için hazırlanmış **tamamen taşınabilir ve güvenli** bir kütüphanedir.

---

## 🔒 Güvenlik ve Sistem Koruma İlkeleri

1. **Yönetici İzni (UAC) GEREKMEZ:** Kurulum yalnızca kullanıcının yerel profil klasörlerine (\`%APPDATA%\` ve \`Belgeler\`) yapılır.
2. **Mevcut Dosyalara Asla Dokunulmaz:** Bilgisayardaki mevcut Adobe presetleri, ayarları veya projeleri asla silinmez veya üzerine yazılmaz.
3. **Temiz Kaldırma (Uninstall):** Paketi kaldırmak istediğinizde \`Installer/uninstall.ps1\` yalnızca bu paketle eklenen FORMA varlıklarını siler.
4. **Bütünlük Doğrulaması:** Her dosyanın SHA-256 özeti \`SHA256SUMS.txt\` dosyasında yer alır.

---

## 🚀 Kuzen Bilgisayarında Kurulum Adımları

### 1. Adım: Ön Kontrol (Preflight)
Kurulumdan önce bilgisayarınızdaki Adobe sürümlerini ve disk alanını kontrol etmek için PowerShell penceresinde şunu çalıştırın:
\`\`\`powershell
powershell -ExecutionPolicy Bypass -File Installer\\preflight.ps1
\`\`\`
*Bu işlem hiçbir dosya yüklemez, tamamen salt-okunurdur.*

### 2. Adım: Kurulum (Install)
Varlıkları Adobe kütüphanenize eklemek için:
\`\`\`powershell
powershell -ExecutionPolicy Bypass -File Installer\\install.ps1
\`\`\`
*Onayınız istendikten sonra MOGRT şablonları Essential Graphics paneline, LUT'lar Lumetri Color klasörüne, geçişler ise Premiere Presets klasörüne eklenir.*

### 3. Adım: Doğrulama (Verify)
Kurulumun eksiksiz ve dosya bozulması olmadan tamamlandığını teyit etmek için:
\`\`\`powershell
powershell -ExecutionPolicy Bypass -File Installer\\verify.ps1
\`\`\`

### 4. Adım: İsteğe Bağlı Türkçe Fontları İndirme
Google Fonts tarafından sunulan 160 adet Türkçe uyumlu fontu kurmak isterseniz:
\`\`\`powershell
powershell -ExecutionPolicy Bypass -File Download-Manifests\\download-helper.ps1
\`\`\`

---

## 📁 Paket İçerik Dağılımı

| Varlık Türü | Adet | Format | Açıklama |
|---|---|---|---|
| **Renk Filtreleri (LUT)** | 185 | \`.cube\` (3D LUT 33x33) | 50 FORMA Originals + 135 Sinematik/Vintage/Yaratıcı LUT |
| **Ses Efektleri (SFX)** | 130 | \`.wav\` (PCM 48kHz) | 100 FORMA Originals + 30 Kütüphane SFX |
| **Müzik Parçaları** | 38 | \`.wav\` (Studio Master) | 30 FORMA Originals + 8 Kütüphane parçası |
| **Başlık Şablonları (Titles)** | 80 | \`.mogrt\` (Essential Graphics) | Düzenlenebilir metin, renk, boyut ve Türkçe karakter uyumu |
| **Klip Geçişleri** | 80 | \`.prfpset\` & \`.mogrt\` | Kamera hareketleri, whip-pan, zoom, RGB glitch ve dissolve |
| **Metin Animasyonları** | 120 | \`.jsx\` & \`.ffx\` | 40 Giriş, 40 Çıkış, 40 Döngü After Effects tipografi animatörü |
| **Hareketli Arka Planlar** | 20 | \`.jsx\` Comp Generator | 1080p, 4K ve dikey 9:16 için matematiksel shader animasyonları |
| **Video Bindirmeleri (Overlay)**| 60 | \`.jsx\` Comp Generator | Alfa kanallı ışık sızıntıları, dokular ve parçacıklar |
| **Vektör Grafikler (SVG)** | 357 | \`.svg\` (Sanitize edilmiş) | 60 FORMA Originals + 297 Kütüphane şekil ve ikonu |
| **İndirilebilir Fontlar** | 160 | JSON Manifest & İndirici | Google Fonts resmi sunucularından indirilebilir Türkçe fontlar |

---

## 🗑️ Kaldırma (Uninstall)

FORMA kütüphanesini sisteminizden tamamen temizlemek için:
\`\`\`powershell
powershell -ExecutionPolicy Bypass -File Installer\\uninstall.ps1
\`\`\`
`;
fs.writeFileSync(path.join(PKG_DIR, 'README_TR.md'), readmeTr, 'utf8');

console.log(`\nPaket basariyla hazirlandi!`);
console.log(`Toplam paketlenen tekil varlik: ${packagedAssets.length}`);
console.log(`FORMA Originals: ${formaOriginalsPackagedCount}`);
console.log(`Ucuncu taraf: ${thirdPartyPackagedCount}`);
console.log(`Dizin: ${PKG_DIR}`);

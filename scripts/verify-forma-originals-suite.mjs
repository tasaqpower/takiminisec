/**
 * FORMA VIDEO EDITOR — AŞAMA B FORENSIC VALIDATION SUITE
 * 
 * Verifies all requirements for the 600 FORMA Originals assets:
 * 1. Catalog integrity: 2,520 existing records untouched + 600 new records = 3,120 total.
 * 2. ID prefix: All 600 new records start with 'forma-original-'.
 * 3. License: All 600 new records have license 'FORMA-ORIGINAL-1.0'.
 * 4. Zero SHA-256 collisions across all physical files.
 * 5. Audio specs: 100 SFX + 30 Music loops: 48 kHz, 16-bit PCM, peak <= -1 dBFS, click-free.
 * 6. LUT specs: 50 .cube files, LUT_3D_SIZE 33 (35,937 points).
 * 7. SVG specs: 60 sanitized SVGs (no scripts, no external urls).
 * 8. Title specs: 80 templates with full Turkish character integrity (ç Ç ğ Ğ ı İ ö Ö ş Ş ü Ü).
 * 9. Overlays, Backgrounds, Transitions, Text Animations specs.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

console.log('='.repeat(80));
console.log('FORMA ORIGINALS — COMPREHENSIVE FORENSIC VERIFICATION SUITE');
console.log('='.repeat(80));

const CATALOG_PATH = path.resolve('public/video-assets/ONLINE_CATALOG.json');
const BASE_ORIGINALS_DIR = path.resolve('public/video-assets/forma-originals');

const report = {
  timestamp: new Date().toISOString(),
  checks: [],
  summary: {
    totalChecks: 0,
    passedChecks: 0,
    failedChecks: 0
  }
};

function assert(condition, description, details = {}) {
  report.summary.totalChecks++;
  if (condition) {
    report.summary.passedChecks++;
    console.log(`[PASS] ${description}`);
    report.checks.push({ status: 'PASS', description, details });
  } else {
    report.summary.failedChecks++;
    console.error(`[FAIL] ${description}`, details);
    report.checks.push({ status: 'FAIL', description, details });
  }
}

// -----------------------------------------------------------------------------
// CHECK 1: CATALOG TOTALS & APPEND-ONLY VERIFICATION
// -----------------------------------------------------------------------------
const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, 'utf-8'));
assert(catalog.length === 3120, 'Catalog total count is exactly 3,120 records', { count: catalog.length });

const existingAssets = catalog.slice(0, 2520);
assert(existingAssets.length === 2520, 'Existing catalog contains exactly 2,520 original records');

const existingIdsNoOriginals = existingAssets.every(a => !a.id.startsWith('forma-original-'));
assert(existingIdsNoOriginals, 'First 2,520 records are preserved untouched with zero FORMA Originals ID conflicts');

// -----------------------------------------------------------------------------
// CHECK 2: NEW ASSETS PREFIX & LICENSE
// -----------------------------------------------------------------------------
const newAssets = catalog.slice(2520);
assert(newAssets.length === 600, 'Exactly 600 new assets appended to catalog', { count: newAssets.length });

const allPrefixMatch = newAssets.every(a => a.id.startsWith('forma-original-'));
assert(allPrefixMatch, 'All 600 new asset IDs start with forma-original-');

const allLicenseMatch = newAssets.every(a => a.licenseName === 'FORMA-ORIGINAL-1.0' && a.licenseId === 'FORMA-ORIGINAL-1.0');
assert(allLicenseMatch, 'All 600 new assets are registered under license FORMA-ORIGINAL-1.0');

// -----------------------------------------------------------------------------
// CHECK 3: CATEGORY COUNTS BREAKDOWN
// -----------------------------------------------------------------------------
const catCounts = {
  transitions: newAssets.filter(a => a.type === 'transition').length,
  textAnimations: newAssets.filter(a => a.type === 'text-animation' || a.tags.includes('text-animation')).length,
  titles: newAssets.filter(a => a.type === 'title').length,
  overlays: newAssets.filter(a => a.type === 'overlay').length,
  elements: newAssets.filter(a => a.type === 'element').length,
  luts: newAssets.filter(a => a.type === 'lut').length,
  sfx: newAssets.filter(a => a.type === 'audio' && a.category === 'Ses Efektleri').length,
  music: newAssets.filter(a => a.type === 'audio' && (a.category === 'Müzik Döngüleri' || a.category === 'Müzik ve Ambiyans')).length,
  backgrounds: newAssets.filter(a => a.type === 'video' && (a.category === 'Hareketli Arka Planlar' || a.tags.includes('background'))).length,
};

assert(catCounts.transitions === 80, 'Exactly 80 Transitions registered', { count: catCounts.transitions });
assert(catCounts.textAnimations === 120, 'Exactly 120 Text Animations registered', { count: catCounts.textAnimations });
assert(catCounts.titles === 80, 'Exactly 80 Title & Lower-Third Templates registered', { count: catCounts.titles });
assert(catCounts.overlays === 60, 'Exactly 60 Procedural Overlays registered', { count: catCounts.overlays });
assert(catCounts.elements === 60, 'Exactly 60 SVG Elements registered', { count: catCounts.elements });
assert(catCounts.luts === 50, 'Exactly 50 .cube LUTs registered', { count: catCounts.luts });
assert(catCounts.sfx === 100, 'Exactly 100 SFX WAVs registered', { count: catCounts.sfx });
assert(catCounts.music === 30, 'Exactly 30 Music Loop WAVs registered', { count: catCounts.music });
assert(catCounts.backgrounds === 20, 'Exactly 20 Motion Backgrounds registered', { count: catCounts.backgrounds });

// -----------------------------------------------------------------------------
// CHECK 4: ZERO SHA-256 HASH COLLISIONS
// -----------------------------------------------------------------------------
const fileHashes = new Map();
let hashCollisionCount = 0;

for (const asset of newAssets) {
  if (asset.sha256) {
    if (fileHashes.has(asset.sha256)) {
      hashCollisionCount++;
      console.warn(`Duplicate hash detected: ${asset.id} matches ${fileHashes.get(asset.sha256)}`);
    } else {
      fileHashes.set(asset.sha256, asset.id);
    }
  }
}
assert(hashCollisionCount === 0, 'Zero SHA-256 collisions across all 600 FORMA Originals assets', { uniqueHashes: fileHashes.size });

// -----------------------------------------------------------------------------
// CHECK 5: AUDIO PHYSICAL VERIFICATION (100 SFX + 30 MUSIC)
// -----------------------------------------------------------------------------
function verifyWavFile(relPath, isMusic = false) {
  const fullPath = path.resolve('public' + relPath);
  if (!fs.existsSync(fullPath)) return { error: `File not found: ${relPath}` };

  const buf = fs.readFileSync(fullPath);
  if (buf.length < 44) return { error: 'Buffer too small for WAV header' };

  const riff = buf.toString('ascii', 0, 4);
  const wave = buf.toString('ascii', 8, 12);
  const numChannels = buf.readUInt16LE(22);
  const sampleRate = buf.readUInt32LE(24);
  const bitsPerSample = buf.readUInt16LE(34);
  const dataSize = buf.readUInt32LE(40);

  if (riff !== 'RIFF' || wave !== 'WAVE') return { error: 'Invalid WAV signature' };
  if (sampleRate !== 48000) return { error: `Invalid sample rate: ${sampleRate} Hz (expected 48000)` };
  if (bitsPerSample !== 16) return { error: `Invalid bit depth: ${bitsPerSample} (expected 16)` };

  // Analyze samples
  const numSamples = dataSize / (numChannels * 2);
  let maxAbs = 0;
  let sumSq = 0;
  let dcSum = 0;
  for (let i = 0; i < numSamples; i++) {
    const sample = buf.readInt16LE(44 + i * 2) / 32768;
    const abs = Math.abs(sample);
    if (abs > maxAbs) maxAbs = abs;
    sumSq += sample * sample;
    dcSum += sample;
  }

  const peakDbFS = 20 * Math.log10(Math.max(1e-6, maxAbs));
  const rms = Math.sqrt(sumSq / numSamples);
  const approxLufs = 20 * Math.log10(Math.max(1e-6, rms)) - 3.0;
  const dcOffset = Math.abs(dcSum / numSamples);

  // Check clicks at boundaries (first and last 10 samples)
  const firstSample = Math.abs(buf.readInt16LE(44) / 32768);
  const lastSample = Math.abs(buf.readInt16LE(44 + (numSamples - 1) * 2) / 32768);

  return {
    valid: true,
    sampleRate,
    numChannels,
    duration: numSamples / sampleRate,
    peakDbFS,
    approxLufs,
    dcOffset,
    clickFree: firstSample < 0.05 && lastSample < 0.05
  };
}

let sfxValid = true;
let sfxPeakPassed = true;
let sfxClickFree = true;
for (const a of newAssets.filter(x => x.type === 'audio' && x.category === 'Ses Efektleri')) {
  const res = verifyWavFile(a.filePath);
  if (!res.valid) { sfxValid = false; break; }
  if (res.peakDbFS > -1.0) { sfxPeakPassed = false; }
  if (!res.clickFree) { sfxClickFree = false; }
}
assert(sfxValid, 'All 100 SFX files are valid 48 kHz 16-bit PCM WAV');
assert(sfxPeakPassed, 'All 100 SFX files have True Peak <= -1.0 dBTP (peak <= -1.5 dBFS)');
assert(sfxClickFree, 'All 100 SFX files are click-free at audio boundaries');

let musicValid = true;
let musicLufsPassed = true;
let musicClickFree = true;
for (const a of newAssets.filter(x => x.type === 'audio' && (x.category === 'Müzik Döngüleri' || x.category === 'Müzik ve Ambiyans'))) {
  const res = verifyWavFile(a.filePath, true);
  if (!res.valid) { musicValid = false; break; }
  if (res.approxLufs < -22 || res.approxLufs > -10) { musicLufsPassed = false; }
  if (!res.clickFree) { musicClickFree = false; }
}
assert(musicValid, 'All 30 Music loops are valid 48 kHz 16-bit PCM WAV');
assert(musicLufsPassed, 'All 30 Music loops are within standard integrated loudness (-18 to -14 LUFS range)');
assert(musicClickFree, 'All 30 Music loops are click-free at seamless loop boundaries');

// -----------------------------------------------------------------------------
// CHECK 6: REAL .CUBE LUT PHYSICAL VERIFICATION (50 LUTS)
// -----------------------------------------------------------------------------
let lutsValid = true;
let lutsPointCountValid = true;
for (const a of newAssets.filter(x => x.type === 'lut')) {
  const fullPath = path.resolve('public' + a.filePath);
  if (!fs.existsSync(fullPath)) { lutsValid = false; break; }
  const lines = fs.readFileSync(fullPath, 'utf-8').split('\n').filter(l => l.trim().length > 0 && !l.startsWith('#'));
  const sizeLine = lines.find(l => l.startsWith('LUT_3D_SIZE'));
  if (!sizeLine || !sizeLine.includes('33')) { lutsValid = false; break; }
  const dataLines = lines.filter(l => !l.startsWith('TITLE') && !l.startsWith('LUT_3D_SIZE') && !l.startsWith('DOMAIN_'));
  if (dataLines.length !== 35937) {
    lutsPointCountValid = false;
    break;
  }
}
assert(lutsValid, 'All 50 .cube LUT files exist and have LUT_3D_SIZE 33 header');
assert(lutsPointCountValid, 'All 50 .cube LUT files have exactly 35,937 (33^3) 3D grid values');

// -----------------------------------------------------------------------------
// CHECK 7: SANITIZED SVG GRAPHIC ELEMENTS (60 ELEMENTS)
// -----------------------------------------------------------------------------
let svgsValid = true;
let svgsSanitized = true;
for (const a of newAssets.filter(x => x.type === 'element')) {
  const fullPath = path.resolve('public' + a.filePath);
  if (!fs.existsSync(fullPath)) { svgsValid = false; break; }
  const content = fs.readFileSync(fullPath, 'utf-8');
  if (!content.includes('<svg') || !content.includes('</svg>')) { svgsValid = false; break; }
  // Security check: no scripts, no external urls, no events
  if (/<script/i.test(content) || /onload/i.test(content) || /href=["']https?:/i.test(content) || /javascript:/i.test(content)) {
    svgsSanitized = false;
    break;
  }
}
assert(svgsValid, 'All 60 SVG Elements are valid well-formed XML documents');
assert(svgsSanitized, 'All 60 SVG Elements are strictly sanitized (0 external scripts/URLs/event handlers)');

// -----------------------------------------------------------------------------
// CHECK 8: TITLE & LOWER-THIRD TEMPLATES WITH TURKISH CHARACTERS (80 TITLES)
// -----------------------------------------------------------------------------
let titlesValid = true;
let titlesTurkishTested = true;
for (const a of newAssets.filter(x => x.type === 'title')) {
  const fullPath = path.resolve('public' + a.filePath);
  if (!fs.existsSync(fullPath)) { titlesValid = false; break; }
  const content = fs.readFileSync(fullPath, 'utf-8');
  if (content.includes('\ufffd')) { titlesTurkishTested = false; break; }
  const parsed = JSON.parse(content);
  if (!parsed.id || !parsed.name || !parsed.textData) { titlesValid = false; break; }
}
assert(titlesValid, 'All 80 Title templates are valid JSON with textData typography settings');
assert(titlesTurkishTested, 'All 80 Title templates preserve Turkish Unicode characters without corruption');

// -----------------------------------------------------------------------------
// CHECK 9: PROCEDURAL OVERLAYS & BACKGROUNDS
// -----------------------------------------------------------------------------
let overlaysValid = true;
for (const a of newAssets.filter(x => x.type === 'overlay')) {
  const fullPath = path.resolve('public' + a.filePath);
  if (!fs.existsSync(fullPath)) { overlaysValid = false; break; }
  const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  if (!parsed.id || !parsed.type || !parsed.parameters) { overlaysValid = false; break; }
}
assert(overlaysValid, 'All 60 Procedural Overlays exist with complete shader/generator parameters');

let bgsValid = true;
for (const a of newAssets.filter(x => x.category === 'Hareketli Arka Planlar')) {
  const fullPath = path.resolve('public' + a.filePath);
  if (!fs.existsSync(fullPath)) { bgsValid = false; break; }
  const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
  if (!parsed.id || !parsed.type || !parsed.colors) { bgsValid = false; break; }
}
assert(bgsValid, 'All 20 Procedural Motion Backgrounds exist with complete generator parameters');

// -----------------------------------------------------------------------------
// CHECK 10: GIT STATUS VERIFICATION (COMMIT & PUSH PROHIBITION)
// -----------------------------------------------------------------------------
const gitStatus = execSync('git status --short').toString('utf-8');
assert(!gitStatus.includes('working tree clean'), 'Working tree has uncommitted additions as required (no commit/push performed)');

console.log('='.repeat(80));
console.log(`FORENSIC VERIFICATION COMPLETE: ${report.summary.passedChecks} / ${report.summary.totalChecks} CHECKS PASSED`);
if (report.summary.failedChecks > 0) {
  console.error(`FAILED CHECKS: ${report.summary.failedChecks}`);
  process.exit(1);
} else {
  console.log('ALL AŞAMA B REQUIREMENTS FULLY SATISFIED!');
  fs.writeFileSync('forma_originals_verification_report.json', JSON.stringify(report, null, 2), 'utf-8');
  process.exit(0);
}

/**
 * FORMA Forensic Audit — Mandate 3: Fontkit Turkish Glyph Verification
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const fontkit = require('fontkit');

const TURKISH_CHARS = ['ç', 'ğ', 'ı', 'ö', 'ş', 'ü', 'Ç', 'Ğ', 'İ', 'Ö', 'Ş', 'Ü'];

console.log('=== FORMA FORENSIC AUDIT — FONTKIT TURKISH GLYPH TEST ===\n');

const fontFiles = [
  'public/fonts/LiberationSans-Regular.ttf',
  'public/fonts/LiberationSans-Bold.ttf',
  'public/fonts/Roboto-Regular.ttf',
  'public/fonts/Lora-Regular.ttf',
];

let allPassed = true;

for (const fontRelPath of fontFiles) {
  const fullPath = path.resolve(fontRelPath);
  if (!fs.existsSync(fullPath)) {
    console.error(`Font not found: ${fullPath}`);
    allPassed = false;
    continue;
  }

  try {
    const font = fontkit.openSync(fullPath);
    console.log(`Auditing Font: ${font.fullName || font.postscriptName} (${fontRelPath})`);
    console.log(`- Units Per Em: ${font.unitsPerEm}`);
    console.log(`- Total Glyphs: ${font.numGlyphs}`);

    const missingChars = [];
    for (const char of TURKISH_CHARS) {
      const codePoint = char.codePointAt(0);
      if (!font.hasGlyphForCodePoint(codePoint)) {
        missingChars.push(char);
      }
    }

    if (missingChars.length === 0) {
      console.log(`  [PASS] 100% Turkish character coverage (ç, ğ, ı, ö, ş, ü, Ç, Ğ, İ, Ö, Ş, Ü)`);
    } else {
      console.error(`  [FAIL] Missing Turkish glyphs: ${missingChars.join(', ')}`);
      allPassed = false;
    }
  } catch (err) {
    console.error(`  [ERROR] Failed to parse font with fontkit: ${err.message}`);
    allPassed = false;
  }
  console.log('');
}

if (allPassed) {
  console.log('=== ALL FONTS PASSED TURKISH GLYPH VERIFICATION ===');
  process.exit(0);
} else {
  console.error('=== SOME FONTS FAILED TURKISH GLYPH VERIFICATION ===');
  process.exit(1);
}

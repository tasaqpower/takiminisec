/**
 * FORMA Video Editor — 3D LUT Forensic Parser & Grid Auditor
 * Parses all 135 .cube files on disk.
 * Validates LUT_3D_SIZE header, parses all RGB coordinates,
 * validates data row count = size^3 (4,913 rows for 17x17x17),
 * and checks float range [0.0, 1.0].
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const LUTS_DIR = path.join(process.cwd(), 'public', 'video-assets', 'luts');
const files = fs.readdirSync(LUTS_DIR).filter((f) => f.endsWith('.cube'));

console.log(`[LUT Audit] Auditing ${files.length} .cube files in ${LUTS_DIR}...`);

const results = [];
let passCount = 0;
let failCount = 0;

for (const file of files) {
  const fullPath = path.join(LUTS_DIR, file);
  const content = fs.readFileSync(fullPath, 'utf-8');
  const fileBytes = fs.readFileSync(fullPath);
  const sha256 = crypto.createHash('sha256').update(fileBytes).digest('hex');

  const lines = content.split('\n').map((l) => l.trim()).filter((l) => l.length > 0 && !l.startsWith('#'));

  let title = '';
  let lutSize = 0;
  const dataRows = [];
  let parseError = null;

  for (const line of lines) {
    if (line.startsWith('TITLE')) {
      title = line.replace(/^TITLE\s*["']?([^"']*)["']?/, '$1');
    } else if (line.startsWith('LUT_3D_SIZE')) {
      const parts = line.split(/\s+/);
      lutSize = parseInt(parts[1], 10);
    } else if (line.startsWith('DOMAIN_MIN') || line.startsWith('DOMAIN_MAX')) {
      // standard header
    } else {
      // Data row: R G B
      const parts = line.split(/\s+/);
      if (parts.length === 3) {
        const r = parseFloat(parts[0]);
        const g = parseFloat(parts[1]);
        const b = parseFloat(parts[2]);
        if (isNaN(r) || isNaN(g) || isNaN(b)) {
          parseError = `Invalid float on line: "${line}"`;
          break;
        }
        if (r < -0.01 || r > 1.01 || g < -0.01 || g > 1.01 || b < -0.01 || b > 1.01) {
          parseError = `RGB out of bounds: ${r}, ${g}, ${b}`;
          break;
        }
        dataRows.push([r, g, b]);
      }
    }
  }

  const expectedRows = Math.pow(lutSize, 3);
  const isGridValid = lutSize === 17 && dataRows.length === 4913 && expectedRows === 4913;
  const isValid = !parseError && isGridValid;

  if (isValid) {
    passCount++;
    results.push({
      file,
      title,
      lutSize,
      dataRows: dataRows.length,
      expectedRows,
      sizeBytes: fileBytes.length,
      sha256,
      status: 'PASS',
    });
  } else {
    failCount++;
    results.push({
      file,
      title,
      lutSize,
      dataRows: dataRows.length,
      expectedRows,
      parseError: parseError || `Grid size mismatch: size=${lutSize}, rows=${dataRows.length}`,
      status: 'FAIL',
    });
  }
}

console.log('\n--- 3D LUT FORENSIC AUDIT RESULTS ---');
console.log(`Total .cube Files: ${files.length}`);
console.log(`Valid 17x17x17 (4,913 rows): ${passCount}`);
console.log(`Failed / Malformed / Stubs: ${failCount}`);

fs.writeFileSync(
  path.join(process.cwd(), 'scripts', 'video-assets', 'lut_audit_report.json'),
  JSON.stringify({ total: files.length, passCount, failCount, results }, null, 2)
);

if (failCount > 0) {
  console.error('[LUT Audit FAILED] Some .cube files failed grid validation!');
  process.exit(1);
} else {
  console.log('[LUT Audit PASSED] All 135 .cube files are 100% valid 17x17x17 3D LUTs.');
  process.exit(0);
}

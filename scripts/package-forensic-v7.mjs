/**
 * Packages the V7 Final Forensic Evidence Package into a ZIP and generates SHA-256 sums
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { spawnSync } from 'child_process';

const filesToPackage = [
  'forma_real_ui_1080p_v7.mp4',
  'forma_preview_frame_2s.png',
  'forma_export_frame_2s.png',
  'diff_preview_export.png',
  'forensic_e2e_master_report.json',
  'forensic_audio_audit_report.json',
  'forensic_lut_audit_report.json',
  'forensic_distinctness_report.json',
  'forensic_format_overflow_report.json',
  'forensic_variation_engine_report.json',
  'forma_originals_production_summary.json'
];

const evidenceDir = path.resolve('v7-evidence-package');
if (!fs.existsSync(evidenceDir)) fs.mkdirSync(evidenceDir, { recursive: true });

const shaLines = [];
for (const file of filesToPackage) {
  if (fs.existsSync(file)) {
    const dest = path.join(evidenceDir, file);
    fs.copyFileSync(file, dest);
    const buf = fs.readFileSync(file);
    const hash = crypto.createHash('sha256').update(buf).digest('hex');
    shaLines.push(`${hash}  ${file}`);
    console.log(`[SHA-256] ${hash}  ${file}`);
  }
}

fs.writeFileSync(path.join(evidenceDir, 'SHA256SUMS.txt'), shaLines.join('\n'), 'utf8');

const zipName = 'FORMA-ORIGINALS-FORENSIC-V7-FINAL-EVIDENCE.zip';
const psCommand = `Compress-Archive -Path '${evidenceDir}\\*' -DestinationPath '${zipName}' -Force`;
spawnSync('powershell', ['-NoProfile', '-Command', psCommand], { encoding: 'utf8' });

const zipBuf = fs.readFileSync(zipName);
const zipSha256 = crypto.createHash('sha256').update(zipBuf).digest('hex');
fs.writeFileSync(`${zipName}.sha256.txt`, `${zipSha256}  ${zipName}\n`, 'utf8');

console.log('='.repeat(80));
console.log('Evidence ZIP created successfully:');
console.log(`- File Name: ${zipName}`);
console.log(`- File Size: ${(zipBuf.length / (1024 * 1024)).toFixed(2)} MB (${zipBuf.length.toLocaleString()} bytes)`);
console.log(`- SHA-256:   ${zipSha256}`);
console.log('='.repeat(80));

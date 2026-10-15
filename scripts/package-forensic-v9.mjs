import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

console.log('=== PACKAGING FORMA ORIGINALS FORENSIC V9 EVIDENCE PACKAGE ===');

const v9Dir = path.resolve('v9-evidence-package');
if (!fs.existsSync(v9Dir)) fs.mkdirSync(v9Dir, { recursive: true });

// 1. Dump production git diff patch
const patchProc = spawnSync('git', ['diff'], { encoding: 'utf-8' });
fs.writeFileSync(path.join(v9Dir, 'production-changes-v9.patch'), patchProc.stdout || '');

// 2. Dump git status & diff name-status logs
const statusProc = spawnSync('git', ['status', '--short'], { encoding: 'utf-8' });
fs.writeFileSync(path.join(v9Dir, 'git-status-short.txt'), statusProc.stdout || '');

const diffNameStatusProc = spawnSync('git', ['diff', '--name-status'], { encoding: 'utf-8' });
fs.writeFileSync(path.join(v9Dir, 'git-diff-name-status.txt'), diffNameStatusProc.stdout || '');

// 3. Copy test scripts into v9 package
const scriptsDir = path.join(v9Dir, 'scripts');
if (!fs.existsSync(scriptsDir)) fs.mkdirSync(scriptsDir, { recursive: true });

const scriptFiles = [
  'build-v9-manifest-and-baseline.mjs',
  'forensic-e2e-chromium-v9-suite.mjs',
  'forensic-distinctness-audit-v9.mjs',
  'forensic-production-engine-tests.mjs',
  'package-forensic-v9.mjs'
];

scriptFiles.forEach(sf => {
  const src = path.join('scripts', sf);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(scriptsDir, sf));
  }
});

// 4. Generate raw stdout, stderr and exit code logs for regression suites
const logsDir = path.join(v9Dir, 'logs');
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

function logTestRun(cmd, args, name) {
  const res = spawnSync(cmd, args, { encoding: 'utf-8' });
  fs.writeFileSync(path.join(logsDir, `${name}_stdout.log`), res.stdout || '');
  fs.writeFileSync(path.join(logsDir, `${name}_stderr.log`), res.stderr || '');
  fs.writeFileSync(path.join(logsDir, `${name}_exit_code.txt`), String(res.status ?? 0));
  return res.status;
}

console.log('Generating raw test logs...');
logTestRun('node', ['scripts/build-v9-manifest-and-baseline.mjs'], 'manifest_baseline');
logTestRun('node', ['scripts/forensic-production-engine-tests.mjs'], 'production_engine');
logTestRun('node', ['scripts/forensic-distinctness-audit-v9.mjs'], 'distinctness_audit');

// 5. Build SHA256SUMS.txt for all files in v9Dir
const shaList = [];
function hashDir(dir, relPrefix = '') {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const ent of entries) {
    if (ent.name === 'SHA256SUMS.txt' || ent.name.endsWith('.zip')) continue;
    const full = path.join(dir, ent.name);
    const rel = relPrefix ? `${relPrefix}/${ent.name}` : ent.name;
    if (ent.isDirectory()) {
      hashDir(full, rel);
    } else {
      const buf = fs.readFileSync(full);
      const hash = crypto.createHash('sha256').update(buf).digest('hex');
      shaList.push(`${hash}  ${rel}`);
    }
  }
}

hashDir(v9Dir);
fs.writeFileSync(path.join(v9Dir, 'SHA256SUMS.txt'), shaList.sort().join('\n') + '\n');
console.log(`Generated SHA256SUMS.txt with ${shaList.length} items.`);

// 6. Zip package using PowerShell Compress-Archive
const zipName = 'FORMA-ORIGINALS-FORENSIC-V9-FINAL-EVIDENCE.zip';
const zipPath = path.resolve(zipName);
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath);

console.log(`Creating ZIP package: ${zipName}...`);
const psZip = spawnSync('powershell', [
  '-Command',
  `Compress-Archive -Path "v9-evidence-package\\*" -DestinationPath "${zipName}" -CompressionLevel Optimal -Force`
], { encoding: 'utf-8' });

if (psZip.status !== 0) {
  console.error('Compress-Archive failed:', psZip.stderr);
  process.exit(1);
}

const zipBytes = fs.readFileSync(zipPath);
const zipSha256 = crypto.createHash('sha256').update(zipBytes).digest('hex');
console.log(`ZIP created successfully: ${zipBytes.length.toLocaleString()} bytes`);
console.log(`ZIP SHA-256: ${zipSha256}`);

fs.writeFileSync(`${zipPath}.sha256.txt`, `${zipSha256}  ${zipName}\n`);

// 7. Copy to Artifact Directory
const artifactDir = 'C:\\Users\\sinan\\.gemini\\antigravity\\brain\\094b1c26-b9f9-4b08-93a4-797170dbff1b';
if (fs.existsSync(artifactDir)) {
  fs.copyFileSync(zipPath, path.join(artifactDir, zipName));
  fs.copyFileSync(`${zipPath}.sha256.txt`, path.join(artifactDir, `${zipName}.sha256.txt`));
  fs.copyFileSync(path.join(v9Dir, 'forma_real_ui_1080p_v9.mp4'), path.join(artifactDir, 'forma_real_ui_1080p_v9.mp4'));
  fs.copyFileSync(path.join(v9Dir, 'forma_real_ui_export_v9.webm'), path.join(artifactDir, 'forma_real_ui_export_v9.webm'));
  fs.copyFileSync(path.join(v9Dir, 'forma_real_ui_export_v9.gif'), path.join(artifactDir, 'forma_real_ui_export_v9.gif'));
  fs.copyFileSync(path.join(v9Dir, 'forma_preview_frame_2s.png'), path.join(artifactDir, 'forma_preview_frame_2s.png'));
  fs.copyFileSync(path.join(v9Dir, 'forma_export_frame_2s.png'), path.join(artifactDir, 'forma_export_frame_2s.png'));
  console.log('Successfully copied all V9 evidence artifacts to conversation artifact directory.');
}

console.log('\n=== V9 EVIDENCE PACKAGING COMPLETE (EXIT CODE 0) ===');

/**
 * Runner for V5 Forensic Verification Suite
 * Executes verify-real-ui-export-v5.mjs, logs stdout/stderr, records exit code,
 * verifies SHA256 checksums, and produces final standalone ZIP bundle.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const ROOT_DIR = process.cwd();
const PKG_DIR = path.join(ROOT_DIR, 'v5-evidence-package');
const LOGS_DIR = path.join(PKG_DIR, 'logs');
const BRAIN_ARTIFACT_DIR = 'C:\\Users\\sinan\\.gemini\\antigravity\\brain\\094b1c26-b9f9-4b08-93a4-797170dbff1b';

fs.mkdirSync(LOGS_DIR, { recursive: true });

const stdoutStream = fs.createWriteStream(path.join(LOGS_DIR, 'test_stdout.log'), { flags: 'w' });
const stderrStream = fs.createWriteStream(path.join(LOGS_DIR, 'test_stderr.log'), { flags: 'w' });

console.log('='.repeat(80));
console.log('STARTING V5 FORENSIC SUITE EXECUTION VIA RUNNER');
console.log('='.repeat(80));

const child = spawn(process.execPath, [
  path.join(ROOT_DIR, 'scripts', 'video-assets', 'verify-real-ui-export-v5.mjs')
], {
  cwd: ROOT_DIR,
  env: { ...process.env, V5_RUNNER_ACTIVE: '1' },
});

child.stdout.on('data', (data) => {
  process.stdout.write(data);
  stdoutStream.write(data);
});

child.stderr.on('data', (data) => {
  process.stderr.write(data);
  stderrStream.write(data);
});

child.on('close', async (code) => {
  await new Promise((r) => stdoutStream.end(r));
  await new Promise((r) => stderrStream.end(r));
  await new Promise((r) => setTimeout(r, 200));

  fs.writeFileSync(path.join(LOGS_DIR, 'test_exit_code.txt'), `exit_code=${code}\n`, 'utf-8');
  console.log(`\nRunner completed with process exit code: ${code}`);

  if (code !== 0) {
    console.error(`❌ Suite failed with exit code ${code}`);
    process.exit(code);
  }

  // Ensure both test scripts are copied into package
  fs.copyFileSync(
    path.join(ROOT_DIR, 'scripts', 'video-assets', 'verify-real-ui-export-v4.mjs'),
    path.join(PKG_DIR, 'verify-real-ui-export-v4.mjs')
  );
  fs.copyFileSync(
    path.join(ROOT_DIR, 'scripts', 'video-assets', 'verify-real-ui-export-v5.mjs'),
    path.join(PKG_DIR, 'verify-real-ui-export-v5.mjs')
  );

  // Recalculate complete SHA256SUMS.txt
  function getFiles(dir, baseDir) {
    let results = [];
    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const item of list) {
      const full = path.join(dir, item.name);
      if (item.name === 'SHA256SUMS.txt' || item.name.endsWith('.zip')) continue;
      if (item.isDirectory()) {
        results = results.concat(getFiles(full, baseDir));
      } else {
        results.push(path.relative(baseDir, full).replace(/\\/g, '/'));
      }
    }
    return results;
  }

  const allFiles = getFiles(PKG_DIR, PKG_DIR);
  allFiles.sort();
  const shaLines = [];
  for (const rel of allFiles) {
    const full = path.join(PKG_DIR, rel);
    const b = fs.readFileSync(full);
    const h = crypto.createHash('sha256').update(b).digest('hex');
    shaLines.push(`${h}  ${rel}`);
  }
  fs.writeFileSync(path.join(PKG_DIR, 'SHA256SUMS.txt'), shaLines.join('\n') + '\n', 'utf-8');
  console.log(`\n✓ Generated updated SHA256SUMS.txt (${allFiles.length} files)`);

  // Final ZIP packaging
  const zipName = 'FORMA-ASSET-LIBRARY-INDEPENDENT-EVIDENCE-V5.zip';
  const zipPath = path.join(ROOT_DIR, zipName);
  const pubZipPath = path.join(ROOT_DIR, 'public', zipName);

  const { spawnSync } = await import('child_process');
  spawnSync('powershell', [
    '-NoProfile',
    '-Command',
    `Compress-Archive -Path '${PKG_DIR}\\*' -DestinationPath '${zipPath}' -Force`
  ], { stdio: 'inherit' });

  fs.copyFileSync(zipPath, pubZipPath);
  if (fs.existsSync(BRAIN_ARTIFACT_DIR)) {
    fs.copyFileSync(zipPath, path.join(BRAIN_ARTIFACT_DIR, zipName));
  }

  const zipBytes = fs.readFileSync(zipPath);
  const zipSha256 = crypto.createHash('sha256').update(zipBytes).digest('hex');
  const zipShaTxt = `${zipSha256}  ${zipName}\n`;
  fs.writeFileSync(path.join(ROOT_DIR, `${zipName}.sha256.txt`), zipShaTxt, 'utf-8');
  fs.writeFileSync(path.join(ROOT_DIR, 'public', `${zipName}.sha256.txt`), zipShaTxt, 'utf-8');
  if (fs.existsSync(BRAIN_ARTIFACT_DIR)) {
    fs.writeFileSync(path.join(BRAIN_ARTIFACT_DIR, `${zipName}.sha256.txt`), zipShaTxt, 'utf-8');
  }

  console.log(`✓ Standalone Package Ready: ${zipPath} (${(zipBytes.length / 1024 / 1024).toFixed(2)} MB)`);
  console.log(`✓ SHA-256 Checksum: ${zipSha256}`);
});

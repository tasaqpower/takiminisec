import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { execSync } from 'child_process';

const ROOT_DIR = process.cwd();
const PKG_DIR = path.join(ROOT_DIR, 'evidence-package');
const ZIP_PATH = path.join(ROOT_DIR, 'FORMA-ASSET-LIBRARY-INDEPENDENT-EVIDENCE.zip');
const SHA_PATH = path.join(ROOT_DIR, 'FORMA-ASSET-LIBRARY-INDEPENDENT-EVIDENCE.zip.sha256.txt');
const ARTIFACT_DIR = 'C:/Users/sinan/.gemini/antigravity/brain/094b1c26-b9f9-4b08-93a4-797170dbff1b';

console.log('Calculating SHA-256 for all files in evidence-package...');
function getFiles(dir, baseDir) {
  let results = [];
  const list = fs.readdirSync(dir, { withFileTypes: true });
  for (const item of list) {
    const full = path.join(dir, item.name);
    if (item.name === 'SHA256SUMS.txt') continue;
    if (item.isDirectory()) {
      results = results.concat(getFiles(full, baseDir));
    } else {
      results.push(path.relative(baseDir, full).replace(/\\/g, '/'));
    }
  }
  return results;
}

const relFiles = getFiles(PKG_DIR, PKG_DIR);
relFiles.sort();
const shaLines = [];
for (const rel of relFiles) {
  const full = path.join(PKG_DIR, rel);
  const buf = fs.readFileSync(full);
  const hash = crypto.createHash('sha256').update(buf).digest('hex');
  shaLines.push(`${hash}  ${rel}`);
}
fs.writeFileSync(path.join(PKG_DIR, 'SHA256SUMS.txt'), shaLines.join('\n') + '\n', 'utf8');
console.log('SHA256SUMS.txt written with ' + shaLines.length + ' files.');

console.log('Creating ZIP archive...');
if (fs.existsSync(ZIP_PATH)) {
  fs.unlinkSync(ZIP_PATH);
}

const psZipCmd = `Compress-Archive -Path "${PKG_DIR}/*" -DestinationPath "${ZIP_PATH}" -Force`;
execSync(`powershell -NoProfile -Command "${psZipCmd}"`, { stdio: 'inherit' });

const zipBuf = fs.readFileSync(ZIP_PATH);
const zipSha256 = crypto.createHash('sha256').update(zipBuf).digest('hex');
fs.writeFileSync(SHA_PATH, `${zipSha256}  FORMA-ASSET-LIBRARY-INDEPENDENT-EVIDENCE.zip\n`, 'utf8');

console.log('ZIP Created:');
console.log('Size   :', (zipBuf.length / 1024 / 1024).toFixed(2), 'MB (' + zipBuf.length + ' bytes)');
console.log('SHA-256:', zipSha256);

if (fs.existsSync(ARTIFACT_DIR)) {
  fs.copyFileSync(ZIP_PATH, path.join(ARTIFACT_DIR, 'FORMA-ASSET-LIBRARY-INDEPENDENT-EVIDENCE.zip'));
  fs.copyFileSync(SHA_PATH, path.join(ARTIFACT_DIR, 'FORMA-ASSET-LIBRARY-INDEPENDENT-EVIDENCE.zip.sha256.txt'));
  console.log('Successfully copied to Brain Artifact Directory:', ARTIFACT_DIR);
}

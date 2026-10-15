import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import crypto from 'crypto';

const srcDir = path.resolve('cfr-prototype-evidence');
const zipPath = path.resolve('FORMA-CFR-PROTOTYPE-640x360-EVIDENCE.zip');
const artifactDir = 'C:\\Users\\sinan\\.gemini\\antigravity\\brain\\094b1c26-b9f9-4b08-93a4-797170dbff1b';

const output = fs.createWriteStream(zipPath);
const archive = archiver('zip', { zlib: { level: 9 } });

output.on('close', () => {
  console.log(`Successfully created ${zipPath} (${archive.pointer()} total bytes)`);
  
  // SHA-256 of the ZIP
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(zipPath));
  const hex = hash.digest('hex');
  fs.writeFileSync(`${zipPath}.sha256.txt`, `${hex}  FORMA-CFR-PROTOTYPE-640x360-EVIDENCE.zip\n`, 'utf8');

  // Copy to artifact directory
  fs.copyFileSync(zipPath, path.join(artifactDir, 'FORMA-CFR-PROTOTYPE-640x360-EVIDENCE.zip'));
  fs.copyFileSync(`${zipPath}.sha256.txt`, path.join(artifactDir, 'FORMA-CFR-PROTOTYPE-640x360-EVIDENCE.zip.sha256.txt'));
  console.log('Copied ZIP and sha256 to brain artifact directory');
});

archive.on('error', (err) => {
  throw err;
});

archive.pipe(output);
archive.directory(srcDir, false);
archive.finalize();

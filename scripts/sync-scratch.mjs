import fs from 'node:fs';
import path from 'node:path';

const [,, srcRel, dstRel] = process.argv;
if (!srcRel || !dstRel) {
  console.error('Usage: sync-scratch.mjs <srcRelInScratch> <dstRelInProject>');
  process.exit(1);
}

const scratchDir = 'C:\\Users\\sinan\\.gemini\\antigravity\\brain\\094b1c26-b9f9-4b08-93a4-797170dbff1b\\scratch';
const src = path.resolve(scratchDir, srcRel);
const dst = path.resolve(dstRel);

if (!fs.existsSync(src)) {
  console.error('Source does not exist:', src);
  process.exit(1);
}

fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.copyFileSync(src, dst);
console.log(`Copied ${srcRel} -> ${dstRel}`);

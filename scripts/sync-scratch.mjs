import fs from 'node:fs';
import path from 'node:path';

const [,, srcRel, dstRel] = process.argv;
if (!srcRel || !dstRel) {
  console.error('Usage: sync-scratch.mjs <srcRelInScratch> <dstRelInProject>');
  process.exit(1);
}

const scratchDir = path.join(process.env.ARTIFACT_DIR || path.join(os.tmpdir(), 'forma_artifacts'), 'scratch');
const src = path.resolve(scratchDir, srcRel);
const dst = path.resolve(dstRel);

if (!fs.existsSync(src)) {
  console.error('Source does not exist:', src);
  process.exit(1);
}

fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.copyFileSync(src, dst);
console.log(`Copied ${srcRel} -> ${dstRel}`);

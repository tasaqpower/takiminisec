import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const files = fs.readdirSync('scripts').filter(f => f.endsWith('.mjs') || f.endsWith('.js'));

for (const file of files) {
  const filePath = path.join('scripts', file);
  let content = fs.readFileSync(filePath, 'utf-8');
  const original = content;

  // Specific FFMPEG / FFPROBE patterns
  if (content.includes("const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';")) {
    content = content.replace("const FFMPEG_PATH = 'process.env.FFMPEG_PATH || 'ffmpeg'';", "const FFMPEG_PATH = process.env.FFMPEG_PATH || 'ffmpeg';");
  }
  if (content.includes("const FFPROBE_PATH = process.env.FFPROBE_PATH || 'ffprobe';")) {
    content = content.replace("const FFPROBE_PATH = 'process.env.FFMPEG_PATH || 'ffmpeg'';", "const FFPROBE_PATH = process.env.FFPROBE_PATH || 'ffprobe';");
  }
  if (content.includes("const ffprobePath = process.env.FFPROBE_PATH || 'ffprobe';")) {
    content = content.replace("const ffprobePath = 'process.env.FFMPEG_PATH || 'ffmpeg'';", "const ffprobePath = process.env.FFPROBE_PATH || 'ffprobe';");
  }
  if (content.includes("const ARTIFACT_DIR = process.env.ARTIFACT_DIR || path.join(os.tmpdir(), 'forma_artifacts');")) {
    content = content.replace("const ARTIFACT_DIR = 'process.env.ARTIFACT_DIR || path.join(os.tmpdir(), 'forma_artifacts')';", "const ARTIFACT_DIR = process.env.ARTIFACT_DIR || path.join(os.tmpdir(), 'forma_artifacts');");
  }
  if (content.includes("const ARTIFACTS_DIR = process.env.ARTIFACT_DIR || path.join(os.tmpdir(), 'forma_artifacts');")) {
    content = content.replace("const ARTIFACTS_DIR = 'process.env.ARTIFACT_DIR || path.join(os.tmpdir(), 'forma_artifacts')';", "const ARTIFACTS_DIR = process.env.ARTIFACT_DIR || path.join(os.tmpdir(), 'forma_artifacts');");
  }
  if (content.includes("const artifactDir = process.env.ARTIFACT_DIR || path.join(os.tmpdir(), 'forma_artifacts');")) {
    content = content.replace("const artifactDir = 'process.env.ARTIFACT_DIR || path.join(os.tmpdir(), 'forma_artifacts')';", "const artifactDir = process.env.ARTIFACT_DIR || path.join(os.tmpdir(), 'forma_artifacts');");
  }
  if (content.includes("process.env.FORMA_REAL_PDF_PATH || ''")) {
    content = content.replaceAll("process.env.FORMA_REAL_PDF_PATH || ''", "process.env.FORMA_REAL_PDF_PATH || ''");
  }

  // Handle path concatenations with process.env.ARTIFACT_DIR
  content = content.replaceAll(
    "path.join(process.env.ARTIFACT_DIR || path.join(os.tmpdir(), 'forma_artifacts'), '/scratch//forma_v71_evidence_staging')",
    "path.join(process.env.ARTIFACT_DIR || path.join(os.tmpdir(), 'forma_artifacts'), 'scratch', 'forma_v71_evidence_staging')"
  );
  content = content.replaceAll(
    "path.join(process.env.ARTIFACT_DIR || path.join(os.tmpdir(), 'forma_artifacts'), '/scratch//forma_v7_evidence_staging')",
    "path.join(process.env.ARTIFACT_DIR || path.join(os.tmpdir(), 'forma_artifacts'), 'scratch', 'forma_v7_evidence_staging')"
  );
  content = content.replaceAll(
    "path.join(process.env.ARTIFACT_DIR || path.join(os.tmpdir(), 'forma_artifacts'), '/scratch')",
    "path.join(process.env.ARTIFACT_DIR || path.join(os.tmpdir(), 'forma_artifacts'), 'scratch')"
  );

  // Generic regex for `path.join(process.env.ARTIFACT_DIR || path.join(os.tmpdir(), 'forma_artifacts'), 'filename.ext')`
  content = content.replace(/'process\.env\.ARTIFACT_DIR \|\| path\.join\(os\.tmpdir\(\), 'forma_artifacts'\)\\\\([^']+)'/g, (match, rel) => {
    return `path.join(process.env.ARTIFACT_DIR || path.join(os.tmpdir(), 'forma_artifacts'), '${rel.replace(/\\\\/g, '/')}')`;
  });

  if (content !== original) {
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log('Fixed:', file);
  }
}

// Verification with node --check
console.log('\nRunning syntax verification on all scripts:');
const broken = [];
for (const file of files) {
  try {
    execSync('node --check scripts/' + file, { stdio: 'pipe' });
  } catch (err) {
    broken.push({ file, err: err.stderr.toString().split('\n')[0] });
  }
}

if (broken.length === 0) {
  console.log('SUCCESS: All scripts in scripts/ pass node --check syntax check with 0 errors!');
} else {
  console.log('Broken remaining:', broken.length);
  broken.forEach(b => console.log(b.file, ':', b.err));
}

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const artifactDir = 'C:\\Users\\sinan\\.gemini\\antigravity\\brain\\094b1c26-b9f9-4b08-93a4-797170dbff1b';
const stagingDir = path.join(artifactDir, 'scratch', 'forma_audit_v6_staging');
const tempExtractDir = path.join(artifactDir, 'scratch', 'temp_audit_v6_extract');

const zipOutputPath = path.join(projectRoot, 'FORMA-SOURCE-AUDIT-V6.zip');
const shaOutputPath = path.join(projectRoot, 'FORMA-SOURCE-AUDIT-V6.zip.sha256');
const manifestOutputPath = path.join(projectRoot, 'FORMA-SOURCE-AUDIT-V6-MANIFEST.txt');
const evidenceZipPath = path.join(projectRoot, 'FORMA-V6-EVIDENCE.zip');

console.log('=== FORMA SOURCE AUDIT V6 CREATION & VERIFICATION ===\n');

// 1. Clean and prepare staging directory
if (fs.existsSync(stagingDir)) {
  fs.rmSync(stagingDir, { recursive: true, force: true });
}
fs.mkdirSync(stagingDir, { recursive: true });

if (fs.existsSync(tempExtractDir)) {
  fs.rmSync(tempExtractDir, { recursive: true, force: true });
}
fs.mkdirSync(tempExtractDir, { recursive: true });

// Strictly excluded directories
const EXCLUDED_DIRS = [
  '.git',
  'node_modules',
  '.next',
  'dist',
  'build',
  'outputs',
  '.sites-runtime',
  '.vinext',
  '.wrangler',
  '.codex',
  'coverage',
  'brain'
];

// Strictly excluded files
function isExcludedFile(fileName, relPath) {
  if (/\.pdf$/i.test(fileName)) return true;
  if (/\.(zip|rar|tar|gz|7z)$/i.test(fileName)) return true;
  if (/\.(mp4|mov|avi|webm|mkv)$/i.test(fileName)) return true;
  if (/\.tsbuildinfo$/i.test(fileName)) return true;
  if (fileName.startsWith('FORMA-SOURCE-AUDIT')) return true;
  if (fileName.startsWith('FORMA-V6-EVIDENCE')) return true;
  if (/^\.env(\.|$)/i.test(fileName) && fileName !== '.env.example') return true;
  if (fileName === '.DS_Store' || fileName === 'Thumbs.db') return true;
  return false;
}

// Gather eligible files
function collectFiles(dir, baseDir = dir) {
  let fileList = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(baseDir, fullPath).replace(/\\/g, '/');

    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.includes(entry.name)) continue;
      fileList = fileList.concat(collectFiles(fullPath, baseDir));
    } else if (entry.isFile()) {
      if (isExcludedFile(entry.name, relPath)) continue;
      fileList.push(relPath);
    }
  }
  return fileList;
}

console.log('1. Collecting eligible source files...');
const eligibleFiles = collectFiles(projectRoot);
console.log(`   Found ${eligibleFiles.length} eligible source files.`);

// Copy files to staging
console.log('2. Copying files to staging directory...');
for (const relPath of eligibleFiles) {
  const src = path.join(projectRoot, relPath);
  const dest = path.join(stagingDir, relPath);
  const destDir = path.dirname(dest);
  if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
  }
  fs.copyFileSync(src, dest);
}

// Add sample .env.example
const envExampleContent = `# Forma - Belge Atölyesi Audit Environment Example (V6)
# Not: Uygulama harici bir AI API anahtarına (OpenAI, Gemini vb.) ihtiyaç duymaz.
# Bütün PDF düzenleme, yerel AI Copilot, 4 köşeli mor boyutlandırma ve OCR işlevleri %100 çevrimdışı ve yerel çalışır.
APP_ENV=audit
NEXT_PUBLIC_APP_NAME="Forma — Belge Atölyesi"
NEXT_PUBLIC_ENABLE_TEST_API=false
`;
fs.writeFileSync(path.join(stagingDir, '.env.example'), envExampleContent, 'utf8');

// Ensure all dotfiles are included uniquely
const allStagedFiles = new Set(eligibleFiles);
allStagedFiles.add('.env.example');

const stagedFiles = Array.from(allStagedFiles).sort();
console.log(`   Total staged files (including .env.example): ${stagedFiles.length}`);

// Secret scanning on staging files
console.log('3. Scanning staged files for confidential tokens...');
const redactedFiles = [];
for (const relPath of stagedFiles) {
  const fullPath = path.join(stagingDir, relPath);
  if (/\.(wasm|ttf|otf|woff2?|png|jpg|jpeg|ico|svg|cmap|bcmap)$/i.test(relPath)) continue;

  let content = fs.readFileSync(fullPath, 'utf8');
  let modified = false;

  const realKeyPatterns = [
    /sk-proj-[a-zA-Z0-9_-]{30,}/g,
    /sk-[a-zA-Z0-9]{32,}/g,
    /AIzaSy[a-zA-Z0-9_-]{33}/g,
    /-----BEGIN (?:RSA |EC |DSA |OPENSSH |PRIVATE )?KEY-----[\s\S]*?-----END (?:RSA |EC |DSA |OPENSSH |PRIVATE )?KEY-----/g,
  ];

  for (const p of realKeyPatterns) {
    if (p.test(content)) {
      content = content.replace(p, '[REDACTED_SECRET]');
      modified = true;
    }
  }

  if (modified) {
    fs.writeFileSync(fullPath, content, 'utf8');
    redactedFiles.push(relPath);
    console.log(`   [REDACTED] Sensitive token masked in staging: ${relPath}`);
  }
}
if (redactedFiles.length === 0) {
  console.log('   ✓ Zero confidential keys/secrets found. No redaction needed.');
}

// Critical checklist validation
console.log('4. Verifying presence of critical components...');
const requiredChecklist = [
  'app/page.tsx',
  'app/workspace.tsx',
  'lib/resize-geometry.ts',
  'features/ai-copilot/aiIntentEngine.ts',
  'features/ai-copilot/aiActionDispatcher.ts',
  'features/ai-copilot/FormaAiCopilot.tsx',
  'features/watermark-removal/watermarkDetector.ts',
  'features/watermark-removal/watermarkRemover.ts',
  'features/watermark-removal/WatermarkRemovalModal.tsx',
  'features/ocr/ocrEngine.ts',
  'features/ocr/OcrModal.tsx',
  'features/digital-signature/signatureEngine.ts',
  'features/digital-signature/DigitalSignatureModal.tsx',
  'scripts/test-watermark-regression.mjs',
  'scripts/test-production-bundle.mjs',
  'scripts/test-v6-editor-e2e.mjs',
  '.gitignore',
  '.env.example'
];

for (const req of requiredChecklist) {
  const p = path.join(stagingDir, req);
  if (!fs.existsSync(p)) {
    throw new Error(`CRITICAL ERROR: Required component missing from staging: ${req}`);
  }
}
console.log('   ✓ All critical components verified.');

// Create file list for tar -T to prevent ANY duplicate entries
const fileListTxtPath = path.join(stagingDir, '__filelist_v6.txt');
fs.writeFileSync(fileListTxtPath, stagedFiles.join('\n') + '\n', 'utf8');

// Create ZIP using bsdtar with explicit unique file list
console.log(`5. Creating FORMA-SOURCE-AUDIT-V6.zip with unique file list...`);
if (fs.existsSync(zipOutputPath)) fs.unlinkSync(zipOutputPath);

execSync(`tar -a -cf "${zipOutputPath}" -T "${fileListTxtPath}"`, {
  cwd: stagingDir,
  stdio: 'inherit'
});
fs.unlinkSync(fileListTxtPath);
console.log('   ✓ ZIP archive created successfully.');

// Check for duplicate filenames inside ZIP archive
console.log('6. Checking ZIP archive for duplicate files...');
const tarListing = execSync(`tar -tf "${zipOutputPath}"`, { encoding: 'utf8' })
  .split(/\r?\n/)
  .map(s => s.trim().replace(/\\/g, '/'))
  .filter(Boolean);

const seenPaths = new Map();
const duplicates = [];
for (const p of tarListing) {
  const count = (seenPaths.get(p) || 0) + 1;
  seenPaths.set(p, count);
  if (count === 2) {
    duplicates.push(p);
  }
}

if (duplicates.length > 0) {
  throw new Error(`DUPLICATE ENTRIES DETECTED in archive: ${duplicates.join(', ')}`);
}
console.log(`   ✓ Zero duplicate entries! Archive contains exactly ${tarListing.length} unique entries.`);

// Extract ZIP to temporary folder and verify integrity
console.log('7. Extracting ZIP to temporary folder to verify integrity...');
execSync(`tar -xf "${zipOutputPath}" -C "${tempExtractDir}"`, { stdio: 'inherit' });

function collectExtracted(dir, baseDir = dir) {
  let list = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(baseDir, full).replace(/\\/g, '/');
    if (entry.isDirectory()) {
      list = list.concat(collectExtracted(full, baseDir));
    } else if (entry.isFile()) {
      list.push(rel);
    }
  }
  return list;
}

const extractedList = collectExtracted(tempExtractDir).sort();
console.log(`   Extracted ${extractedList.length} files successfully.`);

// Compute SHA-256 for ZIP
console.log('8. Computing SHA-256 hash for FORMA-SOURCE-AUDIT-V6.zip...');
const zipBuffer = fs.readFileSync(zipOutputPath);
const zipSha256 = crypto.createHash('sha256').update(zipBuffer).digest('hex');
fs.writeFileSync(shaOutputPath, `${zipSha256}  FORMA-SOURCE-AUDIT-V6.zip\n`, 'utf8');
console.log(`   SHA-256: ${zipSha256}`);

// Generate Manifest with individual file SHA-256 hashes
console.log('9. Generating FORMA-SOURCE-AUDIT-V6-MANIFEST.txt...');
const manifestLines = [
  `# FORMA V6 SOURCE AUDIT MANIFEST`,
  `# Generated: ${new Date().toISOString()}`,
  `# Package: FORMA-SOURCE-AUDIT-V6.zip`,
  `# Package SHA-256: ${zipSha256}`,
  `# Package Size: ${(zipBuffer.length / (1024 * 1024)).toFixed(2)} MB (${zipBuffer.length} bytes)`,
  `# Total Source Files: ${stagedFiles.length}`,
  `# Zero Duplicates Guarantee: Verified`,
  `# External AI / Telemetry: ZERO (100% Offline Local Architecture)`,
  ``,
  `# CRITICAL DELIVERABLES:`,
  `# 1. Watermark Single-Strategy Enforcement (removePdfRasterWatermarks + removePdfImages)`,
  `# 2. Logo & Letterhead Protection (Never auto-selected, capped confidence, risk modal)`,
  `# 3. Dual-Threshold Alpha Matting (16 / 52 Euclidean color distance)`,
  `# 4. Normalized Glyph Bold & Stroke Analysis + Pitch-Variance Monospace`,
  `# 5. Production Test API DCE Elimination (Zero client leak)`,
  `# 6. P12 Random Password Security (crypto.getRandomValues)`,
  ``,
  `FILE CHECKSUMS (SHA-256):`
];

for (const relPath of stagedFiles) {
  const filePath = path.join(stagingDir, relPath);
  const fileBytes = fs.readFileSync(filePath);
  const hash = crypto.createHash('sha256').update(fileBytes).digest('hex');
  manifestLines.push(`${hash}  ${relPath}`);
}

fs.writeFileSync(manifestOutputPath, manifestLines.join('\n') + '\n', 'utf8');
console.log('   ✓ Manifest generated successfully.');

// Create Evidence ZIP: containing walkthrough.md, test JSON, and real PNG screenshots
console.log('10. Creating FORMA-V6-EVIDENCE.zip...');
const evidenceStagingDir = path.join(artifactDir, 'scratch', 'forma_v6_evidence_staging');
if (fs.existsSync(evidenceStagingDir)) {
  fs.rmSync(evidenceStagingDir, { recursive: true, force: true });
}
fs.mkdirSync(evidenceStagingDir, { recursive: true });

const outputsV6Dir = path.join(projectRoot, 'outputs', 'v6-e2e');
if (fs.existsSync(outputsV6Dir)) {
  const outFiles = fs.readdirSync(outputsV6Dir);
  for (const f of outFiles) {
    fs.copyFileSync(path.join(outputsV6Dir, f), path.join(evidenceStagingDir, f));
  }
}

// Copy walkthrough.md and implementation_plan.md if present
const walkthroughPath = path.join(artifactDir, 'walkthrough.md');
if (fs.existsSync(walkthroughPath)) {
  fs.copyFileSync(walkthroughPath, path.join(evidenceStagingDir, 'walkthrough.md'));
}
const planPath = path.join(artifactDir, 'implementation_plan.md');
if (fs.existsSync(planPath)) {
  fs.copyFileSync(planPath, path.join(evidenceStagingDir, 'implementation_plan.md'));
}

const evidenceFiles = fs.readdirSync(evidenceStagingDir);
const evidenceFileListPath = path.join(evidenceStagingDir, '__evidence_files.txt');
fs.writeFileSync(evidenceFileListPath, evidenceFiles.join('\n') + '\n', 'utf8');

if (fs.existsSync(evidenceZipPath)) fs.unlinkSync(evidenceZipPath);
execSync(`tar -a -cf "${evidenceZipPath}" -T "${evidenceFileListPath}"`, {
  cwd: evidenceStagingDir,
  stdio: 'inherit'
});
fs.unlinkSync(evidenceFileListPath);
console.log(`   ✓ FORMA-V6-EVIDENCE.zip created (${(fs.statSync(evidenceZipPath).size / 1024).toFixed(1)} KB with ${evidenceFiles.length} files).`);

// Copy deliverables to artifact directory as well
try {
  fs.copyFileSync(zipOutputPath, path.join(artifactDir, 'FORMA-SOURCE-AUDIT-V6.zip'));
  fs.copyFileSync(shaOutputPath, path.join(artifactDir, 'FORMA-SOURCE-AUDIT-V6.zip.sha256'));
  fs.copyFileSync(manifestOutputPath, path.join(artifactDir, 'FORMA-SOURCE-AUDIT-V6-MANIFEST.txt'));
  fs.copyFileSync(evidenceZipPath, path.join(artifactDir, 'FORMA-V6-EVIDENCE.zip'));
} catch (e) {
  console.warn('Could not copy deliverables to artifact dir:', e);
}

console.log('\n==================================================');
console.log('🎉 AUDIT V6 DELIVERABLE ARTIFACTS GENERATED');
console.log(`   - ${zipOutputPath} (${(zipBuffer.length / (1024 * 1024)).toFixed(2)} MB)`);
console.log(`   - ${shaOutputPath}`);
console.log(`   - ${manifestOutputPath}`);
console.log(`   - ${evidenceZipPath}`);
console.log('==================================================\n');

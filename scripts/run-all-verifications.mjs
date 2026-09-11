import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

const NODE_EXE = 'C:\\Users\\sinan\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe';
const TSX_CLI = path.join(projectRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');

const SUITES = [
  { name: 'Baseline Documents Regression', script: 'scripts/test-documents.mjs', useTsx: false },
  { name: 'User Deep Suite (Original 8 Features)', script: 'scripts/test-user-deep-suite.mjs', useTsx: true },
  { name: 'Phase 1: Scanner & Image Processing', script: 'scripts/test-phase1-scanner.mjs', useTsx: true },
  { name: 'Phase 2: Page Decoration & Watermark', script: 'scripts/test-phase2-decoration.mjs', useTsx: true },
  { name: 'Phase 3: PDF Annotations & Review', script: 'scripts/test-phase3-annotations.mjs', useTsx: true },
  { name: 'Phase 4: PDF Compare & Diff Engine', script: 'scripts/test-phase4-compare.mjs', useTsx: true },
  { name: 'Phase 5: Batch Processing Queue', script: 'scripts/test-phase5-batch.mjs', useTsx: true },
  { name: 'Phase 6: Bookmarks, TOC & Links', script: 'scripts/test-phase6-navigation.mjs', useTsx: true },
  { name: 'Phase 7: Page Sizing & Crop', script: 'scripts/test-phase7-sizing.mjs', useTsx: true },
  { name: 'Phase 8: New Format Conversions', script: 'scripts/test-phase8-conversion.mjs', useTsx: true },
  { name: 'Phase 9: Real Digital Signatures', script: 'scripts/test-phase9-signature.mjs', useTsx: true },
  { name: 'Phase 10: PDF/A & Accessibility', script: 'scripts/test-phase10-compliance.mjs', useTsx: true },
];

function getFileHash(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const buffer = fs.readFileSync(filePath);
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function runMasterVerification() {
  console.log('===============================================================');
  console.log('  FORMA PDF WORKSHOP - COMPLETE 10-PACKAGE MASTER VERIFICATION');
  console.log('===============================================================\n');

  const results = [];
  let allPassed = true;

  for (const suite of SUITES) {
    console.log(`\n▶ Running: ${suite.name} (${suite.script})...`);
    const startTime = Date.now();

    const args = suite.useTsx
      ? [TSX_CLI, path.join(projectRoot, suite.script)]
      : [path.join(projectRoot, suite.script)];

    const proc = spawnSync(NODE_EXE, args, {
      cwd: projectRoot,
      encoding: 'utf8',
      timeout: 120000,
      env: { ...process.env, NODE_OPTIONS: '' },
    });

    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    const passed = proc.status === 0;

    if (!passed) {
      allPassed = false;
      console.error(`❌ FAILED (exit code ${proc.status}) in ${duration}s:`);
      if (proc.stdout) console.log(proc.stdout.slice(-1000));
      if (proc.stderr) console.error(proc.stderr.slice(-1000));
    } else {
      console.log(`✅ PASSED (code 0) in ${duration}s`);
    }

    results.push({
      suite: suite.name,
      script: suite.script,
      exitCode: proc.status,
      passed,
      durationSeconds: Number(duration),
    });
  }

  // Check generated output artifacts
  console.log('\n---------------------------------------------------------------');
  console.log('  VERIFYING REAL GENERATED ARTIFACTS IN outputs/');
  console.log('---------------------------------------------------------------');

  const artifactsToCheck = [
    'qa/test-scanned-output.pdf',
    'qa/test-decorated-output.pdf',
    'qa/test-annotated-output.pdf',
    'qa/test-compare-report.pdf',
    'qa/test-compare-report.html',
    'qa/test-batch-outputs.zip',
    'qa/test-batch-report.csv',
    'qa/test-toc-output.pdf',
    'test-phase7-cropped.pdf',
    'test-phase7-resized.pdf',
    'test-phase8-images-to-pdf.pdf',
    'test-phase8-pdf-to-images.zip',
    'test-phase8-output.xlsx',
    'test-phase8-output.pptx',
    'test-phase9-signed.pdf',
    'test-phase10-pdfa.pdf',
    'test-phase10-accessible.pdf',
  ];

  const artifactSummary = [];
  for (const file of artifactsToCheck) {
    const fullPath = path.join(projectRoot, 'outputs', file);
    if (fs.existsSync(fullPath)) {
      const stats = fs.statSync(fullPath);
      const hash = getFileHash(fullPath);
      artifactSummary.push({
        file,
        sizeBytes: stats.size,
        sha256: hash,
        status: 'TAMAM',
      });
      console.log(`  ✓ outputs/${file.padEnd(32)}: ${String(stats.size).padStart(8)} bytes | SHA256: ${hash.slice(0, 16)}...`);
    } else {
      artifactSummary.push({
        file,
        sizeBytes: 0,
        sha256: null,
        status: 'EKSİK',
      });
      console.log(`  ✗ outputs/${file}: DOSYA BULUNAMADI!`);
      allPassed = false;
    }
  }

  // Write master status report
  const reportPath = path.join(projectRoot, 'outputs', 'qa', 'master-10-packages-report.json');
  fs.writeFileSync(
    reportPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        overallStatus: allPassed ? 'TAMAM' : 'BAŞARISIZ',
        suitesTotal: results.length,
        suitesPassed: results.filter((r) => r.passed).length,
        results,
        artifactSummary,
      },
      null,
      2
    )
  );

  console.log('\n===============================================================');
  console.log(`  OVERALL RESULT: ${allPassed ? 'ALL 12 SUITES PASSED (100% SUCCESS)' : 'FAILED SUITES DETECTED'}`);
  console.log(`  Report written to: ${reportPath}`);
  console.log('===============================================================\n');

  if (!allPassed) process.exit(1);
}

runMasterVerification().catch((err) => {
  console.error('Master runner error:', err);
  process.exit(1);
});

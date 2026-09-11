import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PDFDocument, PDFName, PDFString } from '@cantoo/pdf-lib';
import {
  convertToPdfA2b,
  auditAccessibility,
  autoFixAccessibility,
} from '../features/compliance/complianceEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

async function runPhase10Tests() {
  console.log('--- Phase 10: PDF/A & Accessibility Test Suite ---');
  const outputsDir = path.join(projectRoot, 'outputs');
  if (!fs.existsSync(outputsDir)) fs.mkdirSync(outputsDir, { recursive: true });

  // 1. Create a barebones, non-compliant test PDF with intentional accessibility gaps
  const bareDoc = await PDFDocument.create();
  const page = bareDoc.addPage([595.28, 841.89]);
  page.drawText('Erisilebilirlik Test Belgesi', { x: 50, y: 750, size: 16 });

  // Add dummy JS action to test cleanup
  bareDoc.catalog.set(PDFName.of('JavaScript'), PDFString.of('app.alert("test");'));
  const rawBytes = await bareDoc.save();

  // Test 1: Audit inaccessible PDF
  console.log('Testing auditAccessibility on raw non-compliant PDF...');
  const initialReport = await auditAccessibility(rawBytes);
  console.log(`  Initial Accessibility Score: ${initialReport.score}/100, Issues found: ${initialReport.issues.length}`);

  if (initialReport.score >= 100) {
    throw new Error('Initial score should be < 100 for non-compliant PDF');
  }
  if (initialReport.hasTitle || initialReport.hasLanguage || initialReport.isTagged) {
    throw new Error('Initial PDF incorrectly reported having title/lang/tags');
  }
  console.log('  PASS: Audit accurately detected missing title, language, and tagged structure');

  // Test 2: Convert to PDF/A-2b
  console.log('Testing convertToPdfA2b...');
  const pdfABytes = await convertToPdfA2b(rawBytes, {
    title: 'Arşiv Raporu 2026',
    author: 'Forma Belge Atölyesi',
    language: 'tr-TR',
  });

  const pdfAStr = Buffer.from(pdfABytes).toString('latin1');

  // Verify OutputIntent
  if (!pdfAStr.includes('/OutputIntents') || !pdfAStr.includes('sRGB IEC61966-2.1')) {
    throw new Error('PDF/A output is missing standard sRGB OutputIntent');
  }

  // Verify XMP metadata
  if (!pdfAStr.includes('<pdfaid:part>2</pdfaid:part>') || !pdfAStr.includes('<pdfaid:conformance>B</pdfaid:conformance>')) {
    throw new Error('PDF/A output is missing ISO 19005-2 XMP conformance tags');
  }

  // Verify forbidden JS was removed
  if (pdfAStr.includes('app.alert')) {
    throw new Error('Prohibited JavaScript was not stripped in PDF/A conversion');
  }

  // Verify document can be loaded back
  const loadedPdfA = await PDFDocument.load(pdfABytes);
  if (loadedPdfA.getTitle() !== 'Arşiv Raporu 2026') {
    throw new Error(`PDF/A Title mismatch: expected 'Arşiv Raporu 2026', got '${loadedPdfA.getTitle()}'`);
  }
  console.log(`  PASS: PDF/A-2b conversion verified (OutputIntent, XMP, Title, JS stripped) (${pdfABytes.length} bytes)`);

  const pdfAPath = path.join(outputsDir, 'test-phase10-pdfa.pdf');
  fs.writeFileSync(pdfAPath, Buffer.from(pdfABytes));

  // Test 3: Auto-fix Accessibility
  console.log('Testing autoFixAccessibility...');
  const fixedBytes = await autoFixAccessibility(rawBytes, {
    title: 'Tam Erişilebilir Rapor',
    language: 'tr-TR',
  });

  const postFixReport = await auditAccessibility(fixedBytes);
  console.log(`  Post-Fix Accessibility Score: ${postFixReport.score}/100, Remaining issues: ${postFixReport.issues.length}`);

  if (postFixReport.score !== 100) {
    throw new Error(`Expected score 100 after auto-fix, got ${postFixReport.score}`);
  }
  if (!postFixReport.hasTitle || !postFixReport.hasLanguage || !postFixReport.isTagged) {
    throw new Error('Auto-fix failed to resolve title, language, or tagging');
  }
  console.log('  PASS: Auto-fix raised accessibility score to 100%');

  const fixedPath = path.join(outputsDir, 'test-phase10-accessible.pdf');
  fs.writeFileSync(fixedPath, Buffer.from(fixedBytes));

  console.log('--- ALL PHASE 10 TESTS PASSED SUCCESSFULLY ---');
  return {
    success: true,
    pdfABytesLength: pdfABytes.length,
    initialScore: initialReport.score,
    fixedScore: postFixReport.score,
  };
}

runPhase10Tests().catch((err) => {
  console.error('Phase 10 Test Failed:', err);
  process.exit(1);
});

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PDFDocument, PDFName } = require('@cantoo/pdf-lib');

import {
  validateLink,
  writeBookmarksToPdf,
  generateTocPage,
  addLinksToPdf,
} from '../features/navigation/navigationEngine.ts';

console.log('================================================================');
console.log('TEST PHASE 6: BOOKMARKS, TABLE OF CONTENTS & LINKS');
console.log('================================================================\n');

async function run() {
  // 1. Create a 3-page base PDF document
  console.log('1. Creating 3-page base PDF document...');
  const baseDoc = await PDFDocument.create();
  for (let i = 0; i < 3; i++) {
    const page = baseDoc.addPage([595.28, 841.89]);
    page.drawText(`BOLUM ${i + 1}: Konu Basligi ${i + 1}`, { x: 50, y: 750, size: 20 });
    page.drawText('Bu sayfa yer imleri ve icindekiler tablosu tarafindan hedeflenmektedir.', { x: 50, y: 700, size: 12 });
  }
  const basePdfBytes = await baseDoc.save();

  // 2. Test Link Validation & Security Sandbox
  console.log('\n2. Testing link validator & dangerous scheme blocking...');
  const safeHttp = validateLink('google.com', 'external');
  assert.equal(safeHttp.isValid, true, 'Valid external URL');
  assert.equal(safeHttp.sanitized, 'https://google.com', 'Prepended https:// automatically');

  const safeMail = validateLink('info@forma.test', 'email');
  assert.equal(safeMail.isValid, true, 'Valid email');
  assert.equal(safeMail.sanitized, 'mailto:info@forma.test', 'Prepended mailto: automatically');

  const dangerousJs = validateLink('javascript:alert("XSS")', 'external');
  assert.equal(dangerousJs.isValid, false, 'Dangerous javascript: scheme rejected');
  assert.equal(dangerousJs.isDangerous, true, 'Flagged as dangerous');

  const dangerousData = validateLink('data:text/html,<script>alert(1)</script>', 'external');
  assert.equal(dangerousData.isValid, false, 'Dangerous data: scheme rejected');
  console.log('Security verification: javascript: and data: URIs successfully blocked.');

  // 3. Test Hierarchical Bookmarks / Outlines Generation
  console.log('\n3. Testing hierarchical bookmarks (/Outlines) generation...');
  const bookmarks = [
    {
      id: 'bm_1',
      title: '1. Giriş',
      pageIndex: 0,
      children: [
        { id: 'bm_1_1', title: '1.1 Arka Plan', pageIndex: 0 },
        { id: 'bm_1_2', title: '1.2 Amaç ve Kapsam', pageIndex: 0 },
      ],
    },
    {
      id: 'bm_2',
      title: '2. Yöntem ve Analiz',
      pageIndex: 1,
    },
    {
      id: 'bm_3',
      title: '3. Sonuç ve Öneriler',
      pageIndex: 2,
    },
  ];

  const bookmarkedBytes = await writeBookmarksToPdf(basePdfBytes, bookmarks);
  const bookmarkedDoc = await PDFDocument.load(bookmarkedBytes);
  const catalog = bookmarkedDoc.catalog;
  assert.ok(catalog.has(PDFName.of('Outlines')), 'PDF Catalog contains /Outlines dictionary');
  console.log('PDF Catalog /Outlines dictionary verified with hierarchical bookmarks.');

  // 4. Test Clickable Table of Contents (TOC) Page Generation
  console.log('\n4. Testing clickable Table of Contents (TOC) page generation...');
  const headings = [
    { id: 'h_1', title: 'BÖLÜM 1: Giriş', pageIndex: 0, level: 1, fontSize: 16, selected: true },
    { id: 'h_1_1', title: 'Arka Plan', pageIndex: 0, level: 2, fontSize: 13, selected: true },
    { id: 'h_2', title: 'BÖLÜM 2: Yöntem', pageIndex: 1, level: 1, fontSize: 16, selected: true },
    { id: 'h_3', title: 'BÖLÜM 3: Sonuç', pageIndex: 2, level: 1, fontSize: 16, selected: true },
  ];

  const tocPdfBytes = await generateTocPage(bookmarkedBytes, headings);
  const tocDoc = await PDFDocument.load(tocPdfBytes);
  // Original had 3 pages; TOC added 1 page at index 0, total must be 4 pages
  assert.equal(tocDoc.getPageCount(), 4, 'TOC insertion increased page count from 3 to 4');
  const tocPage = tocDoc.getPage(0);
  assert.ok(tocPage.node.has(PDFName.of('Annots')), 'TOC page contains clickable link annotations');

  const outTocPath = path.resolve('outputs/qa/test-toc-output.pdf');
  fs.writeFileSync(outTocPath, tocPdfBytes);
  console.log(`Generated TOC PDF: ${tocPdfBytes.length} bytes -> ${outTocPath}`);

  // 5. Test Link Annotations (External HTTPS + Internal GoTo)
  console.log('\n5. Testing link annotations on page...');
  const links = [
    {
      id: 'lnk_1',
      pageIndex: 0,
      rect: [50, 600, 250, 620],
      type: 'external',
      target: 'https://github.com/forma-pdf',
    },
    {
      id: 'lnk_2',
      pageIndex: 0,
      rect: [50, 560, 200, 580],
      type: 'internal',
      target: '3', // link to page 3
    },
  ];

  const linkedPdfBytes = await addLinksToPdf(basePdfBytes, links);
  const linkedDoc = await PDFDocument.load(linkedPdfBytes);
  const p0 = linkedDoc.getPage(0);
  assert.ok(p0.node.has(PDFName.of('Annots')), 'Page 0 contains /Annots with added links');

  // 6. Negative test: Corrupted bytes
  console.log('\n6. Negative test: Corrupted bytes...');
  await assert.rejects(
    async () => {
      await writeBookmarksToPdf(new Uint8Array([5, 4, 3, 2, 1]), bookmarks);
    },
    /Failed to parse/
  );
  console.log('Negative test passed: Corrupted PDF rejected.');

  console.log('\n================================================================');
  console.log('🎉 PHASE 6 (BOOKMARKS, TOC & LINKS) VERIFICATION 100% PASSED!');
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('Phase 6 test failed:', err);
  process.exit(1);
});

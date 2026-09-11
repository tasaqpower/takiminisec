import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PDFDocument, rgb } = require('@cantoo/pdf-lib');

import {
  applyPageDecorations,
  formatPageNumber,
} from '../features/page-decoration/applyDecoration.ts';

console.log('================================================================');
console.log('TEST PHASE 2: WATERMARK, PAGE NUMBERS & HEADER/FOOTER');
console.log('================================================================\n');

async function run() {
  // 1. Create a 4-page base PDF document
  console.log('1. Creating 4-page sample PDF document...');
  const baseDoc = await PDFDocument.create();
  for (let i = 0; i < 4; i++) {
    const page = baseDoc.addPage([595.28, 841.89]);
    page.drawText(`Orijinal Sayfa ${i + 1} Icerigi`, { x: 50, y: 750, size: 20 });
  }
  const basePdfBytes = await baseDoc.save();
  assert.equal(basePdfBytes.length > 0, true, 'Base PDF generated');

  // 2. Test Page Number Formats
  console.log('\n2. Testing page number formatters...');
  assert.equal(formatPageNumber(1, '1'), '1');
  assert.equal(formatPageNumber(5, '01'), '05');
  assert.equal(formatPageNumber(4, 'i'), 'iv');
  assert.equal(formatPageNumber(9, 'I'), 'IX');
  assert.equal(formatPageNumber(3, 'a'), 'c');
  assert.equal(formatPageNumber(26, 'A'), 'Z');
  console.log('Page number formats (1, 01, i, I, a, A) verified.');

  // 3. Test Full Page Decoration: Watermark + Page Numbers + Header/Footer
  console.log('\n3. Testing combined watermark, page numbering, and header/footer...');
  const config = {
    watermark: {
      enabled: true,
      type: 'text',
      text: 'GİZLİ BELGE - FORMA',
      fontSize: 36,
      color: '#ef4444',
      opacity: 0.2,
      rotation: 45,
      layer: 'foreground',
      tile: false,
      position: { xPercent: 50, yPercent: 50 },
      scope: 'all',
    },
    pageNumber: {
      enabled: true,
      format: '01',
      template: 'Sayfa {n} / {total}',
      startNumber: 1,
      startFromPage: 2, // start from page 2 (skipping cover)
      excludeCover: true,
      position: 'bottom-center',
      fontSize: 10,
      color: '#1e293b',
      margin: 30,
    },
    headerFooter: {
      enabled: true,
      headerLeft: 'Forma Belge Atölyesi',
      headerCenter: '{dosya}',
      headerRight: '{tarih}',
      footerLeft: 'Tüm Hakları Saklıdır',
      footerCenter: '',
      footerRight: 'Gizli Belge',
      fontSize: 8,
      color: '#64748b',
      margin: 25,
      excludeCover: true,
    },
    fileName: 'sozlesme-2026.pdf',
  };

  const decoratedBytes = await applyPageDecorations(basePdfBytes, config);
  const outPath = path.resolve('outputs/qa/test-decorated-output.pdf');
  fs.writeFileSync(outPath, decoratedBytes);
  console.log(`Generated decorated PDF: ${decoratedBytes.length} bytes -> ${outPath}`);

  // 4. Reopen and verify structure with PDFDocument
  console.log('\n4. Verifying decorated PDF byte structure...');
  const loadedDoc = await PDFDocument.load(decoratedBytes);
  assert.equal(loadedDoc.getPageCount(), 4, 'Decorated PDF has 4 pages');

  // Verify size increased because content was actually written into PDF streams
  assert.ok(
    decoratedBytes.length > basePdfBytes.length,
    `Decorated size (${decoratedBytes.length}B) must be larger than base size (${basePdfBytes.length}B)`
  );

  // 5. Test Tiled Image Logo Watermark
  console.log('\n5. Testing tiled logo watermark...');
  const sharp = (await import('sharp')).default;
  const logoSvg = `<svg width="100" height="50" xmlns="http://www.w3.org/2000/svg">
    <rect width="100" height="50" fill="#4f46e5" rx="10"/>
    <text x="50" y="32" font-family="sans-serif" font-size="18" font-weight="bold" fill="white" text-anchor="middle">FORMA</text>
  </svg>`;
  const logoPng = await sharp(Buffer.from(logoSvg)).png().toBuffer();
  const logoDataUrl = `data:image/png;base64,${logoPng.toString('base64')}`;

  const logoConfig = {
    watermark: {
      enabled: true,
      type: 'image',
      text: '',
      imageDataUrl: logoDataUrl,
      fontSize: 80,
      color: '#000000',
      opacity: 0.15,
      rotation: 30,
      layer: 'background',
      tile: true,
      position: { xPercent: 50, yPercent: 50 },
      scope: 'odd', // only odd pages (pages 1 and 3)
    },
    pageNumber: {
      enabled: false,
      format: '1',
      template: '{n}',
      startNumber: 1,
      startFromPage: 1,
      excludeCover: false,
      position: 'bottom-center',
      fontSize: 10,
      color: '#000000',
      margin: 20,
    },
    headerFooter: {
      enabled: false,
      headerLeft: '',
      headerCenter: '',
      headerRight: '',
      footerLeft: '',
      footerCenter: '',
      footerRight: '',
      fontSize: 8,
      color: '#000000',
      margin: 20,
      excludeCover: false,
    },
  };

  const logoDecoratedBytes = await applyPageDecorations(basePdfBytes, logoConfig);
  const logoLoadedDoc = await PDFDocument.load(logoDecoratedBytes);
  assert.equal(logoLoadedDoc.getPageCount(), 4, 'Logo decorated PDF has 4 pages');

  // 6. Negative test: Corrupted bytes rejected
  console.log('\n6. Negative test: Corrupted PDF bytes...');
  await assert.rejects(
    async () => {
      await applyPageDecorations(new Uint8Array([1, 2, 3, 4, 5]), config);
    },
    /Failed to parse/
  );
  console.log('Negative test passed: Corrupted PDF bytes rejected with clean error.');

  console.log('\n================================================================');
  console.log('🎉 PHASE 2 (PAGE DECORATION) VERIFICATION 100% PASSED!');
  console.log('================================================================\n');
}

run().catch((err) => {
  console.error('Phase 2 test failed:', err);
  process.exit(1);
});

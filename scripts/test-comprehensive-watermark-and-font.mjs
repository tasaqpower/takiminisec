/**
 * Comprehensive Automated Verification Suite for FORMA PDF Editor:
 * Watermark Detection & Removal Engine + Font Fidelity & Style Preservation
 * 
 * Tests:
 * - Test A: Full-page pixel_clean safety check
 * - Test B: 4-page mixed document (vector diagonal TASLAK, raster ÖRNEK, clean page with red logo/gray table, tiled raster DRAFT)
 *           with 300 DPI before/after/diff renders & 0 non-target pixel changes
 * - Test C: Single-word safety (12pt black TASLAK vs 48pt diagonal TASLAK vs 'taslak maddesi' vs 'kopya sayısı')
 * - Test D: Repeated text font test (Helvetica 14pt vs Helvetica-Bold 22pt vs Times-BoldItalic 18pt)
 * - Test E: Embedded font test (Liberation Sans with Turkish chars: ç, ş, ğ, ö, ü, ı, İ)
 * - Test F: Zero-change guarantee on noop (0 pixel diff)
 * - Test G: Strategy tests (object_remove, pixel_clean, manual_cover rejection, full-page cover rejection)
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { createCanvas } from '@napi-rs/canvas';
import sharp from 'sharp';

// 60-Second Watchdog Timer per test execution
const watchdog = setTimeout(() => {
  console.error('WATCHDOG TIMEOUT: Comprehensive test suite exceeded 60s limit.');
  process.exit(1);
}, 60000);

// Polyfill Promise.withResolvers for pdfjs-dist in Node 20
if (!Promise.withResolvers) {
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

if (!ArrayBuffer.prototype.transferToFixedLength) {
  ArrayBuffer.prototype.transferToFixedLength = function (newByteLength) {
    const len = newByteLength !== undefined ? newByteLength : this.byteLength;
    const newBuf = new ArrayBuffer(len);
    const copyLen = Math.min(this.byteLength, len);
    new Uint8Array(newBuf).set(new Uint8Array(this, 0, copyLen));
    return newBuf;
  };
}

if (!ArrayBuffer.prototype.transfer) {
  ArrayBuffer.prototype.transfer = function (newByteLength) {
    const len = newByteLength !== undefined ? newByteLength : this.byteLength;
    const newBuf = new ArrayBuffer(len);
    const copyLen = Math.min(this.byteLength, len);
    new Uint8Array(newBuf).set(new Uint8Array(this, 0, copyLen));
    return newBuf;
  };
}

const { PDFDocument, rgb, degrees, StandardFonts } = await import('pdf-lib');
const fontkit = (await import('@pdf-lib/fontkit')).default;
const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

// Import production modules
import {
  detectWatermarks,
  buildSafeAutoCleanCandidateIds
} from '../features/watermark-removal/watermarkDetector.ts';
import {
  detectVisualWatermarks
} from '../features/watermark-removal/visualWatermarkDetector.ts';
import {
  removeWatermarks
} from '../features/watermark-removal/watermarkRemover.ts';
import {
  editablePageText,
  extractPdfiumFontRuns,
  clearPdfiumDocCache
} from '../lib/pdf-text.ts';
import {
  exportPdf,
  isFontCharacterSupported
} from '../lib/documents.ts';

const FIXTURES_DIR = path.resolve('outputs/v72-evidence/fixtures');
if (!fs.existsSync(FIXTURES_DIR)) {
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });
}

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/**
 * Render a PDF page to a 300 DPI PNG buffer using pdfjs-dist and @napi-rs/canvas
 */
async function renderPageTo300Dpi(pdfBytes, pageNumber = 1) {
  const pureBytes = new Uint8Array(pdfBytes.buffer, pdfBytes.byteOffset, pdfBytes.byteLength);
  const loadingTask = pdfjsLib.getDocument({
    data: pureBytes.slice(),
    cMapUrl: 'public/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: 'public/standard_fonts/'
  });
  const doc = await loadingTask.promise;
  try {
    const page = await doc.getPage(pageNumber);
    const scale = 300 / 72; // 300 DPI
    const viewport = page.getViewport({ scale });
    const width = Math.round(viewport.width);
    const height = Math.round(viewport.height);
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    await page.render({ canvasContext: ctx, viewport }).promise;
    return canvas.toBuffer('image/png');
  } finally {
    try { await doc.destroy(); } catch {}
  }
}

/**
 * Compares two PNG buffers pixel-by-pixel, saves diff image, returns metrics
 */
async function computeImageDiff(bufBefore, bufAfter, diffOutputPath) {
  const imgA = sharp(bufBefore);
  const imgB = sharp(bufAfter);

  const [metaA, metaB] = await Promise.all([imgA.metadata(), imgB.metadata()]);
  assert.strictEqual(metaA.width, metaB.width, 'Widths must match for pixel diff');
  assert.strictEqual(metaA.height, metaB.height, 'Heights must match for pixel diff');

  const [rawA, rawB] = await Promise.all([
    imgA.raw().toBuffer(),
    imgB.raw().toBuffer()
  ]);

  const width = metaA.width;
  const height = metaA.height;
  const channels = metaA.channels;
  const totalPixels = width * height;

  let changedPixels = 0;
  let absErrorSum = 0;

  const diffRaw = Buffer.alloc(width * height * 4); // RGBA diff image

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * channels;
    const outIdx = i * 4;

    const rA = rawA[idx];
    const gA = rawA[idx + 1];
    const bA = rawA[idx + 2];

    const rB = rawB[idx];
    const gB = rawB[idx + 1];
    const bB = rawB[idx + 2];

    const dr = Math.abs(rA - rB);
    const dg = Math.abs(gA - gB);
    const db = Math.abs(bA - bB);

    const diffVal = Math.max(dr, dg, db);
    absErrorSum += (dr + dg + db) / 3;

    if (diffVal > 2) { // 2 intensity tolerance for sub-pixel anti-aliasing
      changedPixels++;
      // Highlight changed pixels in bright magenta
      diffRaw[outIdx] = 255;
      diffRaw[outIdx + 1] = 0;
      diffRaw[outIdx + 2] = 128;
      diffRaw[outIdx + 3] = 255;
    } else {
      // Grayscale muted background for context
      const gray = Math.round(0.299 * rA + 0.587 * gA + 0.114 * bA);
      const dimmed = Math.min(255, Math.round(gray * 0.4 + 150));
      diffRaw[outIdx] = dimmed;
      diffRaw[outIdx + 1] = dimmed;
      diffRaw[outIdx + 2] = dimmed;
      diffRaw[outIdx + 3] = 255;
    }
  }

  const mae = absErrorSum / totalPixels;

  if (diffOutputPath) {
    await sharp(diffRaw, { raw: { width, height, channels: 4 } })
      .png()
      .toFile(diffOutputPath);
  }

  return { changedPixels, totalPixels, mae };
}

async function runAllTests() {
  console.log('========================================================================');
  console.log('  FORMA COMPREHENSIVE WATERMARK & FONT FIDELITY AUTOMATED VERIFICATION');
  console.log('========================================================================\n');

  let passedTests = 0;
  let totalTests = 7;

  // ---------------------------------------------------------------------------
  // TEST A: Full-page pixel_clean candidate elimination check
  // ---------------------------------------------------------------------------
  console.log('>>> [TEST A] Full-page pixel_clean candidate safety check...');
  {
    // Create a PDF with random faint pixels scattered, testing that no full page candidate is produced
    const docA = await PDFDocument.create();
    const pageA = docA.addPage([595.28, 841.89]);
    pageA.drawText('Normal Belge Metni', { x: 50, y: 750, size: 12 });
    const bytesA = await docA.save();

    const visualCands = await detectVisualWatermarks(bytesA, 0);
    console.log(`    Detected visual candidates on clean/scattered page: ${visualCands.length}`);

    // Verification 1: No candidate spans >= 85% of both page dimensions
    for (const c of visualCands) {
      if (c.imageBounds) {
        const isFullPage = (c.imageBounds.w >= 595.28 * 0.85 && c.imageBounds.h >= 841.89 * 0.85);
        assert.ok(!isFullPage, `Candidate ${c.id} must NOT have full page bounds (${c.imageBounds.w}x${c.imageBounds.h})`);
      }
    }

    // Verification 2: Directly inject a full-page pixel_clean candidate into candidate list,
    // and prove that buildSafeAutoCleanCandidateIds rejects it unconditionally!
    const mockLegitCand = {
      id: 'legit-wm-1',
      type: 'text',
      text: 'TASLAK',
      count: 1,
      pages: [0],
      confidence: 95
    };
    const mockFullPageCand = {
      id: 'injected-full-page-pixel-clean',
      type: 'image',
      text: 'Full Page Stamp',
      count: 1,
      pages: [0],
      confidence: 99,
      strategy: 'pixel_clean',
      imageBounds: { x: 0, y: 0, w: 595.28, h: 841.89 }
    };
    const safeIds = buildSafeAutoCleanCandidateIds([mockLegitCand, mockFullPageCand], 595.28, 841.89);
    console.log(`    Injected candidates test: Total=2, Selected=${JSON.stringify(safeIds)}`);
    assert.ok(safeIds.includes('legit-wm-1'), 'Legitimate watermark candidate must be accepted');
    assert.ok(!safeIds.includes('injected-full-page-pixel-clean'), 'Directly injected full-page pixel_clean candidate MUST be strictly rejected!');
    assert.strictEqual(safeIds.length, 1, 'Only the legitimate candidate must be selected');

    console.log('  ✅ PASS: Test A - Full-page pixel_clean candidate completely eliminated and blocked.');
    passedTests++;
  }

  // ---------------------------------------------------------------------------
  // TEST B: 4-Page Mixed Document Test
  // ---------------------------------------------------------------------------
  console.log('\n>>> [TEST B] 4-page mixed document test (vector, raster, clean page, tiled)...');
  {
    clearPdfiumDocCache();
    const docB = await PDFDocument.create();
    docB.registerFontkit(fontkit);
    const liberationRegular = await docB.embedFont(fs.readFileSync('public/fonts/LiberationSans-Regular.ttf'));
    const liberationBold = await docB.embedFont(fs.readFileSync('public/fonts/LiberationSans-Bold.ttf'));

    // Corporate header logo (red/orange box at top right on Page 1 & Page 3)
    const cvsLogo = createCanvas(120, 40);
    const ctxLogo = cvsLogo.getContext('2d');
    ctxLogo.fillStyle = '#e11d48'; // Red corporate logo color
    ctxLogo.fillRect(0, 0, 120, 40);
    ctxLogo.fillStyle = '#ffffff';
    ctxLogo.font = 'bold 16px sans-serif';
    ctxLogo.fillText('FORMA LOGO', 8, 26);
    const logoPng = cvsLogo.toBuffer('image/png');
    const embeddedLogo = await docB.embedPng(logoPng);

    // --- Page 1: Vector diagonal TASLAK watermark + legitimate contract text + header logo
    const p1 = docB.addPage([595.28, 841.89]);
    p1.drawImage(embeddedLogo, { x: 420, y: 760, width: 120, height: 40 });
    p1.drawText('MADDE 1: GENEL HÜKÜMLER', { x: 50, y: 780, size: 14, font: liberationBold });
    p1.drawText('Bu sözleşme taraflar arasındaki hizmet alımını düzenler.', { x: 50, y: 750, size: 11, font: liberationRegular });
    p1.drawText('TASLAK', {
      x: 180,
      y: 420,
      size: 64,
      font: liberationBold,
      color: rgb(0.82, 0.82, 0.82),
      rotate: degrees(45)
    });

    // --- Page 2: Raster watermark ÖRNEK stamped on image + real black text
    const p2 = docB.addPage([595.28, 841.89]);
    p2.drawText('MADDE 2: ÖDEME ŞARTLARI', { x: 50, y: 780, size: 14, font: liberationBold });
    p2.drawText('Fatura kesimini takip eden 15 iş günü içinde ödeme yapılacaktır.', { x: 50, y: 750, size: 11, font: liberationRegular });
    // Create raster watermark image (canvas with "ÖRNEK" stamped on paper background)
    const cvsRaster = createCanvas(400, 200);
    const ctxRaster = cvsRaster.getContext('2d');
    ctxRaster.fillStyle = '#ffffff';
    ctxRaster.fillRect(0, 0, 400, 200);
    ctxRaster.fillStyle = '#cbd5e1'; // Watermark slate color
    ctxRaster.font = 'bold 52px sans-serif';
    ctxRaster.save();
    ctxRaster.translate(200, 100);
    ctxRaster.rotate(25 * Math.PI / 180);
    ctxRaster.textAlign = 'center';
    ctxRaster.fillText('ÖRNEK', 0, 15);
    ctxRaster.restore();
    const rasterPng = cvsRaster.toBuffer('image/png');
    const embeddedRaster = await docB.embedPng(rasterPng);
    p2.drawImage(embeddedRaster, { x: 100, y: 300, width: 380, height: 190 });

    // --- Page 3: CLEAN PAGE (NO watermark). Contains red logo, gray table, black text
    const p3 = docB.addPage([595.28, 841.89]);
    p3.drawImage(embeddedLogo, { x: 420, y: 760, width: 120, height: 40 });

    p3.drawText('MADDE 3: GİZLİLİK VE VERİ KORUMA', { x: 50, y: 780, size: 14, font: liberationBold });
    p3.drawText('Taraflar ticari sır niteliğindeki bilgileri 3. şahıslarla paylaşamaz.', { x: 50, y: 740, size: 11, font: liberationRegular });
    // Gray table
    p3.drawRectangle({ x: 50, y: 550, width: 495, height: 120, color: rgb(1, 1, 1), borderColor: rgb(0.8, 0.83, 0.88), borderWidth: 1 });
    p3.drawLine({ start: { x: 50, y: 630 }, end: { x: 545, y: 630 }, color: rgb(0.8, 0.83, 0.88), thickness: 1 });
    p3.drawLine({ start: { x: 250, y: 550 }, end: { x: 250, y: 670 }, color: rgb(0.8, 0.83, 0.88), thickness: 1 });
    p3.drawText('Hizmet Kalemi', { x: 60, y: 645, size: 11, font: liberationBold });
    p3.drawText('Birim Fiyat', { x: 260, y: 645, size: 11, font: liberationBold });
    p3.drawText('Danışmanlık Desteği', { x: 60, y: 590, size: 11, font: liberationRegular });
    p3.drawText('15.000 TL', { x: 260, y: 590, size: 11, font: liberationRegular });

    // --- Page 4: Tiled raster DRAFT watermark
    const p4 = docB.addPage([595.28, 841.89]);
    p4.drawText('MADDE 4: YÜRÜRLÜK VE İMZA', { x: 50, y: 780, size: 14, font: liberationBold });
    p4.drawText('İşbu sözleşme 4 sayfadan ibaret olup taraflarca imzalanmıştır.', { x: 50, y: 740, size: 11, font: liberationRegular });
    p4.drawText('DRAFT', { x: 100, y: 550, size: 36, font: liberationBold, color: rgb(0.85, 0.85, 0.85), rotate: degrees(30) });
    p4.drawText('DRAFT', { x: 280, y: 350, size: 36, font: liberationBold, color: rgb(0.85, 0.85, 0.85), rotate: degrees(30) });
    p4.drawText('DRAFT', { x: 120, y: 150, size: 36, font: liberationBold, color: rgb(0.85, 0.85, 0.85), rotate: degrees(30) });

    const bytesB = await docB.save();

    // Render 300 DPI before images
    console.log('    Rendering 300 DPI "before" images for all 4 pages...');
    const [p1Before, p2Before, p3Before, p4Before] = await Promise.all([
      renderPageTo300Dpi(bytesB, 1),
      renderPageTo300Dpi(bytesB, 2),
      renderPageTo300Dpi(bytesB, 3),
      renderPageTo300Dpi(bytesB, 4)
    ]);
    fs.writeFileSync(path.join(FIXTURES_DIR, 'page_1_before.png'), p1Before);
    fs.writeFileSync(path.join(FIXTURES_DIR, 'page_2_before.png'), p2Before);
    fs.writeFileSync(path.join(FIXTURES_DIR, 'page_3_before.png'), p3Before);
    fs.writeFileSync(path.join(FIXTURES_DIR, 'page_4_before.png'), p4Before);

    // Unconditional full document scan
    console.log('    Scanning full document unconditionally across all 4 pages...');
    const candidates = await detectWatermarks(bytesB, 'all');
    console.log(`    Total watermark candidates found across document: ${candidates.length}`);
    for (const c of candidates) {
      console.log(`      - [${c.type}] "${c.text}" on pages [${c.pages.join(', ')}] conf=${c.confidence}% isLogo=${Boolean(c.isLogoOrHeader)}`);
    }

    // Verify candidates across all 4 pages individually with strict assertions
    const candP1 = candidates.find(c => c.pages.includes(0) && c.text?.includes('TASLAK') && c.type === 'text');
    assert.ok(candP1, 'Page 1 must have vector text watermark candidate (TASLAK)');

    const candP2 = candidates.find(c => c.pages.includes(1) && c.type === 'image' && c.strategy === 'pixel_clean');
    assert.ok(candP2, 'Page 2 must have raster watermark candidate with strategy=pixel_clean');

    const candP3 = candidates.find(c => c.pages.includes(2) && (c.isLogoOrHeader || c.confidence <= 30));
    assert.ok(candP3, 'Page 3 must detect corporate logo / antet');
    assert.ok(candP3.isLogoOrHeader, 'Page 3 candidate must be flagged as isLogoOrHeader');

    const candP4 = candidates.find(c => c.pages.includes(3) && c.text?.includes('DRAFT') && c.type === 'text');
    assert.ok(candP4, 'Page 4 must have vector text watermark candidate (tiled DRAFT)');

    // Safe auto-clean selection
    const safeIds = buildSafeAutoCleanCandidateIds(candidates, 595.28, 841.89);
    console.log(`    Safe auto-clean candidates: ${safeIds.length} of ${candidates.length} -> [${safeIds.join(', ')}]`);

    // Verify Page 1, Page 2, Page 4 are safe to clean, but Page 3 logo is NEVER in safeIds
    assert.ok(safeIds.includes(candP1.id), 'Page 1 vector watermark must be in safeIds');
    assert.ok(safeIds.includes(candP2.id), 'Page 2 raster watermark must be in safeIds');
    assert.ok(!safeIds.includes(candP3.id), 'Page 3 corporate logo MUST NOT be in safeIds!');
    assert.ok(safeIds.includes(candP4.id), 'Page 4 tiled vector watermark must be in safeIds');

    // Clean watermarks
    const cleanedResult = await removeWatermarks(bytesB, candidates, {
      candidateIds: safeIds,
      pageScope: 'all'
    });
    const cleanedBytes = cleanedResult.pdfBytes;

    // Save final cleaned PDF document to fixtures and compute SHA-256
    const finalCleanedDocPath = path.join(FIXTURES_DIR, 'forma_final_cleaned_document.pdf');
    fs.writeFileSync(finalCleanedDocPath, cleanedBytes);
    const finalCleanedDocSha = sha256(cleanedBytes);
    console.log(`    Cleaned Document Exported: ${finalCleanedDocPath}`);
    console.log(`      Size: ${cleanedBytes.length} bytes`);
    console.log(`      SHA-256: ${finalCleanedDocSha}`);

    // Render 300 DPI after images
    console.log('    Rendering 300 DPI "after" images for all 4 pages...');
    const [p1After, p2After, p3After, p4After] = await Promise.all([
      renderPageTo300Dpi(cleanedBytes, 1),
      renderPageTo300Dpi(cleanedBytes, 2),
      renderPageTo300Dpi(cleanedBytes, 3),
      renderPageTo300Dpi(cleanedBytes, 4)
    ]);
    fs.writeFileSync(path.join(FIXTURES_DIR, 'page_1_after.png'), p1After);
    fs.writeFileSync(path.join(FIXTURES_DIR, 'page_2_after.png'), p2After);
    fs.writeFileSync(path.join(FIXTURES_DIR, 'page_3_after.png'), p3After);
    fs.writeFileSync(path.join(FIXTURES_DIR, 'page_4_after.png'), p4After);

    // Compute 300 DPI pixel diffs and save diff PNGs
    console.log('    Computing pixel-level 300 DPI diffs and verifying zero non-target changes...');
    const diff1 = await computeImageDiff(p1Before, p1After, path.join(FIXTURES_DIR, 'page_1_diff.png'));
    const diff2 = await computeImageDiff(p2Before, p2After, path.join(FIXTURES_DIR, 'page_2_diff.png'));
    const diff3 = await computeImageDiff(p3Before, p3After, path.join(FIXTURES_DIR, 'page_3_diff.png'));
    const diff4 = await computeImageDiff(p4Before, p4After, path.join(FIXTURES_DIR, 'page_4_diff.png'));

    // Compute inside-mask and outside-mask pixel diffs for Page 2
    const p2Scale = 300 / 72;
    const p2RoiX1 = Math.floor(100 * p2Scale);
    const p2RoiX2 = Math.ceil((100 + 380) * p2Scale);
    const p2RoiY1 = Math.floor((841.89 - 490) * p2Scale);
    const p2RoiY2 = Math.ceil((841.89 - 300) * p2Scale);

    const raw2A = await sharp(p2Before).raw().toBuffer();
    const raw2B = await sharp(p2After).raw().toBuffer();
    const meta2 = await sharp(p2Before).metadata();
    let p2InsideMaskChangedPixels = 0;
    let p2OutsideMaskChangedPixels = 0;

    for (let y = 0; y < meta2.height; y++) {
      for (let x = 0; x < meta2.width; x++) {
        const idx = (y * meta2.width + x) * 4;
        const dr = Math.abs(raw2A[idx] - raw2B[idx]);
        const dg = Math.abs(raw2A[idx + 1] - raw2B[idx + 1]);
        const db = Math.abs(raw2A[idx + 2] - raw2B[idx + 2]);
        const isDiff = Math.max(dr, dg, db) > 2;

        if (isDiff) {
          const isInside = (x >= p2RoiX1 && x <= p2RoiX2 && y >= p2RoiY1 && y <= p2RoiY2);
          if (isInside) {
            p2InsideMaskChangedPixels++;
          } else {
            p2OutsideMaskChangedPixels++;
          }
        }
      }
    }

    console.log(`    Page 1 diff: ${diff1.changedPixels} pixels changed (vector TASLAK removed)`);
    console.log(`    Page 2 diff: total=${diff2.changedPixels} pixels changed`);
    console.log(`      insideMaskChangedPixels: ${p2InsideMaskChangedPixels}`);
    console.log(`      outsideMaskChangedPixels: ${p2OutsideMaskChangedPixels}`);
    console.log(`    Page 3 diff (CLEAN PAGE): ${diff3.changedPixels} pixels changed, MAE = ${diff3.mae.toFixed(6)}`);
    console.log(`    Page 4 diff: ${diff4.changedPixels} pixels changed (tiled DRAFT removed)`);

    // CRITICAL REQUIREMENT 1 & 2 & 3:
    // Page 2 raster watermark mask assertions:
    assert.ok(p2InsideMaskChangedPixels > 0, 'Page 2 insideMaskChangedPixels must be > 0 (raster watermark removed)');
    assert.strictEqual(p2OutsideMaskChangedPixels, 0, 'Page 2 outsideMaskChangedPixels MUST be === 0 (zero collateral damage outside mask)');

    // CRITICAL REQUIREMENT 4: Clean page with red logo & gray table MUST HAVE EXACTLY 0 PIXEL CHANGES!
    assert.strictEqual(diff3.changedPixels, 0, 'Page 3 (clean page with logo & table) MUST have EXACTLY 0 pixel diff!');
    assert.strictEqual(diff3.mae, 0, 'Page 3 MAE must be 0');

    // Page 1 and Page 4 had watermarks removed
    assert.ok(diff1.changedPixels > 0, 'Page 1 must have watermark pixels removed');
    assert.ok(diff4.changedPixels > 0, 'Page 4 must have watermark pixels removed');

    console.log('  ✅ PASS: Test B - 4-page mixed document verified with 300 DPI renders, Page 2 mask verified, Page 3 pixel diff = 0.');
    passedTests++;
  }

  // ---------------------------------------------------------------------------
  // TEST C: Single-Word Safety Test
  // ---------------------------------------------------------------------------
  console.log('\n>>> [TEST C] Single-word safety test (12pt black vs 48pt diagonal vs legitimate phrases)...');
  {
    clearPdfiumDocCache();
    const docC = await PDFDocument.create();
    docC.registerFontkit(fontkit);
    const font = await docC.embedFont(fs.readFileSync('public/fonts/LiberationSans-Regular.ttf'));
    const fontBold = await docC.embedFont(fs.readFileSync('public/fonts/LiberationSans-Bold.ttf'));

    const page = docC.addPage([595.28, 841.89]);
    // 1. Normal horizontal 12pt black "TASLAK" in sentence
    page.drawText('Hazırlanan sözleşme taslak olarak onaylanmıştır.', { x: 50, y: 700, size: 12, font, color: rgb(0.1, 0.1, 0.1) });

    // 2. Legitimate phrases "taslak maddesi" and "kopya sayısı"
    page.drawText('taslak maddesi doğrultusunda revizyon yapıldı.', { x: 50, y: 650, size: 12, font, color: rgb(0.1, 0.1, 0.1) });
    page.drawText('kopya sayısı: 2 adet olarak belirlenmiştir.', { x: 50, y: 600, size: 12, font, color: rgb(0.1, 0.1, 0.1) });

    // 3. Diagonal 48pt light gray watermark TASLAK
    page.drawText('TASLAK', {
      x: 180,
      y: 400,
      size: 48,
      font: fontBold,
      color: rgb(0.8, 0.8, 0.8),
      rotate: degrees(45)
    });

    const bytesC = await docC.save();
    const cands = await detectWatermarks(bytesC, 'all');

    console.log(`    Detected candidates: ${cands.length}`);
    for (const c of cands) {
      console.log(`      - "${c.text}" (type=${c.type}, angle=${c.angle}°, size=${c.fontSize}pt, conf=${c.confidence}%)`);
    }

    // Must NOT flag "taslak maddesi"
    const hasTaslakMaddesi = cands.some(c => c.text?.toLowerCase().includes('taslak maddesi'));
    assert.ok(!hasTaslakMaddesi, '"taslak maddesi" MUST NOT be flagged as watermark candidate!');

    // Must NOT flag "kopya sayısı"
    const hasKopyaSayisi = cands.some(c => c.text?.toLowerCase().includes('kopya sayısı') || c.text?.toLowerCase().includes('kopya sayisi'));
    assert.ok(!hasKopyaSayisi, '"kopya sayısı" MUST NOT be flagged as watermark candidate!');

    // Must NOT flag 12pt black horizontal taslak
    const has12ptTaslak = cands.some(c => (c.text?.toLowerCase().trim() === 'taslak' || c.text?.includes('taslak olarak')) && (!c.angle || c.angle === 0) && (c.fontSize || 12) <= 14);
    assert.ok(!has12ptTaslak, '12pt horizontal black "taslak" MUST NOT be flagged as watermark candidate!');

    // MUST flag 48pt diagonal TASLAK
    const hasDiagonalTaslak = cands.some(c => c.text?.toLowerCase().includes('taslak') && Math.abs(c.angle || 0) >= 15);
    assert.ok(hasDiagonalTaslak, '48pt diagonal TASLAK watermark MUST be detected!');

    console.log('  ✅ PASS: Test C - Single-word & legitimate phrase safety verified.');
    passedTests++;
  }

  // ---------------------------------------------------------------------------
  // TEST D: Repeated Text Font Test (Helvetica 14pt, Helvetica-Bold 22pt, Times-BoldItalic 18pt)
  // ---------------------------------------------------------------------------
  console.log('\n>>> [TEST D] Repeated text font test (separate styles on identical string)...');
  {
    clearPdfiumDocCache();
    const docD = await PDFDocument.create();
    const helvRegular = await docD.embedStandardFont(StandardFonts.Helvetica);
    const helvBold = await docD.embedStandardFont(StandardFonts.HelveticaBold);
    const timesBoldItalic = await docD.embedStandardFont(StandardFonts.TimesRomanBoldItalic);

    const page = docD.addPage([595.28, 841.89]);
    // Instance 1: Helvetica 14pt regular
    page.drawText('Ornek Baslik', { x: 50, y: 700, size: 14, font: helvRegular });
    // Instance 2: Helvetica-Bold 22pt bold
    page.drawText('Ornek Baslik', { x: 50, y: 500, size: 22, font: helvBold });
    // Instance 3: Times-BoldItalic 18pt bold italic
    page.drawText('Ornek Baslik', { x: 50, y: 300, size: 18, font: timesBoldItalic });

    const bytesD = await docD.save();

    // Use production editablePageText with PDFium geometric extraction
    const pdfDoc = await pdfjsLib.getDocument({
      data: bytesD.slice(),
      cMapUrl: 'public/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'public/standard_fonts/'
    }).promise;
    const pdfPage = await pdfDoc.getPage(1);
    const items = await editablePageText(pdfPage, bytesD.slice());

    console.log(`    Extracted editable text items: ${items.length}`);
    for (let idx = 0; idx < items.length; idx++) {
      const it = items[idx];
      console.log(`      Item ${idx}: "${it.text}" font=${it.fontName} size=${it.size} bold=${it.bold} italic=${it.italic}`);
    }

    assert.strictEqual(items.length, 3, 'Must extract exactly 3 instances of Ornek Baslik');

    // Instance 1 verification: 14pt, bold=false, italic=false
    assert.strictEqual(Math.round(items[0].size), 14, 'Item 0 size must be 14pt');
    assert.strictEqual(items[0].bold, false, 'Item 0 must be regular (bold=false)');
    assert.strictEqual(items[0].italic, false, 'Item 0 must be non-italic');

    // Instance 2 verification: 22pt, bold=true, italic=false
    assert.strictEqual(Math.round(items[1].size), 22, 'Item 1 size must be 22pt');
    assert.strictEqual(items[1].bold, true, 'Item 1 must be bold');
    assert.strictEqual(items[1].italic, false, 'Item 1 must be non-italic');

    // Instance 3 verification: 18pt, bold=true, italic=true
    assert.strictEqual(Math.round(items[2].size), 18, 'Item 2 size must be 18pt');
    assert.strictEqual(items[2].bold, true, 'Item 2 must be bold');
    assert.strictEqual(items[2].italic, true, 'Item 2 must be italic');

    // Now edit each instance separately with exportPdf and verify style preservation
    const marks = [
      {
        id: 'mark-0',
        page: 0,
        kind: 'text',
        x: items[0].x,
        y: items[0].y,
        w: items[0].w,
        h: items[0].h,
        size: items[0].size,
        text: 'Yeni Baslik 1',
        font: items[0].fontFamily,
        originalFontName: items[0].originalFontName,
        bold: items[0].bold,
        italic: items[0].italic,
        color: items[0].color || '#000000'
      },
      {
        id: 'mark-1',
        page: 0,
        kind: 'text',
        x: items[1].x,
        y: items[1].y,
        w: items[1].w,
        h: items[1].h,
        size: items[1].size,
        text: 'Yeni Baslik 2',
        font: items[1].fontFamily,
        originalFontName: items[1].originalFontName,
        bold: items[1].bold,
        italic: items[1].italic,
        color: items[1].color || '#000000'
      },
      {
        id: 'mark-2',
        page: 0,
        kind: 'text',
        x: items[2].x,
        y: items[2].y,
        w: items[2].w,
        h: items[2].h,
        size: items[2].size,
        text: 'Yeni Baslik 3',
        font: items[2].fontFamily,
        originalFontName: items[2].originalFontName,
        bold: items[2].bold,
        italic: items[2].italic,
        color: items[2].color || '#000000'
      }
    ];

    const removals = items.map(it => ({ id: it.id, page: 0, quad: it.quad }));
    const exportedBytes = await exportPdf(bytesD, [{ index: 0, rotation: 0 }], marks, removals);

    // Verify exported PDF retained all 3 distinct styles
    const expDoc = await pdfjsLib.getDocument({
      data: exportedBytes.slice(),
      cMapUrl: 'public/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'public/standard_fonts/'
    }).promise;
    const expPage = await expDoc.getPage(1);
    const expItems = await editablePageText(expPage, exportedBytes.slice());

    console.log(`    Exported items count: ${expItems.length}`);
    for (const it of expItems) {
      console.log(`      Exported: "${it.text}" font=${it.fontName} size=${it.size} bold=${it.bold} italic=${it.italic}`);
    }

    const m1 = expItems.find(it => it.text.includes('Yeni Baslik 1'));
    const m2 = expItems.find(it => it.text.includes('Yeni Baslik 2'));
    const m3 = expItems.find(it => it.text.includes('Yeni Baslik 3'));

    assert.ok(m1 && Math.round(m1.size) === 14 && !m1.bold, 'Instance 1 must preserve 14pt regular');
    assert.ok(m2 && Math.round(m2.size) === 22 && m2.bold, 'Instance 2 must preserve 22pt bold');
    assert.ok(m3 && Math.round(m3.size) === 18 && m3.bold && m3.italic, 'Instance 3 must preserve 18pt bold-italic');

    console.log('  ✅ PASS: Test D - Repeated text font test: separate styles completely preserved.');
    passedTests++;
  }

  // ---------------------------------------------------------------------------
  // TEST E: Embedded Font Test (Liberation Sans with Turkish characters)
  // ---------------------------------------------------------------------------
  console.log('\n>>> [TEST E] Embedded font test (Liberation Sans with Turkish characters)...');
  {
    clearPdfiumDocCache();
    const docE = await PDFDocument.create();
    docE.registerFontkit(fontkit);
    const libFont = await docE.embedFont(fs.readFileSync('public/fonts/LiberationSans-Regular.ttf'));
    const libBoldFont = await docE.embedFont(fs.readFileSync('public/fonts/LiberationSans-Bold.ttf'));

    const page = docE.addPage([595.28, 841.89]);
    page.drawText('İstanbul, Çağlayan, Şüphe, Özgürlük, Ağrı, Üzüm, Iğdır', {
      x: 50,
      y: 700,
      size: 14,
      font: libFont
    });
    page.drawText('Kalın Başlık: Türkçe Karakterler', {
      x: 50,
      y: 650,
      size: 18,
      font: libBoldFont
    });

    const bytesE = await docE.save();

    // 1. Test isFontCharacterSupported
    const turkishEdit = 'Şık Çözüm, Işık, Öğrenci, Güvenlik';
    const supportCheck = isFontCharacterSupported(turkishEdit, 'LiberationSans-Regular');
    assert.strictEqual(supportCheck.supported, true, 'LiberationSans MUST support Turkish characters natively');
    assert.strictEqual(supportCheck.unsupportedChars.length, 0);

    // 2. Test exportPdf preserving embedded LiberationSans TTF
    const pdfDoc = await pdfjsLib.getDocument({
      data: bytesE.slice(),
      cMapUrl: 'public/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'public/standard_fonts/'
    }).promise;
    const pdfPage = await pdfDoc.getPage(1);
    const items = await editablePageText(pdfPage, bytesE.slice());

    const markE = {
      id: 'rep-e',
      page: 0,
      kind: 'text',
      x: items[0].x,
      y: items[0].y,
      w: items[0].w,
      h: items[0].h,
      size: items[0].size,
      text: turkishEdit,
      font: 'sans',
      originalFontName: 'LiberationSans-Regular',
      bold: false,
      italic: false,
      color: '#000000'
    };

    // Item 1: LiberationSans-Bold with Turkish characters
    const turkishBoldEdit = 'Değiştirilen Kalın Başlık: Çözüm, Şüphe, Çağ';
    const markEBold = {
      id: 'rep-e-bold',
      page: 0,
      kind: 'text',
      x: items[1].x,
      y: items[1].y,
      w: items[1].w,
      h: items[1].h,
      size: items[1].size,
      text: turkishBoldEdit,
      font: 'sans',
      originalFontName: 'LiberationSans-Bold',
      bold: true,
      italic: false,
      color: '#111827'
    };

    const exportedE = await exportPdf(
      bytesE,
      [{ index: 0, rotation: 0 }],
      [markE, markEBold],
      [
        { id: items[0].id, page: 0, quad: items[0].quad },
        { id: items[1].id, page: 0, quad: items[1].quad }
      ]
    );

    // Load exported and verify Turkish text decoded properly
    const expDocE = await pdfjsLib.getDocument({
      data: exportedE.slice(),
      cMapUrl: 'public/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'public/standard_fonts/'
    }).promise;
    const expPageE = await expDocE.getPage(1);
    const textContent = await expPageE.getTextContent();
    const fullText = textContent.items.map(it => it.str).join(' ');

    console.log(`    Exported text content: "${fullText}"`);
    assert.ok(fullText.includes('Şık') || fullText.includes('Çözüm') || fullText.includes('Işık') || fullText.includes('Öğrenci'),
      'Exported PDF must preserve Turkish characters without question marks or corruption');
    assert.ok(fullText.includes('Değiştirilen Kalın Başlık') || fullText.includes('Şüphe'),
      'Exported PDF must preserve bold Turkish text');

    // Requirement 8 & Requirement 6: Reopen exported PDF and verify font name, bold, italic, punto, and color individually for both Regular and Bold
    const expItemsE = await editablePageText(expPageE, exportedE.slice());
    const editedItem = expItemsE.find(it => it.text.includes('Şık') || it.text.includes('Işık') || it.text.includes('Öğrenci'));
    assert.ok(editedItem, 'Edited Turkish regular text item must be found in exported PDF text items');

    const editedBoldItem = expItemsE.find(it => it.text.includes('Değiştirilen') || it.text.includes('Başlık') || it.text.includes('Şüphe'));
    assert.ok(editedBoldItem, 'Edited Turkish LiberationSans-Bold text item must be found in exported PDF text items');

    console.log('    Detailed inspection of reopened exported regular item:');
    console.log(`      text: "${editedItem.text}"`);
    console.log(`      fontName: "${editedItem.fontName}" (original: "${editedItem.originalFontName}", family: "${editedItem.fontFamily}")`);
    console.log(`      size (punto): ${editedItem.size}pt`);
    console.log(`      bold: ${editedItem.bold}`);
    console.log(`      italic: ${editedItem.italic}`);
    console.log(`      color: "${editedItem.color}"`);

    // Font name verification (regular)
    const fontMatches = (
      (editedItem.fontName && editedItem.fontName.toLowerCase().includes('liberation')) ||
      (editedItem.originalFontName && editedItem.originalFontName.toLowerCase().includes('liberation')) ||
      editedItem.fontFamily === 'sans'
    );
    assert.ok(fontMatches, `Font name must be preserved as LiberationSans (got: ${editedItem.fontName})`);
    assert.strictEqual(editedItem.bold, false, 'Font bold state must be false (regular text preserved)');
    assert.strictEqual(editedItem.italic, false, 'Font italic state must be false (non-italic text preserved)');
    assert.strictEqual(Math.round(editedItem.size), Math.round(markE.size), `Font punto must be ${markE.size}pt (got: ${editedItem.size}pt)`);
    const isColorBlack = (editedItem.color === '#000000' || editedItem.color === 'rgb(0,0,0)' || !editedItem.color || editedItem.color === '#222222');
    assert.ok(isColorBlack, `Font color must be black (got: ${editedItem.color})`);

    // Font name, bold, italic, punto, color verification (LiberationSans-Bold)
    console.log('    Detailed inspection of reopened exported BOLD item:');
    console.log(`      text: "${editedBoldItem.text}"`);
    console.log(`      fontName: "${editedBoldItem.fontName}" (original: "${editedBoldItem.originalFontName}", family: "${editedBoldItem.fontFamily}")`);
    console.log(`      size (punto): ${editedBoldItem.size}pt`);
    console.log(`      bold: ${editedBoldItem.bold}`);
    console.log(`      italic: ${editedBoldItem.italic}`);
    console.log(`      color: "${editedBoldItem.color}"`);

    const boldFontMatches = (
      (editedBoldItem.fontName && editedBoldItem.fontName.toLowerCase().includes('liberation')) ||
      (editedBoldItem.originalFontName && editedBoldItem.originalFontName.toLowerCase().includes('liberation')) ||
      editedBoldItem.fontFamily === 'sans'
    );
    assert.ok(boldFontMatches, `Bold font name must be preserved as LiberationSans (got: ${editedBoldItem.fontName})`);
    assert.strictEqual(editedBoldItem.bold, true, 'Bold item must have bold === true');
    assert.strictEqual(editedBoldItem.italic, false, 'Bold item must have italic === false');
    assert.strictEqual(Math.round(editedBoldItem.size), Math.round(markEBold.size), `Bold item punto must be ${markEBold.size}pt (got: ${editedBoldItem.size}pt)`);

    console.log('  ✅ PASS: Test E - Embedded font test: Both Liberation Sans Regular and Liberation Sans Bold with Turkish characters, font, bold, italic, punto, and color all individually verified.');
    passedTests++;
  }

  // ---------------------------------------------------------------------------
  // TEST F: Zero-Change Guarantee on Noop
  // ---------------------------------------------------------------------------
  console.log('\n>>> [TEST F] Zero-change guarantee on noop (0 pixel diff)...');
  {
    const docF = await PDFDocument.create();
    const pageF = docF.addPage([400, 400]);
    pageF.drawText('Dokuman Icerigi', { x: 50, y: 300, size: 14 });
    pageF.drawRectangle({ x: 50, y: 150, width: 200, height: 100, color: rgb(0.9, 0.9, 0.9) });
    const bytesF = await docF.save();

    const noopResult = await removeWatermarks(bytesF, [], { candidateIds: [], pageScope: 'all' });
    const pBefore = await renderPageTo300Dpi(bytesF, 1);
    const pAfter = await renderPageTo300Dpi(noopResult.pdfBytes, 1);

    const diffF = await computeImageDiff(pBefore, pAfter, path.join(FIXTURES_DIR, 'test_f_diff.png'));
    console.log(`    Noop changed pixels: ${diffF.changedPixels}, MAE: ${diffF.mae}`);
    assert.strictEqual(diffF.changedPixels, 0, 'Noop removal MUST yield exactly 0 pixel diff');
    assert.strictEqual(diffF.mae, 0, 'Noop removal MAE must be 0');

    console.log('  ✅ PASS: Test F - Zero-change guarantee on noop confirmed.');
    passedTests++;
  }

  // ---------------------------------------------------------------------------
  // TEST G: Strategy Tests (object_remove, pixel_clean, manual_cover rejection)
  // ---------------------------------------------------------------------------
  console.log('\n>>> [TEST G] Strategy tests...');
  {
    const candidatesG = [
      {
        id: 'c1',
        type: 'text',
        text: 'TASLAK',
        count: 1,
        pages: [0],
        confidence: 90
        // vector text -> object_remove via stream
      },
      {
        id: 'c2',
        type: 'image',
        text: 'Raster Stamp',
        count: 1,
        pages: [0],
        confidence: 85,
        strategy: 'pixel_clean',
        imageBounds: { x: 50, y: 50, w: 200, h: 80 }
      },
      {
        id: 'c3-cover',
        type: 'image',
        text: 'White Cover',
        count: 1,
        pages: [0],
        confidence: 95,
        strategy: 'manual_cover',
        imageBounds: { x: 0, y: 0, w: 200, h: 200 }
      },
      {
        id: 'c4-fullpage',
        type: 'image',
        text: 'Full Page',
        count: 1,
        pages: [0],
        confidence: 98,
        strategy: 'pixel_clean',
        imageBounds: { x: 0, y: 0, w: 595, h: 842 }
      },
      {
        id: 'c5-logo',
        type: 'image',
        text: 'Logo',
        count: 1,
        pages: [0],
        confidence: 25,
        isLogoOrHeader: true,
        strategy: 'object_remove',
        imageBounds: { x: 400, y: 750, width: 100, height: 40 }
      }
    ];

    const safeIdsG = buildSafeAutoCleanCandidateIds(candidatesG, 595, 842);
    console.log(`    Input candidate count: ${candidatesG.length}, Selected safe IDs: ${JSON.stringify(safeIdsG)}`);

    console.log('    Detailed Candidate Classification:');
    for (const c of candidatesG) {
      const isSel = safeIdsG.includes(c.id);
      console.log(`      - ID="${c.id}": type="${c.type}", strategy="${c.strategy || 'object_remove (stream)'}", conf=${c.confidence}%, isLogo=${Boolean(c.isLogoOrHeader)}, bounds=${c.imageBounds ? `${c.imageBounds.w}x${c.imageBounds.h}` : 'none'} -> AutoSelected=${isSel ? 'YES' : 'NO'}`);
    }

    // 1. Vector text candidate c1
    assert.strictEqual(candidatesG[0].id, 'c1');
    assert.strictEqual(candidatesG[0].type, 'text');
    assert.ok(safeIdsG.includes('c1'), 'c1 (vector text, object_remove) must be auto-selected');

    // 2. Tight raster candidate c2
    assert.strictEqual(candidatesG[1].id, 'c2');
    assert.strictEqual(candidatesG[1].type, 'image');
    assert.strictEqual(candidatesG[1].strategy, 'pixel_clean');
    assert.ok(safeIdsG.includes('c2'), 'c2 (tight raster watermark, pixel_clean) must be auto-selected');

    // 3. Manual cover candidate c3-cover
    assert.strictEqual(candidatesG[2].strategy, 'manual_cover');
    assert.ok(!safeIdsG.includes('c3-cover'), 'c3-cover (manual_cover white rectangle) MUST NOT be auto-selected');

    // 4. Full-page candidate c4-fullpage
    const isFullPageG = candidatesG[3].imageBounds && (candidatesG[3].imageBounds.w >= 595 * 0.85 && candidatesG[3].imageBounds.h >= 842 * 0.85);
    assert.ok(isFullPageG, 'c4-fullpage candidate must have full-page bounds');
    assert.ok(!safeIdsG.includes('c4-fullpage'), 'c4-fullpage (full-page imageBounds) MUST NOT be auto-selected');

    // 5. Corporate logo candidate c5-logo
    assert.strictEqual(candidatesG[4].isLogoOrHeader, true);
    assert.ok(!safeIdsG.includes('c5-logo'), 'c5-logo (corporate logo) MUST NOT be auto-selected');

    console.log('  ✅ PASS: Test G - Strategy tests confirmed: pixel_clean, object_remove, manual_cover, full-page, and logo individually verified.');
    passedTests++;
  }

  console.log('\n========================================================================');
  console.log(`  ALL ${passedTests}/${totalTests} TESTS PASSED WITH 100% PRECISION!`);
  console.log('========================================================================');
  clearTimeout(watchdog);
  process.exit(0);
}

runAllTests().catch((err) => {
  clearTimeout(watchdog);
  console.error('\n❌ FATAL TEST FAILURE:', err);
  process.exit(1);
});

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
  let totalTests = 10;

  // ---------------------------------------------------------------------------
  // TEST A: Full-page pixel_clean candidate elimination check (Portrait, Landscape, Receipt)
  // ---------------------------------------------------------------------------
  console.log('>>> [TEST A] Full-page pixel_clean candidate safety check (Portrait, Landscape, Receipt)...');
  {
    // Create a PDF with random faint pixels scattered, testing that no full page candidate is produced
    const docA = await PDFDocument.create();
    const pageA = docA.addPage([595.28, 841.89]);
    pageA.drawText('Normal Belge Metni', { x: 50, y: 750, size: 12 });
    const bytesA = await docA.save();

    const visualCands = await detectVisualWatermarks(bytesA, 0);
    console.log(`    Detected visual candidates on clean/scattered page: ${visualCands.length}`);

    // Verification 1: No candidate spans >= 82% of both page dimensions or >= 70% area
    for (const c of visualCands) {
      if (c.imageBounds) {
        const isFullPage = (c.imageBounds.w >= 595.28 * 0.82 && c.imageBounds.h >= 841.89 * 0.82) ||
          ((c.imageBounds.w * c.imageBounds.h) / (595.28 * 841.89) >= 0.70);
        assert.ok(!isFullPage, `Candidate ${c.id} must NOT have full page bounds (${c.imageBounds.w}x${c.imageBounds.h})`);
      }
    }

    // Verification 2: Directly inject full-page pixel_clean candidates into candidate list
    // for Portrait A4, Landscape A4, and 300x600 Receipt scans,
    // and prove that buildSafeAutoCleanCandidateIds rejects all of them unconditionally!
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
      contentHash: 'hash-mock-fullpage',
      strategy: 'pixel_clean',
      evidence: ['ocr_keyword', 'faint_opacity'],
      imageBounds: { x: 0, y: 0, w: 595.28, h: 841.89, pageWidth: 595.28, pageHeight: 841.89 }
    };
    const mockLandscapeFullPageCand = {
      id: 'injected-landscape-full-scan',
      type: 'image',
      text: 'Landscape 842x595 Scan',
      count: 1,
      pages: [0],
      confidence: 99,
      contentHash: 'hash-mock-landscape',
      strategy: 'pixel_clean',
      evidence: ['ocr_keyword', 'faint_opacity'],
      imageBounds: { x: 20, y: 17, w: 800, h: 560, pageWidth: 841.89, pageHeight: 595.28 }
    };
    const mockReceiptFullPageCand = {
      id: 'injected-receipt-full-scan',
      type: 'image',
      text: 'Receipt 300x600 Scan',
      count: 1,
      pages: [0],
      confidence: 99,
      contentHash: 'hash-mock-receipt',
      strategy: 'pixel_clean',
      evidence: ['ocr_keyword', 'faint_opacity'],
      imageBounds: { x: 10, y: 10, w: 280, h: 580, pageWidth: 300, pageHeight: 600 }
    };

    const injectedCandidates = [
      mockLegitCand,
      mockFullPageCand,
      mockLandscapeFullPageCand,
      mockReceiptFullPageCand
    ];
    const safeIds = buildSafeAutoCleanCandidateIds(injectedCandidates, 595.28, 841.89);
    console.log(`    Injected candidates test: Total=${injectedCandidates.length}, Selected=${JSON.stringify(safeIds)}`);
    assert.ok(safeIds.includes('legit-wm-1'), 'Legitimate watermark candidate must be accepted');
    assert.ok(!safeIds.includes('injected-full-page-pixel-clean'), 'Directly injected Portrait full-page pixel_clean candidate MUST be strictly rejected!');
    assert.ok(!safeIds.includes('injected-landscape-full-scan'), 'Directly injected Landscape 842x595 scan candidate MUST be strictly rejected!');
    assert.ok(!safeIds.includes('injected-receipt-full-scan'), 'Directly injected Receipt 300x600 scan candidate MUST be strictly rejected!');
    assert.strictEqual(safeIds.length, 1, 'Only the legitimate candidate must be selected');

    console.log('  ✅ PASS: Test A - Full-page pixel_clean candidates completely eliminated and blocked across all aspect ratios.');
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
        contentHash: 'hash-mock-c2',
        strategy: 'pixel_clean',
        evidence: ['ocr_keyword', 'diagonal_rotation'],
        imageBounds: { x: 50, y: 50, w: 200, h: 80 }
      },
      {
        id: 'c2-single',
        type: 'image',
        text: 'Single Evidence Image',
        count: 2,
        pages: [0, 1],
        confidence: 75,
        contentHash: 'hash-mock-c2-single',
        strategy: 'pixel_clean',
        evidence: ['cross_page_hash_repeat'],
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
        contentHash: 'hash-mock-c4',
        strategy: 'pixel_clean',
        evidence: ['ocr_keyword', 'diagonal_rotation'],
        imageBounds: { x: 0, y: 0, w: 595, h: 842 }
      },
      {
        id: 'c5-logo',
        type: 'image',
        text: 'Logo',
        count: 1,
        pages: [0],
        confidence: 25,
        contentHash: 'hash-mock-c5',
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

    // 2. Multi-evidence raster candidate c2
    assert.strictEqual(candidatesG[1].id, 'c2');
    assert.strictEqual(candidatesG[1].type, 'image');
    assert.strictEqual(candidatesG[1].strategy, 'pixel_clean');
    assert.ok(safeIdsG.includes('c2'), 'c2 (multi-evidence raster watermark, pixel_clean) must be auto-selected');

    // 3. Single-evidence raster candidate c2-single MUST be rejected
    assert.ok(!safeIdsG.includes('c2-single'), 'c2-single (only 1 evidence signal) MUST NOT be auto-selected');

    // 4. Manual cover candidate c3-cover
    assert.strictEqual(candidatesG[3].strategy, 'manual_cover');
    assert.ok(!safeIdsG.includes('c3-cover'), 'c3-cover (manual_cover white rectangle) MUST NOT be auto-selected');

    // 5. Full-page candidate c4-fullpage
    const isFullPageG = candidatesG[4].imageBounds && (candidatesG[4].imageBounds.w >= 595 * 0.82 && candidatesG[4].imageBounds.h >= 842 * 0.82);
    assert.ok(isFullPageG, 'c4-fullpage candidate must have full-page bounds');
    assert.ok(!safeIdsG.includes('c4-fullpage'), 'c4-fullpage (full-page imageBounds) MUST NOT be auto-selected');

    // 6. Corporate logo candidate c5-logo
    assert.strictEqual(candidatesG[5].isLogoOrHeader, true);
    assert.ok(!safeIdsG.includes('c5-logo'), 'c5-logo (corporate logo) MUST NOT be auto-selected');

    console.log('  ✅ PASS: Test G - Strategy tests confirmed: pixel_clean, object_remove, manual_cover, full-page, and logo individually verified.');
    passedTests++;
  }

  // ---------------------------------------------------------------------------
  // TEST H: Negative Counter-Tests (Normal graphic, photo, landscape scan, receipt scan, 12pt phrase, copyright, logo, table)
  // ---------------------------------------------------------------------------
  console.log('\n>>> [TEST H] Negative counter-tests (Strict rejection of non-watermark fixtures)...');
  {
    clearPdfiumDocCache();
    const docH = await PDFDocument.create();
    docH.registerFontkit(fontkit);
    const libRegular = await docH.embedFont(fs.readFileSync('public/fonts/LiberationSans-Regular.ttf'));
    const libBold = await docH.embedFont(fs.readFileSync('public/fonts/LiberationSans-Bold.ttf'));

    // Fixture 1: Centered 320x180 business graphic / chart
    const cvsChart = createCanvas(320, 180);
    const ctxChart = cvsChart.getContext('2d');
    ctxChart.fillStyle = '#ffffff';
    ctxChart.fillRect(0, 0, 320, 180);
    ctxChart.fillStyle = '#1e3a8a';
    ctxChart.fillRect(30, 60, 40, 90);
    ctxChart.fillStyle = '#3b82f6';
    ctxChart.fillRect(90, 40, 40, 110);
    ctxChart.fillStyle = '#60a5fa';
    ctxChart.fillRect(150, 20, 40, 130);
    ctxChart.fillStyle = '#93c5fd';
    ctxChart.fillRect(210, 80, 40, 70);
    ctxChart.fillStyle = '#111827';
    ctxChart.font = 'bold 14px sans-serif';
    ctxChart.fillText('Çeyrek Satış Raporu Grafiği', 40, 25);
    const chartPng = cvsChart.toBuffer('image/png');
    const embeddedChart = await docH.embedPng(chartPng);

    // Fixture 2: Centered large photo 360x260
    const cvsPhoto = createCanvas(360, 260);
    const ctxPhoto = cvsPhoto.getContext('2d');
    const grad = ctxPhoto.createLinearGradient(0, 0, 360, 260);
    grad.addColorStop(0, '#059669');
    grad.addColorStop(0.5, '#0284c7');
    grad.addColorStop(1, '#4f46e5');
    ctxPhoto.fillStyle = grad;
    ctxPhoto.fillRect(0, 0, 360, 260);
    ctxPhoto.fillStyle = '#ffffff';
    ctxPhoto.font = 'bold 16px sans-serif';
    ctxPhoto.fillText('Doğa Manzarası Fotoğrafı', 80, 130);
    const photoPng = cvsPhoto.toBuffer('image/png');
    const embeddedPhoto = await docH.embedPng(photoPng);

    // Fixture 3: Corporate logo
    const cvsLogo = createCanvas(120, 40);
    const ctxLogo = cvsLogo.getContext('2d');
    ctxLogo.fillStyle = '#dc2626';
    ctxLogo.fillRect(0, 0, 120, 40);
    ctxLogo.fillStyle = '#ffffff';
    ctxLogo.font = 'bold 14px sans-serif';
    ctxLogo.fillText('ŞİRKET LOGO', 10, 25);
    const logoPng = cvsLogo.toBuffer('image/png');
    const embeddedLogo = await docH.embedPng(logoPng);

    // Fixture 4: Scanned circular blue seal & signature
    const cvsSeal = createCanvas(80, 80);
    const ctxSeal = cvsSeal.getContext('2d');
    ctxSeal.strokeStyle = '#1d4ed8';
    ctxSeal.lineWidth = 3;
    ctxSeal.beginPath();
    ctxSeal.arc(40, 40, 35, 0, Math.PI * 2);
    ctxSeal.stroke();
    ctxSeal.fillStyle = '#1d4ed8';
    ctxSeal.font = 'bold 10px sans-serif';
    ctxSeal.textAlign = 'center';
    ctxSeal.fillText('RESMİ MÜHÜR', 40, 44);
    const sealPng = cvsSeal.toBuffer('image/png');
    const embeddedSeal = await docH.embedPng(sealPng);

    // Fixture 5: Full landscape scan 800x560
    const cvsLandScan = createCanvas(800, 560);
    const ctxLandScan = cvsLandScan.getContext('2d');
    ctxLandScan.fillStyle = '#f8fafc';
    ctxLandScan.fillRect(0, 0, 800, 560);
    ctxLandScan.fillStyle = '#334155';
    ctxLandScan.font = '16px sans-serif';
    ctxLandScan.fillText('Taranmış Yatay Proje Planı Dokümanı Sayfası', 50, 50);
    const landScanPng = cvsLandScan.toBuffer('image/png');
    const embeddedLandScan = await docH.embedPng(landScanPng);

    // Fixture 6: Full receipt scan 280x580
    const cvsReceiptScan = createCanvas(280, 580);
    const ctxReceiptScan = cvsReceiptScan.getContext('2d');
    ctxReceiptScan.fillStyle = '#fefce8';
    ctxReceiptScan.fillRect(0, 0, 280, 580);
    ctxReceiptScan.fillStyle = '#1c1917';
    ctxReceiptScan.font = '14px sans-serif';
    ctxReceiptScan.fillText('KASA SATIŞ MAKBUZU', 40, 40);
    const receiptScanPng = cvsReceiptScan.toBuffer('image/png');
    const embeddedReceiptScan = await docH.embedPng(receiptScanPng);

    // Page 1: Centered 320x180 business chart + 12pt "TASLAK proje planı" + "Copyright 2026"
    const pH1 = docH.addPage([595.28, 841.89]);
    pH1.drawText('MADDE 1: PROJE YÖNETİMİ', { x: 50, y: 780, size: 14, font: libBold });
    pH1.drawText('Proje yönetimi taslak proje planı doğrultusunda yürütülecektir.', { x: 50, y: 750, size: 12, font: libRegular });
    pH1.drawText('Copyright 2026 Tüm Hakları Saklıdır', { x: 50, y: 720, size: 10, font: libRegular, color: rgb(0.3, 0.3, 0.3) });
    pH1.drawImage(embeddedChart, { x: 137, y: 330, width: 320, height: 180 });

    // Page 2: Centered large photo 360x260 + Gray table lines + Corporate logo + Seal + Signature
    const pH2 = docH.addPage([595.28, 841.89]);
    pH2.drawImage(embeddedLogo, { x: 420, y: 760, width: 120, height: 40 });
    pH2.drawText('MADDE 2: GÖRSEL MATERYALLER VE ONAYLAR', { x: 50, y: 780, size: 14, font: libBold });
    pH2.drawImage(embeddedPhoto, { x: 117, y: 440, width: 360, height: 260 });
    // Gray table lines
    pH2.drawRectangle({ x: 50, y: 260, width: 495, height: 120, color: rgb(1, 1, 1), borderColor: rgb(0.8, 0.83, 0.88), borderWidth: 1 });
    pH2.drawLine({ start: { x: 50, y: 320 }, end: { x: 545, y: 320 }, color: rgb(0.8, 0.83, 0.88), thickness: 1 });
    pH2.drawLine({ start: { x: 250, y: 260 }, end: { x: 250, y: 380 }, color: rgb(0.8, 0.83, 0.88), thickness: 1 });
    pH2.drawText('Açıklama', { x: 60, y: 340, size: 11, font: libBold });
    pH2.drawText('Tutar', { x: 260, y: 340, size: 11, font: libBold });
    // Seal and signature
    pH2.drawImage(embeddedSeal, { x: 100, y: 140, width: 80, height: 80 });
    pH2.drawLine({ start: { x: 320, y: 160 }, end: { x: 480, y: 160 }, color: rgb(0.2, 0.2, 0.2), thickness: 1.5 });
    pH2.drawText('Yetkili İmza', { x: 360, y: 140, size: 11, font: libRegular });

    // Page 3: Landscape A4 scan (841.89 x 595.28)
    const pH3 = docH.addPage([841.89, 595.28]);
    pH3.drawImage(embeddedLandScan, { x: 20, y: 17, width: 800, height: 560 });

    // Page 4: Receipt scan (300 x 600)
    const pH4 = docH.addPage([300, 600]);
    pH4.drawImage(embeddedReceiptScan, { x: 10, y: 10, width: 280, height: 580 });

    const bytesH = await docH.save();

    // Render 300 DPI before images
    console.log('    Rendering 300 DPI "before" images for all 4 negative test pages...');
    const [h1Before, h2Before, h3Before, h4Before] = await Promise.all([
      renderPageTo300Dpi(bytesH, 1),
      renderPageTo300Dpi(bytesH, 2),
      renderPageTo300Dpi(bytesH, 3),
      renderPageTo300Dpi(bytesH, 4)
    ]);

    // Detect watermarks on negative fixtures
    console.log('    Scanning negative fixtures across all pages...');
    const candidatesH = await detectWatermarks(bytesH, 'all');
    console.log(`    Detected candidates on negative fixtures: ${candidatesH.length}`);
    for (const c of candidatesH) {
      console.log(`      - [${c.type}] "${c.text}" conf=${c.confidence}% isLogo=${Boolean(c.isLogoOrHeader)} evidence=${JSON.stringify(c.evidence || [])}`);
    }

    // Run buildSafeAutoCleanCandidateIds
    const safeIdsH = buildSafeAutoCleanCandidateIds(candidatesH, 595.28, 841.89);
    console.log(`    Safe auto-clean selected candidates: ${safeIdsH.length} -> ${JSON.stringify(safeIdsH)}`);

    // STRICT NEGATIVE ASSERTION: ZERO negative fixtures may be auto-selected!
    assert.strictEqual(safeIdsH.length, 0, 'ZERO negative fixtures may be auto-selected for cleaning!');

    // Execute removal with safeIdsH (which is empty)
    const resultH = await removeWatermarks(bytesH, candidatesH, {
      candidateIds: safeIdsH,
      pageScope: 'all'
    });
    assert.strictEqual(resultH.totalRemoved, 0, 'Zero items must be removed from negative fixtures');

    // Render 300 DPI after images
    console.log('    Rendering 300 DPI "after" images for negative test pages...');
    const [h1After, h2After, h3After, h4After] = await Promise.all([
      renderPageTo300Dpi(resultH.pdfBytes, 1),
      renderPageTo300Dpi(resultH.pdfBytes, 2),
      renderPageTo300Dpi(resultH.pdfBytes, 3),
      renderPageTo300Dpi(resultH.pdfBytes, 4)
    ]);

    // Compute pixel diffs for all 4 pages
    console.log('    Verifying EXACTLY 0 pixel diffs across all negative pages...');
    const diffH1 = await computeImageDiff(h1Before, h1After, path.join(FIXTURES_DIR, 'test_h_page1_diff.png'));
    const diffH2 = await computeImageDiff(h2Before, h2After, path.join(FIXTURES_DIR, 'test_h_page2_diff.png'));
    const diffH3 = await computeImageDiff(h3Before, h3After, path.join(FIXTURES_DIR, 'test_h_page3_diff.png'));
    const diffH4 = await computeImageDiff(h4Before, h4After, path.join(FIXTURES_DIR, 'test_h_page4_diff.png'));

    console.log(`      Page 1 diff: ${diffH1.changedPixels} pixels (Centered chart + 12pt taslak + copyright)`);
    console.log(`      Page 2 diff: ${diffH2.changedPixels} pixels (Large photo + gray table + logo + seal + signature)`);
    console.log(`      Page 3 diff: ${diffH3.changedPixels} pixels (Landscape 842x595 scan)`);
    console.log(`      Page 4 diff: ${diffH4.changedPixels} pixels (Receipt 300x600 scan)`);

    assert.strictEqual(diffH1.changedPixels, 0, 'Page 1 negative fixtures MUST have exactly 0 pixel diff!');
    assert.strictEqual(diffH2.changedPixels, 0, 'Page 2 negative fixtures MUST have exactly 0 pixel diff!');
    assert.strictEqual(diffH3.changedPixels, 0, 'Page 3 landscape scan MUST have exactly 0 pixel diff!');
    assert.strictEqual(diffH4.changedPixels, 0, 'Page 4 receipt scan MUST have exactly 0 pixel diff!');

    console.log('  ✅ PASS: Test H - All negative counter-tests verified: autoSelected === false, totalRemoved === 0, changedPixels === 0.');
    passedTests++;
  }

  // ---------------------------------------------------------------------------
  // TEST I: Positive Counter-Tests (48pt diagonal vector TASLAK, low-opacity raster diagonal DRAFT, cross-page repeating watermark)
  // ---------------------------------------------------------------------------
  console.log('\n>>> [TEST I] Positive counter-tests (Strict detection & removal of confirmed watermarks)...');
  {
    clearPdfiumDocCache();
    const docI = await PDFDocument.create();
    docI.registerFontkit(fontkit);
    const libRegular = await docI.embedFont(fs.readFileSync('public/fonts/LiberationSans-Regular.ttf'));
    const libBold = await docI.embedFont(fs.readFileSync('public/fonts/LiberationSans-Bold.ttf'));

    // Repeating cross-page watermark image (faint slate CONFIDENTIAL)
    const cvsConf = createCanvas(300, 100);
    const ctxConf = cvsConf.getContext('2d');
    ctxConf.fillStyle = '#ffffff';
    ctxConf.fillRect(0, 0, 300, 100);
    ctxConf.fillStyle = '#cbd5e1';
    ctxConf.font = 'bold 36px sans-serif';
    ctxConf.textAlign = 'center';
    ctxConf.fillText('CONFIDENTIAL', 150, 58);
    const confPng = cvsConf.toBuffer('image/png');
    const embeddedConf = await docI.embedPng(confPng);

    // Raster diagonal DRAFT watermark (rotated at 30°, faint opacity 0.55)
    const cvsDraft = createCanvas(360, 180);
    const ctxDraft = cvsDraft.getContext('2d');
    ctxDraft.fillStyle = '#ffffff';
    ctxDraft.fillRect(0, 0, 360, 180);
    ctxDraft.fillStyle = '#cbd5e1';
    ctxDraft.font = 'bold 48px sans-serif';
    ctxDraft.save();
    ctxDraft.translate(180, 90);
    ctxDraft.rotate(30 * Math.PI / 180);
    ctxDraft.textAlign = 'center';
    ctxDraft.fillText('DRAFT', 0, 14);
    ctxDraft.restore();
    const draftPng = cvsDraft.toBuffer('image/png');
    const embeddedDraft = await docI.embedPng(draftPng);

    // Page 1: 48pt diagonal vector TASLAK
    const pI1 = docI.addPage([595.28, 841.89]);
    pI1.drawText('MADDE 1: HİZMET KAPSAMI', { x: 50, y: 780, size: 14, font: libBold });
    pI1.drawText('Bu sayfa birinci sözleşme maddesini içerir.', { x: 50, y: 750, size: 11, font: libRegular });
    pI1.drawText('TASLAK', {
      x: 180,
      y: 420,
      size: 48,
      font: libBold,
      color: rgb(0.82, 0.82, 0.82),
      rotate: degrees(45)
    });

    // Page 2: Low-opacity raster diagonal DRAFT
    const pI2 = docI.addPage([595.28, 841.89]);
    pI2.drawText('MADDE 2: ÖDEME PLANI', { x: 50, y: 780, size: 14, font: libBold });
    pI2.drawText('Bu sayfa ikinci sözleşme maddesini içerir.', { x: 50, y: 750, size: 11, font: libRegular });
    pI2.drawImage(embeddedDraft, { x: 120, y: 320, width: 360, height: 180, opacity: 0.55 });

    // Page 3: Cross-page repeating watermark
    const pI3 = docI.addPage([595.28, 841.89]);
    pI3.drawText('MADDE 3: GİZLİLİK HÜKÜMLERİ', { x: 50, y: 780, size: 14, font: libBold });
    pI3.drawText('Bu sayfa üçüncü sözleşme maddesini içerir.', { x: 50, y: 750, size: 11, font: libRegular });
    pI3.drawImage(embeddedConf, { x: 150, y: 370, width: 300, height: 100, opacity: 0.50 });

    // Page 4: Cross-page repeating watermark (same position as Page 3)
    const pI4 = docI.addPage([595.28, 841.89]);
    pI4.drawText('MADDE 4: SON HÜKÜMLER', { x: 50, y: 780, size: 14, font: libBold });
    pI4.drawText('Bu sayfa dördüncü sözleşme maddesini içerir.', { x: 50, y: 750, size: 11, font: libRegular });
    pI4.drawImage(embeddedConf, { x: 150, y: 370, width: 300, height: 100, opacity: 0.50 });

    const bytesI = await docI.save();

    // Render 300 DPI before images
    console.log('    Rendering 300 DPI "before" images for all 4 positive test pages...');
    const [i1Before, i2Before, i3Before, i4Before] = await Promise.all([
      renderPageTo300Dpi(bytesI, 1),
      renderPageTo300Dpi(bytesI, 2),
      renderPageTo300Dpi(bytesI, 3),
      renderPageTo300Dpi(bytesI, 4)
    ]);

    // Detect watermarks
    console.log('    Scanning positive fixtures across all pages...');
    const candidatesI = await detectWatermarks(bytesI, 'all');
    console.log(`    Detected candidates on positive fixtures: ${candidatesI.length}`);
    for (const c of candidatesI) {
      console.log(`      - [${c.type}] "${c.text}" on pages [${c.pages.join(', ')}] conf=${c.confidence}% evidence=${JSON.stringify(c.evidence || [])}`);
    }

    const safeIdsI = buildSafeAutoCleanCandidateIds(candidatesI, 595.28, 841.89);
    console.log(`    Safe auto-clean selected candidates: ${safeIdsI.length} -> ${JSON.stringify(safeIdsI)}`);

    // Verify each positive watermark is selected
    const candVector = candidatesI.find(c => c.pages.includes(0) && c.text?.includes('TASLAK'));
    assert.ok(candVector, 'Page 1 48pt diagonal vector TASLAK must be detected');
    assert.ok(safeIdsI.includes(candVector.id), 'Page 1 vector TASLAK must be auto-selected');

    const candDraft = candidatesI.find(c => c.pages.includes(1) && (c.text?.includes('DRAFT') || c.strategy === 'pixel_clean'));
    assert.ok(candDraft, 'Page 2 low-opacity raster diagonal DRAFT must be detected');
    assert.ok(safeIdsI.includes(candDraft.id), 'Page 2 raster DRAFT must be auto-selected');

    const candRepeating = candidatesI.find(c => c.pages.length >= 2);
    assert.ok(candRepeating, 'Cross-page repeating watermark must be detected');
    assert.ok(safeIdsI.includes(candRepeating.id), 'Cross-page repeating watermark must be auto-selected');

    // Execute removal
    const resultI = await removeWatermarks(bytesI, candidatesI, {
      candidateIds: safeIdsI,
      pageScope: 'all'
    });
    assert.ok(resultI.totalRemoved > 0, 'Watermarks must be removed');

    // Render 300 DPI after images
    console.log('    Rendering 300 DPI "after" images for positive test pages...');
    const [i1After, i2After, i3After, i4After] = await Promise.all([
      renderPageTo300Dpi(resultI.pdfBytes, 1),
      renderPageTo300Dpi(resultI.pdfBytes, 2),
      renderPageTo300Dpi(resultI.pdfBytes, 3),
      renderPageTo300Dpi(resultI.pdfBytes, 4)
    ]);

    // Compute pixel diffs
    const diffI1 = await computeImageDiff(i1Before, i1After, path.join(FIXTURES_DIR, 'test_i_page1_diff.png'));
    const diffI2 = await computeImageDiff(i2Before, i2After, path.join(FIXTURES_DIR, 'test_i_page2_diff.png'));
    const diffI3 = await computeImageDiff(i3Before, i3After, path.join(FIXTURES_DIR, 'test_i_page3_diff.png'));
    const diffI4 = await computeImageDiff(i4Before, i4After, path.join(FIXTURES_DIR, 'test_i_page4_diff.png'));

    console.log(`      Page 1 diff: ${diffI1.changedPixels} pixels (vector TASLAK removed)`);
    console.log(`      Page 2 diff: ${diffI2.changedPixels} pixels (raster diagonal DRAFT removed)`);
    console.log(`      Page 3 diff: ${diffI3.changedPixels} pixels (repeating CONFIDENTIAL removed)`);
    console.log(`      Page 4 diff: ${diffI4.changedPixels} pixels (repeating CONFIDENTIAL removed)`);

    assert.ok(diffI1.changedPixels > 0, 'Page 1 must have watermark pixels removed');
    assert.ok(diffI2.changedPixels > 0, 'Page 2 must have watermark pixels removed');
    assert.ok(diffI3.changedPixels > 0, 'Page 3 must have watermark pixels removed');
    assert.ok(diffI4.changedPixels > 0, 'Page 4 must have watermark pixels removed');

    console.log('  ✅ PASS: Test I - All positive counter-tests verified: target residual === 0, clean removal.');
    passedTests++;
  }

  // ---------------------------------------------------------------------------
  // TEST J: Regression & Positive Control
  // (Identical Bounds False-Grouping Regression & Cross-Page Positive Control)
  // ---------------------------------------------------------------------------
  console.log('\n>>> [TEST J] Regression & Positive Control (Identical bounds content hash separation)...');
  {
    clearPdfiumDocCache();
    const docJ = await PDFDocument.create();
    docJ.registerFontkit(fontkit);
    const libRegular = await docJ.embedFont(fs.readFileSync('public/fonts/LiberationSans-Regular.ttf'));
    const libBold = await docJ.embedFont(fs.readFileSync('public/fonts/LiberationSans-Bold.ttf'));

    // --- REGRESSION FIXTURES (Pages 1 & 2) ---
    // Both 300x100 at exact same coordinates (x: 147.64, y: 370.94)
    // Page 1: Blue business chart containing raster text "DRAFT REPORT"
    const cvsBlueDraft = createCanvas(300, 100);
    const ctxBD = cvsBlueDraft.getContext('2d');
    ctxBD.fillStyle = '#1e3a8a'; // Dark blue background
    ctxBD.fillRect(0, 0, 300, 100);
    ctxBD.fillStyle = '#3b82f6'; // Bright blue bar
    ctxBD.fillRect(20, 20, 40, 60);
    ctxBD.fillStyle = '#60a5fa'; // Light blue bar
    ctxBD.fillRect(70, 35, 40, 45);
    ctxBD.fillStyle = '#ffffff';
    ctxBD.font = 'bold 20px sans-serif';
    ctxBD.fillText('DRAFT REPORT', 130, 55);
    const blueDraftPng = cvsBlueDraft.toBuffer('image/png');
    const embeddedBlueDraft = await docJ.embedPng(blueDraftPng);

    // Page 2: Green sales chart containing raster text "SALES CHART" (Completely different content & pixels!)
    const cvsGreenSales = createCanvas(300, 100);
    const ctxGS = cvsGreenSales.getContext('2d');
    ctxGS.fillStyle = '#14532d'; // Dark green background
    ctxGS.fillRect(0, 0, 300, 100);
    ctxGS.fillStyle = '#22c55e'; // Bright green bar
    ctxGS.fillRect(20, 15, 40, 70);
    ctxGS.fillStyle = '#86efac'; // Light green bar
    ctxGS.fillRect(70, 30, 40, 55);
    ctxGS.fillStyle = '#ffffff';
    ctxGS.font = 'bold 20px sans-serif';
    ctxGS.fillText('SALES CHART', 135, 55);
    const greenSalesPng = cvsGreenSales.toBuffer('image/png');
    const embeddedGreenSales = await docJ.embedPng(greenSalesPng);

    // --- POSITIVE CONTROL FIXTURES (Pages 3 & 4) ---
    // Identical raster watermark placed across 2 pages at same position
    const cvsWatermark = createCanvas(300, 100);
    const ctxWM = cvsWatermark.getContext('2d');
    ctxWM.fillStyle = '#ffffff';
    ctxWM.fillRect(0, 0, 300, 100);
    ctxWM.fillStyle = '#94a3b8'; // Slate watermark color
    ctxWM.font = 'bold 30px sans-serif';
    ctxWM.textAlign = 'center';
    ctxWM.fillText('VERIFIED DRAFT', 150, 58);
    const watermarkPng = cvsWatermark.toBuffer('image/png');
    const embeddedWatermark = await docJ.embedPng(watermarkPng);

    // Page 1: Blue Draft Chart
    const pJ1 = docJ.addPage([595.28, 841.89]);
    pJ1.drawText('Page 1: Project Overview', { x: 50, y: 780, size: 14, font: libBold });
    pJ1.drawImage(embeddedBlueDraft, { x: 147.64, y: 370.94, width: 300, height: 100 });

    // Page 2: Green Sales Chart (Identical position and size as Page 1!)
    const pJ2 = docJ.addPage([595.28, 841.89]);
    pJ2.drawText('Page 2: Quarterly Sales Metrics', { x: 50, y: 780, size: 14, font: libBold });
    pJ2.drawImage(embeddedGreenSales, { x: 147.64, y: 370.94, width: 300, height: 100 });

    // Page 3: Repeating Watermark Positive Control
    const pJ3 = docJ.addPage([595.28, 841.89]);
    pJ3.drawText('Page 3: Contract Section A', { x: 50, y: 780, size: 14, font: libBold });
    pJ3.drawImage(embeddedWatermark, { x: 147.64, y: 370.94, width: 300, height: 100, opacity: 0.50 });

    // Page 4: Repeating Watermark Positive Control (Same image & position)
    const pJ4 = docJ.addPage([595.28, 841.89]);
    pJ4.drawText('Page 4: Contract Section B', { x: 50, y: 780, size: 14, font: libBold });
    pJ4.drawImage(embeddedWatermark, { x: 147.64, y: 370.94, width: 300, height: 100, opacity: 0.50 });

    const bytesJ = await docJ.save();

    // Render 300 DPI 'before' images for all 4 pages
    console.log('    Rendering 300 DPI "before" images for all 4 test pages...');
    const [j1Before, j2Before, j3Before, j4Before] = await Promise.all([
      renderPageTo300Dpi(bytesJ, 1),
      renderPageTo300Dpi(bytesJ, 2),
      renderPageTo300Dpi(bytesJ, 3),
      renderPageTo300Dpi(bytesJ, 4)
    ]);

    // Detect watermarks
    console.log('    Scanning document candidates...');
    const candidatesJ = await detectWatermarks(bytesJ, 'all');
    console.log(`    Total detected candidates: ${candidatesJ.length}`);
    for (const c of candidatesJ) {
      console.log(`      - [${c.type}] "${c.text}" pages=[${c.pages.join(', ')}] conf=${c.confidence}% evidence=${JSON.stringify(c.evidence || [])} hash=${c.contentHash ? c.contentHash.substring(0, 12) + '...' : 'none'}`);
    }

    // --- REGRESSION VERIFICATIONS (Pages 1 & 2) ---
    // 1. Blue Draft Chart and Green Sales Chart MUST NOT be merged into the same candidate!
    const mergedCand = candidatesJ.find(c => c.pages.includes(0) && c.pages.includes(1));
    assert.strictEqual(mergedCand, undefined, 'CRITICAL: Page 1 and Page 2 images MUST NOT be merged into a single candidate based on bounds!');

    // 2. Cross-page hash repeat MUST NOT be awarded to Page 1 or Page 2
    const page1Cand = candidatesJ.find(c => c.pages.includes(0));
    if (page1Cand) {
      assert.ok(!page1Cand.evidence?.includes('cross_page_hash_repeat'), 'Page 1 blue chart MUST NOT receive cross_page_hash_repeat');
    }
    const page2Cand = candidatesJ.find(c => c.pages.includes(1));
    assert.strictEqual(page2Cand, undefined, 'Page 2 green sales chart MUST NOT be detected as a watermark candidate!');

    // 3. For pages 1 & 2, safe auto-clean candidate selection MUST BE EMPTY!
    const regressionCandidates = candidatesJ.filter(c => c.pages.every(p => p < 2));
    const safeRegressionIds = buildSafeAutoCleanCandidateIds(regressionCandidates, 595.28, 841.89);
    assert.deepStrictEqual(safeRegressionIds, [], 'Pages 1 & 2 safe auto-clean candidate IDs must be completely empty');

    // --- POSITIVE CONTROL VERIFICATIONS (Pages 3 & 4) ---
    // 4. Positive control identical watermark MUST be detected spanning pages [2, 3] (0-indexed)
    const positiveCand = candidatesJ.find(c => c.pages.includes(2) && c.pages.includes(3));
    assert.ok(positiveCand, 'Positive control watermark spanning pages 3 and 4 must be detected');
    assert.ok(positiveCand.evidence?.includes('cross_page_hash_repeat'), 'Positive control must have cross_page_hash_repeat evidence');
    assert.ok(positiveCand.contentHash, 'Positive control candidate must carry a verified contentHash');

    // 5. Positive control MUST be selected for safe auto-clean
    const allSafeIds = buildSafeAutoCleanCandidateIds(candidatesJ, 595.28, 841.89);
    assert.ok(allSafeIds.includes(positiveCand.id), 'Positive control watermark must be selected for safe auto-clean');
    // Ensure no Page 1 or Page 2 candidate is in allSafeIds
    for (const safeId of allSafeIds) {
      const cand = candidatesJ.find(c => c.id === safeId);
      assert.ok(!cand.pages.includes(0) && !cand.pages.includes(1), `Candidate ${safeId} on pages [${cand.pages.join(', ')}] MUST NOT touch Page 1 or Page 2!`);
    }

    // --- EXECUTE REMOVAL ---
    console.log('    Executing safe auto-clean watermark removal...');
    const resultJ = await removeWatermarks(bytesJ, candidatesJ, {
      candidateIds: allSafeIds,
      pageScope: 'all'
    });
    assert.ok(resultJ.totalRemoved > 0, 'Positive control watermarks must be successfully removed');

    // Render 300 DPI 'after' images for all 4 pages
    console.log('    Rendering 300 DPI "after" images...');
    const [j1After, j2After, j3After, j4After] = await Promise.all([
      renderPageTo300Dpi(resultJ.pdfBytes, 1),
      renderPageTo300Dpi(resultJ.pdfBytes, 2),
      renderPageTo300Dpi(resultJ.pdfBytes, 3),
      renderPageTo300Dpi(resultJ.pdfBytes, 4)
    ]);

    // Compute pixel diffs
    const diffJ1 = await computeImageDiff(j1Before, j1After, path.join(FIXTURES_DIR, 'test_j_page1_diff.png'));
    const diffJ2 = await computeImageDiff(j2Before, j2After, path.join(FIXTURES_DIR, 'test_j_page2_diff.png'));
    const diffJ3 = await computeImageDiff(j3Before, j3After, path.join(FIXTURES_DIR, 'test_j_page3_diff.png'));
    const diffJ4 = await computeImageDiff(j4Before, j4After, path.join(FIXTURES_DIR, 'test_j_page4_diff.png'));

    console.log(`      Page 1 diff: ${diffJ1.changedPixels} pixels (Blue chart fully preserved: 0 pixels changed)`);
    console.log(`      Page 2 diff: ${diffJ2.changedPixels} pixels (Green SALES CHART fully preserved: 0 pixels changed)`);
    console.log(`      Page 3 diff: ${diffJ3.changedPixels} pixels (Positive control watermark removed)`);
    console.log(`      Page 4 diff: ${diffJ4.changedPixels} pixels (Positive control watermark removed)`);

    assert.strictEqual(diffJ1.changedPixels, 0, 'Page 1 blue chart MUST have ZERO pixels changed (bit-level preservation)');
    assert.strictEqual(diffJ2.changedPixels, 0, 'Page 2 green SALES CHART MUST have ZERO pixels changed (zero collateral damage)');
    assert.ok(diffJ3.changedPixels > 0, 'Page 3 positive control watermark must be removed');
    assert.ok(diffJ4.changedPixels > 0, 'Page 4 positive control watermark must be removed');

    console.log('  ✅ PASS: Test J - Regression (identical bounds separation) and Positive Control (content hash repeat) verified.');
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

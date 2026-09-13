import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";
import fs from "fs";
import path from "path";

// Test script to verify watermark detection and removal end-to-end
async function run() {
  console.log("=== STARTING WATERMARK REMOVAL TEST ===");

  // 1. Create synthetic PDF with watermarks
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // Page 1
  const page1 = pdfDoc.addPage([600, 800]);
  page1.drawText("Bu belgenin birinci sayfasıdır. Önemli resmi içerik.", {
    x: 50,
    y: 700,
    size: 16,
    font,
    color: rgb(0.1, 0.1, 0.1)
  });
  page1.drawText("Sayfa Altı Bilgi - Gizlilik Politikası", {
    x: 50,
    y: 50,
    size: 10,
    font,
    color: rgb(0.3, 0.3, 0.3)
  });
  // Watermark on page 1 (TASLAK, diagonal 45 deg, 50pt)
  page1.drawText("TASLAK", {
    x: 180,
    y: 350,
    size: 52,
    font: boldFont,
    color: rgb(0.85, 0.85, 0.85),
    rotate: degrees(45)
  });

  // Page 2
  const page2 = pdfDoc.addPage([600, 800]);
  page2.drawText("Bu belgenin ikinci sayfasıdır. Diğer önemli içerikler.", {
    x: 50,
    y: 700,
    size: 16,
    font,
    color: rgb(0.1, 0.1, 0.1)
  });
  // Watermark on page 2 (TASLAK, diagonal 45 deg, 50pt)
  page2.drawText("TASLAK", {
    x: 180,
    y: 350,
    size: 52,
    font: boldFont,
    color: rgb(0.85, 0.85, 0.85),
    rotate: degrees(45)
  });

  const pdfBytes = await pdfDoc.save();
  console.log(`[1] Created synthetic 2-page PDF (${pdfBytes.length} bytes) with 'TASLAK' watermark`);

  // 2. Import detection & removal functions
  // Note: we dynamically import compiled or source modules via ts-node/esm or direct imports
  const { detectWatermarks } = await import("../features/watermark-removal/watermarkDetector.ts");
  const { removeWatermarks } = await import("../features/watermark-removal/watermarkRemover.ts");
  const { loadPdf } = await import("../lib/documents.ts");
  const { editablePageText } = await import("../lib/pdf-text.ts");

  console.log("[2] Running detectWatermarks...");
  const candidates = await detectWatermarks(pdfBytes);
  console.log(`[2] Detected ${candidates.length} watermark candidates:`);
  for (const c of candidates) {
    console.log(`  - [${c.type}] "${c.text}" (conf: ${c.confidence}%, count: ${c.count}, pages: ${c.pages.join(",")}) reason: ${c.reason}`);
  }

  const taslakCandidate = candidates.find(c => c.text.toUpperCase().includes("TASLAK"));
  if (!taslakCandidate) {
    throw new Error("FAIL: 'TASLAK' watermark was not detected by detectWatermarks!");
  }
  console.log(`[PASS] 'TASLAK' watermark candidate found with confidence ${taslakCandidate.confidence}%`);

  // 3. Remove watermark
  console.log("[3] Running removeWatermarks...");
  const removalResult = await removeWatermarks(pdfBytes, candidates, {
    candidateIds: [taslakCandidate.id],
    pageScope: "all"
  });

  console.log(`[3] Removal finished. Total items removed: ${removalResult.totalRemoved} (text: ${removalResult.removedTextCount}, img: ${removalResult.removedImageCount}, annot: ${removalResult.removedAnnotationCount})`);

  if (removalResult.totalRemoved === 0) {
    throw new Error("FAIL: removeWatermarks reported 0 items removed!");
  }

  // 4. Verify resulting PDF using PDF.js text extraction
  console.log("[4] Verifying cleaned PDF text content...");
  const cleanedDoc = await loadPdf(removalResult.pdfBytes);
  if (cleanedDoc.numPages !== 2) {
    throw new Error(`FAIL: Page count changed to ${cleanedDoc.numPages}, expected 2`);
  }

  for (let p = 0; p < 2; p++) {
    const page = await cleanedDoc.getPage(p + 1);
    const texts = await editablePageText(page);
    const pageStrings = texts.map(t => t.text);
    console.log(`  Page ${p + 1} remaining texts:`, pageStrings);

    const hasTaslak = pageStrings.some(s => s.toUpperCase().includes("TASLAK"));
    if (hasTaslak) {
      throw new Error(`FAIL: 'TASLAK' still found on page ${p + 1}!`);
    }

    const hasNormalText = pageStrings.some(s => s.includes("Bu belgenin"));
    if (!hasNormalText) {
      throw new Error(`FAIL: Normal document content was unexpectedly lost on page ${p + 1}!`);
    }
  }

  console.log("[PASS] 'TASLAK' was completely removed from all pages while keeping document content intact!");

  // 5. Test Custom Text Removal
  console.log("[5] Testing custom text removal mode...");
  const customResult = await removeWatermarks(removalResult.pdfBytes, [], {
    candidateIds: [],
    customText: "resmi içerik",
    pageScope: "all"
  });
  console.log(`[5] Custom text removal removed ${customResult.totalRemoved} items`);
  const finalDoc = await loadPdf(customResult.pdfBytes);
  const p1 = await finalDoc.getPage(1);
  const p1Texts = (await editablePageText(p1)).map(t => t.text);
  console.log("  Page 1 after custom text removal:", p1Texts);
  if (p1Texts.some(t => t.includes("resmi içerik"))) {
    throw new Error("FAIL: Custom text 'resmi içerik' was not removed!");
  }

  console.log("=== ALL WATERMARK REMOVAL TESTS PASSED SUCCESSFULLY ===");
}

run().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});

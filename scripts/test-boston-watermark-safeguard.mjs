import assert from "node:assert";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

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
    const targetLength = newByteLength === undefined ? this.byteLength : newByteLength;
    const newBuf = new ArrayBuffer(targetLength);
    new Uint8Array(newBuf).set(new Uint8Array(this, 0, Math.min(this.byteLength, targetLength)));
    return newBuf;
  };
}

const { detectWatermarks } = await import("../features/watermark-removal/watermarkDetector.ts");
const { removeWatermarks } = await import("../features/watermark-removal/watermarkRemover.ts");

async function main() {
  console.log("=== BOSTON UNIVERSITY / RED BRANDING WATERMARK SAFEGUARD TEST ===");

  // 1. Create a synthetic Boston University document with red header box and normal student text
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const boldFont = await doc.embedFont(StandardFonts.HelveticaBold);

  // Red header logo box in top right
  page.drawRectangle({
    x: 420,
    y: 700,
    width: 150,
    height: 50,
    color: rgb(0.8, 0.1, 0.1) // Scarlet red
  });
  page.drawText("BOSTON UNIVERSITY", {
    x: 430,
    y: 720,
    size: 11,
    font: boldFont,
    color: rgb(1, 1, 1)
  });

  // Legitimate student data on the page
  page.drawText("Name: Ahmet Yilmaz", { x: 50, y: 550, size: 12, font });
  page.drawText("Career: Undergraduate", { x: 50, y: 520, size: 12, font });
  page.drawText("Academic Program: Computer Science", { x: 50, y: 490, size: 12, font });
  page.drawText("Term: Spring 2026 UGRD Full-Time", { x: 50, y: 400, size: 12, font });

  const pdfBytes = await doc.save();
  console.log(`✓ Created test document (${pdfBytes.length} bytes) with scarlet branding and student text.`);

  // 2. Run watermark detection
  const candidates = await detectWatermarks(pdfBytes);
  console.log(`Detected candidates: ${candidates.length}`);
  for (const c of candidates) {
    console.log(` - [${c.type}] "${c.text}" (conf: ${c.confidence}%, strategy: ${c.strategy})`);
  }

  // Assertion 1: No bogus full-page red stamp watermark candidate
  const redBogusCandidate = candidates.find(c => 
    c.text?.includes("Kırmızı Damga") || 
    c.text?.includes("GEÇERSİZ / ÖRNEK BELGEDİR") ||
    c.reason?.includes("Kırmızı / mercan")
  );
  assert.strictEqual(redBogusCandidate, undefined, "PASS: Crude red-pixel scanner must NEVER create a synthetic whole-page candidate!");

  // Assertion 2: If someone tries to pass an automated visual candidate with bounds to removeWatermarks,
  // it must NEVER draw a whiteout rectangle cover over pages with vector text!
  const syntheticVisualCandidate = {
    id: "wm-vis-0-1",
    type: "image",
    text: "Test Red Mark",
    count: 1,
    pages: [0],
    confidence: 90,
    reason: "Visual candidate",
    imageBounds: { x: 40, y: 350, w: 500, h: 300 },
    strategy: "pixel_clean"
  };

  const removalResult = await removeWatermarks(pdfBytes, [syntheticVisualCandidate], {
    candidateIds: ["wm-vis-0-1"],
    pageScope: "all",
    currentPage: 0
  });

  assert.strictEqual(removalResult.removedCoverCount || 0, 0, "PASS: Automated candidates must NEVER draw fallback rectangle covers!");
  assert.strictEqual(removalResult.totalRemoved, 0, "PASS: Total removed must be 0 when no valid removal occurs (no mutation)!");

  // Assertion 3: Verify the output PDF is 100% bit-identical and no text is erased or covered
  assert.strictEqual(Buffer.from(removalResult.pdfBytes).equals(Buffer.from(pdfBytes)), true, "PASS: Output PDF is 100% bit-identical!");

  console.log("\n🎉 ALL BOSTON UNIVERSITY SAFEGUARD ASSERTIONS PASSED (100%)");
}

main().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});

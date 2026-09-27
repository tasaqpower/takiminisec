import { performOcrOnCanvas } from "../ocr/ocrEngine.ts";
import { loadPdf } from "../../lib/documents.ts";
import { normalizeTurkish, WATERMARK_KEYWORDS } from "./watermarkDetector.ts";
import type { WatermarkCandidate } from "./watermarkTypes.ts";

/**
 * Render a page of a PDF to an HTMLCanvasElement
 */
export async function renderPdfPageToCanvas(
  pdfBytes: Uint8Array,
  pageIndex: number,
  scale = 1.5
): Promise<{ canvas: HTMLCanvasElement; width: number; height: number; pageWidth: number; pageHeight: number }> {
  const doc = await loadPdf(pdfBytes);
  try {
    const page = await doc.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale });
    const originalViewport = page.getViewport({ scale: 1.0 });

    let canvas: any;
    if (typeof document !== "undefined" && typeof document.createElement === "function") {
      canvas = document.createElement("canvas");
      canvas.width = Math.round(viewport.width);
      canvas.height = Math.round(viewport.height);
    } else {
      try {
        const pkg = "@napi-rs/canvas";
        const { createCanvas } = await import(/* @vite-ignore */ pkg);
        canvas = createCanvas(Math.round(viewport.width), Math.round(viewport.height));
      } catch {
        throw new Error("No canvas implementation available");
      }
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not create 2D canvas context");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx as any, viewport, canvas: canvas as any }).promise;

    return {
      canvas,
      width: canvas.width,
      height: canvas.height,
      pageWidth: originalViewport.width,
      pageHeight: originalViewport.height
    };
  } finally {
    try {
      await doc.loadingTask.destroy();
    } catch {}
  }
}

/**
 * Samples margin pixels of the page canvas to detect the authentic background color of the paper
 * (e.g. pure white, off-white, light cream, pale gray).
 */
export function detectPageBackgroundColor(canvas: HTMLCanvasElement): { r: number; g: number; b: number; hex: string } {
  try {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { r: 1, g: 1, b: 1, hex: "#ffffff" };

    const w = canvas.width;
    const h = canvas.height;
    const samplePoints: { x: number; y: number }[] = [
      { x: Math.min(20, w - 1), y: Math.min(20, h - 1) },
      { x: Math.max(0, w - 20), y: Math.min(20, h - 1) },
      { x: Math.min(20, w - 1), y: Math.max(0, h - 20) },
      { x: Math.max(0, w - 20), y: Math.max(0, h - 20) },
      { x: Math.floor(w / 2), y: Math.min(15, h - 1) },
      { x: Math.min(15, w - 1), y: Math.floor(h / 2) },
      { x: Math.max(0, w - 15), y: Math.floor(h / 2) }
    ];

    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let count = 0;

    for (const pt of samplePoints) {
      const data = ctx.getImageData(pt.x, pt.y, 1, 1).data;
      const brightness = 0.299 * data[0] + 0.587 * data[1] + 0.114 * data[2];
      if (brightness > 160) {
        rSum += data[0];
        gSum += data[1];
        bSum += data[2];
        count++;
      }
    }

    if (count === 0) return { r: 1, g: 1, b: 1, hex: "#ffffff" };

    const avgR = Math.round(rSum / count);
    const avgG = Math.round(gSum / count);
    const avgB = Math.round(bSum / count);

    const toHex = (n: number) => n.toString(16).padStart(2, "0");
    const hex = `#${toHex(avgR)}${toHex(avgG)}${toHex(avgB)}`;

    return {
      r: avgR / 255,
      g: avgG / 255,
      b: avgB / 255,
      hex
    };
  } catch {
    return { r: 1, g: 1, b: 1, hex: "#ffffff" };
  }
}

/**
 * Creates a rotated canvas to detect diagonal watermarks (e.g. 45 degrees)
 */
function createRotatedCanvas(sourceCanvas: HTMLCanvasElement, angleDeg: number): HTMLCanvasElement {
  const rad = (angleDeg * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const rotW = Math.floor(w * cos + h * sin);
  const rotH = Math.floor(h * cos + w * sin);

  let rotCanvas: any;
  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    rotCanvas = document.createElement("canvas");
    rotCanvas.width = rotW;
    rotCanvas.height = rotH;
  } else {
    try {
      const pkg = "@napi-rs/canvas";
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { createCanvas } = (0, eval)("require")(pkg);
      rotCanvas = createCanvas(rotW, rotH);
    } catch {
      return sourceCanvas;
    }
  }

  const ctx = rotCanvas.getContext("2d");
  if (!ctx) return sourceCanvas;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, rotCanvas.width, rotCanvas.height);
  ctx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(sourceCanvas, -w / 2, -h / 2);
  return rotCanvas;
}

function mapRotatedBBoxToSource(
  bbox: { x: number; y: number; width: number; height: number },
  rotW: number,
  rotH: number,
  srcW: number,
  srcH: number,
  angleDeg: number,
  padding = 25
): { x: number; y: number; w: number; h: number } {
  const rad = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const corners = [
    { x: bbox.x, y: bbox.y },
    { x: bbox.x + bbox.width, y: bbox.y },
    { x: bbox.x, y: bbox.y + bbox.height },
    { x: bbox.x + bbox.width, y: bbox.y + bbox.height }
  ];

  const mapped = corners.map((pt) => {
    const xPrimeC = pt.x - rotW / 2;
    const yPrimeC = pt.y - rotH / 2;
    const xC = xPrimeC * cos + yPrimeC * sin;
    const yC = -xPrimeC * sin + yPrimeC * cos;
    return {
      x: xC + srcW / 2,
      y: yC + srcH / 2
    };
  });

  const xs = mapped.map((p) => p.x);
  const ys = mapped.map((p) => p.y);

  const minX = Math.max(0, Math.min(...xs) - padding);
  const maxX = Math.min(srcW, Math.max(...xs) + padding);
  const minY = Math.max(0, Math.min(...ys) - padding);
  const maxY = Math.min(srcH, Math.max(...ys) + padding);

  return {
    x: minX,
    y: minY,
    w: Math.max(10, maxX - minX),
    h: Math.max(10, maxY - minY)
  };
}

/**
 * Detect watermarks visually using local OCR engine (Tesseract) and pixel color cluster analysis on the page canvas.
 * Works seamlessly on scanned documents, image-based PDFs, and rasterized watermarks without requiring an API key.
 */
export async function detectVisualWatermarks(
  pdfBytes: Uint8Array,
  pageIndex: number
): Promise<WatermarkCandidate[]> {
  try {
    const { canvas, width, height, pageWidth, pageHeight } = await renderPdfPageToCanvas(pdfBytes, pageIndex, 1.5);
    const candidates: WatermarkCandidate[] = [];

    const matchedBoxes: { text: string; x: number; y: number; w: number; h: number; reason: string; confidence: number }[] = [];

    // 1. Run standard horizontal OCR for banners / stamps / text
    try {
      const ocrResult = await performOcrOnCanvas(canvas, pageIndex + 1, undefined, undefined, "tur+eng");
      for (const line of ocrResult.lines) {
        const normLine = normalizeTurkish(line.text);
        const matchedKw = WATERMARK_KEYWORDS.filter((kw) => normLine.includes(kw));

        if (matchedKw.length > 0) {
          const pad = 12;
          const boxX = Math.max(0, line.bbox.x - pad);
          const boxY = Math.max(0, line.bbox.y - pad);
          const boxW = Math.min(width - boxX, line.bbox.width + pad * 2);
          const boxH = Math.min(height - boxY, line.bbox.height + pad * 2);

          // Discard if bounding box is full-page or excessively large
          if (boxW < width * 0.85 || boxH < height * 0.85) {
            matchedBoxes.push({
              text: line.text,
              x: boxX,
              y: boxY,
              w: boxW,
              h: boxH,
              reason: `Görsel OCR ile tespit edildi: ${matchedKw.join(", ")}`,
              confidence: 94
            });
          }
        } else {
          for (const w of line.words) {
            const normWord = normalizeTurkish(w.text);
            const wMatched = WATERMARK_KEYWORDS.filter((kw) => normWord.includes(kw));
            if (wMatched.length > 0) {
              const pad = 8;
              const boxX = Math.max(0, w.bbox.x - pad);
              const boxY = Math.max(0, w.bbox.y - pad);
              const boxW = Math.min(width - boxX, w.bbox.width + pad * 2);
              const boxH = Math.min(height - boxY, w.bbox.height + pad * 2);
              matchedBoxes.push({
                text: w.text,
                x: boxX,
                y: boxY,
                w: boxW,
                h: boxH,
                reason: `Görsel OCR ile tespit edildi: ${wMatched.join(", ")}`,
                confidence: 88
              });
            }
          }
        }
      }
    } catch (ocrErr) {
      console.warn("Horizontal visual OCR warning:", ocrErr);
    }

    // 2. Rotated OCR for diagonal visual watermarks (e.g. -45°, 45°)
    // Targets diagonal stamps/watermarks with tight OCR bounding boxes instead of full-page sweeps
    if (matchedBoxes.length === 0) {
      for (const angle of [-45, 45]) {
        try {
          const rotCanvas = createRotatedCanvas(canvas, angle);
          const rotResult = await performOcrOnCanvas(rotCanvas, pageIndex + 1, undefined, undefined, "tur+eng");
          for (const line of rotResult.lines) {
            const normLine = normalizeTurkish(line.text);
            const matchedKw = WATERMARK_KEYWORDS.filter((kw) => normLine.includes(kw));
            if (matchedKw.length > 0) {
              const mapped = mapRotatedBBoxToSource(
                line.bbox,
                rotCanvas.width,
                rotCanvas.height,
                width,
                height,
                angle,
                16
              );
              // Ensure tight bounds, strictly rejecting full page sweeps
              if (mapped.w < width * 0.85 || mapped.h < height * 0.85) {
                matchedBoxes.push({
                  text: line.text,
                  x: mapped.x,
                  y: mapped.y,
                  w: mapped.w,
                  h: mapped.h,
                  reason: `Çapraz görsel OCR (${angle}°) ile tespit edildi: ${matchedKw.join(", ")}`,
                  confidence: 92
                });
              }
            }
          }
        } catch (rotErr) {
          console.warn(`Diagonal OCR warning (${angle}°):`, rotErr);
        }
      }
    }

    // Convert matchedBoxes to WatermarkCandidate with PDF coordinates
    const scaleX = pageWidth / width;
    const scaleY = pageHeight / height;
    let candIndex = 1;

    for (const b of matchedBoxes) {
      const pdfX = Math.max(0, b.x * scaleX);
      const pdfW = Math.min(pageWidth - pdfX, b.w * scaleX);
      const pdfH = Math.min(pageHeight, b.h * scaleY);
      const pdfY = Math.max(0, pageHeight - (b.y + b.h) * scaleY);

      // STRICT SAFETY CHECK:
      // Never emit full-page or near-full-page candidates (>= 85% of both dimensions)
      if (pdfW >= pageWidth * 0.85 && pdfH >= pageHeight * 0.85) {
        continue;
      }
      if (pdfW < 10 || pdfH < 10) {
        continue;
      }

      candidates.push({
        id: `wm-vis-${pageIndex}-${candIndex++}`,
        type: "image",
        text: b.text,
        count: 1,
        pages: [pageIndex],
        confidence: b.confidence,
        reason: b.reason,
        imageBounds: {
          x: pdfX,
          y: pdfY,
          w: pdfW,
          h: pdfH
        },
        strategy: "pixel_clean"
      });
    }

    return candidates;
  } catch (err) {
    console.error("Visual watermark detection error:", err);
    return [];
  }
}

/**
 * Search visual OCR for custom text on a scanned/image page and return bounding box in PDF coordinates
 */
export async function findVisualTextBounds(
  pdfBytes: Uint8Array,
  pageIndex: number,
  searchText: string
): Promise<{ x: number; y: number; w: number; h: number }[]> {
  try {
    const { canvas, width, height, pageWidth, pageHeight } = await renderPdfPageToCanvas(pdfBytes, pageIndex, 1.5);
    const ocrResult = await performOcrOnCanvas(canvas, pageIndex + 1, undefined, undefined, "tur+eng");
    const searchNorm = normalizeTurkish(searchText);
    const searchWords = searchNorm.split(" ").filter((w) => w.length > 0);
    const scaleX = pageWidth / width;
    const scaleY = pageHeight / height;
    const bounds: { x: number; y: number; w: number; h: number }[] = [];

    // Check lines
    for (const line of ocrResult.lines) {
      const normLine = normalizeTurkish(line.text);
      if (normLine.includes(searchNorm)) {
        const pdfX = Math.max(0, line.bbox.x * scaleX);
        const pdfW = Math.min(pageWidth - pdfX, line.bbox.width * scaleX);
        const pdfH = Math.min(pageHeight, line.bbox.height * scaleY);
        const pdfY = Math.max(0, pageHeight - (line.bbox.y + line.bbox.height) * scaleY);
        bounds.push({ x: pdfX, y: pdfY, w: pdfW, h: pdfH });
      } else if (searchWords.length > 0) {
        // Check words
        for (const w of line.words) {
          const normWord = normalizeTurkish(w.text);
          if (searchWords.some((sw) => normWord.includes(sw) || sw.includes(normWord))) {
            const pdfX = Math.max(0, w.bbox.x * scaleX);
            const pdfW = Math.min(pageWidth - pdfX, w.bbox.width * scaleX);
            const pdfH = Math.min(pageHeight, w.bbox.height * scaleY);
            const pdfY = Math.max(0, pageHeight - (w.bbox.y + w.bbox.height) * scaleY);
            bounds.push({ x: pdfX, y: pdfY, w: pdfW, h: pdfH });
          }
        }
      }
    }

    // If 0° didn't find the text, check diagonal angles [-45, 45]
    if (bounds.length === 0) {
      for (const angle of [-45, 45]) {
        try {
          const rotCanvas = createRotatedCanvas(canvas, angle);
          const rotResult = await performOcrOnCanvas(rotCanvas, pageIndex + 1, undefined, undefined, "tur+eng");
          let matchedLine: any = null;
          for (const line of rotResult.lines) {
            const normLine = normalizeTurkish(line.text);
            if (normLine.includes(searchNorm) || (searchWords.length > 0 && searchWords.some((sw) => normLine.includes(sw)))) {
              matchedLine = line;
              break;
            }
          }

          if (matchedLine) {
            const mapped = mapRotatedBBoxToSource(
              matchedLine.bbox,
              rotCanvas.width,
              rotCanvas.height,
              width,
              height,
              angle,
              20
            );
            const pdfX = Math.max(0, mapped.x * scaleX);
            const pdfW = Math.min(pageWidth - pdfX, mapped.w * scaleX);
            const pdfH = Math.min(pageHeight, mapped.h * scaleY);
            const pdfY = Math.max(0, pageHeight - (mapped.y + mapped.h) * scaleY);

            bounds.push({
              x: pdfX,
              y: pdfY,
              w: pdfW,
              h: pdfH
            });
            break;
          }
        } catch (rotErr) {
          console.warn("Diagonal visual text search error:", rotErr);
        }
      }
    }

    return bounds;
  } catch (err) {
    console.error("Visual text bounds search failed:", err);
    return [];
  }
}

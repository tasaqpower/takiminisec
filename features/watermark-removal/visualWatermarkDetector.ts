import { performOcrOnCanvas } from "@/features/ocr/ocrEngine";
import { loadPdf } from "@/lib/documents";
import { normalizeTurkish, WATERMARK_KEYWORDS } from "./watermarkDetector";
import type { WatermarkCandidate } from "./watermarkTypes";

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

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
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
  const rotCanvas = document.createElement("canvas");
  const rad = (angleDeg * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;

  rotCanvas.width = Math.floor(w * cos + h * sin);
  rotCanvas.height = Math.floor(h * cos + w * sin);
  const ctx = rotCanvas.getContext("2d");
  if (!ctx) return sourceCanvas;

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, rotCanvas.width, rotCanvas.height);
  ctx.translate(rotCanvas.width / 2, rotCanvas.height / 2);
  ctx.rotate(rad);
  ctx.drawImage(sourceCanvas, -w / 2, -h / 2);
  return rotCanvas;
}

/**
 * Detect watermarks visually using local OCR engine (Tesseract) on the page image/canvas.
 * Works seamlessly on scanned documents, image-based PDFs, and rasterized watermarks without requiring an API key.
 */
export async function detectVisualWatermarks(
  pdfBytes: Uint8Array,
  pageIndex: number
): Promise<WatermarkCandidate[]> {
  try {
    const { canvas, width, height, pageWidth, pageHeight } = await renderPdfPageToCanvas(pdfBytes, pageIndex, 1.5);
    const candidates: WatermarkCandidate[] = [];

    // 1. Run standard horizontal OCR
    const ocrResult = await performOcrOnCanvas(canvas, pageIndex + 1, undefined, undefined, "tur+eng");

    const matchedBoxes: { text: string; x: number; y: number; w: number; h: number; reason: string; confidence: number }[] = [];

    for (const line of ocrResult.lines) {
      const normLine = normalizeTurkish(line.text);
      const matchedKw = WATERMARK_KEYWORDS.filter((kw) => normLine.includes(kw));

      if (matchedKw.length > 0) {
        matchedBoxes.push({
          text: line.text,
          x: line.bbox.x,
          y: line.bbox.y,
          w: line.bbox.width,
          h: line.bbox.height,
          reason: `Görsel OCR ile tespit edildi: ${matchedKw.join(", ")}`,
          confidence: 96
        });
      } else {
        // Check individual words
        for (const w of line.words) {
          const normWord = normalizeTurkish(w.text);
          const wMatched = WATERMARK_KEYWORDS.filter((kw) => normWord.includes(kw));
          if (wMatched.length > 0) {
            matchedBoxes.push({
              text: w.text,
              x: w.bbox.x,
              y: w.bbox.y,
              w: w.bbox.width,
              h: w.bbox.height,
              reason: `Görsel OCR ile tespit edildi: ${wMatched.join(", ")}`,
              confidence: 90
            });
          }
        }
      }
    }

    // 1b. Check for colored watermark stamps (Red, Coral, Blue, Purple) directly on the canvas
    try {
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        const imgData = ctx.getImageData(0, 0, width, height);
        const d = imgData.data;
        let redCount = 0;
        let minX = width, maxX = 0, minY = height, maxY = 0;

        for (let y = 0; y < height; y += 3) {
          for (let x = 0; x < width; x += 3) {
            // Exclude top-right logo if solid
            if (x > width * 0.76 && y < height * 0.28) continue;
            const idx = (y * width + x) * 4;
            const r = d[idx];
            const g = d[idx + 1];
            const b = d[idx + 2];
            if (r > 120 && (r - g >= 16) && (r - b >= 16)) {
              redCount++;
              if (x < minX) minX = x;
              if (x > maxX) maxX = x;
              if (y < minY) minY = y;
              if (y > maxY) maxY = y;
            }
          }
        }

        if (redCount > 100) {
          matchedBoxes.push({
            text: "GEÇERSİZ / ÖRNEK BELGEDİR (Kırmızı Damga & Filigran)",
            x: minX,
            y: minY,
            w: Math.max(120, maxX - minX),
            h: Math.max(60, maxY - minY),
            reason: "Kırmızı / mercan renkli filigran damgası tespit edildi",
            confidence: 99
          });
        }
      }
    } catch {}

    // 2. Check diagonal angles if no diagonal candidate exists yet
    const hasDiagonalCand = matchedBoxes.some(b => b.reason.includes("Çapraz") || b.reason.includes("Kırmızı"));
    if (!hasDiagonalCand) {
      for (const angle of [-45, -35, 35, 45]) {
        try {
          const rotCanvas = createRotatedCanvas(canvas, angle);
          const rotResult = await performOcrOnCanvas(rotCanvas, pageIndex + 1, undefined, undefined, "tur+eng");

          for (const line of rotResult.lines) {
            const normLine = normalizeTurkish(line.text);
            const matchedKw = WATERMARK_KEYWORDS.filter((kw) => normLine.includes(kw));
            if (matchedKw.length > 0) {
              // Diagonal watermark found across the page - use tight bounding box
              const padW = Math.min(canvas.width, Math.max(160, (line.bbox?.width || 200) + 40));
              const padH = Math.min(canvas.height, Math.max(50, (line.bbox?.height || 50) + 30));
              const boxX = Math.max(0, Math.min(canvas.width - padW, (canvas.width - padW) / 2));
              const boxY = Math.max(0, Math.min(canvas.height - padH, (canvas.height - padH) / 2));
              matchedBoxes.push({
                text: line.text,
                x: boxX,
                y: boxY,
                w: padW,
                h: padH,
                reason: `Çapraz (${angle}°) filigran tespit edildi: ${matchedKw.join(", ")}`,
                confidence: 94
              });
              break;
            }
          }
          if (matchedBoxes.some(b => b.reason.includes("Çapraz"))) break;
        } catch (rotErr) {
          console.warn("Diagonal visual OCR error:", rotErr);
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
        }
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
          let found = false;

          for (const line of rotResult.lines) {
            const normLine = normalizeTurkish(line.text);
            if (normLine.includes(searchNorm) || (searchWords.length > 0 && searchWords.some((sw) => normLine.includes(sw)))) {
              found = true;
              break;
            }
          }

          if (found) {
            // Target the center diagonal region of the page where the watermark is placed
            const boxW = pageWidth * 0.8;
            const boxH = pageHeight * 0.45;
            bounds.push({
              x: Math.max(0, (pageWidth - boxW) / 2),
              y: Math.max(0, (pageHeight - boxH) / 2),
              w: boxW,
              h: boxH
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

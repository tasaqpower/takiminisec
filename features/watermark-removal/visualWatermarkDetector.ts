if (typeof ArrayBuffer !== "undefined") {
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
}

import { performOcrOnCanvas } from "../ocr/ocrEngine.ts";
import { loadPdf } from "../../lib/documents.ts";
import { normalizeTurkish, WATERMARK_KEYWORDS } from "./watermarkDetector.ts";
import type { WatermarkCandidate, WatermarkEvidenceType } from "./watermarkTypes.ts";

/**
 * Unicode-aware watermark keyword matcher with strict word boundary enforcement
 * and comprehensive exclusion of legitimate contract/document terminology.
 */
export function matchVisualWatermarkKeyword(text: string): { matchedKeywords: string[]; isLegitimatePhrase: boolean } {
  if (!text) return { matchedKeywords: [], isLegitimatePhrase: false };
  const norm = normalizeTurkish(text);
  if (!norm) return { matchedKeywords: [], isLegitimatePhrase: false };

  // Explicit exclusion of legitimate phrases & normal document terms:
  // "taslak proje planı", "taslak metni", "taslak maddesi", "taslak dokümanı",
  // "gizli bilgilerin korunması", "gizlilik politikası", "gizlilik sözleşmesi",
  // "kopya sayısı", "kopya adedi", "örnek olay", "örnek soru", "örnek çalışma",
  // "copyright 2026", "tüm hakları saklıdır", "ticari sır", "şahıslarla paylaşamaz"
  const isLegit = (
    /(?:taslak\s+(?:proje|plan|plani|maddesi|metni|metin|dokumani)|gizli\s+(?:bilgi|bilgilerin|belgelerin|korunmasi)|kopya\s+(?:sayisi|adedi)|ornek\s+(?:olay|calisma|soru|proje)|copyright\s+\d{4}|tum\s+haklari\s+saklidir|ticari\s+sir|ticari\s+sirri|sahislarla\s+paylasamaz|yururluk\s+ve\s+imza)/i.test(norm) ||
    /^(?:madde|article|fikra|fıkra|bent)\s*\d+/i.test(norm)
  );
  if (isLegit) {
    return { matchedKeywords: [], isLegitimatePhrase: true };
  }

  // Any regular sentence with 4+ words that is not an explicit multi-word watermark phrase is normal text!
  const wordCount = norm.split(/\s+/).filter(Boolean).length;
  if (wordCount >= 4) {
    const isExplicitMultiWord = [
      "gecersiz belge", "gecersiz ornek", "belge simulasyonudur", "onaysiz kopya",
      "kontrolsuz kopya", "asli gibidir", "camscanner ile tarandi", "scanned with camscanner",
      "do not copy", "strictly confidential", "private and confidential", "not for official use",
      "for review only", "all rights reserved"
    ].some((ph) => norm.includes(ph));
    if (!isExplicitMultiWord) {
      return { matchedKeywords: [], isLegitimatePhrase: true };
    }
  }

  const matchedKeywords: string[] = [];
  for (const kw of WATERMARK_KEYWORDS) {
    const kwNorm = normalizeTurkish(kw);
    if (!kwNorm) continue;

    // Use Unicode-aware regex with word boundaries: (?<![a-z0-9çğıöşü])kw(?![a-z0-9çğıöşü])
    const kwPattern = kwNorm.replace(/\s+/g, "\\s+");
    const regex = new RegExp(`(?<![a-z0-9çğıöşü])${kwPattern}(?![a-z0-9çğıöşü])`, "i");
    if (regex.test(norm)) {
      matchedKeywords.push(kw);
    }
  }

  return { matchedKeywords, isLegitimatePhrase: false };
}

/**
 * Samples text region pixels against detected paper color to evaluate brightness/contrast.
 * Watermarks have faint contrast (slate, light gray, pale pink) whereas legitimate text is dark.
 */
export function analyzeBBoxContrast(
  canvas: HTMLCanvasElement,
  bbox: { x: number; y: number; width?: number; height?: number; w?: number; h?: number },
  paperColor: { r: number; g: number; b: number }
): { isFaint: boolean; contrastRatio: number; lum: number } {
  try {
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { isFaint: false, contrastRatio: 10, lum: 0 };
    const bx = Math.max(0, Math.floor(bbox.x));
    const by = Math.max(0, Math.floor(bbox.y));
    const bw = Math.min(canvas.width - bx, Math.ceil(bbox.width ?? bbox.w ?? 0));
    const bh = Math.min(canvas.height - by, Math.ceil(bbox.height ?? bbox.h ?? 0));
    if (bw <= 0 || bh <= 0) return { isFaint: false, contrastRatio: 10, lum: 0 };

    const imgData = ctx.getImageData(bx, by, bw, bh);
    const data = imgData.data;
    let textPixelCount = 0;
    let lumSum = 0;
    const paperLum = 0.299 * (paperColor.r * 255) + 0.587 * (paperColor.g * 255) + 0.114 * (paperColor.b * 255);

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const lum = 0.299 * r + 0.587 * g + 0.114 * b;
      // If noticeably darker than paper, it's ink/text
      if (paperLum - lum > 15) {
        textPixelCount++;
        lumSum += lum;
      }
    }

    if (textPixelCount === 0) return { isFaint: true, contrastRatio: 1, lum: paperLum };
    const avgLum = lumSum / textPixelCount;
    const contrastRatio = (paperLum + 0.05) / (avgLum + 0.05);
    const isFaint = contrastRatio < 3.2 || (avgLum >= 120 && avgLum <= 245);
    return { isFaint, contrastRatio, lum: avgLum };
  } catch {
    return { isFaint: false, contrastRatio: 10, lum: 0 };
  }
}

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
 * Creates a blank canvas with the given dimensions using the environment's canvas constructor
 */
export function createCanvasHelper(sourceCanvas: HTMLCanvasElement, w: number, h: number): HTMLCanvasElement {
  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }
  if ((sourceCanvas as any)?.constructor) {
    try {
      return new (sourceCanvas as any).constructor(w, h);
    } catch {}
  }
  throw new Error("Cannot create canvas");
}

/**
 * Creates a rotated canvas to detect diagonal watermarks (e.g. 45 degrees)
 */
export function createRotatedCanvas(sourceCanvas: HTMLCanvasElement, angleDeg: number): HTMLCanvasElement {
  const rad = (angleDeg * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const rotW = Math.floor(w * cos + h * sin);
  const rotH = Math.floor(h * cos + w * sin);

  let rotCanvas: any = null;
  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    rotCanvas = document.createElement("canvas");
    rotCanvas.width = rotW;
    rotCanvas.height = rotH;
  } else if ((sourceCanvas as any).constructor) {
    try {
      rotCanvas = new (sourceCanvas as any).constructor(rotW, rotH);
    } catch {
      rotCanvas = null;
    }
  }

  if (!rotCanvas) return sourceCanvas;

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
 * Inspects a cropped image region for watermarks at multiple angles (0°, -25°, 25°, -45°, 45°).
 * Cropping to the image bounding box prevents unrelated contract body text from interfering with OCR.
 */
export async function inspectImageCropWatermark(
  canvas: HTMLCanvasElement,
  bbox: { x: number; y: number; w: number; h: number },
  pageIndex: number,
  paperColor?: { r: number; g: number; b: number }
): Promise<{
  matchedText: string;
  matchedKeywords: string[];
  angle: number;
  evidence: WatermarkEvidenceType[];
  isFaint: boolean;
} | null> {
  try {
    const cropX = Math.max(0, Math.floor(bbox.x));
    const cropY = Math.max(0, Math.floor(bbox.y));
    const cropW = Math.min(canvas.width - cropX, Math.ceil(bbox.w));
    const cropH = Math.min(canvas.height - cropY, Math.ceil(bbox.h));

    if (cropW < 20 || cropH < 20) return null;

    const cropCanvas = createCanvasHelper(canvas, cropW, cropH);
    const cropCtx = cropCanvas.getContext("2d");
    if (!cropCtx) return null;

    cropCtx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

    const effectivePaperColor = paperColor || { r: 1, g: 1, b: 1 };

    // Test angles: horizontal, diagonal stamps (-25°, 25°, -45°, 45°)
    for (const angle of [0, -25, 25, -45, 45]) {
      const rotCanvas = createRotatedCanvas(cropCanvas, angle);
      const rotResult = await performOcrOnCanvas(rotCanvas, pageIndex + 1, undefined, undefined, "tur+eng");

      for (const line of rotResult.lines) {
        const { matchedKeywords, isLegitimatePhrase } = matchVisualWatermarkKeyword(line.text);
        if (isLegitimatePhrase || matchedKeywords.length === 0) continue;

        const contrast = analyzeBBoxContrast(
          canvas,
          { x: cropX, y: cropY, width: cropW, height: cropH },
          effectivePaperColor
        );

        const ev: WatermarkEvidenceType[] = ["ocr_keyword"];
        if (angle !== 0) {
          ev.push("diagonal_rotation");
        }
        if (contrast.isFaint) {
          ev.push("background_contrast");
        }

        return {
          matchedText: line.text,
          matchedKeywords,
          angle,
          evidence: ev,
          isFaint: contrast.isFaint
        };
      }
    }
  } catch (err) {
    console.warn("inspectImageCropWatermark error:", err);
  }
  return null;
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
    const paperColor = detectPageBackgroundColor(canvas);
    const candidates: WatermarkCandidate[] = [];

    const matchedBoxes: {
      text: string;
      x: number;
      y: number;
      w: number;
      h: number;
      reason: string;
      confidence: number;
      evidence: WatermarkEvidenceType[];
    }[] = [];

    // 1. Run standard horizontal OCR for banners / stamps / text
    try {
      const ocrResult = await performOcrOnCanvas(canvas, pageIndex + 1, undefined, undefined, "tur+eng");
      for (const line of ocrResult.lines) {
        const { matchedKeywords, isLegitimatePhrase } = matchVisualWatermarkKeyword(line.text);
        if (isLegitimatePhrase || matchedKeywords.length === 0) continue;

        // PHYSICAL SIGNAL REQUIREMENT:
        // Pure horizontal text MUST have a physical watermark indicator (large size >= 24pt or faint contrast/tone)
        // Normal 12pt dark text or contract sentences are NEVER treated as watermarks!
        const contrast = analyzeBBoxContrast(canvas, line.bbox, paperColor);
        const isLargeFont = line.bbox.height >= 32; // >= 21pt at scale 1.5
        const isFaintContrast = contrast.isFaint;

        if (!isLargeFont && !isFaintContrast) {
          // Zero physical watermark signal: regular document sentence containing a keyword (e.g. "taslak")
          continue;
        }

        const pad = 12;
        const boxX = Math.max(0, line.bbox.x - pad);
        const boxY = Math.max(0, line.bbox.y - pad);
        const boxW = Math.min(width - boxX, line.bbox.width + pad * 2);
        const boxH = Math.min(height - boxY, line.bbox.height + pad * 2);

        // Discard if bounding box is full-page or excessively large
        if (boxW < width * 0.82 || boxH < height * 0.82) {
          const ev: WatermarkEvidenceType[] = ["ocr_keyword"];
          if (isFaintContrast) ev.push("background_contrast");

          matchedBoxes.push({
            text: line.text,
            x: boxX,
            y: boxY,
            w: boxW,
            h: boxH,
            reason: `Görsel OCR ile tespit edildi: ${matchedKeywords.join(", ")}`,
            confidence: isFaintContrast ? 92 : 80,
            evidence: ev
          });
        }
      }
    } catch (ocrErr) {
      console.warn("Horizontal visual OCR warning:", ocrErr);
    }

    // 2. Targeted crop OCR on candidate images (isolates watermark from unrelated contract body text)
    if (matchedBoxes.length === 0) {
      try {
        const doc = await loadPdf(pdfBytes);
        const page = await doc.getPage(pageIndex + 1);
        const { detectImagesOnPage } = await import("../image-editor/imageDetector.ts");
        const pageImages = await detectImagesOnPage(page, pageIndex);
        await doc.loadingTask.destroy();

        for (const img of pageImages) {
          const covX = img.w / pageWidth;
          const covY = img.h / pageHeight;
          const areaCov = (img.w * img.h) / (pageWidth * pageHeight);
          if ((covX >= 0.82 && covY >= 0.82) || areaCov >= 0.70) continue;

          // Exclude header / footer logos
          const isHeaderOrFooter = (img.y <= pageHeight * 0.16 || (img.y + img.h) >= pageHeight * 0.81) &&
            img.w <= pageWidth * 0.55 && img.h <= pageHeight * 0.22;
          if (isHeaderOrFooter) continue;

          const scale = width / pageWidth;
          const cropBox = {
            x: img.x * scale,
            y: img.y * scale,
            w: img.w * scale,
            h: img.h * scale
          };

          const cropRes = await inspectImageCropWatermark(canvas, cropBox, pageIndex, paperColor);
          if (cropRes && cropRes.evidence.length >= 2) {
            matchedBoxes.push({
              text: cropRes.matchedText,
              x: cropBox.x,
              y: cropBox.y,
              w: cropBox.w,
              h: cropBox.h,
              reason: `${cropRes.angle !== 0 ? `Çapraz (${cropRes.angle}°)` : "Görsel"} OCR ile tespit edildi: ${cropRes.matchedKeywords.join(", ")}`,
              confidence: 95,
              evidence: cropRes.evidence
            });
            break;
          }
        }
      } catch (cropErr) {
        console.warn("Targeted crop OCR warning:", cropErr);
      }
    }

    // 3. Rotated OCR for diagonal visual watermarks (e.g. -45°, -25°, 25°, 45°)
    // Targets diagonal stamps/watermarks with tight OCR bounding boxes instead of full-page sweeps
    if (matchedBoxes.length === 0) {
      for (const angle of [-45, -25, 25, 45]) {
        try {
          const rotCanvas = createRotatedCanvas(canvas, angle);
          const rotResult = await performOcrOnCanvas(rotCanvas, pageIndex + 1, undefined, undefined, "tur+eng");
          for (const line of rotResult.lines) {
            const { matchedKeywords, isLegitimatePhrase } = matchVisualWatermarkKeyword(line.text);
            if (isLegitimatePhrase || matchedKeywords.length === 0) continue;

            const mapped = mapRotatedBBoxToSource(
              line.bbox,
              rotCanvas.width,
              rotCanvas.height,
              width,
              height,
              angle,
              16
            );

            // Dynamic coverage check on canvas
            const covX = mapped.w / width;
            const covY = mapped.h / height;
            const areaCov = (mapped.w * mapped.h) / (width * height);
            if ((covX >= 0.82 && covY >= 0.82) || areaCov >= 0.70) {
              continue;
            }

            const contrast = analyzeBBoxContrast(canvas, mapped, paperColor);
            const ev: WatermarkEvidenceType[] = ["ocr_keyword", "diagonal_rotation"];
            if (contrast.isFaint) {
              ev.push("background_contrast");
            }

            matchedBoxes.push({
              text: line.text,
              x: mapped.x,
              y: mapped.y,
              w: mapped.w,
              h: mapped.h,
              reason: `Çapraz görsel OCR (${angle}°) ile tespit edildi: ${matchedKeywords.join(", ")}`,
              confidence: 94,
              evidence: ev
            });
            break; // Found primary diagonal watermark at this angle
          }
          if (matchedBoxes.length > 0) break;
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
      // Never emit full-page or near-full-page candidates (>= 82% of both dimensions or >= 70% area)
      const covX = pdfW / pageWidth;
      const covY = pdfH / pageHeight;
      const areaCov = (pdfW * pdfH) / (pageWidth * pageHeight);
      if ((covX >= 0.82 && covY >= 0.82) || areaCov >= 0.70) {
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
        evidence: b.evidence,
        imageBounds: {
          x: pdfX,
          y: pdfY,
          w: pdfW,
          h: pdfH,
          pageWidth,
          pageHeight
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

import type { Worker } from "tesseract.js";
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { applyImageFilters, type FilterOptions } from "./imageFilters.ts";

export interface OcrWord {
  text: string;
  bbox: { x: number; y: number; width: number; height: number };
  confidence: number;
}

export interface OcrStyleEstimate {
  fontCategory: "sans" | "serif" | "courier";
  bold: boolean;
  italic: boolean;
  textColor: string;
  backgroundColor: string;
  cropDataUrl: string;
  estimatedSize: number;
}

export interface OcrSegment {
  text: string;
  bbox: { x: number; y: number; width: number; height: number };
  cropDataUrl?: string;
  style?: OcrStyleEstimate;
}

export interface OcrLine {
  text: string;
  bbox: { x: number; y: number; width: number; height: number };
  words: OcrWord[];
  confidence: number;
  style?: OcrStyleEstimate;
  segments?: OcrSegment[];
}

export interface OcrPageResult {
  pageNumber: number;
  lines: OcrLine[];
  fullText: string;
  averageConfidence: number;
  width: number;
  height: number;
}

export interface OcrProgress {
  currentPage: number;
  totalPages: number;
  percent: number;
  statusText: string;
}

let sharedWorker: Worker | null = null;
let currentWorkerLanguages = "";

/**
 * Creates or retrieves a worker configured for local offline operation
 */
export async function getOcrWorker(
  languages = "tur+eng",
  onProgress?: (progress: number, status: string) => void
): Promise<Worker> {
  if (sharedWorker && currentWorkerLanguages === languages) {
    return sharedWorker;
  }

  if (sharedWorker) {
    try {
      await sharedWorker.terminate();
    } catch {}
    sharedWorker = null;
  }

  const isBrowser = typeof window !== "undefined" && !(typeof process !== "undefined" && Boolean(process?.versions?.node));
  const workerOptions: any = {
    cacheMethod: "readOnly",
    gzip: false,
    logger: (m: any) => {
      if (m.status === "recognizing text" && typeof m.progress === "number") {
        onProgress?.(Math.round(m.progress * 100), "Metin tanınıyor…");
      } else if (m.status === "loading language traineddata") {
        onProgress?.(20, "Dil modelleri yükleniyor…");
      } else if (m.status === "initializing api") {
        onProgress?.(30, "OCR motoru başlatılıyor…");
      }
    }
  };

  if (isBrowser) {
    workerOptions.workerPath = "/tesseract/worker.min.js";
    workerOptions.corePath = "/tesseract/tesseract-core.wasm.js";
    workerOptions.langPath = "/tesseract/lang-data";
  } else {
    const path = await import("node:path");
    workerOptions.langPath = path.resolve("public/tesseract/lang-data");
  }

  const { createWorker } = await import("tesseract.js");
  const workerPromise = createWorker(languages.split("+"), 1, workerOptions);
  let timer: any;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error("OCR motoru veya dil modeli yüklenirken zaman aşımı oluştu. Lütfen bağlantınızı kontrol edip tekrar deneyin."));
    }, 30000);
  });

  try {
    const worker = await Promise.race([workerPromise, timeoutPromise]);
    sharedWorker = worker;
    currentWorkerLanguages = languages;
    return worker;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Terminates the active OCR worker immediately
 */
export async function terminateOcrWorker(): Promise<void> {
  if (sharedWorker) {
    try {
      await sharedWorker.terminate();
    } catch {}
    sharedWorker = null;
    currentWorkerLanguages = "";
  }
}

/**
 * Context-aware normalization of Turkish OCR glyph confusions.
 * Strictly preserves real numbers (e.g. "1", "10", "1.", "1 Ocak", "Madde 1").
 * Only substitutes 1 with ı when embedded strictly between Turkish letters (e.g. "y1l" -> "yıl", "k1s1m" -> "kısım")
 * or within a comma-separated list of individual Turkish alphabet letters.
 */
export function postProcessTurkishOcr(text: string): string {
  if (!text) return text;
  return text
    // Replace digit 1 strictly inside a Turkish word with letters on both sides (e.g. y1l -> yıl, k1s1m -> kısım)
    .replace(/([a-zçğıöşüA-ZÇĞİÖŞÜ])1(?=[a-zçğıöşüA-ZÇĞİÖŞÜ])/gu, (_match, p1) => p1 + "ı")
    // Replace digit 1 strictly in a comma-separated list of single Turkish letters: 'ç, ğ, 1, ö'
    .replace(/(?<=[a-zçğıöşüA-ZÇĞİÖŞÜ],\s*)1(?=\s*,\s*[a-zçğıöşüA-ZÇĞİÖŞÜ])/gu, "ı");
}

/**
 * Binary search for the optimal font size fitting targetWidth and targetHeight
 */
export function fitFontSizeToBox(
  text: string,
  targetWidth: number,
  targetHeight: number,
  fontFamily: string,
  bold = false,
  minSize = 6,
  maxSize = 72
): number {
  const clean = (text || "").trim();
  const isMono = fontFamily.toLowerCase().includes("courier") || fontFamily.toLowerCase().includes("mono");
  // For monospace text, pitch is strictly 0.60 * fontSize per character
  if (isMono && clean.length > 0 && targetWidth > 0) {
    const monoSize = Math.round((targetWidth / (clean.length * 0.60)) * 10) / 10;
    if (monoSize >= minSize && monoSize <= maxSize) {
      return Math.round(monoSize);
    }
  }

  // General typographic baseline: OCR targetHeight is tight ink bounding box (cap-height),
  // whereas font em size is roughly 1.35x - 1.50x cap-height.
  const estimatedEmFromHeight = Math.max(minSize, Math.min(maxSize, Math.round(targetHeight * 1.42)));

  if (typeof document === "undefined" || typeof document.createElement !== "function") {
    return estimatedEmFromHeight;
  }
  try {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return estimatedEmFromHeight;

    let low = minSize;
    let high = Math.min(maxSize, Math.max(minSize, Math.round(targetHeight * 2.2)));
    let best = low;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      ctx.font = `${bold ? "bold " : ""}${mid}px ${fontFamily}`;
      const metrics = ctx.measureText(clean);
      const measuredW = metrics.width;
      const estimatedCapH = mid * 0.70;

      // Fit to width and cap-height
      if (measuredW <= targetWidth * 1.05 && estimatedCapH <= targetHeight * 1.25) {
        best = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }
    return Math.max(best, Math.min(maxSize, Math.round(targetHeight * 1.25)));
  } catch {
    return estimatedEmFromHeight;
  }
}

/**
 * Estimates font category, weight, color, background color, and high-res crop
 * locally from the rendered page canvas without external AI or network calls.
 */
export function analyzeCropStyle(
  canvas: HTMLCanvasElement,
  bbox: { x: number; y: number; width: number; height: number },
  text: string,
  words: OcrWord[] = [],
  pad = 2
): OcrStyleEstimate {
  const cleanText = (text || "").trim();
  const isTypewriterPattern = /^(Name|Date|ID|No|Ref|Sign|Tarih|Adı|Soyadı|Tc|Sicil|Konu|Sayı|Tel|Fax)[:\s]/i.test(cleanText);
  const fallbackSize = Math.max(8, Math.min(72, Math.round(bbox.height * 1.42)));

  const fallback: OcrStyleEstimate = {
    fontCategory: isTypewriterPattern ? "courier" : "sans",
    bold: false,
    italic: false,
    textColor: "#000000",
    backgroundColor: "#ffffff",
    cropDataUrl: "",
    estimatedSize: fallbackSize
  };

  if (!canvas || typeof canvas.getContext !== "function" || bbox.width <= 0 || bbox.height <= 0) {
    return fallback;
  }

  try {
    const ctx = canvas.getContext("2d");
    if (!ctx) return fallback;

    const cropX = Math.max(0, Math.floor(bbox.x - pad));
    const cropY = Math.max(0, Math.floor(bbox.y - pad));
    const cropW = Math.min(canvas.width - cropX, Math.ceil(bbox.width + pad * 2));
    const cropH = Math.min(canvas.height - cropY, Math.ceil(bbox.height + pad * 2));

    if (cropW <= 0 || cropH <= 0) return fallback;

    // 1. Pixel data extraction for color, background, and stroke analysis
    const imgData = ctx.getImageData(cropX, cropY, cropW, cropH);
    const data = imgData.data;

    // Sample background color along perimeter (edges)
    const bgR: number[] = [];
    const bgG: number[] = [];
    const bgB: number[] = [];

    for (let x = 0; x < cropW; x++) {
      const topIdx = (0 * cropW + x) * 4;
      bgR.push(data[topIdx]);
      bgG.push(data[topIdx + 1]);
      bgB.push(data[topIdx + 2]);
      const btmIdx = ((cropH - 1) * cropW + x) * 4;
      bgR.push(data[btmIdx]);
      bgG.push(data[btmIdx + 1]);
      bgB.push(data[btmIdx + 2]);
    }
    for (let y = 1; y < cropH - 1; y++) {
      const leftIdx = (y * cropW + 0) * 4;
      bgR.push(data[leftIdx]);
      bgG.push(data[leftIdx + 1]);
      bgB.push(data[leftIdx + 2]);
      const rightIdx = (y * cropW + (cropW - 1)) * 4;
      bgR.push(data[rightIdx]);
      bgG.push(data[rightIdx + 1]);
      bgB.push(data[rightIdx + 2]);
    }

    const median = (arr: number[]) => {
      if (!arr.length) return 255;
      const s = [...arr].sort((a, b) => a - b);
      return s[Math.floor(s.length / 2)] ?? 255;
    };

    const medBgR = median(bgR);
    const medBgG = median(bgG);
    const medBgB = median(bgB);
    const bgLum = 0.299 * medBgR + 0.587 * medBgG + 0.114 * medBgB;
    const backgroundColor = `#${((1 << 24) + (medBgR << 16) + (medBgG << 8) + medBgB).toString(16).slice(1)}`;

    // 2. High-resolution crop to data URL with dual-threshold Euclidean color distance alpha matting
    let cropDataUrl = "";
    if (typeof document !== "undefined" && typeof document.createElement === "function") {
      try {
        const cropCanvas = document.createElement("canvas");
        cropCanvas.width = cropW;
        cropCanvas.height = cropH;
        const cctx = cropCanvas.getContext("2d");
        if (cctx) {
          cctx.drawImage(canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
          const cImgData = cctx.getImageData(0, 0, cropW, cropH);
          const cData = cImgData.data;

          // Dual-threshold Euclidean distance alpha matting:
          // dist <= 16: Definite background -> alpha 0
          // dist >= 52: Definite text/foreground -> alpha original (or 255)
          // 16 < dist < 52: Smooth transition zone -> alpha = round(((dist - 16) / 36) * 255)
          const lowerThreshold = 16;
          const upperThreshold = 52;
          const range = upperThreshold - lowerThreshold;

          for (let pi = 0; pi < cData.length; pi += 4) {
            const dr = cData[pi] - medBgR;
            const dg = cData[pi + 1] - medBgG;
            const db = cData[pi + 2] - medBgB;
            const dist = Math.sqrt(dr * dr + dg * dg + db * db);

            if (dist <= lowerThreshold) {
              cData[pi + 3] = 0;
            } else if (dist < upperThreshold) {
              const alphaNorm = (dist - lowerThreshold) / range;
              cData[pi + 3] = Math.round(alphaNorm * (cData[pi + 3] || 255));
            }
            // else dist >= upperThreshold: keep full opacity
          }
          cctx.putImageData(cImgData, 0, 0);
          cropDataUrl = cropCanvas.toDataURL("image/png");
        }
      } catch {}
    }

    // 3. Text color, glyph bounding envelope, and normalized stroke/bold analysis
    const textR: number[] = [];
    const textG: number[] = [];
    const textB: number[] = [];
    let darkPixelCount = 0;

    let minGlyphX = cropW;
    let maxGlyphX = 0;
    let minGlyphY = cropH;
    let maxGlyphY = 0;

    for (let y = 0; y < cropH; y++) {
      for (let x = 0; x < cropW; x++) {
        const i = (y * cropW + x) * 4;
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const dr = r - medBgR;
        const dg = g - medBgG;
        const db = b - medBgB;
        const dist = Math.sqrt(dr * dr + dg * dg + db * db);
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;

        if (dist >= 35 || bgLum - lum > 35) {
          darkPixelCount++;
          textR.push(r);
          textG.push(g);
          textB.push(b);
          if (x < minGlyphX) minGlyphX = x;
          if (x > maxGlyphX) maxGlyphX = x;
          if (y < minGlyphY) minGlyphY = y;
          if (y > maxGlyphY) maxGlyphY = y;
        }
      }
    }

    let textColor = "#000000";
    if (textR.length > 0) {
      const medTextR = median(textR);
      const medTextG = median(textG);
      const medTextB = median(textB);
      textColor = `#${((1 << 24) + (medTextR << 16) + (medTextG << 8) + medTextB).toString(16).slice(1)}`;
    }

    // Measure horizontal stroke thickness across glyph bounding rows
    let totalRunLength = 0;
    let runCount = 0;
    if (darkPixelCount > 0 && maxGlyphY >= minGlyphY && maxGlyphX >= minGlyphX) {
      for (let y = minGlyphY; y <= maxGlyphY; y++) {
        let currentRun = 0;
        for (let x = minGlyphX; x <= maxGlyphX; x++) {
          const i = (y * cropW + x) * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const dr = r - medBgR;
          const dg = g - medBgG;
          const db = b - medBgB;
          const isDark = (dr * dr + dg * dg + db * db) >= 1225; // 35^2
          if (isDark) {
            currentRun++;
          } else {
            if (currentRun > 0) {
              totalRunLength += currentRun;
              runCount++;
              currentRun = 0;
            }
          }
        }
        if (currentRun > 0) {
          totalRunLength += currentRun;
          runCount++;
        }
      }
    }

    // Normalized dark ratio by actual glyph bounding envelope (not whole padding box)
    const glyphW = Math.max(1, maxGlyphX - minGlyphX + 1);
    const glyphH = Math.max(1, maxGlyphY - minGlyphY + 1);
    const glyphArea = glyphW * glyphH;
    const normalizedDarkRatio = (darkPixelCount > 0 && glyphArea > 0) ? darkPixelCount / glyphArea : 0;
    const avgStrokeWidth = runCount > 0 ? totalRunLength / runCount : 1;
    const strokeRatio = avgStrokeWidth / glyphH;

    // Bold rule: Default to regular in ambiguous cases.
    // Bold requires sufficient glyph dark ratio AND substantial stroke thickness.
    const bold = darkPixelCount > 15 && (
      (normalizedDarkRatio > 0.18 && strokeRatio > 0.13) ||
      (avgStrokeWidth >= 3.2 && strokeRatio > 0.12) ||
      normalizedDarkRatio > 0.32
    );

    // 4. Monospace Courier detection:
    // Word character pitch variance is the PRIMARY signal.
    // Keyword regex is only supporting.
    let isMonospace = false;
    if (words.length >= 2 && cleanText.length >= 6) {
      const charWidths = words.map(w => w.bbox.width / Math.max(1, w.text.length));
      const avgCharW = charWidths.reduce((a, b) => a + b, 0) / charWidths.length;
      const variance = charWidths.reduce((acc, val) => acc + Math.pow(val - avgCharW, 2), 0) / charWidths.length;
      if (variance < 2.0 && avgCharW > 4.0) {
        isMonospace = true;
      }
    }

    if (!isMonospace && isTypewriterPattern) {
      // If keyword matched, verify it doesn't have extreme proportional variance
      if (words.length >= 2) {
        const charWidths = words.map(w => w.bbox.width / Math.max(1, w.text.length));
        const avgCharW = charWidths.reduce((a, b) => a + b, 0) / charWidths.length;
        const variance = charWidths.reduce((acc, val) => acc + Math.pow(val - avgCharW, 2), 0) / charWidths.length;
        if (variance < 4.5) {
          isMonospace = true;
        }
      } else {
        isMonospace = true;
      }
    }

    let fontCategory: "sans" | "serif" | "courier" = "sans";
    if (isMonospace) {
      fontCategory = "courier";
    } else if (typeof document !== "undefined" && typeof document.createElement === "function") {
      try {
        const mCanvas = document.createElement("canvas");
        const mCtx = mCanvas.getContext("2d");
        if (mCtx) {
          const testSize = 20;
          mCtx.font = `${bold ? "bold " : ""}${testSize}px "Liberation Sans", Helvetica, Arial, sans-serif`;
          const sansW = mCtx.measureText(cleanText).width;
          mCtx.font = `${bold ? "bold " : ""}${testSize}px "Lora", Georgia, serif`;
          const serifW = mCtx.measureText(cleanText).width;
          mCtx.font = `${bold ? "bold " : ""}${testSize}px "Courier New", Courier, monospace`;
          const courierW = mCtx.measureText(cleanText).width;

          const targetRatio = bbox.width / Math.max(1, bbox.height);
          const sansRatio = sansW / (testSize * 1.25);
          const serifRatio = serifW / (testSize * 1.25);
          const courierRatio = courierW / (testSize * 1.25);

          const diffSans = Math.abs(sansRatio - targetRatio);
          const diffSerif = Math.abs(serifRatio - targetRatio);
          const diffCourier = Math.abs(courierRatio - targetRatio);

          if (diffCourier < diffSans && diffCourier < diffSerif) {
            fontCategory = "courier";
          } else if (diffSerif < diffSans) {
            fontCategory = "serif";
          } else {
            fontCategory = "sans";
          }
        }
      } catch {}
    }

    const estimatedSize = fitFontSizeToBox(
      cleanText,
      bbox.width,
      bbox.height,
      fontCategory === "courier" ? "'Courier New', Courier, monospace" : fontCategory === "serif" ? "Lora, Georgia, serif" : "sans-serif",
      bold
    );

    return {
      fontCategory,
      bold,
      italic: false,
      textColor,
      backgroundColor,
      cropDataUrl,
      estimatedSize
    };
  } catch (err) {
    console.warn("analyzeCropStyle error:", err);
    return fallback;
  }
}

/**
 * Creates an isolated transparent PNG crop for a specific bounding box from the raw page canvas.
 * Background pixels are sampled from the perimeter and made transparent in the PNG alpha channel.
 */
export function createTransparentCrop(
  canvas: HTMLCanvasElement,
  bbox: { x: number; y: number; width: number; height: number },
  pad = 2
): { cropDataUrl: string; backgroundColor: string } {
  const est = analyzeCropStyle(canvas, bbox, "", [], pad);
  return { cropDataUrl: est.cropDataUrl, backgroundColor: est.backgroundColor };
}

/**
 * Recognizes text from a canvas using real local Tesseract.js engine
 */
export async function performOcrOnCanvas(
  canvas: HTMLCanvasElement,
  pageNumber = 1,
  filterOpts?: Partial<FilterOptions>,
  onProgress?: (progress: number, status: string) => void,
  languages = "tur+eng"
): Promise<OcrPageResult> {
  const width = canvas.width;
  const height = canvas.height;

  // Apply preprocessing filters if requested (grayscale, binarize, contrast)
  let processedCanvas = canvas;
  if (filterOpts && (filterOpts.grayscale || filterOpts.binarize || filterOpts.contrast !== 1.0)) {
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const rawImage = ctx.getImageData(0, 0, width, height);
      const filtered = applyImageFilters(rawImage, filterOpts);
      const offscreen = document.createElement("canvas");
      offscreen.width = width;
      offscreen.height = height;
      const offCtx = offscreen.getContext("2d");
      if (offCtx) {
        offCtx.putImageData(filtered, 0, 0);
        processedCanvas = offscreen;
      }
    }
  }

  const worker = await getOcrWorker(languages, onProgress);
  let imageInput: any = processedCanvas;
  if (typeof (processedCanvas as any).toBuffer === "function") {
    imageInput = (processedCanvas as any).toBuffer("image/png");
  }
  const result = await worker.recognize(imageInput, {}, { blocks: true });
  const data = result.data as any;

  const lines: OcrLine[] = [];
  let totalConfidence = 0;
  let wordCount = 0;

  const isTur = languages.includes("tur");
  const extractedLines =
    (data.lines && data.lines.length > 0)
      ? data.lines
      : (data.blocks?.flatMap((b: any) => b.paragraphs || []).flatMap((p: any) => p.lines || [])) || [];

  if (extractedLines.length > 0) {
    for (const l of extractedLines) {
      const lineWords: OcrWord[] = [];
      for (const w of l.words) {
        let wordText = w.text.trim();
        if (!wordText) continue;
        if (isTur) wordText = postProcessTurkishOcr(wordText);
        const conf = Math.round(w.confidence || 0);
        totalConfidence += conf;
        wordCount++;
        lineWords.push({
          text: wordText,
          bbox: {
            x: Math.round(w.bbox.x0),
            y: Math.round(w.bbox.y0),
            width: Math.round(w.bbox.x1 - w.bbox.x0),
            height: Math.round(w.bbox.y1 - w.bbox.y0)
          },
          confidence: conf
        });
      }

      if (lineWords.length > 0) {
        const lineText = isTur ? postProcessTurkishOcr(l.text.trim()) : l.text.trim();
        const lineBbox = {
          x: Math.round(l.bbox.x0),
          y: Math.round(l.bbox.y0),
          width: Math.round(l.bbox.x1 - l.bbox.x0),
          height: Math.round(l.bbox.y1 - l.bbox.y0)
        };
        // Analyze style and extract crop from the unbinarized source canvas for 100% color/style fidelity
        const style = analyzeCropStyle(canvas, lineBbox, lineText, lineWords);

        // Segment-level decomposition with separate transparent crops per segment
        const segments: OcrSegment[] = [];
        let curWords: OcrWord[] = [lineWords[0]];
        for (let wi = 1; wi < lineWords.length; wi++) {
          const prev = lineWords[wi - 1];
          const curr = lineWords[wi];
          const gap = curr.bbox.x - (prev.bbox.x + prev.bbox.width);
          if (gap > 35) {
            const minX = curWords[0].bbox.x;
            const minY = Math.min(...curWords.map(w => w.bbox.y));
            const maxX = curWords[curWords.length - 1].bbox.x + curWords[curWords.length - 1].bbox.width;
            const maxY = Math.max(...curWords.map(w => w.bbox.y + w.bbox.height));
            const segBbox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
            const segCrop = createTransparentCrop(canvas, segBbox);
            const segText = curWords.map(w => w.text).join(" ");
            const segStyle = analyzeCropStyle(canvas, segBbox, segText, curWords);
            segments.push({
              text: segText,
              bbox: segBbox,
              cropDataUrl: segCrop.cropDataUrl,
              style: { ...segStyle, backgroundColor: segCrop.backgroundColor }
            });
            curWords = [curr];
          } else {
            curWords.push(curr);
          }
        }
        if (curWords.length > 0) {
          const minX = curWords[0].bbox.x;
          const minY = Math.min(...curWords.map(w => w.bbox.y));
          const maxX = curWords[curWords.length - 1].bbox.x + curWords[curWords.length - 1].bbox.width;
          const maxY = Math.max(...curWords.map(w => w.bbox.y + w.bbox.height));
          const segBbox = { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
          const segCrop = createTransparentCrop(canvas, segBbox);
          const segText = curWords.map(w => w.text).join(" ");
          const segStyle = analyzeCropStyle(canvas, segBbox, segText, curWords);
          segments.push({
            text: segText,
            bbox: segBbox,
            cropDataUrl: segCrop.cropDataUrl,
            style: { ...segStyle, backgroundColor: segCrop.backgroundColor }
          });
        }

        lines.push({
          text: lineText,
          bbox: lineBbox,
          words: lineWords,
          confidence: Math.round(l.confidence || 0),
          style,
          segments
        });
      }
    }
  }

  const averageConfidence = wordCount > 0 ? Math.round(totalConfidence / wordCount) : Math.round(data.confidence || 0);
  const rawText = lines.map(l => l.text).join("\n").trim() || data.text.trim();
  const fullText = isTur ? postProcessTurkishOcr(rawText) : rawText;

  return {
    pageNumber,
    lines,
    fullText,
    averageConfidence,
    width,
    height
  };
}

/**
 * Creates a searchable PDF by embedding recognized text invisibly
 * over each scanned PDF page.
 */
export async function exportSearchablePdf(
  originalPdfBytes: Uint8Array,
  ocrResults: OcrPageResult[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(originalPdfBytes);
  let font: any = null;
  try {
    if (typeof window !== "undefined" && !(typeof process !== "undefined" && Boolean(process?.versions?.node))) {
      const res = await fetch("/fonts/LiberationSans-Regular.ttf");
      if (res.ok) {
        font = await pdfDoc.embedFont(await res.arrayBuffer(), { subset: true });
      }
    } else {
      const fs = await import("node:fs");
      const path = await import("node:path");
      const fontPath = path.resolve("public/fonts/LiberationSans-Regular.ttf");
      if (fs.existsSync(fontPath)) {
        font = await pdfDoc.embedFont(fs.readFileSync(fontPath), { subset: true });
      }
    }
  } catch {}
  if (!font) {
    font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  }
  const pages = pdfDoc.getPages();

  for (const res of ocrResults) {
    const pIndex = res.pageNumber - 1;
    if (pIndex < 0 || pIndex >= pages.length) continue;
    const page = pages[pIndex];
    const { width: pageWidth, height: pageHeight } = page.getSize();

    const scaleX = pageWidth / res.width;
    const scaleY = pageHeight / res.height;

    for (const line of res.lines) {
      for (const word of line.words) {
        const textX = word.bbox.x * scaleX;
        // PDF coordinate origin is bottom-left
        const textY = pageHeight - (word.bbox.y * scaleY) - (word.bbox.height * scaleY);
        const fontSize = Math.max(5, word.bbox.height * scaleY * 0.85);

        try {
          // Render invisible selectable text over scanned image
          page.drawText(word.text, {
            x: textX,
            y: textY,
            size: fontSize,
            font,
            color: rgb(0, 0, 0),
            opacity: 0 // Invisible layer for native PDF text selection & search!
          });
        } catch {
          // Continue if any non-standard character fails standard font encoding
        }
      }
    }
  }

  return await pdfDoc.save();
}

/**
 * Exports OCR results to a Word document (.docx)
 */
export async function exportDocxFromOcr(ocrResults: OcrPageResult[]): Promise<Blob> {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");
  const paragraphs: any[] = [];

  for (const res of ocrResults) {
    paragraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `--- Sayfa ${res.pageNumber} ---`,
            bold: true,
            size: 24,
            color: "4F46E5"
          })
        ],
        spacing: { before: 200, after: 120 }
      })
    );

    for (const line of res.lines) {
      paragraphs.push(
        new Paragraph({
          children: [
            new TextRun({
              text: line.text,
              size: 22
            })
          ],
          spacing: { after: 80 }
        })
      );
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: paragraphs
      }
    ]
  });

  const buffer = await Packer.toBuffer(doc);
  return new Blob([new Uint8Array(buffer)], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  });
}

/**
 * Plain text format
 */
export function exportTxtFromOcr(ocrResults: OcrPageResult[]): string {
  return ocrResults
    .map(r => `--- Sayfa ${r.pageNumber} ---\n` + r.fullText)
    .join("\n\n");
}

export const recognizePdfPageOffline = performOcrOnCanvas;


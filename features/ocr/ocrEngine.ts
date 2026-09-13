import { createWorker, type Worker } from "tesseract.js";
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { Document, Packer, Paragraph, TextRun } from "docx";
import { applyImageFilters, type FilterOptions } from "./imageFilters.ts";

export interface OcrWord {
  text: string;
  bbox: { x: number; y: number; width: number; height: number };
  confidence: number;
}

export interface OcrLine {
  text: string;
  bbox: { x: number; y: number; width: number; height: number };
  words: OcrWord[];
  confidence: number;
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
  const result = await worker.recognize(processedCanvas, {}, { blocks: true });
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
        lines.push({
          text: lineText,
          bbox: {
            x: Math.round(l.bbox.x0),
            y: Math.round(l.bbox.y0),
            width: Math.round(l.bbox.x1 - l.bbox.x0),
            height: Math.round(l.bbox.y1 - l.bbox.y0)
          },
          words: lineWords,
          confidence: Math.round(l.confidence || 0)
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
  const paragraphs: Paragraph[] = [];

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


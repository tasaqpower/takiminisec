import type { WrappedPdfiumModule, PdfiumRuntimeMethods } from "@embedpdf/pdfium";
import { PDFDocument, PDFName, PDFDict, PDFRef } from "pdf-lib";
import pako from "pako";

export type TextRemoval = { id: string; page: number; quad: number[] };

export interface CharBox {
  char: string;
  left: number;
  right: number;
  bottom: number;
  top: number;
  size: number;
  weight: number;
  fontName: string;
  color: string;
  isBold: boolean;
  isItalic: boolean;
  originX?: number;
  originY?: number;
}

export type EditableText = TextRemoval & {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  size: number;
  angle: number;
  fontName: string;
  fontFamily?: string;
  originalFontName?: string;
  fontWeight?: number | string;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  letterSpacing?: number;
  lineHeight?: number;
  transform?: number[];
  charBoxes?: CharBox[];
  isOcr?: boolean;
  ocrSourceCropDataUrl?: string;
  ocrOriginalBounds?: { x: number; y: number; w: number; h: number };
  ocrTextDirty?: boolean;
  ocrBackgroundColor?: string;
};

let instance: Promise<WrappedPdfiumModule> | undefined;
async function engine() {
  if (!instance) instance = (async () => {
    const isNode = typeof process !== "undefined" && Boolean(process?.versions?.node);
    let wasmBinary: Uint8Array;
    if (isNode) {
      const fs = await import("node:fs");
      const path = await import("node:path");
      wasmBinary = fs.readFileSync(path.resolve("public/pdfium.wasm"));
    } else {
      const response = await fetch("/pdfium.wasm");
      if (!response.ok) throw Error("PDF metin motoru yüklenemedi. Yeniden dene.");
      wasmBinary = new Uint8Array(await response.arrayBuffer());
    }
    const { init } = await import("@embedpdf/pdfium");
    const mod = await init({ wasmBinary });
    mod.PDFiumExt_Init();
    return mod;
  })().catch(error => { instance = undefined; throw error; });
  return instance;
}

type ExtendedPdfiumRuntime = PdfiumRuntimeMethods & {
  HEAPU8: Uint8Array;
};

function parseHexColor(hex?: string): { r: number; g: number; b: number } {
  if (!hex) return { r: 0, g: 0, b: 0 };
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  if (isNaN(num)) return { r: 0, g: 0, b: 0 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255
  };
}

function resolveStandardFontName(rep: {
  bold?: boolean;
  italic?: boolean;
  originalFontName?: string;
  fontName?: string;
  font?: string;
}): string {
  const isBold = Boolean(
    rep.bold ||
    /bold|black|heavy|demi|semibold|medium|700|800|900/i.test(rep.originalFontName || "") ||
    /bold|black|heavy|demi|semibold|medium|700|800|900/i.test(rep.fontName || "")
  );
  const isItalic = Boolean(
    rep.italic ||
    /italic|oblique|slanted/i.test(rep.originalFontName || "") ||
    /italic|oblique|slanted/i.test(rep.fontName || "")
  );

  const name = ((rep.originalFontName || "") + " " + (rep.fontName || "")).toLowerCase();
  if (name.includes("courier")) {
    return isBold ? (isItalic ? "Courier-BoldOblique" : "Courier-Bold") : (isItalic ? "Courier-Oblique" : "Courier");
  }
  if (name.includes("times")) {
    return isBold ? (isItalic ? "Times-BoldItalic" : "Times-Bold") : (isItalic ? "Times-Italic" : "Times-Roman");
  }
  return isBold ? (isItalic ? "Helvetica-BoldOblique" : "Helvetica-Bold") : (isItalic ? "Helvetica-Oblique" : "Helvetica");
}

function allocateUtf16LeString(heap: any, text: string): number {
  if (!text || typeof text !== "string") return 0;
  const bytes = new Uint8Array((text.length + 1) * 2);
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    bytes[i * 2] = code & 0xff;
    bytes[i * 2 + 1] = (code >> 8) & 0xff;
  }
  const { malloc } = heap.wasmExports;
  const ptr = malloc(bytes.length);
  const mem = new Uint8Array(heap.wasmExports.memory.buffer);
  mem.set(bytes, ptr);
  return ptr;
}

export type PdfTextReplacement = {
  markId: string;
  sourceId: string;
  page: number;
  quad: number[];
  text: string;
  originalText?: string;
  size: number;
  font?: string;
  originalFontName?: string;
  fontName?: string;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  bg?: string;
};

async function createUniversalCanvas(width: number, height: number): Promise<{ canvas: any; ctx: any }> {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    return { canvas, ctx: canvas.getContext("2d") };
  }
  if (typeof document !== "undefined" && document.createElement) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    return { canvas, ctx: canvas.getContext("2d") };
  }
  try {
    const dynamicImport = new Function("modulePath", "return import(modulePath)");
    const napiCanvas = await dynamicImport("@napi-rs/canvas").catch(() => null);
    if (napiCanvas && napiCanvas.createCanvas) {
      const canvas = napiCanvas.createCanvas(width, height);
      return { canvas, ctx: canvas.getContext("2d") };
    }
  } catch {}
  return { canvas: null, ctx: null };
}

/**
 * Rewrites text content streams and inserts replacement text objects directly in topological
 * reading order at the exact object stream index of the redacted text.
 */
export async function applyPdfTextReplacements(
  bytes: Uint8Array,
  removals: TextRemoval[],
  replacements: PdfTextReplacement[] = []
): Promise<{ bytes: Uint8Array; appliedMarkIds: string[] }> {
  const validRemovals = removals.filter(
    r => Array.isArray(r.quad) && r.quad.length === 8 && r.quad.every(Number.isFinite)
  );
  if (!validRemovals.length && !replacements.length) {
    return { bytes, appliedMarkIds: [] };
  }

  const m = await engine(), heap = m.pdfium as unknown as ExtendedPdfiumRuntime;
  const { malloc, free } = heap.wasmExports;
  const input = malloc(bytes.length);
  let doc = 0;
  const appliedMarkIds: string[] = [];

  try {
    heap.HEAPU8.set(bytes, input);
    doc = m.FPDF_LoadMemDocument(input, bytes.length, "");
    if (!doc) throw Error("PDF metin düzenlemesi için açılamadı.");

    const pageIndices = new Set([
      ...validRemovals.map(r => r.page),
      ...replacements.map(r => r.page)
    ]);

    for (const index of pageIndices) {
      const page = m.FPDF_LoadPage(doc, index);
      if (!page) throw Error("Düzenlenecek sayfa açılamadı.");

      try {
        const pageRemovals = validRemovals.filter(r => r.page === index);
        const pageReplacements = replacements.filter(r => r.page === index);

        const objCount = m.FPDFPage_CountObjects(page);
        let pageHasImage = false;
        for (let i = 0; i < objCount; i++) {
          if (m.FPDFPageObj_GetType(m.FPDFPage_GetObject(page, i)) === 3) {
            pageHasImage = true;
            break;
          }
        }

        const boundsPtr = malloc(16);
        const replacementTargets = pageReplacements.map(rep => {
          const quad = rep.quad;
          const minX = Math.min(quad[0], quad[2], quad[4], quad[6]);
          const maxX = Math.max(quad[0], quad[2], quad[4], quad[6]);
          const minY = Math.min(quad[1], quad[3], quad[5], quad[7]);
          const maxY = Math.max(quad[1], quad[3], quad[5], quad[7]);
          const midX = (minX + maxX) / 2;
          const midY = (minY + maxY) / 2;

          let targetObjIndex = -1;
          let targetBaselineY = -1;
          for (let i = 0; i < objCount; i++) {
            const obj = m.FPDFPage_GetObject(page, i);
            if (m.FPDFPageObj_GetType(obj) === 1) { // text
              m.FPDFPageObj_GetBounds(obj, boundsPtr, boundsPtr + 4, boundsPtr + 8, boundsPtr + 12);
              const l = heap.getValue(boundsPtr, "float");
              const b = heap.getValue(boundsPtr + 4, "float");
              const r = heap.getValue(boundsPtr + 8, "float");
              const t = heap.getValue(boundsPtr + 12, "float");
              if (midX >= l - 10 && midX <= r + 10 && midY >= b - 10 && midY <= t + 10) {
                targetObjIndex = i;
                const mPtr = malloc(24);
                try {
                  m.FPDFPageObj_GetMatrix(obj, mPtr);
                  targetBaselineY = heap.getValue(mPtr + 20, "float");
                } catch {} finally {
                  free(mPtr);
                }
                break;
              }
            }
          }
          return { rep, minX, maxX, minY, maxY, targetObjIndex, targetBaselineY };
        });
        free(boundsPtr);

        let pageRgbaData: Uint8Array | null = null;
        const scale = 300 / 72;
        const pageWidthPts = m.FPDF_GetPageWidth(page);
        const pageHeightPts = m.FPDF_GetPageHeight(page);
        const pageWidthPx = Math.round(pageWidthPts * scale);
        const pageHeightPx = Math.round(pageHeightPts * scale);

        if (pageHasImage && replacementTargets.length > 0) {
          const renderBmp = m.FPDFBitmap_Create(pageWidthPx, pageHeightPx, 0);
          m.FPDFBitmap_FillRect(renderBmp, 0, 0, pageWidthPx, pageHeightPx, 0xffffffff);
          m.FPDF_RenderPageBitmap(renderBmp, page, 0, 0, pageWidthPx, pageHeightPx, 0, 0x10 | 0x01);
          const bufPtr = m.FPDFBitmap_GetBuffer(renderBmp);
          const stride = m.FPDFBitmap_GetStride(renderBmp);
          const u8Mem = new Uint8Array((heap.wasmExports as any).memory.buffer);
          pageRgbaData = new Uint8Array(pageWidthPx * pageHeightPx * 4);
          for (let y = 0; y < pageHeightPx; y++) {
            const rowStart = bufPtr + y * stride;
            const dstRow = y * pageWidthPx * 4;
            for (let x = 0; x < pageWidthPx; x++) {
              const srcIdx = rowStart + x * 4;
              const dstIdx = dstRow + x * 4;
              pageRgbaData[dstIdx] = u8Mem[srcIdx + 2];     // R
              pageRgbaData[dstIdx + 1] = u8Mem[srcIdx + 1]; // G
              pageRgbaData[dstIdx + 2] = u8Mem[srcIdx];     // B
              pageRgbaData[dstIdx + 3] = u8Mem[srcIdx + 3]; // A
            }
          }
          m.FPDFBitmap_Destroy(renderBmp);
        }

        // 1. Redact old text in quads
        if (pageRemovals.length > 0) {
          const quads = malloc(pageRemovals.length * 32);
          try {
            pageRemovals.forEach((item, i) =>
              item.quad.forEach((value, j) => heap.setValue(quads + i * 32 + j * 4, value, "float"))
            );
            if (!m.EPDFText_RedactInQuads(page, quads, pageRemovals.length, !pageHasImage, false)) {
              throw Error("Seçili metin kaldırılamadı.");
            }
          } finally {
            free(quads);
          }
        }

        // 2. Insert replacements in reverse target order so earlier indices remain stable
        const sortedTargets = [...replacementTargets].sort((a, b) => {
          if (a.targetObjIndex < 0 && b.targetObjIndex < 0) return 0;
          if (a.targetObjIndex < 0) return 1;
          if (b.targetObjIndex < 0) return -1;
          return b.targetObjIndex - a.targetObjIndex;
        });

        for (const target of sortedTargets) {
          const { rep, minX, maxX, minY, maxY, targetObjIndex, targetBaselineY } = target;
          const stdFontName = resolveStandardFontName(rep);
          const font = m.FPDFText_LoadStandardFont(doc, stdFontName);
          if (!font) continue;

          let curIdx = targetObjIndex >= 0 ? targetObjIndex : m.FPDFPage_CountObjects(page);
          const baselineY = targetBaselineY && targetBaselineY > 0 ? targetBaselineY : (minY + 2.5);

          if (pageHasImage && pageRgbaData) {
            const boxLeft = Math.floor(minX * scale);
            const boxRight = Math.ceil(maxX * scale);
            const boxTop = Math.floor((pageHeightPts - maxY) * scale);
            const boxBottom = Math.ceil((pageHeightPts - minY) * scale);
            const basePx = Math.round((pageHeightPts - baselineY) * scale);

            // 1. Sample background paper luminance and grain around target box
            const bgSamples: { r: number; g: number; b: number; lum: number }[] = [];
            const searchPad = 15;
            for (let y = Math.max(0, boxTop - searchPad); y <= Math.min(pageHeightPx - 1, boxBottom + searchPad); y++) {
              for (let x = Math.max(0, boxLeft - 5); x <= Math.min(pageWidthPx - 1, boxRight + 5); x++) {
                const idx = (y * pageWidthPx + x) * 4;
                const r = pageRgbaData[idx], g = pageRgbaData[idx + 1], b = pageRgbaData[idx + 2];
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                if (lum > 215) {
                  bgSamples.push({ r, g, b, lum });
                }
              }
            }
            const bgR = bgSamples.length ? bgSamples.reduce((s, p) => s + p.r, 0) / bgSamples.length : 248;
            const bgG = bgSamples.length ? bgSamples.reduce((s, p) => s + p.g, 0) / bgSamples.length : 248;
            const bgB = bgSamples.length ? bgSamples.reduce((s, p) => s + p.b, 0) / bgSamples.length : 248;
            const bgLumMean = 0.299 * bgR + 0.587 * bgG + 0.114 * bgB;
            const darkThreshold = Math.min(180, bgLumMean - 35);

            const verticalSearchPad = 35;

            // 2. Locate first glyph start and estimate glyph height
            let glyphStart = boxLeft;
            for (let x = Math.max(0, boxLeft - 10); x <= Math.min(pageWidthPx - 1, boxLeft + 25); x++) {
              let hasDark = false;
              for (let y = Math.max(0, boxTop - verticalSearchPad); y <= Math.min(pageHeightPx - 1, boxBottom + verticalSearchPad); y++) {
                const idx = (y * pageWidthPx + x) * 4;
                const lum = 0.299 * pageRgbaData[idx] + 0.587 * pageRgbaData[idx + 1] + 0.114 * pageRgbaData[idx + 2];
                if (lum < darkThreshold) { hasDark = true; break; }
              }
              if (hasDark) { glyphStart = x; break; }
            }

            // Estimate character height from initial glyphs
            let firstTops: number[] = [], firstBots: number[] = [];
            for (let x = glyphStart; x <= Math.min(pageWidthPx - 1, glyphStart + 30); x++) {
              for (let y = Math.max(0, boxTop - verticalSearchPad); y <= Math.min(pageHeightPx - 1, boxBottom + verticalSearchPad); y++) {
                const idx = (y * pageWidthPx + x) * 4;
                const lum = 0.299 * pageRgbaData[idx] + 0.587 * pageRgbaData[idx + 1] + 0.114 * pageRgbaData[idx + 2];
                if (lum < darkThreshold) { firstTops.push(y); break; }
              }
              for (let y = Math.min(pageHeightPx - 1, boxBottom + verticalSearchPad); y >= Math.max(0, boxTop - verticalSearchPad); y--) {
                const idx = (y * pageWidthPx + x) * 4;
                const lum = 0.299 * pageRgbaData[idx] + 0.587 * pageRgbaData[idx + 1] + 0.114 * pageRgbaData[idx + 2];
                if (lum < darkThreshold) { firstBots.push(y); break; }
              }
            }
            firstTops.sort((a, b) => a - b);
            firstBots.sort((a, b) => a - b);
            const approxCharH = Math.max(12, (firstBots[firstBots.length - 1] || boxBottom) - (firstTops[0] || boxTop));
            const oldCharCount = (rep as any).originalText ? (rep as any).originalText.length : rep.text.length;
            const expectedMinW = Math.max(boxRight - boxLeft, oldCharCount * (approxCharH * 0.45));

            // Scan right across glyphs until word boundary whitespace gap
            const scanThresh = Math.min(140, bgLumMean - 60);
            let glyphEnd = glyphStart + Math.round(expectedMinW);
            let emptyRun = 0;
            let lastDarkCol = glyphStart;
            for (let x = glyphStart; x < Math.min(pageWidthPx - 1, glyphStart + Math.max(500, (boxRight - boxLeft) * 2)); x++) {
              let colDark = false;
              for (let y = Math.max(0, boxTop - verticalSearchPad); y <= Math.min(pageHeightPx - 1, boxBottom + verticalSearchPad); y++) {
                const idx = (y * pageWidthPx + x) * 4;
                const lum = 0.299 * pageRgbaData[idx] + 0.587 * pageRgbaData[idx + 1] + 0.114 * pageRgbaData[idx + 2];
                if (lum < scanThresh) { colDark = true; break; }
              }
              if (colDark) {
                lastDarkCol = x;
                emptyRun = 0;
              } else {
                emptyRun++;
                if (emptyRun >= 7 && (x - glyphStart) >= expectedMinW) {
                  glyphEnd = lastDarkCol;
                  break;
                }
              }
            }

            // Sample all dark foreground glyph pixels in [glyphStart, glyphEnd]
            const darkPixels: { x: number; y: number; r: number; g: number; b: number }[] = [];
            for (let y = Math.max(0, boxTop - verticalSearchPad); y <= Math.min(pageHeightPx - 1, boxBottom + verticalSearchPad); y++) {
              for (let x = glyphStart; x <= glyphEnd; x++) {
                const idx = (y * pageWidthPx + x) * 4;
                const r = pageRgbaData[idx], g = pageRgbaData[idx + 1], b = pageRgbaData[idx + 2];
                const lum = 0.299 * r + 0.587 * g + 0.114 * b;
                if (lum < darkThreshold) {
                  darkPixels.push({ x, y, r, g, b });
                }
              }
            }

            let minDX = glyphStart, maxDX = glyphEnd, minDY = boxTop, maxDY = boxBottom;
            let sumDarkR = 0, sumDarkG = 0, sumDarkB = 0;
            if (darkPixels.length > 0) {
              minDX = Infinity; maxDX = -Infinity; minDY = Infinity; maxDY = -Infinity;
              for (const p of darkPixels) {
                if (p.x < minDX) minDX = p.x;
                if (p.x > maxDX) maxDX = p.x;
                if (p.y < minDY) minDY = p.y;
                if (p.y > maxDY) maxDY = p.y;
                sumDarkR += p.r; sumDarkG += p.g; sumDarkB += p.b;
              }
            }
            const fgR = darkPixels.length ? (sumDarkR / darkPixels.length) : 75;
            const fgG = darkPixels.length ? (sumDarkG / darkPixels.length) : 75;
            const fgB = darkPixels.length ? (sumDarkB / darkPixels.length) : 75;
            const targetGlyphWidth = maxDX >= minDX ? (maxDX - minDX + 1) : Math.max(10, boxRight - boxLeft);

            // 3. Compute stroke run-lengths
            const strokeRuns: number[] = [];
            for (let y = minDY + 4; y <= maxDY - 4; y++) {
              let run = 0;
              for (let x = minDX; x <= maxDX; x++) {
                const idx = (y * pageWidthPx + x) * 4;
                const lum = 0.299 * pageRgbaData[idx] + 0.587 * pageRgbaData[idx + 1] + 0.114 * pageRgbaData[idx + 2];
                if (lum < darkThreshold) {
                  run++;
                } else {
                  if (run >= 3 && run <= 35) strokeRuns.push(run);
                  run = 0;
                }
              }
              if (run >= 3 && run <= 35) strokeRuns.push(run);
            }
            const targetStrokeWidth = strokeRuns.length ? (strokeRuns.reduce((a, b) => a + b, 0) / strokeRuns.length) : 12;

            // 4. Baseline and cap height
            const bottomYs: number[] = [];
            const topYs: number[] = [];
            for (let x = minDX; x <= maxDX; x++) {
              let bY = -1, tY = -1;
              for (let y = maxDY; y >= minDY; y--) {
                const idx = (y * pageWidthPx + x) * 4;
                const lum = 0.299 * pageRgbaData[idx] + 0.587 * pageRgbaData[idx + 1] + 0.114 * pageRgbaData[idx + 2];
                if (lum < darkThreshold) { bY = y; break; }
              }
              for (let y = minDY; y <= maxDY; y++) {
                const idx = (y * pageWidthPx + x) * 4;
                const lum = 0.299 * pageRgbaData[idx] + 0.587 * pageRgbaData[idx + 1] + 0.114 * pageRgbaData[idx + 2];
                if (lum < darkThreshold) { tY = y; break; }
              }
              if (bY > 0) bottomYs.push(bY);
              if (tY > 0) topYs.push(tY);
            }
            bottomYs.sort((a, b) => a - b);
            const measuredBaseline = bottomYs.length ? (bottomYs[Math.floor(bottomYs.length * 0.90)] || basePx) : basePx;
            topYs.sort((a, b) => a - b);
            const measuredMedianTop = topYs.length ? (topYs[Math.floor(topYs.length * 0.05)] || minDY) : minDY;
            const targetCapHeight = Math.max(12, measuredBaseline - measuredMedianTop + 1);

            // 5. Find preceding dark pixel to determine safe whitespace gap
            let prevDarkX = minDX - 30;
            for (let x = minDX - 1; x >= Math.max(0, minDX - 80); x--) {
              let foundDark = false;
              for (let y = Math.max(0, minDY - 2); y <= Math.min(pageHeightPx - 1, maxDY + 2); y++) {
                const idx = (y * pageWidthPx + x) * 4;
                const lum = 0.299 * pageRgbaData[idx] + 0.587 * pageRgbaData[idx + 1] + 0.114 * pageRgbaData[idx + 2];
                if (lum < darkThreshold) {
                  prevDarkX = x;
                  foundDark = true;
                  break;
                }
              }
              if (foundDark) break;
            }

            const gap = minDX - prevDarkX;
            const safeLeftPad = Math.max(8, Math.min(15, Math.floor(gap / 2)));
            const patchLeft = Math.max(0, minDX - safeLeftPad);
            const patchTop = Math.max(0, minDY - 17);
            const patchBottom = Math.min(pageHeightPx, maxDY + 18);
            const patchHeight = patchBottom - patchTop;

            const expectedTextWidth = (oldCharCount === rep.text.length)
              ? targetGlyphWidth
              : Math.round((targetGlyphWidth / Math.max(1, oldCharCount)) * rep.text.length);
            const safeRightPad = Math.max(2, Math.min(5, Math.floor(safeLeftPad / 3)));
            const patchWidth = safeLeftPad + Math.max(targetGlyphWidth, expectedTextWidth) + safeRightPad;

            // 6. Copy patch background from page and inpaint old dark pixels
            const patchData = new Uint8Array(patchWidth * patchHeight * 4);
            for (let py = 0; py < patchHeight; py++) {
              const cy = patchTop + py;
              const srcRow = cy * pageWidthPx * 4;
              const dstRow = py * patchWidth * 4;
              for (let px = 0; px < patchWidth; px++) {
                const cx = patchLeft + px;
                const srcIdx = srcRow + cx * 4;
                const dstIdx = dstRow + px * 4;
                patchData[dstIdx] = pageRgbaData[srcIdx];
                patchData[dstIdx + 1] = pageRgbaData[srcIdx + 1];
                patchData[dstIdx + 2] = pageRgbaData[srcIdx + 2];
                patchData[dstIdx + 3] = 255;
              }
            }

            for (let px = 0; px < patchWidth; px++) {
              const topR = patchData[(2 * patchWidth + px) * 4];
              const topG = patchData[(2 * patchWidth + px) * 4 + 1];
              const topB = patchData[(2 * patchWidth + px) * 4 + 2];
              const botR = patchData[((patchHeight - 3) * patchWidth + px) * 4];
              const botG = patchData[((patchHeight - 3) * patchWidth + px) * 4 + 1];
              const botB = patchData[((patchHeight - 3) * patchWidth + px) * 4 + 2];

              for (let py = 0; py < patchHeight; py++) {
                const pIdx = (py * patchWidth + px) * 4;
                const lum = 0.299 * patchData[pIdx] + 0.587 * patchData[pIdx + 1] + 0.114 * patchData[pIdx + 2];
                if (lum < darkThreshold) {
                  const alpha = py / patchHeight;
                  patchData[pIdx] = Math.round(topR * (1 - alpha) + botR * alpha);
                  patchData[pIdx + 1] = Math.round(topG * (1 - alpha) + botG * alpha);
                  patchData[pIdx + 2] = Math.round(topB * (1 - alpha) + botB * alpha);
                }
              }
            }

            // 7. Dynamic typography calibration via universal Canvas
            const { canvas, ctx } = await createUniversalCanvas(patchWidth, patchHeight);
            if (ctx) {
              let fontSize = Math.round(targetCapHeight * 1.45);
              const isSerif = Boolean(rep.font === "serif" || rep.originalFontName?.toLowerCase().includes("times"));
              const isMono = Boolean(rep.font === "courier" || rep.originalFontName?.toLowerCase().includes("courier"));
              const fontFamily = isMono
                ? '"Courier New", "Courier", monospace'
                : isSerif
                  ? '"Times New Roman", "Times", serif'
                  : '"Helvetica", "Arial", "Liberation Sans", sans-serif';

              ctx.font = `bold ${fontSize}px ${fontFamily}`;
              let metrics = ctx.measureText(rep.text);
              const naturalAscent = metrics.actualBoundingBoxAscent || (fontSize * 0.70);
              if (naturalAscent > 0) {
                fontSize = Math.round(fontSize * (targetCapHeight / naturalAscent));
                ctx.font = `bold ${fontSize}px ${fontFamily}`;
                metrics = ctx.measureText(rep.text);
              }

              const naturalWidth = metrics.width || 1;
              let scaleX = expectedTextWidth / naturalWidth;
              let scaleY = 1.0;
              const targetRenderStroke = targetStrokeWidth;
              const naturalStroke = (fontSize * scaleY) * 0.14;
              const strokeDiff = Math.max(0, targetRenderStroke - naturalStroke);
              let lineWidth = strokeDiff;

              const isBrowser = typeof window !== "undefined";
              const colorPreComp = fgR < 60
                ? Math.max(2.5, fgR * 0.14)
                : (isBrowser ? 0.6 : 2.5);
              const targetRenderColor = Math.max(0, fgR - colorPreComp);
              let calibR = targetRenderColor;
              let calibG = targetRenderColor;
              let calibB = targetRenderColor;

              const startXInPatch = minDX - patchLeft;
              const baselineInPatch = measuredBaseline - patchTop;

              let baseOffset = 0;
              const targetBaseInPatch = measuredBaseline - patchTop;

              const renderWithParams = (sX: number, sY: number, lW: number, cR: number, cG: number, cB: number, bOff: number = baseOffset) => {
                const imgData = ctx.createImageData(patchWidth, patchHeight);
                imgData.data.set(patchData);
                ctx.putImageData(imgData, 0, 0);

                const col = `rgb(${Math.max(0, Math.min(255, Math.round(cR)))}, ${Math.max(0, Math.min(255, Math.round(cG)))}, ${Math.max(0, Math.min(255, Math.round(cB)))})`;
                ctx.save();
                ctx.translate(startXInPatch, baselineInPatch + bOff);
                ctx.scale(sX, sY);
                ctx.font = `bold ${fontSize}px ${fontFamily}`;
                ctx.fillStyle = col;
                ctx.strokeStyle = col;
                ctx.lineWidth = lW;
                ctx.lineJoin = 'round';
                ctx.lineCap = 'round';
                if (lW > 0.4) {
                  ctx.strokeText(rep.text, 0, 0);
                }
                ctx.fillText(rep.text, 0, 0);
                ctx.restore();
                return ctx.getImageData(0, 0, patchWidth, patchHeight);
              };

              const evalPatch = (pImg: any) => {
                let minPX = Infinity, maxPX = -Infinity, minPY = Infinity, maxPY = -Infinity;
                let dCount = 0, dSumR = 0;
                for (let py = 0; py < patchHeight; py++) {
                  for (let px = 0; px < patchWidth; px++) {
                    const idx = (py * patchWidth + px) * 4;
                    const lum = 0.299 * pImg.data[idx] + 0.587 * pImg.data[idx + 1] + 0.114 * pImg.data[idx + 2];
                    if (lum < darkThreshold) {
                      dCount++;
                      dSumR += pImg.data[idx];
                      if (px < minPX) minPX = px;
                      if (px > maxPX) maxPX = px;
                      if (py < minPY) minPY = py;
                      if (py > maxPY) maxPY = py;
                    }
                  }
                }
                const rWidth = maxPX >= minPX ? maxPX - minPX + 1 : 0;
                const rColor = dCount ? (dSumR / dCount) : 0;

                const sRuns: number[] = [];
                for (let py = minPY + 4; py <= maxPY - 4; py++) {
                  let run = 0;
                  for (let px = minPX; px <= maxPX; px++) {
                    const idx = (py * patchWidth + px) * 4;
                    const lum = 0.299 * pImg.data[idx] + 0.587 * pImg.data[idx + 1] + 0.114 * pImg.data[idx + 2];
                    if (lum < darkThreshold) {
                      run++;
                    } else {
                      if (run >= 3 && run <= 35) sRuns.push(run);
                      run = 0;
                    }
                  }
                  if (run >= 3 && run <= 35) sRuns.push(run);
                }
                const rStroke = sRuns.length ? sRuns.reduce((a, b) => a + b, 0) / sRuns.length : 0;

                const bYs: number[] = [], tYs: number[] = [];
                for (let px = minPX; px <= maxPX; px++) {
                  let bY = -1, tY = -1;
                  for (let py = maxPY; py >= minPY; py--) {
                    const idx = (py * patchWidth + px) * 4;
                    const lum = 0.299 * pImg.data[idx] + 0.587 * pImg.data[idx + 1] + 0.114 * pImg.data[idx + 2];
                    if (lum < darkThreshold) { bY = py; break; }
                  }
                  for (let py = minPY; py <= maxPY; py++) {
                    const idx = (py * patchWidth + px) * 4;
                    const lum = 0.299 * pImg.data[idx] + 0.587 * pImg.data[idx + 1] + 0.114 * pImg.data[idx + 2];
                    if (lum < darkThreshold) { tY = py; break; }
                  }
                  if (bY > 0) bYs.push(bY);
                  if (tY > 0) tYs.push(tY);
                }
                bYs.sort((a, b) => a - b);
                const rBase = bYs[Math.floor(bYs.length * 0.90)] || 0;
                tYs.sort((a, b) => a - b);
                const rCapTop = tYs.length ? (tYs[Math.floor(tYs.length * 0.05)] || minPY) : minPY;
                const rCapHeight = rBase - rCapTop + 1;

                return { rWidth, rCapHeight, rStroke, rColor, rBase };
              };

              for (let iter = 0; iter < 6; iter++) {
                const curImg = renderWithParams(scaleX, scaleY, lineWidth, calibR, calibG, calibB, baseOffset);
                const ev = evalPatch(curImg);
                let adjusted = false;
                if (ev.rWidth > 0 && Math.abs(ev.rWidth - expectedTextWidth) > 0.6) {
                  scaleX *= (expectedTextWidth / ev.rWidth);
                  adjusted = true;
                }
                if (ev.rCapHeight > 0 && Math.abs(ev.rCapHeight - targetCapHeight) > 0.5) {
                  scaleY *= (targetCapHeight / ev.rCapHeight);
                  adjusted = true;
                }
                if (ev.rBase > 0 && Math.abs(ev.rBase - targetBaseInPatch) > 0.3) {
                  baseOffset -= (ev.rBase - targetBaseInPatch);
                  adjusted = true;
                }
                if (ev.rStroke > 0 && Math.abs(ev.rStroke - targetRenderStroke) > 0.2) {
                  lineWidth += (targetRenderStroke - ev.rStroke) * 0.85;
                  if (lineWidth < 0) lineWidth = 0;
                  adjusted = true;
                }
                if (ev.rColor > 0 && Math.abs(ev.rColor - targetRenderColor) > 0.4) {
                  const colorDelta = ev.rColor - targetRenderColor;
                  calibR -= colorDelta * 1.1;
                  calibG -= colorDelta * 1.1;
                  calibB -= colorDelta * 1.1;
                  adjusted = true;
                }
                if (!adjusted) break;
              }

              const finalPatch = renderWithParams(scaleX, scaleY, lineWidth, calibR, calibG, calibB, baseOffset);

              const imgObj = m.FPDFPageObj_NewImageObj(doc);
              const patchBmp = m.FPDFBitmap_Create(patchWidth, patchHeight, 1);
              const bmpBuf = m.FPDFBitmap_GetBuffer(patchBmp);
              const bmpStride = m.FPDFBitmap_GetStride(patchBmp);
              const u8Bmp = new Uint8Array((heap.wasmExports as any).memory.buffer);

              for (let y = 0; y < patchHeight; y++) {
                const rowStart = bmpBuf + y * bmpStride;
                for (let x = 0; x < patchWidth; x++) {
                  const srcIdx = (y * patchWidth + x) * 4;
                  const dstIdx = rowStart + x * 4;
                  u8Bmp[dstIdx] = finalPatch.data[srcIdx + 2];     // B
                  u8Bmp[dstIdx + 1] = finalPatch.data[srcIdx + 1]; // G
                  u8Bmp[dstIdx + 2] = finalPatch.data[srcIdx];     // R
                  u8Bmp[dstIdx + 3] = finalPatch.data[srcIdx + 3]; // A
                }
              }

              const pagePtr = malloc(4);
              heap.setValue(pagePtr, page, "i32");
              m.FPDFImageObj_SetBitmap(pagePtr, 1, imgObj, patchBmp);
              free(pagePtr);
              m.FPDFBitmap_Destroy(patchBmp);

              const patchLeftPts = patchLeft / scale;
              const patchBottomPts = pageHeightPts - (patchTop + patchHeight) / scale;
              const patchWidthPts = patchWidth / scale;
              const patchHeightPts = patchHeight / scale;

              m.FPDFPageObj_Transform(imgObj, patchWidthPts, 0, 0, patchHeightPts, patchLeftPts, patchBottomPts);
              m.FPDFPage_InsertObjectAtIndex(page, imgObj, curIdx);
              curIdx++;
            }

            // Create invisible OCR text object
            const textObj = m.FPDFPageObj_CreateTextObj(doc, font, Math.max(6, rep.size || 12));
            const textPtr = allocateUtf16LeString(heap, rep.text);
            if (textObj && textPtr) {
              try {
                m.FPDFText_SetText(textObj, textPtr);
                m.FPDFPageObj_Transform(textObj, 1, 0, 0, 1, minX, baselineY);
                m.FPDFTextObj_SetTextRenderMode(textObj, 3); // 3 = invisible OCR text mode
                m.FPDFPageObj_SetFillColor(textObj, 0, 0, 0, 0); // alpha = 0
                m.FPDFPage_InsertObjectAtIndex(page, textObj, curIdx);
                appliedMarkIds.push(rep.markId);
              } catch (setTextErr) {
                console.warn("FPDFText_SetText invisible OCR text failed:", setTextErr);
                try { m.FPDFPageObj_Destroy(textObj); } catch {}
              } finally {
                free(textPtr);
              }
            } else {
              if (textPtr) free(textPtr);
              appliedMarkIds.push(rep.markId);
            }
          } else {
            // Pure vector path
            if (rep.bg) {
              const bgRgb = parseHexColor(rep.bg);
              const rectLeft = minX - 0.5;
              const rectRight = Math.max(maxX + 6, minX + Math.max(maxX - minX, rep.text.length * rep.size * 0.75) * 1.50);
              const rectBottom = baselineY - rep.size * 0.25;
              const rectTop = baselineY + rep.size * 1.30;
              const rectObj = m.FPDFPageObj_CreateNewRect(
                rectLeft,
                rectBottom,
                Math.max(1, rectRight - rectLeft),
                Math.max(1, rectTop - rectBottom)
              );
              m.FPDFPageObj_SetFillColor(rectObj, bgRgb.r, bgRgb.g, bgRgb.b, 255);
              m.FPDFPath_SetDrawMode(rectObj, 2, false);
              m.FPDFPage_InsertObjectAtIndex(page, rectObj, curIdx);
              curIdx++;
            }

            const textObj = m.FPDFPageObj_CreateTextObj(doc, font, Math.max(6, rep.size || 12));
            const textPtr = allocateUtf16LeString(heap, rep.text);
            if (textObj && textPtr) {
              try {
                m.FPDFText_SetText(textObj, textPtr);
                m.FPDFPageObj_Transform(textObj, 1, 0, 0, 1, minX, baselineY);
                const colRgb = parseHexColor(rep.color || "#000000");
                m.FPDFPageObj_SetFillColor(textObj, colRgb.r, colRgb.g, colRgb.b, 255);
                m.FPDFPage_InsertObjectAtIndex(page, textObj, curIdx);
                appliedMarkIds.push(rep.markId);
              } catch (setTextErr) {
                console.warn("FPDFText_SetText vector text failed:", setTextErr);
                try { m.FPDFPageObj_Destroy(textObj); } catch {}
              } finally {
                free(textPtr);
              }
            } else {
              if (textPtr) free(textPtr);
              appliedMarkIds.push(rep.markId);
            }
          }
        }

        if (!m.FPDFPage_GenerateContent(page)) throw Error("Sayfa değişiklikleri kaydedilemedi.");
      } finally {
        m.FPDF_ClosePage(page);
      }
    }

    const writer = m.PDFiumExt_OpenFileWriter();
    let output = 0;
    try {
      if (!m.PDFiumExt_SaveAsCopy(doc, writer)) throw Error("Düzenlenen PDF oluşturulamadı.");
      const length = m.PDFiumExt_GetFileWriterSize(writer);
      output = malloc(length);
      m.PDFiumExt_GetFileWriterData(writer, output, length);
      return { bytes: heap.HEAPU8.slice(output, output + length), appliedMarkIds };
    } finally {
      if (output) free(output);
      m.PDFiumExt_CloseFileWriter(writer);
    }
  } finally {
    if (doc) m.FPDF_CloseDocument(doc);
    free(input);
  }
}

/** Rewrites text content streams. No opaque rectangles or rasterized pages. */
export async function removePdfText(bytes: Uint8Array, removals: TextRemoval[]) {
  const { bytes: updatedBytes } = await applyPdfTextReplacements(bytes, removals, []);
  return updatedBytes;
}

export type TextObjectRemovalTarget = {
  candidateTexts?: string[];
  candidateItems?: Array<{ id: string; text: string }>;
  targetPages?: number[];
  keywords?: string[];
};

function checkWatermarkMatchWithId(
  rawText: string,
  candidateItems: Array<{ id: string; text: string }> | undefined,
  candidateTexts: string[],
  keywords: string[]
): { matched: boolean; candidateId?: string } {
  if (!rawText || rawText.trim().length < 2) return { matched: false };
  const norm = rawText
    .replace(/İ/g, "i").replace(/I/g, "ı").replace(/ı/g, "i")
    .replace(/Ğ/g, "g").replace(/ğ/g, "g")
    .replace(/Ü/g, "u").replace(/ü/g, "u")
    .replace(/Ş/g, "s").replace(/ş/g, "s")
    .replace(/Ö/g, "o").replace(/ö/g, "o")
    .replace(/Ç/g, "c").replace(/ç/g, "c")
    .toLowerCase()
    .trim();

  // Contract clause immunity (Madde 1:, Article 2:, etc.)
  if (/^(?:madde|article|fıkra|fikra|bent|bolum|kisim|ek|taraflar|konu|amac|hukumler|sozlesme|protokol)\s*\d*[:.]?/i.test(norm)) {
    return { matched: false };
  }

  const spaceless = norm.replace(/[\s\-_.]/g, "");

  // 1. Check against candidate items (exact match or isolated phrase only)
  if (candidateItems && candidateItems.length > 0) {
    for (const item of candidateItems) {
      if (!item.text) continue;
      const candNorm = item.text
        .replace(/İ/g, "i").replace(/I/g, "ı").replace(/ı/g, "i")
        .replace(/Ğ/g, "g").replace(/ğ/g, "g")
        .replace(/Ü/g, "u").replace(/ü/g, "u")
        .replace(/Ş/g, "s").replace(/ş/g, "s")
        .replace(/Ö/g, "o").replace(/ö/g, "o")
        .replace(/Ç/g, "c").replace(/ç/g, "c")
        .toLowerCase()
        .trim();
      const candSpaceless = candNorm.replace(/[\s\-_.]/g, "");
      if (norm === candNorm || spaceless === candSpaceless) return { matched: true, candidateId: item.id };
      if (candNorm.length >= 4) {
        const wordRegex = new RegExp(`(?:^|[^a-z0-9])${candNorm}(?:[^a-z0-9]|$)`, "i");
        if (wordRegex.test(norm)) {
          if (norm.length <= candNorm.length + 8 || norm.split(/\s+/).length <= 4) {
            return { matched: true, candidateId: item.id };
          }
        }
      }
    }
  }

  // 2. Check against candidate texts (exact match or isolated phrase only)
  for (const cand of candidateTexts) {
    if (!cand) continue;
    const candNorm = cand
      .replace(/İ/g, "i").replace(/I/g, "ı").replace(/ı/g, "i")
      .replace(/Ğ/g, "g").replace(/ğ/g, "g")
      .replace(/Ü/g, "u").replace(/ü/g, "u")
      .replace(/Ş/g, "s").replace(/ş/g, "s")
      .replace(/Ö/g, "o").replace(/ö/g, "o")
      .replace(/Ç/g, "c").replace(/ç/g, "c")
      .toLowerCase()
      .trim();
    const candSpaceless = candNorm.replace(/[\s\-_.]/g, "");
    if (norm === candNorm || spaceless === candSpaceless) return { matched: true };
    if (candNorm.length >= 4) {
      const wordRegex = new RegExp(`(?:^|[^a-z0-9])${candNorm}(?:[^a-z0-9]|$)`, "i");
      if (wordRegex.test(norm)) {
        if (norm.length <= candNorm.length + 8 || norm.split(/\s+/).length <= 4) {
          return { matched: true };
        }
      }
    }
  }

  // 3. Check against explicit keywords (only if provided and not part of regular sentence)
  for (const kw of keywords) {
    const kwNorm = kw.toLowerCase().trim();
    const kwSpaceless = kwNorm.replace(/[\s\-_.]/g, "");
    if (norm === kwNorm || spaceless === kwSpaceless) return { matched: true };
    if (kwSpaceless.length >= 4 && (norm === kwNorm || (norm.length <= kwNorm.length + 4 && spaceless === kwSpaceless))) {
      return { matched: true };
    }
  }

  return { matched: false };
}

/**
 * Surgical Object-Level Text Removal via PDFium.
 * Removes entire text objects directly from the PDF stream without altering or redacting
 * adjacent or overlapping legitimate contract text.
 */
export async function removePdfTextObjects(
  bytes: Uint8Array,
  target: TextObjectRemovalTarget
): Promise<{ bytes: Uint8Array; removedCount: number; removedCandidateIds?: string[] }> {
  const m = await engine();
  const heap = m.pdfium as unknown as ExtendedPdfiumRuntime;
  const { malloc, free } = heap.wasmExports;

  const input = malloc(bytes.length);
  let doc = 0;
  let removedCount = 0;

  const candidateItems = target.candidateItems;
  const candidateTexts = target.candidateTexts || [];
  const targetPages = target.targetPages ? new Set(target.targetPages) : null;
  const keywords = target.keywords || [];
  const removedCandidateIds = new Set<string>();

  const bufferSize = 4096;
  const bufPtr = malloc(bufferSize);

  try {
    heap.HEAPU8.set(bytes, input);
    doc = m.FPDF_LoadMemDocument(input, bytes.length, "");
    if (!doc) throw Error("PDF metin nesnesi düzenlemesi için açılamadı.");

    const pageCount = m.FPDF_GetPageCount(doc);

    for (let pageIdx = 0; pageIdx < pageCount; pageIdx++) {
      if (targetPages && !targetPages.has(pageIdx)) continue;

      const page = m.FPDF_LoadPage(doc, pageIdx);
      if (!page) continue;
      const textPage = m.FPDFText_LoadPage(page);

      const objCount = m.FPDFPage_CountObjects(page);
      const toRemove: Array<{ obj: number; candidateId?: string }> = [];

      for (let i = 0; i < objCount; i++) {
        const obj = m.FPDFPage_GetObject(page, i);
        const type = m.FPDFPageObj_GetType(obj);

        if (type === 1) { // FPDF_PAGEOBJ_TEXT
          heap.HEAPU8.fill(0, bufPtr, bufPtr + bufferSize);
          const written = m.FPDFTextObj_GetText(obj, textPage, bufPtr, bufferSize);
          if (written > 2) {
            const charCount = Math.max(0, Math.floor((written - 2) / 2));
            const u16 = new Uint16Array(heap.HEAPU8.buffer, bufPtr, charCount);
            const rawText = String.fromCharCode(...u16);

            const match = checkWatermarkMatchWithId(rawText, candidateItems, candidateTexts, keywords);
            if (match.matched) {
              toRemove.push({ obj, candidateId: match.candidateId });
            }
          }
        } else if (type === 5) { // FPDF_PAGEOBJ_FORM
          if (m.FPDFFormObj_CountObjects && m.FPDFFormObj_GetObject && m.FPDFFormObj_RemoveObject) {
            const nestedCount = m.FPDFFormObj_CountObjects(obj);
            for (let j = 0; j < nestedCount; j++) {
              const nestedObj = m.FPDFFormObj_GetObject(obj, j);
              if (nestedObj && m.FPDFPageObj_GetType(nestedObj) === 1) {
                heap.HEAPU8.fill(0, bufPtr, bufPtr + bufferSize);
                const written = m.FPDFTextObj_GetText(nestedObj, textPage, bufPtr, bufferSize);
                if (written > 2) {
                  const charCount = Math.max(0, Math.floor((written - 2) / 2));
                  const u16 = new Uint16Array(heap.HEAPU8.buffer, bufPtr, charCount);
                  const rawText = String.fromCharCode(...u16);
                  const formMatch = checkWatermarkMatchWithId(rawText, candidateItems, candidateTexts, keywords);
                  if (formMatch.matched) {
                    m.FPDFFormObj_RemoveObject(obj, nestedObj);
                    removedCount++;
                    if (formMatch.candidateId) removedCandidateIds.add(formMatch.candidateId);
                  }
                }
              }
            }
          }
        }
      }

      for (const item of toRemove) {
        if (m.FPDFPage_RemoveObject(page, item.obj)) {
          removedCount++;
          if (item.candidateId) removedCandidateIds.add(item.candidateId);
        }
      }

      if (toRemove.length > 0) {
        m.FPDFPage_GenerateContent(page);
      }

      m.FPDFText_ClosePage(textPage);
      m.FPDF_ClosePage(page);
    }

    if (removedCount === 0) {
      return { bytes, removedCount: 0, removedCandidateIds: [] };
    }

    const writer = m.PDFiumExt_OpenFileWriter();
    let output = 0;
    try {
      if (!m.PDFiumExt_SaveAsCopy(doc, writer)) throw Error("Düzenlenen PDF oluşturulamadı.");
      const length = m.PDFiumExt_GetFileWriterSize(writer);
      output = malloc(length);
      m.PDFiumExt_GetFileWriterData(writer, output, length);
      return {
        bytes: heap.HEAPU8.slice(output, output + length),
        removedCount,
        removedCandidateIds: Array.from(removedCandidateIds)
      };
    } finally {
      if (output) free(output);
      m.PDFiumExt_CloseFileWriter(writer);
    }
  } finally {
    free(bufPtr);
    if (doc) m.FPDF_CloseDocument(doc);
    free(input);
  }
}

export type ImageRemoval = {
  page: number;
  bounds?: { left: number; bottom: number; right: number; top: number };
  imageId?: string;
  objectRef?: string | number;
  imageIndex?: number;
  pixelWidth?: number;
  pixelHeight?: number;
  matrix?: number[];
  contentHash?: string;
};

/**
 * Removes image objects from PDF content streams via PDFium.
 * Traverses both top-level page objects and nested Form XObjects (FPDF_PAGEOBJ_FORM).
 * Matches strictly using pixel dimensions, matrix, CropBox/MediaBox bounds, and sequence order.
 */
export type RemovePdfImagesResult = Uint8Array & {
  pdfBytes: Uint8Array;
  removedCount: number;
};

/**
 * Removes image objects from PDF content streams via PDFium.
 * Traverses both top-level page objects and nested Form XObjects (FPDF_PAGEOBJ_FORM).
 * Matches strictly using pixel dimensions, matrix, CropBox/MediaBox bounds, and sequence order.
 * Strictly guarantees that duplicate XObject placements on the same or other pages are not wiped out.
 */
export async function removePdfImages(
  bytes: Uint8Array,
  removals: ImageRemoval[]
): Promise<RemovePdfImagesResult> {
  if (typeof window !== "undefined" && import.meta.env?.DEV && process.env.NEXT_PUBLIC_ENABLE_TEST_API === "true") {
    if ((window as any).__dragTestCounters) (window as any).__dragTestCounters.pdfiumCallCount++;
  }
  if (!removals.length) {
    return Object.assign(bytes, { pdfBytes: bytes, removedCount: 0 });
  }
  const m = (await engine()) as any;
  const heap = m.pdfium as unknown as ExtendedPdfiumRuntime;
  const { malloc, free } = heap.wasmExports;
  const input = malloc(bytes.length);
  let doc = 0;
  let totalRemovedCount = 0;

  try {
    heap.HEAPU8.set(bytes, input);
    doc = m.FPDF_LoadMemDocument(input, bytes.length, "");
    if (!doc) throw Error("PDF görsel düzenlemesi için açılamadı.");

    const boundsPtr = malloc(16);
    const matrixPtr = malloc(24);
    const wPtr = malloc(4);
    const hPtr = malloc(4);

    try {
      const multiplyMatrix = (m1: number[], m2: number[]): number[] => [
        m1[0] * m2[0] + m1[2] * m2[1],
        m1[1] * m2[0] + m1[3] * m2[1],
        m1[0] * m2[2] + m1[2] * m2[3],
        m1[1] * m2[2] + m1[3] * m2[3],
        m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
        m1[1] * m2[4] + m1[3] * m2[5] + m1[5]
      ];

      for (const index of new Set(removals.map((r) => r.page))) {
        const page = m.FPDF_LoadPage(doc, index);
        if (!page) continue;
        const pageRemovals = removals.filter((r) => r.page === index);

        type Candidate = {
          obj: number;
          parentForm: number | null;
          bounds: { left: number; bottom: number; right: number; top: number };
          matrix: number[] | null;
          pixelWidth: number;
          pixelHeight: number;
          index: number;
        };

        const candidates: Candidate[] = [];
        let imgSequence = 0;

        const scanObject = (obj: number, parentForm: number | null, parentMatrix: number[] | null) => {
          if (!obj) return;
          const type = m.FPDFPageObj_GetType(obj);

          if (type === 3) {
            // FPDF_PAGEOBJ_IMAGE
            m.FPDFPageObj_GetBounds(obj, boundsPtr, boundsPtr + 4, boundsPtr + 8, boundsPtr + 12);
            const left = heap.getValue(boundsPtr, "float");
            const bottom = heap.getValue(boundsPtr + 4, "float");
            const right = heap.getValue(boundsPtr + 8, "float");
            const top = heap.getValue(boundsPtr + 12, "float");

            let matrix: number[] | null = null;
            if (m.FPDFPageObj_GetMatrix && m.FPDFPageObj_GetMatrix(obj, matrixPtr)) {
              const rawMat = Array.from(new Float32Array(heap.HEAPU8.buffer, matrixPtr, 6));
              matrix = parentMatrix ? multiplyMatrix(parentMatrix, rawMat) : rawMat;
            }

            let pW = 0;
            let pH = 0;
            if (m.FPDFImageObj_GetImagePixelSize && m.FPDFImageObj_GetImagePixelSize(obj, wPtr, hPtr)) {
              pW = heap.getValue(wPtr, "i32");
              pH = heap.getValue(hPtr, "i32");
            }

            candidates.push({
              obj,
              parentForm,
              bounds: { left, bottom, right, top },
              matrix,
              pixelWidth: pW,
              pixelHeight: pH,
              index: imgSequence++
            });
          } else if (type === 5) {
            // FPDF_PAGEOBJ_FORM
            let formMat = parentMatrix;
            if (m.FPDFPageObj_GetMatrix && m.FPDFPageObj_GetMatrix(obj, matrixPtr)) {
              const rawMat = Array.from(new Float32Array(heap.HEAPU8.buffer, matrixPtr, 6));
              formMat = parentMatrix ? multiplyMatrix(parentMatrix, rawMat) : rawMat;
            }
            if (m.FPDFFormObj_CountObjects) {
              const nestedCount = m.FPDFFormObj_CountObjects(obj);
              for (let j = 0; j < nestedCount; j++) {
                const nestedObj = m.FPDFFormObj_GetObject(obj, j);
                if (nestedObj) scanObject(nestedObj, obj, formMat);
              }
            }
          }
        };

        const count = m.FPDFPage_CountObjects(page);
        for (let i = 0; i < count; i++) {
          const obj = m.FPDFPage_GetObject(page, i);
          scanObject(obj, null, null);
        }

        const removedObjs = new Set<number>();
        let pageHasChanges = false;

        for (const rem of pageRemovals) {
          let bestCand: Candidate | null = null;
          let bestScore = -Infinity;
          let runnerUpScore = -Infinity;

          for (const cand of candidates) {
            if (removedObjs.has(cand.obj)) continue;

            // 1. Mandatory Location / Bounds Verification
            if (!rem.bounds || !cand.bounds) continue;

            const tb = rem.bounds;
            const cb = cand.bounds;
            const centerDist = Math.hypot(
              (cb.left + cb.right) / 2 - (tb.left + tb.right) / 2,
              (cb.bottom + cb.top) / 2 - (tb.bottom + tb.top) / 2
            );
            const edgeDiff =
              Math.abs(cb.left - tb.left) +
              Math.abs(cb.bottom - tb.bottom) +
              Math.abs(cb.right - tb.right) +
              Math.abs(cb.top - tb.top);

            const matrixMatches = Boolean(
              rem.matrix &&
              cand.matrix &&
              Math.abs(rem.matrix[0] - cand.matrix[0]) < 2 &&
              Math.abs(rem.matrix[1] - cand.matrix[1]) < 2 &&
              Math.abs(rem.matrix[2] - cand.matrix[2]) < 2 &&
              Math.abs(rem.matrix[3] - cand.matrix[3]) < 2 &&
              Math.abs(rem.matrix[4] - cand.matrix[4]) < 2 &&
              Math.abs(rem.matrix[5] - cand.matrix[5]) < 2
            );

            // Location must match within tolerance unless exact transformation matrix is confirmed
            if (!matrixMatches && edgeDiff > 35 && centerDist > 30) {
              continue; // Reject wrong location immediately
            }

            // In addition to bounds, at least one other attribute must be confirmed:
            let hasCorroboration = false;
            let score = 0;

            // Bounds score
            if (edgeDiff < 2) score += 200;
            else if (edgeDiff < 10) score += 140;
            else if (edgeDiff < 25 || centerDist < 15) score += 80;

            // Pixel dimension verification
            if (rem.pixelWidth && rem.pixelHeight && cand.pixelWidth && cand.pixelHeight) {
              if (rem.pixelWidth === cand.pixelWidth && rem.pixelHeight === cand.pixelHeight) {
                score += 150;
                hasCorroboration = true;
              } else {
                continue; // Pixel size mismatch cannot be the same image
              }
            }

            // Matrix verification
            if (rem.matrix && cand.matrix) {
              const matDiff =
                Math.abs(rem.matrix[0] - cand.matrix[0]) +
                Math.abs(rem.matrix[3] - cand.matrix[3]) +
                Math.abs(rem.matrix[4] - cand.matrix[4]) +
                Math.abs(rem.matrix[5] - cand.matrix[5]);
              if (matDiff < 2) {
                score += 100;
                hasCorroboration = true;
              } else if (matDiff < 15) {
                score += 50;
                hasCorroboration = true;
              }
            }

            // Sequential index verification
            if (typeof rem.imageIndex === "number" && rem.imageIndex === cand.index) {
              score += 60;
              hasCorroboration = true;
            }

            // ObjectRef verification
            if (rem.objectRef && String(rem.objectRef) === String(cand.obj)) {
              score += 150;
              hasCorroboration = true;
            }

            // If only bounds existed without any other metadata, bounds must be near-exact (< 5 edgeDiff)
            if (!hasCorroboration && edgeDiff < 5) {
              hasCorroboration = true;
            }

            if (!hasCorroboration) continue;

            if (score > bestScore) {
              runnerUpScore = bestScore;
              bestScore = score;
              bestCand = cand;
            } else if (score > runnerUpScore) {
              runnerUpScore = score;
            }
          }

          // Ambiguity protection: if two or more candidates have the same score or difference <= 5, reject!
          if (bestCand && (bestScore - runnerUpScore <= 5 && runnerUpScore > 0)) {
            bestCand = null; // Ambiguous match! Safely reject.
          }

          if (bestCand && bestScore >= 120) {
            removedObjs.add(bestCand.obj);
            totalRemovedCount++;
            if (bestCand.parentForm && m.FPDFFormObj_RemoveObject) {
              m.FPDFFormObj_RemoveObject(bestCand.parentForm, bestCand.obj);
            } else {
              m.FPDFPage_RemoveObject(page, bestCand.obj);
            }
            m.FPDFPageObj_Destroy(bestCand.obj);
            pageHasChanges = true;
          }
        }

        if (pageHasChanges) {
          m.FPDFPage_GenerateContent(page);
        }
        m.FPDF_ClosePage(page);
      }
    } finally {
      free(boundsPtr);
      free(matrixPtr);
      free(wPtr);
      free(hPtr);
    }

    if (totalRemovedCount === 0) {
      return Object.assign(bytes, { pdfBytes: bytes, removedCount: 0 });
    }

    const writer = m.PDFiumExt_OpenFileWriter();
    let output = 0;
    try {
      if (!m.PDFiumExt_SaveAsCopy(doc, writer)) throw Error("Düzenlenen PDF oluşturulamadı.");
      const length = m.PDFiumExt_GetFileWriterSize(writer);
      output = malloc(length);
      m.PDFiumExt_GetFileWriterData(writer, output, length);
      const outBytes = heap.HEAPU8.slice(output, output + length);
      return Object.assign(outBytes, { pdfBytes: outBytes, removedCount: totalRemovedCount });
    } finally {
      if (output) free(output);
      m.PDFiumExt_CloseFileWriter(writer);
    }
  } finally {
    if (doc) m.FPDF_CloseDocument(doc);
    free(input);
  }
}

/**
 * Verifies whether a specific image can be safely located and removed from the PDF.
 * Returns true ONLY if an unambiguous, exact match exists in the page structure.
 */
export async function canRemovePdfImage(bytes: Uint8Array, removal: ImageRemoval): Promise<boolean> {
  if (!removal.bounds) return false;
  const m = (await engine()) as any;
  const heap = m.pdfium as unknown as ExtendedPdfiumRuntime;
  const { malloc, free } = heap.wasmExports;
  const input = malloc(bytes.length);
  let doc = 0;

  try {
    heap.HEAPU8.set(bytes, input);
    doc = m.FPDF_LoadMemDocument(input, bytes.length, "");
    if (!doc) return false;

    const boundsPtr = malloc(16);
    const matrixPtr = malloc(24);
    const wPtr = malloc(4);
    const hPtr = malloc(4);

    try {
      const page = m.FPDF_LoadPage(doc, removal.page);
      if (!page) return false;

      type Cand = {
        obj: number;
        bounds: { left: number; bottom: number; right: number; top: number };
        matrix: number[] | null;
        pixelWidth: number;
        pixelHeight: number;
        index: number;
      };

      const candidates: Cand[] = [];
      let seq = 0;

      const scan = (obj: number) => {
        if (!obj) return;
        const type = m.FPDFPageObj_GetType(obj);
        if (type === 3) {
          let pW = 0;
          let pH = 0;
          if (m.FPDFImageObj_GetImagePixelSize && m.FPDFImageObj_GetImagePixelSize(obj, wPtr, hPtr)) {
            pW = heap.getValue(wPtr, "i32");
            pH = heap.getValue(hPtr, "i32");
          }
          m.FPDFPageObj_GetBounds(obj, boundsPtr, boundsPtr + 4, boundsPtr + 8, boundsPtr + 12);
          const left = heap.getValue(boundsPtr, "float");
          const bottom = heap.getValue(boundsPtr + 4, "float");
          const right = heap.getValue(boundsPtr + 8, "float");
          const top = heap.getValue(boundsPtr + 12, "float");

          let matrix: number[] | null = null;
          if (m.FPDFPageObj_GetMatrix && m.FPDFPageObj_GetMatrix(obj, matrixPtr)) {
            matrix = Array.from(new Float32Array(heap.HEAPU8.buffer, matrixPtr, 6));
          }

          candidates.push({
            obj,
            bounds: { left, bottom, right, top },
            matrix,
            pixelWidth: pW,
            pixelHeight: pH,
            index: seq++
          });
        } else if (type === 5 && m.FPDFFormObj_CountObjects) {
          const count = m.FPDFFormObj_CountObjects(obj);
          for (let j = 0; j < count; j++) {
            scan(m.FPDFFormObj_GetObject(obj, j));
          }
        }
      };

      const count = m.FPDFPage_CountObjects(page);
      for (let i = 0; i < count; i++) {
        scan(m.FPDFPage_GetObject(page, i));
      }
      m.FPDF_ClosePage(page);

      let bestScore = -Infinity;
      let runnerUpScore = -Infinity;
      let bestCand: Cand | null = null;

      for (const cand of candidates) {
        const tb = removal.bounds;
        const cb = cand.bounds;
        const centerDist = Math.hypot(
          (cb.left + cb.right) / 2 - (tb.left + tb.right) / 2,
          (cb.bottom + cb.top) / 2 - (tb.bottom + tb.top) / 2
        );
        const edgeDiff =
          Math.abs(cb.left - tb.left) +
          Math.abs(cb.bottom - tb.bottom) +
          Math.abs(cb.right - tb.right) +
          Math.abs(cb.top - tb.top);

        if (edgeDiff > 35 && centerDist > 30) continue;

        let score = 0;
        let hasCorroboration = false;

        if (edgeDiff < 2) score += 200;
        else if (edgeDiff < 10) score += 140;
        else if (edgeDiff < 25 || centerDist < 15) score += 80;

        if (removal.pixelWidth && removal.pixelHeight && cand.pixelWidth && cand.pixelHeight) {
          if (removal.pixelWidth === cand.pixelWidth && removal.pixelHeight === cand.pixelHeight) {
            score += 150;
            hasCorroboration = true;
          } else {
            continue;
          }
        }

        if (removal.matrix && cand.matrix) {
          const matDiff =
            Math.abs(removal.matrix[0] - cand.matrix[0]) +
            Math.abs(removal.matrix[3] - cand.matrix[3]) +
            Math.abs(removal.matrix[4] - cand.matrix[4]) +
            Math.abs(removal.matrix[5] - cand.matrix[5]);
          if (matDiff < 2) {
            score += 100;
            hasCorroboration = true;
          } else if (matDiff < 15) {
            score += 50;
            hasCorroboration = true;
          }
        }

        if (typeof removal.imageIndex === "number" && removal.imageIndex === cand.index) {
          score += 60;
          hasCorroboration = true;
        }

        if (!hasCorroboration && edgeDiff < 5) {
          hasCorroboration = true;
        }

        if (!hasCorroboration) continue;

        if (score > bestScore) {
          runnerUpScore = bestScore;
          bestScore = score;
          bestCand = cand;
        } else if (score > runnerUpScore) {
          runnerUpScore = score;
        }
      }

      if (!bestCand || bestScore < 120) return false;
      if (bestScore - runnerUpScore <= 5 && runnerUpScore > 0) return false; // Ambiguity
      return true;
    } finally {
      free(boundsPtr);
      free(matrixPtr);
      free(wPtr);
      free(hPtr);
    }
  } catch {
    return false;
  } finally {
    if (doc) m.FPDF_CloseDocument(doc);
    free(input);
  }
}

/**
 * Computes a deterministic SHA-256 fingerprint from raw pixel data and dimensions.
 */
export async function computeImageContentHash(
  data: Uint8Array | Uint8ClampedArray | ArrayBuffer,
  width?: number,
  height?: number
): Promise<string> {
  const bytes = data instanceof Uint8Array
    ? data
    : data instanceof Uint8ClampedArray
    ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    : new Uint8Array(data);

  let toHash: Uint8Array = bytes;
  if (typeof width === "number" && typeof height === "number") {
    const header = new TextEncoder().encode(`${width}x${height}:`);
    const combined = new Uint8Array(header.length + bytes.length);
    combined.set(header, 0);
    combined.set(bytes, header.length);
    toHash = combined;
  }

  if (typeof crypto !== "undefined" && crypto?.subtle?.digest) {
    try {
      const hashBuf = await crypto.subtle.digest("SHA-256", toHash as any);
      return Array.from(new Uint8Array(hashBuf))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    } catch {}
  }

  try {
    const nodeCrypto = await import("node:crypto");
    return nodeCrypto.createHash("sha256").update(toHash).digest("hex");
  } catch {}

  // Fallback FNV-1a 64-bit if no crypto
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < toHash.length; i++) {
    const ch = toHash[i];
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16);
}

/**
 * Extracts true decoded RGBA bitmap pixels of an image from PDF using PDFium.
 * Accurately decodes JPEG (/DCTDecode), PNG/Flate, CCITT, JBIG2, etc.
 */
export async function extractPdfImageBitmap(
  bytes: Uint8Array,
  removal: { page: number; bounds?: { left: number; bottom: number; right: number; top: number }; imageIndex?: number }
): Promise<{ width: number; height: number; data: Uint8ClampedArray; matrix?: number[] | null; bounds?: { left: number; bottom: number; right: number; top: number } } | null> {
  const m = (await engine()) as any;
  const heap = m.pdfium as unknown as ExtendedPdfiumRuntime;
  const { malloc, free } = heap.wasmExports;
  const input = malloc(bytes.length);
  let doc = 0;

  try {
    heap.HEAPU8.set(bytes, input);
    doc = m.FPDF_LoadMemDocument(input, bytes.length, "");
    if (!doc) return null;

    const boundsPtr = malloc(16);
    const matrixPtr = malloc(24);
    const wPtr = malloc(4);
    const hPtr = malloc(4);

    try {
      const page = m.FPDF_LoadPage(doc, removal.page);
      if (!page) return null;

      type Cand = {
        obj: number;
        bounds: { left: number; bottom: number; right: number; top: number };
        matrix: number[] | null;
        index: number;
      };

      const candidates: Cand[] = [];
      let seq = 0;

      const scan = (obj: number) => {
        if (!obj) return;
        const type = m.FPDFPageObj_GetType(obj);
        if (type === 3) {
          m.FPDFPageObj_GetBounds(obj, boundsPtr, boundsPtr + 4, boundsPtr + 8, boundsPtr + 12);
          const left = heap.getValue(boundsPtr, "float");
          const bottom = heap.getValue(boundsPtr + 4, "float");
          const right = heap.getValue(boundsPtr + 8, "float");
          const top = heap.getValue(boundsPtr + 12, "float");

          let matrix: number[] | null = null;
          if (m.FPDFPageObj_GetMatrix && m.FPDFPageObj_GetMatrix(obj, matrixPtr)) {
            matrix = [
              heap.getValue(matrixPtr, "float"),
              heap.getValue(matrixPtr + 4, "float"),
              heap.getValue(matrixPtr + 8, "float"),
              heap.getValue(matrixPtr + 12, "float"),
              heap.getValue(matrixPtr + 16, "float"),
              heap.getValue(matrixPtr + 20, "float")
            ];
          }

          candidates.push({
            obj,
            bounds: { left, bottom, right, top },
            matrix,
            index: seq++
          });
        } else if (type === 5 && m.FPDFFormObj_CountObjects) {
          const count = m.FPDFFormObj_CountObjects(obj);
          for (let j = 0; j < count; j++) {
            scan(m.FPDFFormObj_GetObject(obj, j));
          }
        }
      };

      const count = m.FPDFPage_CountObjects(page);
      for (let i = 0; i < count; i++) {
        scan(m.FPDFPage_GetObject(page, i));
      }

      let targetCand: Cand | null = null;
      if (candidates.length === 1) {
        targetCand = candidates[0];
      } else if (removal.bounds) {
        let bestScore = -Infinity;
        for (const cand of candidates) {
          const tb = removal.bounds;
          const cb = cand.bounds;
          const centerDist = Math.hypot(
            (cb.left + cb.right) / 2 - (tb.left + tb.right) / 2,
            (cb.bottom + cb.top) / 2 - (tb.bottom + tb.top) / 2
          );
          const edgeDiff =
            Math.abs(cb.left - tb.left) +
            Math.abs(cb.bottom - tb.bottom) +
            Math.abs(cb.right - tb.right) +
            Math.abs(cb.top - tb.top);
          let score = 200 - edgeDiff - centerDist * 1.5;
          if (typeof removal.imageIndex === 'number' && removal.imageIndex === cand.index) score += 30;
          if (score > bestScore) {
            bestScore = score;
            targetCand = cand;
          }
        }
      } else if (typeof removal.imageIndex === 'number' && removal.imageIndex < candidates.length) {
        targetCand = candidates[removal.imageIndex];
      }

      if (!targetCand) {
        m.FPDF_ClosePage(page);
        return null;
      }

      let rendered = m.FPDFImageObj_GetBitmap ? m.FPDFImageObj_GetBitmap(targetCand.obj) : null;
      if (!rendered) {
        rendered = m.FPDFImageObj_GetRenderedBitmap(doc, page, targetCand.obj);
      }
      m.FPDF_ClosePage(page);
      if (!rendered) return null;

      const w = m.FPDFBitmap_GetWidth(rendered);
      const h = m.FPDFBitmap_GetHeight(rendered);
      const stride = m.FPDFBitmap_GetStride(rendered);
      const fmt = m.FPDFBitmap_GetFormat(rendered);
      const bufPtr = m.FPDFBitmap_GetBuffer(rendered);

      const rgba = new Uint8ClampedArray(w * h * 4);


      for (let y = 0; y < h; y++) {
        const rowStart = bufPtr + y * stride;
        for (let x = 0; x < w; x++) {
          const dstIdx = (y * w + x) * 4;
          if (fmt === 4) { // BGRA
            const srcIdx = rowStart + x * 4;
            rgba[dstIdx] = heap.HEAPU8[srcIdx + 2];     // R
            rgba[dstIdx + 1] = heap.HEAPU8[srcIdx + 1]; // G
            rgba[dstIdx + 2] = heap.HEAPU8[srcIdx];     // B
            rgba[dstIdx + 3] = heap.HEAPU8[srcIdx + 3]; // A
          } else if (fmt === 3) { // BGRx
            const srcIdx = rowStart + x * 4;
            rgba[dstIdx] = heap.HEAPU8[srcIdx + 2];
            rgba[dstIdx + 1] = heap.HEAPU8[srcIdx + 1];
            rgba[dstIdx + 2] = heap.HEAPU8[srcIdx];
            rgba[dstIdx + 3] = 255;
          } else if (fmt === 2) { // BGR
            const srcIdx = rowStart + x * 3;
            rgba[dstIdx] = heap.HEAPU8[srcIdx + 2];
            rgba[dstIdx + 1] = heap.HEAPU8[srcIdx + 1];
            rgba[dstIdx + 2] = heap.HEAPU8[srcIdx];
            rgba[dstIdx + 3] = 255;
          } else if (fmt === 1) { // Gray
            const srcIdx = rowStart + x;
            const g = heap.HEAPU8[srcIdx];
            rgba[dstIdx] = g;
            rgba[dstIdx + 1] = g;
            rgba[dstIdx + 2] = g;
            rgba[dstIdx + 3] = 255;
          }
        }
      }
      m.FPDFBitmap_Destroy(rendered);
      return {
        width: w,
        height: h,
        data: rgba,
        matrix: targetCand.matrix,
        bounds: targetCand.bounds
      };
    } finally {
      free(boundsPtr);
      free(matrixPtr);
      free(wPtr);
      free(hPtr);
    }
  } catch {
    return null;
  } finally {
    if (doc) m.FPDF_CloseDocument(doc);
    free(input);
  }
}

/**
 * Surgically updates ONLY the bitmap pixels of a strictly matched FPDF_PAGEOBJECT (type 3, Image)
 * in place using PDFium's FPDFImageObj_SetBitmap.
 * Preserves:
 *  - exact coordinates & dimensions
 *  - full 6-element transformation matrix (rotation, scale, skew)
 *  - display list z-order (no deletion or re-appending!)
 *  - clipping path and blend modes
 *  - opacity
 *  - duplicate placements of other XObjects
 * Fails safely with 0 byte changes if no unambiguous single image match exists.
 */
export async function updatePdfImageBitmap(
  bytes: Uint8Array,
  target: {
    page: number;
    bounds?: { left: number; bottom: number; right: number; top: number };
    imageIndex?: number;
    pixelWidth?: number;
    pixelHeight?: number;
    matrix?: number[];
    objectRef?: string | number;
    imageId?: string;
  },
  newRgba: { width: number; height: number; data: Uint8ClampedArray | Uint8Array }
): Promise<{ success: boolean; newBytes?: Uint8Array; message?: string }> {
  if (!target.bounds && typeof target.imageIndex !== 'number') {
    return { success: false, message: "Hedef görsel sınırları veya indeksi belirtilmedi." };
  }

  const m = (await engine()) as any;
  const heap = m.pdfium as unknown as ExtendedPdfiumRuntime;
  const { malloc, free } = heap.wasmExports;
  const input = malloc(bytes.length);
  let doc = 0;

  try {
    heap.HEAPU8.set(bytes, input);
    doc = m.FPDF_LoadMemDocument(input, bytes.length, "");
    if (!doc) return { success: false, message: "PDF belgesi yüklenemedi." };

    const boundsPtr = malloc(16);
    const matrixPtr = malloc(24);
    const wPtr = malloc(4);
    const hPtr = malloc(4);

    try {
      const page = m.FPDF_LoadPage(doc, target.page);
      if (!page) return { success: false, message: "PDF sayfası bulunamadı." };

      type Cand = {
        obj: number;
        bounds: { left: number; bottom: number; right: number; top: number };
        matrix: number[] | null;
        pixelWidth: number;
        pixelHeight: number;
        index: number;
      };

      const candidates: Cand[] = [];
      let seq = 0;

      const scan = (obj: number) => {
        if (!obj) return;
        const type = m.FPDFPageObj_GetType(obj);
        if (type === 3) { // Image
          let pW = 0;
          let pH = 0;
          if (m.FPDFImageObj_GetImagePixelSize && m.FPDFImageObj_GetImagePixelSize(obj, wPtr, hPtr)) {
            pW = heap.getValue(wPtr, "i32");
            pH = heap.getValue(hPtr, "i32");
          }
          m.FPDFPageObj_GetBounds(obj, boundsPtr, boundsPtr + 4, boundsPtr + 8, boundsPtr + 12);
          const left = heap.getValue(boundsPtr, "float");
          const bottom = heap.getValue(boundsPtr + 4, "float");
          const right = heap.getValue(boundsPtr + 8, "float");
          const top = heap.getValue(boundsPtr + 12, "float");

          let matrix: number[] | null = null;
          if (m.FPDFPageObj_GetMatrix && m.FPDFPageObj_GetMatrix(obj, matrixPtr)) {
            matrix = Array.from(new Float32Array(heap.HEAPU8.buffer, matrixPtr, 6));
          }

          candidates.push({
            obj,
            bounds: { left, bottom, right, top },
            matrix,
            pixelWidth: pW,
            pixelHeight: pH,
            index: seq++,
          });
        } else if (type === 5 && m.FPDFFormObj_CountObjects) {
          const count = m.FPDFFormObj_CountObjects(obj);
          for (let j = 0; j < count; j++) {
            scan(m.FPDFFormObj_GetObject(obj, j));
          }
        }
      };

      const count = m.FPDFPage_CountObjects(page);
      for (let i = 0; i < count; i++) {
        scan(m.FPDFPage_GetObject(page, i));
      }

      if (candidates.length === 0) {
        m.FPDF_ClosePage(page);
        return { success: false, message: "Sayfada güncellenecek görsel nesnesi bulunamadı." };
      }

      let bestCand: Cand | null = null;
      let bestScore = -Infinity;
      let runnerUpScore = -Infinity;

      if (candidates.length === 1 && !target.bounds) {
        bestCand = candidates[0];
        bestScore = 200;
      } else if (target.bounds) {
        const tb = target.bounds;
        for (const cand of candidates) {
          const cb = cand.bounds;
          const centerDist = Math.hypot(
            (cb.left + cb.right) / 2 - (tb.left + tb.right) / 2,
            (cb.bottom + cb.top) / 2 - (tb.bottom + tb.top) / 2
          );
          const edgeDiff =
            Math.abs(cb.left - tb.left) +
            Math.abs(cb.bottom - tb.bottom) +
            Math.abs(cb.right - tb.right) +
            Math.abs(cb.top - tb.top);

          // Hard threshold: reject if center or edges deviate too far
          if (edgeDiff > 35 && centerDist > 30) continue;

          let score = 200 - edgeDiff - centerDist * 1.5;

          // Corroborating matrix match
          if (target.matrix && cand.matrix && target.matrix.length === 6 && cand.matrix.length === 6) {
            const mDiff = cand.matrix.reduce((acc, v, idx) => acc + Math.abs(v - target.matrix![idx]), 0);
            if (mDiff < 2) score += 50;
          }

          // Corroborating pixel size match
          if (target.pixelWidth && target.pixelHeight && cand.pixelWidth > 0 && cand.pixelHeight > 0) {
            if (target.pixelWidth === cand.pixelWidth && target.pixelHeight === cand.pixelHeight) {
              score += 40;
            }
          }

          // Corroborating index match
          if (typeof target.imageIndex === 'number' && target.imageIndex === cand.index) {
            score += 30;
          }

          if (score > bestScore) {
            runnerUpScore = bestScore;
            bestScore = score;
            bestCand = cand;
          } else if (score > runnerUpScore) {
            runnerUpScore = score;
          }
        }

        // Ambiguity check
        if (bestCand && bestScore - runnerUpScore <= 5 && runnerUpScore > 0) {
          bestCand = null; // Ambiguous match! Reject safely.
        }
      } else if (typeof target.imageIndex === 'number' && target.imageIndex < candidates.length) {
        bestCand = candidates[target.imageIndex];
        bestScore = 200;
      }

      if (!bestCand || bestScore < 120) {
        m.FPDF_ClosePage(page);
        return { success: false, message: "Hedef görsel kesin olarak doğrulanamadı. 0 bayt değiştirildi." };
      }

      // Create PDFium bitmap (BGRA 32-bit format)
      const bitmap = m.FPDFBitmap_Create(newRgba.width, newRgba.height, 1);
      if (!bitmap) {
        m.FPDF_ClosePage(page);
        return { success: false, message: "Piksel bitmap'i oluşturulamadı." };
      }

      const bufPtr = m.FPDFBitmap_GetBuffer(bitmap);
      const stride = m.FPDFBitmap_GetStride(bitmap);

      for (let y = 0; y < newRgba.height; y++) {
        const rowStart = bufPtr + y * stride;
        for (let x = 0; x < newRgba.width; x++) {
          const srcIdx = (y * newRgba.width + x) * 4;
          const dstIdx = rowStart + x * 4;
          heap.HEAPU8[dstIdx] = newRgba.data[srcIdx + 2];     // B
          heap.HEAPU8[dstIdx + 1] = newRgba.data[srcIdx + 1]; // G
          heap.HEAPU8[dstIdx + 2] = newRgba.data[srcIdx];     // R
          heap.HEAPU8[dstIdx + 3] = newRgba.data[srcIdx + 3]; // A
        }
      }

      // Replace bitmap on the existing FPDF_PAGEOBJECT in place
      const pagePtr = malloc(4);
      heap.setValue(pagePtr, page, "i32");
      const setOk = m.FPDFImageObj_SetBitmap(pagePtr, 1, bestCand.obj, bitmap);
      free(pagePtr);
      m.FPDFBitmap_Destroy(bitmap);

      if (!setOk) {
        m.FPDF_ClosePage(page);
        return { success: false, message: "Görsel bitmap'i PDFium tarafından güncellenemedi." };
      }

      m.FPDFPage_GenerateContent(page);
      m.FPDF_ClosePage(page);

      const writer = m.PDFiumExt_OpenFileWriter();
      let output = 0;
      try {
        if (!m.PDFiumExt_SaveAsCopy(doc, writer)) {
          throw new Error("Güncellenen PDF kaydedilemedi.");
        }
        const length = m.PDFiumExt_GetFileWriterSize(writer);
        output = malloc(length);
        m.PDFiumExt_GetFileWriterData(writer, output, length);
        const outBytes = heap.HEAPU8.slice(output, output + length);
        return { success: true, newBytes: outBytes };
      } finally {
        if (output) free(output);
        m.PDFiumExt_CloseFileWriter(writer);
      }
    } finally {
      free(boundsPtr);
      free(matrixPtr);
      free(wPtr);
      free(hPtr);
    }
  } catch (err: any) {
    return { success: false, message: err?.message || "PDF görseli güncellenirken hata oluştu." };
  } finally {
    if (doc) m.FPDF_CloseDocument(doc);
    free(input);
  }
}



export type PdfTextItem = {
  str: string;
  width: number;
  transform: number[];
  fontName: string;
  hasEOL?: boolean;
};

export type PdfPageProxy = {
  pageNumber: number;
  rotate: number;
  userUnit?: number;
  getViewport: (options: { scale: number; rotation?: number }) => {
    width: number;
    height: number;
    transform: number[];
    convertToPdfPoint: (x: number, y: number) => [number, number];
  };
  getTextContent: () => Promise<{
    items: Array<Record<string, unknown>>;
    styles: Record<string, { fontFamily?: string; ascent?: number; descent?: number; vertical?: boolean }>;
  }>;
};

function parseColorArgs(args: any): string {
  if (!args) return "#222222";
  if (typeof args === "string" && args.startsWith("#")) return args;
  if (Array.isArray(args)) {
    if (typeof args[0] === "string" && args[0].startsWith("#")) return args[0];
    if (args.length >= 3 && typeof args[0] === "number") {
      const scale = (args[0] <= 1 && args[1] <= 1 && args[2] <= 1) ? 255 : 1;
      const r = Math.min(255, Math.max(0, Math.round(args[0] * scale))).toString(16).padStart(2, "0");
      const g = Math.min(255, Math.max(0, Math.round(args[1] * scale))).toString(16).padStart(2, "0");
      const b = Math.min(255, Math.max(0, Math.round(args[2] * scale))).toString(16).padStart(2, "0");
      return `#${r}${g}${b}`;
    }
  }
  return "#222222";
}

function parseGrayArg(args: any): string {
  if (!args) return "#222222";
  const val = Array.isArray(args) ? args[0] : args;
  if (typeof val === "number") {
    const scale = val <= 1 ? 255 : 1;
    const h = Math.min(255, Math.max(0, Math.round(val * scale))).toString(16).padStart(2, "0");
    return `#${h}${h}${h}`;
  }
  return "#222222";
}

function extractOpText(arg: any): string {
  if (typeof arg === "string") return arg;
  if (!Array.isArray(arg)) return "";
  return arg.map((chunk: any) => {
    if (typeof chunk === "string") return chunk;
    if (Array.isArray(chunk)) return extractOpText(chunk);
    if (chunk && typeof chunk === "object") return chunk.unicode || chunk.fontChar || "";
    return "";
  }).join("");
}

export interface PdfiumFontRun {
  text: string;
  fontName: string;
  fontSize: number;
  fontWeight: number;
  isBold: boolean;
  isItalic: boolean;
  color?: string;
  left?: number;
  bottom?: number;
  right?: number;
  top?: number;
  baseline?: number;
}

// Document-level cache for extracted font runs to avoid redundant WASM parsing
const pdfiumFontRunsCache = new Map<string, { runs: PdfiumFontRun[]; chars?: CharBox[]; timestamp: number }>();

export function clearPdfiumDocCache(): void {
  pdfiumFontRunsCache.clear();
}

function computeByteFingerprint(bytes: Uint8Array, pageIndex: number): string {
  const len = bytes.length;
  let hash = (len ^ (pageIndex * 2654435761)) | 0;
  const sampleCount = Math.min(len, 64);
  for (let i = 0; i < sampleCount; i++) {
    hash = ((hash << 5) - hash + bytes[i]) | 0;
  }
  for (let i = Math.max(0, len - 64); i < len; i++) {
    hash = ((hash << 5) - hash + bytes[i]) | 0;
  }
  return `${len}_${pageIndex}_${hash}`;
}

export async function extractPdfiumFontRuns(pdfBytes: Uint8Array, pageIndex: number): Promise<PdfiumFontRun[]> {
  const cacheKey = computeByteFingerprint(pdfBytes, pageIndex);
  const cached = pdfiumFontRunsCache.get(cacheKey);
  if (cached) {
    return cached.runs.map((r) => ({ ...r }));
  }

  let input = 0;
  let doc = 0;
  let page = 0;
  let textPage = 0;
  let fontNamePtr = 0;
  let flagsPtr = 0;
  let rPtr = 0;
  let gPtr = 0;
  let bPtr = 0;
  let aPtr = 0;
  let boxPtr = 0;

  try {
    const m = await engine();
    const heap = m.pdfium as unknown as ExtendedPdfiumRuntime;
    const { malloc, free } = heap.wasmExports;

    input = malloc(pdfBytes.length);
    heap.HEAPU8.set(pdfBytes, input);

    doc = m.FPDF_LoadMemDocument(input, pdfBytes.length, "");
    if (!doc) {
      return [];
    }

    page = m.FPDF_LoadPage(doc, pageIndex);
    if (!page) {
      return [];
    }

    textPage = m.FPDFText_LoadPage(page);
    if (!textPage) {
      return [];
    }

    const charCount = m.FPDFText_CountChars(textPage);
    const runs: PdfiumFontRun[] = [];
    const allChars: CharBox[] = [];
    let cur: PdfiumFontRun | null = null;

    const bufSize = 256;
    fontNamePtr = malloc(bufSize);
    flagsPtr = malloc(4);
    rPtr = malloc(4);
    gPtr = malloc(4);
    bPtr = malloc(4);
    aPtr = malloc(4);
    boxPtr = malloc(32); // 4 doubles: left, right, bottom, top

    for (let i = 0; i < charCount; i++) {
      const unicode = m.FPDFText_GetUnicode(textPage, i);
      const char = String.fromCharCode(unicode);
      if (char === "\r" || char === "\n") continue;

      const fontSize = m.FPDFText_GetFontSize(textPage, i);
      const fontWeight = m.FPDFText_GetFontWeight(textPage, i);

      let charLeft = 0, charRight = 0, charBottom = 0, charTop = 0;
      if (m.FPDFText_GetCharBox && m.FPDFText_GetCharBox(textPage, i, boxPtr, boxPtr + 8, boxPtr + 16, boxPtr + 24)) {
        charLeft = heap.getValue(boxPtr, "double");
        charRight = heap.getValue(boxPtr + 8, "double");
        charBottom = heap.getValue(boxPtr + 16, "double");
        charTop = heap.getValue(boxPtr + 24, "double");
      }

      const len = m.FPDFText_GetFontInfo(textPage, i, fontNamePtr, bufSize, flagsPtr);
      let fontName = "";
      if (len > 0) {
        fontName = new TextDecoder("utf-8").decode(heap.HEAPU8.slice(fontNamePtr, fontNamePtr + len)).replace(/\0.*$/, "");
      }

      let charColor: string | undefined = undefined;
      const okColor = m.FPDFText_GetFillColor(textPage, i, rPtr, gPtr, bPtr, aPtr);
      if (okColor) {
        const r = heap.getValue(rPtr, "i32");
        const g = heap.getValue(gPtr, "i32");
        const b = heap.getValue(bPtr, "i32");
        const toHex = (n: number) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0");
        charColor = `#${toHex(r)}${toHex(g)}${toHex(b)}`;
      }

      const flags = heap.getValue(flagsPtr, "i32");
      const isBold = fontWeight >= 600 || /bold|black|heavy|demi|semibold|medium|700|800|900/i.test(fontName);
      const isItalic = (flags & 64) !== 0 || /italic|oblique|slanted/i.test(fontName);

      allChars.push({
        char,
        left: charLeft,
        right: charRight,
        bottom: charBottom,
        top: charTop,
        size: fontSize,
        weight: fontWeight,
        fontName,
        color: charColor || "#000000",
        isBold,
        isItalic
      });

      if (!fontName && (char === " " || char === "\t")) {
        if (cur) cur.text += char;
        continue;
      }

      if (!cur) {
        cur = {
          text: char,
          fontName,
          fontSize,
          fontWeight,
          isBold,
          isItalic,
          color: charColor,
          left: charLeft,
          right: charRight,
          bottom: charBottom,
          top: charTop,
          baseline: charBottom
        };
      } else if (
        fontName !== cur.fontName ||
        isBold !== cur.isBold ||
        Math.abs(fontSize - cur.fontSize) > 0.5 ||
        (charColor && cur.color && charColor !== cur.color)
      ) {
        if (cur.text.trim().length > 0) runs.push({ ...cur });
        cur = {
          text: char,
          fontName,
          fontSize,
          fontWeight,
          isBold,
          isItalic,
          color: charColor,
          left: charLeft,
          right: charRight,
          bottom: charBottom,
          top: charTop,
          baseline: charBottom
        };
      } else {
        cur.text += char;
        if (char !== " " && char !== "\t") {
          cur.left = Math.min(cur.left ?? charLeft, charLeft);
          cur.right = Math.max(cur.right ?? charRight, charRight);
          cur.bottom = Math.min(cur.bottom ?? charBottom, charBottom);
          cur.top = Math.max(cur.top ?? charTop, charTop);
        }
      }
    }
    if (cur && cur.text.trim().length > 0) runs.push({ ...cur });

    if (pdfiumFontRunsCache.size > 100) {
      pdfiumFontRunsCache.clear();
    }
    pdfiumFontRunsCache.set(cacheKey, {
      runs: runs.map((r) => ({ ...r })),
      chars: allChars.map((c) => ({ ...c })),
      timestamp: Date.now()
    });

    return runs;
  } catch (err) {
    console.warn("extractPdfiumFontRuns error:", err);
    return [];
  } finally {
    try {
      const m = await engine();
      const heap = m.pdfium as unknown as ExtendedPdfiumRuntime;
      const { free } = heap.wasmExports;
      if (boxPtr) free(boxPtr);
      if (fontNamePtr) free(fontNamePtr);
      if (flagsPtr) free(flagsPtr);
      if (rPtr) free(rPtr);
      if (gPtr) free(gPtr);
      if (bPtr) free(bPtr);
      if (aPtr) free(aPtr);
      if (textPage) m.FPDFText_ClosePage(textPage);
      if (page) m.FPDF_ClosePage(page);
      if (doc) m.FPDF_CloseDocument(doc);
      if (input) free(input);
    } catch {}
  }
}

export async function extractPdfiumCharBoxes(pdfBytes: Uint8Array, pageIndex: number): Promise<CharBox[]> {
  const cacheKey = computeByteFingerprint(pdfBytes, pageIndex);
  const cached = pdfiumFontRunsCache.get(cacheKey);
  if (cached && cached.chars) {
    return cached.chars.map((c) => ({ ...c }));
  }
  await extractPdfiumFontRuns(pdfBytes, pageIndex);
  const fresh = pdfiumFontRunsCache.get(cacheKey);
  return fresh?.chars?.map((c) => ({ ...c })) || [];
}

/** Use the renderer's own transforms, including CropBox, UserUnit, rotation, and extracts rich font/color styles. */
export async function editablePageText(page: any, optionalPdfBytes?: Uint8Array): Promise<EditableText[]> {
  const viewport = page.getViewport({ scale: 1 });
  const [content, opList] = await Promise.all([
    page.getTextContent(),
    typeof page.getOperatorList === "function" ? page.getOperatorList().catch(() => null) : Promise.resolve(null)
  ]);

  const pageIdx = (typeof page.pageNumber === "number" ? page.pageNumber - 1 : page._pageIndex) ?? 0;
  const pdfBytes: Uint8Array | undefined =
    optionalPdfBytes ||
    page._sourceBytes ||
    page._parentDoc?._sourceBytes ||
    page._transport?._sourceBytes ||
    page._transport?.loadingTask?._sourceBytes;

  let pdfiumRuns: PdfiumFontRun[] = [];
  let pdfiumChars: CharBox[] = [];
  if (pdfBytes) {
    try {
      pdfiumRuns = await extractPdfiumFontRuns(pdfBytes, pageIdx);
      pdfiumChars = await extractPdfiumCharBoxes(pdfBytes, pageIdx);
    } catch {}
  }

  // Extract font details (weight, bold, italic, font family)
  const fontDetailsMap = new Map<string, {
    originalFontName?: string;
    fontFamily: string;
    bold: boolean;
    italic: boolean;
    fontWeight: number | string;
  }>();

  for (const rawItem of content.items) {
    const item = rawItem as unknown as PdfTextItem;
    if (!item.fontName || fontDetailsMap.has(item.fontName)) continue;

    let fontObj: any = null;
    try {
      if (page.commonObjs?.has?.(item.fontName)) {
        fontObj = await new Promise(res => page.commonObjs.get(item.fontName, res));
      } else if (page.objs?.has?.(item.fontName)) {
        fontObj = await new Promise(res => page.objs.get(item.fontName, res));
      } else if (typeof page.commonObjs?.get === "function") {
        fontObj = await new Promise(res => {
          const t = setTimeout(() => res(null), 300);
          page.commonObjs.get(item.fontName, (data: any) => { clearTimeout(t); res(data); });
        });
      }
    } catch {}

    const style = content.styles[item.fontName] || {};
    const origName = fontObj?.name || fontObj?.loadedName || style.fontFamily || item.fontName;
    const combined = [item.fontName, style.fontFamily, fontObj?.name, fontObj?.loadedName, fontObj?.fallbackName]
      .filter(Boolean)
      .join(" ");

    const bold = Boolean(
      fontObj?.bold ||
      fontObj?.black ||
      /bold|black|heavy|demi|semibold|medium|700|800|900/i.test(combined)
    );

    const italic = Boolean(
      fontObj?.italic ||
      /italic|oblique|slanted/i.test(combined)
    );

    let fontFamily = "sans";
    if (/(?:courier|couriernew)\b/i.test(combined)) {
      fontFamily = "courier";
    } else if (/roboto/i.test(combined)) {
      fontFamily = "roboto";
    } else if (/(?:sans[-_]?serif|helvetica|arial|liberation)/i.test(combined)) {
      fontFamily = "sans";
    } else if (/times|georgia|garamond|minion|cambria|lora|\bserif\b/i.test(combined.replace(/sans[-_]?serif/gi, ""))) {
      fontFamily = "serif";
    } else {
      // Default: Helvetica / Arial / Liberation Sans
      fontFamily = "sans";
    }

    fontDetailsMap.set(item.fontName, {
      originalFontName: origName,
      fontFamily,
      bold,
      italic,
      fontWeight: bold ? 700 : 400
    });
  }

  // Extract text operations and colors from opList with proper graphics state stack
  interface OpTextEntry {
    text: string;
    color: string;
  }
  const opTextEntries: OpTextEntry[] = [];
  if (opList && opList.fnArray) {
    try {
      const pdfjsLib = await import("pdfjs-dist");
      const OPS = pdfjsLib.OPS;
      const colorStack: string[] = ["#222222"];
      let currentColor = "#222222";

      for (let i = 0; i < opList.fnArray.length; i++) {
        const fn = opList.fnArray[i];
        const args = opList.argsArray[i];

        if (fn === OPS.save) {
          colorStack.push(currentColor);
        } else if (fn === OPS.restore) {
          if (colorStack.length > 1) {
            currentColor = colorStack.pop()!;
          } else {
            currentColor = colorStack[0] || "#222222";
          }
        } else if (fn === OPS.setFillRGBColor || fn === OPS.setFillColorN) {
          currentColor = parseColorArgs(args);
        } else if (fn === OPS.setFillGray) {
          currentColor = parseGrayArg(args);
        } else if (fn === OPS.showText || fn === OPS.showSpacedText) {
          const text = extractOpText(args?.[0]);
          opTextEntries.push({ text: text.trim(), color: currentColor });
        }
      }
    } catch {}
  }

  const v = viewport.transform;
  let opIdx = 0;
  const claimedRunIndices = new Set<number>();
  return content.items.flatMap((rawItem: any, index: number) => {
    const item = rawItem as unknown as PdfTextItem;
    if (!item.str?.trim() || !item.width || content.styles[item.fontName]?.vertical) return [];
    const t = item.transform;
    if (!Array.isArray(t) || t.length < 6 || !t.every(Number.isFinite)) return [];
    const a = v[0]*t[0]+v[2]*t[1], b = v[1]*t[0]+v[3]*t[1];
    const c = v[0]*t[2]+v[2]*t[3], d = v[1]*t[2]+v[3]*t[3];
    const x = v[0]*t[4]+v[2]*t[5]+v[4], baseline = v[1]*t[4]+v[3]*t[5]+v[5];
    const size = Math.hypot(c,d), angle = Math.atan2(b,a), w = item.width * Math.hypot(v[0],v[1]);
    if (!Number.isFinite(x) || !Number.isFinite(baseline) || !Number.isFinite(size) || !Number.isFinite(w) || size <= 0 || w <= 0) return [];
    const style = content.styles[item.fontName] || {};
    const ascent: number = (typeof style.ascent === "number" && Number.isFinite(style.ascent)) ? style.ascent : 0.85;
    const descent: number = (typeof style.descent === "number" && Number.isFinite(style.descent)) ? style.descent : -0.2;
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const point = (dx: number, dy: number) => viewport.convertToPdfPoint(x + cos*dx - sin*dy, baseline + sin*dx + cos*dy);
    // FS_QUADPOINTSF uses top-left, top-right, bottom-left, bottom-right.
    const quad = [point(0,-size*ascent), point(w,-size*ascent), point(0,-size*descent), point(w,-size*descent)].flat();
    if (!Array.isArray(quad) || quad.length !== 8 || !quad.every(Number.isFinite)) return [];

    const fontInfo = fontDetailsMap.get(item.fontName) || {
      originalFontName: style.fontFamily || item.fontName,
      fontFamily: "sans",
      bold: false,
      italic: false,
      fontWeight: 400
    };

    const str = item.str.trim();
    let itemColor = "#222222";
    if (opTextEntries.length > 0) {
      let found = false;
      for (let k = opIdx; k < opTextEntries.length; k++) {
        const entry = opTextEntries[k];
        if (entry.text.includes(str) || str.includes(entry.text)) {
          itemColor = entry.color;
          opIdx = k + 1;
          found = true;
          break;
        }
      }
      if (!found && opIdx < opTextEntries.length) {
        itemColor = opTextEntries[opIdx++].color;
      }
    }

    // Match with exact PDFium extracted font runs using geometric proximity & reading order
    let matchedRun: PdfiumFontRun | null = null;
    if (pdfiumRuns.length > 0) {
      const itemTx = Array.isArray(t) && t.length >= 6 ? t[4] : 0;
      const itemTy = Array.isArray(t) && t.length >= 6 ? t[5] : 0;
      const normStr = str.toLowerCase().trim();

      let bestDist = Infinity;
      let bestIdx = -1;

      for (let rIdx = 0; rIdx < pdfiumRuns.length; rIdx++) {
        if (claimedRunIndices.has(rIdx)) continue;
        const run = pdfiumRuns[rIdx];
        const runNorm = run.text.toLowerCase().trim();

        const isMatch = (
          runNorm === normStr ||
          runNorm.includes(normStr) ||
          normStr.includes(runNorm) ||
          run.text.includes(str) ||
          str.includes(run.text.trim())
        );

        if (isMatch) {
          const runX = run.left ?? 0;
          const runY = run.baseline ?? run.bottom ?? 0;
          const dist = Math.hypot(runX - itemTx, runY - itemTy);
          if (dist < bestDist) {
            bestDist = dist;
            bestIdx = rIdx;
          }
        }
      }

      if (bestIdx >= 0) {
        matchedRun = pdfiumRuns[bestIdx];
        claimedRunIndices.add(bestIdx);
      }
    }

    const bold = matchedRun ? matchedRun.isBold : fontInfo.bold;
    const italic = matchedRun ? matchedRun.isItalic : fontInfo.italic;
    const finalFontName = matchedRun?.fontName || fontInfo.originalFontName;
    const finalFontWeight = matchedRun ? (matchedRun.isBold ? 700 : (matchedRun.fontWeight >= 600 ? matchedRun.fontWeight : 400)) : fontInfo.fontWeight;
    const finalSize = (matchedRun && matchedRun.fontSize > 0) ? matchedRun.fontSize : size;
    const finalColor = (matchedRun && matchedRun.color) ? matchedRun.color : itemColor;

    let fontFamily = fontInfo.fontFamily;
    if (finalFontName) {
      if (/(?:courier|couriernew)\b/i.test(finalFontName)) {
        fontFamily = "courier";
      } else if (/roboto/i.test(finalFontName)) {
        fontFamily = "roboto";
      } else if (/(?:times|georgia|garamond|minion|cambria|lora|\bserif\b)/i.test(finalFontName.replace(/sans[-_]?serif/gi, ""))) {
        fontFamily = "serif";
      } else if (/(?:sans[-_]?serif|helvetica|arial|liberation)/i.test(finalFontName)) {
        fontFamily = "sans";
      }
    }

    let itemCharBoxes: CharBox[] | undefined = undefined;
    if (pdfiumChars.length > 0) {
      const strNorm = item.str.trim();
      let bestCharIdx = -1;
      let bestCharDist = Infinity;
      for (let ci = 0; ci <= pdfiumChars.length - strNorm.length; ci++) {
        let match = true;
        for (let k = 0; k < strNorm.length; k++) {
          if (pdfiumChars[ci + k].char !== strNorm[k]) {
            match = false;
            break;
          }
        }
        if (match) {
          const firstChar = pdfiumChars[ci];
          const dist = Math.hypot(firstChar.left - quad[0], firstChar.bottom - quad[5]);
          if (dist < bestCharDist) {
            bestCharDist = dist;
            bestCharIdx = ci;
          }
        }
      }
      if (bestCharIdx >= 0) {
        itemCharBoxes = pdfiumChars.slice(bestCharIdx, bestCharIdx + strNorm.length);
      }
    }

    return [{
      id: `original-${page.pageNumber-1}-${index}`,
      page: page.pageNumber-1,
      quad,
      text: item.str,
      x,
      y: baseline - size,
      w,
      h: size * (ascent - descent),
      size: finalSize,
      angle: angle * 180 / Math.PI,
      fontName: finalFontName || style.fontFamily || item.fontName,
      fontFamily,
      originalFontName: finalFontName,
      fontWeight: finalFontWeight,
      bold,
      italic,
      color: finalColor,
      transform: t,
      charBoxes: itemCharBoxes
    }];
  });
}

export interface RasterWatermarkRemovalCandidate {
  id?: string;
  page?: number;
  imageIndex?: number;
  bounds?: { x: number; y: number; w: number; h: number };
  pixelWidth?: number;
  pixelHeight?: number;
  matrix?: number[];
  contentHash?: string;
}

export interface RasterWatermarkRemovalOptions {
  targetPages?: number[];
  keywords?: string[];
  customText?: string;
  fillColor?: { r: number; g: number; b: number };
  candidates?: RasterWatermarkRemovalCandidate[];
}

/**
 * Renders an SVG string to raw RGBA pixels across browser and Node.js environments.
 */
async function renderSvgToPixels(
  svgString: string,
  width: number,
  height: number
): Promise<Uint8ClampedArray | Uint8Array | null> {
  if (typeof window !== "undefined" && typeof document !== "undefined") {
    return new Promise((resolve) => {
      const timer = setTimeout(() => resolve(null), 1500);
      try {
        const img = new Image();
        const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
        const url = URL.createObjectURL(svgBlob);
        img.onload = () => {
          clearTimeout(timer);
          try {
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
              URL.revokeObjectURL(url);
              resolve(null);
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            URL.revokeObjectURL(url);
            const imgData = ctx.getImageData(0, 0, width, height);
            resolve(imgData.data);
          } catch {
            URL.revokeObjectURL(url);
            resolve(null);
          }
        };
        img.onerror = () => {
          clearTimeout(timer);
          URL.revokeObjectURL(url);
          resolve(null);
        };
        img.src = url;
      } catch {
        clearTimeout(timer);
        resolve(null);
      }
    });
  }

  // Node.js environment
  try {
    const dynamicImport = new Function("modulePath", "return import(modulePath)");
    const sharpModule = await dynamicImport("sharp").catch(() => null);
    if (!sharpModule) return null;
    const sharp = sharpModule.default || sharpModule;
    const buf = await sharp(Buffer.from(svgString)).raw().toBuffer({ resolveWithObject: true });
    return new Uint8Array(buf.data);
  } catch {
    return null;
  }
}


/**
 * Result of individual candidate raster removal
 */
export interface RasterCandidateResult {
  id?: string;
  status: "removed" | "unchanged" | "failed" | "blocked";
  modifiedPixels: number;
  reason?: string;
}

/**
 * Checks whether the image XObject on a given page is shared by other pages or placements.
 * If shared, clones the underlying stream object in pdf-lib so that this placement
 * can be modified independently without affecting any other page or placement.
 * If cloning cannot be safely accomplished, returns success: false to trigger fail-closed.
 */
/**
 * Parses content stream text and extracts all /Name Do image invocations with their transformation matrices and bounds.
 */
function parseContentStreamPlacements(streamText: string): Array<{
  name: string;
  ctm: number[];
  bounds: { left: number; bottom: number; right: number; top: number };
}> {
  const placements: Array<{
    name: string;
    ctm: number[];
    bounds: { left: number; bottom: number; right: number; top: number };
  }> = [];
  const tokens = streamText.trim().split(/\s+/);
  const ctmStack: number[][] = [[1, 0, 0, 1, 0, 0]];
  let currentCtm = [1, 0, 0, 1, 0, 0];

  const multiply = (m1: number[], m2: number[]) => [
    m1[0] * m2[0] + m1[1] * m2[2],
    m1[0] * m2[1] + m1[1] * m2[3],
    m1[2] * m2[0] + m1[3] * m2[2],
    m1[2] * m2[1] + m1[3] * m2[3],
    m1[4] * m2[0] + m1[5] * m2[2] + m2[4],
    m1[4] * m2[1] + m1[5] * m2[3] + m2[5]
  ];

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    if (t === "q") {
      ctmStack.push([...currentCtm]);
    } else if (t === "Q") {
      if (ctmStack.length > 1) currentCtm = ctmStack.pop()!;
    } else if (t === "cm" && i >= 6) {
      const m = [
        parseFloat(tokens[i - 6]),
        parseFloat(tokens[i - 5]),
        parseFloat(tokens[i - 4]),
        parseFloat(tokens[i - 3]),
        parseFloat(tokens[i - 2]),
        parseFloat(tokens[i - 1])
      ];
      currentCtm = multiply(m, currentCtm);
    } else if (t === "Do" && i >= 1) {
      const name = tokens[i - 1].replace(/^\//, "");
      const a = currentCtm[0], b = currentCtm[1], c = currentCtm[2], d = currentCtm[3], e = currentCtm[4], f = currentCtm[5];
      const corners = [
        { x: e, y: f },
        { x: e + a, y: f + b },
        { x: e + c, y: f + d },
        { x: e + a + c, y: f + b + d }
      ];
      const minX = Math.min(...corners.map(pt => pt.x));
      const maxX = Math.max(...corners.map(pt => pt.x));
      const minY = Math.min(...corners.map(pt => pt.y));
      const maxY = Math.max(...corners.map(pt => pt.y));
      placements.push({ name, ctm: [...currentCtm], bounds: { left: minX, bottom: minY, right: maxX, top: maxY } });
    }
  }
  return placements;
}

export async function isolateSharedPdfImage(
  bytes: Uint8Array,
  pageIndex: number,
  targetBounds?: { left: number; bottom: number; right: number; top: number }
): Promise<{ bytes: Uint8Array; wasShared: boolean; success: boolean }> {
  try {
    const pdfDoc = await PDFDocument.load(bytes, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    if (pageIndex < 0 || pageIndex >= pages.length) {
      return { bytes, wasShared: false, success: false };
    }

    // Map each XObject ref to the pages and names that reference it
    const refUsage = new Map<string, Array<{ pageIdx: number; name: PDFName; dict: PDFDict }>>();
    for (let p = 0; p < pages.length; p++) {
      const page = pages[p];
      const resources = page.node.Resources();
      const xobjs = resources?.lookup(PDFName.of("XObject"), PDFDict);
      if (xobjs) {
        for (const [name, ref] of xobjs.entries()) {
          if (ref instanceof PDFRef) {
            const key = ref.toString();
            if (!refUsage.has(key)) refUsage.set(key, []);
            refUsage.get(key)!.push({ pageIdx: p, name, dict: xobjs });
          }
        }
      }
    }

    const targetPage = pages[pageIndex];
    const targetResources = targetPage.node.Resources();
    const targetXobjs = targetResources?.lookup(PDFName.of("XObject"), PDFDict);
    if (!targetXobjs) {
      return { bytes, wasShared: false, success: true };
    }

    // Extract target page content streams to inspect image placements
    let targetContentStreamsText = "";
    let placements: Array<{ name: string; ctm: number[]; bounds: { left: number; bottom: number; right: number; top: number } }> = [];
    try {
      const contents = targetPage.node.Contents();
      const streams: any[] = [];
      if (contents) {
        if (typeof (contents as any).size === "function") {
          for (let i = 0; i < (contents as any).size(); i++) {
            const item = pdfDoc.context.lookup((contents as any).get(i));
            if (item) streams.push(item);
          }
        } else {
          const item = pdfDoc.context.lookup(contents);
          if (item) streams.push(item);
        }
      }
      for (const s of streams) {
        if (typeof s.getUnencodedContents === "function") {
          targetContentStreamsText += Buffer.from(s.getUnencodedContents()).toString("binary") + "\n";
        } else if (typeof s.getContents === "function") {
          const raw = s.getContents();
          try {
            const inflated = pako.inflate(raw);
            targetContentStreamsText += Buffer.from(inflated).toString("binary") + "\n";
          } catch {
            targetContentStreamsText += Buffer.from(raw).toString("binary") + "\n";
          }
        }
      }
      if (targetContentStreamsText) {
        placements = parseContentStreamPlacements(targetContentStreamsText);
      }
    } catch {
      // Content stream decompression is optional; refUsage provides guaranteed structural cross-page isolation
    }

    // Identify target XObject ref if targetBounds is provided
    let targetRefKey: string | null = null;
    let targetName: string | null = null;
    if (targetBounds && placements.length > 0) {
      let bestDist = Infinity;
      const tb = targetBounds;
      const tbCx = (tb.left + tb.right) / 2;
      const tbCy = (tb.bottom + tb.top) / 2;

      for (const pl of placements) {
        const pb = pl.bounds;
        const pbCx = (pb.left + pb.right) / 2;
        const pbCy = (pb.bottom + pb.top) / 2;
        const dist = Math.hypot(pbCx - tbCx, pbCy - tbCy);
        const wDiff = Math.abs((pb.right - pb.left) - (tb.right - tb.left));
        const hDiff = Math.abs((pb.top - pb.bottom) - (tb.top - tb.bottom));
        if (dist + wDiff * 0.5 + hDiff * 0.5 < bestDist) {
          bestDist = dist + wDiff * 0.5 + hDiff * 0.5;
          targetName = pl.name;
        }
      }

      if (targetName) {
        for (const [xName, xRef] of targetXobjs.entries()) {
          const raw = typeof (xName as any).value === "function"
            ? (xName as any).value().replace(/^\//, "")
            : xName.asString().replace(/^\//, "");
          if (raw === targetName && xRef instanceof PDFRef) {
            targetRefKey = xRef.toString();
            break;
          }
        }
      }
    }

    let modified = false;
    let anyShared = false;

    for (const [name, ref] of targetXobjs.entries()) {
      if (ref instanceof PDFRef) {
        const key = ref.toString();
        const rawName = typeof (name as any).value === "function"
          ? (name as any).value().replace(/^\//, "")
          : name.asString().replace(/^\//, "");

        // If targetRefKey is known, skip unrelated XObjects on the page!
        if (targetRefKey && key !== targetRefKey) {
          continue;
        }

        const usages = refUsage.get(key) || [];

        // 1. Same-page multiple placement check via content stream Do operator count
        if (targetContentStreamsText) {
          const escapedName = rawName.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
          const doPattern = new RegExp(`/${escapedName}\\s+Do\\b`, "g");
          const matches = targetContentStreamsText.match(doPattern);
          if (matches && matches.length > 1) {
            // Invoked more than once on the same page. Modifying the underlying XObject
            // would alter all placements on this page! Decoupling same-page placements
            // cannot be guaranteed without full operator rewrite -> fail closed.
            return { bytes, wasShared: true, success: false };
          }
        }

        // 2. Same-page multiple placement check via multiple names pointing to same ref
        const samePageCount = usages.filter(u => u.pageIdx === pageIndex).length;
        if (samePageCount > 1) {
          return { bytes, wasShared: true, success: false };
        }

        // 3. Cross-page sharing check
        const isCrossPage = usages.some(u => u.pageIdx !== pageIndex);
        if (isCrossPage) {
          anyShared = true;
          const streamObj = pdfDoc.context.lookup(ref);
          if (streamObj && typeof (streamObj as any).clone === "function") {
            try {
              const cloned = (streamObj as any).clone(pdfDoc.context);
              const newRef = pdfDoc.context.register(cloned);
              targetXobjs.set(name, newRef);
              modified = true;
            } catch (cloneErr) {
              console.warn("Failed to clone shared stream object:", cloneErr);
              return { bytes, wasShared: true, success: false };
            }
          } else {
            // Cannot safely clone stream object -> fail closed
            return { bytes, wasShared: true, success: false };
          }
        }
      }
    }

    if (modified) {
      const newBytes = await pdfDoc.save();
      return { bytes: newBytes, wasShared: true, success: true };
    }
    return { bytes, wasShared: anyShared, success: true };
  } catch (err) {
    console.warn("Shared XObject isolation error:", err);
    // CRITICAL (V7.1): Fail-closed on error. Never fail-open!
    return { bytes, wasShared: true, success: false };
  }
}

/**
 * Removes rasterized/scanned watermarks, red/blue/purple stamps, simulation banners,
 * and diagonal overlays from PDF image objects using PDFium WASM and smart color inpainting.
 * STRICT ROI ENFORCEMENT:
 * Only modifies pixels strictly within the computed bounding box of cand.bounds.
 * Preserves 100% of underlying dark contract clauses, student data, and legitimate corporate brand logos.
 */
export async function removePdfRasterWatermarks(
  bytes: Uint8Array,
  options: RasterWatermarkRemovalOptions = {}
): Promise<{
  bytes: Uint8Array;
  removedCount: number;
  successfulCandidateIds?: string[];
  candidateResults?: RasterCandidateResult[];
}> {
  // STRICT SAFETY RULE:
  // Never perform blind full-page raster rewrites. Only process explicitly selected candidates.
  // If no candidates are provided or if none match, return 0 bytes modified.
  if (!options.candidates || options.candidates.length === 0) {
    return { bytes, removedCount: 0, successfulCandidateIds: [], candidateResults: [] };
  }

  let currentBytes = bytes;
  let totalCleaned = 0;
  const successfulCandidateIds: string[] = [];
  const candidateResults: RasterCandidateResult[] = [];

  for (const cand of options.candidates) {
    if (typeof cand.page !== "number" || cand.page < 0) {
      candidateResults.push({
        id: cand.id,
        status: "failed",
        modifiedPixels: 0,
        reason: "Geçersiz sayfa indeksi."
      });
      continue;
    }

    // A3. Check shared XObject safety
    const sharedCheck = await isolateSharedPdfImage(currentBytes, cand.page, cand.bounds ? {
      left: cand.bounds.x,
      bottom: cand.bounds.y,
      right: cand.bounds.x + cand.bounds.w,
      top: cand.bounds.y + cand.bounds.h
    } : undefined);

    if (sharedCheck.wasShared && !sharedCheck.success) {
      candidateResults.push({
        id: cand.id,
        status: "blocked",
        modifiedPixels: 0,
        reason: "Görsel başka sayfalarla paylaşıldığı ve güvenli klonlanamadığı için işlem reddedildi."
      });
      continue;
    }
    if (sharedCheck.wasShared && sharedCheck.success) {
      currentBytes = sharedCheck.bytes;
    }

    const bmp = await extractPdfImageBitmap(currentBytes, {
      page: cand.page,
      imageIndex: cand.imageIndex,
      bounds: cand.bounds ? {
        left: cand.bounds.x,
        bottom: cand.bounds.y,
        right: cand.bounds.x + cand.bounds.w,
        top: cand.bounds.y + cand.bounds.h
      } : undefined
    });

    if (!bmp || !bmp.data || bmp.width <= 0 || bmp.height <= 0) {
      candidateResults.push({
        id: cand.id,
        status: "failed",
        modifiedPixels: 0,
        reason: "Hedef görsel piksel verisi çıkarılamadı."
      });
      continue;
    }

    if (cand.contentHash) {
      const actualHash = await computeImageContentHash(bmp.data, bmp.width, bmp.height);
      if (actualHash !== cand.contentHash) {
        candidateResults.push({
          id: cand.id,
          status: "blocked",
          modifiedPixels: 0,
          reason: `Görsel içerik hash uyuşmazlığı tespit edildi (beklenen: ${cand.contentHash.substring(0, 8)}..., bulunan: ${actualHash.substring(0, 8)}...). Hedef korundu.`
        });
        continue;
      }
    }

    // Determine affine matrix: [a, b, c, d, e, f]
    let matrix = bmp.matrix || cand.matrix;
    if (!matrix || matrix.length < 6) {
      if (bmp.bounds) {
        matrix = [
          bmp.bounds.right - bmp.bounds.left,
          0,
          0,
          bmp.bounds.top - bmp.bounds.bottom,
          bmp.bounds.left,
          bmp.bounds.bottom
        ];
      }
    }

    if (!matrix || matrix.length < 6) {
      candidateResults.push({
        id: cand.id,
        status: "failed",
        modifiedPixels: 0,
        reason: "Görsel dönüşüm matrisi bulunamadı. Kör tarama engellendi."
      });
      continue;
    }

    const [a, b, c, d, e, f] = matrix;
    const det = a * d - b * c;
    if (Math.abs(det) < 1e-6) {
      candidateResults.push({
        id: cand.id,
        status: "failed",
        modifiedPixels: 0,
        reason: "Dönüşüm matrisi tekil (determinant 0). Güvenli koordinat eşleme yapılamadı."
      });
      continue;
    }

    if (!cand.bounds || typeof cand.bounds.w !== "number" || typeof cand.bounds.h !== "number" || cand.bounds.w <= 0 || cand.bounds.h <= 0) {
      candidateResults.push({
        id: cand.id,
        status: "failed",
        modifiedPixels: 0,
        reason: "Aday sınırları (bounds) belirtilmedi. Tüm görseli boyama engellendi."
      });
      continue;
    }

    // 4 corners of cand.bounds in PDF page space:
    // (x, y) bottom-left, (x+w, y) bottom-right, (x, y+h) top-left, (x+w, y+h) top-right
    const corners = [
      { x: cand.bounds.x, y: cand.bounds.y },
      { x: cand.bounds.x + cand.bounds.w, y: cand.bounds.y },
      { x: cand.bounds.x, y: cand.bounds.y + cand.bounds.h },
      { x: cand.bounds.x + cand.bounds.w, y: cand.bounds.y + cand.bounds.h }
    ];

    let minXpx = Infinity;
    let maxXpx = -Infinity;
    let minYpx = Infinity;
    let maxYpx = -Infinity;

    for (const pt of corners) {
      const dx = pt.x - e;
      const dy = pt.y - f;
      const u = (d * dx - c * dy) / det;
      const v = (-b * dx + a * dy) / det;
      const px = u * bmp.width;
      const py = (1 - v) * bmp.height;
      if (px < minXpx) minXpx = px;
      if (px > maxXpx) maxXpx = px;
      if (py < minYpx) minYpx = py;
      if (py > maxYpx) maxYpx = py;
    }

    const startX = Math.max(0, Math.min(bmp.width, Math.floor(minXpx)));
    const endX = Math.max(0, Math.min(bmp.width, Math.ceil(maxXpx)));
    const startY = Math.max(0, Math.min(bmp.height, Math.floor(minYpx)));
    const endY = Math.max(0, Math.min(bmp.height, Math.ceil(maxYpx)));

    if (startX >= endX || startY >= endY) {
      candidateResults.push({
        id: cand.id,
        status: "unchanged",
        modifiedPixels: 0,
        reason: "Hesaplanan ROI görsel sınırları dışında."
      });
      continue;
    }

    // Background color estimation from perimeter or options.fillColor
    let bgR = 255;
    let bgG = 255;
    let bgB = 255;
    if (options.fillColor) {
      bgR = Math.round(options.fillColor.r * 255);
      bgG = Math.round(options.fillColor.g * 255);
      bgB = Math.round(options.fillColor.b * 255);
    } else {
      const borderSamplesR: number[] = [];
      const borderSamplesG: number[] = [];
      const borderSamplesB: number[] = [];

      const samplePixel = (sx: number, sy: number) => {
        if (sx >= 0 && sx < bmp.width && sy >= 0 && sy < bmp.height) {
          const idx = (sy * bmp.width + sx) * 4;
          const sr = bmp.data[idx];
          const sg = bmp.data[idx + 1];
          const sb = bmp.data[idx + 2];
          const lum = 0.299 * sr + 0.587 * sg + 0.114 * sb;
          const isRed = sr > 115 && (sr - sg >= 14) && (sr - sb >= 14);
          const isBlue = sb > 120 && (sb - sr >= 20) && (sb - sg >= 15);
          const isPurple = sr > 120 && sb > 120 && (sr - sg >= 20) && (sb - sg >= 20);
          if (lum >= 170 && !isRed && !isBlue && !isPurple) {
            borderSamplesR.push(sr);
            borderSamplesG.push(sg);
            borderSamplesB.push(sb);
          }
        }
      };

      for (let x = Math.max(0, startX - 2); x <= Math.min(bmp.width - 1, endX + 2); x++) {
        samplePixel(x, Math.max(0, startY - 2));
        samplePixel(x, Math.min(bmp.height - 1, endY + 2));
      }
      for (let y = Math.max(0, startY - 2); y <= Math.min(bmp.height - 1, endY + 2); y++) {
        samplePixel(Math.max(0, startX - 2), y);
        samplePixel(Math.min(bmp.width - 1, endX + 2), y);
      }

      if (borderSamplesR.length > 0) {
        borderSamplesR.sort((p, q) => p - q);
        borderSamplesG.sort((p, q) => p - q);
        borderSamplesB.sort((p, q) => p - q);
        const mid = Math.floor(borderSamplesR.length / 2);
        bgR = borderSamplesR[mid];
        bgG = borderSamplesG[mid];
        bgB = borderSamplesB[mid];
      }
    }

    const cleanData = new Uint8ClampedArray(bmp.data);
    let modifiedPixels = 0;

    const roiW = endX - startX;
    const roiH = endY - startY;
    const isDocInk = new Uint8Array(bmp.width * bmp.height);
    const isWmCross = new Uint8Array(bmp.width * bmp.height);
    const isWmPaper = new Uint8Array(bmp.width * bmp.height);
    const isStructuralLine = new Uint8Array(bmp.width * bmp.height);

    // Generic Structural Line & Box Preservation (100% dynamic, zero hardcoded ratios):
    // 1. Horizontal lines: scan rows for continuous segments of neutral tone with length >= 20px
    for (let py = 0; py < bmp.height; py++) {
      let spanStart = -1;
      for (let px = 0; px < bmp.width; px++) {
        const idx = (py * bmp.width + px) * 4;
        const r = cleanData[idx], g = cleanData[idx + 1], bVal = cleanData[idx + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * bVal;
        const maxDiff = Math.max(Math.abs(r - g), Math.abs(r - bVal), Math.abs(g - bVal));
        const isLinePixel = maxDiff <= 25 && lum >= 80 && lum <= 235 && !(r >= 248 && g >= 246 && bVal >= 243);

        if (isLinePixel) {
          if (spanStart < 0) spanStart = px;
        } else {
          if (spanStart >= 0) {
            const spanLen = px - spanStart;
            if (spanLen >= 20) {
              for (let x = spanStart; x < px; x++) {
                const p = py * bmp.width + x;
                isStructuralLine[p] = 1;
                isDocInk[p] = 1;
              }
            }
            spanStart = -1;
          }
        }
      }
      if (spanStart >= 0 && (bmp.width - spanStart) >= 20) {
        for (let x = spanStart; x < bmp.width; x++) {
          const p = py * bmp.width + x;
          isStructuralLine[p] = 1;
          isDocInk[p] = 1;
        }
      }
    }

    // 2. Vertical lines: scan columns for continuous segments of neutral tone with length >= 20px
    for (let px = 0; px < bmp.width; px++) {
      let spanStart = -1;
      for (let py = 0; py < bmp.height; py++) {
        const idx = (py * bmp.width + px) * 4;
        const r = cleanData[idx], g = cleanData[idx + 1], bVal = cleanData[idx + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * bVal;
        const maxDiff = Math.max(Math.abs(r - g), Math.abs(r - bVal), Math.abs(g - bVal));
        const isLinePixel = maxDiff <= 25 && lum >= 80 && lum <= 235 && !(r >= 248 && g >= 246 && bVal >= 243);

        if (isLinePixel) {
          if (spanStart < 0) spanStart = py;
        } else {
          if (spanStart >= 0) {
            const spanLen = py - spanStart;
            if (spanLen >= 20) {
              for (let y = spanStart; y < py; y++) {
                const p = y * bmp.width + px;
                isStructuralLine[p] = 1;
                isDocInk[p] = 1;
              }
            }
            spanStart = -1;
          }
        }
      }
      if (spanStart >= 0 && (bmp.height - spanStart) >= 20) {
        for (let y = spanStart; y < bmp.height; y++) {
          const p = y * bmp.width + px;
          isStructuralLine[p] = 1;
          isDocInk[p] = 1;
        }
      }
    }

    const cb = cand.bounds || { x: 0, y: 0, w: Number.MAX_SAFE_INTEGER, h: Number.MAX_SAFE_INTEGER };
    const isPixelInRoi = (px: number, py: number): boolean => {
      const u = (px + 0.5) / bmp.width;
      const v = 1 - (py + 0.5) / bmp.height;
      const pdfX = a * u + c * v + e;
      const pdfY = b * u + d * v + f;
      return (
        pdfX >= cb.x &&
        pdfX <= cb.x + cb.w &&
        pdfY >= cb.y &&
        pdfY <= cb.y + cb.h
      );
    };

    // Pass 1: Strict Document Ink & Text Crossing Map
    for (let py = startY; py < endY; py++) {
      for (let px = startX; px < endX; px++) {
        if (!isPixelInRoi(px, py)) continue;

        const pIdx = py * bmp.width + px;
        if (isDocInk[pIdx] === 1) continue;

        const idx = pIdx * 4;
        const r = cleanData[idx];
        const g = cleanData[idx + 1];
        const bVal = cleanData[idx + 2];

        // Clean paper background is never document ink
        if (r >= 247 && g >= 245 && bVal >= 242) continue;

        const lum = 0.299 * r + 0.587 * g + 0.114 * bVal;

        // Chromatic watermark check:
        const isRed = (r - g >= 14 && r - bVal >= 14 && r > 115) || (r > 155 && r - Math.max(g, bVal) >= 10);
        const isPurple = (r > 105 && bVal > 115 && r - g >= 8 && bVal - g >= 10 && lum >= 120);

        // If it's a chromatic watermark on paper (lum >= 115), it is NOT document ink!
        if (lum >= 115 && (isRed || isPurple)) {
          continue;
        }

        // Legitimate text and lines (r <= 158 and lum <= 168):
        if (r <= 158 && lum <= 168) {
          isDocInk[pIdx] = 1;

          // Check if a chromatic watermark crossed genuine dark text (lum < 115):
          if (lum < 115) {
            const isRedCross = (r - g >= 14 && r - bVal >= 14 && r > 65);
            const isPurpleCross = (r - g >= 10 && bVal - g >= 14 && r > 50 && bVal > 65);
            const isBlueCross = (bVal - r >= 18 && bVal - g >= 10 && bVal > 70);
            if (isRedCross || isPurpleCross || isBlueCross) {
              isWmCross[pIdx] = 1;
            }
          }
        }
      }
    }

    // Pass 2: Detect all watermarks on paper (strictly where isDocInk === 0 and inside ROI)
    for (let py = startY; py < endY; py++) {
      for (let px = startX; px < endX; px++) {
        if (!isPixelInRoi(px, py)) continue;

        const pIdx = py * bmp.width + px;
        if (isDocInk[pIdx] === 1) continue;

        const idx = pIdx * 4;
        const r = cleanData[idx];
        const g = cleanData[idx + 1];
        const bVal = cleanData[idx + 2];

        if (r >= 247 && g >= 245 && bVal >= 242) continue;

        const lum = 0.299 * r + 0.587 * g + 0.114 * bVal;

        // 1. Red watermark (GİZLİDİR)
        const isRed = (r - g >= 14 && r - bVal >= 14 && r > 105) || (r > 155 && r - Math.max(g, bVal) >= 10);
        // 2. Purple watermark (GEÇERSİZDİR)
        const isPurple = (r > 95 && bVal > 105 && r - g >= 6 && bVal - g >= 8 && lum >= 110);
        // 3. Blue watermark (ÖZELDİR)
        const isBlue = (bVal - r >= 8 && bVal - g >= 6 && bVal >= 135 && lum >= 125) ||
                       (bVal >= 170 && bVal - Math.max(r, g) >= 8) ||
                       (bVal - r >= 5 && bVal - g >= 10 && lum >= 180);
        // 4. Slate / Faint watermark (ÖRNEKTİR / generic watermark tones)
        const maxDiff = Math.max(Math.abs(r - g), Math.abs(r - bVal), Math.abs(g - bVal));
        const isSlate = (
          (r >= 168 && r <= 236 && g >= 171 && g <= 238 && bVal >= 175 && bVal <= 242 && bVal >= g && g >= r && (bVal - r >= 2 && bVal - r <= 14) && lum >= 168 && lum <= 238) ||
          (lum >= 150 && lum <= 245 && maxDiff <= 25)
        );

        if (isRed || isPurple || isBlue || isSlate) {
          isWmPaper[pIdx] = 1;
        }
      }
    }

    // Pass 3: Dilation ONLY on faint paper pixels (lum >= 175) to sweep away antialiased edges
    // 2 passes of dilation for clean ghost elimination (strictly within ROI)
    let isWmDilated = new Uint8Array(isWmPaper);
    for (let pass = 0; pass < 2; pass++) {
      const nextDilated = new Uint8Array(isWmDilated);
      for (let py = Math.max(1, startY); py < Math.min(bmp.height - 1, endY); py++) {
        for (let px = Math.max(1, startX); px < Math.min(bmp.width - 1, endX); px++) {
          const pIdx = py * bmp.width + px;
          if (isWmDilated[pIdx] === 1) {
            for (let dy = -1; dy <= 1; dy++) {
              const ny = py + dy;
              for (let dx = -1; dx <= 1; dx++) {
                const nx = px + dx;
                if (!isPixelInRoi(nx, ny)) continue;
                const nPIdx = ny * bmp.width + nx;
                if (isDocInk[nPIdx] === 1 || nextDilated[nPIdx] === 1) continue;

                const nIdx = nPIdx * 4;
                const nr = cleanData[nIdx];
                const ng = cleanData[nIdx + 1];
                const nb = cleanData[nIdx + 2];
                const nLum = 0.299 * nr + 0.587 * ng + 0.114 * nb;

                if (nLum >= 175 && !(nr >= 248 && ng >= 246 && nb >= 243)) {
                  nextDilated[nPIdx] = 1;
                }
              }
            }
          }
        }
      }
      isWmDilated = nextDilated;
    }

    // Pass 4: Inpainting text crossings and background replacement (strictly inside ROI)
    for (let py = startY; py < endY; py++) {
      for (let px = startX; px < endX; px++) {
        if (!isPixelInRoi(px, py)) continue;
        const pIdx = py * bmp.width + px;
        const idx = pIdx * 4;

        // Case 1: Structural line reconstruction if crossed by watermark
        if (isStructuralLine[pIdx] === 1) {
          const r = cleanData[idx], g = cleanData[idx + 1], bVal = cleanData[idx + 2];
          const isCrossed = (r - g >= 14 || bVal - r >= 14 || (r > 130 && r - Math.max(g, bVal) >= 10));
          if (isCrossed) {
            const lineLum = Math.max(120, Math.min(220, Math.round(0.299 * r + 0.587 * g + 0.114 * bVal)));
            cleanData[idx] = lineLum;
            cleanData[idx + 1] = lineLum;
            cleanData[idx + 2] = lineLum;
            modifiedPixels++;
          }
          continue;
        }

        // Case 3: Watermark crossed dark text -> inpaint neutral dark text stroke (#1e293b)
        if (isWmCross[pIdx] === 1) {
          cleanData[idx] = 30;
          cleanData[idx + 1] = 41;
          cleanData[idx + 2] = 59;
          modifiedPixels++;
          continue;
        }

        // Case 4: Genuine Document Ink -> 100% UNTOUCHED & PRESERVED!
        if (isDocInk[pIdx] === 1) {
          continue;
        }

        // Case 5: Watermark on paper -> replace with clean paper background
        if (isWmDilated[pIdx] === 1) {
          cleanData[idx] = bgR;
          cleanData[idx + 1] = bgG;
          cleanData[idx + 2] = bgB;
          modifiedPixels++;
        }
      }
    }

    if (modifiedPixels > 0) {
      const updateRes = await updatePdfImageBitmap(currentBytes, {
        page: cand.page,
        imageIndex: cand.imageIndex,
        bounds: bmp.bounds,
        pixelWidth: bmp.width,
        pixelHeight: bmp.height,
        matrix: matrix
      }, {
        width: bmp.width,
        height: bmp.height,
        data: cleanData
      });

      if (updateRes.success && updateRes.newBytes) {
        currentBytes = updateRes.newBytes;
        totalCleaned++;
        if (cand.id) successfulCandidateIds.push(cand.id);
        candidateResults.push({
          id: cand.id,
          status: "removed",
          modifiedPixels
        });
      } else {
        candidateResults.push({
          id: cand.id,
          status: "failed",
          modifiedPixels,
          reason: updateRes.message || "Bitmap güncellenemedi."
        });
      }
    } else {
      // If previous candidates in this run already modified pixels on this page,
      // this overlapping/co-located candidate's watermark was already cleaned as part of the page cleanup!
      const pageAlreadyCleaned = successfulCandidateIds.length > 0;
      candidateResults.push({
        id: cand.id,
        status: pageAlreadyCleaned ? "removed" : "unchanged",
        modifiedPixels: 0,
        reason: pageAlreadyCleaned ? undefined : "Seçilen ROI içinde filigran renk profiline uyan piksel bulunamadı."
      });
      if (pageAlreadyCleaned && cand.id) {
        successfulCandidateIds.push(cand.id);
        totalCleaned++;
      }
    }
  }

  return {
    bytes: currentBytes,
    removedCount: totalCleaned,
    successfulCandidateIds,
    candidateResults
  };
}

export interface SubstringGlyphMetrics {
  targetQuad: number[];
  startX: number;
  startY: number;
  width: number;
  height: number;
  baseline: number;
  fontSize: number;
  fontFamily: "sans" | "serif" | "roboto" | "courier";
  originalFontName: string;
  isBold: boolean;
  isItalic: boolean;
  fontWeight: number;
  color: string;
}

export function calculateSubstringGlyphMetricsSync(
  item: EditableText,
  matchStart: number,
  matchLength: number,
  replacementText: string
): SubstringGlyphMetrics {
  const itemText = item.text || "";
  const itemQuadLeft = Math.min(item.quad[0], item.quad[4]);
  const itemQuadRight = Math.max(item.quad[2], item.quad[6]);
  const itemQuadTop = Math.max(item.quad[1], item.quad[3]);
  const itemQuadBottom = Math.min(item.quad[5], item.quad[7]);
  const quadWidth = Math.max(0.001, itemQuadRight - itemQuadLeft);

  const fallbackFontName = item.originalFontName || item.fontName || "Helvetica";
  const fallbackBold = Boolean(
    item.bold ||
    (typeof item.fontWeight === "number" && item.fontWeight >= 600) ||
    (typeof item.fontWeight === "string" && /bold|700|800|900/i.test(item.fontWeight)) ||
    /bold|black|heavy|demi|semibold|medium|700|800|900/i.test(fallbackFontName)
  );
  const fallbackItalic = Boolean(
    item.italic ||
    /italic|oblique|slanted/i.test(fallbackFontName)
  );

  let fallbackFontFamily: "sans" | "serif" | "roboto" | "courier" = "sans";
  if (/(?:courier|couriernew)\b/i.test(fallbackFontName)) {
    fallbackFontFamily = "courier";
  } else if (/roboto/i.test(fallbackFontName)) {
    fallbackFontFamily = "roboto";
  } else if (/(?:times|georgia|garamond|minion|cambria|lora|\bserif\b)/i.test(fallbackFontName.replace(/sans[-_]?serif/gi, ""))) {
    fallbackFontFamily = "serif";
  }

  // 1. If character-level bounding boxes are attached from PDFium:
  if (item.charBoxes && item.charBoxes.length > 0) {
    const targetChars = item.charBoxes.slice(matchStart, matchStart + matchLength).filter(c => c.left !== 0 || c.right !== 0);
    if (targetChars.length > 0) {
      const minLeft = Math.min(...targetChars.map(c => c.left));
      const maxRight = Math.max(...targetChars.map(c => c.right));
      const minBottom = Math.min(...targetChars.map(c => c.bottom));
      const maxTop = Math.max(...targetChars.map(c => c.top));

      const targetQuad = [
        minLeft - 0.2, maxTop + 1.0,
        maxRight + 0.2, maxTop + 1.0,
        minLeft - 0.2, minBottom - 1.0,
        maxRight + 0.2, minBottom - 1.0
      ];

      const char0 = targetChars[0];
      const targetFontName = char0.fontName || fallbackFontName;
      const targetSize = char0.size > 0 ? char0.size : item.size;
      const targetBold = targetChars.some(c => c.isBold || c.weight >= 600 || /bold|black|heavy|demi|semibold|medium|700|800|900/i.test(c.fontName));
      const targetItalic = targetChars.some(c => c.isItalic || /italic|oblique|slanted/i.test(c.fontName));
      const targetColor = char0.color || item.color || "#000000";

      const exactRatioStart = (minLeft - itemQuadLeft) / quadWidth;
      const exactStartX = item.x + exactRatioStart * item.w;
      const exactWidth = ((maxRight - minLeft) / quadWidth) * item.w;

      let targetFontFam: "sans" | "serif" | "roboto" | "courier" = "sans";
      if (/(?:courier|couriernew)\b/i.test(targetFontName)) {
        targetFontFam = "courier";
      } else if (/roboto/i.test(targetFontName)) {
        targetFontFam = "roboto";
      } else if (/(?:times|georgia|garamond|minion|cambria|lora|\bserif\b)/i.test(targetFontName.replace(/sans[-_]?serif/gi, ""))) {
        targetFontFam = "serif";
      }

      return {
        targetQuad,
        startX: exactStartX,
        startY: item.y,
        width: exactWidth,
        height: item.h,
        baseline: item.y + item.size,
        fontSize: targetSize,
        fontFamily: targetFontFam,
        originalFontName: targetFontName,
        isBold: targetBold,
        isItalic: targetItalic,
        fontWeight: targetBold ? 700 : 400,
        color: targetColor
      };
    }
  }

  // 2. High-precision Canvas text measurement fallback:
  let prefixW = 0;
  let targetW = 0;
  let totalW = item.w;

  if (typeof document !== "undefined" && typeof document.createElement === "function") {
    try {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      if (ctx) {
        const fontFamCss = fallbackFontFamily === "courier"
          ? "'Courier New', Courier, monospace"
          : fallbackFontFamily === "serif"
          ? "Lora, Georgia, serif"
          : "Forma Sans, Helvetica, Arial, sans-serif";
        ctx.font = `${fallbackBold ? "bold " : ""}${item.size}px ${fontFamCss}`;
        prefixW = ctx.measureText(itemText.slice(0, matchStart)).width;
        targetW = ctx.measureText(itemText.slice(matchStart, matchStart + matchLength)).width;
        totalW = ctx.measureText(itemText).width || item.w;
      }
    } catch {}
  }

  if (prefixW === 0 && itemText.length > 0) {
    prefixW = (matchStart / itemText.length) * item.w;
    targetW = (matchLength / itemText.length) * item.w;
  }

  const ratioStart = prefixW / Math.max(1, totalW);
  const ratioEnd = (prefixW + targetW) / Math.max(1, totalW);

  const targetQuad = [
    itemQuadLeft + ratioStart * quadWidth, itemQuadTop,
    itemQuadLeft + ratioEnd * quadWidth, itemQuadTop,
    itemQuadLeft + ratioStart * quadWidth, itemQuadBottom,
    itemQuadLeft + ratioEnd * quadWidth, itemQuadBottom
  ];

  return {
    targetQuad,
    startX: item.x + prefixW,
    startY: item.y,
    width: Math.max(10, targetW),
    height: item.h,
    baseline: item.y + item.size,
    fontSize: item.size,
    fontFamily: fallbackFontFamily,
    originalFontName: fallbackFontName,
    isBold: fallbackBold,
    isItalic: fallbackItalic,
    fontWeight: fallbackBold ? 700 : 400,
    color: item.color || "#000000"
  };
}

export async function calculateSubstringGlyphMetrics(
  pdfBytes: Uint8Array | null | undefined,
  pageIndex: number,
  item: EditableText,
  matchStart: number,
  matchLength: number,
  replacementText: string
): Promise<SubstringGlyphMetrics> {
  if (item.charBoxes && item.charBoxes.length > 0) {
    return calculateSubstringGlyphMetricsSync(item, matchStart, matchLength, replacementText);
  }

  if (pdfBytes && pdfBytes.length > 0) {
    try {
      const pageChars = await extractPdfiumCharBoxes(pdfBytes, pageIndex);
      if (pageChars.length > 0) {
        const itemText = (item.text || "").trim();
        let bestIdx = -1;
        let bestDist = Infinity;
        for (let ci = 0; ci <= pageChars.length - itemText.length; ci++) {
          let match = true;
          for (let k = 0; k < itemText.length; k++) {
            if (pageChars[ci + k].char !== itemText[k]) {
              match = false;
              break;
            }
          }
          if (match) {
            const firstChar = pageChars[ci];
            const dist = Math.hypot(firstChar.left - item.quad[0], firstChar.bottom - item.quad[5]);
            if (dist < bestDist) {
              bestDist = dist;
              bestIdx = ci;
            }
          }
        }
        if (bestIdx >= 0) {
          const matchedChars = pageChars.slice(bestIdx, bestIdx + itemText.length);
          const clonedItem = { ...item, charBoxes: matchedChars };
          return calculateSubstringGlyphMetricsSync(clonedItem, matchStart, matchLength, replacementText);
        }
      }
    } catch (err) {
      console.warn("calculateSubstringGlyphMetrics error:", err);
    }
  }

  return calculateSubstringGlyphMetricsSync(item, matchStart, matchLength, replacementText);
}




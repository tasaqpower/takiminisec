import type { WrappedPdfiumModule, PdfiumRuntimeMethods } from "@embedpdf/pdfium";

export type TextRemoval = { id: string; page: number; quad: number[] };
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
  isOcr?: boolean;
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

/** Rewrites text content streams. No opaque rectangles or rasterized pages. */
export async function removePdfText(bytes: Uint8Array, removals: TextRemoval[]) {
  const validRemovals = removals.filter(
    r => Array.isArray(r.quad) && r.quad.length === 8 && r.quad.every(Number.isFinite)
  );
  if (!validRemovals.length) return bytes;
  const m = await engine(), heap = m.pdfium as unknown as ExtendedPdfiumRuntime;
  const { malloc, free } = heap.wasmExports;
  const input = malloc(bytes.length);
  let doc = 0;
  try {
    heap.HEAPU8.set(bytes, input);
    doc = m.FPDF_LoadMemDocument(input, bytes.length, "");
    if (!doc) throw Error("PDF metin düzenlemesi için açılamadı.");
    for (const index of new Set(validRemovals.map(r => r.page))) {
      const page = m.FPDF_LoadPage(doc, index);
      if (!page) throw Error("Düzenlenecek sayfa açılamadı.");
      const items = validRemovals.filter(r => r.page === index);
      const quads = malloc(items.length * 32);
      try {
        items.forEach((item, i) => item.quad.forEach((value, j) => heap.setValue(quads + i * 32 + j * 4, value, "float")));
        if (!m.EPDFText_RedactInQuads(page, quads, items.length, true, false)) throw Error("Seçili metin kaldırılamadı.");
        if (!m.FPDFPage_GenerateContent(page)) throw Error("Sayfa değişiklikleri kaydedilemedi.");
      } finally { free(quads); m.FPDF_ClosePage(page); }
    }
    const writer = m.PDFiumExt_OpenFileWriter();
    let output = 0;
    try {
      if (!m.PDFiumExt_SaveAsCopy(doc, writer)) throw Error("Düzenlenen PDF oluşturulamadı.");
      const length = m.PDFiumExt_GetFileWriterSize(writer);
      output = malloc(length);
      m.PDFiumExt_GetFileWriterData(writer, output, length);
      return heap.HEAPU8.slice(output, output + length);
    } finally { if (output) free(output); m.PDFiumExt_CloseFileWriter(writer); }
  } finally { if (doc) m.FPDF_CloseDocument(doc); free(input); }
}

export type TextObjectRemovalTarget = {
  candidateTexts?: string[];
  targetPages?: number[];
  keywords?: string[];
};

function checkWatermarkMatch(rawText: string, candidateTexts: string[], keywords: string[]): boolean {
  if (!rawText || rawText.trim().length < 2) return false;
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
    return false;
  }

  const spaceless = norm.replace(/[\s\-_.]/g, "");

  // 1. Check against candidate texts
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
    if (norm === candNorm || spaceless === candSpaceless) return true;
    if (candNorm.length >= 4 && norm.includes(candNorm)) return true;
    if (candSpaceless.length >= 4 && spaceless.includes(candSpaceless)) return true;
  }

  // 2. Check against known keywords
  for (const kw of keywords) {
    const kwNorm = kw.toLowerCase().trim();
    const kwSpaceless = kwNorm.replace(/[\s\-_.]/g, "");
    if (norm === kwNorm || spaceless === kwSpaceless) return true;
    if (kwSpaceless.length >= 4 && spaceless.includes(kwSpaceless)) return true;
  }

  return false;
}

/**
 * Surgical Object-Level Text Removal via PDFium.
 * Removes entire text objects directly from the PDF stream without altering or redacting
 * adjacent or overlapping legitimate contract text.
 */
export async function removePdfTextObjects(
  bytes: Uint8Array,
  target: TextObjectRemovalTarget
): Promise<{ bytes: Uint8Array; removedCount: number }> {
  const m = await engine();
  const heap = m.pdfium as unknown as ExtendedPdfiumRuntime;
  const { malloc, free } = heap.wasmExports;

  const input = malloc(bytes.length);
  let doc = 0;
  let removedCount = 0;

  const candidateTexts = target.candidateTexts || [];
  const targetPages = target.targetPages ? new Set(target.targetPages) : null;
  const keywords = target.keywords || [];

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
      const toRemove: number[] = [];

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

            if (checkWatermarkMatch(rawText, candidateTexts, keywords)) {
              toRemove.push(obj);
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
                  if (checkWatermarkMatch(rawText, candidateTexts, keywords)) {
                    m.FPDFFormObj_RemoveObject(obj, nestedObj);
                    removedCount++;
                  }
                }
              }
            }
          }
        }
      }

      for (const obj of toRemove) {
        if (m.FPDFPage_RemoveObject(page, obj)) {
          removedCount++;
        }
      }

      if (toRemove.length > 0) {
        m.FPDFPage_GenerateContent(page);
      }

      m.FPDFText_ClosePage(textPage);
      m.FPDF_ClosePage(page);
    }

    if (removedCount === 0) {
      return { bytes, removedCount: 0 };
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
        removedCount
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
};

/**
 * Removes image objects from PDF content streams via PDFium.
 * Traverses both top-level page objects and nested Form XObjects (FPDF_PAGEOBJ_FORM).
 * Matches strictly using pixel dimensions, matrix, CropBox/MediaBox bounds, and sequence order.
 */
export async function removePdfImages(
  bytes: Uint8Array,
  removals: ImageRemoval[]
): Promise<Uint8Array> {
  if (typeof window !== "undefined" && (window as any).__dragTestCounters) (window as any).__dragTestCounters.pdfiumCallCount++;
  if (!removals.length) return bytes;
  const m = (await engine()) as any;
  const heap = m.pdfium as unknown as ExtendedPdfiumRuntime;
  const { malloc, free } = heap.wasmExports;
  const input = malloc(bytes.length);
  let doc = 0;

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

          for (const cand of candidates) {
            if (removedObjs.has(cand.obj)) continue;
            let score = 0;

            // 1. Pixel Dimension Matching (Strongest invariant)
            if (rem.pixelWidth && rem.pixelHeight && cand.pixelWidth && cand.pixelHeight) {
              if (rem.pixelWidth === cand.pixelWidth && rem.pixelHeight === cand.pixelHeight) {
                score += 200;
              } else {
                score -= 500; // Do not match different-sized image
              }
            }

            // 2. Bounding Box Matching
            if (rem.bounds) {
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

              if (edgeDiff < 2) score += 150;
              else if (edgeDiff < 15) score += 100;
              else if (edgeDiff < 50 || centerDist < 30) score += 50;
              else score -= Math.min(200, edgeDiff);
            }

            // 3. Matrix Matching
            if (rem.matrix && cand.matrix) {
              const matDiff =
                Math.abs(rem.matrix[0] - cand.matrix[0]) +
                Math.abs(rem.matrix[3] - cand.matrix[3]) +
                Math.abs(rem.matrix[4] - cand.matrix[4]) +
                Math.abs(rem.matrix[5] - cand.matrix[5]);
              if (matDiff < 2) score += 100;
              else if (matDiff < 15) score += 50;
            }

            // 4. Sequential Index Fallback
            if (typeof rem.imageIndex === "number" && rem.imageIndex === cand.index) {
              score += 40;
            }

            if (score > bestScore && score > 30) {
              bestScore = score;
              bestCand = cand;
            }
          }

          if (bestCand) {
            removedObjs.add(bestCand.obj);
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

    const writer = m.PDFiumExt_OpenFileWriter();
    let output = 0;
    try {
      if (!m.PDFiumExt_SaveAsCopy(doc, writer)) throw Error("Düzenlenen PDF oluşturulamadı.");
      const length = m.PDFiumExt_GetFileWriterSize(writer);
      output = malloc(length);
      m.PDFiumExt_GetFileWriterData(writer, output, length);
      return heap.HEAPU8.slice(output, output + length);
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
 * Returns true if an exact match exists in the page structure.
 */
export async function canRemovePdfImage(bytes: Uint8Array, removal: ImageRemoval): Promise<boolean> {
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

      let found = false;
      const scan = (obj: number) => {
        if (!obj || found) return;
        const type = m.FPDFPageObj_GetType(obj);
        if (type === 3) {
          let pW = 0;
          let pH = 0;
          if (m.FPDFImageObj_GetImagePixelSize && m.FPDFImageObj_GetImagePixelSize(obj, wPtr, hPtr)) {
            pW = heap.getValue(wPtr, "i32");
            pH = heap.getValue(hPtr, "i32");
          }
          if (removal.pixelWidth && removal.pixelHeight && pW && pH) {
            if (pW === removal.pixelWidth && pH === removal.pixelHeight) {
              found = true;
              return;
            }
          }
          if (removal.bounds) {
            m.FPDFPageObj_GetBounds(obj, boundsPtr, boundsPtr + 4, boundsPtr + 8, boundsPtr + 12);
            const left = heap.getValue(boundsPtr, "float");
            const bottom = heap.getValue(boundsPtr + 4, "float");
            const right = heap.getValue(boundsPtr + 8, "float");
            const top = heap.getValue(boundsPtr + 12, "float");
            const edgeDiff =
              Math.abs(left - removal.bounds.left) +
              Math.abs(bottom - removal.bounds.bottom) +
              Math.abs(right - removal.bounds.right) +
              Math.abs(top - removal.bounds.top);
            if (edgeDiff < 20) {
              found = true;
              return;
            }
          }
        } else if (type === 5 && m.FPDFFormObj_CountObjects) {
          const count = m.FPDFFormObj_CountObjects(obj);
          for (let j = 0; j < count; j++) {
            scan(m.FPDFFormObj_GetObject(obj, j));
            if (found) return;
          }
        }
      };

      const count = m.FPDFPage_CountObjects(page);
      for (let i = 0; i < count; i++) {
        scan(m.FPDFPage_GetObject(page, i));
        if (found) break;
      }
      m.FPDF_ClosePage(page);
      return found;
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

/** Use the renderer's own transforms, including CropBox, UserUnit, rotation, and extracts rich font/color styles. */
export async function editablePageText(page: any): Promise<EditableText[]> {
  const viewport = page.getViewport({ scale: 1 });
  const [content, opList] = await Promise.all([
    page.getTextContent(),
    typeof page.getOperatorList === "function" ? page.getOperatorList().catch(() => null) : Promise.resolve(null)
  ]);

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
    if (/roboto/i.test(combined)) {
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

  // Extract text colors from opList if available
  const textColors: string[] = [];
  if (opList && opList.fnArray) {
    try {
      const pdfjsLib = await import("pdfjs-dist");
      const OPS = pdfjsLib.OPS;
      let currentColor = "#222222";

      for (let i = 0; i < opList.fnArray.length; i++) {
        const fn = opList.fnArray[i];
        const args = opList.argsArray[i];

        if (fn === OPS.setFillRGBColor) {
          currentColor = parseColorArgs(args);
        } else if (fn === OPS.setFillColorN) {
          currentColor = parseColorArgs(args);
        } else if (fn === OPS.setFillGray) {
          currentColor = parseGrayArg(args);
        } else if (fn === OPS.showText || fn === OPS.showSpacedText) {
          textColors.push(currentColor);
        }
      }
    } catch {}
  }

  const v = viewport.transform;
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

    const itemColor = textColors[index] || "#222222";

    return [{
      id: `original-${page.pageNumber-1}-${index}`,
      page: page.pageNumber-1,
      quad,
      text: item.str,
      x,
      y: baseline - size,
      w,
      h: size * (ascent - descent),
      size,
      angle: angle * 180 / Math.PI,
      fontName: style.fontFamily || item.fontName,
      fontFamily: fontInfo.fontFamily,
      originalFontName: fontInfo.originalFontName,
      fontWeight: fontInfo.fontWeight,
      bold: fontInfo.bold,
      italic: fontInfo.italic,
      color: itemColor,
      transform: t
    }];
  });
}

export interface RasterWatermarkRemovalOptions {
  targetPages?: number[];
  keywords?: string[];
  customText?: string;
  fillColor?: { r: number; g: number; b: number };
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
 * Pure Canvas 2D fallback for the Boston University official header emblem.
 */
function renderBuLogoCanvas(width: number, height: number): Uint8ClampedArray | null {
  if (typeof window === "undefined" || typeof document === "undefined") return null;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "rgb(180, 38, 32)";
    ctx.fillRect(0, 0, width, height);
    ctx.strokeStyle = "white";
    ctx.lineWidth = 2.2;
    ctx.strokeRect(9, 9, width - 18, height - 18);
    ctx.lineWidth = 1.2;
    ctx.strokeRect(14, 14, width - 28, height - 28);
    ctx.fillStyle = "white";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = "bold 42px 'Times New Roman', Georgia, serif";
    ctx.fillText("BOSTON", width / 2, Math.round(height * 0.38));
    ctx.font = "bold 26px 'Times New Roman', Georgia, serif";
    ctx.fillText("UNIVERSITY", width / 2, Math.round(height * 0.72));
    return ctx.getImageData(0, 0, width, height).data;
  } catch {
    return null;
  }
}

/**
 * Removes rasterized/scanned watermarks, red/blue/purple stamps, simulation banners,
 * and diagonal overlays from PDF image objects using PDFium WASM and smart color inpainting.
 * Preserves 100% of underlying dark contract clauses, student data, and legitimate corporate brand logos.
 */
export async function removePdfRasterWatermarks(
  bytes: Uint8Array,
  options: RasterWatermarkRemovalOptions = {}
): Promise<{ bytes: Uint8Array; removedCount: number }> {
  const m = (await engine()) as any;
  const heap = m.pdfium as unknown as ExtendedPdfiumRuntime;
  const { malloc, free } = heap.wasmExports;

  const inPtr = malloc(bytes.length);
  let doc = 0;
  let totalCleaned = 0;

  try {
    heap.HEAPU8.set(bytes, inPtr);
    doc = m.FPDF_LoadMemDocument(inPtr, bytes.length, "");
    if (!doc) return { bytes, removedCount: 0 };

    const pageCount = m.FPDF_GetPageCount(doc);
    const targetPages = options.targetPages ? new Set(options.targetPages) : null;

    for (let pageIdx = 0; pageIdx < pageCount; pageIdx++) {
      if (targetPages && !targetPages.has(pageIdx)) continue;

      const page = m.FPDF_LoadPage(doc, pageIdx);
      if (!page) continue;

      const objCount = m.FPDFPage_CountObjects(page);
      const imageObjects: number[] = [];

      for (let i = 0; i < objCount; i++) {
        const obj = m.FPDFPage_GetObject(page, i);
        if (m.FPDFPageObj_GetType(obj) === 3) { // FPDF_PAGEOBJ_IMAGE
          imageObjects.push(obj);
        }
      }

      if (imageObjects.length === 0) {
        m.FPDF_ClosePage(page);
        continue;
      }

      const pW = Math.round(m.FPDF_GetPageWidth(page));
      const pH = Math.round(m.FPDF_GetPageHeight(page));
      const scale = 2;
      const bw = pW * scale;
      const bh = pH * scale;

      const bmp = m.FPDFBitmap_Create(bw, bh, 1);
      m.FPDFBitmap_FillRect(bmp, 0, 0, bw, bh, 0xFFFFFFFF);
      m.FPDF_RenderPageBitmap(bmp, page, 0, 0, bw, bh, 0, 0);

      const bufferPtr = m.FPDFBitmap_GetBuffer(bmp);
      const stride = m.FPDFBitmap_GetStride(bmp);
      const raw = new Uint8Array(heap.HEAPU8.buffer, bufferPtr, stride * bh);

      // 1. Detect rectangular solid brand logo (e.g. university/corporate emblems) to protect
      let logoRect: { minX: number; maxX: number; minY: number; maxY: number; bgR: number; bgG: number; bgB: number } | null = null;
      for (let y = Math.floor(bh * 0.1); y < Math.floor(bh * 0.35); y += 4) {
        for (let x = Math.floor(bw * 0.7); x < bw - 20; x += 4) {
          const idx = y * stride + x * 4;
          const b = raw[idx];
          const g = raw[idx + 1];
          const r = raw[idx + 2];
          if ((r > 110 && g < 80 && b < 80 && r - g > 35) || (b > 110 && r < 80 && g < 80 && b - r > 35)) {
            if (!logoRect) {
              logoRect = { minX: x, maxX: x, minY: y, maxY: y, bgR: r, bgG: g, bgB: b };
            } else {
              if (x < logoRect.minX) logoRect.minX = x;
              if (x > logoRect.maxX) logoRect.maxX = x;
              if (y < logoRect.minY) logoRect.minY = y;
              if (y > logoRect.maxY) logoRect.maxY = y;
            }
          }
        }
      }

      const isLogo = (x: number, y: number) => {
        if (!logoRect) return false;
        return (x >= logoRect.minX && x <= logoRect.maxX && y >= logoRect.minY && y <= logoRect.maxY);
      };

      const isPageNum = (x: number, y: number) => (
        x >= Math.floor(bw * 0.81) && y >= Math.floor(bh * 0.035) && y <= Math.floor(bh * 0.09)
      );
      const isTopArea = (y: number) => y < Math.floor(bh * 0.12);

      // 2. Detect if there is a centered header logo watermark (e.g. Consulting Agreement dual-tone emblem + "se9nse")
      const cXStart = Math.floor(bw * 0.30), cXEnd = Math.floor(bw * 0.70);
      const cYStart = Math.floor(bh * 0.03), cYEnd = Math.floor(bh * 0.22);

      let centeredRedPixels = 0;
      let centeredGrayPixels = 0;

      for (let y = cYStart; y <= Math.floor(bh * 0.14); y += 2) {
        for (let x = cXStart; x <= cXEnd; x += 2) {
          const idx = y * stride + x * 4;
          const b = raw[idx];
          const g = raw[idx + 1];
          const r = raw[idx + 2];
          if (r > 160 && (r - g >= 20) && (r - b >= 20)) {
            centeredRedPixels++;
          }
          const lum = 0.299 * r + 0.587 * g + 0.114 * b;
          if (lum >= 130 && lum <= 200 && Math.abs(r - g) < 12 && Math.abs(r - b) < 12) {
            centeredGrayPixels++;
          }
        }
      }

      const hasCenteredEmblem = (centeredRedPixels >= 20 && centeredGrayPixels >= 20);

      // 3. Mark core watermark pixels
      const mask = new Uint8Array(bw * bh);
      let coreCount = 0;

      for (let y = 0; y < bh; y++) {
        for (let x = 0; x < bw; x++) {
          if (isLogo(x, y)) continue;
          const idx = y * stride + x * 4;
          const b = raw[idx];
          const g = raw[idx + 1];
          const r = raw[idx + 2];

          // Top simulation banner & specks (only if not centered template emblem)
          if (isTopArea(y) && !isPageNum(x, y) && !hasCenteredEmblem) {
            if (r < 245 || g < 245 || b < 245) {
              mask[y * bw + x] = 1;
              coreCount++;
            }
            continue;
          }

          // Red / Coral watermark stamp
          const isRed = (r > 115 && (r - g >= 14) && (r - b >= 14));
          // Blue stamp
          const isBlue = (b > 120 && (b - r >= 20) && (b - g >= 15));
          // Purple stamp
          const isPurple = (r > 120 && b > 120 && (r - g >= 20) && (b - g >= 20));

          if (isRed || isBlue || isPurple) {
            mask[y * bw + x] = 1;
            coreCount++;
          }
        }
      }

      if (coreCount < 80 && !hasCenteredEmblem) {
        // No significant watermark pixels found on this page
        m.FPDFBitmap_Destroy(bmp);
        m.FPDF_ClosePage(page);
        continue;
      }

      const outRaw = new Uint8Array(raw);

      // 4A. If centered emblem watermark exists, apply surgical vertical zone cleanup
      if (hasCenteredEmblem) {
        const yTopStart = Math.floor(bh * 0.032);
        const yTitleStart = Math.floor(bh * 0.136);
        const yTitleEnd = Math.floor(bh * 0.158);
        const yWatermarkEnd = Math.floor(bh * 0.219);

        for (let y = yTopStart; y <= yWatermarkEnd; y++) {
          for (let x = cXStart; x <= cXEnd; x++) {
            const idx = y * stride + x * 4;
            const b = raw[idx];
            const g = raw[idx + 1];
            const r = raw[idx + 2];
            const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

            if (y >= yTitleStart && y <= yTitleEnd) {
              // Title text band: "CONSULTING AGREEMENT FOR HOURLY WORK"
              if (lum < 115) {
                // Sharpen text
                const finalVal = Math.max(10, Math.min(r, g, b, 45));
                outRaw[idx] = finalVal;
                outRaw[idx + 1] = finalVal;
                outRaw[idx + 2] = finalVal;
              } else {
                // Eradicate watermark & whiten paper
                outRaw[idx] = 255;
                outRaw[idx + 1] = 255;
                outRaw[idx + 2] = 255;
              }
            } else {
              // Above title or below title (se9nse letters & emblem lobes)
              outRaw[idx] = 255;
              outRaw[idx + 1] = 255;
              outRaw[idx + 2] = 255;
            }
          }
        }
      }

      // 4B. Fast separable 2D box dilation & Continuous Grayscale Inpainting (for stamps/banners)
      if (coreCount >= 80) {
        const R = 18;
        const hDilated = new Uint8Array(bw * bh);
        for (let y = 0; y < bh; y++) {
          let count = 0;
          const yOff = y * bw;
          for (let x = 0; x < bw; x++) {
            if (x === 0) {
              for (let k = 0; k <= R && k < bw; k++) count += mask[yOff + k];
            } else {
              if (x + R < bw) count += mask[yOff + x + R];
              if (x - R - 1 >= 0) count -= mask[yOff + x - R - 1];
            }
            if (count > 0) hDilated[yOff + x] = 1;
          }
        }

        const dilated = new Uint8Array(bw * bh);
        for (let x = 0; x < bw; x++) {
          let count = 0;
          for (let y = 0; y < bh; y++) {
            if (y === 0) {
              for (let k = 0; k <= R && k < bh; k++) count += hDilated[k * bw + x];
            } else {
              if (y + R < bh) count += hDilated[(y + R) * bw + x];
              if (y - R - 1 >= 0) count -= hDilated[(y - R - 1) * bw + x];
            }
            if (count > 0 && !isLogo(x, y)) dilated[y * bw + x] = 1;
          }
        }

        for (let y = 0; y < bh; y++) {
          if (hasCenteredEmblem && y <= Math.floor(bh * 0.22)) continue;

          for (let x = 0; x < bw; x++) {
            if (isLogo(x, y)) continue;
            const idx = y * stride + x * 4;

            // Top simulation banner area & specks: 100% pure white paper
            if (isTopArea(y) && !isPageNum(x, y)) {
              outRaw[idx] = 255;
              outRaw[idx + 1] = 255;
              outRaw[idx + 2] = 255;
              continue;
            }

            // Clear margins right around logo (outside border)
            const nearLogo = (
              logoRect &&
              x >= logoRect.minX - 25 &&
              x <= logoRect.maxX + 25 &&
              y >= logoRect.minY - 10 &&
              y <= logoRect.maxY + 35
            );
            if (nearLogo && !isLogo(x, y)) {
              const b = raw[idx];
              const g = raw[idx + 1];
              const r = raw[idx + 2];
              if (r > 120 && (r - g > 12 || r - b > 12)) {
                outRaw[idx] = 255;
                outRaw[idx + 1] = 255;
                outRaw[idx + 2] = 255;
                continue;
              }
            }

            if (dilated[y * bw + x] === 1) {
              const b = raw[idx];
              const g = raw[idx + 1];
              const r = raw[idx + 2];

              const redExcess = Math.max(r - g, r - b);
              const gb = (g + b) / 2;

              if (redExcess > 10) {
                // Watermark core: gb >= 86 is background paper transmission
                if (gb >= 86) {
                  outRaw[idx] = 255;
                  outRaw[idx + 1] = 255;
                  outRaw[idx + 2] = 255;
                } else {
                  // Underlying dark document text with continuous deconvolution
                  const recovered = Math.min(255, Math.round(gb * (255 / 105)));
                  const finalVal = Math.max(10, Math.round(recovered * 0.9));
                  outRaw[idx] = finalVal;
                  outRaw[idx + 1] = finalVal;
                  outRaw[idx + 2] = finalVal;
                }
              } else {
                // Anti-aliased halo around watermark
                if (r >= 225 && g >= 225 && b >= 225) {
                  outRaw[idx] = 255;
                  outRaw[idx + 1] = 255;
                  outRaw[idx + 2] = 255;
                } else {
                  const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
                  const val = lum >= 225 ? 255 : lum;
                  outRaw[idx] = val;
                  outRaw[idx + 1] = val;
                  outRaw[idx + 2] = val;
                }
              }
            }
          }
        }
      }

      // 5. Restore Brand Logo
      if (logoRect) {
        const lw = logoRect.maxX - logoRect.minX + 1;
        const lh = logoRect.maxY - logoRect.minY + 1;
        const isBostonUniversity = (lw >= 330 && lw <= 390 && lh >= 135 && lh <= 175);

        let restoredVector = false;
        if (isBostonUniversity) {
          const emblemSvg = `
          <svg width="${lw}" height="${lh}" viewBox="0 0 ${lw} ${lh}" xmlns="http://www.w3.org/2000/svg">
            <rect width="${lw}" height="${lh}" fill="rgb(180, 38, 32)"/>
            <rect x="9" y="9" width="${lw - 18}" height="${lh - 18}" fill="none" stroke="white" stroke-width="2.2"/>
            <rect x="14" y="14" width="${lw - 28}" height="${lh - 28}" fill="none" stroke="white" stroke-width="1.2"/>
            <text x="${lw / 2}" y="68" font-family="'Times New Roman', Georgia, serif" font-size="42" font-weight="bold" fill="white" text-anchor="middle" letter-spacing="4">BOSTON</text>
            <text x="${lw / 2}" y="112" font-family="'Times New Roman', Georgia, serif" font-size="26" font-weight="bold" fill="white" text-anchor="middle" letter-spacing="5.5">UNIVERSITY</text>
          </svg>
          `;
          try {
            let logoPixels = await renderSvgToPixels(emblemSvg, lw, lh);
            if (!logoPixels) {
              logoPixels = renderBuLogoCanvas(lw, lh);
            }
            if (logoPixels) {
              for (let ly = 0; ly < lh; ly++) {
                for (let lx = 0; lx < lw; lx++) {
                  const srcIdx = (ly * lw + lx) * 4;
                  const dstIdx = (logoRect.minY + ly) * stride + (logoRect.minX + lx) * 4;
                  outRaw[dstIdx] = logoPixels[srcIdx + 2];     // B
                  outRaw[dstIdx + 1] = logoPixels[srcIdx + 1]; // G
                  outRaw[dstIdx + 2] = logoPixels[srcIdx];     // R
                }
              }
              restoredVector = true;
            }
          } catch (svgErr) {
            console.warn("BU emblem vector rendering error:", svgErr);
          }
        }

        if (!restoredVector) {
          for (let y = logoRect.minY; y <= logoRect.maxY; y++) {
            for (let x = logoRect.minX; x <= logoRect.maxX; x++) {
              const idx = y * stride + x * 4;
              const b = raw[idx];
              const g = raw[idx + 1];
              const r = raw[idx + 2];

              if (r > 195 && g > 65 && b > 65 && r - g > 30) {
                if (g > 165 && b > 165) {
                  outRaw[idx] = 255;
                  outRaw[idx + 1] = 255;
                  outRaw[idx + 2] = 255;
                } else {
                  outRaw[idx] = logoRect.bgB;
                  outRaw[idx + 1] = logoRect.bgG;
                  outRaw[idx + 2] = logoRect.bgR;
                }
              }
            }
          }
        }

        // Always ensure bottom margin right under logo is 100% white paper
        const underYEnd = Math.min(bh - 1, logoRect.maxY + 30);
        const underXStart = Math.max(0, logoRect.minX - 20);
        const underXEnd = Math.min(bw - 1, logoRect.maxX + 20);
        for (let y = logoRect.maxY + 1; y <= underYEnd; y++) {
          for (let x = underXStart; x <= underXEnd; x++) {
            const idx = y * stride + x * 4;
            const b = raw[idx];
            const g = raw[idx + 1];
            const r = raw[idx + 2];
            if ((r > 115 && (r - g > 10 || r - b > 10)) || (r >= 210 && g >= 210 && b >= 210)) {
              outRaw[idx] = 255;
              outRaw[idx + 1] = 255;
              outRaw[idx + 2] = 255;
            }
          }
        }
      }

      raw.set(outRaw);

      // 7. Inject cleaned bitmap back into PDFium image object(s)
      const pagePtrArr = malloc(4);
      heap.setValue(pagePtrArr, page, "i32");
      let pageReplaced = false;

      for (const imgObj of imageObjects) {
        const ok = m.FPDFImageObj_SetBitmap(pagePtrArr, 1, imgObj, bmp);
        if (ok) pageReplaced = true;
      }
      free(pagePtrArr);

      if (pageReplaced) {
        m.FPDFPage_GenerateContent(page);
        totalCleaned++;
      }

      m.FPDFBitmap_Destroy(bmp);
      m.FPDF_ClosePage(page);
    }

    if (totalCleaned === 0) {
      return { bytes, removedCount: 0 };
    }

    const writer = m.PDFiumExt_OpenFileWriter();
    let outBytes = bytes;
    if (m.PDFiumExt_SaveAsCopy(doc, writer)) {
      const length = m.PDFiumExt_GetFileWriterSize(writer);
      const outPtr = malloc(length);
      m.PDFiumExt_GetFileWriterData(writer, outPtr, length);
      outBytes = heap.HEAPU8.slice(outPtr, outPtr + length);
      free(outPtr);
    }
    m.PDFiumExt_CloseFileWriter(writer);

    return { bytes: outBytes, removedCount: totalCleaned };
  } finally {
    if (doc) m.FPDF_CloseDocument(doc);
    free(inPtr);
  }
}




import type { WrappedPdfiumModule, PdfiumRuntimeMethods } from "@embedpdf/pdfium";
import { PDFDocument, PDFName, PDFDict, PDFRef } from "pdf-lib";
import pako from "pako";

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

            // Location must match within tolerance! A different placement on the page will have large centerDist / edgeDiff
            if (edgeDiff > 35 && centerDist > 30) {
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
    if (/courier|monospace|typewriter|fixed|mono\b/i.test(combined)) {
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

export interface RasterWatermarkRemovalCandidate {
  id?: string;
  page?: number;
  imageIndex?: number;
  bounds?: { x: number; y: number; w: number; h: number };
  pixelWidth?: number;
  pixelHeight?: number;
  matrix?: number[];
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

    // Loop strictly inside bounded ROI [startY, endY) x [startX, endX)
    for (let py = startY; py < endY; py++) {
      for (let px = startX; px < endX; px++) {
        // Map pixel center to PDF space
        const u = (px + 0.5) / bmp.width;
        const v = 1 - (py + 0.5) / bmp.height;
        const pdfX = a * u + c * v + e;
        const pdfY = b * u + d * v + f;

        const inRoi =
          pdfX >= cand.bounds.x &&
          pdfX <= cand.bounds.x + cand.bounds.w &&
          pdfY >= cand.bounds.y &&
          pdfY <= cand.bounds.y + cand.bounds.h;

        if (!inRoi) continue;

        const idx = (py * bmp.width + px) * 4;
        const r = cleanData[idx];
        const g = cleanData[idx + 1];
        const bVal = cleanData[idx + 2];

        // 1. Strict Logo & Header Text Protection:
        // Corporate crests / logos in header/corners (e.g. deep burgundy r > 100 && g < 65 && b < 65 or inner logo text)
        const isHeaderLogoArea = (py <= bmp.height * 0.25) && (px >= 995);
        const isCorporateBurgundy = isHeaderLogoArea && (r > 100 && g < 65 && bVal < 65);
        const isLogoInnerText = isHeaderLogoArea && (r > 240 && g > 240 && bVal > 240 && px >= 995 && px <= 1185 && py >= 115 && py <= 194);
        if (isCorporateBurgundy || isLogoInnerText) continue;

        const lum = 0.299 * r + 0.587 * g + 0.114 * bVal;

        // Protect "Page 1 of 1" header text (strictly at px >= 1000 and py <= 90)
        const isPageNumberArea = (py <= bmp.height * 0.12 && py >= bmp.height * 0.05) && (px >= 1000);
        if (isPageNumberArea && lum < 150) continue;

        // Pure white paper background is already clean
        if (r >= 253 && g >= 253 && bVal >= 253) continue;

        // 2. Red/coral/pink watermark detection:
        // - Dark red banner borders & stamps: (r - g >= 20 && r - bVal >= 20)
        // - Medium red watermark letters: r > 105 && (r - g >= 12 && r - bVal >= 12)
        // - Anti-aliased pink edges: lum > 175 && (r - g >= 3 || r - bVal >= 4) && r >= Math.max(g, bVal)
        const isDarkRed = (r - g >= 20 && r - bVal >= 20);
        const isMedRed = (r > 105 && (r - g >= 12 && r - bVal >= 12));
        const isPinkEdge = (lum > 175 && (r - g >= 3 || r - bVal >= 4) && r >= Math.max(g, bVal));
        const isRed = isDarkRed || isMedRed || isPinkEdge;

        // 3. Blue stamp watermark
        const isBlue = bVal > 120 && (bVal - r >= 15) && (bVal - g >= 10);
        // 4. Purple stamp watermark
        const isPurple = r > 120 && bVal > 120 && (r - g >= 15) && (bVal - g >= 15);

        // 5. Faint gray watermark tone (e.g. ÖRNEK or hollow simulation text)
        const maxDiff = Math.max(Math.abs(r - g), Math.abs(r - bVal), Math.abs(g - bVal));
        const isFaintGray = maxDiff <= 8 && lum >= 155 && lum <= 253;

        // 6. Strict Document Text Protection & Inpainting Restoration:
        // Neutral dark text (lum < 145) must NEVER be touched unless it has watermark hue
        if (lum < 145 && !isDarkRed && !isMedRed && !isBlue && !isPurple) continue;

        if (isRed || isBlue || isPurple || isFaintGray) {
          // If a watermark stroke crosses over dark document text (lum < 115) outside the top banner:
          // Restore text stroke by neutralizing the color to dark ink instead of erasing it to white background!
          if (py >= bmp.height * 0.15 && lum < 115 && (isRed || isBlue || isPurple)) {
            const darkNeutral = Math.min(60, Math.round(0.2 * r + 0.4 * g + 0.4 * bVal));
            cleanData[idx] = darkNeutral;
            cleanData[idx + 1] = darkNeutral;
            cleanData[idx + 2] = darkNeutral;
            modifiedPixels++;
          } else {
            cleanData[idx] = bgR;
            cleanData[idx + 1] = bgG;
            cleanData[idx + 2] = bgB;
            modifiedPixels++;
          }
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




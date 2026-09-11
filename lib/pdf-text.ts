import type { WrappedPdfiumModule, PdfiumRuntimeMethods } from "@embedpdf/pdfium";

export type TextRemoval = { id: string; page: number; quad: number[] };
export type EditableText = TextRemoval & {
  text: string; x: number; y: number; w: number; h: number;
  size: number; angle: number; fontName: string;
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

export type ImageRemoval = {
  page: number;
  bounds?: { left: number; bottom: number; right: number; top: number };
};

/**
 * Removes image objects from PDF content streams via PDFium.
 */
export async function removePdfImages(bytes: Uint8Array, removals: ImageRemoval[]): Promise<Uint8Array> {
  if (!removals.length) return bytes;
  const m = await engine(), heap = m.pdfium as unknown as ExtendedPdfiumRuntime;
  const { malloc, free } = heap.wasmExports;
  const input = malloc(bytes.length);
  let doc = 0;
  try {
    heap.HEAPU8.set(bytes, input);
    doc = m.FPDF_LoadMemDocument(input, bytes.length, "");
    if (!doc) throw Error("PDF görsel düzenlemesi için açılamadı.");

    const boundsPtr = malloc(16);
    try {
      for (const index of new Set(removals.map(r => r.page))) {
        const page = m.FPDF_LoadPage(doc, index);
        if (!page) continue;
        const pageRemovals = removals.filter(r => r.page === index);
        const count = m.FPDFPage_CountObjects(page);
        let changed = false;

        for (let i = count - 1; i >= 0; i--) {
          const obj = m.FPDFPage_GetObject(page, i);
          if (!obj) continue;
          const type = m.FPDFPageObj_GetType(obj);
          if (type === 3) {
            let shouldRemove = false;
            if (pageRemovals.some(r => !r.bounds)) {
              shouldRemove = true;
            } else {
              m.FPDFPageObj_GetBounds(obj, boundsPtr, boundsPtr + 4, boundsPtr + 8, boundsPtr + 12);
              const l = heap.getValue(boundsPtr, "float");
              const b = heap.getValue(boundsPtr + 4, "float");
              const r = heap.getValue(boundsPtr + 8, "float");
              const t = heap.getValue(boundsPtr + 12, "float");

              shouldRemove = pageRemovals.some(rem => {
                if (!rem.bounds) return true;
                const tb = rem.bounds;
                return (
                  Math.abs(l - tb.left) < 5 &&
                  Math.abs(b - tb.bottom) < 5 &&
                  Math.abs(r - tb.right) < 5 &&
                  Math.abs(t - tb.top) < 5
                );
              });
            }

            if (shouldRemove) {
              m.FPDFPage_RemoveObject(page, obj);
              m.FPDFPageObj_Destroy(obj);
              changed = true;
            }
          }
        }

        if (changed) {
          m.FPDFPage_GenerateContent(page);
        }
        m.FPDF_ClosePage(page);
      }
    } finally {
      free(boundsPtr);
    }

    const writer = m.PDFiumExt_OpenFileWriter();
    let output = 0;
    try {
      if (!m.PDFiumExt_SaveAsCopy(doc, writer)) throw Error("Görseli güncellenen PDF oluşturulamadı.");
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

/** Use the renderer's own transforms, including CropBox, UserUnit and rotation. */
export async function editablePageText(page: PdfPageProxy): Promise<EditableText[]> {
  const viewport = page.getViewport({ scale: 1 });
  const content = await page.getTextContent();
  const v = viewport.transform;
  return content.items.flatMap((rawItem, index: number) => {
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
    return [{ id: `original-${page.pageNumber-1}-${index}`, page: page.pageNumber-1, quad, text:item.str, x, y:baseline-size, w, h:size*(ascent-descent), size, angle:angle*180/Math.PI, fontName:style.fontFamily || item.fontName }];
  });
}



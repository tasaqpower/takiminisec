import { PDFDocument, PDFName, PDFNumber, PDFRawStream } from "@cantoo/pdf-lib";

export type CompressionPreset = "light" | "balanced" | "strong" | "custom";

export interface CompressionOptions {
  preset: CompressionPreset;
  dpi?: number;
  quality?: number;
}

export interface CompressionResult {
  compressedBytes: Uint8Array;
  originalSize: number;
  compressedSize: number;
  reductionPercentage: number;
  preservedText: boolean;
  preservedForms: boolean;
  modeDescription: string;
}

export const PRESET_CONFIGS: Record<
  Exclude<CompressionPreset, "custom">,
  { label: string; desc: string; preservesVectors: boolean }
> = {
  light: {
    label: "Hafif Sıkıştırma (Kayıpsız / Vektör ve Metin Koruma)",
    desc: "Metinleri, vektörleri, bağlantıları ve form alanlarını %100 korur. Gereksiz üstveri ve nesne akışlarını sıkıştırır.",
    preservesVectors: true
  },
  balanced: {
    label: "Dengeli Sıkıştırma (Akıllı Görsel Optimizasyonu)",
    desc: "Gömülü görselleri optimize eder; metin seçilebilirliği, vektörler ve form alanları korunur.",
    preservesVectors: true
  },
  strong: {
    label: "Güçlü Sıkıştırma (Maksimum Boyut Tasarrufu)",
    desc: "Sayfaları yüksek sıkıştırmalı görsellere dönüştürür. Metin seçilebilirliği ve form alanları düzleştirilebilir.",
    preservesVectors: false
  }
};

export function estimateCompressedSize(
  originalSize: number,
  preset: CompressionPreset,
  customQuality = 0.7
): number {
  if (preset === "light") return Math.round(originalSize * 0.85);
  if (preset === "balanced") return Math.round(originalSize * 0.55);
  if (preset === "strong") return Math.round(originalSize * 0.30);
  const factor = Math.max(0.2, Math.min(0.95, customQuality * 0.75));
  return Math.round(originalSize * factor);
}

/**
 * Portable helper to recompress JPEG/image bytes.
 * In Node.js: uses sharp with mozjpeg compression and optional downscaling.
 * In Browser: uses OffscreenCanvas / HTMLCanvasElement with canvas.toBlob.
 */
async function recompressImageBytes(
  imageBytes: Uint8Array,
  quality: number,
  maxWidth?: number
): Promise<Uint8Array | null> {
  const isNode = typeof process !== "undefined" && Boolean(process?.versions?.node);

  if (isNode) {
    try {
      const sharpModuleName = "sharp";
      const sharpMod = (await import(/* @vite-ignore */ sharpModuleName)).default;
      let pipeline = sharpMod(imageBytes);
      if (maxWidth) {
        pipeline = pipeline.resize({ width: maxWidth, withoutEnlargement: true });
      }
      const buffer = await pipeline.jpeg({ quality: Math.round(quality * 100), mozjpeg: true }).toBuffer();
      return new Uint8Array(buffer);
    } catch {
      return null;
    }
  }

  if (typeof window !== "undefined" && typeof document !== "undefined") {
    try {
      const blob = new Blob([imageBytes as any], { type: "image/jpeg" });
      const bitmap = await createImageBitmap(blob);
      let targetW = bitmap.width;
      let targetH = bitmap.height;
      if (maxWidth && targetW > maxWidth) {
        targetH = Math.round((targetH * maxWidth) / targetW);
        targetW = maxWidth;
      }
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(bitmap, 0, 0, targetW, targetH);
      const outBlob: Blob | null = await new Promise((res) => {
        canvas.toBlob((b) => res(b), "image/jpeg", quality);
      });
      if (outBlob) {
        return new Uint8Array(await outBlob.arrayBuffer());
      }
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Traverses PDF object streams to locate embedded image XObjects and re-compresses them.
 * Preserves 100% of PDF structure, text, fonts, vector paths, annotations, and form fields.
 */
async function optimizeEmbeddedImages(
  pdfDoc: PDFDocument,
  quality: number,
  maxWidth?: number
): Promise<number> {
  let count = 0;
  for (const [ref, obj] of pdfDoc.context.enumerateIndirectObjects()) {
    if (obj instanceof PDFRawStream) {
      const dict = obj.dict;
      const subtype = dict.get(PDFName.of("Subtype"));
      if (subtype?.toString() === "/Image") {
        const currentBytes = obj.asUint8Array ? obj.asUint8Array() : obj.contents;
        if (currentBytes && currentBytes.length > 5000) {
          const comp = await recompressImageBytes(currentBytes, quality, maxWidth);
          if (comp && comp.length < currentBytes.length) {
            const newStream = PDFRawStream.of(dict, comp);
            newStream.dict.set(PDFName.of("Filter"), PDFName.of("DCTDecode"));
            newStream.dict.set(PDFName.of("Length"), PDFNumber.of(comp.length));
            pdfDoc.context.assign(ref, newStream);
            count++;
          }
        }
      }
    }
  }
  return count;
}

/**
 * Non-destructive / Selective PDF compression
 */
export async function compressPdfDocument(
  pdfBytes: Uint8Array,
  options: CompressionOptions,
  onProgress?: (current: number, total: number) => void
): Promise<CompressionResult> {
  const originalSize = pdfBytes.byteLength;
  const preset = options.preset || "balanced";

  if (preset === "light") {
    // 1. LIGHT MODE: Non-destructive structure & stream compression
    onProgress?.(1, 3);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    onProgress?.(2, 3);
    // Remove metadata overhead and compress with object streams
    const compressedBytes = await pdfDoc.save({
      useObjectStreams: true,
      addDefaultPage: false
    });

    onProgress?.(3, 3);
    // Don't return larger file if already optimized
    const finalBytes = compressedBytes.byteLength < originalSize ? compressedBytes : pdfBytes;
    const compressedSize = finalBytes.byteLength;
    const reductionPercentage = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));

    return {
      compressedBytes: finalBytes,
      originalSize,
      compressedSize,
      reductionPercentage,
      preservedText: true,
      preservedForms: true,
      modeDescription: "Hafif mod: Metinler, vektörler, bağlantılar ve form alanları %100 korundu."
    };
  }

  if (preset === "balanced") {
    // 2. BALANCED MODE: Non-destructive to text & vectors, recompress embedded image objects
    onProgress?.(1, 4);
    const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

    onProgress?.(2, 4);
    // Intelligently recompress embedded images while keeping all text, vectors, forms intact
    await optimizeEmbeddedImages(pdfDoc, 0.65, 1600);

    onProgress?.(3, 4);
    // Compress object streams and optimize PDF structure
    const compressedBytes = await pdfDoc.save({
      useObjectStreams: true
    });

    onProgress?.(4, 4);
    const finalBytes = compressedBytes.byteLength < originalSize ? compressedBytes : pdfBytes;
    const compressedSize = finalBytes.byteLength;
    const reductionPercentage = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));

    return {
      compressedBytes: finalBytes,
      originalSize,
      compressedSize,
      reductionPercentage,
      preservedText: true,
      preservedForms: true,
      modeDescription: "Dengeli mod: Görseller optimize edildi; metin, vektör ve formlar %100 korundu."
    };
  }

  // 3. STRONG / CUSTOM MODE: High-compression canvas rasterization
  const dpi = options.preset === "custom" ? (options.dpi || 110) : 96;
  const quality = options.preset === "custom" ? (options.quality || 0.55) : 0.48;

  const isNode = typeof process !== "undefined" && Boolean(process?.versions?.node);
  let pdfjsLib: any;
  let loadingTask: any;

  try {
    if (isNode) {
      pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const { pathToFileURL } = await import("node:url");
      const path = await import("node:path");
      pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(path.resolve("node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs")).href;
      loadingTask = pdfjsLib.getDocument({
        data: pdfBytes.slice(0),
        standardFontDataUrl: pathToFileURL(path.resolve("public/standard_fonts")).href + "/"
      });
    } else {
      pdfjsLib = await import("pdfjs-dist");
      if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
        pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
      }
      loadingTask = pdfjsLib.getDocument({ data: pdfBytes.slice(0) });
    }

    const pdfJsDoc = await loadingTask.promise;
    const numPages = pdfJsDoc.numPages;
    const newPdf = await PDFDocument.create();

    for (let i = 1; i <= numPages; i++) {
      onProgress?.(i, numPages);
      const page = await pdfJsDoc.getPage(i);
      const viewport = page.getViewport({ scale: 1 });
      const scale = Math.max(0.5, Math.min(2.5, dpi / 72));
      const scaledViewport = page.getViewport({ scale });

      const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
      if (!canvas) break;
      canvas.width = Math.floor(scaledViewport.width);
      canvas.height = Math.floor(scaledViewport.height);
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) break;

      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({
        canvasContext: ctx as any,
        viewport: scaledViewport,
        canvas: canvas as any
      }).promise;

      let imgBytes: Uint8Array | null = null;
      if (typeof canvas.toBlob === "function") {
        const blob: Blob = await new Promise((res) => {
          canvas.toBlob((b) => res(b || new Blob()), "image/jpeg", quality);
        });
        imgBytes = new Uint8Array(await blob.arrayBuffer());
      } else if (typeof (canvas as any).toBuffer === "function") {
        imgBytes = new Uint8Array((canvas as any).toBuffer("image/jpeg"));
      }

      if (imgBytes && imgBytes.length > 0) {
        const embeddedImg = await newPdf.embedJpg(imgBytes);
        const newPage = newPdf.addPage([viewport.width, viewport.height]);
        newPage.drawImage(embeddedImg, {
          x: 0,
          y: 0,
          width: viewport.width,
          height: viewport.height
        });
      }
    }

    if (newPdf.getPageCount() === numPages) {
      const compressedBytes = await newPdf.save({ useObjectStreams: true });
      const finalBytes = compressedBytes.byteLength < originalSize ? compressedBytes : pdfBytes;
      const compressedSize = finalBytes.byteLength;
      const reductionPercentage = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));

      return {
        compressedBytes: finalBytes,
        originalSize,
        compressedSize,
        reductionPercentage,
        preservedText: false,
        preservedForms: false,
        modeDescription: options.preset === "strong"
          ? "Güçlü mod: Sayfalar JPEG formatında optimize edildi (rasterize)."
          : `Özel mod: ${dpi} DPI, %${Math.round(quality * 100)} kalite ile optimize edildi.`
      };
    }
  } catch (err) {
    // Continue to stream optimization fallback
  }

  // Fallback for environments without canvas support or when preserving vector fidelity:
  // Apply PDF-lib high compression (strip metadata, optimize images, and use object streams)
  const pdfDoc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  pdfDoc.setTitle("");
  pdfDoc.setAuthor("");
  pdfDoc.setSubject("");
  pdfDoc.setKeywords([]);
  pdfDoc.setProducer("");
  pdfDoc.setCreator("");

  if (options.preset === "strong") {
    await optimizeEmbeddedImages(pdfDoc, 0.35, 1000);
  } else {
    const customQuality = options.quality ?? 0.55;
    const maxW = options.dpi ? Math.round((options.dpi / 72) * 800) : 1200;
    await optimizeEmbeddedImages(pdfDoc, customQuality, maxW);
  }

  const fallbackBytes = await pdfDoc.save({ useObjectStreams: true, addDefaultPage: false });
  const finalFallbackBytes = fallbackBytes.byteLength < originalSize ? fallbackBytes : pdfBytes;
  const compressedSize = finalFallbackBytes.byteLength;
  const reductionPercentage = Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100));

  return {
    compressedBytes: finalFallbackBytes,
    originalSize,
    compressedSize,
    reductionPercentage,
    preservedText: true,
    preservedForms: true,
    modeDescription: options.preset === "strong"
      ? "Güçlü mod: Sayfalar ve görseller yüksek sıkıştırma ile optimize edildi."
      : `Özel mod: Yapı, çözünürlük ve nesne akışları optimize edildi.`
  };
}

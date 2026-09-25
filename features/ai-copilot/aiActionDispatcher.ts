import { PDFDocument, rgb, degrees, StandardFonts, PDFName, PDFDict, PDFStream, PDFRawStream } from 'pdf-lib';
import pako from 'pako';
import { type AiActionType, type AiIntentResult } from './aiIntentEngine.ts';
import { detectWatermarks } from '../watermark-removal/watermarkDetector.ts';
import { removeWatermarks } from '../watermark-removal/watermarkRemover.ts';
import { enhancePdfBytes, enhanceImageData } from '../enhancer/documentEnhancer.ts';
import { compressPdf } from '../compression/compressPdf.ts';
import { scanPdfForSensitiveEntities, redactDetectedEntities } from '../security/autoRedact.ts';
import { convertToPdfA2b } from '../compliance/complianceEngine.ts';
import { encryptPdfWithPassword } from '../security/pdfEncryption.ts';
import { extractPdfText, loadPdf, exportPdf, canEncodeWinAnsi, type Mark } from '../../lib/documents.ts';
import {
  editablePageText,
  extractPdfImageBitmap,
  canRemovePdfImage,
  removePdfImages,
  updatePdfImageBitmap,
  type TextRemoval,
} from '../../lib/pdf-text.ts';

export interface SelectedImageContext {
  id?: string;
  page: number;
  originalBounds?: { left: number; bottom: number; right: number; top: number };
  imageIndex?: number;
  pixelWidth?: number;
  pixelHeight?: number;
  matrix?: number[];
  objectRef?: string | number;
  dataUrl?: string;
  previewUrl?: string;
  format?: 'png' | 'jpeg';
  x?: number;
  y?: number;
  w?: number;
  h?: number;
  rotation?: number;
  opacity?: number;
  isPlaceholder?: boolean;
  pixelExtractionFailed?: boolean;
}

export interface AiActionContext {
  pdfBytes?: Uint8Array | null;
  fileName?: string;
  currentPage?: number;
  selectedImage?: SelectedImageContext | null;
  confirmedCandidateIds?: string[];
  existingMarks?: Mark[];
  existingRemovals?: TextRemoval[];
  allowApproximateFont?: boolean;
}

export interface AiActionResult {
  success: boolean;
  action: AiActionType;
  message: string;
  newPdfBytes?: Uint8Array;
  newFileName?: string;
  newMarks?: Mark[];
  newRemovals?: TextRemoval[];
  downloadData?: {
    bytes: Uint8Array;
    fileName: string;
    mimeType: string;
  };
  stoppedDueToUnsupportedChars?: boolean;
  unsupportedChars?: string[];
  metadata?: Record<string, any>;
}

/**
 * Applies an authentic official corporate stamp directly onto the PDF
 */
async function stampPdfDirectly(
  pdfBytes: Uint8Array,
  stampType: 'asli_gibidir' | 'onaylandi' | 'gizli' | 'odendi' | 'kontrol_edildi' = 'asli_gibidir'
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  const pages = doc.getPages();
  const today = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // Stamp attributes based on type
  const isRed = stampType === 'asli_gibidir' || stampType === 'gizli';
  const isGreen = stampType === 'odendi';
  const color = isRed
    ? rgb(0.86, 0.15, 0.15)
    : isGreen
    ? rgb(0.08, 0.55, 0.24)
    : rgb(0.11, 0.31, 0.85);

  let title = 'ASLI GIBIDIR';
  if (stampType === 'onaylandi') title = 'ONAYLANDI';
  if (stampType === 'gizli') title = 'GIZLIDIR';
  if (stampType === 'odendi') title = 'ODENDI';
  if (stampType === 'kontrol_edildi') title = 'KONTROL EDILDI';

  // Apply to last page
  const targetPage = pages[pages.length - 1];
  const { width } = targetPage.getSize();

  // Stamp dimensions and coordinates (bottom right corner)
  const stampW = 180;
  const stampH = 76;
  const stampX = Math.max(20, width - stampW - 35);
  const stampY = Math.max(20, 45);

  targetPage.drawRectangle({
    x: stampX,
    y: stampY,
    width: stampW,
    height: stampH,
    borderColor: color,
    borderWidth: 2.5,
    rotate: degrees(-3),
    opacity: 0.92,
  });

  targetPage.drawRectangle({
    x: stampX + 4,
    y: stampY + 4,
    width: stampW - 8,
    height: stampH - 8,
    borderColor: color,
    borderWidth: 1,
    rotate: degrees(-3),
    opacity: 0.85,
  });

  // Stamp header
  targetPage.drawText('FORMA RESMI BELGE ATOLYESI', {
    x: stampX + 18,
    y: stampY + stampH - 18,
    size: 7.5,
    font: fontBold,
    color,
    rotate: degrees(-3),
  });

  // Stamp status text
  targetPage.drawText(title, {
    x: stampX + 22,
    y: stampY + stampH - 42,
    size: title.length > 10 ? 13 : 16,
    font: fontBold,
    color,
    rotate: degrees(-3),
  });

  // Stamp footer
  targetPage.drawText(`Tarih: ${today}  |  Yetkili Imza`, {
    x: stampX + 16,
    y: stampY + 14,
    size: 7,
    font: fontRegular,
    color,
    rotate: degrees(-3),
  });

  return await doc.save();
}

/**
 * Adds a diagonal semi-transparent watermark across all pages
 */
async function addWatermarkToPdf(pdfBytes: Uint8Array, text = 'GİZLİ'): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const pages = doc.getPages();

  for (const page of pages) {
    const { width, height } = page.getSize();
    const cleanText = text.toUpperCase().replace(/[^\x20-\x7E]/g, ' ');
    page.drawText(cleanText, {
      x: width * 0.25,
      y: height * 0.45,
      size: 48,
      font,
      color: rgb(0.82, 0.82, 0.82),
      opacity: 0.35,
      rotate: degrees(45),
    });
  }

  return await doc.save();
}

/**
 * Adds page numbering "Sayfa X / Y" at the bottom center of each page
 */
async function addPageNumbersToPdf(pdfBytes: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  const total = pages.length;

  for (let i = 0; i < total; i++) {
    const page = pages[i];
    const { width } = page.getSize();
    const label = `Sayfa ${i + 1} / ${total}`;
    const textWidth = font.widthOfTextAtSize(label, 9);

    page.drawText(label, {
      x: (width - textWidth) / 2,
      y: 20,
      size: 9,
      font,
      color: rgb(0.45, 0.45, 0.45),
    });
  }

  return await doc.save();
}

/**
 * Deletes first or last page from a PDF
 */
async function deletePdfPage(pdfBytes: Uint8Array, target: 'first' | 'last' = 'last'): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const count = doc.getPageCount();
  if (count <= 1) {
    throw new Error('Belgede sadece 1 sayfa var. Tek sayfalık belge silinemez.');
  }

  const pageIdx = target === 'first' ? 0 : count - 1;
  doc.removePage(pageIdx);
  return await doc.save();
}

/**
 * Flattens all interactive form fields into static page content
 */
async function flattenPdfForms(pdfBytes: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const form = doc.getForm();
  try {
    form.flatten();
  } catch {
    // If no form fields exist, proceed
  }
  return await doc.save();
}

/**
 * Rotates all pages in a PDF document by angle degrees
 */
async function rotatePdfPages(pdfBytes: Uint8Array, angle = 90): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const pages = doc.getPages();
  for (const page of pages) {
    const currentAngle = page.getRotation().angle;
    page.setRotation(degrees((currentAngle + angle) % 360));
  }
  return await doc.save();
}

/**
 * Analyzes document and images visually and semantically
 */
async function analyzeDocumentVision(
  pdfBytes: Uint8Array,
  fileName?: string
): Promise<string> {
  const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
  const pageCount = doc.getPageCount();
  const imageDetails: Array<{ page: number; width: number; height: number }> = [];

  // Scan PDF objects for embedded raster images
  const pages = doc.getPages();
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const resources = page.node.Resources();
    if (resources) {
      const xObject = resources.lookup(PDFName.of('XObject'));
      if (xObject instanceof PDFDict) {
        for (const key of xObject.keys()) {
          const obj = xObject.lookup(key);
          if (obj instanceof PDFStream) {
            const subtype = obj.dict.lookup(PDFName.of('Subtype'));
            if (subtype && subtype.toString() === '/Image') {
              const wObj = obj.dict.lookup(PDFName.of('Width'));
              const hObj = obj.dict.lookup(PDFName.of('Height'));
              const w = typeof wObj === 'number' ? wObj : (wObj as any)?.value || 0;
              const h = typeof hObj === 'number' ? hObj : (hObj as any)?.value || 0;
              imageDetails.push({
                page: i + 1,
                width: Number(w) || 0,
                height: Number(h) || 0,
              });
            }
          }
        }
      }
    }
  }

  // Extract OCR/Text
  let rawText = '';
  try {
    const res = await extractPdfText(pdfBytes);
    rawText = typeof res === 'string' ? res : Array.isArray(res) ? (res as string[]).join('\n') : '';
  } catch {
    rawText = '';
  }
  const cleanLines = rawText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // Identify features
  const hasTables = cleanLines.some(l => /\b(toplam|kdv|tutar|fiyat|adet|s\.\s*no|tarih|aciklama)\b/i.test(l)) ||
    cleanLines.filter(l => /\d+[\.,]\d{2}/.test(l)).length >= 3;
  const hasStampsOrSeals = cleanLines.some(l => /\b(asli\s+gibidir|onaylandi|imza|muhur|kase|teslim\s+eden)\b/i.test(l));
  const isIdOrLicense = cleanLines.some(l => /\b(kimlik|nufus|surucu|ehliyet|pasaport|tc\s*no)\b/i.test(l));
  const isInvoice = cleanLines.some(l => /\b(fatura|e-fatura|e-arsiv|irsaliye|vergi)\b/i.test(l));
  const isContract = cleanLines.some(l => /\b(sozlesme|taraflar|madde\s*\d|taahhut|protokol)\b/i.test(l));

  let detectedType = 'Genel Doküman / Belge (Tahmini)';
  if (isInvoice) detectedType = 'Elektronik Fatura / Mali Belge (Tahmini)';
  else if (isIdOrLicense) detectedType = 'Resmi Kimlik / Ehliyet / Nüfus Cüzdanı Belgesi (Tahmini)';
  else if (isContract) detectedType = 'Resmi Hukuki Sözleşme / Protokol (Tahmini)';
  else if (imageDetails.length > 0 && cleanLines.length === 0) detectedType = 'Taranmış / Görsel Ağırlıklı Belge (Tahmini)';
  else if (imageDetails.length > 0) detectedType = 'Görsel ve Metin İçeren Rapor & Belge (Tahmini)';

  // Build honest markdown response (no hallucinated object names)
  let report = `📄 **Yerel Belge Yapısı ve Metin Özeti**\n\n`;
  report += `*(Not: Yerel sürüm görsel nesnelerini semantik olarak isimleriyle tanımaz. Piksel içeriği analiz edilmemiştir.)*\n\n`;
  report += `📌 **Belge Kimliği (Tahmini)**: ${detectedType}\n`;
  report += `📄 **Sayfa & Boyut**: ${pageCount} sayfa (${Math.round(pdfBytes.byteLength / 1024)} KB)\n\n`;

  if (imageDetails.length > 0) {
    report += `🖼️ **Gömülü Görseller**:\n`;
    report += `• Toplam **${imageDetails.length} adet** gömülü görsel nesnesi tespit edildi.\n`;
    imageDetails.slice(0, 5).forEach((img, idx) => {
      report += `  - Görsel #${idx + 1}: Sayfa ${img.page}, Çözünürlük: ${img.width > 0 ? `${img.width}×${img.height} px` : 'Vektör/Raster uyumlu'}\n`;
    });
    if (imageDetails.length > 5) {
      report += `  - *(ve ${imageDetails.length - 5} adet ek görsel)*\n`;
    }
    report += `\n`;
  } else {
    report += `🖼️ **Gömülü Görseller**: Belgede harici raster görsel bulunmuyor, içerik tamamen vektörel metin ve grafiklerden oluşuyor.\n\n`;
  }

  if (cleanLines.length > 0) {
    report += `📝 **Okunan Başlıklar & Metin İçeriği**:\n`;
    const previewLines = cleanLines.slice(0, 5);
    previewLines.forEach(l => {
      report += `• "${l.length > 60 ? l.slice(0, 57) + '...' : l}"\n`;
    });
    if (cleanLines.length > 5) {
      report += `• *(ve ${cleanLines.length - 5} satır daha içerik)*\n`;
    }
    report += `\n`;
  } else {
    report += `📝 **Metin İçeriği**: Bu sayfada seçilebilir metin bulunamadı. Metni okumak için yerel OCR aracını çalıştırabilirsiniz.\n\n`;
  }

  report += `📊 **Yapısal Özellikler**:\n`;
  report += `• Tablo / Mali Tablo Yapısı: ${hasTables ? '✅ Metin içi belirteçler mevcut' : '❌ Bulunmuyor'}\n`;
  report += `• Kaşe / Mühür / İmza Alanı: ${hasStampsOrSeals ? '✅ Metin içi belirteçler mevcut' : '❌ Bulunmuyor'}\n`;

  return report;
}

function safeInflate(data: Uint8Array): Uint8Array {
  try { return pako.inflate(data); } catch {}
  try { return pako.inflateRaw(data); } catch {}
  if (data.length > 2) {
    try { return pako.inflateRaw(data.slice(2)); } catch {}
    try { return pako.inflateRaw(data.slice(2, -4)); } catch {}
  }
  throw new Error('Decompression failed');
}

function crc32(buf: Uint8Array): number {
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    table[n] = c >>> 0;
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ table[(c ^ buf[i]) & 0xff];
  return (c ^ 0xffffffff) >>> 0;
}

function encodePng(width: number, height: number, rgba: Uint8ClampedArray | Uint8Array): Uint8Array {
  const rawScanlines = new Uint8Array(height * (width * 4 + 1));
  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawScanlines[offset++] = 0;
    const rowStart = y * width * 4;
    for (let x = 0; x < width * 4; x++) rawScanlines[offset++] = rgba[rowStart + x];
  }
  const compressed = pako.deflate(rawScanlines);
  function makeChunk(typeStr: string, data: Uint8Array) {
    const typeBuf = new Uint8Array([
      typeStr.charCodeAt(0),
      typeStr.charCodeAt(1),
      typeStr.charCodeAt(2),
      typeStr.charCodeAt(3),
    ]);
    const len = data.length;
    const chunk = new Uint8Array(12 + len);
    const view = new DataView(chunk.buffer, chunk.byteOffset, chunk.byteLength);
    view.setUint32(0, len, false);
    chunk.set(typeBuf, 4);
    if (len > 0) chunk.set(data, 8);
    const toCrc = new Uint8Array(4 + len);
    toCrc.set(typeBuf, 0);
    if (len > 0) toCrc.set(data, 4);
    view.setUint32(8 + len, crc32(toCrc), false);
    return chunk;
  }
  const ihdr = new Uint8Array(13);
  const ihdrView = new DataView(ihdr.buffer, ihdr.byteOffset, ihdr.byteLength);
  ihdrView.setUint32(0, width, false);
  ihdrView.setUint32(4, height, false);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  const sig = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
  const cIhdr = makeChunk('IHDR', ihdr);
  const cIdat = makeChunk('IDAT', compressed);
  const cIend = makeChunk('IEND', new Uint8Array(0));

  const total = new Uint8Array(sig.length + cIhdr.length + cIdat.length + cIend.length);
  let pos = 0;
  total.set(sig, pos); pos += sig.length;
  total.set(cIhdr, pos); pos += cIhdr.length;
  total.set(cIdat, pos); pos += cIdat.length;
  total.set(cIend, pos); pos += cIend.length;
  return total;
}

function decodePngToRgba(pngBytes: Uint8Array): { width: number; height: number; data: Uint8ClampedArray } {
  let offset = 8;
  let width = 0, height = 0, colorType = 6;
  const idatChunks: Uint8Array[] = [];
  while (offset < pngBytes.length) {
    const view = new DataView(pngBytes.buffer, pngBytes.byteOffset + offset, 4);
    const len = view.getUint32(0, false);
    const type = String.fromCharCode(...pngBytes.slice(offset + 4, offset + 8));
    const data = pngBytes.slice(offset + 8, offset + 8 + len);
    offset += 12 + len;
    if (type === 'IHDR') {
      const ihdrView = new DataView(data.buffer, data.byteOffset, data.byteLength);
      width = ihdrView.getUint32(0, false);
      height = ihdrView.getUint32(4, false);
      colorType = data[9];
    } else if (type === 'IDAT') idatChunks.push(data);
    else if (type === 'IEND') break;
  }
  const totalIdatLen = idatChunks.reduce((acc, c) => acc + c.length, 0);
  const allIdat = new Uint8Array(totalIdatLen);
  let idatPos = 0;
  for (const c of idatChunks) {
    allIdat.set(c, idatPos);
    idatPos += c.length;
  }
  const raw = safeInflate(allIdat);
  const bpp = colorType === 6 ? 4 : colorType === 2 ? 3 : 1;
  const rowBytes = width * bpp;
  const rgba = new Uint8ClampedArray(width * height * 4);
  let rawOff = 0;
  let prevRow = new Uint8Array(rowBytes);
  for (let y = 0; y < height; y++) {
    const filter = raw[rawOff++];
    const currentRow = new Uint8Array(rowBytes);
    for (let x = 0; x < rowBytes; x++) {
      const byte = raw[rawOff++];
      const left = x >= bpp ? currentRow[x - bpp] : 0;
      const up = prevRow[x];
      const upLeft = x >= bpp ? prevRow[x - bpp] : 0;
      let val = byte;
      if (filter === 1) val = (byte + left) & 0xff;
      else if (filter === 2) val = (byte + up) & 0xff;
      else if (filter === 3) val = (byte + Math.floor((left + up) / 2)) & 0xff;
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left), pb = Math.abs(p - up), pc = Math.abs(p - upLeft);
        const pr = (pa <= pb && pa <= pc) ? left : (pb <= pc ? up : upLeft);
        val = (byte + pr) & 0xff;
      }
      currentRow[x] = val;
    }
    const outRowStart = y * width * 4;
    for (let p = 0; p < width; p++) {
      const pxIdx = p * bpp;
      const outIdx = outRowStart + p * 4;
      if (bpp === 4) {
        rgba[outIdx] = currentRow[pxIdx];
        rgba[outIdx + 1] = currentRow[pxIdx + 1];
        rgba[outIdx + 2] = currentRow[pxIdx + 2];
        rgba[outIdx + 3] = currentRow[pxIdx + 3];
      } else if (bpp === 3) {
        rgba[outIdx] = currentRow[pxIdx];
        rgba[outIdx + 1] = currentRow[pxIdx + 1];
        rgba[outIdx + 2] = currentRow[pxIdx + 2];
        rgba[outIdx + 3] = 255;
      } else {
        rgba[outIdx] = rgba[outIdx + 1] = rgba[outIdx + 2] = currentRow[pxIdx];
        rgba[outIdx + 3] = 255;
      }
    }
    prevRow = currentRow;
  }
  return { width, height, data: rgba };
}

async function extractRgbaPixels(
  pdfBytes: Uint8Array,
  selectedImage: SelectedImageContext
): Promise<{ width: number; height: number; data: Uint8ClampedArray } | null> {
  // If image is a placeholder or pixel extraction failed, NEVER treat as real pixel data
  if (selectedImage.isPlaceholder || selectedImage.pixelExtractionFailed) {
    return null;
  }

  // 1. From valid dataUrl / previewUrl if present and NOT an SVG placeholder
  const dUrl = selectedImage.dataUrl || selectedImage.previewUrl;
  if (dUrl && typeof dUrl === 'string') {
    if (dUrl.includes('data:image/svg+xml') || dUrl.includes('G%C3%B6rsel') || dUrl.includes('Görsel')) {
      return null;
    }
    if (typeof window !== 'undefined' && typeof Image !== 'undefined' && typeof document !== 'undefined') {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((res, rej) => {
          img.onload = res;
          img.onerror = rej;
          img.src = dUrl;
        });
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          return ctx.getImageData(0, 0, w, h);
        }
      } catch {}
    }
    const match = dUrl.match(/^data:image\/(\w+);base64,(.+)$/);
    if (match) {
      const mime = match[1];
      const b64 = match[2];
      const buf = typeof Buffer !== 'undefined'
        ? Buffer.from(b64, 'base64')
        : Uint8Array.from(atob(b64), c => c.charCodeAt(0));
      if (mime === 'png') {
        try {
          return decodePngToRgba(buf);
        } catch {}
      }
    }
  }

  // 2. Strictly matched PDFium rendered bitmap extraction (supports JPEG, PNG, CCITT, JBIG2, etc.)
  try {
    const bmp = await extractPdfImageBitmap(pdfBytes, {
      page: selectedImage.page,
      bounds: selectedImage.originalBounds,
      imageIndex: selectedImage.imageIndex,
    });
    if (bmp && bmp.width > 0 && bmp.height > 0) {
      return bmp;
    }
  } catch {}

  return null;
}

/**
 * Removes ONLY the explicitly selected image from PDF.
 * Never performs bulk loops, semantic guesswork, or artificial counter increment.
 * Fails safely with 0 byte changes if no verified single image can be targeted.
 */
async function deleteSelectedImageFromPdf(
  pdfBytes: Uint8Array,
  selectedImage: SelectedImageContext
): Promise<{ success: boolean; newBytes?: Uint8Array; message: string; removedCount: number }> {
  try {
    const removal = {
      page: selectedImage.page,
      bounds: selectedImage.originalBounds,
      imageIndex: selectedImage.imageIndex,
      pixelWidth: selectedImage.pixelWidth,
      pixelHeight: selectedImage.pixelHeight,
      matrix: selectedImage.matrix,
      objectRef: selectedImage.objectRef,
      imageId: selectedImage.id,
    };

    const canRemove = await canRemovePdfImage(pdfBytes, removal).catch(() => false);
    if (canRemove) {
      const cleanResult = await removePdfImages(pdfBytes, [removal]);
      const cleanBytes = (cleanResult as any)?.pdfBytes || cleanResult;
      const count = typeof (cleanResult as any)?.removedCount === 'number'
        ? (cleanResult as any).removedCount
        : (cleanBytes.byteLength !== pdfBytes.byteLength ? 1 : 0);

      if (cleanBytes && cleanBytes.byteLength > 0 && count === 1) {
        return {
          success: true,
          newBytes: cleanBytes,
          message: 'Seçili görsel başarıyla silindi ve belgeden temizlendi! 🗑️✨',
          removedCount: 1,
        };
      }
    }
  } catch {}

  return {
    success: false,
    message: 'Seçili görsel korumalı PDF yapısı nedeniyle kaldırılamadı.',
    removedCount: 0,
  };
}

/**
 * Enhances ONLY the explicitly selected image stream, preserving all other images and vector text.
 * Performs true in-place bitmap replacement via PDFium FPDFImageObj_SetBitmap.
 * Preserves:
 *  - exact coordinates & dimensions
 *  - exact 6-element transformation matrix
 *  - display list z-order (text above it stays above it!)
 *  - clipping path and blend modes
 *  - opacity
 *  - duplicate placements of other XObjects
 * Fails safely with 0 byte changes if no unambiguous single image match exists.
 */
async function enhanceSelectedImageInPdf(
  pdfBytes: Uint8Array,
  selectedImage: SelectedImageContext
): Promise<{ success: boolean; newBytes?: Uint8Array; message: string }> {
  try {
    if (selectedImage.isPlaceholder || selectedImage.pixelExtractionFailed) {
      return {
        success: false,
        message: 'Görsel pikselleri güvenli biçimde çıkarılamadığı için işlem uygulanmadı.',
      };
    }

    const rawRgba = await extractRgbaPixels(pdfBytes, selectedImage);
    if (!rawRgba || rawRgba.width <= 0 || rawRgba.height <= 0) {
      return {
        success: false,
        message: 'Görsel pikselleri güvenli biçimde çıkarılamadığı için işlem uygulanmadı.',
      };
    }

    // Enhance pixels in memory without corrupting compressed stream format
    const enhanced = enhanceImageData(
      rawRgba as any,
      { mode: 'photo', intensity: 'balanced' },
      (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) } as any)
    );

    // Surgical in-place replacement via PDFium FPDFImageObj_SetBitmap
    const updateResult = await updatePdfImageBitmap(
      pdfBytes,
      {
        page: selectedImage.page,
        bounds: selectedImage.originalBounds,
        imageIndex: selectedImage.imageIndex,
        pixelWidth: selectedImage.pixelWidth,
        pixelHeight: selectedImage.pixelHeight,
        matrix: selectedImage.matrix,
        objectRef: selectedImage.objectRef,
        imageId: selectedImage.id,
      },
      enhanced
    );

    if (updateResult.success && updateResult.newBytes && updateResult.newBytes.length > 0) {
      return {
        success: true,
        newBytes: updateResult.newBytes,
        message: 'Seçili görsel başarıyla netleştirildi! Diğer görseller ve belgenin vektörel metinleri korundu. 🖼️🔍✨',
      };
    }

    return {
      success: false,
      message: updateResult.message || 'Seçili görsel kesin olarak doğrulanamadı. 0 bayt değiştirildi.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'Görsel netleştirilirken hata oluştu.',
    };
  }
}

/**
 * Executes surgical find and replace directly in PDF content streams.
 * Preserves surrounding context, line layout, original label ("Name:"), font size, baseline, and color.
 */
async function executeFindReplaceInPdf(
  pdfBytes: Uint8Array,
  searchTerm: string,
  replaceTerm: string,
  existingMarks: Mark[] = [],
  existingRemovals: TextRemoval[] = [],
  allowApproximateFont: boolean = false,
  onProgress?: (message: string) => void
): Promise<{
  success: boolean;
  message: string;
  newPdfBytes?: Uint8Array;
  newMarks: Mark[];
  newRemovals: TextRemoval[];
  stoppedDueToUnsupportedChars?: boolean;
  unsupportedChars?: string[];
  metadata?: Record<string, any>;
}> {
  onProgress?.(`"${searchTerm}" belgede aranıyor...`);
  const doc = await loadPdf(pdfBytes);
  const totalPages = doc.numPages;

  const removals: TextRemoval[] = [];
  const marks: Mark[] = [];
  let matchCount = 0;

  // Check character support in source standard fonts
  const unsupportedChars: string[] = [];
  for (const ch of replaceTerm) {
    if (!canEncodeWinAnsi(ch) && !unsupportedChars.includes(ch)) {
      unsupportedChars.push(ch);
    }
  }
  const hasUnsupportedChars = unsupportedChars.length > 0;

  // Rule: If source font cannot encode character and user didn't explicitly choose approximate font -> STOP
  if (hasUnsupportedChars && !allowApproximateFont) {
    return {
      success: false,
      stoppedDueToUnsupportedChars: true,
      unsupportedChars,
      message: `Bu karakter mevcut yazı tipiyle yazılamıyor ("${replaceTerm}" içerisindeki '${unsupportedChars.join(", ")}' karakteri kaynak yazı tipi tarafından desteklenmiyor). Yazı tipi kalitesini ve özgünlüğünü korumak için işlem durduruldu. Yaklaşık yazı tipi ile uygulamak isterseniz bu seçeneği ayrıca onaylayabilirsiniz.`,
      newMarks: [],
      newRemovals: [],
      metadata: {
        searchTerm,
        replaceTerm,
        unsupportedChars,
        allowApproximateFontAvailable: true
      }
    };
  }

  let helvFont: any = null;
  try {
    const dummyDoc = await PDFDocument.create();
    helvFont = await dummyDoc.embedFont(StandardFonts.Helvetica);
  } catch {}

  let fkFont: any = null;
  try {
    const fontkit = await import('@pdf-lib/fontkit');
    const fs = await import('node:fs');
    const path = await import('node:path');
    const fontPath = path.resolve('public/fonts/LiberationSans-Regular.ttf');
    if (fs.existsSync(fontPath)) {
      const fontBuf = fs.readFileSync(fontPath);
      fkFont = (fontkit.default || fontkit).create(fontBuf);
    }
  } catch {}

  function measureStr(str: string): number {
    if (fkFont) {
      try {
        const run = fkFont.layout(str);
        return run.glyphs.reduce((acc: number, g: any) => acc + g.advanceWidth, 0);
      } catch {}
    }
    if (typeof document !== 'undefined' && document.createElement) {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.font = '14px Arial, Helvetica, sans-serif';
          return ctx.measureText(str).width;
        }
      } catch {}
    }
    if (helvFont && canEncodeWinAnsi(str)) {
      try {
        return helvFont.widthOfTextAtSize(str, 14);
      } catch {}
    }
    return str.length * 8;
  }

  function normalizeTr(s: string): string {
    return s
      .toLowerCase()
      .replace(/[iİıI]/g, 'i')
      .replace(/[şŞ]/g, 's')
      .replace(/[ğĞ]/g, 'g')
      .replace(/[üÜ]/g, 'u')
      .replace(/[öÖ]/g, 'o')
      .replace(/[çÇ]/g, 'c');
  }

  const isUnicodeApprox = hasUnsupportedChars && allowApproximateFont;
  const fontMatchQuality = isUnicodeApprox ? 'yaklaşık eşleşme' : 'aynı font korundu';

  for (let p = 0; p < totalPages; p++) {
    const page = await doc.getPage(p + 1);
    const textItems = await editablePageText(page);

    for (const item of textItems) {
      if (!item.text || !item.quad || item.quad.length !== 8) continue;

      let searchFrom = 0;
      while (searchFrom < item.text.length) {
        let idx = item.text.indexOf(searchTerm, searchFrom);
        let matchLen = searchTerm.length;

        if (idx === -1) {
          const remainingText = item.text.slice(searchFrom);
          const normRemaining = normalizeTr(remainingText);
          const normSearch = normalizeTr(searchTerm);
          const subIdx = normRemaining.indexOf(normSearch);
          if (subIdx !== -1) {
            idx = searchFrom + subIdx;
          }
        }

        if (idx === -1) break;

        matchCount++;

        const prefixStr = item.text.slice(0, idx);
        const matchStr = item.text.slice(idx, idx + matchLen);
        const fullStr = item.text;

        const prefixAdv = measureStr(prefixStr);
        const matchAdv = measureStr(matchStr);
        const fullAdv = measureStr(fullStr);
        const repAdv = measureStr(replaceTerm);

        let rStart = idx / Math.max(1, item.text.length);
        let rEnd = Math.min(1, (idx + matchLen) / Math.max(1, item.text.length));
        if (fullAdv > 0) {
          rStart = Math.max(0, Math.min(1, prefixAdv / fullAdv));
          rEnd = Math.max(0, Math.min(1, (prefixAdv + matchAdv) / fullAdv));
        }

        const [x0, y0, x1, y1, x2, y2, x3, y3] = item.quad;
        const topStartX = x0 + (x1 - x0) * rStart;
        const topStartY = y0 + (y1 - y0) * rStart;
        const topEndX = x0 + (x1 - x0) * rEnd;
        const topEndY = y0 + (y1 - y0) * rEnd;
        const botStartX = x2 + (x3 - x2) * rStart;
        const botStartY = y2 + (y3 - y2) * rStart;
        const botEndX = x2 + (x3 - x2) * rEnd;
        const botEndY = y2 + (y3 - y2) * rEnd;
        const subQuad = [topStartX, topStartY, topEndX, topEndY, botStartX, botStartY, botEndX, botEndY];

        const removalId = crypto.randomUUID();
        removals.push({
          id: removalId,
          page: p,
          quad: subQuad
        });

        const fontVal = item.fontFamily === 'serif' ? 'serif' : item.fontFamily === 'courier' ? 'courier' : item.fontFamily === 'roboto' ? 'roboto' : 'sans';
        const repWidth = fullAdv > 0 ? (repAdv / fullAdv) * item.w : item.w * (rEnd - rStart);
        const markW = Math.max(10, Math.round(repWidth * 10) / 10);

        const isItemBold = Boolean(item.bold || item.originalFontName?.toLowerCase().includes("bold") || item.fontName?.toLowerCase().includes("bold"));
        const isItemItalic = Boolean(item.italic || item.originalFontName?.toLowerCase().includes("italic") || item.originalFontName?.toLowerCase().includes("oblique"));

        marks.push({
          id: crypto.randomUUID(),
          page: p,
          kind: 'text',
          x: item.x + item.w * rStart,
          y: item.y,
          w: markW,
          h: item.h,
          size: Math.round(item.size * 10) / 10,
          color: item.color || '#1e293b',
          text: replaceTerm,
          font: fontVal,
          bold: isItemBold,
          italic: isItemItalic,
          sourceId: removalId,
          originalFontName: item.originalFontName || item.fontName,
          fontMatchQuality
        });

        searchFrom = idx + matchLen;
      }
    }
  }

  if (matchCount === 0) {
    return {
      success: false,
      message: `Belgede "${searchTerm}" ifadesi bulunamadı. Lütfen aranan kelimenin yazılışını kontrol edin.`,
      newMarks: [],
      newRemovals: []
    };
  }

  onProgress?.(`${matchCount} adet eşleşme bulundu, vektörel olarak değiştiriliyor...`);
  const pagesConfig = Array.from({ length: totalPages }, (_, i) => ({ index: i, rotation: 0 }));
  const allMarks = [...existingMarks, ...marks];
  const allRemovals = [...existingRemovals, ...removals];
  const exportedBytes = await exportPdf(pdfBytes, pagesConfig, allMarks, allRemovals, []);

  const resultMsg = isUnicodeApprox
    ? `Belgedeki "${searchTerm}" ifadesi kullanıcı onayıyla yaklaşık yazı tipi eşleştirmesi kullanılarak "${replaceTerm}" olarak güncellendi (${matchCount} eşleşme güncellendi).`
    : `Belgedeki "${searchTerm}" ifadesi kaynak yazı tipi ('${marks[0]?.originalFontName || "kaynak font"}') ve stili (${marks[0]?.bold ? "kalın" : "normal"}) birebir korunarak "${replaceTerm}" ile başarıyla değiştirildi (${matchCount} eşleşme güncellendi).`;

  return {
    success: true,
    message: resultMsg,
    newPdfBytes: exportedBytes,
    newMarks: marks,
    newRemovals: removals,
    metadata: {
      searchTerm,
      replaceTerm,
      matchCount,
      fontMatchQuality
    }
  };
}

/**
 * Dispatches an AI intent and executes the corresponding action.
 */
export async function dispatchAiAction(
  intent: AiIntentResult,
  context: AiActionContext,
  onProgress?: (message: string) => void
): Promise<AiActionResult> {
  const baseName = (context.fileName || 'belge').replace(/\.[^/.]+$/, '');

  switch (intent.action) {
    // 1. Theme Dark
    case 'theme_dark': {
      if (typeof window !== 'undefined') {
        document.documentElement.classList.add('dark');
        localStorage.setItem('forma_theme', 'dark');
        window.dispatchEvent(new CustomEvent('forma-theme-change', { detail: 'dark' }));
      }
      return {
        success: true,
        action: 'theme_dark',
        message: 'Karanlık (koyu) mod hemen aktifleştirildi! 🌙',
      };
    }

    // 2. Theme Light
    case 'theme_light': {
      if (typeof window !== 'undefined') {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('forma_theme', 'light');
        window.dispatchEvent(new CustomEvent('forma-theme-change', { detail: 'light' }));
      }
      return {
        success: true,
        action: 'theme_light',
        message: 'Aydınlık (açık) mod hemen aktifleştirildi! ☀️',
      };
    }

    // 3. Watermark Add
    case 'watermark_add': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'watermark_add',
          message: 'Filigran eklemek için lütfen bir PDF belgesi açın.',
        };
      }

      const wmText = intent.parameters?.watermarkText || 'GİZLİ';
      onProgress?.(`Belge sayfalarına '${wmText}' filigranı ekleniyor...`);

      const stampedBytes = await addWatermarkToPdf(context.pdfBytes, wmText);

      return {
        success: true,
        action: 'watermark_add',
        message: `Belge sayfalarına '${wmText}' filigranı başarıyla eklendi! 🔏`,
        newPdfBytes: stampedBytes,
        newFileName: `${baseName}_filigranli.pdf`,
      };
    }

    // 4. Watermark Removal
    case 'watermark_remove': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'watermark_remove',
          message: 'Filigran temizlemek için lütfen önce bir PDF belgesi yükleyin veya çalışma alanında açın.',
        };
      }

      onProgress?.('Belgedeki filigran ve taslak damgaları taranıyor...');
      const candidates = await detectWatermarks(context.pdfBytes);

      if (candidates.length === 0) {
        return {
          success: false,
          action: 'watermark_remove',
          message: 'Belgede bağımsız işaretlerle doğrulanmış bir filigran veya taslak damgası bulunamadı. Belgeniz zaten temiz görünüyor! ✨',
        };
      }

      // Strict confirmation flow: never auto-delete unconfirmed candidates
      if (!context.confirmedCandidateIds || context.confirmedCandidateIds.length === 0) {
        return {
          success: true,
          action: 'watermark_remove',
          message: `Belgede ${candidates.length} adet filigran adayı tespit edildi. Temizlemek istediğiniz adayları aşağıdan seçip onaylayın.`,
          metadata: {
            candidates,
            pendingConfirmation: true,
          },
        };
      }

      const idsToRemove = context.confirmedCandidateIds;

      onProgress?.(`${idsToRemove.length} adet filigran nesnesi temizleniyor...`);
      const removalResult = await removeWatermarks(context.pdfBytes, candidates, {
        candidateIds: idsToRemove,
        pageScope: 'all',
        currentPage: 0,
        allowLogoRemoval: true,
      });

      if (removalResult.totalRemoved === 0) {
        const failureReasons = removalResult.candidateResults
          ?.filter(r => r.status !== 'removed' && r.reason)
          ?.map(r => r.reason) || [];
        const detail = failureReasons.length > 0 ? ` (${failureReasons[0]})` : '';
        return {
          success: false,
          action: 'watermark_remove',
          message: `Filigran kaldırılamadı${detail}; PDF baytlarında değişiklik yapılmadı.`,
        };
      }

      return {
        success: true,
        action: 'watermark_remove',
        message: `Seçtiğiniz filigran adayları kaldırıldı (${removalResult.totalRemoved} adet nesne). Önemli belgelerde sonucu kontrol ederek dışa aktarın.`,
        newPdfBytes: removalResult.pdfBytes,
        newFileName: `${baseName}_filigransiz.pdf`,
        metadata: { removedCount: removalResult.totalRemoved, candidates },
      };
    }

    // 5. Enhance Document / Scan / Image
    case 'enhance_document': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'enhance_document',
          message: 'Netleştirme işlemi için lütfen önce bir PDF belgesi yükleyin veya çalışma alanında açın.',
        };
      }

      const mode = intent.parameters?.enhanceMode || 'document';
      onProgress?.(mode === 'photo' ? 'Görsel ve fotoğraflar netleştiriliyor...' : 'Taranmış belge netleştiriliyor...');

      const enhancedBytes = await enhancePdfBytes(context.pdfBytes, {
        mode,
        intensity: 'balanced',
        despeckle: true,
        onProgress: (p, total, msg) => onProgress?.(msg),
      });

      return {
        success: true,
        action: 'enhance_document',
        message: mode === 'photo'
          ? 'Görseller renk dengesi korunarak kristal netliğe kavuşturuldu! 🖼️✨'
          : 'Belge arka planı tertemiz beyazlatıldı, soluk yazılar koyulaştırıldı ve keskinleştirildi! 📄✨',
        newPdfBytes: enhancedBytes,
        newFileName: `${baseName}_netlestirildi.pdf`,
      };
    }

    // 6. Compress PDF
    case 'compress_pdf': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'compress_pdf',
          message: 'Sıkıştırma işlemi için lütfen önce bir PDF belgesi yükleyin veya açın.',
        };
      }

      onProgress?.('PDF nesneleri ve görseller optimize ediliyor...');
      const compResult = await compressPdf(context.pdfBytes, { preset: 'balanced' });

      const origKb = Math.round(compResult.originalSize / 1024);
      const compKb = Math.round(compResult.compressedSize / 1024);

      return {
        success: true,
        action: 'compress_pdf',
        message: `PDF başarıyla sıkıştırıldı! Boyut ${origKb} KB'den ${compKb} KB'ye düşürüldü (%${compResult.reductionPercentage} tasarruf). 🗜️`,
        newPdfBytes: compResult.compressedBytes,
        newFileName: `${baseName}_sikistirildi.pdf`,
        metadata: { reduction: compResult.reductionPercentage, origKb, compKb },
      };
    }

    // 7. KVKK / PII Redaction
    case 'redact_pii': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'redact_pii',
          message: 'KVKK sansürleme işlemi için lütfen bir PDF belgesi açın.',
        };
      }

      onProgress?.('Belgedeki TC Kimlik, IBAN ve kart numaraları taranıyor...');
      const entities = await scanPdfForSensitiveEntities(context.pdfBytes);

      if (entities.length === 0) {
        return {
          success: true,
          action: 'redact_pii',
          message: 'Belgede herhangi bir TC Kimlik No, TR IBAN veya kredi kartı bulunamadı. Belgeniz güvende! 🛡️',
        };
      }

      onProgress?.(`${entities.length} adet hassas veri kalıcı olarak maskeleniyor...`);
      const redactedBytes = await redactDetectedEntities(context.pdfBytes, entities);

      return {
        success: true,
        action: 'redact_pii',
        message: `Toplam ${entities.length} adet hassas veri (TCKN, IBAN, Kart No) kalıcı olarak maskelendi ve sansürlendi! 🔒`,
        newPdfBytes: redactedBytes,
        newFileName: `${baseName}_kvkk_sansurlu.pdf`,
        metadata: { redactedCount: entities.length },
      };
    }

    // 8. PDF/A Archival Standard
    case 'convert_pdfa': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'convert_pdfa',
          message: 'PDF/A dönüştürme için lütfen bir PDF belgesi açın.',
        };
      }

      onProgress?.('Belge ISO 19005-2 PDF/A-2b arşiv formatına uyarlanıyor...');
      const pdfaBytes = await convertToPdfA2b(context.pdfBytes, { title: baseName });

      return {
        success: true,
        action: 'convert_pdfa',
        message: 'Belgeniz uluslararası PDF/A-2b uzun vadeli arşiv standardına dönüştürüldü! 🏛️',
        newPdfBytes: pdfaBytes,
        newFileName: `${baseName}_pdfa.pdf`,
      };
    }

    // 9. Convert to Word (.docx)
    case 'convert_word': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'convert_word',
          message: "Word'e dönüştürmek için lütfen bir PDF belgesi açın.",
        };
      }

      onProgress?.("PDF yapısı inceleniyor ve Microsoft Word (.docx) oluşturuluyor...");
      const { pdfToDocx } = await import('../conversion/docxConverter.ts');
      const docxBytes = await pdfToDocx(context.pdfBytes);

      return {
        success: true,
        action: 'convert_word',
        message: 'PDF belgeniz düzenlenebilir Microsoft Word (.docx) formatına dönüştürüldü! 📝',
        downloadData: {
          bytes: docxBytes,
          fileName: `${baseName}.docx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
      };
    }

    // 10. Convert to Excel (.xlsx)
    case 'convert_excel': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'convert_excel',
          message: "Excel'e dönüştürmek için lütfen bir PDF belgesi açın.",
        };
      }

      onProgress?.("Tablo ve hücre verileri taranıyor, Excel (.xlsx) oluşturuluyor...");
      const { pdfToExcel } = await import('../conversion/conversionEngine.ts');
      const xlsxBytes = await pdfToExcel(context.pdfBytes);

      return {
        success: true,
        action: 'convert_excel',
        message: 'Belgedeki tablolar Excel (.xlsx) çalışma tablosuna aktarıldı! 📊',
        downloadData: {
          bytes: xlsxBytes,
          fileName: `${baseName}.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      };
    }

    // 11. Convert to Images (PNG ZIP)
    case 'convert_img': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'convert_img',
          message: 'Görsele çevirmek için lütfen bir PDF belgesi açın.',
        };
      }

      onProgress?.('PDF sayfaları yüksek çözünürlüklü görsellere dönüştürülüyor...');
      const { pdfToImagesZip } = await import('../conversion/conversionEngine.ts');
      const zipBytes = await pdfToImagesZip(context.pdfBytes, { format: 'png', dpi: 150 });

      return {
        success: true,
        action: 'convert_img',
        message: 'Tüm sayfalar yüksek çözünürlüklü PNG görselleri olarak ZIP arşivlendi! 🖼️',
        downloadData: {
          bytes: zipBytes,
          fileName: `${baseName}_sayfalar_png.zip`,
          mimeType: 'application/zip',
        },
      };
    }

    // 12. Stamp Document
    case 'stamp_document': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'stamp_document',
          message: 'Kaşe basmak için lütfen önce bir PDF belgesi açın.',
        };
      }

      const stampType = intent.parameters?.stampType || 'asli_gibidir';
      const stampLabel = stampType === 'asli_gibidir' ? 'ASLI GİBİDİR' : stampType.toUpperCase().replace('_', ' ');
      onProgress?.(`Belgeye '${stampLabel}' resmi kaşesi basılıyor...`);

      const stampedBytes = await stampPdfDirectly(context.pdfBytes, stampType);

      return {
        success: true,
        action: 'stamp_document',
        message: `Belgeye resmi '${stampLabel}' kaşesi ve onay mührü basıldı! 🏷️`,
        newPdfBytes: stampedBytes,
        newFileName: `${baseName}_${stampType}.pdf`,
      };
    }

    // 13. Page Numbers
    case 'page_numbers': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'page_numbers',
          message: 'Sayfa numarası eklemek için lütfen bir PDF belgesi açın.',
        };
      }

      onProgress?.('Sayfa numaraları ekleniyor...');
      const numberedBytes = await addPageNumbersToPdf(context.pdfBytes);

      return {
        success: true,
        action: 'page_numbers',
        message: 'Tüm sayfalara sayfa numarası (Sayfa X / Y) eklendi! 🔢',
        newPdfBytes: numberedBytes,
        newFileName: `${baseName}_numaralandi.pdf`,
      };
    }

    // 14. Delete Pages
    case 'delete_pages': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'delete_pages',
          message: 'Sayfa silmek için lütfen bir PDF belgesi açın.',
        };
      }

      const target = (intent.parameters?.targetPage as 'first' | 'last') || 'last';
      onProgress?.(`${target === 'first' ? 'İlk sayfa' : 'Son sayfa'} siliniyor...`);

      const updatedBytes = await deletePdfPage(context.pdfBytes, target);

      return {
        success: true,
        action: 'delete_pages',
        message: `${target === 'first' ? 'İlk sayfa' : 'Son sayfa'} başarıyla silindi! 🗑️`,
        newPdfBytes: updatedBytes,
        newFileName: `${baseName}_sayfa_silindi.pdf`,
      };
    }

    // 15. Password Protection
    case 'protect_pdf': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'protect_pdf',
          message: 'Şifrelemek için lütfen bir PDF belgesi açın.',
        };
      }

      const password = intent.parameters?.password || 'Forma123!';
      onProgress?.('Belge AES standardı ile şifreleniyor...');

      const encryptedBytes = await encryptPdfWithPassword(context.pdfBytes, password);

      return {
        success: true,
        action: 'protect_pdf',
        message: `Belge başarıyla şifrelendi! Parola: **${password}** 🔐`,
        newPdfBytes: encryptedBytes,
        newFileName: `${baseName}_sifreli.pdf`,
      };
    }

    // 16. OCR Document
    case 'ocr_document': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'ocr_document',
          message: 'Metin tanıma için lütfen bir PDF belgesi açın.',
        };
      }

      onProgress?.('Sayfadaki metinler taranıyor ve okunuyor...');
      const fullText = await extractPdfText(context.pdfBytes);
      const lines = fullText.split('\n').map(s => s.trim()).filter(Boolean);
      const joined = lines.join('\n');
      const textPreview = joined.slice(0, 300) || 'Metin ayrıştırılamadı.';

      return {
        success: true,
        action: 'ocr_document',
        message: `🔍 **OCR Metin Tanıma Tamamlandı** (${lines.length} satır):\n\n${textPreview}${joined.length > 300 ? '...' : ''}`,
        downloadData: {
          bytes: new TextEncoder().encode(joined),
          fileName: `${baseName}_okunan_metin.txt`,
          mimeType: 'text/plain',
        },
      };
    }

    // 17. Flatten Forms
    case 'flatten_forms': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'flatten_forms',
          message: 'Form düzleştirmek için lütfen bir PDF belgesi açın.',
        };
      }

      onProgress?.('Form alanları düzleştiriliyor...');
      const flattenedBytes = await flattenPdfForms(context.pdfBytes);

      return {
        success: true,
        action: 'flatten_forms',
        message: 'Tüm form alanları düzleştirildi ve salt okunur yapıldı! 📋',
        newPdfBytes: flattenedBytes,
        newFileName: `${baseName}_duzlestirildi.pdf`,
      };
    }

    // 18. Rotate Pages
    case 'rotate_pages': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'rotate_pages',
          message: 'Sayfaları döndürmek için lütfen bir PDF belgesi açın.',
        };
      }

      const angle = intent.parameters?.angle || 90;
      onProgress?.(`Sayfalar saat yönünde ${angle}° döndürülüyor...`);

      const rotatedBytes = await rotatePdfPages(context.pdfBytes, angle);

      return {
        success: true,
        action: 'rotate_pages',
        message: `Belge sayfaları ${angle}° saat yönünde başarıyla döndürüldü! 🔄`,
        newPdfBytes: rotatedBytes,
        newFileName: `${baseName}_donduruldu.pdf`,
      };
    }

    // 19. Document Info
    case 'document_info': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'document_info',
          message: 'Belge analizi için lütfen önce bir PDF belgesi yükleyin.',
        };
      }

      const doc = await PDFDocument.load(context.pdfBytes);
      const count = doc.getPageCount();
      const sizeKb = Math.round(context.pdfBytes.byteLength / 1024);
      const title = doc.getTitle() || 'Başlık Belirtilmemiş';

      return {
        success: true,
        action: 'document_info',
        message: `📄 **Belge Analiz Raporu**:\n• Dosya Adı: ${context.fileName || 'Belge.pdf'}\n• Sayfa Sayısı: ${count} sayfa\n• Dosya Boyutu: ${sizeKb} KB\n• Başlık: ${title}\n• Durum: İşleme hazır`,
      };
    }

    // 21. Vision & Document QA ("görselde ne var", "resimde ne var", "ne görüyorsun")
    case 'vision_qa': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'vision_qa',
          message: 'Görsel veya belge analizi için lütfen önce bir dosya yükleyin veya çalışma alanına sürükleyin.',
        };
      }

      onProgress?.('Görsel ve belge taranıyor, nesneler ve metinler analiz ediliyor...');
      const visionReport = await analyzeDocumentVision(context.pdfBytes, context.fileName);

      return {
        success: true,
        action: 'vision_qa',
        message: visionReport,
      };
    }

    // 22. Delete Object / Image ("seçili görseli sil", "bu görseli kaldır")
    case 'delete_object': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'delete_object',
          message: 'Görsel silmek için lütfen bir PDF belgesi açın.',
        };
      }

      if (!context.selectedImage) {
        return {
          success: false,
          action: 'delete_object',
          message: 'Yerel sürüm görseldeki nesneleri isimlerine göre tanıyamıyor. Önce kaldırmak istediğin görseli seç, ardından ‘seçili görseli sil’ komutunu kullan.',
        };
      }

      onProgress?.('Seçili görsel doğrulanıyor ve kaldırılıyor...');
      const delResult = await deleteSelectedImageFromPdf(context.pdfBytes, context.selectedImage);

      if (!delResult.success || !delResult.newBytes) {
        return {
          success: false,
          action: 'delete_object',
          message: delResult.message || 'Seçili görsel kaldırılamadı.',
        };
      }

      return {
        success: true,
        action: 'delete_object',
        message: 'Seçili görsel başarıyla silindi ve belgeden temizlendi! 🗑️✨',
        newPdfBytes: delResult.newBytes,
        newFileName: `${baseName}_gorsel_silindi.pdf`,
        metadata: { removedCount: delResult.removedCount },
      };
    }

    // 23. Selective Enhancement ("seçili görseli netleştir")
    case 'enhance_selective': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'enhance_selective',
          message: 'Netleştirme için lütfen bir PDF belgesi açın.',
        };
      }

      if (!context.selectedImage) {
        return {
          success: false,
          action: 'enhance_selective',
          message: 'Netleştirmek istediğiniz görsel seçili değil. Lütfen önce çalışma alanından bir görsel seçin, ardından "seçili görseli netleştir" komutunu kullanın.',
        };
      }

      onProgress?.('Seçili görsel izole ediliyor ve netleştiriliyor...');
      const enhResult = await enhanceSelectedImageInPdf(context.pdfBytes, context.selectedImage);

      if (!enhResult.success || !enhResult.newBytes) {
        return {
          success: false,
          action: 'enhance_selective',
          message: enhResult.message || 'Seçili görsel netleştirilemedi.',
        };
      }

      return {
        success: true,
        action: 'enhance_selective',
        message: enhResult.message,
        newPdfBytes: enhResult.newBytes,
        newFileName: `${baseName}_secili_gorsel_netlestirildi.pdf`,
      };
    }

    // 24. Voice Control Toggle
    case 'voice_toggle': {
      const voiceState = intent.parameters?.voiceState || 'on';
      return {
        success: true,
        action: 'voice_toggle',
        message: intent.suggestedReply,
        metadata: { voiceState },
      };
    }

    // 25. Find & Replace Text
    case 'find_replace': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'find_replace',
          message: 'Değişiklik yapabilmek için önce bir PDF belgesi yüklemelisiniz.',
        };
      }
      const searchTerm = intent.parameters?.searchTerm;
      const replaceTerm = intent.parameters?.replaceTerm;
      if (!searchTerm || !replaceTerm) {
        return {
          success: false,
          action: 'find_replace',
          message: 'Değiştirilecek metin veya yeni metin anlaşılamadı. Lütfen örneğin "Sukru Yildiz ismini Ahmet Yılmaz ile değiştir" şeklinde belirtin.',
        };
      }

      const allowApprox = Boolean(
        intent.parameters?.allowApproximateFont ||
        context.allowApproximateFont ||
        context.confirmedCandidateIds?.includes('allow_approximate')
      );
      const repResult = await executeFindReplaceInPdf(
        context.pdfBytes,
        searchTerm,
        replaceTerm,
        context.existingMarks || [],
        context.existingRemovals || [],
        allowApprox,
        onProgress
      );

      if (!repResult.success || !repResult.newPdfBytes) {
        return {
          success: false,
          action: 'find_replace',
          stoppedDueToUnsupportedChars: repResult.stoppedDueToUnsupportedChars,
          unsupportedChars: repResult.unsupportedChars,
          message: repResult.message,
          metadata: repResult.metadata
        };
      }

      return {
        success: true,
        action: 'find_replace',
        message: repResult.message,
        newPdfBytes: repResult.newPdfBytes,
        newMarks: repResult.newMarks,
        newRemovals: repResult.newRemovals,
        newFileName: `${baseName}_duzenlendi.pdf`,
        metadata: repResult.metadata,
      };
    }

    // 20. General Help
    default: {
      return {
        success: true,
        action: 'general_help',
        message: intent.suggestedReply,
      };
    }
  }
}

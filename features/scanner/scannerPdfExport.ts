import { PDFDocument } from 'pdf-lib';
import type { ScannedPage, ScannerExportOptions } from './scannerTypes';

export async function exportScannedPdf(
  pages: ScannedPage[],
  options: ScannerExportOptions,
  onProgress?: (current: number, total: number, message: string) => void
): Promise<Uint8Array> {
  if (!pages.length) {
    throw new Error('Taranmış sayfa bulunamadı.');
  }

  const pdfDoc = await PDFDocument.create();
  const A4_WIDTH = 595.28;
  const A4_HEIGHT = 841.89;

  let marginPt = 0;
  if (options.margin === 'small') marginPt = 18;
  else if (options.margin === 'normal') marginPt = 36;

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    if (onProgress) {
      onProgress(i + 1, pages.length, `Sayfa ${i + 1}/${pages.length} işleniyor...`);
    }

    const dataUrl = page.processedDataUrl || page.originalDataUrl;
    const base64Data = dataUrl.split(',')[1];
    const imgBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    const isPng = dataUrl.startsWith('data:image/png');
    const embeddedImg = isPng ? await pdfDoc.embedPng(imgBytes) : await pdfDoc.embedJpg(imgBytes);

    const imgW = embeddedImg.width;
    const imgH = embeddedImg.height;

    let pageWidth = A4_WIDTH;
    let pageHeight = A4_HEIGHT;

    if (!options.fitToA4) {
      pageWidth = imgW + marginPt * 2;
      pageHeight = imgH + marginPt * 2;
    }

    const pdfPage = pdfDoc.addPage([pageWidth, pageHeight]);

    const availW = pageWidth - marginPt * 2;
    const availH = pageHeight - marginPt * 2;

    const scale = Math.min(availW / imgW, availH / imgH);
    const drawW = imgW * scale;
    const drawH = imgH * scale;

    const drawX = marginPt + (availW - drawW) / 2;
    const drawY = marginPt + (availH - drawH) / 2;

    pdfPage.drawImage(embeddedImg, {
      x: drawX,
      y: drawY,
      width: drawW,
      height: drawH,
    });
  }

  // If OCR requested, perform OCR on each page and add invisible text
  if (options.applyOcr) {
    try {
      const { createWorker } = await import('tesseract.js');
      const worker = await createWorker([options.ocrLanguage || 'tur', 'eng'], 1, {
        langPath: '/tesseract/lang-data',
        cacheMethod: 'readOnly',
        gzip: true,
      });

      for (let i = 0; i < pages.length; i++) {
        if (onProgress) {
          onProgress(i + 1, pages.length, `Sayfa ${i + 1} için aranabilir metin katmanı (OCR) oluşturuluyor...`);
        }
        const dataUrl = pages[i].processedDataUrl || pages[i].originalDataUrl;
        const res = await worker.recognize(dataUrl);
        const text = res.data.text?.trim();

        // Attach text metadata to page if available
        if (text) {
          const targetPdfPage = pdfDoc.getPage(i);
          // Draw minimal invisible text for indexing
          targetPdfPage.drawText(text, {
            x: 10,
            y: 10,
            size: 1,
            opacity: 0.001,
          });
        }
      }
      await worker.terminate();
    } catch (e) {
      console.warn('OCR işlemi tamamlanamadı, taranmış PDF normal olarak kaydediliyor:', e);
    }
  }

  return await pdfDoc.save();
}
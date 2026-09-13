import {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFDict,
  PDFString,
  PDFNumber,
  rgb,
  StandardFonts,
} from 'pdf-lib';
import type { PdfAnnotation, AnnotationType, StampPreset } from './annotationTypes';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace('#', '');
  if (clean.length === 3) clean = clean.split('').map((c) => c + c).join('');
  const num = parseInt(clean, 16) || 0;
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  };
}

const STAMP_LABELS: Record<StampPreset, { text: string; color: string }> = {
  onaylandi: { text: 'ONAYLANDI', color: '#16a34a' },
  reddedildi: { text: 'REDDEDİLDİ', color: '#dc2626' },
  taslak: { text: 'TASLAK', color: '#64748b' },
  gizli: { text: 'GİZLİ', color: '#b91c1c' },
  incelendi: { text: 'İNCELENDİ', color: '#2563eb' },
  imzalanacak: { text: 'İMZALANACAK', color: '#d97706' },
  custom: { text: 'DAMGA', color: '#4f46e5' },
};

function getSubtypeForType(type: AnnotationType): string {
  switch (type) {
    case 'text': return 'Text';
    case 'highlight': return 'Highlight';
    case 'underline': return 'Underline';
    case 'strikeout': return 'StrikeOut';
    case 'ink': return 'Ink';
    case 'arrow':
    case 'line': return 'Line';
    case 'rectangle': return 'Square';
    case 'circle': return 'Circle';
    case 'freetext': return 'FreeText';
    case 'stamp': return 'Stamp';
    default: return 'Text';
  }
}

/**
 * Embed standard PDF annotation objects and visual appearances into PDF
 */
export async function writeAnnotationsToPdf(
  pdfBytes: Uint8Array,
  annotations: PdfAnnotation[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const regularFont = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pageCount = pdfDoc.getPageCount();

  for (const annot of annotations) {
    if (annot.pageIndex < 0 || annot.pageIndex >= pageCount) continue;

    const page = pdfDoc.getPage(annot.pageIndex);
    const col = hexToRgb(annot.color || '#f59e0b');
    const opacity = annot.opacity ?? 0.8;
    const [x1, y1, x2, y2] = annot.rect;
    const width = Math.max(10, Math.abs(x2 - x1));
    const height = Math.max(10, Math.abs(y2 - y1));
    const minX = Math.min(x1, x2);
    const minY = Math.min(y1, y2);

    // 1. Draw Visual Representation
    if (annot.type === 'highlight') {
      page.drawRectangle({
        x: minX,
        y: minY,
        width,
        height,
        color: rgb(col.r, col.g, col.b),
        opacity: 0.35,
      });
    } else if (annot.type === 'underline') {
      page.drawLine({
        start: { x: minX, y: minY },
        end: { x: minX + width, y: minY },
        thickness: 2,
        color: rgb(col.r, col.g, col.b),
        opacity,
      });
    } else if (annot.type === 'strikeout') {
      page.drawLine({
        start: { x: minX, y: minY + height / 2 },
        end: { x: minX + width, y: minY + height / 2 },
        thickness: 2,
        color: rgb(col.r, col.g, col.b),
        opacity,
      });
    } else if (annot.type === 'rectangle') {
      page.drawRectangle({
        x: minX,
        y: minY,
        width,
        height,
        borderColor: rgb(col.r, col.g, col.b),
        borderWidth: 2,
        opacity,
      });
    } else if (annot.type === 'circle') {
      page.drawEllipse({
        x: minX + width / 2,
        y: minY + height / 2,
        xScale: width / 2,
        yScale: height / 2,
        borderColor: rgb(col.r, col.g, col.b),
        borderWidth: 2,
        opacity,
      });
    } else if (annot.type === 'line' || annot.type === 'arrow') {
      const lp = annot.linePoints || { x1: minX, y1: minY, x2: minX + width, y2: minY + height };
      page.drawLine({
        start: { x: lp.x1, y: lp.y1 },
        end: { x: lp.x2, y: lp.y2 },
        thickness: 2,
        color: rgb(col.r, col.g, col.b),
        opacity,
      });
      if (annot.type === 'arrow') {
        // Draw arrowhead tip
        const angle = Math.atan2(lp.y2 - lp.y1, lp.x2 - lp.x1);
        const headLen = 10;
        page.drawLine({
          start: { x: lp.x2, y: lp.y2 },
          end: {
            x: lp.x2 - headLen * Math.cos(angle - Math.PI / 6),
            y: lp.y2 - headLen * Math.sin(angle - Math.PI / 6),
          },
          thickness: 2,
          color: rgb(col.r, col.g, col.b),
          opacity,
        });
        page.drawLine({
          start: { x: lp.x2, y: lp.y2 },
          end: {
            x: lp.x2 - headLen * Math.cos(angle + Math.PI / 6),
            y: lp.y2 - headLen * Math.sin(angle + Math.PI / 6),
          },
          thickness: 2,
          color: rgb(col.r, col.g, col.b),
          opacity,
        });
      }
    } else if (annot.type === 'ink' && annot.inkPaths) {
      for (const stroke of annot.inkPaths) {
        for (let s = 0; s < stroke.length - 1; s++) {
          page.drawLine({
            start: stroke[s],
            end: stroke[s + 1],
            thickness: 2,
            color: rgb(col.r, col.g, col.b),
            opacity,
          });
        }
      }
    } else if (annot.type === 'text') {
      // Sticky note icon
      page.drawRectangle({
        x: minX,
        y: minY,
        width: 22,
        height: 22,
        color: rgb(col.r, col.g, col.b),
        opacity: 0.9,
      });
      page.drawText('?', {
        x: minX + 7,
        y: minY + 5,
        size: 13,
        font,
        color: rgb(1, 1, 1),
      });
    } else if (annot.type === 'freetext') {
      page.drawRectangle({
        x: minX,
        y: minY,
        width,
        height,
        borderColor: rgb(col.r, col.g, col.b),
        borderWidth: 1.5,
        color: rgb(1, 1, 1),
        opacity: 0.9,
      });
      if (annot.contents) {
        page.drawText(annot.contents.slice(0, 100), {
          x: minX + 6,
          y: minY + height - 16,
          size: annot.fontSize || 10,
          font: regularFont,
          color: rgb(0.1, 0.1, 0.1),
        });
      }
    } else if (annot.type === 'stamp') {
      const preset = annot.stampPreset || 'onaylandi';
      const label = STAMP_LABELS[preset] || { text: 'DAMGA', color: '#4f46e5' };
      const stampCol = hexToRgb(label.color);

      page.drawRectangle({
        x: minX,
        y: minY,
        width: Math.max(120, width),
        height: Math.max(45, height),
        borderColor: rgb(stampCol.r, stampCol.g, stampCol.b),
        borderWidth: 3,
        color: rgb(1, 1, 1),
        opacity: 0.95,
      });
      page.drawText(label.text, {
        x: minX + 12,
        y: minY + 15,
        size: 16,
        font,
        color: rgb(stampCol.r, stampCol.g, stampCol.b),
      });
    }

    // 2. Standard PDF Annotation Dictionary Object (/Type /Annot)
    try {
      const annotDict = pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: getSubtypeForType(annot.type),
        Rect: [minX, minY, minX + width, minY + height],
        Contents: PDFString.of(annot.contents || ''),
        T: PDFString.of(annot.author || 'Forma Kullanıcısı'),
        M: PDFString.of(annot.date || new Date().toISOString()),
        C: [col.r, col.g, col.b],
        CA: opacity,
        F: 4, // Print flag
      });

      const annotRef = pdfDoc.context.register(annotDict);

      // Add to page /Annots array
      const existingAnnots = page.node.get(PDFName.of('Annots'));
      if (existingAnnots instanceof PDFArray) {
        existingAnnots.push(annotRef);
      } else {
        const newAnnots = pdfDoc.context.obj([annotRef]);
        page.node.set(PDFName.of('Annots'), newAnnots);
      }
    } catch (e) {
      console.warn('PDF annotasyonu sözlüğe eklenemedi:', e);
    }
  }

  return await pdfDoc.save();
}

/**
 * Read annotation objects from PDF dictionary
 */
export async function readAnnotationsFromPdf(pdfBytes: Uint8Array): Promise<PdfAnnotation[]> {
  const annotations: PdfAnnotation[] = [];
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pageCount = pdfDoc.getPageCount();

    for (let i = 0; i < pageCount; i++) {
      const page = pdfDoc.getPage(i);
      const annots = page.node.get(PDFName.of('Annots'));
      if (annots instanceof PDFArray) {
        for (let j = 0; j < annots.size(); j++) {
          const annotRef = annots.get(j);
          const annotObj = pdfDoc.context.lookup(annotRef);
          if (annotObj instanceof PDFDict) {
            const subtype = annotObj.get(PDFName.of('Subtype'))?.toString().replace('/', '') || 'Text';
            const contents = annotObj.get(PDFName.of('Contents'))?.toString() || '';
            const author = annotObj.get(PDFName.of('T'))?.toString() || 'Kullanıcı';
            const rectArr = annotObj.get(PDFName.of('Rect'));
            let rect: [number, number, number, number] = [50, 50, 150, 100];
            if (rectArr instanceof PDFArray && rectArr.size() === 4) {
              rect = [
                (rectArr.get(0) as PDFNumber).asNumber(),
                (rectArr.get(1) as PDFNumber).asNumber(),
                (rectArr.get(2) as PDFNumber).asNumber(),
                (rectArr.get(3) as PDFNumber).asNumber(),
              ];
            }

            let type: AnnotationType = 'text';
            const sub = subtype.toLowerCase();
            if (sub.includes('highlight')) type = 'highlight';
            else if (sub.includes('underline')) type = 'underline';
            else if (sub.includes('strike')) type = 'strikeout';
            else if (sub.includes('square')) type = 'rectangle';
            else if (sub.includes('circle')) type = 'circle';
            else if (sub.includes('line')) type = 'line';
            else if (sub.includes('ink')) type = 'ink';
            else if (sub.includes('freetext')) type = 'freetext';
            else if (sub.includes('stamp')) type = 'stamp';

            annotations.push({
              id: `annot_${i}_${j}_${Date.now()}`,
              pageIndex: i,
              type,
              rect,
              author,
              date: new Date().toISOString(),
              color: '#f59e0b',
              opacity: 0.8,
              contents,
              resolved: false,
            });
          }
        }
      }
    }
  } catch (e) {
    console.warn('PDF annotasyonları okunurken hata oluştu:', e);
  }

  return annotations;
}

/**
 * Export annotations summary as JSON or printable PDF summary report
 */
export async function exportAnnotationsReport(
  annotations: PdfAnnotation[],
  format: 'json' | 'summaryPdf',
  documentName: string = 'belge.pdf'
): Promise<string | Uint8Array> {
  if (format === 'json') {
    return JSON.stringify(annotations, null, 2);
  }

  // Generate clean Summary PDF
  const reportDoc = await PDFDocument.create();
  const page = reportDoc.addPage([595.28, 841.89]);
  const fontBold = await reportDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await reportDoc.embedFont(StandardFonts.Helvetica);

  page.drawText('FORMA PDF YORUM VE İNCELEME ÖZET RAPORU', {
    x: 50,
    y: 790,
    size: 16,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.2),
  });

  page.drawText(`Belge: ${documentName} | Toplam Yorum: ${annotations.length}`, {
    x: 50,
    y: 770,
    size: 10,
    font: fontRegular,
    color: rgb(0.4, 0.4, 0.5),
  });

  page.drawLine({
    start: { x: 50, y: 755 },
    end: { x: 545, y: 755 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8),
  });

  let curY = 730;
  for (let idx = 0; idx < annotations.length; idx++) {
    if (curY < 60) break; // page limit for 1-page summary
    const a = annotations[idx];
    const statusStr = a.resolved ? '[ÇÖZÜLDÜ]' : '[AÇIK]';

    page.drawText(`${idx + 1}. Sayfa ${a.pageIndex + 1} - ${a.type.toUpperCase()} ${statusStr}`, {
      x: 50,
      y: curY,
      size: 10,
      font: fontBold,
      color: rgb(0.2, 0.2, 0.3),
    });

    curY -= 14;
    page.drawText(`Yazar: ${a.author} | Tarih: ${a.date.slice(0, 10)}`, {
      x: 65,
      y: curY,
      size: 9,
      font: fontRegular,
      color: rgb(0.5, 0.5, 0.5),
    });

    curY -= 14;
    page.drawText(`İçerik: "${a.contents || '(Yorum metni yok)'}"`, {
      x: 65,
      y: curY,
      size: 9,
      font: fontRegular,
      color: rgb(0.15, 0.15, 0.15),
    });

    curY -= 20;
  }

  return await reportDoc.save();
}

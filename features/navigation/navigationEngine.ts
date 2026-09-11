import {
  PDFDocument,
  PDFName,
  PDFArray,
  PDFDict,
  PDFString,
  PDFNumber,
  rgb,
  StandardFonts,
} from '@cantoo/pdf-lib';
import type {
  PdfBookmarkItem,
  PdfLinkItem,
  TocHeadingCandidate,
  LinkType,
} from './navigationTypes';

/**
 * Validate and sanitize link targets
 */
export function validateLink(target: string, type: LinkType): { isValid: boolean; isDangerous: boolean; sanitized: string } {
  const trimmed = target.trim();
  const lower = trimmed.toLowerCase();

  // Block dangerous schemes
  if (
    lower.startsWith('javascript:') ||
    lower.startsWith('vbscript:') ||
    lower.startsWith('data:') ||
    lower.startsWith('file:')
  ) {
    return { isValid: false, isDangerous: true, sanitized: '' };
  }

  if (type === 'external') {
    let sanitized = trimmed;
    if (!/^https?:\/\//i.test(sanitized)) {
      sanitized = `https://${sanitized}`;
    }
    return { isValid: true, isDangerous: false, sanitized };
  }

  if (type === 'email') {
    let sanitized = trimmed;
    if (!sanitized.toLowerCase().startsWith('mailto:')) {
      sanitized = `mailto:${sanitized}`;
    }
    return { isValid: true, isDangerous: false, sanitized };
  }

  if (type === 'internal') {
    const pageNum = parseInt(trimmed, 10);
    const isValid = !isNaN(pageNum) && pageNum > 0;
    return { isValid, isDangerous: false, sanitized: String(pageNum) };
  }

  return { isValid: true, isDangerous: false, sanitized: trimmed };
}

/**
 * Write bookmarks into PDF Catalog /Outlines hierarchy
 */
export async function writeBookmarksToPdf(
  pdfBytes: Uint8Array,
  bookmarks: PdfBookmarkItem[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pageCount = pdfDoc.getPageCount();

  if (!bookmarks.length) return pdfBytes;

  const outlinesDict = pdfDoc.context.obj({
    Type: 'Outlines',
  });
  const outlinesRef = pdfDoc.context.register(outlinesDict);

  // Helper to build outline items recursively
  const buildOutlineItems = (
    items: PdfBookmarkItem[],
    parentRef: any
  ): { firstRef: any; lastRef: any; count: number } => {
    let firstRef: any = null;
    let prevRef: any = null;
    let prevDict: any = null;
    let totalCount = 0;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const targetPageIdx = Math.max(0, Math.min(pageCount - 1, item.pageIndex));
      const pageRef = pdfDoc.getPage(targetPageIdx).ref;

      // Create outline item dictionary
      const itemDict = pdfDoc.context.obj({
        Title: PDFString.of(item.title),
        Parent: parentRef,
        Dest: [pageRef, PDFName.of('Fit')],
      });
      const itemRef = pdfDoc.context.register(itemDict);

      if (!firstRef) firstRef = itemRef;

      if (prevDict && prevRef) {
        prevDict.set(PDFName.of('Next'), itemRef);
        itemDict.set(PDFName.of('Prev'), prevRef);
      }

      prevRef = itemRef;
      prevDict = itemDict;
      totalCount++;

      // Process children if any
      if (item.children && item.children.length > 0) {
        const childRes = buildOutlineItems(item.children, itemRef);
        if (childRes.firstRef) {
          itemDict.set(PDFName.of('First'), childRes.firstRef);
          itemDict.set(PDFName.of('Last'), childRes.lastRef);
          itemDict.set(PDFName.of('Count'), PDFNumber.of(childRes.count));
          totalCount += childRes.count;
        }
      }
    }

    return { firstRef, lastRef: prevRef, count: totalCount };
  };

  const topRes = buildOutlineItems(bookmarks, outlinesRef);
  if (topRes.firstRef) {
    outlinesDict.set(PDFName.of('First'), topRes.firstRef);
    outlinesDict.set(PDFName.of('Last'), topRes.lastRef);
    outlinesDict.set(PDFName.of('Count'), PDFNumber.of(topRes.count));
    pdfDoc.catalog.set(PDFName.of('Outlines'), outlinesRef);
  }

  return await pdfDoc.save();
}

/**
 * Generate and insert a dedicated, clickable Table of Contents (TOC) page
 */
export async function generateTocPage(
  pdfBytes: Uint8Array,
  headings: TocHeadingCandidate[],
  title: string = 'İÇİNDEKİLER'
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Insert TOC at page 0
  const tocPage = pdfDoc.insertPage(0, [595.28, 841.89]);
  const { width, height } = tocPage.getSize();

  // Draw Title
  tocPage.drawText(title, {
    x: 50,
    y: height - 70,
    size: 20,
    font: fontBold,
    color: rgb(0.1, 0.1, 0.2),
  });

  tocPage.drawLine({
    start: { x: 50, y: height - 85 },
    end: { x: width - 50, y: height - 85 },
    thickness: 1.5,
    color: rgb(0.3, 0.3, 0.8),
  });

  let curY = height - 120;
  const filteredHeadings = headings.filter((h) => h.selected);

  for (let idx = 0; idx < filteredHeadings.length; idx++) {
    if (curY < 60) break; // page boundary
    const h = filteredHeadings[idx];

    // Offset target page by +1 because TOC page was inserted at index 0
    const targetPageIndex = h.pageIndex + 1;
    const targetPageNum = targetPageIndex + 1;

    const indent = (h.level - 1) * 18;
    const itemFont = h.level === 1 ? fontBold : fontRegular;
    const itemFontSize = h.level === 1 ? 12 : 10;

    const textX = 50 + indent;
    const pageNumText = String(targetPageNum);
    const numWidth = itemFont.widthOfTextAtSize(pageNumText, itemFontSize);
    const numX = width - 50 - numWidth;

    // Draw item text
    tocPage.drawText(h.title, {
      x: textX,
      y: curY,
      size: itemFontSize,
      font: itemFont,
      color: rgb(0.15, 0.15, 0.2),
    });

    // Draw page number
    tocPage.drawText(pageNumText, {
      x: numX,
      y: curY,
      size: itemFontSize,
      font: itemFont,
      color: rgb(0.2, 0.2, 0.3),
    });

    // Draw dots
    const titleWidth = itemFont.widthOfTextAtSize(h.title, itemFontSize);
    const dotsStartX = textX + titleWidth + 6;
    const dotsEndX = numX - 6;
    if (dotsEndX > dotsStartX + 10) {
      const dotSpan = '. '.repeat(Math.floor((dotsEndX - dotsStartX) / 6));
      tocPage.drawText(dotSpan, {
        x: dotsStartX,
        y: curY,
        size: itemFontSize,
        font: fontRegular,
        color: rgb(0.6, 0.6, 0.7),
      });
    }

    // Add clickable Link Annotation to target page
    if (targetPageIndex < pdfDoc.getPageCount()) {
      const targetRef = pdfDoc.getPage(targetPageIndex).ref;
      const linkDict = pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [textX, curY - 2, width - 50, curY + itemFontSize + 2],
        Border: [0, 0, 0],
        Dest: [targetRef, PDFName.of('Fit')],
      });
      const linkRef = pdfDoc.context.register(linkDict);

      const annots = tocPage.node.get(PDFName.of('Annots'));
      if (annots instanceof PDFArray) {
        annots.push(linkRef);
      } else {
        tocPage.node.set(PDFName.of('Annots'), pdfDoc.context.obj([linkRef]));
      }
    }

    curY -= h.level === 1 ? 24 : 18;
  }

  return await pdfDoc.save();
}

/**
 * Add Link Annotations (external HTTPS, mailto, internal page GoTo)
 */
export async function addLinksToPdf(
  pdfBytes: Uint8Array,
  links: PdfLinkItem[]
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pageCount = pdfDoc.getPageCount();

  for (const link of links) {
    if (link.pageIndex < 0 || link.pageIndex >= pageCount) continue;

    const validation = validateLink(link.target, link.type);
    if (!validation.isValid || validation.isDangerous) {
      console.warn('Güvensiz veya geçersiz bağlantı reddedildi:', link.target);
      continue;
    }

    const page = pdfDoc.getPage(link.pageIndex);
    const [minX, minY, maxX, maxY] = link.rect;

    let actionDict: any;
    if (link.type === 'external' || link.type === 'email') {
      actionDict = pdfDoc.context.obj({
        S: 'URI',
        URI: PDFString.of(validation.sanitized),
      });
    } else if (link.type === 'internal') {
      const targetPageNum = parseInt(validation.sanitized, 10);
      const targetIdx = Math.max(0, Math.min(pageCount - 1, targetPageNum - 1));
      const targetRef = pdfDoc.getPage(targetIdx).ref;
      actionDict = pdfDoc.context.obj({
        S: 'GoTo',
        D: [targetRef, PDFName.of('Fit')],
      });
    }

    if (actionDict) {
      const linkDict = pdfDoc.context.obj({
        Type: 'Annot',
        Subtype: 'Link',
        Rect: [minX, minY, maxX, maxY],
        Border: [0, 0, 1], // subtle underline border
        C: [0.1, 0.4, 0.9],
        A: actionDict,
      });
      const linkRef = pdfDoc.context.register(linkDict);

      const annots = page.node.get(PDFName.of('Annots'));
      if (annots instanceof PDFArray) {
        annots.push(linkRef);
      } else {
        page.node.set(PDFName.of('Annots'), pdfDoc.context.obj([linkRef]));
      }
    }
  }

  return await pdfDoc.save();
}

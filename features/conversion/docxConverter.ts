import { Document, Paragraph, TextRun, Packer, HeadingLevel, Table, TableRow, TableCell, WidthType, BorderStyle, AlignmentType } from "docx";
import mammoth from "mammoth";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";

export interface PdfToDocxOptions {
  title?: string;
  creator?: string;
  detectTables?: boolean;
}

export interface DocxToPdfOptions {
  title?: string;
  author?: string;
  fontSize?: number;
  lineHeight?: number;
  margins?: number;
}

export function toSafePdfText(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/ğ/g, 'g')
    .replace(/Ğ/g, 'G')
    .replace(/ş/g, 's')
    .replace(/Ş/g, 'S')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'I')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/[^\x20-\xFF]/g, ' ')
    .trim();
}

// Polyfill Promise.withResolvers for Node / older engines if needed
if (typeof (Promise as any).withResolvers === "undefined") {
  (Promise as any).withResolvers = function () {
    let resolve: any, reject: any;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

/**
 * Loads pdfjs-dist safely in both Browser and Node.js
 */
async function getPdfjs() {
  const isNode = typeof window === "undefined" || (typeof process !== "undefined" && Boolean(process?.versions?.node));
  if (isNode) {
    const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const { pathToFileURL } = await import("node:url");
    const path = await import("node:path");
    pdfjsLib.GlobalWorkerOptions.workerSrc = pathToFileURL(
      path.resolve("node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs")
    ).href;
    return pdfjsLib;
  } else {
    const pdfjsLib = await import("pdfjs-dist");
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    }
    return pdfjsLib;
  }
}

interface ExtractedTextItem {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
  fontSize: number;
  fontName: string;
  isBold: boolean;
  isItalic: boolean;
}

interface TextLine {
  y: number;
  items: ExtractedTextItem[];
  fullText: string;
  maxFontSize: number;
  isAllBold: boolean;
}

/**
 * 1. Convert PDF bytes to an editable Microsoft Word (.docx) file
 */
export async function pdfToDocx(
  pdfBytes: Uint8Array,
  options?: PdfToDocxOptions
): Promise<Uint8Array> {
  const prefix = new TextDecoder("latin1").decode(pdfBytes.slice(0, 1024));
  if (!prefix.includes("%PDF-")) {
    throw new Error("Geçersiz PDF dosyası: Dosya %PDF- başlığı içermiyor.");
  }

  const pdfjs = await getPdfjs();
  const loadingTask = pdfjs.getDocument({
    data: pdfBytes.slice(0),
    cMapPacked: true
  });
  const doc = await loadingTask.promise;
  const numPages = doc.numPages;

  const docxElements: (Paragraph | Table)[] = [];

  for (let p = 1; p <= numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent();
    const items = content.items as any[];

    if (!items || items.length === 0) {
      docxElements.push(
        new Paragraph({
          pageBreakBefore: p > 1,
          children: [new TextRun({ text: `[Sayfa ${p} - Boş Sayfa]`, italics: true, color: "888888" })],
          spacing: { after: 160 }
        })
      );
      continue;
    }

    // Parse items
    const parsedItems: ExtractedTextItem[] = [];
    for (const item of items) {
      if (!item.str || item.str.trim() === "") continue;
      const transform = item.transform || [12, 0, 0, 12, 0, 0];
      const fontSize = Math.round(Math.hypot(transform[0], transform[1])) || Math.round(item.height) || 11;
      const fontName = (item.fontName || "").toLowerCase();
      const isBold = /bold|black|heavy|semibold|g_d0_f1/i.test(fontName);
      const isItalic = /italic|oblique/i.test(fontName);

      parsedItems.push({
        str: item.str,
        x: Math.round(transform[4] * 10) / 10,
        y: Math.round(transform[5] * 10) / 10,
        w: item.width || item.str.length * fontSize * 0.55,
        h: item.height || fontSize,
        fontSize,
        fontName,
        isBold,
        isItalic
      });
    }

    // Group items into lines by Y (clustering threshold: 4.5 points)
    const linesMap = new Map<number, ExtractedTextItem[]>();
    for (const item of parsedItems) {
      let matchedY: number | null = null;
      for (const existingY of linesMap.keys()) {
        if (Math.abs(existingY - item.y) <= 4.5) {
          matchedY = existingY;
          break;
        }
      }
      if (matchedY !== null) {
        linesMap.get(matchedY)!.push(item);
      } else {
        linesMap.set(item.y, [item]);
      }
    }

    // Sort lines from top of page down to bottom (descending Y)
    const sortedYs = Array.from(linesMap.keys()).sort((a, b) => b - a);
    const lines: TextLine[] = [];

    for (const y of sortedYs) {
      const lineItems = linesMap.get(y)!.sort((a, b) => a.x - b.x);
      const fullText = lineItems.map(i => i.str).join(" ");
      const maxFontSize = Math.max(...lineItems.map(i => i.fontSize));
      const isAllBold = lineItems.every(i => i.isBold);
      lines.push({ y, items: lineItems, fullText, maxFontSize, isAllBold });
    }

    // Process lines into paragraphs and tables
    let lineIdx = 0;
    let isFirstLineOfPage = true;

    while (lineIdx < lines.length) {
      const line = lines[lineIdx];

      // Detect table: consecutive lines with multiple distinct columns separated by substantial X gaps (> 30pt)
      const isTableCandidate = line.items.length >= 2 && line.items.some((item, idx) => {
        if (idx === 0) return false;
        const prev = line.items[idx - 1];
        return (item.x - (prev.x + prev.w)) > 30;
      });

      if (isTableCandidate && options?.detectTables !== false) {
        // Collect consecutive table rows
        const tableLines: TextLine[] = [];
        while (lineIdx < lines.length) {
          const cand = lines[lineIdx];
          if (cand.items.length >= 2 || (tableLines.length > 0 && cand.items.length === 1 && tableLines[tableLines.length - 1].items.length >= 2)) {
            tableLines.push(cand);
            lineIdx++;
          } else {
            break;
          }
        }

        if (tableLines.length >= 2) {
          // Determine maximum column count
          const maxCols = Math.max(...tableLines.map(tl => tl.items.length));
          const rows: TableRow[] = [];

          for (let r = 0; r < tableLines.length; r++) {
            const tl = tableLines[r];
            const isHeader = r === 0;
            const cells: TableCell[] = [];

            for (let c = 0; c < maxCols; c++) {
              const item = tl.items[c];
              const cellText = item ? item.str : "";
              cells.push(
                new TableCell({
                  children: [
                    new Paragraph({
                      children: [
                        new TextRun({
                          text: cellText,
                          bold: isHeader || (item?.isBold ?? false),
                          size: (item?.fontSize || 10) * 2
                        })
                      ],
                      spacing: { before: 60, after: 60 }
                    })
                  ],
                  shading: isHeader ? { fill: "F1F5F9" } : undefined
                })
              );
            }
            rows.push(new TableRow({ children: cells }));
          }

          docxElements.push(
            new Table({
              rows,
              width: { size: 100, type: WidthType.PERCENTAGE }
            })
          );
          // Space after table
          docxElements.push(new Paragraph({ spacing: { after: 120 } }));
          isFirstLineOfPage = false;
          continue;
        } else {
          // If only 1 line matched, treat as normal paragraph
          lineIdx -= tableLines.length;
        }
      }

      // Check for Headings
      let headingLevel: (typeof HeadingLevel)[keyof typeof HeadingLevel] | undefined = undefined;
      if (line.maxFontSize >= 20) {
        headingLevel = HeadingLevel.HEADING_1;
      } else if (line.maxFontSize >= 15) {
        headingLevel = HeadingLevel.HEADING_2;
      } else if (line.maxFontSize >= 13 && line.isAllBold) {
        headingLevel = HeadingLevel.HEADING_3;
      }

      // Check for Bullet or Numbered List
      const trimmed = line.fullText.trim();
      const isBullet = /^[•–\-\*\u2022\u25cf]\s*/.test(trimmed);

      // Build TextRuns for this line
      const runs: TextRun[] = [];
      for (const item of line.items) {
        let text = item.str;
        if (isBullet && item === line.items[0]) {
          text = text.replace(/^[•–\-\*\u2022\u25cf]\s*/, "");
        }
        if (!text) continue;

        runs.push(
          new TextRun({
            text: text + " ",
            size: item.fontSize * 2, // docx uses half-points (11pt = 22)
            bold: item.isBold || headingLevel !== undefined,
            italics: item.isItalic,
            font: "Calibri"
          })
        );
      }

      if (runs.length > 0) {
        docxElements.push(
          new Paragraph({
            heading: headingLevel,
            bullet: isBullet ? { level: 0 } : undefined,
            pageBreakBefore: isFirstLineOfPage && p > 1,
            children: runs,
            spacing: {
              before: headingLevel ? 180 : 0,
              after: headingLevel ? 120 : 100
            }
          })
        );
      }

      isFirstLineOfPage = false;
      lineIdx++;
    }
  }

  if (docxElements.length === 0) {
    docxElements.push(new Paragraph({ children: [new TextRun("Boş belge")] }));
  }

  const wordDoc = new Document({
    creator: options?.creator || "Forma Belge Atölyesi",
    title: options?.title || "Dönüştürülmüş Belge",
    styles: {
      default: {
        document: {
          run: {
            font: "Calibri",
            size: 22 // 11 pt
          }
        }
      }
    },
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 1440, // 1 inch
              bottom: 1440,
              left: 1440,
              right: 1440
            }
          }
        },
        children: docxElements
      }
    ]
  });

  const buffer = await Packer.toBuffer(wordDoc);
  return new Uint8Array(buffer);
}

/**
 * 2. Convert Word (.docx) bytes into a vector A4 PDF file
 */
export async function docxToPdf(
  docxBytes: Uint8Array,
  options?: DocxToPdfOptions
): Promise<Uint8Array> {
  const isNode = typeof window === "undefined" || (typeof process !== "undefined" && Boolean(process?.versions?.node));
  
  // Extract HTML from docx using mammoth
  let mammothHtml = "";
  if (isNode) {
    const res = await mammoth.convertToHtml({ buffer: Buffer.from(docxBytes) });
    mammothHtml = res.value;
  } else {
    const arrayBuffer = docxBytes.buffer.slice(
      docxBytes.byteOffset,
      docxBytes.byteOffset + docxBytes.byteLength
    );
    const res = await mammoth.convertToHtml({ arrayBuffer });
    mammothHtml = res.value;
  }

  if (!mammothHtml || mammothHtml.trim() === "") {
    mammothHtml = "<p>Boş Belge</p>";
  }

  // Generate vector PDF from HTML structure using PDFDocument
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const PAGE_WIDTH = 595.28;
  const PAGE_HEIGHT = 841.89;
  const MARGIN_LEFT = options?.margins ?? 50;
  const MARGIN_RIGHT = options?.margins ?? 50;
  const MARGIN_TOP = options?.margins ?? 54;
  const MARGIN_BOTTOM = options?.margins ?? 54;
  const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

  let currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let currentY = PAGE_HEIGHT - MARGIN_TOP;

  function checkPageBreak(neededHeight: number) {
    if (currentY - neededHeight < MARGIN_BOTTOM) {
      currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      currentY = PAGE_HEIGHT - MARGIN_TOP;
    }
  }

  // Parse HTML elements with regex (works in both Node and Browser without DOM dependencies)
  const blockRegex = /<(h[1-6]|p|li|tr)[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;

  while ((match = blockRegex.exec(mammothHtml)) !== null) {
    const tag = match[1].toLowerCase();
    const innerHtml = match[2];

    // Determine block styles
    let fontSize = 11;
    let isHeading = false;
    let isBullet = tag === "li";
    let isTableRow = tag === "tr";
    let activeFont = fontRegular;
    let textColor = rgb(0.12, 0.15, 0.2);

    if (tag === "h1") {
      fontSize = 20;
      isHeading = true;
      activeFont = fontBold;
      textColor = rgb(0.06, 0.09, 0.16);
    } else if (tag === "h2") {
      fontSize = 15;
      isHeading = true;
      activeFont = fontBold;
      textColor = rgb(0.1, 0.13, 0.2);
    } else if (tag === "h3") {
      fontSize = 13;
      isHeading = true;
      activeFont = fontBold;
    }

    if (isTableRow) {
      // Handle table row: extract td/th
      const cellRegex = /<(td|th)[^>]*>([\s\S]*?)<\/\1>/gi;
      const cellTexts: string[] = [];
      let cMatch: RegExpExecArray | null;
      while ((cMatch = cellRegex.exec(innerHtml)) !== null) {
        const cleanCell = cMatch[2].replace(/<[^>]+>/g, "").trim();
        cellTexts.push(cleanCell);
      }

      if (cellTexts.length > 0) {
        const colWidth = CONTENT_WIDTH / cellTexts.length;
        const rowHeight = 22;
        checkPageBreak(rowHeight + 6);

        // Draw cells
        for (let i = 0; i < cellTexts.length; i++) {
          const cellX = MARGIN_LEFT + i * colWidth;
          currentPage.drawRectangle({
            x: cellX,
            y: currentY - rowHeight,
            width: colWidth,
            height: rowHeight,
            borderColor: rgb(0.8, 0.85, 0.9),
            borderWidth: 0.5,
            color: rgb(0.98, 0.99, 1.0)
          });
          const safeText = toSafePdfText(cellTexts[i].slice(0, 35));
          currentPage.drawText(safeText, {
            x: cellX + 6,
            y: currentY - 15,
            size: 9.5,
            font: fontRegular,
            color: rgb(0.2, 0.25, 0.3)
          });
        }
        currentY -= rowHeight;
      }
      continue;
    }

    // Clean inline formatting tags while capturing raw text
    const hasBold = /<strong[^>]*>|<b[^>]*>/i.test(innerHtml);
    const hasItalic = /<em[^>]*>|<i[^>]*>/i.test(innerHtml);
    if (hasBold && !isHeading) activeFont = fontBold;
    else if (hasItalic && !isHeading) activeFont = fontItalic;

    const rawText = innerHtml
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<[^>]+>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();

    if (!rawText) {
      currentY -= 8;
      continue;
    }

    // Word wrap text within CONTENT_WIDTH
    const safeRawText = toSafePdfText(rawText);
    const prefix = isBullet ? "-  " : "";
    const linesToDraw: string[] = [];
    const words = (prefix + safeRawText).split(/\s+/);
    let currentLine = "";

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = activeFont.widthOfTextAtSize(testLine, fontSize);
      if (testWidth > CONTENT_WIDTH && currentLine) {
        linesToDraw.push(currentLine);
        currentLine = (isBullet ? "   " : "") + word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) linesToDraw.push(currentLine);

    const lineHeight = fontSize * 1.35;
    const totalBlockHeight = linesToDraw.length * lineHeight + (isHeading ? 14 : 8);

    checkPageBreak(totalBlockHeight);

    if (isHeading) currentY -= 6;

    for (const l of linesToDraw) {
      currentPage.drawText(toSafePdfText(l), {
        x: MARGIN_LEFT,
        y: currentY - fontSize,
        size: fontSize,
        font: activeFont,
        color: textColor
      });
      currentY -= lineHeight;
    }

    currentY -= isHeading ? 10 : 6;
  }

  // Draw footer page numbers
  const totalPages = pdfDoc.getPageCount();
  for (let i = 0; i < totalPages; i++) {
    const p = pdfDoc.getPage(i);
    const pageStr = `Sayfa ${i + 1} / ${totalPages}`;
    const strWidth = fontRegular.widthOfTextAtSize(pageStr, 8.5);
    p.drawText(pageStr, {
      x: (PAGE_WIDTH - strWidth) / 2,
      y: 24,
      size: 8.5,
      font: fontRegular,
      color: rgb(0.5, 0.55, 0.6)
    });
  }

  return await pdfDoc.save();
}

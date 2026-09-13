import { PDFDocument, rgb, StandardFonts } from '@cantoo/pdf-lib';
import JSZip from 'jszip';

export interface ExcelToPdfOptions {
  orientation?: 'portrait' | 'landscape' | 'auto';
  pageSize?: 'A4' | 'Letter';
  sheetIndex?: number;
  fontSize?: number;
  theme?: 'slate' | 'minimal' | 'corporate';
  showRowNumbers?: boolean;
  title?: string;
}

export interface ParsedSheet {
  name: string;
  rows: string[][];
  rowCount: number;
  colCount: number;
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

function colLetterToIndex(colStr: string): number {
  let index = 0;
  for (let i = 0; i < colStr.length; i++) {
    index = index * 26 + (colStr.charCodeAt(i) - 64);
  }
  return Math.max(0, index - 1);
}

function unescapeXml(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

export function parseCsvContent(csvText: string): string[][] {
  const lines = csvText.split(/\r?\n/);
  const rows: string[][] = [];

  let delimiter = ',';
  for (const line of lines) {
    if (!line.trim()) continue;
    const commas = (line.match(/,/g) || []).length;
    const semicolons = (line.match(/;/g) || []).length;
    const tabs = (line.match(/\t/g) || []).length;
    if (semicolons > commas && semicolons > tabs) delimiter = ';';
    else if (tabs > commas && tabs > semicolons) delimiter = '\t';
    break;
  }

  for (const rawLine of lines) {
    if (!rawLine.trim()) continue;

    const row: string[] = [];
    let inQuote = false;
    let currentCell = '';

    for (let i = 0; i < rawLine.length; i++) {
      const char = rawLine[i];
      if (char === '"') {
        if (inQuote && rawLine[i + 1] === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuote = !inQuote;
        }
      } else if (char === delimiter && !inQuote) {
        row.push(currentCell.trim());
        currentCell = '';
      } else {
        currentCell += char;
      }
    }
    row.push(currentCell.trim());
    if (row.some(c => c !== '')) {
      rows.push(row);
    }
  }

  return rows;
}

export async function parseXlsxSheets(xlsxBytes: Uint8Array): Promise<ParsedSheet[]> {
  const zip = await JSZip.loadAsync(xlsxBytes);

  const sharedStrings: string[] = [];
  const sharedStringsFile = zip.file('xl/sharedStrings.xml');
  if (sharedStringsFile) {
    const sstXml = await sharedStringsFile.async('text');
    const siMatches = sstXml.match(/<si\b[^>]*>([\s\S]*?)<\/si>/g) || [];
    for (const si of siMatches) {
      const tMatches = si.match(/<t\b[^>]*>([\s\S]*?)<\/t>/g) || [];
      const text = tMatches
        .map(t => unescapeXml(t.replace(/<t\b[^>]*>/, '').replace(/<\/t>/, '')))
        .join('');
      sharedStrings.push(text);
    }
  }

  const workbookFile = zip.file('xl/workbook.xml');
  if (!workbookFile) {
    throw new Error('Geçerli Excel belgesi değil: xl/workbook.xml bulunamadı.');
  }
  const workbookXml = await workbookFile.async('text');

  const relsMap: Record<string, string> = {};
  const relsFile = zip.file('xl/_rels/workbook.xml.rels');
  if (relsFile) {
    const relsXml = await relsFile.async('text');
    const relMatches = relsXml.match(/<Relationship\b[^>]*\/>/g) || [];
    for (const rel of relMatches) {
      const idMatch = rel.match(/Id="([^"]+)"/);
      const targetMatch = rel.match(/Target="([^"]+)"/);
      if (idMatch && targetMatch) {
        let target = targetMatch[1];
        if (!target.startsWith('xl/')) {
          target = target.startsWith('/') ? target.slice(1) : `xl/${target}`;
        }
        relsMap[idMatch[1]] = target;
      }
    }
  }

  const sheetMatches = workbookXml.match(/<sheet\b[^>]*\/>/g) || [];
  const sheets: ParsedSheet[] = [];

  for (let s = 0; s < sheetMatches.length; s++) {
    const sheetTag = sheetMatches[s];
    const nameMatch = sheetTag.match(/name="([^"]+)"/);
    const rIdMatch = sheetTag.match(/r:id="([^"]+)"/);

    const sheetName = nameMatch ? unescapeXml(nameMatch[1]) : `Sayfa ${s + 1}`;
    const rId = rIdMatch ? rIdMatch[1] : `rId${s + 1}`;
    const targetPath = relsMap[rId] || `xl/worksheets/sheet${s + 1}.xml`;

    const sheetXmlFile = zip.file(targetPath) || zip.file(`xl/worksheets/sheet${s + 1}.xml`);
    if (!sheetXmlFile) continue;

    const sheetXml = await sheetXmlFile.async('text');
    const rows: string[][] = [];

    const rowMatches = sheetXml.match(/<row\b[^>]*>([\s\S]*?)<\/row>/g) || [];
    let maxCols = 0;

    for (const rowXml of rowMatches) {
      const cellMatches = rowXml.match(/<c\b[^>]*>([\s\S]*?)<\/c>|<c\b[^>]*\/>/g) || [];
      const rowCells: string[] = [];

      for (const cellXml of cellMatches) {
        const refMatch = cellXml.match(/r="([A-Z]+)(\d+)"/);
        const typeMatch = cellXml.match(/t="([^"]+)"/);
        const cellType = typeMatch ? typeMatch[1] : '';

        const vMatch = cellXml.match(/<v>([\s\S]*?)<\/v>/);
        const inlineMatch = cellXml.match(/<is><t\b[^>]*>([\s\S]*?)<\/t><\/is>/);

        let value = '';
        if (cellType === 's' && vMatch) {
          const idx = parseInt(vMatch[1], 10);
          value = sharedStrings[idx] ?? '';
        } else if (cellType === 'inlineStr' && inlineMatch) {
          value = unescapeXml(inlineMatch[1]);
        } else if (cellType === 'b' && vMatch) {
          value = vMatch[1] === '1' ? 'DOĞRU' : 'YANLIŞ';
        } else if (vMatch) {
          value = unescapeXml(vMatch[1]);
        }

        let colIdx = rowCells.length;
        if (refMatch) {
          colIdx = colLetterToIndex(refMatch[1]);
        }

        while (rowCells.length < colIdx) {
          rowCells.push('');
        }
        rowCells[colIdx] = value;
      }

      if (rowCells.some(c => (c || '').trim() !== '')) {
        rows.push(rowCells);
        if (rowCells.length > maxCols) maxCols = rowCells.length;
      }
    }

    for (const r of rows) {
      while (r.length < maxCols) r.push('');
    }

    sheets.push({
      name: sheetName,
      rows,
      rowCount: rows.length,
      colCount: maxCols
    });
  }

  if (sheets.length === 0) {
    throw new Error('Excel dosyasında okunabilir veri tablosu bulunamadı.');
  }

  return sheets;
}

export async function excelToPdf(
  input: Uint8Array | string,
  options: ExcelToPdfOptions = {}
): Promise<Uint8Array> {
  let rows: string[][] = [];
  let sheetName = 'Tablo';

  if (typeof input === 'string') {
    rows = parseCsvContent(input);
    sheetName = options.title || 'CSV Verisi';
  } else {
    const textSample = new TextDecoder('utf-8', { fatal: false }).decode(input.slice(0, 100));
    if (textSample.startsWith('PK\x03\x04') || textSample.includes('[Content_Types].xml')) {
      const sheets = await parseXlsxSheets(input);
      const chosenSheet = sheets[options.sheetIndex || 0] || sheets[0];
      rows = chosenSheet.rows;
      sheetName = chosenSheet.name;
    } else {
      const csvStr = new TextDecoder('utf-8').decode(input);
      rows = parseCsvContent(csvStr);
      sheetName = options.title || 'Tablo';
    }
  }

  if (!rows || rows.length === 0) {
    rows = [['Veri Yok'], ['Excel dosyasında satır bulunamadı.']];
  }

  if (options.showRowNumbers) {
    rows = rows.map((row, idx) => {
      if (idx === 0) return ['#', ...row];
      return [String(idx), ...row];
    });
  }

  const colCount = Math.max(...rows.map(r => r.length), 1);

  for (const row of rows) {
    while (row.length < colCount) row.push('');
  }

  let orientation = options.orientation || 'auto';
  if (orientation === 'auto') {
    orientation = colCount > 5 ? 'landscape' : 'portrait';
  }

  const isLandscape = orientation === 'landscape';
  const pageWidth = isLandscape ? 841.89 : 595.28;
  const pageHeight = isLandscape ? 595.28 : 841.89;

  const margin = 36;
  const contentWidth = pageWidth - 2 * margin;

  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);

  const theme = options.theme || 'slate';
  let headerBg = rgb(0.09, 0.13, 0.20);
  let headerText = rgb(1, 1, 1);
  let zebraBg = rgb(0.97, 0.98, 0.99);
  let borderColor = rgb(0.88, 0.91, 0.94);
  let primaryAccent = rgb(0.14, 0.38, 0.92);

  if (theme === 'corporate') {
    headerBg = rgb(0.10, 0.21, 0.36);
    primaryAccent = rgb(0.12, 0.31, 0.55);
  } else if (theme === 'minimal') {
    headerBg = rgb(0.25, 0.28, 0.32);
    zebraBg = rgb(1, 1, 1);
  }

  const fontSize = options.fontSize || 8.5;
  const rowHeight = fontSize * 2.2;
  const headerHeight = rowHeight * 1.25;

  const colLengths = new Array(colCount).fill(4);
  for (const row of rows) {
    for (let c = 0; c < colCount; c++) {
      const len = (row[c] || '').length;
      if (len > colLengths[c]) colLengths[c] = Math.min(len, 40);
    }
  }

  const totalLengths = colLengths.reduce((acc, v) => acc + v, 0);
  const colWidths = colLengths.map(l => {
    const rawW = (l / totalLengths) * contentWidth;
    return Math.max(30, rawW);
  });

  const sumWidths = colWidths.reduce((a, b) => a + b, 0);
  const widthRatio = contentWidth / sumWidths;
  for (let c = 0; c < colCount; c++) {
    colWidths[c] = colWidths[c] * widthRatio;
  }

  let currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let pageIndex = 1;
  const pagesList = [currentPage];

  const drawDocumentBanner = (page: any, pIdx: number) => {
    const title = toSafePdfText(options.title || sheetName);
    page.drawText(title, {
      x: margin,
      y: pageHeight - margin + 6,
      size: 13,
      font: fontBold,
      color: headerBg
    });

    const metaText = `Sayfa ${pIdx}  |  Toplam: ${rows.length - 1} Satir  |  Tarih: ${new Date().toLocaleDateString('tr-TR')}`;
    page.drawText(toSafePdfText(metaText), {
      x: pageWidth - margin - 220,
      y: pageHeight - margin + 7,
      size: 8,
      font: fontRegular,
      color: rgb(0.45, 0.48, 0.55)
    });

    page.drawLine({
      start: { x: margin, y: pageHeight - margin },
      end: { x: pageWidth - margin, y: pageHeight - margin },
      thickness: 1.5,
      color: primaryAccent
    });
  };

  const drawTableHeader = (page: any, yPos: number) => {
    page.drawRectangle({
      x: margin,
      y: yPos - headerHeight,
      width: contentWidth,
      height: headerHeight,
      color: headerBg
    });

    let curX = margin;
    const headerRow = rows[0] || [];
    for (let c = 0; c < colCount; c++) {
      const w = colWidths[c];
      const cellText = toSafePdfText(headerRow[c] || `Sutun ${c + 1}`);

      page.drawText(cellText.slice(0, Math.floor(w / (fontSize * 0.5))), {
        x: curX + 6,
        y: yPos - headerHeight + (headerHeight - fontSize) / 2 + 2,
        size: fontSize,
        font: fontBold,
        color: headerText
      });

      curX += w;
    }
  };

  drawDocumentBanner(currentPage, pageIndex);
  let currentY = pageHeight - margin - 14;
  drawTableHeader(currentPage, currentY);
  currentY -= headerHeight;

  for (let r = 1; r < rows.length; r++) {
    if (currentY - rowHeight < margin + 20) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      pageIndex++;
      pagesList.push(currentPage);

      drawDocumentBanner(currentPage, pageIndex);
      currentY = pageHeight - margin - 14;
      drawTableHeader(currentPage, currentY);
      currentY -= headerHeight;
    }

    const isEven = r % 2 === 0;
    const row = rows[r];

    if (isEven && theme !== 'minimal') {
      currentPage.drawRectangle({
        x: margin,
        y: currentY - rowHeight,
        width: contentWidth,
        height: rowHeight,
        color: zebraBg
      });
    }

    currentPage.drawLine({
      start: { x: margin, y: currentY - rowHeight },
      end: { x: pageWidth - margin, y: currentY - rowHeight },
      thickness: 0.5,
      color: borderColor
    });

    let curX = margin;
    for (let c = 0; c < colCount; c++) {
      const w = colWidths[c];
      const val = toSafePdfText(row[c] || '');

      const isNum = !isNaN(Number(val)) && val !== '' && !val.includes('/');
      const textMaxChars = Math.floor((w - 10) / (fontSize * 0.48));
      const displayVal = val.length > textMaxChars ? val.slice(0, textMaxChars - 1) + '...' : val;

      const textX = isNum
        ? curX + w - Math.min(w - 6, displayVal.length * (fontSize * 0.5) + 6)
        : curX + 6;

      currentPage.drawText(displayVal, {
        x: Math.max(curX + 4, textX),
        y: currentY - rowHeight + (rowHeight - fontSize) / 2 + 1,
        size: fontSize,
        font: fontRegular,
        color: rgb(0.12, 0.15, 0.20)
      });

      if (c > 0) {
        currentPage.drawLine({
          start: { x: curX, y: currentY },
          end: { x: curX, y: currentY - rowHeight },
          thickness: 0.5,
          color: borderColor
        });
      }

      curX += w;
    }

    currentY -= rowHeight;
  }

  const totalPages = pagesList.length;
  for (let i = 0; i < totalPages; i++) {
    const page = pagesList[i];
    const footerText = toSafePdfText(`Forma Belge Atolyesi  -  Sayfa ${i + 1} / ${totalPages}`);
    page.drawText(footerText, {
      x: pageWidth / 2 - 60,
      y: margin - 15,
      size: 8,
      font: fontRegular,
      color: rgb(0.55, 0.58, 0.65)
    });
  }

  return await pdfDoc.save();
}

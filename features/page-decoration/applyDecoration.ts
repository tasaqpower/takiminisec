import { PDFDocument, rgb, degrees, StandardFonts } from '@cantoo/pdf-lib';
import type { PageDecorationConfig, PageNumberFormat, NinePosition } from './decorationTypes';

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace('#', '');
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16) || 0;
  return {
    r: ((num >> 16) & 255) / 255,
    g: ((num >> 8) & 255) / 255,
    b: (num & 255) / 255,
  };
}

function toRoman(num: number): string {
  const lookup: [number, string][] = [
    [1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'],
    [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'],
    [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']
  ];
  let roman = '';
  for (const [val, str] of lookup) {
    while (num >= val) {
      roman += str;
      num -= val;
    }
  }
  return roman || 'i';
}

function toAlpha(num: number): string {
  let s = '';
  while (num > 0) {
    const mod = (num - 1) % 26;
    s = String.fromCharCode(97 + mod) + s;
    num = Math.floor((num - 1) / 26);
  }
  return s || 'a';
}

export function formatPageNumber(num: number, format: PageNumberFormat): string {
  switch (format) {
    case '01':
      return String(num).padStart(2, '0');
    case 'i':
      return toRoman(num);
    case 'I':
      return toRoman(num).toUpperCase();
    case 'a':
      return toAlpha(num);
    case 'A':
      return toAlpha(num).toUpperCase();
    case '1':
    default:
      return String(num);
  }
}

export async function applyPageDecorations(
  pdfBytes: Uint8Array,
  config: PageDecorationConfig
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.load(pdfBytes);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const pageCount = pdfDoc.getPageCount();

  const now = new Date();
  const dateStr = now.toLocaleDateString('tr-TR');
  const timeStr = now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const fileNameStr = config.fileName || 'belge.pdf';

  // Pre-embed watermark image if configured
  let embeddedImage: any = null;
  if (config.watermark.enabled && config.watermark.type === 'image' && config.watermark.imageDataUrl) {
    const b64 = config.watermark.imageDataUrl.split(',')[1];
    if (b64) {
      const imgBytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      if (config.watermark.imageDataUrl.startsWith('data:image/png')) {
        embeddedImage = await pdfDoc.embedPng(imgBytes).catch(() => null);
      } else {
        embeddedImage = await pdfDoc.embedJpg(imgBytes).catch(() => null);
      }
    }
  }

  for (let i = 0; i < pageCount; i++) {
    const page = pdfDoc.getPage(i);
    const { width, height } = page.getSize();
    const pageNum1Based = i + 1;

    // 1. WATERMARK
    if (config.watermark.enabled) {
      let shouldApply = false;
      const { scope, customPages } = config.watermark;
      if (scope === 'all') shouldApply = true;
      else if (scope === 'even' && pageNum1Based % 2 === 0) shouldApply = true;
      else if (scope === 'odd' && pageNum1Based % 2 === 1) shouldApply = true;
      else if (scope === 'custom' && customPages?.includes(pageNum1Based)) shouldApply = true;

      if (shouldApply) {
        const rot = degrees(config.watermark.rotation || 45);
        const wmColor = hexToRgb(config.watermark.color || '#94a3b8');
        const opacity = Math.min(1, Math.max(0.01, config.watermark.opacity ?? 0.2));

        if (config.watermark.type === 'text' && config.watermark.text) {
          const text = config.watermark.text;
          const fontSize = config.watermark.fontSize || 48;
          const textWidth = font.widthOfTextAtSize(text, fontSize);

          if (config.watermark.tile) {
            // Tiled grid across page
            const stepX = Math.max(150, textWidth + 60);
            const stepY = 160;
            for (let ty = 60; ty < height; ty += stepY) {
              for (let tx = 40; tx < width; tx += stepX) {
                page.drawText(text, {
                  x: tx,
                  y: ty,
                  size: fontSize,
                  font,
                  color: rgb(wmColor.r, wmColor.g, wmColor.b),
                  opacity,
                  rotate: rot,
                });
              }
            }
          } else {
            // Single watermark at specified or center position
            const posX = (width * (config.watermark.position?.xPercent ?? 50)) / 100 - textWidth / 2;
            const posY = (height * (config.watermark.position?.yPercent ?? 50)) / 100;

            page.drawText(text, {
              x: posX,
              y: posY,
              size: fontSize,
              font,
              color: rgb(wmColor.r, wmColor.g, wmColor.b),
              opacity,
              rotate: rot,
            });
          }
        } else if (config.watermark.type === 'image' && embeddedImage) {
          const imgW = embeddedImage.width * ((config.watermark.fontSize || 100) / 100);
          const imgH = embeddedImage.height * ((config.watermark.fontSize || 100) / 100);

          if (config.watermark.tile) {
            const stepX = imgW + 60;
            const stepY = imgH + 60;
            for (let ty = 60; ty < height; ty += stepY) {
              for (let tx = 40; tx < width; tx += stepX) {
                page.drawImage(embeddedImage, {
                  x: tx,
                  y: ty,
                  width: imgW,
                  height: imgH,
                  opacity,
                  rotate: rot,
                });
              }
            }
          } else {
            const posX = (width * (config.watermark.position?.xPercent ?? 50)) / 100 - imgW / 2;
            const posY = (height * (config.watermark.position?.yPercent ?? 50)) / 100 - imgH / 2;

            page.drawImage(embeddedImage, {
              x: posX,
              y: posY,
              width: imgW,
              height: imgH,
              opacity,
              rotate: rot,
            });
          }
        }
      }
    }

    // 2. PAGE NUMBER
    if (config.pageNumber.enabled) {
      const pn = config.pageNumber;
      const isCover = i === 0;
      const startsAt = pn.startFromPage || 1;

      if (!(pn.excludeCover && isCover) && pageNum1Based >= startsAt) {
        const offset = pageNum1Based - startsAt;
        const currentVal = (pn.startNumber || 1) + offset;
        const formattedNum = formatPageNumber(currentVal, pn.format);
        const text = (pn.template || '{n}')
          .replace(/{n}/g, formattedNum)
          .replace(/{total}/g, String(pageCount));

        const fontSize = pn.fontSize || 10;
        const textWidth = font.widthOfTextAtSize(text, fontSize);
        const margin = pn.margin ?? 24;
        const col = hexToRgb(pn.color || '#475569');

        let x = margin;
        let y = margin;

        const pos: NinePosition = pn.position || 'bottom-center';
        if (pos.includes('left')) x = margin;
        else if (pos.includes('center')) x = (width - textWidth) / 2;
        else if (pos.includes('right')) x = width - margin - textWidth;

        if (pos.startsWith('top')) y = height - margin - fontSize;
        else if (pos.startsWith('middle')) y = (height - fontSize) / 2;
        else if (pos.startsWith('bottom')) y = margin;

        page.drawText(text, {
          x,
          y,
          size: fontSize,
          font,
          color: rgb(col.r, col.g, col.b),
        });
      }
    }

    // 3. HEADER & FOOTER
    if (config.headerFooter.enabled) {
      const hf = config.headerFooter;
      const isCover = i === 0;

      if (!(hf.excludeCover && isCover)) {
        const fontSize = hf.fontSize || 9;
        const margin = hf.margin ?? 24;
        const col = hexToRgb(hf.color || '#475569');

        const replaceVars = (template: string) => {
          if (!template) return '';
          return template
            .replace(/{tarih}|{date}/g, dateStr)
            .replace(/{saat}|{time}/g, timeStr)
            .replace(/{dosya}|{filename}/g, fileNameStr)
            .replace(/{sayfa}|{page}/g, String(pageNum1Based))
            .replace(/{toplam}|{total}/g, String(pageCount));
        };

        const drawZone = (str: string, xPos: 'left' | 'center' | 'right', isTop: boolean) => {
          const t = replaceVars(str);
          if (!t) return;
          const tw = font.widthOfTextAtSize(t, fontSize);
          let x = margin;
          if (xPos === 'center') x = (width - tw) / 2;
          else if (xPos === 'right') x = width - margin - tw;

          const y = isTop ? height - margin - fontSize : margin;

          page.drawText(t, {
            x,
            y,
            size: fontSize,
            font,
            color: rgb(col.r, col.g, col.b),
          });
        };

        // Header zones (top)
        drawZone(hf.headerLeft, 'left', true);
        drawZone(hf.headerCenter, 'center', true);
        drawZone(hf.headerRight, 'right', true);

        // Footer zones (bottom)
        drawZone(hf.footerLeft, 'left', false);
        drawZone(hf.footerCenter, 'center', false);
        drawZone(hf.footerRight, 'right', false);
      }
    }
  }

  return await pdfDoc.save();
}

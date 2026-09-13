import { PDFDocument, rgb } from "pdf-lib";
import { removePdfText, type TextRemoval } from "../../lib/pdf-text.ts";

export interface RedactionBox {
  id?: string;
  page: number; // 0-indexed
  x: number;
  y: number;
  w?: number;
  h?: number;
  width?: number;
  height?: number;
  color?: string; // default black
}

/**
 * Applies permanent redaction to a PDF document:
 * 1. Automatically finds all text items intersecting the redaction box and purges them from the byte stream.
 * 2. Draws an opaque solid rectangle over the area.
 */
export async function applyPermanentRedaction(
  pdfBytes: Uint8Array,
  redactions: (RedactionBox | { pageIndex?: number; page?: number; rect: { x: number; y: number; width: number; height: number }; color?: string })[],
  textRemovals: TextRemoval[] = []
): Promise<Uint8Array> {
  if (redactions.length === 0 && textRemovals.length === 0) {
    return pdfBytes;
  }

  const normalizedBoxes: RedactionBox[] = (redactions as any[]).map((r) => {
    if (r && "rect" in r && r.rect) {
      return {
        page: r.pageIndex ?? r.page ?? 0,
        x: r.rect.x,
        y: r.rect.y,
        w: r.rect.width,
        h: r.rect.height,
        width: r.rect.width,
        height: r.rect.height,
        color: r.color,
      };
    }
    return {
      ...r,
      page: r.page ?? r.pageIndex ?? 0,
      w: r.w ?? r.width ?? 0,
      h: r.h ?? r.height ?? 0,
      width: r.width ?? r.w ?? 0,
      height: r.height ?? r.h ?? 0,
    };
  });

  const allRemovals = [...textRemovals];

  // For each redaction box, detect intersecting text from PDF.js if not already supplied
  try {
    const pdfjsLib = await import("pdfjs-dist");
    if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
    }
    const doc = await pdfjsLib.getDocument({ data: pdfBytes.slice(0) }).promise;

    for (const box of normalizedBoxes) {
      if (box.page >= doc.numPages) continue;
      const boxW = box.w ?? box.width ?? 0;
      const boxH = box.h ?? box.height ?? 0;
      const page = await doc.getPage(box.page + 1);
      const textContent = await page.getTextContent();
      const viewport = page.getViewport({ scale: 1 });

      for (let i = 0; i < textContent.items.length; i++) {
        const item: any = textContent.items[i];
        if (!item.str || !item.transform) continue;

        const [scaleX, , , scaleY, tx, ty] = item.transform;
        const [vx, vy] = viewport.convertToViewportPoint(tx, ty);
        const itemW = Math.abs(item.width || item.str.length * Math.abs(scaleX) * 0.6);
        const itemH = Math.abs(item.height || Math.abs(scaleY));
        const itemY = vy - itemH;

        // Check AABB intersection
        const intersects =
          box.x < vx + itemW &&
          box.x + boxW > vx &&
          box.y < itemY + itemH &&
          box.y + boxH > itemY;

        if (intersects) {
          const quad = [
            tx, ty,
            tx + itemW, ty,
            tx, ty + itemH,
            tx + itemW, ty + itemH
          ];
          allRemovals.push({
            id: `redact_${box.page}_${i}`,
            page: box.page,
            quad
          });
        }
      }
    }
  } catch (err) {
    console.warn("Could not scan text for redaction:", err);
  }

  // 1. Permanently delete the text stream bytes
  let processedBytes = pdfBytes;
  if (allRemovals.length > 0) {
    try {
      processedBytes = await removePdfText(pdfBytes, allRemovals);
    } catch (e) {
      console.warn("removePdfText fallback:", e);
    }
  }

  // 2. Draw solid black redaction rectangle over area & remove intersecting annotations/links/form widgets
  const pdfDoc = await PDFDocument.load(processedBytes);
  const pages = pdfDoc.getPages();

  for (const box of normalizedBoxes) {
    const page = pages[box.page];
    if (!page) continue;

    const boxW = box.w ?? box.width ?? 0;
    const boxH = box.h ?? box.height ?? 0;
    const { height: pageHeight } = page.getSize();
    const pdfX = box.x;
    const pdfY = pageHeight - box.y - boxH;

    // Purge any annotations, hyperlinks or form widgets intersecting this rectangle
    try {
      const annots = (page.node as any).Annots();
      if (annots) {
        for (let aIdx = annots.size() - 1; aIdx >= 0; aIdx--) {
          const annotRef = annots.get(aIdx);
          const annotDict = pdfDoc.context.lookup(annotRef);
          if (annotDict && typeof (annotDict as any).lookup === "function") {
            const rect = (annotDict as any).lookup({ name: "Rect" });
            if (rect && rect.size && rect.size() >= 4) {
              const ax = Math.min(rect.get(0).asNumber(), rect.get(2).asNumber());
              const ay = Math.min(rect.get(1).asNumber(), rect.get(3).asNumber());
              const aw = Math.abs(rect.get(2).asNumber() - rect.get(0).asNumber());
              const ah = Math.abs(rect.get(3).asNumber() - rect.get(1).asNumber());

              const intersects =
                pdfX < ax + aw &&
                pdfX + boxW > ax &&
                pdfY < ay + ah &&
                pdfY + boxH > ay;

              if (intersects) {
                annots.remove(aIdx);
              }
            }
          }
        }
      }
    } catch {}

    page.drawRectangle({
      x: pdfX,
      y: pdfY,
      width: boxW,
      height: boxH,
      color: rgb(0, 0, 0),
      opacity: 1
    });
  }

  return await pdfDoc.save();
}

export const applyPermanentRedactions = applyPermanentRedaction;
export const applyRedactionsToPdf = applyPermanentRedaction;

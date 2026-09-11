import type { PdfImageItem } from "./imageTypes";

/**
 * Scans a PDF.js page proxy for embedded images, their positions, and extracts image data
 */
export async function detectImagesOnPage(
  page: any,
  pageIndex: number
): Promise<PdfImageItem[]> {
  const images: PdfImageItem[] = [];

  try {
    const viewport = page.getViewport({ scale: 1 });
    const opList = await page.getOperatorList();
    const pdfjsLib = await import("pdfjs-dist");
    const OPS = pdfjsLib.OPS;

    let currentTransform: number[] = [1, 0, 0, 1, 0, 0];
    const transformStack: number[][] = [];

    for (let i = 0; i < opList.fnArray.length; i++) {
      const fn = opList.fnArray[i];
      const args = opList.argsArray[i];

      if (fn === OPS.save) {
        transformStack.push([...currentTransform]);
      } else if (fn === OPS.restore) {
        if (transformStack.length > 0) {
          currentTransform = transformStack.pop()!;
        }
      } else if (fn === OPS.transform) {
        // Multiply matrices
        const [a1, b1, c1, d1, e1, f1] = currentTransform;
        const [a2, b2, c2, d2, e2, f2] = args;
        currentTransform = [
          a1 * a2 + c1 * b2,
          b1 * a2 + d1 * b2,
          a1 * c2 + c1 * d2,
          b1 * c2 + d1 * d2,
          a1 * e2 + c1 * f2 + e1,
          b1 * e2 + d1 * f2 + f1
        ];
      } else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
        const imgName = args[0];
        const [scaleX, skewY, skewX, scaleY, transX, transY] = currentTransform;

        // In PDF coordinates, an image is drawn in a unit square [0,0,1,1] transformed by the matrix
        const pdfX = transX;
        const pdfY = transY;
        const pdfW = Math.abs(scaleX);
        const pdfH = Math.abs(scaleY);

        // Convert PDF coordinates to viewport coordinates
        const [vx, vy] = viewport.convertToViewportPoint(pdfX, pdfY + pdfH);
        const vw = pdfW;
        const vh = pdfH;

        if (vw > 10 && vh > 10) {
          // Attempt to retrieve image object data from page
          let dataUrl = "";
          try {
            const imgData = await new Promise<any>((resolve) => {
              page.objs.get(imgName, (data: any) => resolve(data));
            });

            if (imgData && imgData.data && imgData.width && imgData.height) {
              const canvas = document.createElement("canvas");
              canvas.width = imgData.width;
              canvas.height = imgData.height;
              const ctx = canvas.getContext("2d");
              if (ctx) {
                const imgClamped = new ImageData(
                  new Uint8ClampedArray(imgData.data.buffer),
                  imgData.width,
                  imgData.height
                );
                ctx.putImageData(imgClamped, 0, 0);
                dataUrl = canvas.toDataURL("image/png");
              }
            }
          } catch {
            // fallback
          }

          if (!dataUrl) {
            // Placeholder transparent image if direct extraction wasn't completed
            dataUrl =
              "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%236366f1' opacity='0.2'/></svg>";
          }

          images.push({
            id: `img_${pageIndex}_${i}_${Math.random().toString(36).slice(2, 7)}`,
            page: pageIndex,
            x: Math.round(vx),
            y: Math.round(vy),
            w: Math.round(vw),
            h: Math.round(vh),
            rotation: 0,
            opacity: 1,
            dataUrl,
            format: "png",
            isOriginal: true,
            originalBounds: { left: pdfX, bottom: pdfY, right: pdfX + pdfW, top: pdfY + pdfH },
            name: typeof imgName === "string" ? imgName : `Görsel ${images.length + 1}`
          });
        }
      }
    }
  } catch (err) {
    console.warn("Could not inspect page images:", err);
  }

  return images;
}

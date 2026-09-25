import type { PdfImageItem } from "./imageTypes";

/**
 * Decodes raw PDF.js image data into a PNG data URL.
 * Handles RGBA (32bpp), RGB (24bpp), Grayscale (8bpp), 1-bit masks, and ImageBitmap.
 */
function convertImgDataToPng(imgData: any): string {
  if (!imgData) return "";

  // If already an ImageBitmap or HTML element
  if (
    imgData.bitmap ||
    (typeof ImageBitmap !== "undefined" && imgData instanceof ImageBitmap) ||
    (typeof HTMLCanvasElement !== "undefined" && imgData instanceof HTMLCanvasElement) ||
    (typeof HTMLImageElement !== "undefined" && imgData instanceof HTMLImageElement)
  ) {
    try {
      const source = imgData.bitmap || imgData;
      const canvas = document.createElement("canvas");
      canvas.width = source.width || imgData.width;
      canvas.height = source.height || imgData.height;
      const ctx = canvas.getContext("2d");
      if (ctx && canvas.width > 0 && canvas.height > 0) {
        ctx.drawImage(source, 0, 0);
        return canvas.toDataURL("image/png");
      }
    } catch (err) {
      console.warn("Could not draw ImageBitmap to canvas:", err);
    }
  }

  const width = imgData.width;
  const height = imgData.height;
  if (!width || !height || !imgData.data) return "";

  try {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return "";

    const rawData = imgData.data;
    const totalPixels = width * height;
    let rgba: Uint8ClampedArray;

    if (rawData.length === totalPixels * 4 || imgData.kind === 3) {
      // 32-bit RGBA
      rgba =
        rawData instanceof Uint8ClampedArray
          ? rawData
          : new Uint8ClampedArray(rawData.buffer, rawData.byteOffset, rawData.byteLength);
    } else if (rawData.length === totalPixels * 3 || imgData.kind === 2) {
      // 24-bit RGB -> expand to RGBA
      rgba = new Uint8ClampedArray(totalPixels * 4);
      let s = 0;
      let d = 0;
      for (let i = 0; i < totalPixels; i++) {
        rgba[d] = rawData[s];
        rgba[d + 1] = rawData[s + 1];
        rgba[d + 2] = rawData[s + 2];
        rgba[d + 3] = 255;
        s += 3;
        d += 4;
      }
    } else if (rawData.length === totalPixels || imgData.kind === 1) {
      // 8-bit Grayscale -> expand to RGBA
      rgba = new Uint8ClampedArray(totalPixels * 4);
      let s = 0;
      let d = 0;
      for (let i = 0; i < totalPixels; i++) {
        const val = rawData[s++];
        rgba[d] = val;
        rgba[d + 1] = val;
        rgba[d + 2] = val;
        rgba[d + 3] = 255;
        d += 4;
      }
    } else if (rawData.length < totalPixels) {
      // 1-bit monochrome mask (packed 8 pixels per byte)
      rgba = new Uint8ClampedArray(totalPixels * 4);
      const rowBytes = Math.ceil(width / 8);
      let d = 0;
      for (let y = 0; y < height; y++) {
        const rowOffset = y * rowBytes;
        for (let x = 0; x < width; x++) {
          const byteVal = rawData[rowOffset + (x >> 3)];
          const bit = (byteVal >> (7 - (x & 7))) & 1;
          const val = bit ? 255 : 0;
          rgba[d] = val;
          rgba[d + 1] = val;
          rgba[d + 2] = val;
          rgba[d + 3] = 255;
          d += 4;
        }
      }
    } else {
      // Generic fallback: copy what we can
      rgba = new Uint8ClampedArray(totalPixels * 4);
      const copyLen = Math.min(rawData.length, rgba.length);
      for (let i = 0; i < copyLen; i++) {
        rgba[i] = rawData[i];
      }
      for (let i = copyLen; i < rgba.length; i += 4) {
        rgba[i + 3] = 255;
      }
    }

    const imgClamped = ctx.createImageData(width, height);
    imgClamped.data.set(rgba);
    ctx.putImageData(imgClamped, 0, 0);
    return canvas.toDataURL("image/png");
  } catch (err) {
    console.warn("Error converting image data to PNG:", err);
    return "";
  }
}

/**
 * Resolves an image object from PDF.js page or common objects
 */
async function fetchPdfJsImageObject(page: any, imgArg: any): Promise<any> {
  if (typeof imgArg === "object" && imgArg !== null) {
    return imgArg;
  }
  const imgName = String(imgArg);

  return new Promise((resolve) => {
    let resolved = false;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve(null);
      }
    }, 1200);

    const handleData = (data: any) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(data);
      }
    };

    try {
      if (page.objs?.has?.(imgName)) {
        page.objs.get(imgName, handleData);
      } else if (page.commonObjs?.has?.(imgName)) {
        page.commonObjs.get(imgName, handleData);
      } else if (typeof page.objs?.get === "function") {
        page.objs.get(imgName, (data: any) => {
          if (data) {
            handleData(data);
          } else if (typeof page.commonObjs?.get === "function") {
            page.commonObjs.get(imgName, handleData);
          } else {
            handleData(null);
          }
        });
      } else if (typeof page.commonObjs?.get === "function") {
        page.commonObjs.get(imgName, handleData);
      } else {
        handleData(null);
      }
    } catch {
      handleData(null);
    }
  });
}

/**
 * Scans a PDF.js page proxy for embedded images, their positions, and extracts real pixel data.
 */
export async function detectImagesOnPage(
  page: any,
  pageIndex: number,
  pageRotation = 0
): Promise<PdfImageItem[]> {
  const images: PdfImageItem[] = [];

  try {
    const totalRotation = ((page.rotate || 0) + pageRotation) % 360;
    const viewport = page.getViewport({ scale: 1, rotation: totalRotation });
    const opList = await page.getOperatorList();
    const pdfjsLib = await import("pdfjs-dist");
    const OPS = pdfjsLib.OPS;

    let currentTransform: number[] = [1, 0, 0, 1, 0, 0];
    const transformStack: number[][] = [];

    const parseMatrix = (mat: any): number[] | null => {
      if (!mat) return null;
      if (Array.isArray(mat) || (typeof Float32Array !== "undefined" && mat instanceof Float32Array)) {
        if (mat.length >= 6) return [mat[0], mat[1], mat[2], mat[3], mat[4], mat[5]];
      } else if (typeof mat === "object" && 0 in mat && 5 in mat) {
        return [Number(mat[0]), Number(mat[1]), Number(mat[2]), Number(mat[3]), Number(mat[4]), Number(mat[5])];
      }
      return null;
    };

    const concatTransforms = (t1: number[], t2: number[]): number[] => {
      const [a1, b1, c1, d1, e1, f1] = t1;
      const [a2, b2, c2, d2, e2, f2] = t2;
      return [
        a1 * a2 + c1 * b2,
        b1 * a2 + d1 * b2,
        a1 * c2 + c1 * d2,
        b1 * c2 + d1 * d2,
        a1 * e2 + c1 * f2 + e1,
        b1 * e2 + d1 * f2 + f1
      ];
    };

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
        const mat = parseMatrix(args);
        if (mat) {
          currentTransform = concatTransforms(currentTransform, mat);
        }
      } else if (fn === OPS.paintFormXObjectBegin) {
        transformStack.push([...currentTransform]);
        const formMat = parseMatrix(args?.[0]);
        if (formMat) {
          currentTransform = concatTransforms(currentTransform, formMat);
        }
      } else if (fn === OPS.paintFormXObjectEnd) {
        if (transformStack.length > 0) {
          currentTransform = transformStack.pop()!;
        }
      } else if (
        fn === OPS.paintImageXObject ||
        fn === OPS.paintInlineImageXObject ||
        fn === OPS.paintImageMaskXObject
      ) {
        const imgArg = args[0];
        const pixelW = typeof args[1] === "number" ? args[1] : undefined;
        const pixelH = typeof args[2] === "number" ? args[2] : undefined;
        const [scaleX, skewY, skewX, scaleY, transX, transY] = currentTransform;

        // In PDF coordinates, an image is drawn in a unit square [0,0,1,1] transformed by the matrix
        const pdfX = transX;
        const pdfY = transY;
        const pdfW = Math.abs(scaleX);
        const pdfH = Math.abs(scaleY);

        // Convert PDF coordinates to viewport coordinates (top-left)
        const [vx, vy] = viewport.convertToViewportPoint(pdfX, pdfY + pdfH);
        const vw = pdfW;
        const vh = pdfH;

        if (vw > 5 && vh > 5) {
          let dataUrl = "";
          try {
            const imgData = await fetchPdfJsImageObject(page, imgArg);
            if (imgData) {
              dataUrl = convertImgDataToPng(imgData);
            }
          } catch (err) {
            console.warn("Could not extract image object:", err);
          }

          let isPlaceholder = false;
          let pixelExtractionFailed = false;

          if (!dataUrl) {
            // Render a clean placeholder only if real data couldn't be extracted
            dataUrl =
              "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='100' height='100'><rect width='100' height='100' fill='%236366f1' opacity='0.15'/><text x='50' y='55' text-anchor='middle' fill='%234338ca' font-size='12' font-family='sans-serif'>Görsel</text></svg>";
            isPlaceholder = true;
            pixelExtractionFailed = true;
          }

          const objStr = typeof imgArg === "string" ? imgArg : typeof imgArg === "number" ? String(imgArg) : "img";
          const imgIdx = images.filter(im => im.page === pageIndex).length;
          const imgId = `img_p${pageIndex}_idx${imgIdx}_${objStr}_${pixelW || 0}x${pixelH || 0}`;
          const imgName = typeof imgArg === "string" ? imgArg : `Görsel ${images.length + 1}`;

          images.push({
            id: imgId,
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
            isModified: false,
            isMovable: true,
            originalBounds: { left: pdfX, bottom: pdfY, right: pdfX + pdfW, top: pdfY + pdfH },
            originalViewport: {
              x: Math.round(vx),
              y: Math.round(vy),
              w: Math.round(vw),
              h: Math.round(vh)
            },
            name: imgName,
            objectRef: typeof imgArg === "string" ? imgArg : undefined,
            imageIndex: images.filter(im => im.page === pageIndex).length,
            pixelWidth: pixelW,
            pixelHeight: pixelH,
            matrix: [...currentTransform],
            isPlaceholder,
            pixelExtractionFailed,
          });
        }
      }
    }
  } catch (err) {
    console.warn("Could not inspect page images:", err);
  }

  return images;
}

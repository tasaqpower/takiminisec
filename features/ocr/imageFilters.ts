// Image enhancement and binarization filters for pre-OCR background cleanup

export interface FilterOptions {
  grayscale: boolean;
  binarize: boolean;
  threshold?: number; // 0-255 or auto (Otsu)
  contrast: number;   // 1.0 to 3.0
  brightness: number; // -100 to 100
  denoise: boolean;
}

export const DEFAULT_FILTER_OPTIONS: FilterOptions = {
  grayscale: true,
  binarize: true,
  threshold: 0, // 0 means automatic Otsu threshold
  contrast: 1.2,
  brightness: 0,
  denoise: true
};

/**
 * Calculates Otsu's threshold for an 8-bit grayscale image
 */
export function calculateOtsuThreshold(grayData: Uint8ClampedArray): number {
  const histogram = new Array(256).fill(0);
  const total = grayData.length;

  for (let i = 0; i < total; i++) {
    histogram[grayData[i]]++;
  }

  let sum = 0;
  for (let i = 0; i < 256; i++) {
    sum += i * histogram[i];
  }

  let sumB = 0;
  let wB = 0;
  let wF = 0;
  let maxVariance = 0;
  let threshold = 128;

  for (let t = 0; t < 256; t++) {
    wB += histogram[t];
    if (wB === 0) continue;
    wF = total - wB;
    if (wF === 0) break;

    sumB += t * histogram[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;

    const varianceBetween = wB * wF * (mB - mF) * (mB - mF);
    if (varianceBetween > maxVariance) {
      maxVariance = varianceBetween;
      threshold = t;
    }
  }

  return threshold;
}

/**
 * Applies filters (grayscale, contrast, brightness, Otsu binarization, denoise)
 * to an ImageData object and returns modified ImageData
 */
export function applyImageFilters(
  sourceData: ImageData,
  options: Partial<FilterOptions> = {}
): ImageData {
  const opts = { ...DEFAULT_FILTER_OPTIONS, ...options };
  const width = sourceData.width;
  const height = sourceData.height;
  const src = sourceData.data;

  const output = new ImageData(new Uint8ClampedArray(src), width, height);
  const dst = output.data;
  const totalPixels = width * height;

  // 1. Grayscale & Contrast / Brightness
  const gray = new Uint8ClampedArray(totalPixels);
  const contrastFactor = Math.max(0.1, opts.contrast);

  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    const r = src[idx];
    const g = src[idx + 1];
    const b = src[idx + 2];

    // Standard Rec. 601 luma
    let val = 0.299 * r + 0.587 * g + 0.114 * b;

    // Brightness
    val += opts.brightness;

    // Contrast
    val = (val - 128) * contrastFactor + 128;
    val = Math.max(0, Math.min(255, val));

    gray[i] = val;
  }

  // 2. Binarization
  let thresh = opts.threshold && opts.threshold > 0 ? opts.threshold : 0;
  if (opts.binarize && thresh === 0) {
    thresh = calculateOtsuThreshold(gray);
  }

  // 3. Populate output
  for (let i = 0; i < totalPixels; i++) {
    const idx = i * 4;
    let pixelVal = gray[i];

    if (opts.binarize) {
      pixelVal = pixelVal < thresh ? 0 : 255;
    }

    dst[idx] = pixelVal;
    dst[idx + 1] = pixelVal;
    dst[idx + 2] = pixelVal;
    dst[idx + 3] = 255;
  }

  // 4. Simple 3x3 Despeckle / Denoise if enabled
  if (opts.denoise && opts.binarize) {
    const copy = new Uint8ClampedArray(dst);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        const cur = copy[idx];

        // If isolated black or white pixel, remove it
        let sameNeighbors = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nIdx = ((y + dy) * width + (x + dx)) * 4;
            if (copy[nIdx] === cur) sameNeighbors++;
          }
        }

        // If surrounded by opposite color (<= 1 neighbor), flip it
        if (sameNeighbors <= 1) {
          const flipped = cur === 0 ? 255 : 0;
          dst[idx] = flipped;
          dst[idx + 1] = flipped;
          dst[idx + 2] = flipped;
        }
      }
    }
  }

  return output;
}

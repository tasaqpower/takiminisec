import type { ImageAdjustments, Point, QuadCorners } from './scannerTypes';

export function distance(p1: Point, p2: Point): number {
  return Math.hypot(p2.x - p1.x, p2.y - p1.y);
}

/**
 * Detect document boundary corners automatically
 */
export function detectDocumentEdges(imageData: ImageData): QuadCorners {
  const { width, height, data } = imageData;
  const insetX = Math.round(width * 0.05);
  const insetY = Math.round(height * 0.05);

  const defaultCorners: QuadCorners = {
    topLeft: { x: insetX, y: insetY },
    topRight: { x: width - insetX, y: insetY },
    bottomRight: { x: width - insetX, y: height - insetY },
    bottomLeft: { x: insetX, y: height - insetY },
  };

  // Sample luminance grid for edge gradient
  const step = Math.max(1, Math.floor(Math.min(width, height) / 100));
  const gridW = Math.floor(width / step);
  const gridH = Math.floor(height / step);
  const lum = new Float32Array(gridW * gridH);

  for (let gy = 0; gy < gridH; gy++) {
    for (let gx = 0; gx < gridW; gx++) {
      const px = gx * step;
      const py = gy * step;
      const idx = (py * width + px) * 4;
      lum[gy * gridW + gx] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
    }
  }

  // Find high gradient outer points
  let minTop = height, minLeft = width, maxRight = 0, maxBottom = 0;
  for (let gy = 1; gy < gridH - 1; gy++) {
    for (let gx = 1; gx < gridW - 1; gx++) {
      const idx = gy * gridW + gx;
      const gradX = Math.abs(lum[idx + 1] - lum[idx - 1]);
      const gradY = Math.abs(lum[idx + gridW] - lum[idx - gridW]);
      const grad = gradX + gradY;

      if (grad > 50) {
        const rx = gx * step;
        const ry = gy * step;
        if (ry < minTop) minTop = ry;
        if (ry > maxBottom) maxBottom = ry;
        if (rx < minLeft) minLeft = rx;
        if (rx > maxRight) maxRight = rx;
      }
    }
  }

  if (maxRight > minLeft + 50 && maxBottom > minTop + 50) {
    return {
      topLeft: { x: Math.max(0, minLeft), y: Math.max(0, minTop) },
      topRight: { x: Math.min(width, maxRight), y: Math.max(0, minTop) },
      bottomRight: { x: Math.min(width, maxRight), y: Math.min(height, maxBottom) },
      bottomLeft: { x: Math.max(0, minLeft), y: Math.min(height, maxBottom) },
    };
  }

  return defaultCorners;
}

/**
 * Solve 8x8 system for homography matrix H mapping src -> dst
 */
function getHomography(src: Point[], dst: Point[]): number[] {
  // A * h = b
  const A: number[][] = [];
  const b: number[] = [];

  for (let i = 0; i < 4; i++) {
    const sx = src[i].x;
    const sy = src[i].y;
    const dx = dst[i].x;
    const dy = dst[i].y;

    A.push([sx, sy, 1, 0, 0, 0, -dx * sx, -dx * sy]);
    b.push(dx);

    A.push([0, 0, 0, sx, sy, 1, -dy * sx, -dy * sy]);
    b.push(dy);
  }

  // Gaussian elimination with partial pivoting
  const n = 8;
  for (let i = 0; i < n; i++) {
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) maxRow = k;
    }
    const tempA = A[i]; A[i] = A[maxRow]; A[maxRow] = tempA;
    const tempB = b[i]; b[i] = b[maxRow]; b[maxRow] = tempB;

    const pivot = A[i][i] || 1e-10;
    for (let k = i + 1; k < n; k++) {
      const factor = A[k][i] / pivot;
      for (let j = i; j < n; j++) {
        A[k][j] -= factor * A[i][j];
      }
      b[k] -= factor * b[i];
    }
  }

  const h = new Array(8).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = b[i];
    for (let j = i + 1; j < n; j++) {
      sum -= A[i][j] * h[j];
    }
    h[i] = sum / (A[i][i] || 1e-10);
  }

  return [h[0], h[1], h[2], h[3], h[4], h[5], h[6], h[7], 1];
}

/**
 * 4-Point Perspective Warp
 */
export function warpPerspective(
  imageData: ImageData,
  corners: QuadCorners,
  createOutputImageData?: (w: number, h: number) => ImageData
): ImageData {
  const topWidth = distance(corners.topLeft, corners.topRight);
  const bottomWidth = distance(corners.bottomLeft, corners.bottomRight);
  const leftHeight = distance(corners.topLeft, corners.bottomLeft);
  const rightHeight = distance(corners.topRight, corners.bottomRight);

  const targetW = Math.max(10, Math.round(Math.max(topWidth, bottomWidth)));
  const targetH = Math.max(10, Math.round(Math.max(leftHeight, rightHeight)));

  const dstCorners: Point[] = [
    { x: 0, y: 0 },
    { x: targetW, y: 0 },
    { x: targetW, y: targetH },
    { x: 0, y: targetH },
  ];
  const srcCorners: Point[] = [
    corners.topLeft,
    corners.topRight,
    corners.bottomRight,
    corners.bottomLeft,
  ];

  // Inverse mapping: H maps dst (x,y) -> src (u,v)
  const H = getHomography(dstCorners, srcCorners);

  const out = createOutputImageData
    ? createOutputImageData(targetW, targetH)
    : new ImageData(targetW, targetH);

  const srcData = imageData.data;
  const srcW = imageData.width;
  const srcH = imageData.height;
  const outData = out.data;

  for (let y = 0; y < targetH; y++) {
    for (let x = 0; x < targetW; x++) {
      const denom = H[6] * x + H[7] * y + H[8] || 1e-10;
      const u = (H[0] * x + H[1] * y + H[2]) / denom;
      const v = (H[3] * x + H[4] * y + H[5]) / denom;

      const outIdx = (y * targetW + x) * 4;

      if (u >= 0 && u < srcW - 1 && v >= 0 && v < srcH - 1) {
        // Bilinear interpolation
        const u0 = Math.floor(u);
        const v0 = Math.floor(v);
        const u1 = u0 + 1;
        const v1 = v0 + 1;

        const du = u - u0;
        const dv = v - v0;

        const i00 = (v0 * srcW + u0) * 4;
        const i10 = (v0 * srcW + u1) * 4;
        const i01 = (v1 * srcW + u0) * 4;
        const i11 = (v1 * srcW + u1) * 4;

        for (let c = 0; c < 3; c++) {
          const val =
            (1 - du) * (1 - dv) * srcData[i00 + c] +
            du * (1 - dv) * srcData[i10 + c] +
            (1 - du) * dv * srcData[i01 + c] +
            du * dv * srcData[i11 + c];
          outData[outIdx + c] = Math.min(255, Math.max(0, Math.round(val)));
        }
        outData[outIdx + 3] = 255;
      } else {
        outData[outIdx] = 255;
        outData[outIdx + 1] = 255;
        outData[outIdx + 2] = 255;
        outData[outIdx + 3] = 255;
      }
    }
  }

  return out;
}

/**
 * Detect text skew angle using horizontal projection variance
 */
export function detectDeskewAngle(imageData: ImageData): number {
  const { width, height, data } = imageData;
  const sampleH = Math.min(height, 600);
  const startY = Math.floor((height - sampleH) / 2);

  let bestAngle = 0;
  let maxVariance = -1;

  for (let angle = -12; angle <= 12; angle += 1) {
    const rad = (angle * Math.PI) / 180;
    const tan = Math.tan(rad);
    const rowSums = new Float32Array(sampleH);

    for (let y = 0; y < sampleH; y++) {
      let sum = 0;
      for (let x = 0; x < width; x += 4) {
        const curY = Math.round(startY + y + (x - width / 2) * tan);
        if (curY >= 0 && curY < height) {
          const idx = (curY * width + x) * 4;
          const lum = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
          sum += lum < 128 ? 1 : 0;
        }
      }
      rowSums[y] = sum;
    }

    let mean = 0;
    for (let y = 0; y < sampleH; y++) mean += rowSums[y];
    mean /= sampleH;

    let variance = 0;
    for (let y = 0; y < sampleH; y++) {
      const diff = rowSums[y] - mean;
      variance += diff * diff;
    }

    if (variance > maxVariance) {
      maxVariance = variance;
      bestAngle = angle;
    }
  }

  return bestAngle;
}

/**
 * Apply filters: Brightness, Contrast, Sharpness, Shadow Reduction, and Filter Mode
 */
export function applyDocumentAdjustments(
  imageData: ImageData,
  adjustments: ImageAdjustments,
  createOutputImageData?: (w: number, h: number) => ImageData
): ImageData {
  const { width, height, data } = imageData;
  const out = createOutputImageData
    ? createOutputImageData(width, height)
    : new ImageData(width, height);
  const outData = out.data;

  const bOffset = (adjustments.brightness / 100) * 128;
  const cFactor = adjustments.contrast >= 0
    ? (1 + adjustments.contrast / 100 * 2)
    : (1 + adjustments.contrast / 100);

  // 1. Initial pass: brightness & contrast & shadow reduction
  const temp = new Uint8ClampedArray(width * height * 4);

  // White balance / shadow reduction reference
  const shadowFactor = adjustments.shadowReduction / 100;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Shadow & yellowing suppression: equalize towards white
    if (shadowFactor > 0) {
      const maxCh = Math.max(r, g, b);
      if (maxCh > 160) {
        const boost = (255 - maxCh) * shadowFactor * ((maxCh - 160) / 95);
        r = Math.min(255, r + boost);
        g = Math.min(255, g + boost);
        b = Math.min(255, b + boost);
      }
    }

    // Brightness
    r += bOffset;
    g += bOffset;
    b += bOffset;

    // Contrast
    r = cFactor * (r - 128) + 128;
    g = cFactor * (g - 128) + 128;
    b = cFactor * (b - 128) + 128;

    temp[i] = Math.min(255, Math.max(0, Math.round(r)));
    temp[i + 1] = Math.min(255, Math.max(0, Math.round(g)));
    temp[i + 2] = Math.min(255, Math.max(0, Math.round(b)));
    temp[i + 3] = data[i + 3];
  }

  // 2. Sharpness convolution (if sharpness > 0)
  const sharpAmount = adjustments.sharpness / 100;
  if (sharpAmount > 0) {
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        for (let c = 0; c < 3; c++) {
          const center = temp[idx + c];
          const laplacian =
            4 * center -
            temp[((y - 1) * width + x) * 4 + c] -
            temp[((y + 1) * width + x) * 4 + c] -
            temp[(y * width + (x - 1)) * 4 + c] -
            temp[(y * width + (x + 1)) * 4 + c];

          const sharpened = center + laplacian * sharpAmount * 0.5;
          outData[idx + c] = Math.min(255, Math.max(0, Math.round(sharpened)));
        }
        outData[idx + 3] = 255;
      }
    }
  } else {
    outData.set(temp);
  }

  // 3. Filter mode
  if (adjustments.filterMode === 'grayscale') {
    for (let i = 0; i < outData.length; i += 4) {
      const gray = Math.round(0.299 * outData[i] + 0.587 * outData[i + 1] + 0.114 * outData[i + 2]);
      outData[i] = gray;
      outData[i + 1] = gray;
      outData[i + 2] = gray;
    }
  } else if (adjustments.filterMode === 'bw') {
    // Otsu-style or adaptive clean binary threshold
    for (let i = 0; i < outData.length; i += 4) {
      const gray = 0.299 * outData[i] + 0.587 * outData[i + 1] + 0.114 * outData[i + 2];
      const bw = gray > 140 ? 255 : 0;
      outData[i] = bw;
      outData[i + 1] = bw;
      outData[i + 2] = bw;
    }
  }

  return out;
}
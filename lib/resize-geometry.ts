export type ResizeHandleCorner = "nw" | "ne" | "se" | "sw";

export interface RectBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface ResizeOptions {
  kind: "stamp" | "signature" | "image" | "highlight" | "text" | "draw" | string;
  corner: ResizeHandleCorner;
  startRect: RectBounds;
  dx: number;
  dy: number;
  pageWidth?: number;
  pageHeight?: number;
  minSize?: number;
}

export interface ResizedResult extends RectBounds {
  scale: number;
}

/**
 * Transforms screen-relative pointer deltas into PDF-page coordinate deltas
 * based on page rotation (0°, 90°, 180°, 270°).
 */
export function transformDeltaForRotation(
  dx: number,
  dy: number,
  rotation = 0
): { dx: number; dy: number } {
  const normRot = ((rotation % 360) + 360) % 360;
  if (normRot === 90) return { dx: dy, dy: -dx };
  if (normRot === 180) return { dx: -dx, dy: -dy };
  if (normRot === 270) return { dx: -dy, dy: dx };
  return { dx, dy };
}

/**
 * Computes four-corner opposite-anchored rectangle geometry.
 *
 * Rules:
 *  - "nw": Bottom-right corner (x + w, y + h) remains fixed.
 *  - "ne": Bottom-left corner (x, y + h) remains fixed.
 *  - "se": Top-left corner (x, y) remains fixed.
 *  - "sw": Top-right corner (x + w, y) remains fixed.
 *
 * For aspect-locked items (stamp, signature, image):
 *  - Computes scale via vector projection along the anchor-to-dragged-corner diagonal:
 *      scale = dot(currentVector, initialVector) / dot(initialVector, initialVector)
 *  - Enables intuitive scaling even when dragging along only one axis (horizontal or vertical).
 *  - Prevents negative dimensions, corner flipping, and preserves exact aspect ratio.
 *
 * For freeform items (highlight):
 *  - Width and height scale independently along the dragged corner.
 *
 * All items:
 *  - Minimum dimension guaranteed (default 12x12).
 *  - Clamped within page boundaries [0, pageWidth] and [0, pageHeight].
 */
export function computeResizedBounds(options: ResizeOptions): ResizedResult {
  const {
    kind,
    corner,
    startRect,
    dx,
    dy,
    pageWidth = 10000,
    pageHeight = 10000,
    minSize = 12,
  } = options;

  const origX = startRect.x;
  const origY = startRect.y;
  const origW = Math.max(minSize, startRect.w);
  const origH = Math.max(minSize, startRect.h);
  const aspect = origW / origH;

  const keepAspect = kind === "stamp" || kind === "signature" || kind === "image";

  if (keepAspect) {
    // Initial vector from the fixed anchor to the dragged corner
    let initVx = 0;
    let initVy = 0;
    let fixedX = 0;
    let fixedY = 0;

    if (corner === "se") {
      // Fixed: top-left (origX, origY)
      fixedX = origX;
      fixedY = origY;
      initVx = origW;
      initVy = origH;
    } else if (corner === "sw") {
      // Fixed: top-right (origX + origW, origY)
      fixedX = origX + origW;
      fixedY = origY;
      initVx = -origW;
      initVy = origH;
    } else if (corner === "ne") {
      // Fixed: bottom-left (origX, origY + origH)
      fixedX = origX;
      fixedY = origY + origH;
      initVx = origW;
      initVy = -origH;
    } else if (corner === "nw") {
      // Fixed: bottom-right (origX + origW, origY + origH)
      fixedX = origX + origW;
      fixedY = origY + origH;
      initVx = -origW;
      initVy = -origH;
    }

    // Current vector from fixed anchor
    const currVx = initVx + dx;
    const currVy = initVy + dy;

    // Vector projection scale
    const dotCurrentInitial = currVx * initVx + currVy * initVy;
    const dotInitialInitial = initVx * initVx + initVy * initVy;
    let scale = dotInitialInitial > 0 ? dotCurrentInitial / dotInitialInitial : 1;

    // Minimum size constraint
    const minScale = Math.max(minSize / origW, minSize / origH);
    scale = Math.max(minScale, scale);

    let newW = origW * scale;
    let newH = origH * scale;

    // Page boundary constraint while keeping fixed anchor
    if (corner === "se") {
      const maxW = pageWidth - fixedX;
      const maxH = pageHeight - fixedY;
      const maxScale = Math.min(maxW / origW, maxH / origH);
      if (maxScale > minScale && scale > maxScale) {
        scale = maxScale;
        newW = origW * scale;
        newH = origH * scale;
      }
      return { x: fixedX, y: fixedY, w: newW, h: newH, scale };
    }

    if (corner === "sw") {
      const maxW = fixedX;
      const maxH = pageHeight - fixedY;
      const maxScale = Math.min(maxW / origW, maxH / origH);
      if (maxScale > minScale && scale > maxScale) {
        scale = maxScale;
        newW = origW * scale;
        newH = origH * scale;
      }
      return { x: fixedX - newW, y: fixedY, w: newW, h: newH, scale };
    }

    if (corner === "ne") {
      const maxW = pageWidth - fixedX;
      const maxH = fixedY;
      const maxScale = Math.min(maxW / origW, maxH / origH);
      if (maxScale > minScale && scale > maxScale) {
        scale = maxScale;
        newW = origW * scale;
        newH = origH * scale;
      }
      return { x: fixedX, y: fixedY - newH, w: newW, h: newH, scale };
    }

    // corner === "nw"
    const maxW = fixedX;
    const maxH = fixedY;
    const maxScale = Math.min(maxW / origW, maxH / origH);
    if (maxScale > minScale && scale > maxScale) {
      scale = maxScale;
      newW = origW * scale;
      newH = origH * scale;
    }
    return { x: fixedX - newW, y: fixedY - newH, w: newW, h: newH, scale };
  }

  // Freeform resizing (e.g. highlight, text container dimensions)
  let newX = origX;
  let newY = origY;
  let newW = origW;
  let newH = origH;

  if (corner === "se") {
    // Fixed: top-left (origX, origY)
    newW = Math.max(minSize, origW + dx);
    newH = Math.max(minSize, origH + dy);
    // Page clamp
    newW = Math.min(newW, pageWidth - origX);
    newH = Math.min(newH, pageHeight - origY);
    newX = origX;
    newY = origY;
  } else if (corner === "sw") {
    // Fixed: top-right (origX + origW, origY)
    const fixedRight = origX + origW;
    newW = Math.max(minSize, origW - dx);
    newH = Math.max(minSize, origH + dy);
    newW = Math.min(newW, fixedRight);
    newH = Math.min(newH, pageHeight - origY);
    newX = fixedRight - newW;
    newY = origY;
  } else if (corner === "ne") {
    // Fixed: bottom-left (origX, origY + origH)
    const fixedBottom = origY + origH;
    newW = Math.max(minSize, origW + dx);
    newH = Math.max(minSize, origH - dy);
    newW = Math.min(newW, pageWidth - origX);
    newH = Math.min(newH, fixedBottom);
    newX = origX;
    newY = fixedBottom - newH;
  } else if (corner === "nw") {
    // Fixed: bottom-right (origX + origW, origY + origH)
    const fixedRight = origX + origW;
    const fixedBottom = origY + origH;
    newW = Math.max(minSize, origW - dx);
    newH = Math.max(minSize, origH - dy);
    newW = Math.min(newW, fixedRight);
    newH = Math.min(newH, fixedBottom);
    newX = fixedRight - newW;
    newY = fixedBottom - newH;
  }

  const scale = (newW / origW + newH / origH) / 2;
  return { x: newX, y: newY, w: newW, h: newH, scale };
}

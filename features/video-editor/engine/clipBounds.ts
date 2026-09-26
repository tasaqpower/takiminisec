/**
 * FORMA Video Editor — Unified Clip Bounds Engine
 * Calculates exact visual bounding boxes, rotation matrices, and hit testing
 * for Video, Image, Text, and Audio clips across interactive preview and export.
 */

import type { VideoClip, TextLayerData } from '../types';

export interface ClipBounds {
  centerX: number;
  centerY: number;
  width: number;
  height: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  halfW: number;
  halfH: number;
  corners: { x: number; y: number }[];
  aabb: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

let measureCanvas: HTMLCanvasElement | null = null;
let measureCtx: CanvasRenderingContext2D | null = null;

function getMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof document === 'undefined') return null;
  if (!measureCanvas) {
    measureCanvas = document.createElement('canvas');
    measureCanvas.width = 100;
    measureCanvas.height = 100;
  }
  if (!measureCtx) {
    measureCtx = measureCanvas.getContext('2d');
  }
  return measureCtx;
}

/**
 * Calculates exact bounding box for any clip type
 */
export function calculateClipBounds(
  clip: VideoClip,
  canvasW: number,
  canvasH: number,
  mediaElement?: HTMLVideoElement | HTMLImageElement | null,
  ctx?: CanvasRenderingContext2D | null
): ClipBounds {
  const scaleX = clip.transform?.scaleX ?? clip.scaleX ?? 1;
  const scaleY = clip.transform?.scaleY ?? clip.scaleY ?? 1;
  const rotation = clip.transform?.rotation ?? clip.rotation ?? 0;
  const centerX = canvasW / 2 + (clip.transform?.x ?? clip.x ?? 0);
  const centerY = canvasH / 2 + (clip.transform?.y ?? clip.y ?? 0);

  let unscaledW = canvasW;
  let unscaledH = canvasH;

  if (clip.type === 'video' || clip.type === 'image') {
    let naturalW = canvasW;
    let naturalH = canvasH;

    if (mediaElement) {
      if (mediaElement instanceof HTMLVideoElement && mediaElement.videoWidth > 0) {
        naturalW = mediaElement.videoWidth;
        naturalH = mediaElement.videoHeight;
      } else if (mediaElement instanceof HTMLImageElement && mediaElement.naturalWidth > 0) {
        naturalW = mediaElement.naturalWidth;
        naturalH = mediaElement.naturalHeight;
      }
    }

    const fitMode = clip.fitMode || 'fit';
    const mediaRatio = naturalW / Math.max(1, naturalH);
    const canvasRatio = canvasW / Math.max(1, canvasH);

    if (fitMode === 'fit') {
      if (mediaRatio > canvasRatio) {
        unscaledW = canvasW;
        unscaledH = canvasW / mediaRatio;
      } else {
        unscaledH = canvasH;
        unscaledW = canvasH * mediaRatio;
      }
    } else if (fitMode === 'fill') {
      if (mediaRatio > canvasRatio) {
        unscaledH = canvasH;
        unscaledW = canvasH * mediaRatio;
      } else {
        unscaledW = canvasW;
        unscaledH = canvasW / mediaRatio;
      }
    } else {
      unscaledW = naturalW;
      unscaledH = naturalH;
    }
  } else if (clip.type === 'text') {
    const textData = clip.textData || { text: clip.name || 'Metin' };
    const mCtx = ctx || getMeasureContext();
    const rawText = textData.text || clip.name || 'Metin';

    // Apply text transform if present
    let formattedText = rawText;
    if (textData.textTransform === 'uppercase') {
      formattedText = rawText.toLocaleUpperCase('tr-TR');
    } else if (textData.textTransform === 'lowercase') {
      formattedText = rawText.toLocaleLowerCase('tr-TR');
    } else if (textData.textTransform === 'capitalize') {
      formattedText = rawText.replace(/\b\w/g, (c) => c.toLocaleUpperCase('tr-TR'));
    }

    const fontSize = textData.fontSize || 54;
    const fontWeight = textData.fontWeight || 'bold';
    const fontStyle = textData.fontStyle === 'italic' ? 'italic ' : '';
    const fontFamily = textData.fontFamily || 'Plus Jakarta Sans, sans-serif';
    const lineHeight = fontSize * (textData.lineHeight || 1.25);

    let maxLineWidth = fontSize * 3; // sensible fallback
    const rawLines = formattedText.split('\n');
    let lineCount = rawLines.length;

    if (mCtx) {
      mCtx.save();
      mCtx.font = `${fontStyle}${fontWeight} ${fontSize}px ${fontFamily}`;

      // Measure lines with wrap
      const maxWidth = canvasW * 0.85;
      const wrappedLines: string[] = [];

      for (const rawLine of rawLines) {
        const words = rawLine.split(' ');
        let currentLine = '';

        for (const word of words) {
          const testLine = currentLine ? `${currentLine} ${word}` : word;
          const testWidth = mCtx.measureText(testLine).width;
          if (testWidth > maxWidth && currentLine) {
            wrappedLines.push(currentLine);
            currentLine = word;
          } else {
            currentLine = testLine;
          }
        }
        if (currentLine) wrappedLines.push(currentLine);
      }

      lineCount = Math.max(1, wrappedLines.length);
      maxLineWidth = 0;
      for (const line of wrappedLines) {
        const w = mCtx.measureText(line).width;
        if (w > maxLineWidth) maxLineWidth = w;
      }
      mCtx.restore();
    } else {
      // Estimator fallback
      maxLineWidth = Math.max(...rawLines.map((l) => l.length * fontSize * 0.55));
    }

    const padX = textData.paddingX ?? textData.boxPadding ?? textData.padding ?? 20;
    const padY = textData.paddingY ?? textData.boxPadding ?? textData.padding ?? 16;

    unscaledW = Math.max(60, maxLineWidth + padX * 2);
    unscaledH = Math.max(36, lineCount * lineHeight + padY * 2);
  } else if (clip.type === 'audio') {
    unscaledW = canvasW * 0.7;
    unscaledH = 70;
  }

  const width = Math.max(24, unscaledW * scaleX);
  const height = Math.max(18, unscaledH * scaleY);
  const halfW = width / 2;
  const halfH = height / 2;

  // Compute 4 rotated corner coordinates in canvas space
  const rad = (rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);

  const localCorners = [
    { x: -halfW, y: -halfH }, // TL
    { x: halfW, y: -halfH },  // TR
    { x: halfW, y: halfH },   // BR
    { x: -halfW, y: halfH },  // BL
  ];

  const corners = localCorners.map((pt) => ({
    x: centerX + pt.x * cos - pt.y * sin,
    y: centerY + pt.x * sin + pt.y * cos,
  }));

  const xs = corners.map((c) => c.x);
  const ys = corners.map((c) => c.y);

  return {
    centerX,
    centerY,
    width,
    height,
    rotation,
    scaleX,
    scaleY,
    halfW,
    halfH,
    corners,
    aabb: {
      minX: Math.min(...xs),
      minY: Math.min(...ys),
      maxX: Math.max(...xs),
      maxY: Math.max(...ys),
    },
  };
}

/**
 * Checks if a point (canvas coordinates) is inside the clip bounds
 */
export function isPointInClip(pointX: number, pointY: number, bounds: ClipBounds): boolean {
  const dx = pointX - bounds.centerX;
  const dy = pointY - bounds.centerY;
  const rad = (-bounds.rotation * Math.PI) / 180;
  const localX = dx * Math.cos(rad) - dy * Math.sin(rad);
  const localY = dx * Math.sin(rad) + dy * Math.cos(rad);

  return Math.abs(localX) <= bounds.halfW && Math.abs(localY) <= bounds.halfH;
}

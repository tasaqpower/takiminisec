/**
 * FORMA Video Editor — High-Fidelity Text Rasterizer
 * Guarantees exact font, Turkish character rendering (ç, Ç, ğ, Ğ, ı, İ, ö, Ö, ş, Ş, ü, Ü),
 * background pill boxes, shadow, stroke, and animation playback.
 */

import type { TextLayerData } from '../types';

export interface TextRenderOptions {
  layer: TextLayerData;
  timeInClip: number;      // Seconds into the text clip duration
  clipDuration: number;    // Total duration of the text clip
  canvasWidth: number;
  canvasHeight: number;
  centerX: number;         // X coordinate (in canvas pixels)
  centerY: number;         // Y coordinate (in canvas pixels)
  scale?: number;
  rotation?: number;       // degrees
  opacity?: number;
}

export function renderTextLayer(
  ctx: CanvasRenderingContext2D,
  options: TextRenderOptions
): void {
  const {
    layer,
    timeInClip,
    clipDuration,
    canvasWidth,
    centerX,
    centerY,
    scale = 1,
    rotation = 0,
    opacity = 1
  } = options;

  let displayText = layer.text;
  let animOpacity = 1;
  let animOffsetY = 0;
  let animScale = 1;

  // Compute text animation state
  const animDuration = Math.min(0.6, clipDuration / 3);
  const timeRemaining = clipDuration - timeInClip;

  switch (layer.animation) {
    case 'typewriter': {
      const typeSpeed = 0.04; // seconds per char
      const charCount = Math.floor(timeInClip / typeSpeed);
      displayText = layer.text.slice(0, Math.min(layer.text.length, charCount));
      break;
    }
    case 'fade': {
      if (timeInClip < animDuration) {
        animOpacity = timeInClip / animDuration;
      } else if (timeRemaining < animDuration) {
        animOpacity = Math.max(0, timeRemaining / animDuration);
      }
      break;
    }
    case 'slide-up': {
      if (timeInClip < animDuration) {
        const p = timeInClip / animDuration;
        animOffsetY = (1 - p) * 30;
        animOpacity = p;
      } else if (timeRemaining < animDuration) {
        const p = timeRemaining / animDuration;
        animOffsetY = -(1 - p) * 30;
        animOpacity = p;
      }
      break;
    }
    case 'slide-down': {
      if (timeInClip < animDuration) {
        const p = timeInClip / animDuration;
        animOffsetY = -(1 - p) * 30;
        animOpacity = p;
      } else if (timeRemaining < animDuration) {
        const p = timeRemaining / animDuration;
        animOffsetY = (1 - p) * 30;
        animOpacity = p;
      }
      break;
    }
    case 'scale': {
      if (timeInClip < animDuration) {
        const p = timeInClip / animDuration;
        animScale = 0.7 + p * 0.3;
        animOpacity = p;
      }
      break;
    }
    case 'none':
    default:
      break;
  }

  if (!displayText) return;

  ctx.save();
  ctx.translate(centerX, centerY + animOffsetY);

  if (rotation !== 0) {
    ctx.rotate((rotation * Math.PI) / 180);
  }

  const effectiveScale = scale * animScale;
  if (effectiveScale !== 1) {
    ctx.scale(effectiveScale, effectiveScale);
  }

  ctx.globalAlpha = Math.max(0, Math.min(1, opacity * animOpacity));

  // Font setup
  const fontStyle = layer.fontStyle === 'italic' ? 'italic ' : '';
  const fontWeight = layer.fontWeight || 'normal';
  const fontSize = layer.fontSize || 36;
  const fontFamily = layer.fontFamily || '"Plus Jakarta Sans", -apple-system, sans-serif';

  ctx.font = `${fontStyle}${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = layer.alignment || 'center';
  ctx.textBaseline = 'middle';

  // Word wrap lines
  const maxWidth = canvasWidth * 0.85;
  const rawLines = displayText.split('\n');
  const lines: string[] = [];

  for (const rawLine of rawLines) {
    const words = rawLine.split(' ');
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = ctx.measureText(testLine).width;
      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) lines.push(currentLine);
  }

  const lineHeight = fontSize * (layer.lineHeight || 1.3);
  const totalTextHeight = lines.length * lineHeight;

  // Background Box
  if (layer.backgroundColor && (layer.backgroundOpacity ?? 1) > 0) {
    let maxLineWidth = 0;
    for (const l of lines) {
      const w = ctx.measureText(l).width;
      if (w > maxLineWidth) maxLineWidth = w;
    }

    const padding = layer.padding || 12;
    const boxWidth = maxLineWidth + padding * 2;
    const boxHeight = totalTextHeight + padding * 2;
    const radius = layer.borderRadius || 8;

    let boxX = -boxWidth / 2;
    if (layer.alignment === 'left') boxX = -padding;
    else if (layer.alignment === 'right') boxX = -boxWidth + padding;

    const boxY = -boxHeight / 2;

    ctx.save();
    ctx.fillStyle = layer.backgroundColor;
    ctx.globalAlpha = (opacity * animOpacity) * (layer.backgroundOpacity ?? 1);

    // Draw rounded rect
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxWidth, boxHeight, radius);
    ctx.fill();
    ctx.restore();
  }

  // Shadow
  if (layer.shadowColor && (layer.shadowBlur || 0) > 0) {
    ctx.shadowColor = layer.shadowColor;
    ctx.shadowBlur = layer.shadowBlur || 4;
    ctx.shadowOffsetX = layer.shadowOffsetX || 0;
    ctx.shadowOffsetY = layer.shadowOffsetY || 2;
  }

  // Draw lines
  const startY = -(totalTextHeight / 2) + lineHeight / 2;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const y = startY + i * lineHeight;

    // Stroke
    if (layer.strokeColor && (layer.strokeWidth || 0) > 0) {
      ctx.lineWidth = layer.strokeWidth || 2;
      ctx.strokeStyle = layer.strokeColor;
      ctx.lineJoin = 'round';
      ctx.strokeText(line, 0, y);
    }

    // Fill
    ctx.fillStyle = layer.color || '#ffffff';
    ctx.fillText(line, 0, y);

    // Underline
    if (layer.underline) {
      const lineWidth = ctx.measureText(line).width;
      let lineStartX = -lineWidth / 2;
      if (layer.alignment === 'left') lineStartX = 0;
      else if (layer.alignment === 'right') lineStartX = -lineWidth;

      const underlineY = y + fontSize * 0.55;
      ctx.save();
      ctx.strokeStyle = layer.color || '#ffffff';
      ctx.lineWidth = Math.max(1, fontSize * 0.06);
      ctx.beginPath();
      ctx.moveTo(lineStartX, underlineY);
      ctx.lineTo(lineStartX + lineWidth, underlineY);
      ctx.stroke();
      ctx.restore();
    }
  }

  ctx.restore();
}

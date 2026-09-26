/**
 * FORMA Video Editor — Filter & Color Grading Engine
 * Implements 13 color and filter adjustments for video and image clips
 */

import type { ClipEffects } from '../types';

export const DEFAULT_CLIP_EFFECTS: ClipEffects = {
  brightness: 1,
  contrast: 1,
  saturation: 1,
  exposure: 0,
  temperature: 0,
  tint: 0,
  shadows: 0,
  highlights: 0,
  sharpness: 0,
  blur: 0,
  grayscale: 0,
  sepia: 0,
  vignette: 0
};

/**
 * Builds standard CSS filter string compatible with Canvas 2D ctx.filter
 */
export function buildCanvasFilterString(effects: ClipEffects): string {
  const filters: string[] = [];

  // Brightness + Exposure combined
  const totalBrightness = Math.max(0, effects.brightness + effects.exposure * 0.5);
  if (totalBrightness !== 1) {
    filters.push(`brightness(${Math.round(totalBrightness * 100)}%)`);
  }

  // Contrast + Shadows/Highlights proxy
  const totalContrast = Math.max(0, effects.contrast + (effects.highlights - effects.shadows) * 0.2);
  if (totalContrast !== 1) {
    filters.push(`contrast(${Math.round(totalContrast * 100)}%)`);
  }

  // Saturation
  if (effects.saturation !== 1) {
    filters.push(`saturate(${Math.round(effects.saturation * 100)}%)`);
  }

  // Grayscale (B&W)
  if (effects.grayscale > 0) {
    filters.push(`grayscale(${Math.round(effects.grayscale * 100)}%)`);
  }

  // Sepia
  if (effects.sepia > 0) {
    filters.push(`sepia(${Math.round(effects.sepia * 100)}%)`);
  }

  // Blur
  if (effects.blur > 0) {
    filters.push(`blur(${effects.blur}px)`);
  }

  // Tint / Temperature hue adjustment
  if (effects.temperature !== 0 || effects.tint !== 0) {
    // Warm shifts slightly toward red/yellow, cool toward blue
    const hueShift = Math.round(effects.tint * 25 + effects.temperature * 15);
    if (hueShift !== 0) {
      filters.push(`hue-rotate(${hueShift}deg)`);
    }
  }

  return filters.length > 0 ? filters.join(' ') : 'none';
}

/**
 * Applies custom Canvas overlay effects like Vignette or Temperature tint
 */
export function applyCanvasPostEffects(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  effects: ClipEffects
): void {
  // 1. Vignette overlay
  if (effects.vignette > 0) {
    const radius = Math.max(width, height) * 0.75;
    const gradient = ctx.createRadialGradient(
      width / 2,
      height / 2,
      radius * (1 - effects.vignette * 0.5),
      width / 2,
      height / 2,
      radius
    );
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, `rgba(0, 0, 0, ${Math.min(0.95, effects.vignette * 0.85)})`);

    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  // 2. Temperature tint color wash
  if (Math.abs(effects.temperature) > 0.05) {
    ctx.save();
    if (effects.temperature > 0) {
      // Warm golden wash
      ctx.fillStyle = `rgba(255, 170, 0, ${effects.temperature * 0.15})`;
    } else {
      // Cool blue wash
      ctx.fillStyle = `rgba(0, 100, 255, ${Math.abs(effects.temperature) * 0.15})`;
    }
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }
}

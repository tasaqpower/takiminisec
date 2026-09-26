/**
 * FORMA Video Editor — Filter & Color Grading Engine
 * Implements 13 color and filter adjustments for video and image clips
 */

import type { ClipEffects } from '../types';

export const DEFAULT_CLIP_EFFECTS: ClipEffects = {
  brightness: 0,
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
  vignette: 0,
};

/**
 * Builds standard CSS filter string compatible with Canvas 2D ctx.filter
 * Immune to NaN, undefined, or 0-offset brightness bugs that cause black screen flickering.
 */
export function buildCanvasFilterString(rawEffects?: Partial<ClipEffects> | null): string {
  if (!rawEffects) return 'none';

  // Brightness: handles 0 as neutral (offset around 1.0) and 1 as neutral factor
  let rawB = rawEffects.brightness;
  let normalizedBrightness = 1.0;
  if (rawB === undefined || rawB === null || Number.isNaN(rawB)) {
    normalizedBrightness = 1.0;
  } else if (rawB === 0 || rawB === 1) {
    normalizedBrightness = 1.0;
  } else if (rawB > 0 && rawB <= 1) {
    normalizedBrightness = 1.0 + rawB;
  } else if (rawB < 0 && rawB >= -1) {
    normalizedBrightness = Math.max(0.05, 1.0 + rawB);
  } else {
    normalizedBrightness = Math.max(0.05, rawB);
  }

  const exp = typeof rawEffects.exposure === 'number' && !Number.isNaN(rawEffects.exposure) ? rawEffects.exposure : 0;
  const totalBrightness = Math.max(0.05, normalizedBrightness + exp * 0.5);

  // Contrast: handles 1 as neutral (or 0 if uninitialized)
  let rawC = rawEffects.contrast;
  let c = 1.0;
  if (typeof rawC === 'number' && !Number.isNaN(rawC) && rawC > 0) {
    c = rawC;
  }
  const highlights = typeof rawEffects.highlights === 'number' && !Number.isNaN(rawEffects.highlights) ? rawEffects.highlights : 0;
  const shadows = typeof rawEffects.shadows === 'number' && !Number.isNaN(rawEffects.shadows) ? rawEffects.shadows : 0;
  const totalContrast = Math.max(0.1, c + (highlights - shadows) * 0.2);

  // Saturation: handles 1 as neutral
  let rawS = rawEffects.saturation;
  let s = 1.0;
  if (rawEffects.grayscale && rawEffects.grayscale > 0) {
    s = 0;
  } else if (typeof rawS === 'number' && !Number.isNaN(rawS) && rawS > 0) {
    s = rawS;
  }

  const filters: string[] = [];

  if (Math.abs(totalBrightness - 1) > 0.02) {
    filters.push(`brightness(${Math.round(totalBrightness * 100)}%)`);
  }
  if (Math.abs(totalContrast - 1) > 0.02) {
    filters.push(`contrast(${Math.round(totalContrast * 100)}%)`);
  }
  if (Math.abs(s - 1) > 0.02) {
    filters.push(`saturate(${Math.round(s * 100)}%)`);
  }
  if (rawEffects.grayscale && rawEffects.grayscale > 0) {
    filters.push(`grayscale(${Math.round(Math.min(1, rawEffects.grayscale) * 100)}%)`);
  }
  if (rawEffects.sepia && rawEffects.sepia > 0) {
    filters.push(`sepia(${Math.round(Math.min(1, rawEffects.sepia) * 100)}%)`);
  }
  if (rawEffects.blur && rawEffects.blur > 0) {
    filters.push(`blur(${Math.min(20, rawEffects.blur)}px)`);
  }
  if (rawEffects.temperature || rawEffects.tint) {
    const hueShift = Math.round((rawEffects.tint || 0) * 25 + (rawEffects.temperature || 0) * 0.4);
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
  effects?: Partial<ClipEffects> | null
): void {
  if (!effects || !effects.vignette || effects.vignette <= 0) return;

  const radius = Math.max(width, height) * 0.75;
  const gradient = ctx.createRadialGradient(
    width / 2,
    height / 2,
    radius * (1 - Math.min(1, effects.vignette) * 0.5),
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

export interface FilterPreset {
  id: string;
  name: string;
  category: string;
  description: string;
  thumbnailColor: string;
  effects: Partial<ClipEffects>;
}

export const COLOR_PRESETS: FilterPreset[] = [
  {
    id: 'normal',
    name: 'Orijinal (Sıfırla)',
    category: 'Temel',
    description: 'Tüm filtre ve renk efektlerini sıfırlar',
    thumbnailColor: '#3b82f6',
    effects: {
      brightness: 0,
      contrast: 1,
      saturation: 1,
      exposure: 0,
      temperature: 0,
      tint: 0,
      grayscale: 0,
      sepia: 0,
      vignette: 0,
      blur: 0,
    },
  },
  {
    id: 'cinematic',
    name: 'Sinematik Teal & Orange',
    category: 'Film',
    description: 'Hollywood renk derecelendirmesi, yüksek kontrast ve derin gölgeler',
    thumbnailColor: '#0ea5e9',
    effects: {
      contrast: 1.25,
      saturation: 1.2,
      temperature: -15,
      tint: 10,
      exposure: 0.05,
      vignette: 0.3,
    },
  },
  {
    id: 'noir',
    name: 'Siyah & Beyaz (Film Noir)',
    category: 'Klasik',
    description: 'Yüksek kontrastlı dramatik monokrom sinema havası',
    thumbnailColor: '#4b5563',
    effects: {
      grayscale: 1,
      contrast: 1.35,
      brightness: 0.05,
      vignette: 0.4,
    },
  },
  {
    id: 'vintage',
    name: "90'lar VHS Retro",
    category: 'Retro',
    description: 'Nostaljik sıcak sepya tonları ve solgun renkler',
    thumbnailColor: '#d97706',
    effects: {
      sepia: 0.35,
      contrast: 1.1,
      saturation: 0.85,
      temperature: 25,
      vignette: 0.25,
    },
  },
  {
    id: 'warm-summer',
    name: 'Sıcak Güneş (Golden Hour)',
    category: 'Atmosfer',
    description: 'Altın saat gün batımı sıcaklığı ve parlak ışıltı',
    thumbnailColor: '#f59e0b',
    effects: {
      temperature: 35,
      saturation: 1.25,
      brightness: 0.08,
      contrast: 1.05,
      vignette: 0.15,
    },
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Neon',
    category: 'Modern',
    description: 'Mor-mavi fütüristik neon doygunluğu ve yüksek dinamizm',
    thumbnailColor: '#ec4899',
    effects: {
      saturation: 1.5,
      contrast: 1.3,
      temperature: -40,
      tint: -20,
      vignette: 0.35,
    },
  },
  {
    id: 'scandi-cold',
    name: 'İskandinav Soğuk (Nordic)',
    category: 'Minimal',
    description: 'Mavi ağırlıklı, hafif doygunluğu azaltılmış ferah tonlar',
    thumbnailColor: '#67e8f9',
    effects: {
      temperature: -30,
      saturation: 0.75,
      contrast: 1.15,
      brightness: 0.02,
      vignette: 0.1,
    },
  },
];


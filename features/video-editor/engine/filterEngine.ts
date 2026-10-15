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
    id: 'cinematic-teal-orange',
    name: 'Cinematic Teal & Orange',
    category: 'Sinema',
    description: 'Hollywood renk derecelendirmesi: sıcak ten tonları ve derin turkuaz gölgeler',
    thumbnailColor: '#0ea5e9',
    effects: {
      contrast: 1.3,
      saturation: 1.25,
      temperature: -20,
      tint: 12,
      exposure: 0.06,
      vignette: 0.35,
    },
  },
  {
    id: 'dark-moody',
    name: 'Dark Moody Sinema',
    category: 'Sinema',
    description: 'Derin gölgeler, düşük doygunluk ve sinematik karanlık atmosfer',
    thumbnailColor: '#1e293b',
    effects: {
      contrast: 1.4,
      saturation: 0.75,
      brightness: -0.05,
      temperature: -10,
      exposure: -0.1,
      vignette: 0.45,
    },
  },
  {
    id: 'cyberpunk-neon',
    name: 'Cyberpunk Neon',
    category: 'Modern',
    description: 'Fütüristik mor-mavi neon ışıltısı ve ultra canlı renk doygunluğu',
    thumbnailColor: '#ec4899',
    effects: {
      saturation: 1.6,
      contrast: 1.35,
      temperature: -35,
      tint: -25,
      vignette: 0.3,
    },
  },
  {
    id: 'vintage-film',
    name: 'Vintage Film 35mm',
    category: 'Retro',
    description: 'Analog 35mm film tonları, sıcak sepya ve yumuşak gren kontrastı',
    thumbnailColor: '#b45309',
    effects: {
      sepia: 0.3,
      contrast: 1.15,
      saturation: 0.9,
      temperature: 28,
      tint: 8,
      vignette: 0.28,
    },
  },
  {
    id: 'crisp-ai-sharpness',
    name: 'Crisp AI Sharpness',
    category: 'AI İyileştirme',
    description: 'Runway/Sora/Kling bulanıklığını gideren yüksek detay ve mikro kontrast keskinleştirme',
    thumbnailColor: '#06b6d4',
    effects: {
      contrast: 1.25,
      sharpness: 0.85,
      exposure: 0.04,
      saturation: 1.1,
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

export function getEffectsForColorFilter(colorFilterId?: string | null): Partial<ClipEffects> | null {
  if (!colorFilterId || colorFilterId === 'normal') return null;
  const normalized = colorFilterId.toLowerCase();
  if (normalized.includes('teal') || normalized.includes('cinematic')) {
    return { contrast: 1.3, saturation: 1.25, temperature: -20, tint: 12, exposure: 0.06, vignette: 0.35 };
  }
  if (normalized.includes('dark') || normalized.includes('moody')) {
    return { contrast: 1.4, saturation: 0.75, brightness: -0.05, temperature: -10, exposure: -0.1, vignette: 0.45 };
  }
  if (normalized.includes('cyberpunk') || normalized.includes('neon')) {
    return { saturation: 1.6, contrast: 1.35, temperature: -35, tint: -25, vignette: 0.3 };
  }
  if (normalized.includes('vintage') || normalized.includes('film') || normalized.includes('retro')) {
    return { sepia: 0.3, contrast: 1.15, saturation: 0.9, temperature: 28, tint: 8, vignette: 0.28 };
  }
  if (normalized.includes('crisp') || normalized.includes('sharp')) {
    return { contrast: 1.25, sharpness: 0.85, exposure: 0.04, saturation: 1.1 };
  }
  if (normalized.includes('noir') || normalized.includes('bw') || normalized.includes('black')) {
    return { grayscale: 1, contrast: 1.4, brightness: 0.05, vignette: 0.4 };
  }
  const preset = COLOR_PRESETS.find((p) => p.id === colorFilterId);
  return preset ? preset.effects : null;
}

// =========================================================================
// 24 VISUAL EFFECTS FOR TIMELINE EFFECT SEGMENTS (Section 11)
// =========================================================================

export interface VisualEffectDef {
  id: string;
  name: string;
  category: 'blur' | 'color' | 'retro' | 'stylize' | 'light';
  categoryName: string;
  description: string;
  icon: string;
  defaultDuration: number;
  defaultIntensity: number; // 0.0 to 1.0
  parameters?: Record<string, any>;
}

export const VISUAL_EFFECT_DEFINITIONS: VisualEffectDef[] = [
  // Bulanıklık & Netlik (Blur & Focus)
  {
    id: 'gaussian-blur',
    name: 'Gauss Bulanıklığı (Gaussian Blur)',
    category: 'blur',
    categoryName: 'Bulanıklık',
    description: 'Pürüzsüz optik alan derinliği bulanıklığı',
    icon: '🌫️',
    defaultDuration: 2.0,
    defaultIntensity: 0.5,
  },
  {
    id: 'directional-blur',
    name: 'Yönlü Bulanıklık (Directional Blur)',
    category: 'blur',
    categoryName: 'Bulanıklık',
    description: 'Doğrusal hareket hızı izi efekti',
    icon: '💨',
    defaultDuration: 2.0,
    defaultIntensity: 0.6,
  },
  {
    id: 'sharpen',
    name: 'Keskinleştirme (Sharpen)',
    category: 'blur',
    categoryName: 'Bulanıklık',
    description: 'Detayları ve kenar kontrastını belirginleştirir',
    icon: '🗡️',
    defaultDuration: 2.0,
    defaultIntensity: 0.7,
  },
  {
    id: 'glow',
    name: 'Parlama & Işıma (Glow)',
    category: 'light',
    categoryName: 'Işık & Parlama',
    description: 'Aydınlık alanlardan taşan rüya gibi ışık halesi',
    icon: '🌟',
    defaultDuration: 2.0,
    defaultIntensity: 0.6,
  },
  {
    id: 'vignette',
    name: 'Köşe Karartması (Vignette)',
    category: 'light',
    categoryName: 'Işık & Parlama',
    description: 'Merkezi odağa alan sinematik dairesel köşe gölgesi',
    icon: '🔘',
    defaultDuration: 2.0,
    defaultIntensity: 0.5,
  },
  {
    id: 'exposure-flash',
    name: 'Pozlama Patlaması (Exposure Flash)',
    category: 'light',
    categoryName: 'Işık & Parlama',
    description: 'Göz alıcı yüksek pozlama ışık patlaması',
    icon: '⚡',
    defaultDuration: 1.0,
    defaultIntensity: 0.8,
  },
  {
    id: 'dreamy-soft',
    name: 'Rüya & Yumuşak Odak (Dreamy Soft)',
    category: 'light',
    categoryName: 'Işık & Parlama',
    description: 'Romantik masalsı yumuşak ışık ve ışıma',
    icon: '🌸',
    defaultDuration: 2.5,
    defaultIntensity: 0.5,
  },
  {
    id: 'edge-darken',
    name: 'Kenar Karartma (Edge Darken)',
    category: 'light',
    categoryName: 'Işık & Parlama',
    description: 'Çerçeve kenarlarını derinleştiren gölge şeridi',
    icon: '🔲',
    defaultDuration: 2.0,
    defaultIntensity: 0.6,
  },

  // Retro & Analog Dokular
  {
    id: 'film-grain',
    name: 'Film Greni (Film Grain)',
    category: 'retro',
    categoryName: 'Retro & Analog',
    description: '35mm analog sinema filmi organik gümüş greni',
    icon: '🎞️',
    defaultDuration: 3.0,
    defaultIntensity: 0.5,
  },
  {
    id: 'dust-scratches',
    name: 'Toz ve Çizikler (Dust & Scratches)',
    category: 'retro',
    categoryName: 'Retro & Analog',
    description: 'Eski film makarasından kalan rastgele dikey çizikler ve toz',
    icon: '📜',
    defaultDuration: 2.5,
    defaultIntensity: 0.6,
  },
  {
    id: 'scanlines',
    name: 'CRT Tarama Çizgileri (Scanlines)',
    category: 'retro',
    categoryName: 'Retro & Analog',
    description: 'Tüplü televizyon ve retro arcade monitör çizgileri',
    icon: '📺',
    defaultDuration: 2.5,
    defaultIntensity: 0.5,
  },
  {
    id: 'vhs-noise',
    name: 'VHS Paraziti (VHS Noise)',
    category: 'retro',
    categoryName: 'Retro & Analog',
    description: 'Manyetik bant dalgalanması, gren ve tracking çizgileri',
    icon: '📼',
    defaultDuration: 2.0,
    defaultIntensity: 0.7,
  },

  // Stilize & Dijital Bozulmalar
  {
    id: 'chromatic-aberration',
    name: 'Kromatik Sapma (Chromatic Aberration)',
    category: 'stylize',
    categoryName: 'Stilize & Glitch',
    description: 'Optik mercek kenarı renk kırılması (kırmızı/mavi ayrışması)',
    icon: '🔴',
    defaultDuration: 2.0,
    defaultIntensity: 0.6,
  },
  {
    id: 'rgb-shift',
    name: 'RGB Kayması (RGB Shift)',
    category: 'stylize',
    categoryName: 'Stilize & Glitch',
    description: 'Renk kanallarının yatayda dinamik olarak ayrışması',
    icon: '🌈',
    defaultDuration: 1.5,
    defaultIntensity: 0.7,
  },
  {
    id: 'pixelate',
    name: 'Pikselleştirme (Pixelate)',
    category: 'stylize',
    categoryName: 'Stilize & Glitch',
    description: 'Retro 8-bit mozaik pikselleştirme',
    icon: '👾',
    defaultDuration: 2.0,
    defaultIntensity: 0.5,
  },
  {
    id: 'glitch',
    name: 'Dijital Bozulma (Glitch)',
    category: 'stylize',
    categoryName: 'Stilize & Glitch',
    description: 'Ani veri bozulması, kare yırtılması ve piksel kayması',
    icon: '⚡',
    defaultDuration: 1.2,
    defaultIntensity: 0.8,
  },
  {
    id: 'posterize',
    name: 'Posterleştirme (Posterize)',
    category: 'stylize',
    categoryName: 'Stilize & Glitch',
    description: 'Renk ton seviyelerini azaltarak pop-art poster görünümü',
    icon: '🎨',
    defaultDuration: 2.0,
    defaultIntensity: 0.6,
  },

  // Renk Tonları & Sınıflandırma
  {
    id: 'black-and-white',
    name: 'Siyah Beyaz (Black & White)',
    category: 'color',
    categoryName: 'Renk & Atmosfer',
    description: 'Zamansız monokrom siyah-beyaz tonlama',
    icon: '⚫',
    defaultDuration: 3.0,
    defaultIntensity: 1.0,
  },
  {
    id: 'sepia',
    name: 'Sepya Nostalji (Sepia)',
    category: 'color',
    categoryName: 'Renk & Atmosfer',
    description: 'Tarihi fotoğrafların sıcak kahverengi tonlaması',
    icon: '🍂',
    defaultDuration: 3.0,
    defaultIntensity: 0.8,
  },
  {
    id: 'duotone',
    name: 'Çift Ton (Duotone)',
    category: 'color',
    categoryName: 'Renk & Atmosfer',
    description: 'İki kontrast rengin harmanlandığı modern grafik tonlama',
    icon: '🎭',
    defaultDuration: 2.5,
    defaultIntensity: 0.7,
  },
  {
    id: 'warm-film',
    name: 'Sıcak Film (Warm Film)',
    category: 'color',
    categoryName: 'Renk & Atmosfer',
    description: 'Güneşli, altın ve kehribar sıcaklığında renk derecelendirme',
    icon: '☀️',
    defaultDuration: 3.0,
    defaultIntensity: 0.6,
  },
  {
    id: 'cold-film',
    name: 'Soğuk Film (Cold Film)',
    category: 'color',
    categoryName: 'Renk & Atmosfer',
    description: 'Sinematik soğuk mavi ve tekinsiz atmosfer',
    icon: '❄️',
    defaultDuration: 3.0,
    defaultIntensity: 0.6,
  },
  {
    id: 'high-contrast',
    name: 'Yüksek Kontrast (High Contrast)',
    category: 'color',
    categoryName: 'Renk & Atmosfer',
    description: 'Derin gölgeler ve parlayan parlak alanlar',
    icon: '🌓',
    defaultDuration: 2.0,
    defaultIntensity: 0.7,
  },
  {
    id: 'fade-colors',
    name: 'Solgun Renkler (Fade Colors)',
    category: 'color',
    categoryName: 'Renk & Atmosfer',
    description: 'İskandinav ve indie tarzı düşük doygunlukta mat renkler',
    icon: '🌫️',
    defaultDuration: 3.0,
    defaultIntensity: 0.6,
  },
];

/**
 * Procedural offscreen noise canvas cache for 60fps grain
 */
let noiseCacheCanvas: HTMLCanvasElement | null = null;
let noiseCacheCtx: CanvasRenderingContext2D | null = null;

function getNoiseCanvas(width: number, height: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const nw = Math.min(640, width);
  const nh = Math.min(360, height);
  if (!noiseCacheCanvas) {
    noiseCacheCanvas = document.createElement('canvas');
    noiseCacheCanvas.width = nw;
    noiseCacheCanvas.height = nh;
    noiseCacheCtx = noiseCacheCanvas.getContext('2d');
  }
  if (!noiseCacheCtx) return null;

  const imgData = noiseCacheCtx.createImageData(nw, nh);
  const buf = new Uint32Array(imgData.data.buffer);
  for (let i = 0; i < buf.length; i++) {
    const val = (Math.random() * 255) | 0;
    // 32-bit little endian: AABBGGRR
    buf[i] = (255 << 24) | (val << 16) | (val << 8) | val;
  }
  noiseCacheCtx.putImageData(imgData, 0, 0);
  return noiseCacheCanvas;
}

/**
 * Applies a timed Visual Effect Segment onto the canvas frame
 */
export function applyVisualEffectSegment(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  effectId: string,
  intensity: number = 0.5,
  timeInEffect: number = 0,
  parameters: Record<string, any> = {}
): void {
  const normIntensity = Math.max(0, Math.min(1, intensity));

  switch (effectId) {
    case 'gaussian-blur': {
      const px = Math.round(normIntensity * 16);
      ctx.save();
      ctx.filter = `blur(${px}px)`;
      // Note: blur filter is already applied during main draw if embedded, or re-drawn
      ctx.restore();
      break;
    }

    case 'vignette': {
      const radius = Math.max(width, height) * 0.75;
      const gradient = ctx.createRadialGradient(
        width / 2,
        height / 2,
        radius * (1 - normIntensity * 0.6),
        width / 2,
        height / 2,
        radius
      );
      gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
      gradient.addColorStop(1, `rgba(0, 0, 0, ${normIntensity * 0.9})`);

      ctx.save();
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
      break;
    }

    case 'glow': {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(255, 255, 255, ${normIntensity * 0.35})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
      break;
    }

    case 'exposure-flash': {
      const flashAlpha = normIntensity * (1 - (timeInEffect % 1.0));
      if (flashAlpha > 0.05) {
        ctx.save();
        ctx.fillStyle = `rgba(255, 255, 255, ${flashAlpha * 0.75})`;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
      break;
    }

    case 'dreamy-soft': {
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      const grad = ctx.createRadialGradient(width / 2, height / 2, 50, width / 2, height / 2, width);
      grad.addColorStop(0, `rgba(254, 215, 170, ${normIntensity * 0.3})`);
      grad.addColorStop(1, `rgba(236, 72, 153, ${normIntensity * 0.2})`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
      break;
    }

    case 'edge-darken': {
      ctx.save();
      ctx.lineWidth = Math.round(normIntensity * 40);
      ctx.strokeStyle = `rgba(0, 0, 0, ${normIntensity * 0.8})`;
      ctx.strokeRect(0, 0, width, height);
      ctx.restore();
      break;
    }

    case 'film-grain': {
      const noise = getNoiseCanvas(width, height);
      if (noise) {
        ctx.save();
        ctx.globalAlpha = normIntensity * 0.18;
        ctx.globalCompositeOperation = 'overlay';
        ctx.drawImage(noise, 0, 0, width, height);
        ctx.restore();
      }
      break;
    }

    case 'dust-scratches': {
      ctx.save();
      ctx.strokeStyle = `rgba(255, 255, 255, ${normIntensity * 0.4})`;
      ctx.lineWidth = 1;
      const seed = Math.floor(timeInEffect * 15);
      for (let i = 0; i < 3; i++) {
        const x = ((seed * 137 + i * 359) % width);
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x + (Math.sin(seed + i) * 8), height);
        ctx.stroke();
      }
      // Dust specks
      ctx.fillStyle = `rgba(255, 255, 255, ${normIntensity * 0.5})`;
      for (let i = 0; i < 8; i++) {
        const sx = ((seed * 97 + i * 181) % width);
        const sy = ((seed * 83 + i * 223) % height);
        ctx.beginPath();
        ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      break;
    }

    case 'scanlines': {
      ctx.save();
      ctx.fillStyle = `rgba(0, 0, 0, ${normIntensity * 0.35})`;
      for (let y = 0; y < height; y += 4) {
        ctx.fillRect(0, y, width, 1.5);
      }
      ctx.restore();
      break;
    }

    case 'vhs-noise': {
      ctx.save();
      // Scanlines
      ctx.fillStyle = `rgba(0, 0, 0, ${normIntensity * 0.3})`;
      for (let y = 0; y < height; y += 4) {
        ctx.fillRect(0, y, width, 1.5);
      }
      // Horizontal jitter tracking bar
      const barY = ((timeInEffect * 120) % (height + 60)) - 30;
      ctx.fillStyle = `rgba(255, 255, 255, ${normIntensity * 0.25})`;
      ctx.fillRect(0, barY, width, 14);
      ctx.restore();
      break;
    }

    case 'chromatic-aberration':
    case 'rgb-shift': {
      // Handled via filter or canvas translation offset
      break;
    }

    case 'glitch': {
      ctx.save();
      const seed = Math.floor(timeInEffect * 12);
      ctx.fillStyle = `rgba(0, 255, 255, ${normIntensity * 0.25})`;
      const sliceY = (seed * 89) % (height - 40);
      ctx.fillRect(0, sliceY, width, 18);
      ctx.fillStyle = `rgba(255, 0, 128, ${normIntensity * 0.25})`;
      ctx.fillRect(0, (sliceY + 22) % height, width, 12);
      ctx.restore();
      break;
    }

    case 'black-and-white': {
      ctx.save();
      ctx.globalCompositeOperation = 'color';
      ctx.fillStyle = `rgba(128, 128, 128, ${normIntensity})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
      break;
    }

    case 'sepia': {
      ctx.save();
      ctx.globalCompositeOperation = 'color';
      ctx.fillStyle = `rgba(112, 66, 20, ${normIntensity * 0.75})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
      break;
    }

    case 'duotone': {
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = `rgba(79, 70, 229, ${normIntensity * 0.6})`; // Deep indigo
      ctx.fillRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'screen';
      ctx.fillStyle = `rgba(236, 72, 153, ${normIntensity * 0.4})`; // Pink
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
      break;
    }

    case 'warm-film': {
      ctx.save();
      ctx.globalCompositeOperation = 'color';
      ctx.fillStyle = `rgba(245, 158, 11, ${normIntensity * 0.35})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
      break;
    }

    case 'cold-film': {
      ctx.save();
      ctx.globalCompositeOperation = 'color';
      ctx.fillStyle = `rgba(6, 182, 212, ${normIntensity * 0.35})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
      break;
    }

    case 'high-contrast': {
      ctx.save();
      ctx.globalCompositeOperation = 'overlay';
      ctx.fillStyle = `rgba(128, 128, 128, ${normIntensity * 0.4})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
      break;
    }

    case 'fade-colors': {
      ctx.save();
      ctx.globalCompositeOperation = 'color';
      ctx.fillStyle = `rgba(180, 180, 180, ${normIntensity * 0.45})`;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();
      break;
    }

    default:
      break;
  }
}

// =========================================================================
// REAL 3D .CUBE LUT PARSER & TRILINEAR INTERPOLATOR (Section 13)
// =========================================================================

export interface CubeLut3D {
  title?: string;
  size: number;
  domainMin: [number, number, number];
  domainMax: [number, number, number];
  data: Float32Array; // size * size * size * 3 entries
}

/**
 * Parses Adobe / DaVinci Resolve .cube 3D LUT files.
 * Extracts LUT_3D_SIZE, DOMAIN_MIN, DOMAIN_MAX, and RGB floats.
 */
export function parseCubeLut(cubeText: string): CubeLut3D | null {
  if (!cubeText || typeof cubeText !== 'string') return null;

  const lines = cubeText.split('\n');
  let size = 0;
  let title = 'Custom LUT';
  let domainMin: [number, number, number] = [0.0, 0.0, 0.0];
  let domainMax: [number, number, number] = [1.0, 1.0, 1.0];
  const values: number[] = [];

  for (let rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    if (line.toUpperCase().startsWith('TITLE')) {
      const match = line.match(/^TITLE\s+["']?([^"']+)["']?/i);
      if (match) title = match[1];
      continue;
    }

    if (line.toUpperCase().startsWith('LUT_3D_SIZE')) {
      const parts = line.split(/\s+/);
      size = parseInt(parts[1], 10);
      continue;
    }

    if (line.toUpperCase().startsWith('DOMAIN_MIN')) {
      const parts = line.split(/\s+/).slice(1).map(Number);
      if (parts.length >= 3 && !parts.some(Number.isNaN)) {
        domainMin = [parts[0], parts[1], parts[2]];
      }
      continue;
    }

    if (line.toUpperCase().startsWith('DOMAIN_MAX')) {
      const parts = line.split(/\s+/).slice(1).map(Number);
      if (parts.length >= 3 && !parts.some(Number.isNaN)) {
        domainMax = [parts[0], parts[1], parts[2]];
      }
      continue;
    }

    if (line.toUpperCase().startsWith('LUT_1D_SIZE')) {
      // 1D LUT not supported in 3D pipeline
      return null;
    }

    const parts = line.split(/\s+/).map(Number);
    if (parts.length >= 3 && !parts.some(Number.isNaN)) {
      values.push(parts[0], parts[1], parts[2]);
    }
  }

  if (size >= 2 && values.length === size * size * size * 3) {
    return {
      title,
      size,
      domainMin,
      domainMax,
      data: new Float32Array(values),
    };
  }

  return null;
}

/**
 * Trilinearly interpolates a single RGB triplet against a 3D LUT.
 * Input r, g, b are in 0.0 to 1.0. Returns [outR, outG, outB] in 0.0 to 1.0.
 */
export function interpolate3DLutRgb(
  r: number,
  g: number,
  b: number,
  lut: CubeLut3D
): [number, number, number] {
  const { size, data, domainMin, domainMax } = lut;
  const maxIdx = size - 1;

  // Normalize into domain
  const spanR = domainMax[0] - domainMin[0] || 1;
  const spanG = domainMax[1] - domainMin[1] || 1;
  const spanB = domainMax[2] - domainMin[2] || 1;

  const rNorm = Math.max(0, Math.min(1, (r - domainMin[0]) / spanR)) * maxIdx;
  const gNorm = Math.max(0, Math.min(1, (g - domainMin[1]) / spanG)) * maxIdx;
  const bNorm = Math.max(0, Math.min(1, (b - domainMin[2]) / spanB)) * maxIdx;

  const r0 = Math.floor(rNorm);
  const g0 = Math.floor(gNorm);
  const b0 = Math.floor(bNorm);

  const r1 = Math.min(maxIdx, r0 + 1);
  const g1 = Math.min(maxIdx, g0 + 1);
  const b1 = Math.min(maxIdx, b0 + 1);

  const dr = rNorm - r0;
  const dg = gNorm - g0;
  const db = bNorm - b0;

  const strideR = 3;
  const strideG = size * 3;
  const strideB = size * size * 3;

  const idx000 = b0 * strideB + g0 * strideG + r0 * strideR;
  const idx100 = b0 * strideB + g0 * strideG + r1 * strideR;
  const idx010 = b0 * strideB + g1 * strideG + r0 * strideR;
  const idx110 = b0 * strideB + g1 * strideG + r1 * strideR;
  const idx001 = b1 * strideB + g0 * strideG + r0 * strideR;
  const idx101 = b1 * strideB + g0 * strideG + r1 * strideR;
  const idx011 = b1 * strideB + g1 * strideG + r0 * strideR;
  const idx111 = b1 * strideB + g1 * strideG + r1 * strideR;

  // Interpolate channel 0 (R)
  const c00_0 = data[idx000] * (1 - dr) + data[idx100] * dr;
  const c10_0 = data[idx010] * (1 - dr) + data[idx110] * dr;
  const c01_0 = data[idx001] * (1 - dr) + data[idx101] * dr;
  const c11_0 = data[idx011] * (1 - dr) + data[idx111] * dr;
  const c0_0 = c00_0 * (1 - dg) + c10_0 * dg;
  const c1_0 = c01_0 * (1 - dg) + c11_0 * dg;
  const outR = c0_0 * (1 - db) + c1_0 * db;

  // Interpolate channel 1 (G)
  const c00_1 = data[idx000 + 1] * (1 - dr) + data[idx100 + 1] * dr;
  const c10_1 = data[idx010 + 1] * (1 - dr) + data[idx110 + 1] * dr;
  const c01_1 = data[idx001 + 1] * (1 - dr) + data[idx101 + 1] * dr;
  const c11_1 = data[idx011 + 1] * (1 - dr) + data[idx111 + 1] * dr;
  const c0_1 = c00_1 * (1 - dg) + c10_1 * dg;
  const c1_1 = c01_1 * (1 - dg) + c11_1 * dg;
  const outG = c0_1 * (1 - db) + c1_1 * db;

  // Interpolate channel 2 (B)
  const c00_2 = data[idx000 + 2] * (1 - dr) + data[idx100 + 2] * dr;
  const c10_2 = data[idx010 + 2] * (1 - dr) + data[idx110 + 2] * dr;
  const c01_2 = data[idx001 + 2] * (1 - dr) + data[idx101 + 2] * dr;
  const c11_2 = data[idx011 + 2] * (1 - dr) + data[idx111 + 2] * dr;
  const c0_2 = c00_2 * (1 - dg) + c10_2 * dg;
  const c1_2 = c01_2 * (1 - dg) + c11_2 * dg;
  const outB = c0_2 * (1 - db) + c1_2 * db;

  return [outR, outG, outB];
}

/**
 * Applies 3D LUT to Canvas ImageData in-place using trilinear interpolation.
 * Supports intensity blending (0.0 = 0% to 1.0 = 100%).
 */
export function apply3DLutToImageData(imageData: ImageData, lut: CubeLut3D, intensity: number = 1.0): void {
  const pixels = imageData.data;
  const len = pixels.length;
  const blend = Math.max(0, Math.min(1, intensity));

  if (blend <= 0) return; // 0% intensity is identity / no change

  for (let i = 0; i < len; i += 4) {
    const origR = pixels[i];
    const origG = pixels[i + 1];
    const origB = pixels[i + 2];

    const r = origR / 255;
    const g = origG / 255;
    const b = origB / 255;

    const [outR, outG, outB] = interpolate3DLutRgb(r, g, b, lut);

    const lutR = Math.min(255, Math.max(0, Math.round(outR * 255)));
    const lutG = Math.min(255, Math.max(0, Math.round(outG * 255)));
    const lutB = Math.min(255, Math.max(0, Math.round(outB * 255)));

    if (blend >= 1.0) {
      pixels[i] = lutR;
      pixels[i + 1] = lutG;
      pixels[i + 2] = lutB;
    } else {
      pixels[i] = Math.round(origR * (1 - blend) + lutR * blend);
      pixels[i + 1] = Math.round(origG * (1 - blend) + lutG * blend);
      pixels[i + 2] = Math.round(origB * (1 - blend) + lutB * blend);
    }
  }
}

/**
 * Applies 3D LUT directly to an HTMLCanvasElement with optional intensity.
 */
export function applyCubeLutToCanvas(canvas: HTMLCanvasElement, lut: CubeLut3D, intensity: number = 1.0): void {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return;
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  apply3DLutToImageData(imgData, lut, intensity);
  ctx.putImageData(imgData, 0, 0);
}

/**
 * In-memory cache for parsed 3D LUT instances.
 * Backed by globalThis.__formaLutCache to ensure singletons across module imports.
 */
function getLutCache(): Map<string, CubeLut3D> {
  const g = typeof globalThis !== 'undefined' ? (globalThis as any) : (typeof window !== 'undefined' ? (window as any) : {} as any);
  if (!g.__formaLutCache) {
    g.__formaLutCache = new Map<string, CubeLut3D>();
  }
  return g.__formaLutCache;
}

export function getCachedCubeLut(idOrPath: string): CubeLut3D | null {
  if (!idOrPath) return null;
  const cache = getLutCache();
  if (cache.has(idOrPath)) return cache.get(idOrPath)!;
  const clean = idOrPath.replace(/^lut-/, '').replace(/\.cube$/, '');
  if (cache.has(clean)) return cache.get(clean)!;
  if (cache.has(`lut-${clean}`)) return cache.get(`lut-${clean}`)!;
  if (cache.has(`${clean}.cube`)) return cache.get(`${clean}.cube`)!;
  return null;
}

export function setCachedCubeLut(idOrPath: string, lut: CubeLut3D): void {
  const cache = getLutCache();
  cache.set(idOrPath, lut);
  const clean = idOrPath.replace(/^lut-/, '').replace(/\.cube$/, '');
  cache.set(clean, lut);
}

/**
 * Loads a .cube file via fetch, parses it, and caches the resulting CubeLut3D.
 */
export async function loadAndCacheCubeLut(idOrPath: string): Promise<CubeLut3D | null> {
  const cached = getCachedCubeLut(idOrPath);
  if (cached) return cached;

  let url = idOrPath;
  if (!idOrPath.startsWith('/') && !idOrPath.startsWith('http')) {
    if (idOrPath.startsWith('forma-original-lut-')) {
      const cleanId = idOrPath.endsWith('.cube') ? idOrPath : `${idOrPath}.cube`;
      url = `/video-assets/forma-originals/luts/${cleanId}`;
    } else if (idOrPath.endsWith('.cube')) {
      url = `/video-assets/luts/${idOrPath}`;
    } else {
      const cleanId = idOrPath.replace(/^lut-/, '');
      url = `/video-assets/luts/${cleanId}.cube`;
    }
  }

  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const text = await res.text();
    const lut = parseCubeLut(text);
    if (lut) {
      setCachedCubeLut(idOrPath, lut);
      const filename = url.split('/').pop()?.replace('.cube', '') || '';
      if (filename) setCachedCubeLut(filename, lut);
      return lut;
    }
  } catch (_) {}
  return null;
}

// =========================================================================
// AI AUTO COLOR MATCH & CRISP SHARPNESS UTILITIES
// =========================================================================

export interface ColorStats {
  avgR: number;
  avgG: number;
  avgB: number;
  luminance: number; // 0-255
  contrast: number;  // standard deviation
  saturation: number;// 0-1
}

/**
 * Analyzes color statistics (RGB averages, luminance, contrast, saturation)
 * of any canvas or video source frame for histogram matching.
 */
export function analyzeCanvasColorStats(
  source: CanvasImageSource | HTMLVideoElement | HTMLCanvasElement | HTMLImageElement
): ColorStats {
  const sampleW = 160;
  const sampleH = 90;
  if (typeof document === 'undefined') {
    return { avgR: 128, avgG: 128, avgB: 128, luminance: 128, contrast: 40, saturation: 1.0 };
  }

  const canvas = document.createElement('canvas');
  canvas.width = sampleW;
  canvas.height = sampleH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return { avgR: 128, avgG: 128, avgB: 128, luminance: 128, contrast: 40, saturation: 1.0 };
  }

  try {
    ctx.drawImage(source, 0, 0, sampleW, sampleH);
    const data = ctx.getImageData(0, 0, sampleW, sampleH).data;
    let sumR = 0;
    let sumG = 0;
    let sumB = 0;
    let sumLum = 0;
    let sumSat = 0;
    const totalPixels = sampleW * sampleH;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      sumR += r;
      sumG += g;
      sumB += b;
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      sumLum += lum;
      const maxC = Math.max(r, g, b);
      const minC = Math.min(r, g, b);
      sumSat += maxC === 0 ? 0 : (maxC - minC) / maxC;
    }

    const avgR = sumR / totalPixels;
    const avgG = sumG / totalPixels;
    const avgB = sumB / totalPixels;
    const luminance = sumLum / totalPixels;
    const saturation = sumSat / totalPixels;

    // Standard deviation of luminance for contrast measure
    let varSum = 0;
    for (let i = 0; i < data.length; i += 4) {
      const lum = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      const diff = lum - luminance;
      varSum += diff * diff;
    }
    const contrast = Math.sqrt(varSum / totalPixels);

    return { avgR, avgG, avgB, luminance, contrast, saturation };
  } catch {
    return { avgR: 128, avgG: 128, avgB: 128, luminance: 128, contrast: 40, saturation: 1.0 };
  }
}

/**
 * Calculates compensating adjustments (exposure, contrast, temperature, tint, saturation)
 * so that the current clip matches the previous target clip's aesthetic color balance.
 */
export function calculateColorMatchAdjustments(
  currentStats: ColorStats,
  targetStats: ColorStats,
  currentEffects: Partial<ClipEffects> = {}
): Partial<ClipEffects> {
  // Luminance delta -> Exposure & Brightness
  const lumDelta = (targetStats.luminance - currentStats.luminance) / 255;
  const newExposure = Math.max(-0.5, Math.min(0.5, (currentEffects.exposure || 0) + lumDelta * 0.7));
  const newBrightness = Math.max(-0.35, Math.min(0.35, (currentEffects.brightness || 0) + lumDelta * 0.35));

  // Contrast ratio
  const contrastRatio = targetStats.contrast / Math.max(10, currentStats.contrast);
  const currentContrast = currentEffects.contrast ?? 1.0;
  const newContrast = Math.max(0.7, Math.min(1.8, currentContrast * (0.6 + 0.4 * contrastRatio)));

  // Temperature (R vs B warmth balance)
  const currentWarmth = currentStats.avgR - currentStats.avgB;
  const targetWarmth = targetStats.avgR - targetStats.avgB;
  const tempDelta = (targetWarmth - currentWarmth) * 0.45;
  const newTemp = Math.max(-45, Math.min(45, (currentEffects.temperature || 0) + tempDelta));

  // Tint (Green balance)
  const currentTint = currentStats.avgG - (currentStats.avgR + currentStats.avgB) / 2;
  const targetTint = targetStats.avgG - (targetStats.avgR + targetStats.avgB) / 2;
  const tintDelta = (targetTint - currentTint) * 0.25;
  const newTint = Math.max(-25, Math.min(25, (currentEffects.tint || 0) + tintDelta));

  // Saturation ratio
  const satRatio = targetStats.saturation / Math.max(0.05, currentStats.saturation);
  const currentSat = currentEffects.saturation ?? 1.0;
  const newSat = Math.max(0.65, Math.min(1.5, currentSat * (0.6 + 0.4 * satRatio)));

  return {
    ...currentEffects,
    exposure: Math.round(newExposure * 100) / 100,
    brightness: Math.round(newBrightness * 100) / 100,
    contrast: Math.round(newContrast * 100) / 100,
    temperature: Math.round(newTemp),
    tint: Math.round(newTint),
    saturation: Math.round(newSat * 100) / 100,
  };
}

/**
 * Applies unsharp micro-contrast convolution on the target canvas to restore sharpness to AI videos
 */
export function applyCrispAiSharpness(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity = 0.4
): void {
  try {
    const imgData = ctx.getImageData(0, 0, width, height);
    const data = imgData.data;
    const w = width;
    const h = height;
    const copy = new Uint8ClampedArray(data);
    const k = Math.max(0.1, Math.min(0.7, intensity));

    // Fast 3x3 unsharp convolution kernel
    for (let y = 1; y < h - 1; y += 2) {
      const rowOffset = y * w;
      const topOffset = (y - 1) * w;
      const btmOffset = (y + 1) * w;

      for (let x = 1; x < w - 1; x += 2) {
        const idx = (rowOffset + x) * 4;
        const topIdx = (topOffset + x) * 4;
        const btmIdx = (btmOffset + x) * 4;
        const lftIdx = (rowOffset + (x - 1)) * 4;
        const rgtIdx = (rowOffset + (x + 1)) * 4;

        for (let c = 0; c < 3; c++) {
          const val =
            (1 + 4 * k) * copy[idx + c] -
            k * (copy[topIdx + c] + copy[btmIdx + c] + copy[lftIdx + c] + copy[rgtIdx + c]);
          data[idx + c] = Math.max(0, Math.min(255, val));
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);
  } catch (_) {}
}



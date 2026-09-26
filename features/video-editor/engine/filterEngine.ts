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


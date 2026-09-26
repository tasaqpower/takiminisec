/**
 * FORMA Video Editor — High-Fidelity Professional Text Rasterizer
 * Guarantees exact typography, Turkish character support (ç, Ç, ğ, Ğ, ı, İ, ö, Ö, ş, Ş, ü, Ü),
 * background pill boxes, shadow, stroke, 10 style presets, and smooth In/Loop/Out animations.
 */

import type {
  TextLayerData,
  TextInAnimationType,
  TextLoopAnimationType,
  TextOutAnimationType,
  TextEasingType,
} from '../types';

export interface TextRenderOptions {
  layer: TextLayerData;
  timeInClip: number;      // Seconds into the text clip duration
  clipDuration: number;    // Total duration of the text clip
  canvasWidth: number;
  canvasHeight: number;
  centerX?: number;        // X coordinate (in canvas pixels)
  centerY?: number;        // Y coordinate (in canvas pixels)
  scale?: number;
  rotation?: number;       // degrees
  opacity?: number;
}

export interface TextStylePreset {
  id: string;
  name: string;
  description: string;
  previewBg: string;
  data: Partial<TextLayerData>;
}

export const TEXT_STYLE_PRESETS: TextStylePreset[] = [
  {
    id: 'modern-white',
    name: 'Modern Beyaz',
    description: 'Temiz beyaz başlık, yumuşak sinematik gölge',
    previewBg: '#1e293b',
    data: {
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      fontSize: 54,
      fontWeight: 'bold',
      color: '#ffffff',
      fillColor: '#ffffff',
      strokeWidth: 0,
      shadowColor: 'rgba(0,0,0,0.7)',
      shadowBlur: 8,
      shadowOffsetX: 0,
      shadowOffsetY: 3,
      textAlign: 'center',
      alignment: 'center',
    },
  },
  {
    id: 'cinematic-gold',
    name: 'Sinematik Altın',
    description: 'Lüks altın sarısı, serif zarafeti ve altın ışıltısı',
    previewBg: '#0f172a',
    data: {
      fontFamily: 'Playfair Display, serif',
      fontSize: 56,
      fontWeight: '700',
      color: '#fbbf24',
      fillColor: '#fbbf24',
      strokeColor: '#78350f',
      strokeWidth: 1.5,
      shadowColor: 'rgba(245, 158, 11, 0.4)',
      shadowBlur: 14,
      shadowOffsetX: 0,
      shadowOffsetY: 2,
      letterSpacing: 2,
      textAlign: 'center',
      alignment: 'center',
    },
  },
  {
    id: 'documentary-bw',
    name: 'Siyah-Beyaz Belgesel',
    description: 'Klasik belgesel tarzı siyah arka kutu, beyaz metin',
    previewBg: '#334155',
    data: {
      fontFamily: 'Roboto, sans-serif',
      fontSize: 40,
      fontWeight: '500',
      color: '#ffffff',
      fillColor: '#ffffff',
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      backgroundOpacity: 0.85,
      paddingX: 20,
      paddingY: 12,
      borderRadius: 4,
      textAlign: 'center',
      alignment: 'center',
    },
  },
  {
    id: 'social-highlight',
    name: 'Sosyal Medya Vurgusu',
    description: 'Canlı neon limon sarısı, kalın siyah dış kontur',
    previewBg: '#090d16',
    data: {
      fontFamily: 'Montserrat, sans-serif',
      fontSize: 58,
      fontWeight: '900',
      color: '#a3e635',
      fillColor: '#a3e635',
      strokeColor: '#000000',
      strokeWidth: 6,
      shadowColor: 'rgba(0,0,0,0.9)',
      shadowBlur: 10,
      shadowOffsetX: 2,
      shadowOffsetY: 4,
      textTransform: 'uppercase',
      textAlign: 'center',
      alignment: 'center',
    },
  },
  {
    id: 'tiktok-subtitle',
    name: 'Sarı-Siyah Altyazı',
    description: 'Reels ve TikTok tarzı canlı sarı altyazı',
    previewBg: '#18181b',
    data: {
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      fontSize: 52,
      fontWeight: '800',
      color: '#facc15',
      fillColor: '#facc15',
      strokeColor: '#000000',
      strokeWidth: 5,
      shadowColor: 'rgba(0,0,0,0.8)',
      shadowBlur: 6,
      shadowOffsetX: 0,
      shadowOffsetY: 3,
      textAlign: 'center',
      alignment: 'center',
    },
  },
  {
    id: 'minimal-lower-third',
    name: 'Minimal Alt Bant',
    description: 'Yarı saydam koyu şerit, sol hizalı kurumsal alt yazı',
    previewBg: '#1e1b4b',
    data: {
      fontFamily: 'Inter, sans-serif',
      fontSize: 34,
      fontWeight: '600',
      color: '#ffffff',
      fillColor: '#ffffff',
      backgroundColor: 'rgba(15, 23, 42, 0.75)',
      backgroundOpacity: 0.75,
      paddingX: 24,
      paddingY: 10,
      borderRadius: 6,
      textAlign: 'left',
      alignment: 'left',
    },
  },
  {
    id: 'news-ticker',
    name: 'Haber Alt Bandı',
    description: 'Kırmızı vurgu ve beyaz metinle dinamik bülten tarzı',
    previewBg: '#450a0a',
    data: {
      fontFamily: 'Oswald, sans-serif',
      fontSize: 42,
      fontWeight: '700',
      color: '#ffffff',
      fillColor: '#ffffff',
      backgroundColor: '#dc2626',
      backgroundOpacity: 0.95,
      paddingX: 28,
      paddingY: 14,
      borderRadius: 0,
      textTransform: 'uppercase',
      letterSpacing: 1,
      textAlign: 'center',
      alignment: 'center',
    },
  },
  {
    id: 'cyber-neon',
    name: 'Neon Başlık',
    description: 'Göz alıcı neon pembe parıltı ve siber estetik',
    previewBg: '#050505',
    data: {
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      fontSize: 56,
      fontWeight: '800',
      color: '#f43f5e',
      fillColor: '#f43f5e',
      strokeColor: '#fda4af',
      strokeWidth: 2,
      shadowColor: '#ec4899',
      shadowBlur: 20,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      textAlign: 'center',
      alignment: 'center',
    },
  },
  {
    id: 'typewriter-mono',
    name: 'Daktilo Metni',
    description: 'Terminal monospace yeşili daktilo stili',
    previewBg: '#022c22',
    data: {
      fontFamily: 'Courier New, monospace',
      fontSize: 38,
      fontWeight: 'bold',
      color: '#34d399',
      fillColor: '#34d399',
      backgroundColor: 'rgba(6, 78, 59, 0.7)',
      backgroundOpacity: 0.7,
      paddingX: 18,
      paddingY: 10,
      borderRadius: 6,
      inAnimation: 'typewriter',
      inDuration: 1.5,
      textAlign: 'left',
      alignment: 'left',
    },
  },
  {
    id: 'emerald-gold',
    name: 'Ayaz Serisi Yeşil-Altın',
    description: 'Zümrüt yeşili zemin üzerine parıldayan altın metin',
    previewBg: '#064e3b',
    data: {
      fontFamily: 'Plus Jakarta Sans, sans-serif',
      fontSize: 50,
      fontWeight: '700',
      color: '#fef08a',
      fillColor: '#fef08a',
      backgroundColor: 'rgba(6, 78, 59, 0.9)',
      backgroundOpacity: 0.9,
      strokeColor: '#ca8a04',
      strokeWidth: 1.5,
      paddingX: 24,
      paddingY: 14,
      borderRadius: 12,
      shadowColor: 'rgba(0,0,0,0.6)',
      shadowBlur: 10,
      shadowOffsetX: 0,
      shadowOffsetY: 4,
      textAlign: 'center',
      alignment: 'center',
    },
  },
];

/**
 * Calculates easing curve progress
 */
function applyEasing(t: number, easing: TextEasingType = 'ease-out'): number {
  const p = Math.max(0, Math.min(1, t));
  switch (easing) {
    case 'linear':
      return p;
    case 'ease-in':
      return p * p;
    case 'ease-in-out':
      return p < 0.5 ? 2 * p * p : -1 + (4 - 2 * p) * p;
    case 'back': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(p - 1, 3) + c1 * Math.pow(p - 1, 2);
    }
    case 'elastic': {
      if (p === 0 || p === 1) return p;
      return Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
    }
    case 'bounce': {
      const n1 = 7.5625;
      const d1 = 2.75;
      let x = 1 - p;
      let res = 0;
      if (x < 1 / d1) {
        res = n1 * x * x;
      } else if (x < 2 / d1) {
        res = n1 * (x -= 1.5 / d1) * x + 0.75;
      } else if (x < 2.5 / d1) {
        res = n1 * (x -= 2.25 / d1) * x + 0.9375;
      } else {
        res = n1 * (x -= 2.625 / d1) * x + 0.984375;
      }
      return 1 - res;
    }
    case 'ease-out':
    default:
      return p * (2 - p);
  }
}

function safeRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number | number[] = 0
): void {
  if (w <= 0 || h <= 0) return;
  if (typeof ctx.roundRect === 'function') {
    try {
      ctx.roundRect(x, y, w, h, radius);
      return;
    } catch {
      // Fallback below
    }
  }
  const r = typeof radius === 'number' ? Math.max(0, Math.min(radius, w / 2, h / 2)) : 0;
  if (r <= 0) {
    ctx.rect(x, y, w, h);
    return;
  }
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
}

/**
 * Renders the text layer onto the target 2D canvas context.
 * Supports overloaded signatures for backward compatibility.
 */
export function renderTextLayer(
  ctx: CanvasRenderingContext2D,
  optionsOrLayer: TextRenderOptions | TextLayerData,
  legacyTimeInClip = 0,
  legacyClipDuration = 5,
  legacyCanvasW = 1920,
  legacyCanvasH = 1080
): void {
  let opts: TextRenderOptions;

  if ('layer' in optionsOrLayer) {
    opts = optionsOrLayer as TextRenderOptions;
  } else {
    // Legacy positional arguments
    opts = {
      layer: optionsOrLayer as TextLayerData,
      timeInClip: legacyTimeInClip,
      clipDuration: legacyClipDuration,
      canvasWidth: legacyCanvasW,
      canvasHeight: legacyCanvasH,
      centerX: legacyCanvasW / 2,
      centerY: legacyCanvasH / 2,
    };
  }

  const {
    layer,
    timeInClip,
    clipDuration,
    canvasWidth,
    canvasHeight,
    centerX = canvasWidth / 2,
    centerY = canvasHeight / 2,
    scale = 1,
    rotation = 0,
    opacity = 1,
  } = opts;

  if (!layer || !layer.text) return;

  // Format text with Turkish locale case transformations if configured
  let formattedText = layer.text;
  if (layer.textTransform === 'uppercase') {
    formattedText = layer.text.toLocaleUpperCase('tr-TR');
  } else if (layer.textTransform === 'lowercase') {
    formattedText = layer.text.toLocaleLowerCase('tr-TR');
  } else if (layer.textTransform === 'capitalize') {
    formattedText = layer.text.replace(/\b\w/g, (c) => c.toLocaleUpperCase('tr-TR'));
  }

  // Animation calculation
  let displayText = formattedText;
  let animOpacity = 1;
  let animOffsetX = 0;
  let animOffsetY = 0;
  let animScale = 1;
  let animScaleX = 1;
  let animScaleY = 1;
  let animRotation = 0;
  let animBlur = 0;
  let animTracking = 0;

  // Normalize animation configs
  const inType: TextInAnimationType =
    layer.inAnimation ||
    (typeof layer.animation === 'object' ? (layer.animation.type as TextInAnimationType) : undefined) ||
    (typeof layer.animation === 'string' ? (layer.animation as TextInAnimationType) : 'none');

  const inDuration =
    (layer.inDuration !== undefined && layer.inDuration > 0)
      ? layer.inDuration
      : (typeof layer.animation === 'object' && layer.animation.duration && layer.animation.duration > 0)
        ? layer.animation.duration
        : Math.min(0.8, clipDuration / 2);

  const inEasing: TextEasingType = layer.inEasing ?? 'ease-out';

  const outType: TextOutAnimationType = layer.outAnimation || 'none';
  const outDuration =
    (layer.outDuration !== undefined && layer.outDuration > 0)
      ? layer.outDuration
      : Math.min(0.6, clipDuration / 3);
  const outEasing: TextEasingType = layer.outEasing ?? 'ease-in';

  const loopType: TextLoopAnimationType = layer.loopAnimation || 'none';
  const loopSpeed = layer.loopSpeed ?? 1.0;
  const loopIntensity = layer.loopIntensity ?? 1.0;

  const timeRemaining = clipDuration - timeInClip;

  // Safe unicode / Turkish grapheme splitter
  const getGraphemeArray = (str: string): string[] => {
    if (typeof Intl !== 'undefined' && (Intl as any).Segmenter) {
      try {
        const segmenter = new (Intl as any).Segmenter('tr-TR', { granularity: 'grapheme' });
        return Array.from(segmenter.segment(str), (s: any) => s.segment);
      } catch {
        // fallback
      }
    }
    return Array.from(str);
  };

  // 1. IN ANIMATION
  if (timeInClip < inDuration && inType !== 'none') {
    const rawProgress = timeInClip / Math.max(0.01, inDuration);
    const progress = applyEasing(rawProgress, inEasing);

    switch (inType) {
      case 'fade':
        animOpacity = progress;
        break;
      case 'slide-up':
        animOffsetY = (1 - progress) * 45;
        animOpacity = progress;
        break;
      case 'slide-down':
        animOffsetY = -(1 - progress) * 45;
        animOpacity = progress;
        break;
      case 'slide-left':
        animOffsetX = (1 - progress) * 70;
        animOpacity = progress;
        break;
      case 'slide-right':
        animOffsetX = -(1 - progress) * 70;
        animOpacity = progress;
        break;
      case 'scale':
        animScale = 0.4 + progress * 0.6;
        animOpacity = progress;
        break;
      case 'pop':
        animScale = applyEasing(rawProgress, 'back');
        animOpacity = Math.min(1, rawProgress * 2.5);
        break;
      case 'bounce-in':
      case 'bounce-drop':
        animOffsetY = -(1 - applyEasing(rawProgress, 'bounce')) * 130;
        animOpacity = Math.min(1, rawProgress * 3);
        break;
      case 'elastic-in':
        animScale = applyEasing(rawProgress, 'elastic');
        animOpacity = Math.min(1, rawProgress * 2);
        break;
      case 'blur-in':
        animBlur = (1 - progress) * 20;
        animOpacity = progress;
        break;
      case 'rotate-in':
        animRotation = (1 - progress) * -90;
        animScale = 0.5 + progress * 0.5;
        animOpacity = progress;
        break;
      case 'flip':
      case 'flip-in':
        animScaleX = Math.max(0.01, Math.cos((1 - progress) * (Math.PI / 2)));
        animOpacity = progress;
        break;
      case 'mask-reveal':
      case 'wipe-reveal':
        animOffsetX = (1 - progress) * 35;
        animOpacity = progress;
        animTracking = (1 - progress) * 10;
        break;
      case 'typewriter': {
        const graphemes = getGraphemeArray(formattedText);
        const charCount = Math.floor(progress * graphemes.length);
        displayText = graphemes.slice(0, Math.max(0, Math.min(graphemes.length, charCount))).join('');
        break;
      }
      case 'word-by-word': {
        const words = formattedText.trim().split(/\s+/);
        const wordCount = Math.floor(progress * words.length);
        displayText = words.slice(0, Math.max(1, wordCount)).join(' ');
        break;
      }
      case 'char-cascade':
      case 'char-by-char': {
        const graphemes = getGraphemeArray(formattedText);
        const charCount = Math.floor(progress * graphemes.length);
        displayText = graphemes.slice(0, Math.max(1, charCount)).join('');
        animOpacity = 0.5 + progress * 0.5;
        break;
      }
      case 'glitch':
      case 'glitch-in': {
        const jitter = (1 - progress) * 25;
        animOffsetX = Math.sin(rawProgress * 45) * jitter;
        animOffsetY = Math.cos(rawProgress * 35) * (jitter * 0.4);
        animOpacity = Math.min(1, rawProgress * 2.5);
        break;
      }
      case 'neon-flash':
      case 'neon-flicker-in':
        animOpacity = progress > 0.85 ? 1 : (Math.sin(rawProgress * 30) > 0 ? 1 : 0.15);
        animBlur = (1 - progress) * 12;
        break;
      case 'tracking':
      case 'tracking-in':
        animScale = 0.85 + progress * 0.15;
        animOpacity = progress;
        animTracking = (1 - progress) * 16;
        break;
      case 'wave':
        animOffsetY = Math.sin((1 - progress) * Math.PI * 3) * 30;
        animOffsetX = (1 - progress) * 45;
        animOpacity = progress;
        break;
      case 'crash-zoom':
        animScale = 2.8 - applyEasing(rawProgress, 'ease-out') * 1.8;
        animOpacity = progress;
        animBlur = (1 - progress) * 12;
        break;
      default:
        break;
    }
  }

  // 2. OUT ANIMATION (if within out duration)
  if (timeRemaining < outDuration && outType !== 'none') {
    const rawProgress = timeRemaining / Math.max(0.01, outDuration); // 1.0 down to 0.0
    const progress = applyEasing(rawProgress, outEasing);

    switch (outType) {
      case 'fade':
        animOpacity = Math.min(animOpacity, progress);
        break;
      case 'slide-down':
        animOffsetY += (1 - progress) * 50;
        animOpacity = Math.min(animOpacity, progress);
        break;
      case 'slide-up':
        animOffsetY -= (1 - progress) * 50;
        animOpacity = Math.min(animOpacity, progress);
        break;
      case 'slide-left':
        animOffsetX -= (1 - progress) * 70;
        animOpacity = Math.min(animOpacity, progress);
        break;
      case 'slide-right':
        animOffsetX += (1 - progress) * 70;
        animOpacity = Math.min(animOpacity, progress);
        break;
      case 'scale-down':
        animScale *= 0.4 + progress * 0.6;
        animOpacity = Math.min(animOpacity, progress);
        break;
      case 'pop-out':
        animScale *= applyEasing(rawProgress, 'back');
        animOpacity = Math.min(animOpacity, progress);
        break;
      case 'blur-out':
        animBlur = Math.max(animBlur, (1 - progress) * 20);
        animOpacity = Math.min(animOpacity, progress);
        break;
      case 'rotate-out':
        animRotation += (1 - progress) * 90;
        animScale *= 0.5 + progress * 0.5;
        animOpacity = Math.min(animOpacity, progress);
        break;
      case 'flip-out':
        animScaleX = Math.max(0.01, Math.cos((1 - progress) * (Math.PI / 2)));
        animOpacity = Math.min(animOpacity, progress);
        break;
      case 'mask-close':
        animScaleY = Math.max(0.01, progress);
        animOpacity = Math.min(animOpacity, progress);
        break;
      case 'typewriter-erase': {
        const graphemes = getGraphemeArray(formattedText);
        const charCount = Math.floor(progress * graphemes.length);
        displayText = graphemes.slice(0, Math.max(0, charCount)).join('');
        break;
      }
      case 'char-scatter': {
        const graphemes = getGraphemeArray(formattedText);
        const charCount = Math.floor(progress * graphemes.length);
        displayText = graphemes.slice(0, Math.max(0, charCount)).join('');
        animOffsetY += (1 - progress) * 20;
        animOpacity = Math.min(animOpacity, progress);
        break;
      }
      case 'glitch-out': {
        const jitter = (1 - progress) * 26;
        animOffsetX += Math.sin((1 - progress) * 45) * jitter;
        animOpacity = Math.min(animOpacity, progress);
        break;
      }
      case 'crash-out':
        animScale *= 1 + (1 - progress) * 2.5;
        animOpacity = Math.min(animOpacity, progress);
        break;
      default:
        break;
    }
  }

  // 3. LOOP ANIMATION (runs continuously during middle of clip)
  if (loopType !== 'none') {
    const loopT = timeInClip * loopSpeed * Math.PI * 2;
    switch (loopType) {
      case 'pulse':
        animScale *= 1.0 + Math.sin(loopT) * 0.06 * loopIntensity;
        break;
      case 'heartbeat': {
        const beat = Math.pow(Math.sin(loopT), 3);
        animScale *= 1.0 + beat * 0.09 * loopIntensity;
        break;
      }
      case 'float':
        animOffsetY += Math.sin(loopT) * 7 * loopIntensity;
        break;
      case 'gentle-shake':
      case 'wiggle':
        animRotation += Math.sin(loopT * 2.5) * 3 * loopIntensity;
        animOffsetX += Math.cos(loopT * 2.5) * 2 * loopIntensity;
        break;
      case 'shimmer':
        animOpacity *= 0.85 + Math.sin(loopT) * 0.15 * loopIntensity;
        break;
      case 'breathing':
        animScale *= 1.0 + Math.sin(loopT * 0.7) * 0.04 * loopIntensity;
        break;
      case 'neon-flicker':
      case 'glow-breathe':
        animOpacity *= 0.82 + Math.sin(loopT * 0.9) * 0.18 * loopIntensity;
        animBlur = Math.max(animBlur, (Math.sin(loopT * 0.9) * 0.5 + 0.5) * 8 * loopIntensity);
        break;
      case 'wave':
        animOffsetY += Math.sin(loopT * 1.5) * 8 * loopIntensity;
        break;
      case 'subtle-zoom':
        animScale *= 1.0 + Math.sin(loopT * 0.5) * 0.05 * loopIntensity;
        break;
      case 'color-sweep':
        animBlur = Math.max(animBlur, (Math.sin(loopT * 1.2) * 0.5 + 0.5) * 6 * loopIntensity);
        break;
      case 'jitter':
        animOffsetX += Math.sin(loopT * 4.2) * 3.5 * loopIntensity;
        animOffsetY += Math.cos(loopT * 5.1) * 2.0 * loopIntensity;
        break;
      case 'strobe':
        animOpacity *= Math.sin(loopT * 3.5) > 0 ? 1 : 0.2;
        break;
      case 'spin-slow':
        animRotation += Math.sin(loopT * 0.6) * 6 * loopIntensity;
        break;
      default:
        break;
    }
  }

  if (!displayText) return;

  ctx.save();

  // Position and primary transformations
  ctx.translate(centerX + animOffsetX, centerY + animOffsetY);

  const totalRotation = rotation + animRotation;
  if (totalRotation !== 0) {
    ctx.rotate((totalRotation * Math.PI) / 180);
  }

  const effectiveScale = scale * animScale;
  if (effectiveScale !== 1 || animScaleX !== 1 || animScaleY !== 1) {
    ctx.scale(effectiveScale * animScaleX, effectiveScale * animScaleY);
  }

  ctx.globalAlpha = Math.max(0, Math.min(1, opacity * animOpacity));

  if (animBlur > 0) {
    ctx.filter = `blur(${animBlur.toFixed(1)}px)`;
  }

  // Font setup
  const fontStyle = layer.fontStyle === 'italic' ? 'italic ' : '';
  const fontWeight = layer.fontWeight || 'bold';
  const fontSize = layer.fontSize || 54;
  let fontFamily = (layer.fontFamily || 'Plus Jakarta Sans, sans-serif').trim();
  if (!fontFamily.includes('"') && !fontFamily.includes("'")) {
    const parts = fontFamily.split(',');
    const primary = parts[0].trim();
    const fallback = parts.slice(1).join(',').trim() || 'sans-serif';
    fontFamily = `"${primary}", ${fallback}`;
  }

  ctx.font = `${fontStyle}${fontWeight} ${fontSize}px ${fontFamily}`;
  ctx.textAlign = layer.textAlign || layer.alignment || 'center';
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

  const lineHeight = fontSize * (layer.lineHeight || 1.25);
  const totalTextHeight = lines.length * lineHeight;

  // Background Box / Pill
  const bgColor = layer.backgroundColor || layer.boxColor;
  if (bgColor && (layer.backgroundOpacity ?? 1) > 0) {
    let maxLineWidth = 0;
    for (const l of lines) {
      const w = ctx.measureText(l).width;
      if (w > maxLineWidth) maxLineWidth = w;
    }

    const padX = layer.paddingX ?? layer.boxPadding ?? layer.padding ?? 20;
    const padY = layer.paddingY ?? layer.boxPadding ?? layer.padding ?? 16;
    const boxWidth = maxLineWidth + padX * 2;
    const boxHeight = totalTextHeight + padY * 2;
    const radius = layer.borderRadius ?? layer.boxRadius ?? 8;

    let boxX = -boxWidth / 2;
    const align = layer.textAlign || layer.alignment || 'center';
    if (align === 'left') boxX = -padX;
    else if (align === 'right') boxX = -boxWidth + padX;

    const boxY = -boxHeight / 2;

    ctx.save();
    ctx.fillStyle = bgColor;
    ctx.globalAlpha = Math.max(0, Math.min(1, (opacity * animOpacity) * (layer.backgroundOpacity ?? 1)));

    ctx.beginPath();
    safeRoundRect(ctx, boxX, boxY, boxWidth, boxHeight, radius);
    ctx.fill();
    ctx.restore();
  }

  // Shadow
  const shadowColor = layer.shadowColor || layer.shadow?.color;
  const shadowBlur = layer.shadowBlur ?? layer.shadow?.blur ?? 0;
  const shadowOffsetX = layer.shadowOffsetX ?? layer.shadow?.offsetX ?? 0;
  const shadowOffsetY = layer.shadowOffsetY ?? layer.shadow?.offsetY ?? 0;

  if (shadowColor && shadowBlur > 0) {
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur = shadowBlur;
    ctx.shadowOffsetX = shadowOffsetX;
    ctx.shadowOffsetY = shadowOffsetY;
  }

  // Draw Lines
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
    ctx.fillStyle = layer.fillColor || layer.color || '#ffffff';
    ctx.fillText(line, 0, y);

    // Underline
    if (layer.underline) {
      const lineWidth = ctx.measureText(line).width;
      let lineStartX = -lineWidth / 2;
      const align = layer.textAlign || layer.alignment || 'center';
      if (align === 'left') lineStartX = 0;
      else if (align === 'right') lineStartX = -lineWidth;

      const underlineY = y + fontSize * 0.52;
      ctx.save();
      ctx.strokeStyle = layer.fillColor || layer.color || '#ffffff';
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

export interface TextAnimationDef {
  id: string;
  name: string;
  type: 'in' | 'loop' | 'out';
  categoryName: string;
  description: string;
  icon: string;
  defaultDuration: number;
}

export const TEXT_ANIMATION_DEFINITIONS: TextAnimationDef[] = [
  // Giriş Animasyonları (In)
  { id: 'fade', name: 'Belirerek (Fade In)', type: 'in', categoryName: 'Giriş', description: 'Yumuşak opasite artışıyla belirme', icon: '🌫️', defaultDuration: 0.8 },
  { id: 'slide-up', name: 'Aşağıdan Kayarak (Slide Up)', type: 'in', categoryName: 'Giriş', description: 'Dikey aşağıdan yukarı doğru kayış', icon: '⬆️', defaultDuration: 0.8 },
  { id: 'slide-down', name: 'Yukarıdan Kayarak (Slide Down)', type: 'in', categoryName: 'Giriş', description: 'Yukarıdan aşağı doğru kayış', icon: '⬇️', defaultDuration: 0.8 },
  { id: 'slide-left', name: 'Sağdan Sola (Slide Left)', type: 'in', categoryName: 'Giriş', description: 'Sağ kenardan sola kayış', icon: '⬅️', defaultDuration: 0.8 },
  { id: 'slide-right', name: 'Soldan Sağa (Slide Right)', type: 'in', categoryName: 'Giriş', description: 'Sol kenardan sağa kayış', icon: '➡️', defaultDuration: 0.8 },
  { id: 'scale', name: 'Büyüyerek (Scale In)', type: 'in', categoryName: 'Giriş', description: 'Merkezden büyüyerek odaklanma', icon: '🔍', defaultDuration: 0.7 },
  { id: 'pop', name: 'Patlayarak (Pop)', type: 'in', categoryName: 'Giriş', description: 'Esnek geri tepmeli canlı büyüme', icon: '💥', defaultDuration: 0.6 },
  { id: 'bounce-in', name: 'Zıplayarak Düşme (Bounce In)', type: 'in', categoryName: 'Giriş', description: 'Yerçekimli dinamik zıplama', icon: '🏀', defaultDuration: 1.0 },
  { id: 'elastic-in', name: 'Elastik Esneme (Elastic In)', type: 'in', categoryName: 'Giriş', description: 'Lastik gibi esneyerek oturma', icon: '🪀', defaultDuration: 0.9 },
  { id: 'blur-in', name: 'Bulanıklıktan Netliğe (Blur In)', type: 'in', categoryName: 'Giriş', description: 'Optik bulanıklıktan netleşme', icon: '👓', defaultDuration: 0.8 },
  { id: 'rotate-in', name: 'Dönerek Geliş (Rotate In)', type: 'in', categoryName: 'Giriş', description: 'Açılı eksenden dönerek yerleşme', icon: '🔄', defaultDuration: 0.8 },
  { id: 'flip-in', name: 'Kart Çevirme (Flip In)', type: 'in', categoryName: 'Giriş', description: 'Yatay 3D kart gibi açılarak geliş', icon: '🃏', defaultDuration: 0.8 },
  { id: 'mask-reveal', name: 'Perde Açılışı (Mask Reveal)', type: 'in', categoryName: 'Giriş', description: 'Görünmez maskenin arkasından çıkış', icon: '🎭', defaultDuration: 0.8 },
  { id: 'wipe-reveal', name: 'Süpürerek Açılış (Wipe Reveal)', type: 'in', categoryName: 'Giriş', description: 'Soldan sağa süpürülerek beliriş', icon: '🧹', defaultDuration: 0.8 },
  { id: 'tracking-in', name: 'Harf Aralığı Daralma (Tracking In)', type: 'in', categoryName: 'Giriş', description: 'Geniş harf aralığından sinematik toplanma', icon: '↔️', defaultDuration: 1.0 },
  { id: 'typewriter', name: 'Daktilo Harf Harf (Typewriter)', type: 'in', categoryName: 'Giriş', description: 'Daktilo gibi harf harf yazılma (Türkçe uyumlu)', icon: '⌨️', defaultDuration: 1.5 },
  { id: 'word-by-word', name: 'Kelime Kelime (Word by Word)', type: 'in', categoryName: 'Giriş', description: 'Kelimelerin sırayla belirmesi', icon: '🗣️', defaultDuration: 1.2 },
  { id: 'char-cascade', name: 'Karakter Şelalesi (Cascade)', type: 'in', categoryName: 'Giriş', description: 'Harflerin art arda akışı', icon: '🌊', defaultDuration: 1.0 },
  { id: 'glitch-in', name: 'Siber Glitch (Glitch In)', type: 'in', categoryName: 'Giriş', description: 'Yatay piksel parazitiyle ani belirme', icon: '⚡', defaultDuration: 0.6 },
  { id: 'neon-flicker-in', name: 'Neon Titreşimi (Neon Flicker In)', type: 'in', categoryName: 'Giriş', description: 'Neon lamba gibi yanıp sönerek açılma', icon: '💡', defaultDuration: 0.9 },

  // Sürekli Animasyonlar (Loop)
  { id: 'pulse', name: 'Nabız (Pulse)', type: 'loop', categoryName: 'Sürekli', description: 'Hafif ritmik büyüme ve küçülme', icon: '💓', defaultDuration: 2.0 },
  { id: 'heartbeat', name: 'Kalp Atışı (Heartbeat)', type: 'loop', categoryName: 'Sürekli', description: 'İkili vuruşlu canlı kalp atışı', icon: '❤️', defaultDuration: 1.5 },
  { id: 'float', name: 'Süzülme (Float)', type: 'loop', categoryName: 'Sürekli', description: 'Yerçekimsiz havada salınım', icon: '🎈', defaultDuration: 2.5 },
  { id: 'gentle-shake', name: 'Hafif Titreme (Gentle Shake)', type: 'loop', categoryName: 'Sürekli', description: 'Dikkat çekici mikro titreşim', icon: '📳', defaultDuration: 1.5 },
  { id: 'wiggle', name: 'Kıpırdama (Wiggle)', type: 'loop', categoryName: 'Sürekli', description: 'Açısal eğlenceli kıpırdanma', icon: '〰️', defaultDuration: 1.5 },
  { id: 'shimmer', name: 'Işıltı & Parıltı (Shimmer)', type: 'loop', categoryName: 'Sürekli', description: 'Parlaklık ve opasite dalgalanması', icon: '✨', defaultDuration: 2.0 },
  { id: 'breathing', name: 'Nefes Alma (Breathing)', type: 'loop', categoryName: 'Sürekli', description: 'Yavaş, derin ve sakin ölçeklenme', icon: '🧘', defaultDuration: 3.0 },
  { id: 'neon-flicker', name: 'Neon Işıma (Neon Glow)', type: 'loop', categoryName: 'Sürekli', description: 'Canlı neon parlaması ve titreşimi', icon: '🔮', defaultDuration: 2.0 },
  { id: 'wave', name: 'Dalgalanma (Wave)', type: 'loop', categoryName: 'Sürekli', description: 'Dikey akıcı deniz dalgası hareketi', icon: '🏄', defaultDuration: 2.0 },
  { id: 'subtle-zoom', name: 'Hafif Yakınlaşma (Subtle Zoom)', type: 'loop', categoryName: 'Sürekli', description: 'Belgesel tarzı ağır sinematik yaklaşma', icon: '🔭', defaultDuration: 4.0 },
  { id: 'color-sweep', name: 'Renk Dalgası (Color Sweep)', type: 'loop', categoryName: 'Sürekli', description: 'Sürekli yumuşak atmosfer geçişi', icon: '🌈', defaultDuration: 3.0 },

  // Çıkış Animasyonları (Out)
  { id: 'fade', name: 'Karararak Kaybol (Fade Out)', type: 'out', categoryName: 'Çıkış', description: 'Opasitenin sıfıra düşmesi', icon: '🌫️', defaultDuration: 0.6 },
  { id: 'slide-down', name: 'Aşağı Kayarak (Slide Down Out)', type: 'out', categoryName: 'Çıkış', description: 'Aşağı doğru kayarak ekranı terk ediş', icon: '⬇️', defaultDuration: 0.6 },
  { id: 'slide-up', name: 'Yukarı Kayarak (Slide Up Out)', type: 'out', categoryName: 'Çıkış', description: 'Yukarı doğru kayarak çıkış', icon: '⬆️', defaultDuration: 0.6 },
  { id: 'slide-left', name: 'Sola Kayarak (Slide Left Out)', type: 'out', categoryName: 'Çıkış', description: 'Sol kenardan dışarı kayış', icon: '⬅️', defaultDuration: 0.6 },
  { id: 'slide-right', name: 'Sağa Kayarak (Slide Right Out)', type: 'out', categoryName: 'Çıkış', description: 'Sağ kenardan dışarı kayış', icon: '➡️', defaultDuration: 0.6 },
  { id: 'scale-down', name: 'Küçülerek (Scale Down)', type: 'out', categoryName: 'Çıkış', description: 'Merkeze küçülerek yok olma', icon: '🔬', defaultDuration: 0.6 },
  { id: 'pop-out', name: 'İçeri Çöküş (Pop Out)', type: 'out', categoryName: 'Çıkış', description: 'Hızlı içe çökerek kapanış', icon: '🗯️', defaultDuration: 0.5 },
  { id: 'blur-out', name: 'Bulanıklaşarak (Blur Out)', type: 'out', categoryName: 'Çıkış', description: 'Odak kaybedip buğulanarak kaybolma', icon: '💨', defaultDuration: 0.7 },
  { id: 'rotate-out', name: 'Dönerek Çıkış (Rotate Out)', type: 'out', categoryName: 'Çıkış', description: 'Eksen etrafında dönerek uzaklaşma', icon: '💫', defaultDuration: 0.7 },
  { id: 'flip-out', name: 'Kart Kapanışı (Flip Out)', type: 'out', categoryName: 'Çıkış', description: '3D kartın kapanması gibi kaybolma', icon: '🃏', defaultDuration: 0.6 },
  { id: 'mask-close', name: 'Perde Kapanışı (Mask Close)', type: 'out', categoryName: 'Çıkış', description: 'Yatayda daralarak kapanış', icon: '🪟', defaultDuration: 0.6 },
  { id: 'typewriter-erase', name: 'Daktilo Silinmesi (Typewriter Erase)', type: 'out', categoryName: 'Çıkış', description: 'Sondan başa harf harf silinme', icon: '🔙', defaultDuration: 1.0 },
  { id: 'char-scatter', name: 'Harf Dağılması (Scatter)', type: 'out', categoryName: 'Çıkış', description: 'Karakterlerin aşağı dökülerek kaybolması', icon: '🍂', defaultDuration: 0.8 },
  { id: 'glitch-out', name: 'Glitch Kapanış (Glitch Out)', type: 'out', categoryName: 'Çıkış', description: 'Dijital sinyal kesintisiyle kayboluş', icon: '⚡', defaultDuration: 0.5 },
];


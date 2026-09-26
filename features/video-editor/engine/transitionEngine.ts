/**
 * FORMA Video Editor — High-Precision 38 Transition Engine
 * Computes transition matrices, composite opacities, offsets, wipe/blur state,
 * push, whip pan, radial/circle mask, spin, flip, light leak, glitch, and film burn.
 * Works symmetrically in interactive canvas preview, timeline, and export stream.
 */

import type { Transition, TransitionType } from '../types';

export interface TransitionState {
  opacity: number;
  offsetX: number; // Normalized -1 to 1 (multiply by canvas width)
  offsetY: number; // Normalized -1 to 1 (multiply by canvas height)
  scale: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number; // degrees
  blur?: number; // in pixels
  zoomBlur?: number; // 0 to 1
  wipeRatio?: number; // 0.0 to 1.0 (mask progress)
  wipeDirection?: 'left' | 'right' | 'up' | 'down' | 'diagonal';
  maskShape?: 'rect' | 'diagonal' | 'circle-in' | 'circle-out' | 'soft-circle';
  maskRadius?: number; // 0 to 1 normalized
  pixelate?: number; // block size in px
  rgbSplit?: number; // pixel offset
  glitch?: { amount: number; sliceCount: number; jitter: number };
  colorOverlay?: { r: number; g: number; b: number; a: number };
  lightLeak?: { intensity: number; progress: number };
  filmBurn?: { intensity: number; progress: number };
  flash?: { intensity: number };
  vhs?: { intensity: number; trackingJitter: number };
}

export type TransitionCategory = 'basic' | 'slide-push' | 'wipe-mask' | 'camera-motion' | 'stylize';

export interface TransitionDef {
  id: TransitionType;
  name: string;
  category: TransitionCategory;
  categoryName: string;
  description: string;
  icon: string;
  defaultDuration: number;
  minDuration: number;
  maxDuration: number;
  supportedDirections?: ('left' | 'right' | 'up' | 'down')[];
  defaultEasing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
}

export const TRANSITION_DEFINITIONS: TransitionDef[] = [
  // 1. Temel (Basic)
  {
    id: 'cut',
    name: 'Sert Kesim (Cut)',
    category: 'basic',
    categoryName: 'Temel',
    description: 'Anlık kesintisiz doğrudan geçiş',
    icon: '✂️',
    defaultDuration: 0.1,
    minDuration: 0.05,
    maxDuration: 0.5,
  },
  {
    id: 'crossfade',
    name: 'Çapraz Geçiş (Crossfade)',
    category: 'basic',
    categoryName: 'Temel',
    description: 'İki klip arasında pürüzsüz erime',
    icon: '🌫️',
    defaultDuration: 1.0,
    minDuration: 0.2,
    maxDuration: 3.0,
    defaultEasing: 'ease-in-out',
  },
  {
    id: 'fade-black',
    name: 'Karararak Geçiş (Dip to Black)',
    category: 'basic',
    categoryName: 'Temel',
    description: 'Siyaha kararıp yeni klibe açılma',
    icon: '🌑',
    defaultDuration: 1.0,
    minDuration: 0.3,
    maxDuration: 3.0,
  },
  {
    id: 'fade-white',
    name: 'Parlama Geçiş (Dip to White)',
    category: 'basic',
    categoryName: 'Temel',
    description: 'Bembeyaz ışıkla parlayıp yeni klibe geçiş',
    icon: '⚪',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
  },
  {
    id: 'fade-through-blur',
    name: 'Bulanıklaşarak Geçiş (Fade Through Blur)',
    category: 'basic',
    categoryName: 'Temel',
    description: 'Ortada bulanıklaşarak pürüzsüz çözünme',
    icon: '💫',
    defaultDuration: 1.0,
    minDuration: 0.3,
    maxDuration: 2.5,
  },
  {
    id: 'dissolve',
    name: 'Çözünerek Geçiş (Dissolve)',
    category: 'basic',
    categoryName: 'Temel',
    description: 'Sinematik yumuşak piksel erimesi',
    icon: '✨',
    defaultDuration: 1.2,
    minDuration: 0.3,
    maxDuration: 3.0,
  },

  // 2. Kaydırma ve İtme (Slide & Push)
  {
    id: 'slide-left',
    name: 'Sola Kaydır (Slide Left)',
    category: 'slide-push',
    categoryName: 'Kaydırma & İtme',
    description: 'Yeni klip sağdan sola üstten kayarak girer',
    icon: '⬅️',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
    defaultEasing: 'ease-out',
  },
  {
    id: 'slide-right',
    name: 'Sağa Kaydır (Slide Right)',
    category: 'slide-push',
    categoryName: 'Kaydırma & İtme',
    description: 'Yeni klip soldan sağa üstten kayarak girer',
    icon: '➡️',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
    defaultEasing: 'ease-out',
  },
  {
    id: 'slide-up',
    name: 'Yukarı Kaydır (Slide Up)',
    category: 'slide-push',
    categoryName: 'Kaydırma & İtme',
    description: 'Yeni klip aşağıdan yukarı kayarak girer',
    icon: '⬆️',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
    defaultEasing: 'ease-out',
  },
  {
    id: 'slide-down',
    name: 'Aşağı Kaydır (Slide Down)',
    category: 'slide-push',
    categoryName: 'Kaydırma & İtme',
    description: 'Yeni klip yukarıdan aşağı kayarak girer',
    icon: '⬇️',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
    defaultEasing: 'ease-out',
  },
  {
    id: 'push-left',
    name: 'Sola İt (Push Left)',
    category: 'slide-push',
    categoryName: 'Kaydırma & İtme',
    description: 'Yeni klip eski klibi sola doğru iter',
    icon: '◀️',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
    defaultEasing: 'ease-in-out',
  },
  {
    id: 'push-right',
    name: 'Sağa İt (Push Right)',
    category: 'slide-push',
    categoryName: 'Kaydırma & İtme',
    description: 'Yeni klip eski klibi sağa doğru iter',
    icon: '▶️',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
    defaultEasing: 'ease-in-out',
  },
  {
    id: 'push-up',
    name: 'Yukarı İt (Push Up)',
    category: 'slide-push',
    categoryName: 'Kaydırma & İtme',
    description: 'Yeni klip eski klibi yukarı doğru iter',
    icon: '🔼',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
    defaultEasing: 'ease-in-out',
  },
  {
    id: 'push-down',
    name: 'Aşağı İt (Push Down)',
    category: 'slide-push',
    categoryName: 'Kaydırma & İtme',
    description: 'Yeni klip eski klibi aşağı doğru iter',
    icon: '🔽',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
    defaultEasing: 'ease-in-out',
  },
  {
    id: 'whip-pan-left',
    name: 'Hızlı Kırbaç Sola (Whip Pan Left)',
    category: 'slide-push',
    categoryName: 'Kaydırma & İtme',
    description: 'Aşırı hızlı hareket bulanıklığıyla sola ani kamera çevrimi',
    icon: '🏎️',
    defaultDuration: 0.5,
    minDuration: 0.2,
    maxDuration: 1.2,
  },
  {
    id: 'whip-pan-right',
    name: 'Hızlı Kırbaç Sağa (Whip Pan Right)',
    category: 'slide-push',
    categoryName: 'Kaydırma & İtme',
    description: 'Aşırı hızlı hareket bulanıklığıyla sağa ani kamera çevrimi',
    icon: '🏎️',
    defaultDuration: 0.5,
    minDuration: 0.2,
    maxDuration: 1.2,
  },

  // 3. Perde ve Maske (Wipe & Mask)
  {
    id: 'wipe-left',
    name: 'Sola Perde (Wipe Left)',
    category: 'wipe-mask',
    categoryName: 'Perde & Maske',
    description: 'Perde gibi sağdan sola açılarak geçiş',
    icon: '🪟',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
  },
  {
    id: 'wipe-right',
    name: 'Sağa Perde (Wipe Right)',
    category: 'wipe-mask',
    categoryName: 'Perde & Maske',
    description: 'Perde gibi soldan sağa açılarak geçiş',
    icon: '🚪',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
  },
  {
    id: 'wipe-up',
    name: 'Yukarı Perde (Wipe Up)',
    category: 'wipe-mask',
    categoryName: 'Perde & Maske',
    description: 'Aşağıdan yukarı perdeleme ile geçiş',
    icon: '🛫',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
  },
  {
    id: 'wipe-down',
    name: 'Aşağı Perde (Wipe Down)',
    category: 'wipe-mask',
    categoryName: 'Perde & Maske',
    description: 'Yukarıdan aşağı perdeleme ile geçiş',
    icon: '🛬',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
  },
  {
    id: 'diagonal-wipe',
    name: 'Çapraz Perde (Diagonal Wipe)',
    category: 'wipe-mask',
    categoryName: 'Perde & Maske',
    description: 'Köşeden çapraz çizgiyle açılan perde',
    icon: '📐',
    defaultDuration: 1.0,
    minDuration: 0.3,
    maxDuration: 2.5,
  },
  {
    id: 'circle-reveal',
    name: 'Daire Açılma (Circle Reveal)',
    category: 'wipe-mask',
    categoryName: 'Perde & Maske',
    description: 'Merkezden dışa doğru genişleyen dairesel maske',
    icon: '⭕',
    defaultDuration: 1.0,
    minDuration: 0.3,
    maxDuration: 2.5,
  },
  {
    id: 'circle-close',
    name: 'Daire Kapanma (Circle Close)',
    category: 'wipe-mask',
    categoryName: 'Perde & Maske',
    description: 'Dıştan merkeze küçülen dairesel iris kapanış',
    icon: '🔘',
    defaultDuration: 1.0,
    minDuration: 0.3,
    maxDuration: 2.5,
  },
  {
    id: 'soft-mask-reveal',
    name: 'Yumuşak Maske (Soft Mask Reveal)',
    category: 'wipe-mask',
    categoryName: 'Perde & Maske',
    description: 'Yumuşak geçişli gradyan dairesel maske açılışı',
    icon: '🟣',
    defaultDuration: 1.2,
    minDuration: 0.3,
    maxDuration: 3.0,
  },

  // 4. Kamera ve Hareket (Camera & Motion)
  {
    id: 'zoom-in',
    name: 'Yakınlaşarak (Zoom In)',
    category: 'camera-motion',
    categoryName: 'Kamera & Hareket',
    description: 'Kameranın ekrana doğru hızlıca girmesi',
    icon: '🔍',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
  },
  {
    id: 'zoom-out',
    name: 'Uzaklaşarak (Zoom Out)',
    category: 'camera-motion',
    categoryName: 'Kamera & Hareket',
    description: 'Kameranın geniş açıya geri çekilmesi',
    icon: '🔎',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
  },
  {
    id: 'zoom-blur',
    name: 'Optik Zoom Bulanıklığı (Zoom Blur)',
    category: 'camera-motion',
    categoryName: 'Kamera & Hareket',
    description: 'Işınsal yakınlaşma bulanıklığı ile dinamik geçiş',
    icon: '🌀',
    defaultDuration: 0.7,
    minDuration: 0.2,
    maxDuration: 1.5,
  },
  {
    id: 'spin',
    name: 'Dönerek Geçiş (Spin)',
    category: 'camera-motion',
    categoryName: 'Kamera & Hareket',
    description: '360 derece eksen etrafında dönerek yeni klibe geçiş',
    icon: '🔄',
    defaultDuration: 0.9,
    minDuration: 0.3,
    maxDuration: 2.0,
  },
  {
    id: 'flip-horizontal',
    name: 'Yatay Çevir (Flip Horizontal)',
    category: 'camera-motion',
    categoryName: 'Kamera & Hareket',
    description: 'Kart gibi yatay 3D düzlemde dönerek açılma',
    icon: '🔁',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
  },
  {
    id: 'flip-vertical',
    name: 'Dikey Çevir (Flip Vertical)',
    category: 'camera-motion',
    categoryName: 'Kamera & Hareket',
    description: 'Kart gibi dikey 3D düzlemde dönerek açılma',
    icon: '🔃',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
  },

  // 5. Stilize (Stylized)
  {
    id: 'blur-dissolve',
    name: 'Bulanık Erime (Blur Dissolve)',
    category: 'stylize',
    categoryName: 'Stilize Efektler',
    description: 'Optik odak kaybı ve rüya gibi bulanık erime',
    icon: '🔮',
    defaultDuration: 1.0,
    minDuration: 0.3,
    maxDuration: 2.5,
  },
  {
    id: 'pixel-dissolve',
    name: 'Piksel Erimesi (Pixel Dissolve)',
    category: 'stylize',
    categoryName: 'Stilize Efektler',
    description: 'Retro pikselleşerek yeni klibe çözünme',
    icon: '👾',
    defaultDuration: 0.9,
    minDuration: 0.3,
    maxDuration: 2.0,
  },
  {
    id: 'rgb-split',
    name: 'RGB Ayrışması (RGB Split)',
    category: 'stylize',
    categoryName: 'Stilize Efektler',
    description: 'Kırmızı ve Mavi renk kanallarının kaymasıyla siber geçiş',
    icon: '🌈',
    defaultDuration: 0.6,
    minDuration: 0.2,
    maxDuration: 1.5,
  },
  {
    id: 'glitch',
    name: 'Bozulma & Glitch (Glitch)',
    category: 'stylize',
    categoryName: 'Stilize Efektler',
    description: 'Yatay dijital sinyal paraziti ve sıçraması',
    icon: '⚡',
    defaultDuration: 0.6,
    minDuration: 0.2,
    maxDuration: 1.5,
  },
  {
    id: 'light-leak',
    name: 'Işık Sızıntısı (Light Leak)',
    category: 'stylize',
    categoryName: 'Stilize Efektler',
    description: 'Sıcak analog kamera lens ışık parlaması',
    icon: '🏮',
    defaultDuration: 1.0,
    minDuration: 0.3,
    maxDuration: 2.5,
  },
  {
    id: 'film-burn',
    name: 'Film Yanığı (Film Burn)',
    category: 'stylize',
    categoryName: 'Stilize Efektler',
    description: '35mm makara filmin kenardan alev alması ve yanması',
    icon: '🔥',
    defaultDuration: 1.0,
    minDuration: 0.3,
    maxDuration: 2.5,
  },
  {
    id: 'flash',
    name: 'Fotoğraf Flaşı (Flash)',
    category: 'stylize',
    categoryName: 'Stilize Efektler',
    description: 'Ani 1 karelik parlak stüdyo flaşı patlaması',
    icon: '📸',
    defaultDuration: 0.4,
    minDuration: 0.1,
    maxDuration: 1.0,
  },
  {
    id: 'vhs-distortion',
    name: 'VHS Manyetik Bozulma (VHS Distortion)',
    category: 'stylize',
    categoryName: 'Stilize Efektler',
    description: 'Eski nostaljik kaset manyetik tarama çizgileri',
    icon: '📼',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
  },
];

/**
 * Computes rendering modifiers for a clip undergoing a transition
 * @param progress 0.0 (transition start) to 1.0 (transition end)
 * @param type TransitionType
 * @param isIncoming true if this is the incoming clip, false if outgoing
 */
export function computeTransitionState(
  progress: number,
  type: Transition['type'],
  isIncoming: boolean
): TransitionState {
  const p = Math.max(0, Math.min(1, progress));

  switch (type) {
    // ----------------------------------------------------
    // 1. TEMEL
    // ----------------------------------------------------
    case 'crossfade':
    case 'dissolve':
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
      };

    case 'fade-black': {
      if (isIncoming) {
        const inP = p <= 0.5 ? 0 : (p - 0.5) * 2;
        return {
          opacity: inP,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          colorOverlay: { r: 0, g: 0, b: 0, a: 1 - inP },
        };
      } else {
        const outP = p <= 0.5 ? 1 - p * 2 : 0;
        return {
          opacity: outP,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          colorOverlay: { r: 0, g: 0, b: 0, a: 1 - outP },
        };
      }
    }

    case 'fade-white': {
      if (isIncoming) {
        const inP = p <= 0.5 ? 0 : (p - 0.5) * 2;
        return {
          opacity: inP,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          colorOverlay: { r: 255, g: 255, b: 255, a: 1 - inP },
        };
      } else {
        const outP = p <= 0.5 ? 1 - p * 2 : 0;
        return {
          opacity: outP,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          colorOverlay: { r: 255, g: 255, b: 255, a: 1 - outP },
        };
      }
    }

    case 'fade-through-blur': {
      const peakBlur = 24;
      const blurAmount = Math.round(Math.sin(p * Math.PI) * peakBlur);
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        blur: blurAmount,
      };
    }

    // ----------------------------------------------------
    // 2. KAYDIRMA VE İTME
    // ----------------------------------------------------
    case 'slide-left':
      return {
        opacity: 1,
        offsetX: isIncoming ? 1 - p : 0, // Incoming slides over outgoing
        offsetY: 0,
        scale: 1,
      };

    case 'slide-right':
      return {
        opacity: 1,
        offsetX: isIncoming ? -(1 - p) : 0,
        offsetY: 0,
        scale: 1,
      };

    case 'slide-up':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: isIncoming ? 1 - p : 0,
        scale: 1,
      };

    case 'slide-down':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: isIncoming ? -(1 - p) : 0,
        scale: 1,
      };

    case 'push-left':
      return {
        opacity: 1,
        offsetX: isIncoming ? 1 - p : -p, // Both clips push synchronously
        offsetY: 0,
        scale: 1,
      };

    case 'push-right':
      return {
        opacity: 1,
        offsetX: isIncoming ? -(1 - p) : p,
        offsetY: 0,
        scale: 1,
      };

    case 'push-up':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: isIncoming ? 1 - p : -p,
        scale: 1,
      };

    case 'push-down':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: isIncoming ? -(1 - p) : p,
        scale: 1,
      };

    case 'whip-pan-left': {
      const easeP = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const blurFactor = Math.sin(p * Math.PI) * 35;
      return {
        opacity: 1,
        offsetX: isIncoming ? 1 - easeP : -easeP,
        offsetY: 0,
        scale: 1,
        blur: Math.round(blurFactor),
      };
    }

    case 'whip-pan-right': {
      const easeP = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const blurFactor = Math.sin(p * Math.PI) * 35;
      return {
        opacity: 1,
        offsetX: isIncoming ? -(1 - easeP) : easeP,
        offsetY: 0,
        scale: 1,
        blur: Math.round(blurFactor),
      };
    }

    // ----------------------------------------------------
    // 3. PERDE VE MASKE
    // ----------------------------------------------------
    case 'wipe-left':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        wipeRatio: isIncoming ? p : 1 - p,
        wipeDirection: isIncoming ? 'left' : 'right',
        maskShape: 'rect',
      };

    case 'wipe-right':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        wipeRatio: isIncoming ? p : 1 - p,
        wipeDirection: isIncoming ? 'right' : 'left',
        maskShape: 'rect',
      };

    case 'wipe-up':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        wipeRatio: isIncoming ? p : 1 - p,
        wipeDirection: isIncoming ? 'up' : 'down',
        maskShape: 'rect',
      };

    case 'wipe-down':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        wipeRatio: isIncoming ? p : 1 - p,
        wipeDirection: isIncoming ? 'down' : 'up',
        maskShape: 'rect',
      };

    case 'diagonal-wipe':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        wipeRatio: isIncoming ? p : 1 - p,
        wipeDirection: 'diagonal',
        maskShape: 'diagonal',
      };

    case 'circle-reveal':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        maskShape: 'circle-in',
        maskRadius: isIncoming ? p : 1 - p,
      };

    case 'circle-close':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        maskShape: 'circle-out',
        maskRadius: isIncoming ? 1 - p : p,
      };

    case 'soft-mask-reveal':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        maskShape: 'soft-circle',
        maskRadius: isIncoming ? p : 1 - p,
      };

    // ----------------------------------------------------
    // 4. KAMERA VE HAREKET
    // ----------------------------------------------------
    case 'zoom-in': {
      if (isIncoming) {
        return {
          opacity: p,
          offsetX: 0,
          offsetY: 0,
          scale: 0.4 + p * 0.6,
        };
      } else {
        return {
          opacity: 1 - p,
          offsetX: 0,
          offsetY: 0,
          scale: 1.0 + p * 0.8,
        };
      }
    }

    case 'zoom-out': {
      if (isIncoming) {
        return {
          opacity: p,
          offsetX: 0,
          offsetY: 0,
          scale: 1.6 - p * 0.6,
        };
      } else {
        return {
          opacity: 1 - p,
          offsetX: 0,
          offsetY: 0,
          scale: 1.0 - p * 0.5,
        };
      }
    }

    case 'zoom-blur': {
      const zoomBlurFactor = Math.sin(p * Math.PI);
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: isIncoming ? 0.8 + p * 0.2 : 1.0 + p * 0.4,
        zoomBlur: zoomBlurFactor,
        blur: Math.round(zoomBlurFactor * 15),
      };
    }

    case 'spin': {
      const rot = isIncoming ? (1 - p) * -180 : p * 180;
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: isIncoming ? 0.5 + p * 0.5 : 1 - p * 0.5,
        rotation: rot,
      };
    }

    case 'flip-horizontal': {
      const half = p <= 0.5;
      if (isIncoming) {
        return {
          opacity: half ? 0 : 1,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          scaleX: half ? 0 : (p - 0.5) * 2,
          scaleY: 1,
        };
      } else {
        return {
          opacity: half ? 1 : 0,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          scaleX: half ? 1 - p * 2 : 0,
          scaleY: 1,
        };
      }
    }

    case 'flip-vertical': {
      const half = p <= 0.5;
      if (isIncoming) {
        return {
          opacity: half ? 0 : 1,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          scaleX: 1,
          scaleY: half ? 0 : (p - 0.5) * 2,
        };
      } else {
        return {
          opacity: half ? 1 : 0,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          scaleX: 1,
          scaleY: half ? 1 - p * 2 : 0,
        };
      }
    }

    // ----------------------------------------------------
    // 5. STİLİZE
    // ----------------------------------------------------
    case 'blur-dissolve': {
      const maxBlur = 24;
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        blur: isIncoming ? Math.round((1 - p) * maxBlur) : Math.round(p * maxBlur),
      };
    }

    case 'pixel-dissolve': {
      const block = Math.round(Math.sin(p * Math.PI) * 28);
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        pixelate: Math.max(1, block),
      };
    }

    case 'rgb-split': {
      const shift = Math.round(Math.sin(p * Math.PI) * 25);
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: isIncoming ? (1 - p) * 0.1 : -p * 0.1,
        offsetY: 0,
        scale: 1,
        rgbSplit: shift,
      };
    }

    case 'glitch': {
      const glitchIntensity = Math.sin(p * Math.PI);
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: (Math.sin(p * 50) * 0.05) * glitchIntensity,
        offsetY: (Math.cos(p * 35) * 0.03) * glitchIntensity,
        scale: 1 + (glitchIntensity * 0.05),
        glitch: {
          amount: glitchIntensity,
          sliceCount: Math.round(6 + glitchIntensity * 12),
          jitter: glitchIntensity * 30,
        },
      };
    }

    case 'light-leak': {
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        lightLeak: {
          intensity: Math.sin(p * Math.PI),
          progress: p,
        },
      };
    }

    case 'film-burn': {
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        filmBurn: {
          intensity: Math.sin(p * Math.PI),
          progress: p,
        },
      };
    }

    case 'flash': {
      // Very fast white flash peak at center
      const flashIntensity = Math.pow(Math.sin(p * Math.PI), 4);
      return {
        opacity: isIncoming ? (p > 0.5 ? 1 : 0) : (p <= 0.5 ? 1 : 0),
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        flash: { intensity: flashIntensity },
        colorOverlay: { r: 255, g: 255, b: 255, a: flashIntensity },
      };
    }

    case 'vhs-distortion': {
      const vhsIntensity = Math.sin(p * Math.PI);
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        vhs: {
          intensity: vhsIntensity,
          trackingJitter: (Math.sin(p * 80) * 10) * vhsIntensity,
        },
        rgbSplit: Math.round(vhsIntensity * 8),
      };
    }

    case 'cut':
    case 'none':
    default:
      return {
        opacity: isIncoming ? (p >= 0.5 ? 1 : 0) : (p < 0.5 ? 1 : 0),
        offsetX: 0,
        offsetY: 0,
        scale: 1,
      };
  }
}

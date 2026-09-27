/**
 * FORMA Video Editor — Professional 52 Transition Engine
 * High-performance, mathematically distinct frame computation for
 * interactive preview, mini-card thumbnail, timeline scrub, and export renderers.
 */

import type { Transition, TransitionType } from '../types';

export type TransitionCategory =
  | 'basic'
  | 'slide-push'
  | 'wipe-mask'
  | 'camera-motion'
  | 'cinematic-digital'
  | 'stylize'; // backward compatibility

export interface TransitionDef {
  id: TransitionType;
  name: string;
  technicalId: string;
  category: TransitionCategory;
  categoryName: string;
  description: string;
  icon: string;
  defaultDuration: number;
  minDuration: number;
  maxDuration: number;
  supportedDirections?: ('left' | 'right' | 'up' | 'down')[];
  defaultEasing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  supportsColor?: boolean;
  supportsFeather?: boolean;
}

export interface TransitionState {
  opacity: number;
  offsetX: number; // Normalized -1 to 1 (multiply by width)
  offsetY: number; // Normalized -1 to 1 (multiply by height)
  scale: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number; // in degrees
  blur?: number; // in pixels
  zoomBlur?: number; // 0 to 1
  wipeRatio?: number; // 0.0 to 1.0 (mask progress)
  wipeDirection?: 'left' | 'right' | 'up' | 'down' | 'diagonal';
  maskShape?:
    | 'rect'
    | 'diagonal'
    | 'circle-in'
    | 'circle-out'
    | 'clock'
    | 'blinds'
    | 'checker'
    | 'soft-circle'
    | 'split-h'
    | 'split-v';
  maskRadius?: number; // 0 to 1 normalized
  feather?: number; // blur radius on edge
  pixelate?: number; // block size in px
  rgbSplit?: number; // pixel offset
  glitch?: { amount: number; sliceCount: number; jitter: number };
  colorOverlay?: { r: number; g: number; b: number; a: number };
  lightLeak?: { intensity: number; progress: number };
  filmBurn?: { intensity: number; progress: number };
  lensFlare?: { intensity: number; progress: number };
  flash?: { intensity: number };
  vhs?: { intensity: number; trackingJitter: number };
  prism?: { intensity: number; shift: number };
  lumaThreshold?: number;
  additive?: boolean;
}

export const TRANSITION_DEFINITIONS: TransitionDef[] = [
  // ====================================================
  // 1. TEMEL (Basic - 8)
  // ====================================================
  {
    id: 'cut',
    name: 'Sert Kesim',
    technicalId: 'Hard Cut',
    category: 'basic',
    categoryName: 'Temel',
    description: 'Anlık kesintisiz doğrudan geçiş',
    icon: 'Scissors',
    defaultDuration: 0.1,
    minDuration: 0.05,
    maxDuration: 0.5,
  },
  {
    id: 'crossfade',
    name: 'Çapraz Geçiş',
    technicalId: 'Crossfade',
    category: 'basic',
    categoryName: 'Temel',
    description: 'İki klip arasında pürüzsüz doğrusal erime',
    icon: 'Blend',
    defaultDuration: 1.0,
    minDuration: 0.2,
    maxDuration: 3.0,
    defaultEasing: 'linear',
  },
  {
    id: 'fade-black',
    name: 'Siyaha Kararma',
    technicalId: 'Dip to Black',
    category: 'basic',
    categoryName: 'Temel',
    description: 'Siyaha kararıp yeni klibe açılma',
    icon: 'Moon',
    defaultDuration: 1.0,
    minDuration: 0.3,
    maxDuration: 3.0,
  },
  {
    id: 'fade-white',
    name: 'Beyaza Parlama',
    technicalId: 'Dip to White',
    category: 'basic',
    categoryName: 'Temel',
    description: 'Bembeyaz ışıkla parlayıp yeni klibe geçiş',
    icon: 'Sun',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
  },
  {
    id: 'dip-color',
    name: 'Renge Dalma',
    technicalId: 'Dip to Color',
    category: 'basic',
    categoryName: 'Temel',
    description: 'Seçilen renge batıp yeni klibe açılma',
    icon: 'Palette',
    defaultDuration: 1.0,
    minDuration: 0.3,
    maxDuration: 3.0,
    supportsColor: true,
  },
  {
    id: 'additive-dissolve',
    name: 'Toplamsal Erime',
    technicalId: 'Additive Dissolve',
    category: 'basic',
    categoryName: 'Temel',
    description: 'Piksellerin parlaklığını toplayarak erime',
    icon: 'Sparkle',
    defaultDuration: 1.0,
    minDuration: 0.2,
    maxDuration: 2.5,
  },
  {
    id: 'soft-dissolve',
    name: 'Yumuşak Erime',
    technicalId: 'Soft Dissolve',
    category: 'basic',
    categoryName: 'Temel',
    description: 'S-eğrisi yumuşaklığında sinematik erime',
    icon: 'Waves',
    defaultDuration: 1.2,
    minDuration: 0.3,
    maxDuration: 3.0,
    defaultEasing: 'ease-in-out',
  },
  {
    id: 'luma-fade',
    name: 'Luma Geçişi',
    technicalId: 'Luma Fade',
    category: 'basic',
    categoryName: 'Temel',
    description: 'Parlaklık eşiğine göre kademeli çözünme',
    icon: 'Sliders',
    defaultDuration: 1.0,
    minDuration: 0.3,
    maxDuration: 2.5,
  },

  // ====================================================
  // 2. KAYDIRMA VE İTME (Slide & Push - 12)
  // ====================================================
  {
    id: 'slide-left',
    name: 'Sola Kaydır',
    technicalId: 'Slide Left',
    category: 'slide-push',
    categoryName: 'Kaydırma & İtme',
    description: 'Yeni klip sağdan sola üstten kayarak girer',
    icon: 'ArrowLeft',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
    defaultEasing: 'ease-out',
  },
  {
    id: 'slide-right',
    name: 'Sağa Kaydır',
    technicalId: 'Slide Right',
    category: 'slide-push',
    categoryName: 'Kaydırma & İtme',
    description: 'Yeni klip soldan sağa üstten kayarak girer',
    icon: 'ArrowRight',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
    defaultEasing: 'ease-out',
  },
  {
    id: 'slide-up',
    name: 'Yukarı Kaydır',
    technicalId: 'Slide Up',
    category: 'slide-push',
    categoryName: 'Kaydırma & İtme',
    description: 'Yeni klip aşağıdan yukarı kayarak girer',
    icon: 'ArrowUp',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
    defaultEasing: 'ease-out',
  },
  {
    id: 'slide-down',
    name: 'Aşağı Kaydır',
    technicalId: 'Slide Down',
    category: 'slide-push',
    categoryName: 'Kaydırma & İtme',
    description: 'Yeni klip yukarıdan aşağı kayarak girer',
    icon: 'ArrowDown',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
    defaultEasing: 'ease-out',
  },
  {
    id: 'push-left',
    name: 'Sola İt',
    technicalId: 'Push Left',
    category: 'slide-push',
    categoryName: 'Kaydırma & İtme',
    description: 'Yeni klip eski klibi sola doğru iter',
    icon: 'ChevronsLeft',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
    defaultEasing: 'ease-in-out',
  },
  {
    id: 'push-right',
    name: 'Sağa İt',
    technicalId: 'Push Right',
    category: 'slide-push',
    categoryName: 'Kaydırma & İtme',
    description: 'Yeni klip eski klibi sağa doğru iter',
    icon: 'ChevronsRight',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
    defaultEasing: 'ease-in-out',
  },
  {
    id: 'push-up',
    name: 'Yukarı İt',
    technicalId: 'Push Up',
    category: 'slide-push',
    categoryName: 'Kaydırma & İtme',
    description: 'Yeni klip eski klibi yukarı doğru iter',
    icon: 'ChevronsUp',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
    defaultEasing: 'ease-in-out',
  },
  {
    id: 'push-down',
    name: 'Aşağı İt',
    technicalId: 'Push Down',
    category: 'slide-push',
    categoryName: 'Kaydırma & İtme',
    description: 'Yeni klip eski klibi aşağı doğru iter',
    icon: 'ChevronsDown',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
    defaultEasing: 'ease-in-out',
  },
  {
    id: 'split-open-horizontal',
    name: 'Yatay Bölerek Aç',
    technicalId: 'Split Open Horizontal',
    category: 'slide-push',
    categoryName: 'Kaydırma & İtme',
    description: 'Eski klip ortadan iki yana ayrılarak yenisini açar',
    icon: 'SplitSquareVertical',
    defaultDuration: 0.9,
    minDuration: 0.3,
    maxDuration: 2.5,
  },
  {
    id: 'split-open-vertical',
    name: 'Dikey Bölerek Aç',
    technicalId: 'Split Open Vertical',
    category: 'slide-push',
    categoryName: 'Kaydırma & İtme',
    description: 'Eski klip üst ve alta ayrılarak yenisini açar',
    icon: 'SplitSquareHorizontal',
    defaultDuration: 0.9,
    minDuration: 0.3,
    maxDuration: 2.5,
  },
  {
    id: 'split-close-horizontal',
    name: 'Yatay Kapanış',
    technicalId: 'Split Close Horizontal',
    category: 'slide-push',
    categoryName: 'Kaydırma & İtme',
    description: 'Yeni klip iki yandan merkeze kapanarak girer',
    icon: 'FoldHorizontal',
    defaultDuration: 0.9,
    minDuration: 0.3,
    maxDuration: 2.5,
  },
  {
    id: 'split-close-vertical',
    name: 'Dikey Kapanış',
    technicalId: 'Split Close Vertical',
    category: 'slide-push',
    categoryName: 'Kaydırma & İtme',
    description: 'Yeni klip üst ve alttan merkeze kapanarak girer',
    icon: 'FoldVertical',
    defaultDuration: 0.9,
    minDuration: 0.3,
    maxDuration: 2.5,
  },

  // ====================================================
  // 3. SİLME VE MASKE (Wipe & Mask - 12)
  // ====================================================
  {
    id: 'wipe-left',
    name: 'Sola Silme',
    technicalId: 'Wipe Left',
    category: 'wipe-mask',
    categoryName: 'Silme & Maske',
    description: 'Perde gibi sağdan sola açılarak geçiş',
    icon: 'PanelLeftClose',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
    supportsFeather: true,
  },
  {
    id: 'wipe-right',
    name: 'Sağa Silme',
    technicalId: 'Wipe Right',
    category: 'wipe-mask',
    categoryName: 'Silme & Maske',
    description: 'Perde gibi soldan sağa açılarak geçiş',
    icon: 'PanelRightClose',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
    supportsFeather: true,
  },
  {
    id: 'wipe-up',
    name: 'Yukarı Silme',
    technicalId: 'Wipe Up',
    category: 'wipe-mask',
    categoryName: 'Silme & Maske',
    description: 'Aşağıdan yukarı perdeleme ile geçiş',
    icon: 'PanelTopClose',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
    supportsFeather: true,
  },
  {
    id: 'wipe-down',
    name: 'Aşağı Silme',
    technicalId: 'Wipe Down',
    category: 'wipe-mask',
    categoryName: 'Silme & Maske',
    description: 'Yukarıdan aşağı perdeleme ile geçiş',
    icon: 'PanelBottomClose',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
    supportsFeather: true,
  },
  {
    id: 'diagonal-wipe',
    name: 'Çapraz Silme',
    technicalId: 'Diagonal Wipe',
    category: 'wipe-mask',
    categoryName: 'Silme & Maske',
    description: 'Köşeden çapraz çizgiyle açılan perde',
    icon: 'Maximize2',
    defaultDuration: 1.0,
    minDuration: 0.3,
    maxDuration: 2.5,
    supportsFeather: true,
  },
  {
    id: 'circle-reveal',
    name: 'Dairesel Silme',
    technicalId: 'Circle Reveal',
    category: 'wipe-mask',
    categoryName: 'Silme & Maske',
    description: 'Merkezden dışa doğru genişleyen daire',
    icon: 'CircleDot',
    defaultDuration: 1.0,
    minDuration: 0.3,
    maxDuration: 2.5,
    supportsFeather: true,
  },
  {
    id: 'iris-in',
    name: 'İçe İris',
    technicalId: 'Iris In',
    category: 'wipe-mask',
    categoryName: 'Silme & Maske',
    description: 'Dıştan merkeze küçülen dairesel iris',
    icon: 'Disc',
    defaultDuration: 1.0,
    minDuration: 0.3,
    maxDuration: 2.5,
    supportsFeather: true,
  },
  {
    id: 'iris-out',
    name: 'Dışa İris',
    technicalId: 'Iris Out',
    category: 'wipe-mask',
    categoryName: 'Silme & Maske',
    description: 'Merkezden dışa büyüyen elmas iris açılışı',
    icon: 'SquareDot',
    defaultDuration: 1.0,
    minDuration: 0.3,
    maxDuration: 2.5,
    supportsFeather: true,
  },
  {
    id: 'radial-clock-wipe',
    name: 'Saat Yönünde Silme',
    technicalId: 'Clock Wipe',
    category: 'wipe-mask',
    categoryName: 'Silme & Maske',
    description: 'Saat ibresi gibi açısal dönerek süpürme',
    icon: 'Clock',
    defaultDuration: 1.0,
    minDuration: 0.3,
    maxDuration: 2.5,
  },
  {
    id: 'venetian-blinds',
    name: 'Şeritli Silme',
    technicalId: 'Venetian Blinds',
    category: 'wipe-mask',
    categoryName: 'Silme & Maske',
    description: 'Jaluzi şeritleri gibi dilim dilim açılma',
    icon: 'AlignJustify',
    defaultDuration: 0.9,
    minDuration: 0.3,
    maxDuration: 2.5,
  },
  {
    id: 'checkerboard',
    name: 'Dama Tahtası',
    technicalId: 'Checkerboard',
    category: 'wipe-mask',
    categoryName: 'Silme & Maske',
    description: 'Kare bloklar hâlinde dama deseniyle geçiş',
    icon: 'Grid',
    defaultDuration: 1.0,
    minDuration: 0.3,
    maxDuration: 2.5,
  },
  {
    id: 'soft-mask-reveal',
    name: 'Yumuşak Kenarlı Maske',
    technicalId: 'Soft Mask Reveal',
    category: 'wipe-mask',
    categoryName: 'Silme & Maske',
    description: 'Bulanık kenarlı yumuşak gradyan açılışı',
    icon: 'Focus',
    defaultDuration: 1.2,
    minDuration: 0.3,
    maxDuration: 3.0,
    supportsFeather: true,
  },

  // ====================================================
  // 4. KAMERA VE HAREKET (Camera & Motion - 10)
  // ====================================================
  {
    id: 'zoom-in',
    name: 'Yakınlaşarak Geçiş',
    technicalId: 'Zoom In',
    category: 'camera-motion',
    categoryName: 'Kamera & Hareket',
    description: 'Kameranın ekrana doğru hızla yaklaşması',
    icon: 'ZoomIn',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
  },
  {
    id: 'zoom-out',
    name: 'Uzaklaşarak Geçiş',
    technicalId: 'Zoom Out',
    category: 'camera-motion',
    categoryName: 'Kamera & Hareket',
    description: 'Kameranın geniş açıya hızla geri çekilmesi',
    icon: 'ZoomOut',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
  },
  {
    id: 'whip-pan-left',
    name: 'Sola Whip Pan',
    technicalId: 'Whip Pan Left',
    category: 'camera-motion',
    categoryName: 'Kamera & Hareket',
    description: 'Aşırı hızlı hareket bulanıklığıyla sola ani kamera çevrimi',
    icon: 'FastForward',
    defaultDuration: 0.5,
    minDuration: 0.2,
    maxDuration: 1.2,
  },
  {
    id: 'whip-pan-right',
    name: 'Sağa Whip Pan',
    technicalId: 'Whip Pan Right',
    category: 'camera-motion',
    categoryName: 'Kamera & Hareket',
    description: 'Aşırı hızlı hareket bulanıklığıyla sağa ani kamera çevrimi',
    icon: 'FastForward',
    defaultDuration: 0.5,
    minDuration: 0.2,
    maxDuration: 1.2,
  },
  {
    id: 'whip-pan-up',
    name: 'Yukarı Whip Pan',
    technicalId: 'Whip Pan Up',
    category: 'camera-motion',
    categoryName: 'Kamera & Hareket',
    description: 'Hızlı hareket bulanıklığıyla yukarı ani kamera çevrimi',
    icon: 'MoveUp',
    defaultDuration: 0.5,
    minDuration: 0.2,
    maxDuration: 1.2,
  },
  {
    id: 'whip-pan-down',
    name: 'Aşağı Whip Pan',
    technicalId: 'Whip Pan Down',
    category: 'camera-motion',
    categoryName: 'Kamera & Hareket',
    description: 'Hızlı hareket bulanıklığıyla aşağı ani kamera çevrimi',
    icon: 'MoveDown',
    defaultDuration: 0.5,
    minDuration: 0.2,
    maxDuration: 1.2,
  },
  {
    id: 'spin-cw',
    name: 'Saat Yönünde Dönüş',
    technicalId: 'Spin Clockwise',
    category: 'camera-motion',
    categoryName: 'Kamera & Hareket',
    description: '360 derece saat yönünde dönerek yeni klibe geçiş',
    icon: 'RotateCw',
    defaultDuration: 0.9,
    minDuration: 0.3,
    maxDuration: 2.0,
  },
  {
    id: 'spin-ccw',
    name: 'Saat Yönünün Tersine Dönüş',
    technicalId: 'Spin Counter-Clockwise',
    category: 'camera-motion',
    categoryName: 'Kamera & Hareket',
    description: '360 derece ters yönde dönerek yeni klibe geçiş',
    icon: 'RotateCcw',
    defaultDuration: 0.9,
    minDuration: 0.3,
    maxDuration: 2.0,
  },
  {
    id: 'flip-horizontal',
    name: 'Yatay Çevirme',
    technicalId: 'Flip Horizontal',
    category: 'camera-motion',
    categoryName: 'Kamera & Hareket',
    description: '3D yatay kart ekseninde dönerek açılma',
    icon: 'FlipHorizontal',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
  },
  {
    id: 'flip-vertical',
    name: 'Dikey Çevirme',
    technicalId: 'Flip Vertical',
    category: 'camera-motion',
    categoryName: 'Kamera & Hareket',
    description: '3D dikey kart ekseninde dönerek açılma',
    icon: 'FlipVertical',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
  },

  // ====================================================
  // 5. SİNEMATİK VE DİJİTAL (Cinematic & Digital - 10)
  // ====================================================
  {
    id: 'light-leak',
    name: 'Işık Sızıntısı',
    technicalId: 'Light Leak',
    category: 'cinematic-digital',
    categoryName: 'Sinematik & Dijital',
    description: 'Sıcak analog kamera lens ışık parlaması',
    icon: 'Flame',
    defaultDuration: 1.0,
    minDuration: 0.3,
    maxDuration: 2.5,
  },
  {
    id: 'film-burn',
    name: 'Film Yanığı',
    technicalId: 'Film Burn',
    category: 'cinematic-digital',
    categoryName: 'Sinematik & Dijital',
    description: '35mm makara filmin kenardan alev alması ve yanması',
    icon: 'Film',
    defaultDuration: 1.0,
    minDuration: 0.3,
    maxDuration: 2.5,
  },
  {
    id: 'lens-flare',
    name: 'Lens Parlaması',
    technicalId: 'Lens Flare',
    category: 'cinematic-digital',
    categoryName: 'Sinematik & Dijital',
    description: 'Yatay anamorfi ışık huzmesi ve lens parıltısı',
    icon: 'Sparkles',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
  },
  {
    id: 'glitch',
    name: 'Dijital Glitch',
    technicalId: 'Digital Glitch',
    category: 'cinematic-digital',
    categoryName: 'Sinematik & Dijital',
    description: 'Yatay sinyal paraziti, sıçrama ve veri bozulması',
    icon: 'Zap',
    defaultDuration: 0.6,
    minDuration: 0.2,
    maxDuration: 1.5,
  },
  {
    id: 'rgb-split',
    name: 'RGB Ayrışması',
    technicalId: 'RGB Split',
    category: 'cinematic-digital',
    categoryName: 'Sinematik & Dijital',
    description: 'Kırmızı ve mavi renk kanallarının kaymasıyla siber geçiş',
    icon: 'Split',
    defaultDuration: 0.6,
    minDuration: 0.2,
    maxDuration: 1.5,
  },
  {
    id: 'pixel-dissolve',
    name: 'Piksel Dağılması',
    technicalId: 'Pixel Dissolve',
    category: 'cinematic-digital',
    categoryName: 'Sinematik & Dijital',
    description: 'Retro pikselleşerek mozaik bloklarla çözünme',
    icon: 'Box',
    defaultDuration: 0.9,
    minDuration: 0.3,
    maxDuration: 2.0,
  },
  {
    id: 'vhs-distortion',
    name: 'VHS Paraziti',
    technicalId: 'VHS Distortion',
    category: 'cinematic-digital',
    categoryName: 'Sinematik & Dijital',
    description: 'Manyetik kaset tarama çizgileri ve bant bozulması',
    icon: 'Tv',
    defaultDuration: 0.8,
    minDuration: 0.2,
    maxDuration: 2.0,
  },
  {
    id: 'blur-dissolve',
    name: 'Bulanık Erime',
    technicalId: 'Blur Dissolve',
    category: 'cinematic-digital',
    categoryName: 'Sinematik & Dijital',
    description: 'Optik odak kaybı ve rüya gibi bulanık erime',
    icon: 'EyeOff',
    defaultDuration: 1.0,
    minDuration: 0.3,
    maxDuration: 2.5,
  },
  {
    id: 'prism-dissolve',
    name: 'Prizma Geçişi',
    technicalId: 'Prism Dissolve',
    category: 'cinematic-digital',
    categoryName: 'Sinematik & Dijital',
    description: 'Kromatik ışık kırılması ve prizmatik dağılma',
    icon: 'Compass',
    defaultDuration: 0.9,
    minDuration: 0.3,
    maxDuration: 2.5,
  },
  {
    id: 'flash',
    name: 'Kamera Flaşı',
    technicalId: 'Camera Flash',
    category: 'cinematic-digital',
    categoryName: 'Sinematik & Dijital',
    description: 'Ani 1 karelik parlak stüdyo flaşı patlaması',
    icon: 'Camera',
    defaultDuration: 0.4,
    minDuration: 0.1,
    maxDuration: 1.0,
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
  type: TransitionType,
  isIncoming: boolean,
  options?: { color?: string; feather?: number; direction?: string }
): TransitionState {
  const p = Math.max(0, Math.min(1, progress));

  switch (type) {
    // ----------------------------------------------------
    // 1. TEMEL
    // ----------------------------------------------------
    case 'cut':
      return {
        opacity: isIncoming ? (p >= 0.5 ? 1 : 0) : p < 0.5 ? 1 : 0,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
      };

    case 'crossfade':
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

    case 'dip-color': {
      // Hex to RGB
      const hex = options?.color || '#3b82f6';
      const parsedHex = hex.replace('#', '');
      const r = parseInt(parsedHex.substring(0, 2), 16) || 59;
      const g = parseInt(parsedHex.substring(2, 4), 16) || 130;
      const b = parseInt(parsedHex.substring(4, 6), 16) || 246;

      if (isIncoming) {
        const inP = p <= 0.5 ? 0 : (p - 0.5) * 2;
        return {
          opacity: inP,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          colorOverlay: { r, g, b, a: 1 - inP },
        };
      } else {
        const outP = p <= 0.5 ? 1 - p * 2 : 0;
        return {
          opacity: outP,
          offsetX: 0,
          offsetY: 0,
          scale: 1,
          colorOverlay: { r, g, b, a: 1 - outP },
        };
      }
    }

    case 'additive-dissolve': {
      return {
        opacity: isIncoming ? p : 1 - p * 0.35,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        additive: true,
      };
    }

    case 'soft-dissolve':
    case 'dissolve': {
      // Smoothstep sigmoid curve
      const s = p * p * (3 - 2 * p);
      return {
        opacity: isIncoming ? s : 1 - s,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
      };
    }

    case 'luma-fade': {
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        lumaThreshold: p,
      };
    }

    // ----------------------------------------------------
    // 2. KAYDIRMA VE İTME
    // ----------------------------------------------------
    case 'slide-left':
      return {
        opacity: 1,
        offsetX: isIncoming ? 1 - p : 0,
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
        offsetX: isIncoming ? 1 - p : -p,
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

    case 'split-open-horizontal':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        maskShape: 'split-h',
        wipeRatio: isIncoming ? 1 : p,
      };

    case 'split-open-vertical':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        maskShape: 'split-v',
        wipeRatio: isIncoming ? 1 : p,
      };

    case 'split-close-horizontal':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        maskShape: 'split-h',
        wipeRatio: isIncoming ? 1 - p : 0,
      };

    case 'split-close-vertical':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        maskShape: 'split-v',
        wipeRatio: isIncoming ? 1 - p : 0,
      };

    // ----------------------------------------------------
    // 3. SİLME VE MASKE
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
        feather: options?.feather,
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
        feather: options?.feather,
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
        feather: options?.feather,
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
        feather: options?.feather,
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
        feather: options?.feather,
      };

    case 'circle-reveal':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        maskShape: 'circle-in',
        maskRadius: isIncoming ? p : 1 - p,
        feather: options?.feather,
      };

    case 'iris-in':
    case 'circle-close':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        maskShape: 'circle-out',
        maskRadius: isIncoming ? 1 - p : p,
        feather: options?.feather,
      };

    case 'iris-out':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        maskShape: 'circle-in',
        maskRadius: isIncoming ? Math.min(1, p * 1.3) : Math.max(0, 1 - p * 1.3),
        feather: options?.feather,
      };

    case 'radial-clock-wipe':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        maskShape: 'clock',
        wipeRatio: isIncoming ? p : 1 - p,
      };

    case 'venetian-blinds':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        maskShape: 'blinds',
        wipeRatio: isIncoming ? p : 1 - p,
      };

    case 'checkerboard':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        maskShape: 'checker',
        wipeRatio: isIncoming ? p : 1 - p,
      };

    case 'soft-mask-reveal':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        maskShape: 'soft-circle',
        maskRadius: isIncoming ? p : 1 - p,
        feather: Math.max(20, options?.feather || 35),
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
          scale: 0.35 + p * 0.65,
        };
      } else {
        return {
          opacity: 1 - p,
          offsetX: 0,
          offsetY: 0,
          scale: 1.0 + p * 1.2,
        };
      }
    }

    case 'zoom-out': {
      if (isIncoming) {
        return {
          opacity: p,
          offsetX: 0,
          offsetY: 0,
          scale: 1.8 - p * 0.8,
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

    case 'whip-pan-up': {
      const easeP = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const blurFactor = Math.sin(p * Math.PI) * 35;
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: isIncoming ? 1 - easeP : -easeP,
        scale: 1,
        blur: Math.round(blurFactor),
      };
    }

    case 'whip-pan-down': {
      const easeP = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const blurFactor = Math.sin(p * Math.PI) * 35;
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: isIncoming ? -(1 - easeP) : easeP,
        scale: 1,
        blur: Math.round(blurFactor),
      };
    }

    case 'spin':
    case 'spin-cw': {
      const rot = isIncoming ? (1 - p) * -180 : p * 180;
      const scaleDip = 1 - Math.sin(p * Math.PI) * 0.35;
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: scaleDip,
        rotation: rot,
      };
    }

    case 'spin-ccw': {
      const rot = isIncoming ? (1 - p) * 180 : -p * 180;
      const scaleDip = 1 - Math.sin(p * Math.PI) * 0.35;
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: scaleDip,
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
    // 5. SİNEMATİK VE DİJİTAL
    // ----------------------------------------------------
    case 'light-leak': {
      const leakIntensity = Math.sin(p * Math.PI);
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        lightLeak: {
          intensity: leakIntensity,
          progress: p,
        },
      };
    }

    case 'film-burn': {
      const burnIntensity = Math.sin(p * Math.PI);
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        filmBurn: {
          intensity: burnIntensity,
          progress: p,
        },
      };
    }

    case 'lens-flare': {
      const flareIntensity = Math.sin(p * Math.PI);
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        lensFlare: {
          intensity: flareIntensity,
          progress: p,
        },
      };
    }

    case 'glitch': {
      const glitchIntensity = Math.sin(p * Math.PI);
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: Math.sin(p * 50) * 0.04 * glitchIntensity,
        offsetY: Math.cos(p * 35) * 0.02 * glitchIntensity,
        scale: 1 + glitchIntensity * 0.05,
        glitch: {
          amount: glitchIntensity,
          sliceCount: Math.round(6 + glitchIntensity * 14),
          jitter: glitchIntensity * 32,
        },
      };
    }

    case 'rgb-split': {
      const shift = Math.round(Math.sin(p * Math.PI) * 28);
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: isIncoming ? (1 - p) * 0.08 : -p * 0.08,
        offsetY: 0,
        scale: 1,
        rgbSplit: shift,
      };
    }

    case 'pixel-dissolve': {
      const block = Math.round(Math.sin(p * Math.PI) * 30);
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        pixelate: Math.max(1, block),
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
          trackingJitter: Math.sin(p * 80) * 12 * vhsIntensity,
        },
        rgbSplit: Math.round(vhsIntensity * 10),
      };
    }

    case 'blur-dissolve': {
      const maxBlur = 28;
      const blurAmount = Math.round(Math.sin(p * Math.PI) * maxBlur);
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        blur: blurAmount,
      };
    }

    case 'prism-dissolve': {
      const prismIntensity = Math.sin(p * Math.PI);
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: 1 + prismIntensity * 0.08,
        prism: {
          intensity: prismIntensity,
          shift: Math.round(prismIntensity * 18),
        },
      };
    }

    case 'flash': {
      const flashIntensity = Math.pow(Math.sin(p * Math.PI), 4);
      return {
        opacity: isIncoming ? (p > 0.5 ? 1 : 0) : p <= 0.5 ? 1 : 0,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        flash: { intensity: flashIntensity },
        colorOverlay: { r: 255, g: 255, b: 255, a: flashIntensity },
      };
    }

    default:
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
      };
  }
}

// Cached internal surfaces for default A/B previews
let cachedSurfaceA: HTMLCanvasElement | null = null;
let cachedSurfaceB: HTMLCanvasElement | null = null;

function getOrCreateABSurfaces(width: number, height: number): [HTMLCanvasElement, HTMLCanvasElement] {
  if (
    !cachedSurfaceA ||
    !cachedSurfaceB ||
    cachedSurfaceA.width !== width ||
    cachedSurfaceA.height !== height
  ) {
    // Surface A: Deep Slate Blue with Bold 'A'
    cachedSurfaceA = document.createElement('canvas');
    cachedSurfaceA.width = width;
    cachedSurfaceA.height = height;
    const ctxA = cachedSurfaceA.getContext('2d')!;
    const gradA = ctxA.createLinearGradient(0, 0, width, height);
    gradA.addColorStop(0, '#1e293b');
    gradA.addColorStop(1, '#0f172a');
    ctxA.fillStyle = gradA;
    ctxA.fillRect(0, 0, width, height);
    // Subtle grid lines
    ctxA.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctxA.lineWidth = 1;
    for (let x = 0; x < width; x += 20) {
      ctxA.beginPath();
      ctxA.moveTo(x, 0);
      ctxA.lineTo(x, height);
      ctxA.stroke();
    }
    // Letter A
    ctxA.fillStyle = '#60a5fa';
    ctxA.font = `bold ${Math.round(height * 0.42)}px sans-serif`;
    ctxA.textAlign = 'center';
    ctxA.textBaseline = 'middle';
    ctxA.fillText('A', width / 2, height / 2);

    // Surface B: Warm Orange/Amber with Bold 'B'
    cachedSurfaceB = document.createElement('canvas');
    cachedSurfaceB.width = width;
    cachedSurfaceB.height = height;
    const ctxB = cachedSurfaceB.getContext('2d')!;
    const gradB = ctxB.createLinearGradient(0, 0, width, height);
    gradB.addColorStop(0, '#c2410c');
    gradB.addColorStop(1, '#7c2d12');
    ctxB.fillStyle = gradB;
    ctxB.fillRect(0, 0, width, height);
    // Subtle grid lines
    ctxB.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctxB.lineWidth = 1;
    for (let y = 0; y < height; y += 20) {
      ctxB.beginPath();
      ctxB.moveTo(0, y);
      ctxB.lineTo(width, y);
      ctxB.stroke();
    }
    // Letter B
    ctxB.fillStyle = '#fde047';
    ctxB.font = `bold ${Math.round(height * 0.42)}px sans-serif`;
    ctxB.textAlign = 'center';
    ctxB.textBaseline = 'middle';
    ctxB.fillText('B', width / 2, height / 2);
  }
  return [cachedSurfaceA, cachedSurfaceB];
}

/**
 * Unified Canvas Renderer for all 52 Transitions.
 * Renders the transition at progress (0.0 to 1.0) between surfaceA and surfaceB
 * onto targetCtx. Used identically by card thumbnails, main canvas, and export.
 */
export function renderTransitionAB(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  type: TransitionType,
  progress: number,
  surfaceA?: CanvasImageSource,
  surfaceB?: CanvasImageSource,
  options?: { color?: string; feather?: number; direction?: string }
): void {
  const p = Math.max(0, Math.min(1, progress));
  let surfA = surfaceA;
  let surfB = surfaceB;

  if (!surfA || !surfB) {
    const [defA, defB] = getOrCreateABSurfaces(width, height);
    if (!surfA) surfA = defA;
    if (!surfB) surfB = defB;
  }

  ctx.save();

  // Helper to draw full surface
  const drawSurface = (s: CanvasImageSource, alpha = 1, x = 0, y = 0, scale = 1, rot = 0) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    if (x !== 0 || y !== 0 || scale !== 1 || rot !== 0) {
      ctx.translate(width / 2 + x, height / 2 + y);
      if (rot !== 0) ctx.rotate((rot * Math.PI) / 180);
      if (scale !== 1) ctx.scale(scale, scale);
      ctx.drawImage(s, -width / 2, -height / 2, width, height);
    } else {
      ctx.drawImage(s, 0, 0, width, height);
    }
    ctx.restore();
  };

  // Switch by category & type
  switch (type) {
    case 'cut': {
      if (p < 0.5) drawSurface(surfA, 1);
      else drawSurface(surfB, 1);
      break;
    }

    case 'crossfade': {
      drawSurface(surfA, 1);
      drawSurface(surfB, p);
      break;
    }

    case 'fade-black': {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, width, height);
      if (p <= 0.5) {
        drawSurface(surfA, 1 - p * 2);
      } else {
        drawSurface(surfB, (p - 0.5) * 2);
      }
      break;
    }

    case 'fade-white': {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);
      if (p <= 0.5) {
        drawSurface(surfA, 1 - p * 2);
      } else {
        drawSurface(surfB, (p - 0.5) * 2);
      }
      break;
    }

    case 'dip-color': {
      ctx.fillStyle = options?.color || '#3b82f6';
      ctx.fillRect(0, 0, width, height);
      if (p <= 0.5) {
        drawSurface(surfA, 1 - p * 2);
      } else {
        drawSurface(surfB, (p - 0.5) * 2);
      }
      break;
    }

    case 'additive-dissolve': {
      drawSurface(surfA, 1 - p * 0.35);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawSurface(surfB, p);
      ctx.restore();
      break;
    }

    case 'soft-dissolve':
    case 'dissolve': {
      const s = p * p * (3 - 2 * p);
      drawSurface(surfA, 1);
      drawSurface(surfB, s);
      break;
    }

    case 'luma-fade': {
      drawSurface(surfA, 1);
      ctx.save();
      // Mask B based on luma ramp
      ctx.beginPath();
      ctx.rect(0, 0, width * p, height);
      ctx.clip();
      drawSurface(surfB, 1);
      ctx.restore();
      break;
    }

    // SLIDE & PUSH
    case 'slide-left': {
      drawSurface(surfA, 1);
      drawSurface(surfB, 1, (1 - p) * width, 0);
      break;
    }

    case 'slide-right': {
      drawSurface(surfA, 1);
      drawSurface(surfB, 1, -(1 - p) * width, 0);
      break;
    }

    case 'slide-up': {
      drawSurface(surfA, 1);
      drawSurface(surfB, 1, 0, (1 - p) * height);
      break;
    }

    case 'slide-down': {
      drawSurface(surfA, 1);
      drawSurface(surfB, 1, 0, -(1 - p) * height);
      break;
    }

    case 'push-left': {
      drawSurface(surfA, 1, -p * width, 0);
      drawSurface(surfB, 1, (1 - p) * width, 0);
      break;
    }

    case 'push-right': {
      drawSurface(surfA, 1, p * width, 0);
      drawSurface(surfB, 1, -(1 - p) * width, 0);
      break;
    }

    case 'push-up': {
      drawSurface(surfA, 1, 0, -p * height);
      drawSurface(surfB, 1, 0, (1 - p) * height);
      break;
    }

    case 'push-down': {
      drawSurface(surfA, 1, 0, p * height);
      drawSurface(surfB, 1, 0, -(1 - p) * height);
      break;
    }

    case 'split-open-horizontal': {
      drawSurface(surfB, 1);
      const splitX = p * (width / 2);
      // Left half of A moving left
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width / 2 - splitX, height);
      ctx.clip();
      drawSurface(surfA, 1, -splitX, 0);
      ctx.restore();
      // Right half of A moving right
      ctx.save();
      ctx.beginPath();
      ctx.rect(width / 2 + splitX, 0, width / 2, height);
      ctx.clip();
      drawSurface(surfA, 1, splitX, 0);
      ctx.restore();
      break;
    }

    case 'split-open-vertical': {
      drawSurface(surfB, 1);
      const splitY = p * (height / 2);
      // Top half of A moving up
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, height / 2 - splitY);
      ctx.clip();
      drawSurface(surfA, 1, 0, -splitY);
      ctx.restore();
      // Bottom half of A moving down
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, height / 2 + splitY, width, height / 2);
      ctx.clip();
      drawSurface(surfA, 1, 0, splitY);
      ctx.restore();
      break;
    }

    case 'split-close-horizontal': {
      drawSurface(surfA, 1);
      const shiftX = (1 - p) * (width / 2);
      // Left half of B entering from left
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width / 2, height);
      ctx.clip();
      drawSurface(surfB, 1, -shiftX, 0);
      ctx.restore();
      // Right half of B entering from right
      ctx.save();
      ctx.beginPath();
      ctx.rect(width / 2, 0, width / 2, height);
      ctx.clip();
      drawSurface(surfB, 1, shiftX, 0);
      ctx.restore();
      break;
    }

    case 'split-close-vertical': {
      drawSurface(surfA, 1);
      const shiftY = (1 - p) * (height / 2);
      // Top half of B entering from top
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, height / 2);
      ctx.clip();
      drawSurface(surfB, 1, 0, -shiftY);
      ctx.restore();
      // Bottom half of B entering from bottom
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, height / 2, width, height / 2);
      ctx.clip();
      drawSurface(surfB, 1, 0, shiftY);
      ctx.restore();
      break;
    }

    // WIPES & MASKS
    case 'wipe-left': {
      drawSurface(surfA, 1);
      ctx.save();
      ctx.beginPath();
      ctx.rect(width * (1 - p), 0, width * p, height);
      ctx.clip();
      drawSurface(surfB, 1);
      ctx.restore();
      break;
    }

    case 'wipe-right': {
      drawSurface(surfA, 1);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width * p, height);
      ctx.clip();
      drawSurface(surfB, 1);
      ctx.restore();
      break;
    }

    case 'wipe-up': {
      drawSurface(surfA, 1);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, height * (1 - p), width, height * p);
      ctx.clip();
      drawSurface(surfB, 1);
      ctx.restore();
      break;
    }

    case 'wipe-down': {
      drawSurface(surfA, 1);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, height * p);
      ctx.clip();
      drawSurface(surfB, 1);
      ctx.restore();
      break;
    }

    case 'diagonal-wipe': {
      drawSurface(surfA, 1);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(width * p * 2, 0);
      ctx.lineTo(0, height * p * 2);
      ctx.closePath();
      ctx.clip();
      drawSurface(surfB, 1);
      ctx.restore();
      break;
    }

    case 'circle-reveal': {
      drawSurface(surfA, 1);
      ctx.save();
      const maxR = Math.hypot(width, height) / 2;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, maxR * p, 0, Math.PI * 2);
      ctx.clip();
      drawSurface(surfB, 1);
      ctx.restore();
      break;
    }

    case 'iris-in':
    case 'circle-close': {
      drawSurface(surfB, 1);
      ctx.save();
      const maxR = Math.hypot(width, height) / 2;
      ctx.beginPath();
      ctx.arc(width / 2, height / 2, Math.max(0.1, maxR * (1 - p)), 0, Math.PI * 2);
      ctx.clip();
      drawSurface(surfA, 1);
      ctx.restore();
      break;
    }

    case 'iris-out': {
      drawSurface(surfA, 1);
      ctx.save();
      const sz = Math.hypot(width, height) * p;
      ctx.beginPath();
      ctx.moveTo(width / 2, height / 2 - sz / 2);
      ctx.lineTo(width / 2 + sz / 2, height / 2);
      ctx.lineTo(width / 2, height / 2 + sz / 2);
      ctx.lineTo(width / 2 - sz / 2, height / 2);
      ctx.closePath();
      ctx.clip();
      drawSurface(surfB, 1);
      ctx.restore();
      break;
    }

    case 'radial-clock-wipe': {
      drawSurface(surfA, 1);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(width / 2, height / 2);
      ctx.arc(
        width / 2,
        height / 2,
        Math.hypot(width, height),
        -Math.PI / 2,
        -Math.PI / 2 + p * 2 * Math.PI
      );
      ctx.closePath();
      ctx.clip();
      drawSurface(surfB, 1);
      ctx.restore();
      break;
    }

    case 'venetian-blinds': {
      drawSurface(surfA, 1);
      const slatCount = 8;
      const slatH = height / slatCount;
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < slatCount; i++) {
        ctx.rect(0, i * slatH, width, slatH * p);
      }
      ctx.clip();
      drawSurface(surfB, 1);
      ctx.restore();
      break;
    }

    case 'checkerboard': {
      drawSurface(surfA, 1);
      const cols = 8;
      const rows = 5;
      const cw = width / cols;
      const ch = height / rows;
      ctx.save();
      ctx.beginPath();
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const threshold = (r + c) / (rows + cols);
          if (p >= threshold * 0.7) {
            ctx.rect(c * cw, r * ch, cw, ch);
          }
        }
      }
      ctx.clip();
      drawSurface(surfB, 1);
      ctx.restore();
      break;
    }

    case 'soft-mask-reveal': {
      drawSurface(surfA, 1);
      drawSurface(surfB, p);
      break;
    }

    // CAMERA & MOTION
    case 'zoom-in': {
      drawSurface(surfA, 1 - p, 0, 0, 1.0 + p * 1.2);
      drawSurface(surfB, p, 0, 0, 0.4 + p * 0.6);
      break;
    }

    case 'zoom-out': {
      drawSurface(surfA, 1 - p, 0, 0, 1.0 - p * 0.5);
      drawSurface(surfB, p, 0, 0, 1.8 - p * 0.8);
      break;
    }

    case 'whip-pan-left': {
      const easeP = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const blurPx = Math.round(Math.sin(p * Math.PI) * 16);
      ctx.save();
      if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;
      drawSurface(surfA, 1, -easeP * width, 0);
      drawSurface(surfB, 1, (1 - easeP) * width, 0);
      ctx.restore();
      break;
    }

    case 'whip-pan-right': {
      const easeP = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const blurPx = Math.round(Math.sin(p * Math.PI) * 16);
      ctx.save();
      if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;
      drawSurface(surfA, 1, easeP * width, 0);
      drawSurface(surfB, 1, -(1 - easeP) * width, 0);
      ctx.restore();
      break;
    }

    case 'whip-pan-up': {
      const easeP = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const blurPx = Math.round(Math.sin(p * Math.PI) * 16);
      ctx.save();
      if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;
      drawSurface(surfA, 1, 0, -easeP * height);
      drawSurface(surfB, 1, 0, (1 - easeP) * height);
      ctx.restore();
      break;
    }

    case 'whip-pan-down': {
      const easeP = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const blurPx = Math.round(Math.sin(p * Math.PI) * 16);
      ctx.save();
      if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;
      drawSurface(surfA, 1, 0, easeP * height);
      drawSurface(surfB, 1, 0, -(1 - easeP) * height);
      ctx.restore();
      break;
    }

    case 'spin':
    case 'spin-cw': {
      const scaleDip = 1 - Math.sin(p * Math.PI) * 0.35;
      if (p < 0.5) {
        drawSurface(surfA, 1 - p * 2, 0, 0, scaleDip, p * 180);
      } else {
        drawSurface(surfB, (p - 0.5) * 2, 0, 0, scaleDip, (p - 1) * 180);
      }
      break;
    }

    case 'spin-ccw': {
      const scaleDip = 1 - Math.sin(p * Math.PI) * 0.35;
      if (p < 0.5) {
        drawSurface(surfA, 1 - p * 2, 0, 0, scaleDip, -p * 180);
      } else {
        drawSurface(surfB, (p - 0.5) * 2, 0, 0, scaleDip, -(p - 1) * 180);
      }
      break;
    }

    case 'flip-horizontal': {
      if (p <= 0.5) {
        const sX = 1 - p * 2;
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(sX, 1);
        ctx.drawImage(surfA, -width / 2, -height / 2, width, height);
        ctx.restore();
      } else {
        const sX = (p - 0.5) * 2;
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(sX, 1);
        ctx.drawImage(surfB, -width / 2, -height / 2, width, height);
        ctx.restore();
      }
      break;
    }

    case 'flip-vertical': {
      if (p <= 0.5) {
        const sY = 1 - p * 2;
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(1, sY);
        ctx.drawImage(surfA, -width / 2, -height / 2, width, height);
        ctx.restore();
      } else {
        const sY = (p - 0.5) * 2;
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(1, sY);
        ctx.drawImage(surfB, -width / 2, -height / 2, width, height);
        ctx.restore();
      }
      break;
    }

    // CINEMATIC & DIGITAL
    case 'light-leak': {
      drawSurface(surfA, 1);
      drawSurface(surfB, p);
      const intensity = Math.sin(p * Math.PI);
      if (intensity > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const grad = ctx.createRadialGradient(
          width * p,
          height * 0.3,
          10,
          width * p,
          height * 0.3,
          width * 0.8
        );
        grad.addColorStop(0, `rgba(254, 215, 170, ${intensity * 0.9})`);
        grad.addColorStop(0.4, `rgba(249, 115, 22, ${intensity * 0.6})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
      break;
    }

    case 'film-burn': {
      drawSurface(surfA, 1);
      drawSurface(surfB, p);
      const intensity = Math.sin(p * Math.PI);
      if (intensity > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, `rgba(255, 255, 255, ${intensity * 0.9})`);
        grad.addColorStop(0.3, `rgba(234, 88, 12, ${intensity * 0.7})`);
        grad.addColorStop(0.7, `rgba(220, 38, 38, ${intensity * 0.5})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
      break;
    }

    case 'lens-flare': {
      drawSurface(surfA, 1);
      drawSurface(surfB, p);
      const intensity = Math.sin(p * Math.PI);
      if (intensity > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // Horizontal streak
        ctx.fillStyle = `rgba(56, 189, 248, ${intensity * 0.8})`;
        ctx.fillRect(0, height * 0.48, width, height * 0.04);
        // Center disc
        const rad = ctx.createRadialGradient(
          width * p,
          height / 2,
          5,
          width * p,
          height / 2,
          height * 0.5
        );
        rad.addColorStop(0, `rgba(255, 255, 255, ${intensity})`);
        rad.addColorStop(0.5, `rgba(14, 165, 233, ${intensity * 0.4})`);
        rad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rad;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
      break;
    }

    case 'glitch': {
      drawSurface(surfA, 1 - p);
      drawSurface(surfB, p);
      const intensity = Math.sin(p * Math.PI);
      if (intensity > 0.1) {
        ctx.save();
        const jitter = Math.sin(p * 50) * 15 * intensity;
        ctx.fillStyle = 'rgba(0, 255, 255, 0.4)';
        ctx.fillRect(0, height * 0.25, width + jitter, height * 0.12);
        ctx.fillStyle = 'rgba(255, 0, 128, 0.4)';
        ctx.fillRect(jitter, height * 0.55, width - jitter, height * 0.1);
        ctx.restore();
      }
      break;
    }

    case 'rgb-split': {
      const shift = Math.round(Math.sin(p * Math.PI) * 18);
      drawSurface(surfA, 1 - p, -shift, 0);
      drawSurface(surfB, p, shift, 0);
      break;
    }

    case 'pixel-dissolve': {
      drawSurface(surfA, 1);
      drawSurface(surfB, p);
      break;
    }

    case 'vhs-distortion': {
      drawSurface(surfA, 1 - p);
      drawSurface(surfB, p);
      const intensity = Math.sin(p * Math.PI);
      if (intensity > 0.05) {
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        for (let y = 0; y < height; y += 4) {
          ctx.fillRect(0, y, width, 1.5);
        }
        ctx.restore();
      }
      break;
    }

    case 'blur-dissolve': {
      const blurPx = Math.round(Math.sin(p * Math.PI) * 18);
      ctx.save();
      if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;
      drawSurface(surfA, 1);
      drawSurface(surfB, p);
      ctx.restore();
      break;
    }

    case 'prism-dissolve': {
      const shift = Math.round(Math.sin(p * Math.PI) * 14);
      drawSurface(surfA, 1 - p);
      ctx.save();
      ctx.globalAlpha = p * 0.6;
      drawSurface(surfB, 1, -shift, 0);
      drawSurface(surfB, 1, shift, 0);
      ctx.restore();
      drawSurface(surfB, p);
      break;
    }

    case 'flash': {
      const flashIntensity = Math.pow(Math.sin(p * Math.PI), 4);
      if (p < 0.5) drawSurface(surfA, 1);
      else drawSurface(surfB, 1);
      if (flashIntensity > 0.05) {
        ctx.fillStyle = `rgba(255, 255, 255, ${flashIntensity})`;
        ctx.fillRect(0, 0, width, height);
      }
      break;
    }

    default: {
      drawSurface(surfA, 1 - p);
      drawSurface(surfB, p);
      break;
    }
  }

  ctx.restore();
}

/**
 * FORMA Video Editor — Professional 100 Transition Engine
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
  {
    "id": "cut",
    "name": "Sert Kesim",
    "technicalId": "Hard Cut",
    "category": "basic",
    "categoryName": "Temel",
    "description": "Anlık kesintisiz doğrudan geçiş",
    "icon": "Scissors",
    "defaultDuration": 0.1,
    "minDuration": 0.05,
    "maxDuration": 0.5
  },
  {
    "id": "crossfade",
    "name": "Çapraz Geçiş",
    "technicalId": "Crossfade",
    "category": "basic",
    "categoryName": "Temel",
    "description": "İki klip arasında pürüzsüz doğrusal erime",
    "icon": "Blend",
    "defaultDuration": 1,
    "minDuration": 0.2,
    "maxDuration": 3,
    "defaultEasing": "linear"
  },
  {
    "id": "fade-black",
    "name": "Siyaha Kararma",
    "technicalId": "Dip to Black",
    "category": "basic",
    "categoryName": "Temel",
    "description": "Siyaha kararıp yeni klibe açılma",
    "icon": "Moon",
    "defaultDuration": 0.8,
    "minDuration": 0.3,
    "maxDuration": 3
  },
  {
    "id": "fade-white",
    "name": "Beyaza Parlama",
    "technicalId": "Dip to White",
    "category": "basic",
    "categoryName": "Temel",
    "description": "Bembeyaz ışıkla parlayıp yeni klibe geçiş",
    "icon": "Sun",
    "defaultDuration": 0.6,
    "minDuration": 0.2,
    "maxDuration": 2
  },
  {
    "id": "dip-color",
    "name": "Renge Kararma",
    "technicalId": "Dip to Color",
    "category": "basic",
    "categoryName": "Temel",
    "description": "Seçilen özel renge eriyip açılma",
    "icon": "Palette",
    "defaultDuration": 0.8,
    "minDuration": 0.3,
    "maxDuration": 2.5,
    "supportsColor": true
  },
  {
    "id": "additive-dissolve",
    "name": "Eklemeli Parlama",
    "technicalId": "Additive Dissolve",
    "category": "basic",
    "categoryName": "Temel",
    "description": "İki klibin ışık değerlerini üst üste toplayarak parlayan geçiş",
    "icon": "Sparkles",
    "defaultDuration": 0.8,
    "minDuration": 0.2,
    "maxDuration": 2
  },
  {
    "id": "soft-dissolve",
    "name": "Yumuşak Erime",
    "technicalId": "Soft Dissolve",
    "category": "basic",
    "categoryName": "Temel",
    "description": "Filmik kontrast korumalı yumuşak geçiş",
    "icon": "Layers",
    "defaultDuration": 1,
    "minDuration": 0.3,
    "maxDuration": 3
  },
  {
    "id": "luma-fade",
    "name": "Luma Geçişi",
    "technicalId": "Luma Fade",
    "category": "basic",
    "categoryName": "Temel",
    "description": "Piksellerin parlaklık eşiğine göre kademeli erime",
    "icon": "SunDim",
    "defaultDuration": 0.9,
    "minDuration": 0.3,
    "maxDuration": 2.5
  },
  {
    "id": "camera-shutter",
    "name": "Kamera Deklanşörü",
    "technicalId": "Camera Shutter",
    "category": "basic",
    "categoryName": "Temel",
    "description": "Hızlı mekanik fotoğraf makinesi deklanşör kararması",
    "icon": "Camera",
    "defaultDuration": 0.3,
    "minDuration": 0.1,
    "maxDuration": 0.8
  },
  {
    "id": "strobe-cut",
    "name": "Strobe Çift Flaş",
    "technicalId": "Strobe Cut",
    "category": "basic",
    "categoryName": "Temel",
    "description": "Ritimli 2 karelik hızlı kesme ve flaş efekti",
    "icon": "Zap",
    "defaultDuration": 0.35,
    "minDuration": 0.15,
    "maxDuration": 0.8
  },
  {
    "id": "non-additive-dissolve",
    "name": "Doygunluk Korumalı Erime",
    "technicalId": "Non-Additive Dissolve",
    "category": "basic",
    "categoryName": "Temel",
    "description": "Luminans kaybı olmadan en parlak pikselleri koruyan erime",
    "icon": "Sliders",
    "defaultDuration": 0.9,
    "minDuration": 0.3,
    "maxDuration": 2.5
  },
  {
    "id": "optical-dissolve",
    "name": "Optik Mercek Erimesi",
    "technicalId": "Optical Dissolve",
    "category": "basic",
    "categoryName": "Temel",
    "description": "Merkezden dışa yayılan ışıma ve yumuşak pozlama erimesi",
    "icon": "Aperture",
    "defaultDuration": 1,
    "minDuration": 0.3,
    "maxDuration": 2.5
  },
  {
    "id": "slide-left",
    "name": "Sola Kayma",
    "technicalId": "Slide Left",
    "category": "slide-push",
    "categoryName": "Kaydırma & İtme",
    "description": "Yeni klip soldan mevcut klibin üzerine kayarak biner",
    "icon": "MoveLeft",
    "defaultDuration": 0.7,
    "minDuration": 0.2,
    "maxDuration": 2
  },
  {
    "id": "slide-right",
    "name": "Sağa Kayma",
    "technicalId": "Slide Right",
    "category": "slide-push",
    "categoryName": "Kaydırma & İtme",
    "description": "Yeni klip sağdan mevcut klibin üzerine kayarak biner",
    "icon": "MoveRight",
    "defaultDuration": 0.7,
    "minDuration": 0.2,
    "maxDuration": 2
  },
  {
    "id": "slide-up",
    "name": "Yukarı Kayma",
    "technicalId": "Slide Up",
    "category": "slide-push",
    "categoryName": "Kaydırma & İtme",
    "description": "Yeni klip aşağıdan yukarı kayarak sahneyi kaplar",
    "icon": "MoveUp",
    "defaultDuration": 0.7,
    "minDuration": 0.2,
    "maxDuration": 2
  },
  {
    "id": "slide-down",
    "name": "Aşağı Kayma",
    "technicalId": "Slide Down",
    "category": "slide-push",
    "categoryName": "Kaydırma & İtme",
    "description": "Yeni klip yukarıdan aşağı kayarak sahneyi kaplar",
    "icon": "MoveDown",
    "defaultDuration": 0.7,
    "minDuration": 0.2,
    "maxDuration": 2
  },
  {
    "id": "push-left",
    "name": "Sola İt",
    "technicalId": "Push Left",
    "category": "slide-push",
    "categoryName": "Kaydırma & İtme",
    "description": "Yeni klip eski klibi sola iterek ekrandan çıkarır",
    "icon": "ChevronsLeft",
    "defaultDuration": 0.8,
    "minDuration": 0.2,
    "maxDuration": 2
  },
  {
    "id": "push-right",
    "name": "Sağa İt",
    "technicalId": "Push Right",
    "category": "slide-push",
    "categoryName": "Kaydırma & İtme",
    "description": "Yeni klip eski klibi sağa iterek ekrandan çıkarır",
    "icon": "ChevronsRight",
    "defaultDuration": 0.8,
    "minDuration": 0.2,
    "maxDuration": 2
  },
  {
    "id": "push-up",
    "name": "Yukarı İt",
    "technicalId": "Push Up",
    "category": "slide-push",
    "categoryName": "Kaydırma & İtme",
    "description": "Yeni klip eski klibi yukarı iterek ekrandan çıkarır",
    "icon": "ChevronsUp",
    "defaultDuration": 0.8,
    "minDuration": 0.2,
    "maxDuration": 2
  },
  {
    "id": "push-down",
    "name": "Aşağı İt",
    "technicalId": "Push Down",
    "category": "slide-push",
    "categoryName": "Kaydırma & İtme",
    "description": "Yeni klip eski klibi aşağı iterek ekrandan çıkarır",
    "icon": "ChevronsDown",
    "defaultDuration": 0.8,
    "minDuration": 0.2,
    "maxDuration": 2
  },
  {
    "id": "push-diagonal-tl",
    "name": "Çapraz Sol-Üst İtme",
    "technicalId": "Push Diagonal Top-Left",
    "category": "slide-push",
    "categoryName": "Kaydırma & İtme",
    "description": "Çapraz açıyla sol üst köşeye doğru iterek geçiş",
    "icon": "ArrowUpLeft",
    "defaultDuration": 0.8,
    "minDuration": 0.2,
    "maxDuration": 2
  },
  {
    "id": "push-diagonal-tr",
    "name": "Çapraz Sağ-Üst İtme",
    "technicalId": "Push Diagonal Top-Right",
    "category": "slide-push",
    "categoryName": "Kaydırma & İtme",
    "description": "Çapraz açıyla sağ üst köşeye doğru iterek geçiş",
    "icon": "ArrowUpRight",
    "defaultDuration": 0.8,
    "minDuration": 0.2,
    "maxDuration": 2
  },
  {
    "id": "push-diagonal-bl",
    "name": "Çapraz Sol-Alt İtme",
    "technicalId": "Push Diagonal Bottom-Left",
    "category": "slide-push",
    "categoryName": "Kaydırma & İtme",
    "description": "Çapraz açıyla sol alt köşeye doğru iterek geçiş",
    "icon": "ArrowDownLeft",
    "defaultDuration": 0.8,
    "minDuration": 0.2,
    "maxDuration": 2
  },
  {
    "id": "push-diagonal-br",
    "name": "Çapraz Sağ-Alt İtme",
    "technicalId": "Push Diagonal Bottom-Right",
    "category": "slide-push",
    "categoryName": "Kaydırma & İtme",
    "description": "Çapraz açıyla sağ alt köşeye doğru iterek geçiş",
    "icon": "ArrowDownRight",
    "defaultDuration": 0.8,
    "minDuration": 0.2,
    "maxDuration": 2
  },
  {
    "id": "split-open-horizontal",
    "name": "Yatay Bölerek Aç",
    "technicalId": "Split Open Horizontal",
    "category": "slide-push",
    "categoryName": "Kaydırma & İtme",
    "description": "Mevcut klip ortadan iki yana ayrılarak yeni klibi gösterir",
    "icon": "Columns2",
    "defaultDuration": 0.9,
    "minDuration": 0.3,
    "maxDuration": 2.5
  },
  {
    "id": "split-open-vertical",
    "name": "Dikey Bölerek Aç",
    "technicalId": "Split Open Vertical",
    "category": "slide-push",
    "categoryName": "Kaydırma & İtme",
    "description": "Mevcut klip ortadan yukarı ve aşağı açılarak yeni klibi gösterir",
    "icon": "Rows2",
    "defaultDuration": 0.9,
    "minDuration": 0.3,
    "maxDuration": 2.5
  },
  {
    "id": "split-close-horizontal",
    "name": "Yatay Kapanış",
    "technicalId": "Split Close Horizontal",
    "category": "slide-push",
    "categoryName": "Kaydırma & İtme",
    "description": "Yeni klip sağ ve soldan merkeze doğru birleşerek kapanır",
    "icon": "Minimize2",
    "defaultDuration": 0.9,
    "minDuration": 0.3,
    "maxDuration": 2.5
  },
  {
    "id": "split-close-vertical",
    "name": "Dikey Kapanış",
    "technicalId": "Split Close Vertical",
    "category": "slide-push",
    "categoryName": "Kaydırma & İtme",
    "description": "Yeni klip üstten ve alttan merkeze doğru birleşerek kapanır",
    "icon": "Minimize2",
    "defaultDuration": 0.9,
    "minDuration": 0.3,
    "maxDuration": 2.5
  },
  {
    "id": "split-four-corners",
    "name": "Dört Köşeye Açılma",
    "technicalId": "Split Four Corners",
    "category": "slide-push",
    "categoryName": "Kaydırma & İtme",
    "description": "Dört kadrana ayrılarak köşelere doğru açılan geçiş",
    "icon": "Grid",
    "defaultDuration": 0.9,
    "minDuration": 0.3,
    "maxDuration": 2.5
  },
  {
    "id": "split-four-pinch",
    "name": "Dört Köşeden Kapanma",
    "technicalId": "Split Four Pinch",
    "category": "slide-push",
    "categoryName": "Kaydırma & İtme",
    "description": "Dört köşeden merkeze doğru birleşen kapanış geçişi",
    "icon": "Maximize2",
    "defaultDuration": 0.9,
    "minDuration": 0.3,
    "maxDuration": 2.5
  },
  {
    "id": "band-slide-horizontal",
    "name": "Çift Bant Karşıt Kayma",
    "technicalId": "Band Slide Horizontal",
    "category": "slide-push",
    "categoryName": "Kaydırma & İtme",
    "description": "Yatay şeritlerin birbirine zıt yönlerde kayarak sahneyi değiştirmesi",
    "icon": "AlignJustify",
    "defaultDuration": 0.85,
    "minDuration": 0.3,
    "maxDuration": 2
  },
  {
    "id": "band-slide-vertical",
    "name": "Çift Bant Dikey Kayma",
    "technicalId": "Band Slide Vertical",
    "category": "slide-push",
    "categoryName": "Kaydırma & İtme",
    "description": "Dikey şeritlerin zıt yönlerde yukarı ve aşağı kayması",
    "icon": "Columns3",
    "defaultDuration": 0.85,
    "minDuration": 0.3,
    "maxDuration": 2
  },
  {
    "id": "multi-slice-push-h",
    "name": "4 Şeritli Yatay İtme",
    "technicalId": "Multi Slice Push H",
    "category": "slide-push",
    "categoryName": "Kaydırma & İtme",
    "description": "Kademeli gecikmeyle sırayla itilen 4 yatay dilim",
    "icon": "ListFilter",
    "defaultDuration": 0.8,
    "minDuration": 0.3,
    "maxDuration": 2
  },
  {
    "id": "multi-slice-push-v",
    "name": "4 Şeritli Dikey İtme",
    "technicalId": "Multi Slice Push V",
    "category": "slide-push",
    "categoryName": "Kaydırma & İtme",
    "description": "Kademeli gecikmeyle sırayla itilen 4 dikey dilim",
    "icon": "BarChart2",
    "defaultDuration": 0.8,
    "minDuration": 0.3,
    "maxDuration": 2
  },
  {
    "id": "elastic-push-left",
    "name": "Elastik Sola İtme",
    "technicalId": "Elastic Push Left",
    "category": "slide-push",
    "categoryName": "Kaydırma & İtme",
    "description": "Yaylanma vuruşuyla sola elastik itme",
    "icon": "ChevronsLeft",
    "defaultDuration": 0.75,
    "minDuration": 0.25,
    "maxDuration": 2
  },
  {
    "id": "elastic-push-right",
    "name": "Elastik Sağa İtme",
    "technicalId": "Elastic Push Right",
    "category": "slide-push",
    "categoryName": "Kaydırma & İtme",
    "description": "Yaylanma vuruşuyla sağa elastik itme",
    "icon": "ChevronsRight",
    "defaultDuration": 0.75,
    "minDuration": 0.25,
    "maxDuration": 2
  },
  {
    "id": "wipe-left",
    "name": "Sola Silme",
    "technicalId": "Wipe Left",
    "category": "wipe-mask",
    "categoryName": "Silme & Maske",
    "description": "Doğrusal maske sağdan sola doğru silerek açar",
    "icon": "ArrowLeft",
    "defaultDuration": 0.8,
    "minDuration": 0.2,
    "maxDuration": 2
  },
  {
    "id": "wipe-right",
    "name": "Sağa Silme",
    "technicalId": "Wipe Right",
    "category": "wipe-mask",
    "categoryName": "Silme & Maske",
    "description": "Doğrusal maske soldan sağa doğru silerek açar",
    "icon": "ArrowRight",
    "defaultDuration": 0.8,
    "minDuration": 0.2,
    "maxDuration": 2
  },
  {
    "id": "wipe-up",
    "name": "Yukarı Silme",
    "technicalId": "Wipe Up",
    "category": "wipe-mask",
    "categoryName": "Silme & Maske",
    "description": "Doğrusal maske alttan yukarı doğru silerek açar",
    "icon": "ArrowUp",
    "defaultDuration": 0.8,
    "minDuration": 0.2,
    "maxDuration": 2
  },
  {
    "id": "wipe-down",
    "name": "Aşağı Silme",
    "technicalId": "Wipe Down",
    "category": "wipe-mask",
    "categoryName": "Silme & Maske",
    "description": "Doğrusal maske üstten aşağı doğru silerek açar",
    "icon": "ArrowDown",
    "defaultDuration": 0.8,
    "minDuration": 0.2,
    "maxDuration": 2
  },
  {
    "id": "diagonal-wipe",
    "name": "Çapraz Silme",
    "technicalId": "Diagonal Wipe",
    "category": "wipe-mask",
    "categoryName": "Silme & Maske",
    "description": "Sol üstten sağ alta doğru 45 derece çapraz silme",
    "icon": "ArrowDownRight",
    "defaultDuration": 1,
    "minDuration": 0.3,
    "maxDuration": 2.5
  },
  {
    "id": "diagonal-wipe-reverse",
    "name": "Ters Çapraz Silme",
    "technicalId": "Diagonal Wipe Reverse",
    "category": "wipe-mask",
    "categoryName": "Silme & Maske",
    "description": "Sağ üstten sol alta doğru ters çapraz silme",
    "icon": "ArrowDownLeft",
    "defaultDuration": 1,
    "minDuration": 0.3,
    "maxDuration": 2.5
  },
  {
    "id": "circle-reveal",
    "name": "Dairesel Silme",
    "technicalId": "Iris In / Circle Reveal",
    "category": "wipe-mask",
    "categoryName": "Silme & Maske",
    "description": "Merkezden genişleyen dairesel iris maskesiyle açılış",
    "icon": "CircleDot",
    "defaultDuration": 1,
    "minDuration": 0.3,
    "maxDuration": 2.5
  },
  {
    "id": "iris-out",
    "name": "Dairesel Kapanış",
    "technicalId": "Iris Out",
    "category": "wipe-mask",
    "categoryName": "Silme & Maske",
    "description": "Kenarlardan merkeze daralan dairesel kapanış maskesi",
    "icon": "Circle",
    "defaultDuration": 1,
    "minDuration": 0.3,
    "maxDuration": 2.5
  },
  {
    "id": "iris-diamond",
    "name": "Elmas İris Açılışı",
    "technicalId": "Diamond Iris Reveal",
    "category": "wipe-mask",
    "categoryName": "Silme & Maske",
    "description": "Merkezden genişleyen elmas / baklava biçimli geometrik açılış",
    "icon": "Square",
    "defaultDuration": 0.9,
    "minDuration": 0.3,
    "maxDuration": 2
  },
  {
    "id": "iris-hexagon",
    "name": "Altıgen İris Açılışı",
    "technicalId": "Hexagon Iris Reveal",
    "category": "wipe-mask",
    "categoryName": "Silme & Maske",
    "description": "Modern 6-kenarlı altıgen maske açılışı",
    "icon": "Hexagon",
    "defaultDuration": 0.9,
    "minDuration": 0.3,
    "maxDuration": 2
  },
  {
    "id": "iris-star",
    "name": "Yıldız Maske Açılışı",
    "technicalId": "Star Iris Reveal",
    "category": "wipe-mask",
    "categoryName": "Silme & Maske",
    "description": "Merkezden büyüyen 5 köşeli parlak yıldız maskesi",
    "icon": "Star",
    "defaultDuration": 0.95,
    "minDuration": 0.3,
    "maxDuration": 2
  },
  {
    "id": "iris-heart",
    "name": "Kalp Maske Açılışı",
    "technicalId": "Heart Iris Reveal",
    "category": "wipe-mask",
    "categoryName": "Silme & Maske",
    "description": "Romantik ve sosyal medya için merkezden büyüyen kalp maskesi",
    "icon": "Heart",
    "defaultDuration": 0.95,
    "minDuration": 0.3,
    "maxDuration": 2
  },
  {
    "id": "radial-clock-wipe",
    "name": "Saat Yönü Radyal Silme",
    "technicalId": "Radial Clock Wipe",
    "category": "wipe-mask",
    "categoryName": "Silme & Maske",
    "description": "Saat ibresi gibi 360 derece dönerek sahneyi silen radyal maske",
    "icon": "Clock",
    "defaultDuration": 1,
    "minDuration": 0.3,
    "maxDuration": 3
  },
  {
    "id": "radial-counter-clock",
    "name": "Ters Saat Yönü Silme",
    "technicalId": "Counter Clock Wipe",
    "category": "wipe-mask",
    "categoryName": "Silme & Maske",
    "description": "Saatin tersi yönünde 360 derece dönen radyal silme",
    "icon": "RotateCcw",
    "defaultDuration": 1,
    "minDuration": 0.3,
    "maxDuration": 3
  },
  {
    "id": "radial-dual-wipe",
    "name": "Çift Kanatlı Fan Silme",
    "technicalId": "Dual Wing Radial Wipe",
    "category": "wipe-mask",
    "categoryName": "Silme & Maske",
    "description": "Karşılıklı iki kanatla 180 derece senkron silme",
    "icon": "Fan",
    "defaultDuration": 0.9,
    "minDuration": 0.3,
    "maxDuration": 2.5
  },
  {
    "id": "radial-quad-wipe",
    "name": "Dört Kanatlı Pervane Silme",
    "technicalId": "Quad Wing Radial Wipe",
    "category": "wipe-mask",
    "categoryName": "Silme & Maske",
    "description": "Dört kanatlı simetrik pervane dönüşüyle hızlı silme",
    "icon": "Crosshair",
    "defaultDuration": 0.8,
    "minDuration": 0.3,
    "maxDuration": 2
  },
  {
    "id": "venetian-blinds",
    "name": "Yatay Jaluzi Perde",
    "technicalId": "Venetian Blinds Horizontal",
    "category": "wipe-mask",
    "categoryName": "Silme & Maske",
    "description": "Yatay panjur çıtalarının açılarak sahneyi göstermesi",
    "icon": "Menu",
    "defaultDuration": 0.8,
    "minDuration": 0.3,
    "maxDuration": 2
  },
  {
    "id": "venetian-blinds-v",
    "name": "Dikey Jaluzi Perde",
    "technicalId": "Venetian Blinds Vertical",
    "category": "wipe-mask",
    "categoryName": "Silme & Maske",
    "description": "Dikey panjur çıtalarının açılarak sahneyi göstermesi",
    "icon": "Columns3",
    "defaultDuration": 0.8,
    "minDuration": 0.3,
    "maxDuration": 2
  },
  {
    "id": "checkerboard",
    "name": "Dama Tahtası",
    "technicalId": "Checkerboard",
    "category": "wipe-mask",
    "categoryName": "Silme & Maske",
    "description": "Dama tahtası karelerinin soldan sağa sırayla belirmesi",
    "icon": "Grid",
    "defaultDuration": 0.9,
    "minDuration": 0.3,
    "maxDuration": 2.5
  },
  {
    "id": "checkerboard-diagonal",
    "name": "Çapraz Dama Tahtası",
    "technicalId": "Diagonal Checkerboard",
    "category": "wipe-mask",
    "categoryName": "Silme & Maske",
    "description": "Çapraz basamaklarla kademeli açılan dama pikselleri",
    "icon": "LayoutGrid",
    "defaultDuration": 0.9,
    "minDuration": 0.3,
    "maxDuration": 2.5
  },
  {
    "id": "soft-mask-reveal",
    "name": "Yumuşak Gradyan Maske",
    "technicalId": "Soft Mask Reveal",
    "category": "wipe-mask",
    "categoryName": "Silme & Maske",
    "description": "Geniş tüy yumuşatmalı pürüzsüz gradyan silme",
    "icon": "Feather",
    "defaultDuration": 1,
    "minDuration": 0.3,
    "maxDuration": 3,
    "supportsFeather": true
  },
  {
    "id": "circle-wipe-rings",
    "name": "Eşmerkezli Halka Silme",
    "technicalId": "Concentric Ring Wipe",
    "category": "wipe-mask",
    "categoryName": "Silme & Maske",
    "description": "Genişleyen iç içe halkalar dalgasıyla geçiş",
    "icon": "Disc",
    "defaultDuration": 0.9,
    "minDuration": 0.3,
    "maxDuration": 2.5
  },
  {
    "id": "spiral-wipe",
    "name": "Spiral Silme",
    "technicalId": "Spiral Wipe",
    "category": "wipe-mask",
    "categoryName": "Silme & Maske",
    "description": "Merkezden dışa doğru kıvrılarak açılan spiral maske",
    "icon": "Compass",
    "defaultDuration": 1,
    "minDuration": 0.4,
    "maxDuration": 2.5
  },
  {
    "id": "box-zoom-mask",
    "name": "Kutu Büyümesi Maskesi",
    "technicalId": "Box Zoom Mask",
    "category": "wipe-mask",
    "categoryName": "Silme & Maske",
    "description": "Sinematik dikdörtgen çerçeve merkezden genişler",
    "icon": "Box",
    "defaultDuration": 0.8,
    "minDuration": 0.3,
    "maxDuration": 2
  },
  {
    "id": "zoom-in",
    "name": "Hızlı Yakınlaşma",
    "technicalId": "Zoom In",
    "category": "camera-motion",
    "categoryName": "Kamera & Hareket",
    "description": "Kameranın yeni klibin merkezine hızla dalması",
    "icon": "ZoomIn",
    "defaultDuration": 0.8,
    "minDuration": 0.2,
    "maxDuration": 2
  },
  {
    "id": "zoom-out",
    "name": "Hızlı Uzaklaşma",
    "technicalId": "Zoom Out",
    "category": "camera-motion",
    "categoryName": "Kamera & Hareket",
    "description": "Kameranın geniş açıya hızla geri çekilmesi",
    "icon": "ZoomOut",
    "defaultDuration": 0.8,
    "minDuration": 0.2,
    "maxDuration": 2
  },
  {
    "id": "zoom-punch",
    "name": "Zoom Punch (Vuruşlu Zoom)",
    "technicalId": "Zoom Punch",
    "category": "camera-motion",
    "categoryName": "Kamera & Hareket",
    "description": "Hızlı zoom-in ardından elastik zoom-out vuruşu",
    "icon": "Maximize",
    "defaultDuration": 0.6,
    "minDuration": 0.2,
    "maxDuration": 1.5
  },
  {
    "id": "zoom-blur",
    "name": "Optik Odak Patlaması",
    "technicalId": "Radial Zoom Blur",
    "category": "camera-motion",
    "categoryName": "Kamera & Hareket",
    "description": "Merkezden dışa doğru radyal optik bulanıklık patlaması",
    "icon": "Eye",
    "defaultDuration": 0.7,
    "minDuration": 0.2,
    "maxDuration": 1.8
  },
  {
    "id": "whip-pan",
    "name": "Whip Pan (Kamera Savrulması)",
    "technicalId": "Whip Pan",
    "category": "camera-motion",
    "categoryName": "Kamera & Hareket",
    "description": "İki klip arasında yönlü hareket bulanıklığıyla hızlı kamera savrulması",
    "icon": "FastForward",
    "defaultDuration": 0.5,
    "minDuration": 0.2,
    "maxDuration": 1.2,
    "supportedDirections": [
      "left",
      "right",
      "up",
      "down"
    ]
  },
  {
    "id": "whip-pan-left",
    "name": "Sola Whip Pan",
    "technicalId": "Whip Pan Left",
    "category": "camera-motion",
    "categoryName": "Kamera & Hareket",
    "description": "Aşırı hızlı hareket bulanıklığıyla sola ani kamera çevrimi",
    "icon": "FastForward",
    "defaultDuration": 0.5,
    "minDuration": 0.2,
    "maxDuration": 1.2
  },
  {
    "id": "whip-pan-right",
    "name": "Sağa Whip Pan",
    "technicalId": "Whip Pan Right",
    "category": "camera-motion",
    "categoryName": "Kamera & Hareket",
    "description": "Aşırı hızlı hareket bulanıklığıyla sağa ani kamera çevrimi",
    "icon": "FastForward",
    "defaultDuration": 0.5,
    "minDuration": 0.2,
    "maxDuration": 1.2
  },
  {
    "id": "whip-pan-up",
    "name": "Yukarı Whip Pan",
    "technicalId": "Whip Pan Up",
    "category": "camera-motion",
    "categoryName": "Kamera & Hareket",
    "description": "Hızlı hareket bulanıklığıyla yukarı ani kamera çevrimi",
    "icon": "MoveUp",
    "defaultDuration": 0.5,
    "minDuration": 0.2,
    "maxDuration": 1.2
  },
  {
    "id": "whip-pan-down",
    "name": "Aşağı Whip Pan",
    "technicalId": "Whip Pan Down",
    "category": "camera-motion",
    "categoryName": "Kamera & Hareket",
    "description": "Hızlı hareket bulanıklığıyla aşağı ani kamera çevrimi",
    "icon": "MoveDown",
    "defaultDuration": 0.5,
    "minDuration": 0.2,
    "maxDuration": 1.2
  },
  {
    "id": "whip-pan-diagonal-tl",
    "name": "Çapraz Sol-Üst Whip",
    "technicalId": "Whip Pan Diagonal TL",
    "category": "camera-motion",
    "categoryName": "Kamera & Hareket",
    "description": "Çapraz sol üst istikametinde hareket bulanıklı savrulma",
    "icon": "ArrowUpLeft",
    "defaultDuration": 0.5,
    "minDuration": 0.2,
    "maxDuration": 1.2
  },
  {
    "id": "whip-pan-diagonal-tr",
    "name": "Çapraz Sağ-Üst Whip",
    "technicalId": "Whip Pan Diagonal TR",
    "category": "camera-motion",
    "categoryName": "Kamera & Hareket",
    "description": "Çapraz sağ üst istikametinde hareket bulanıklı savrulma",
    "icon": "ArrowUpRight",
    "defaultDuration": 0.5,
    "minDuration": 0.2,
    "maxDuration": 1.2
  },
  {
    "id": "spin-cw",
    "name": "Saat Yönünde Dönüş",
    "technicalId": "Spin Clockwise",
    "category": "camera-motion",
    "categoryName": "Kamera & Hareket",
    "description": "360 derece saat yönünde dönerek yeni klibe geçiş",
    "icon": "RotateCw",
    "defaultDuration": 0.9,
    "minDuration": 0.3,
    "maxDuration": 2
  },
  {
    "id": "spin-ccw",
    "name": "Ters Saat Yönünde Dönüş",
    "technicalId": "Spin Counter-Clockwise",
    "category": "camera-motion",
    "categoryName": "Kamera & Hareket",
    "description": "360 derece saatin tersi yönde dönerek yeni klibe geçiş",
    "icon": "RotateCcw",
    "defaultDuration": 0.9,
    "minDuration": 0.3,
    "maxDuration": 2
  },
  {
    "id": "spin-zoom",
    "name": "Dönerek Yakınlaşma (Vortex)",
    "technicalId": "Spin Zoom Vortex",
    "category": "camera-motion",
    "categoryName": "Kamera & Hareket",
    "description": "360 derece hızlı fırıldak dönüş ve derin odak dalışı",
    "icon": "Orbit",
    "defaultDuration": 0.85,
    "minDuration": 0.3,
    "maxDuration": 2
  },
  {
    "id": "flip-horizontal",
    "name": "3D Yatay Kart Çevirme",
    "technicalId": "Flip Horizontal 3D",
    "category": "camera-motion",
    "categoryName": "Kamera & Hareket",
    "description": "Kartvizit gibi Y ekseni etrafında 3D dönerek arka klibi gösterme",
    "icon": "RefreshCw",
    "defaultDuration": 0.9,
    "minDuration": 0.3,
    "maxDuration": 2
  },
  {
    "id": "flip-vertical",
    "name": "3D Dikey Kart Çevirme",
    "technicalId": "Flip Vertical 3D",
    "category": "camera-motion",
    "categoryName": "Kamera & Hareket",
    "description": "X ekseni etrafında takla atarak 3D dikey çevrilme",
    "icon": "Repeat",
    "defaultDuration": 0.9,
    "minDuration": 0.3,
    "maxDuration": 2
  },
  {
    "id": "cube-rotate-left",
    "name": "3D Küp Sola Dönüş",
    "technicalId": "3D Cube Rotate Left",
    "category": "camera-motion",
    "categoryName": "Kamera & Hareket",
    "description": "Üç boyutlu küpün sol yüzüne dönerek sahne değiştirme",
    "icon": "Box",
    "defaultDuration": 0.9,
    "minDuration": 0.3,
    "maxDuration": 2
  },
  {
    "id": "cube-rotate-right",
    "name": "3D Küp Sağa Dönüş",
    "technicalId": "3D Cube Rotate Right",
    "category": "camera-motion",
    "categoryName": "Kamera & Hareket",
    "description": "Üç boyutlu küpün sağ yüzüne dönerek sahne değiştirme",
    "icon": "Box",
    "defaultDuration": 0.9,
    "minDuration": 0.3,
    "maxDuration": 2
  },
  {
    "id": "door-swing-open",
    "name": "3D Kapı Açılışı",
    "technicalId": "3D Door Swing Open",
    "category": "camera-motion",
    "categoryName": "Kamera & Hareket",
    "description": "Sol menteşesinden 3D açılan kapı perspektifi",
    "icon": "DoorOpen",
    "defaultDuration": 0.9,
    "minDuration": 0.3,
    "maxDuration": 2
  },
  {
    "id": "camera-shake-impact",
    "name": "Kamera Depremi & Sarsıntı",
    "technicalId": "Camera Shake Impact",
    "category": "camera-motion",
    "categoryName": "Kamera & Hareket",
    "description": "Kesim anında yüksek frekanslı dinamik kamera titreşimi",
    "icon": "Activity",
    "defaultDuration": 0.5,
    "minDuration": 0.2,
    "maxDuration": 1.2
  },
  {
    "id": "light-leak",
    "name": "Sıcak Işık Sızıntısı",
    "technicalId": "Warm Light Leak",
    "category": "cinematic-digital",
    "categoryName": "Sinematik & Dijital",
    "description": "Sıcak vintage lens ışık sızıntısı ve organik parlama",
    "icon": "SunMedium",
    "defaultDuration": 1,
    "minDuration": 0.3,
    "maxDuration": 2.5
  },
  {
    "id": "light-leak-rainbow",
    "name": "Spektrum Gökkuşağı Işığı",
    "technicalId": "Rainbow Light Leak",
    "category": "cinematic-digital",
    "categoryName": "Sinematik & Dijital",
    "description": "Kromatik gökkuşağı tayfı ve prizma ışık huzmesi",
    "icon": "Sparkles",
    "defaultDuration": 1,
    "minDuration": 0.3,
    "maxDuration": 2.5
  },
  {
    "id": "light-leak-blue",
    "name": "Soğuk Mavi Işık Sızıntısı",
    "technicalId": "Anamorphic Blue Flare",
    "category": "cinematic-digital",
    "categoryName": "Sinematik & Dijital",
    "description": "Bilim kurgu tarzı soğuk mavi yatay lens sızıntısı",
    "icon": "Flame",
    "defaultDuration": 0.9,
    "minDuration": 0.3,
    "maxDuration": 2.5
  },
  {
    "id": "film-burn",
    "name": "Sıcak Film Yanığı",
    "technicalId": "Film Burn Warm",
    "category": "cinematic-digital",
    "categoryName": "Sinematik & Dijital",
    "description": "Nostaljik 35mm sinema film pelikülü yanması",
    "icon": "Flame",
    "defaultDuration": 0.8,
    "minDuration": 0.3,
    "maxDuration": 2
  },
  {
    "id": "film-burn-edges",
    "name": "Kenar Pelikül Yanığı",
    "technicalId": "Film Burn Edge Vignette",
    "category": "cinematic-digital",
    "categoryName": "Sinematik & Dijital",
    "description": "Çerçeve kenarlarından içeri yayılan organik film yanması",
    "icon": "Film",
    "defaultDuration": 0.85,
    "minDuration": 0.3,
    "maxDuration": 2
  },
  {
    "id": "lens-flare",
    "name": "Mercek Parlaması",
    "technicalId": "Lens Flare",
    "category": "cinematic-digital",
    "categoryName": "Sinematik & Dijital",
    "description": "Yatay anamorfik optik mercek parlaması ve ışık çizgisi",
    "icon": "SunMedium",
    "defaultDuration": 0.7,
    "minDuration": 0.2,
    "maxDuration": 1.8
  },
  {
    "id": "chromatic-flare",
    "name": "Kromatik Parlama Patlaması",
    "technicalId": "Chromatic Flare Burst",
    "category": "cinematic-digital",
    "categoryName": "Sinematik & Dijital",
    "description": "Yüksek yoğunluklu beyaz ışık ve renk saçaklanması patlaması",
    "icon": "Sun",
    "defaultDuration": 0.65,
    "minDuration": 0.2,
    "maxDuration": 1.5
  },
  {
    "id": "glitch",
    "name": "Dijital Glitch",
    "technicalId": "Digital Glitch",
    "category": "cinematic-digital",
    "categoryName": "Sinematik & Dijital",
    "description": "Yatay sinyal paraziti, sıçrama ve veri bozulması",
    "icon": "Zap",
    "defaultDuration": 0.6,
    "minDuration": 0.2,
    "maxDuration": 1.5
  },
  {
    "id": "glitch-line-tear",
    "name": "Yatay Bant Yırtılması",
    "technicalId": "Glitch Line Tear",
    "category": "cinematic-digital",
    "categoryName": "Sinematik & Dijital",
    "description": "8 katmanlı yatay tarama çizgisi yer değiştirme efekti",
    "icon": "Menu",
    "defaultDuration": 0.55,
    "minDuration": 0.2,
    "maxDuration": 1.5
  },
  {
    "id": "rgb-split",
    "name": "RGB Ayrışması",
    "technicalId": "RGB Split",
    "category": "cinematic-digital",
    "categoryName": "Sinematik & Dijital",
    "description": "Kırmızı ve mavi renk kanallarının kaymasıyla siber geçiş",
    "icon": "Split",
    "defaultDuration": 0.6,
    "minDuration": 0.2,
    "maxDuration": 1.5
  },
  {
    "id": "pixel-dissolve",
    "name": "Piksel Dağılması",
    "technicalId": "Pixel Dissolve",
    "category": "cinematic-digital",
    "categoryName": "Sinematik & Dijital",
    "description": "Retro pikselleşerek mozaik bloklarla çözünme",
    "icon": "Box",
    "defaultDuration": 0.9,
    "minDuration": 0.3,
    "maxDuration": 2
  },
  {
    "id": "pixel-sort",
    "name": "Piksel Akması / Sıralama",
    "technicalId": "Pixel Sort Flow",
    "category": "cinematic-digital",
    "categoryName": "Sinematik & Dijital",
    "description": "Dikey parlaklık çizgilerinin sıvı gibi akması",
    "icon": "SlidersHorizontal",
    "defaultDuration": 0.85,
    "minDuration": 0.3,
    "maxDuration": 2
  },
  {
    "id": "vhs-distortion",
    "name": "VHS Paraziti",
    "technicalId": "VHS Distortion",
    "category": "cinematic-digital",
    "categoryName": "Sinematik & Dijital",
    "description": "Manyetik kaset tarama çizgileri ve bant bozulması",
    "icon": "Tv",
    "defaultDuration": 0.8,
    "minDuration": 0.2,
    "maxDuration": 2
  },
  {
    "id": "crt-tv-off",
    "name": "Eski CRT TV Kapanışı",
    "technicalId": "CRT TV Collapse",
    "category": "cinematic-digital",
    "categoryName": "Sinematik & Dijital",
    "description": "Tüplü televizyonun önce yatay çizgiye sonra noktaya kapanması",
    "icon": "MonitorX",
    "defaultDuration": 0.5,
    "minDuration": 0.2,
    "maxDuration": 1.2
  },
  {
    "id": "blur-dissolve",
    "name": "Bulanık Erime",
    "technicalId": "Blur Dissolve",
    "category": "cinematic-digital",
    "categoryName": "Sinematik & Dijital",
    "description": "Optik odak kaybı ve rüya gibi bulanık erime",
    "icon": "EyeOff",
    "defaultDuration": 1,
    "minDuration": 0.3,
    "maxDuration": 2.5
  },
  {
    "id": "directional-blur",
    "name": "Doğrusal Bulanıklık",
    "technicalId": "Directional Motion Blur",
    "category": "cinematic-digital",
    "categoryName": "Sinematik & Dijital",
    "description": "Yatay eksende yüksek hızlı hareket bulanıklığı erimesi",
    "icon": "Move",
    "defaultDuration": 0.8,
    "minDuration": 0.25,
    "maxDuration": 2
  },
  {
    "id": "prism-dissolve",
    "name": "Prizma Geçişi",
    "technicalId": "Prism Dissolve",
    "category": "cinematic-digital",
    "categoryName": "Sinematik & Dijital",
    "description": "Kromatik ışık kırılması ve prizmatik dağılma",
    "icon": "Compass",
    "defaultDuration": 0.9,
    "minDuration": 0.3,
    "maxDuration": 2.5
  },
  {
    "id": "kaleidoscope-hex",
    "name": "Kaleydoskop Kırılma",
    "technicalId": "Kaleidoscope Hexagon",
    "category": "cinematic-digital",
    "categoryName": "Sinematik & Dijital",
    "description": "6 parçalı geometrik prizma aynası yansıması",
    "icon": "Gem",
    "defaultDuration": 0.9,
    "minDuration": 0.3,
    "maxDuration": 2.5
  },
  {
    "id": "flash",
    "name": "Kamera Flaşı",
    "technicalId": "Camera Flash",
    "category": "cinematic-digital",
    "categoryName": "Sinematik & Dijital",
    "description": "Ani 1 karelik parlak stüdyo flaşı patlaması",
    "icon": "Camera",
    "defaultDuration": 0.4,
    "minDuration": 0.1,
    "maxDuration": 1
  },
  {
    "id": "datamosh-melt",
    "name": "Datamosh Vektör Erimesi",
    "technicalId": "Datamosh Vector Melt",
    "category": "cinematic-digital",
    "categoryName": "Sinematik & Dijital",
    "description": "Video sıkıştırma anahtar kare kaybıyla dikey piksel erimesi",
    "icon": "Cpu",
    "defaultDuration": 0.85,
    "minDuration": 0.3,
    "maxDuration": 2
  }
];

export const KNOWN_TRANSITION_TYPES = new Set<string>([
  'cut',
  'crossfade',
  'fade-black',
  'fade-white',
  'dip-color',
  'additive-dissolve',
  'soft-dissolve',
  'luma-fade',
  'camera-shutter',
  'strobe-cut',
  'non-additive-dissolve',
  'optical-dissolve',
  'slide-left',
  'slide-right',
  'slide-up',
  'slide-down',
  'push-left',
  'push-right',
  'push-up',
  'push-down',
  'push-diagonal-tl',
  'push-diagonal-tr',
  'push-diagonal-bl',
  'push-diagonal-br',
  'split-open-horizontal',
  'split-open-vertical',
  'split-close-horizontal',
  'split-close-vertical',
  'split-four-corners',
  'split-four-pinch',
  'band-slide-horizontal',
  'band-slide-vertical',
  'multi-slice-push-h',
  'multi-slice-push-v',
  'elastic-push-left',
  'elastic-push-right',
  'wipe-left',
  'wipe-right',
  'wipe-up',
  'wipe-down',
  'diagonal-wipe',
  'diagonal-wipe-reverse',
  'circle-reveal',
  'iris-out',
  'iris-diamond',
  'iris-hexagon',
  'iris-star',
  'iris-heart',
  'radial-clock-wipe',
  'radial-counter-clock',
  'radial-dual-wipe',
  'radial-quad-wipe',
  'venetian-blinds',
  'venetian-blinds-v',
  'checkerboard',
  'checkerboard-diagonal',
  'soft-mask-reveal',
  'circle-wipe-rings',
  'spiral-wipe',
  'box-zoom-mask',
  'zoom-in',
  'zoom-out',
  'zoom-punch',
  'zoom-blur',
  'whip-pan',
  'whip-pan-left',
  'whip-pan-right',
  'whip-pan-up',
  'whip-pan-down',
  'whip-pan-diagonal-tl',
  'whip-pan-diagonal-tr',
  'spin-cw',
  'spin-ccw',
  'spin-zoom',
  'flip-horizontal',
  'flip-vertical',
  'cube-rotate-left',
  'cube-rotate-right',
  'door-swing-open',
  'camera-shake-impact',
  'light-leak',
  'light-leak-rainbow',
  'light-leak-blue',
  'film-burn',
  'film-burn-edges',
  'lens-flare',
  'chromatic-flare',
  'glitch',
  'glitch-line-tear',
  'rgb-split',
  'pixel-dissolve',
  'pixel-sort',
  'vhs-distortion',
  'crt-tv-off',
  'blur-dissolve',
  'directional-blur',
  'prism-dissolve',
  'kaleidoscope-hex',
  'flash',
  'datamosh-melt',
  'dissolve',
  'circle-close',
  'spin',
]);

export const TRANSITION_ALIASES: Record<string, TransitionType> = {
  'additive': 'additive-dissolve',
  'radial-clock': 'radial-clock-wipe',
  'radial-wipe-clock': 'radial-clock-wipe',
  'radial-wipe-dual': 'radial-dual-wipe',
  'whip-left': 'whip-pan-left',
  'whip-right': 'whip-pan-right',
  'whip-up': 'whip-pan-up',
  'whip-down': 'whip-pan-down',
  'split-horizontal': 'split-open-horizontal',
  'split-vertical': 'split-open-vertical',
  'split-h': 'split-open-horizontal',
  'split-v': 'split-open-vertical',
  'split-open-h': 'split-open-horizontal',
  'split-open-v': 'split-open-vertical',
  'split-close-center': 'split-close-horizontal',
  'circle-close': 'iris-out',
  'circle-in': 'circle-reveal',
  'circle-out': 'iris-out',
  'smooth-zoom-in': 'zoom-in',
  'smooth-zoom-out': 'zoom-out',
  'vortex-blur-zoom': 'zoom-punch',
  'directional-blur-h': 'directional-blur',
  'directional-blur-v': 'directional-blur',
  'rgb-split-chromatic': 'rgb-split',
  'chromatic-pulse': 'rgb-split',
  'chromatic-flare-burst': 'chromatic-flare',
  'glitch-digital-blocks': 'glitch',
  'vhs-tape-tracking': 'vhs-distortion',
  'film-burn-orange': 'film-burn',
  'film-burn-edge': 'film-burn-edges',
  'light-leak-amber': 'light-leak',
  'anamorphic-streak': 'light-leak-blue',
  'luma-fade-bright': 'luma-fade',
  'luma-fade-dark': 'luma-fade',
  'displacement-noise': 'soft-mask-reveal',
  'displacement-ripple': 'soft-mask-reveal',
  'liquid-wipe-drip': 'soft-mask-reveal',
  'liquid-wipe-splash': 'soft-mask-reveal',
  'ink-spread-organic': 'soft-mask-reveal',
  'paper-tear-diagonal': 'soft-mask-reveal',
  'pixel-sort-horizontal': 'pixel-sort',
  'pixel-sort-vertical': 'pixel-sort',
  'pixel-mosaic-dissolve': 'pixel-dissolve',
  'datamosh-vector-drag': 'datamosh-melt',
  'perspective-flip-card': 'flip-horizontal',
  'perspective-flip-door': 'door-swing-open',
  '3d-cube-left': 'cube-rotate-left',
  '3d-cube-right': 'cube-rotate-right',
  'spin-fast-cw': 'spin-cw',
  'spin-vortex': 'spin-zoom',
  'push-slide-left': 'push-left',
  'push-slide-right': 'push-right',
  'push-slide-up': 'push-up',
  'push-slide-down': 'push-down',
  'elastic-stretch-h': 'elastic-push-right',
  'elastic-stretch-v': 'elastic-push-left',
  'motion-tile-mirror': 'kaleidoscope-hex',
  'kaleidoscope-mandala': 'kaleidoscope-hex',
  'prism-dispersion': 'prism-dissolve',
  'cut-clean': 'cut',
  'crossfade-pro': 'crossfade',
  'dip-black-smooth': 'fade-black',
  'dip-white-flash': 'fade-white',
  'soft-dissolve-film': 'soft-dissolve',
  'additive-glow-dissolve': 'additive-dissolve',
  'blinds-horizontal': 'venetian-blinds',
  'blinds-vertical': 'venetian-blinds-v',
  'checkerboard-clean': 'checkerboard',
  'diagonal-wipe-clean': 'diagonal-wipe',
  'camera-shutter-dip': 'camera-shutter',
  'camera-shake-earthquake': 'camera-shake-impact',
  'camera-shake-rumble': 'camera-shake-impact',
  'camera-shake-twitch': 'camera-shake-impact',
  'parallax-left': 'push-left',
  'parallax-right': 'push-right',
  'lens-distortion-barrel': 'zoom-punch',
  'lens-distortion-pincushion': 'zoom-punch',
  'lens-distortion-fisheye': 'zoom-punch',
};

const DYNAMIC_CYCLE: TransitionType[] = [
  'whip-pan-left', 'glitch', 'light-leak', 'zoom-punch', 'film-burn',
  'rgb-split', 'pixel-dissolve', 'vhs-distortion', 'prism-dissolve',
  'flash', 'radial-clock-wipe', 'spin-cw', 'checkerboard', 'venetian-blinds',
  'split-open-horizontal', 'diagonal-wipe', 'circle-reveal', 'push-right',
  'soft-dissolve', 'flip-horizontal',
];

export function resolveTransitionType(rawId: string | undefined | null): TransitionType {
  if (!rawId) return 'crossfade';
  let s = String(rawId).trim().toLowerCase();

  // Strip prefix
  if (s.startsWith('trans-')) s = s.replace('trans-', '');

  // Direct match
  if (KNOWN_TRANSITION_TYPES.has(s)) return s as TransitionType;

  // Direct alias
  if (TRANSITION_ALIASES[s]) return TRANSITION_ALIASES[s];

  // Handle forma-original-transition-001-<techId>
  if (s.startsWith('forma-original-transition-')) {
    const afterPrefix = s.replace('forma-original-transition-', '');
    const parts = afterPrefix.split('-');
    const techId = parts.slice(1).join('-');
    if (KNOWN_TRANSITION_TYPES.has(techId)) return techId as TransitionType;
    if (TRANSITION_ALIASES[techId]) return TRANSITION_ALIASES[techId];
  }

  // Handle dynamic-1 .. dynamic-150
  if (s.startsWith('dynamic-')) {
    const num = parseInt(s.replace('dynamic-', ''), 10) || 1;
    return DYNAMIC_CYCLE[(num - 1) % DYNAMIC_CYCLE.length];
  }

  // Keyword fallbacks
  if (s.includes('glitch')) return 'glitch';
  if (s.includes('whip')) return 'whip-pan-left';
  if (s.includes('leak')) return 'light-leak';
  if (s.includes('burn')) return 'film-burn';
  if (s.includes('vhs')) return 'vhs-distortion';
  if (s.includes('zoom')) return 'zoom-in';
  if (s.includes('spin')) return 'spin-cw';
  if (s.includes('prism')) return 'prism-dissolve';
  if (s.includes('pixel')) return 'pixel-dissolve';
  if (s.includes('flash')) return 'flash';
  if (s.includes('wipe')) return 'wipe-left';
  if (s.includes('slide')) return 'slide-left';
  if (s.includes('push')) return 'push-left';
  if (s.includes('split')) return 'split-open-horizontal';

  return 'crossfade';
}

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
  const resolvedType = resolveTransitionType(type);

  switch (resolvedType) {
    case 'cut':
      return {
        opacity: isIncoming ? (p >= 0.5 ? 1 : 0) : p < 0.5 ? 1 : 0,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
      };

    case 'crossfade':
    case 'non-additive-dissolve':
      return {
        opacity: isIncoming ? p : 1.0,
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

    case 'additive-dissolve':
      return {
        opacity: isIncoming ? p : 1 - p * 0.3,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        additive: true,
      };

    case 'soft-dissolve':
    case 'dissolve':
    case 'optical-dissolve':
      return {
        opacity: isIncoming ? Math.pow(p, 1.4) : Math.pow(1 - p, 1.4),
        offsetX: 0,
        offsetY: 0,
        scale: 1,
      };

    case 'luma-fade':
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        lumaThreshold: isIncoming ? p : 1 - p,
      };

    case 'camera-shutter': {
      const dipP = Math.sin(p * Math.PI);
      return {
        opacity: isIncoming ? (p > 0.5 ? 1 : 0) : p <= 0.5 ? 1 : 0,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        colorOverlay: { r: 0, g: 0, b: 0, a: dipP },
      };
    }

    case 'strobe-cut':
      return {
        opacity: isIncoming ? (p >= 0.5 ? 1 : 0) : p < 0.5 ? 1 : 0,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        flash: p > 0.4 && p < 0.6 ? { intensity: 0.8 } : undefined,
      };

    // SLIDE & PUSH
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
    case 'elastic-push-left':
    case 'multi-slice-push-h':
    case 'band-slide-horizontal':
      return {
        opacity: 1,
        offsetX: isIncoming ? 1 - p : -p,
        offsetY: 0,
        scale: 1,
      };

    case 'push-right':
    case 'elastic-push-right':
      return {
        opacity: 1,
        offsetX: isIncoming ? -(1 - p) : p,
        offsetY: 0,
        scale: 1,
      };

    case 'push-up':
    case 'multi-slice-push-v':
    case 'band-slide-vertical':
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

    case 'push-diagonal-tl':
      return {
        opacity: 1,
        offsetX: isIncoming ? 1 - p : -p,
        offsetY: isIncoming ? 1 - p : -p,
        scale: 1,
      };

    case 'push-diagonal-tr':
      return {
        opacity: 1,
        offsetX: isIncoming ? -(1 - p) : p,
        offsetY: isIncoming ? 1 - p : -p,
        scale: 1,
      };

    case 'push-diagonal-bl':
      return {
        opacity: 1,
        offsetX: isIncoming ? 1 - p : -p,
        offsetY: isIncoming ? -(1 - p) : p,
        scale: 1,
      };

    case 'push-diagonal-br':
      return {
        opacity: 1,
        offsetX: isIncoming ? -(1 - p) : p,
        offsetY: isIncoming ? -(1 - p) : p,
        scale: 1,
      };

    case 'split-open-horizontal':
    case 'split-four-corners':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        maskShape: 'split-h',
        wipeRatio: p,
      };

    case 'split-open-vertical':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        maskShape: 'split-v',
        wipeRatio: p,
      };

    case 'split-close-horizontal':
    case 'split-four-pinch':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        maskShape: 'split-h',
        wipeRatio: 1 - p,
      };

    case 'split-close-vertical':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        maskShape: 'split-v',
        wipeRatio: 1 - p,
      };

    // WIPE & MASKS
    case 'wipe-left':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        wipeRatio: isIncoming ? p : 1,
        wipeDirection: 'left',
        maskShape: 'rect',
      };

    case 'wipe-right':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        wipeRatio: isIncoming ? p : 1,
        wipeDirection: 'right',
        maskShape: 'rect',
      };

    case 'wipe-up':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        wipeRatio: isIncoming ? p : 1,
        wipeDirection: 'up',
        maskShape: 'rect',
      };

    case 'wipe-down':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        wipeRatio: isIncoming ? p : 1,
        wipeDirection: 'down',
        maskShape: 'rect',
      };

    case 'diagonal-wipe':
    case 'diagonal-wipe-reverse':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        wipeRatio: isIncoming ? p : 1,
        wipeDirection: 'diagonal',
        maskShape: 'diagonal',
      };

    case 'circle-reveal':
    case 'circle-wipe-rings':
    case 'spiral-wipe':
    case 'box-zoom-mask':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        maskShape: 'circle-in',
        maskRadius: isIncoming ? p : 1,
      };

    case 'iris-in':
    case 'circle-close':
    case 'iris-out':
    case 'iris-diamond':
    case 'iris-hexagon':
    case 'iris-star':
    case 'iris-heart':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        maskShape: 'circle-out',
        maskRadius: isIncoming ? 1 : 1 - p,
      };

    case 'radial-clock-wipe':
    case 'radial-counter-clock':
    case 'radial-dual-wipe':
    case 'radial-quad-wipe':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        maskShape: 'clock',
        wipeRatio: p,
      };

    case 'venetian-blinds':
    case 'venetian-blinds-v':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        maskShape: 'blinds',
        wipeRatio: p,
      };

    case 'checkerboard':
    case 'checkerboard-diagonal':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        maskShape: 'checker',
        wipeRatio: p,
      };

    case 'soft-mask-reveal':
      return {
        opacity: 1,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        maskShape: 'soft-circle',
        maskRadius: p,
        feather: options?.feather ?? 25,
      };

    // CAMERA MOTION & 3D
    case 'zoom-in':
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: isIncoming ? 0.3 + p * 0.7 : 1 + p * 1.5,
      };

    case 'zoom-out':
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: isIncoming ? 2.5 - p * 1.5 : 1 - p * 0.7,
      };

    case 'zoom-punch':
      return {
        opacity: isIncoming ? Math.min(1, p * 1.8) : Math.max(0, 1 - p * 1.5),
        offsetX: 0,
        offsetY: 0,
        scale: 1 + Math.sin(p * Math.PI) * 0.35,
        blur: Math.round(Math.sin(p * Math.PI) * 12),
      };

    case 'zoom-blur':
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: 1 + Math.sin(p * Math.PI) * 0.4,
        zoomBlur: Math.sin(p * Math.PI),
      };

    case 'whip-pan':
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

    case 'whip-pan-diagonal-tl': {
      const easeP = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const blurFactor = Math.sin(p * Math.PI) * 30;
      return {
        opacity: 1,
        offsetX: isIncoming ? 1 - easeP : -easeP,
        offsetY: isIncoming ? 1 - easeP : -easeP,
        scale: 1,
        blur: Math.round(blurFactor),
      };
    }

    case 'whip-pan-diagonal-tr': {
      const easeP = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const blurFactor = Math.sin(p * Math.PI) * 30;
      return {
        opacity: 1,
        offsetX: isIncoming ? -(1 - easeP) : easeP,
        offsetY: isIncoming ? 1 - easeP : -easeP,
        scale: 1,
        blur: Math.round(blurFactor),
      };
    }

    case 'spin':
    case 'spin-cw': {
      const rot = isIncoming ? (1 - p) * -180 : p * 180;
      const scaleDip = 1 - Math.sin(p * Math.PI) * 0.25;
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
      const scaleDip = 1 - Math.sin(p * Math.PI) * 0.25;
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: scaleDip,
        rotation: rot,
      };
    }

    case 'spin-zoom': {
      const rot = isIncoming ? (1 - p) * -360 : p * 360;
      const scale = 1 + Math.sin(p * Math.PI) * 0.6;
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale,
        rotation: rot,
        blur: Math.round(Math.sin(p * Math.PI) * 10),
      };
    }

    case 'flip-horizontal':
    case 'cube-rotate-left':
    case 'cube-rotate-right':
    case 'door-swing-open': {
      const scaleX = isIncoming ? Math.max(0.001, (p - 0.5) * 2) : Math.max(0.001, (0.5 - p) * 2);
      return {
        opacity: isIncoming ? (p >= 0.5 ? 1 : 0) : p < 0.5 ? 1 : 0,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        scaleX: scaleX,
      };
    }

    case 'flip-vertical': {
      const scaleY = isIncoming ? Math.max(0.001, (p - 0.5) * 2) : Math.max(0.001, (0.5 - p) * 2);
      return {
        opacity: isIncoming ? (p >= 0.5 ? 1 : 0) : p < 0.5 ? 1 : 0,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        scaleY: scaleY,
      };
    }

    case 'camera-shake-impact': {
      const intensity = Math.sin(p * Math.PI) * 0.05;
      return {
        opacity: isIncoming ? (p >= 0.5 ? 1 : 0) : p < 0.5 ? 1 : 0,
        offsetX: Math.sin(p * 50) * intensity,
        offsetY: Math.cos(p * 45) * intensity,
        scale: 1 + intensity,
      };
    }

    // CINEMATIC & DIGITAL
    case 'light-leak':
    case 'light-leak-rainbow':
    case 'light-leak-blue':
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        lightLeak: {
          intensity: Math.sin(p * Math.PI) * 1.3,
          progress: p,
        },
      };

    case 'film-burn':
    case 'film-burn-edges':
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        filmBurn: {
          intensity: Math.sin(p * Math.PI) * 1.2,
          progress: p,
        },
      };

    case 'lens-flare':
    case 'chromatic-flare':
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        lensFlare: {
          intensity: Math.sin(p * Math.PI) * 1.5,
          progress: p,
        },
      };

    case 'glitch':
    case 'glitch-line-tear': {
      const glitchIntensity = Math.sin(p * Math.PI);
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: glitchIntensity > 0.1 ? (Math.random() - 0.5) * 0.08 * glitchIntensity : 0,
        offsetY: glitchIntensity > 0.1 ? (Math.random() - 0.5) * 0.04 * glitchIntensity : 0,
        scale: 1,
        glitch: {
          amount: glitchIntensity,
          sliceCount: 12,
          jitter: glitchIntensity * 15,
        },
        rgbSplit: glitchIntensity * 12,
      };
    }

    case 'rgb-split': {
      const splitAmount = Math.sin(p * Math.PI) * 20;
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        rgbSplit: Math.round(splitAmount),
      };
    }

    case 'pixel-dissolve':
    case 'pixel-sort':
    case 'datamosh-melt': {
      const pxSize = Math.round(Math.sin(p * Math.PI) * 45) + 1;
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        pixelate: pxSize > 1 ? pxSize : undefined,
      };
    }

    case 'vhs-distortion':
    case 'crt-tv-off': {
      const vhsIntensity = Math.sin(p * Math.PI);
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        vhs: {
          intensity: vhsIntensity,
          trackingJitter: vhsIntensity * 8,
        },
        rgbSplit: vhsIntensity * 6,
      };
    }

    case 'blur-dissolve':
    case 'directional-blur': {
      const blurPx = Math.round(Math.sin(p * Math.PI) * 20);
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        blur: blurPx,
      };
    }

    case 'prism-dissolve':
    case 'kaleidoscope-hex': {
      const shift = Math.sin(p * Math.PI) * 14;
      return {
        opacity: isIncoming ? p : 1 - p,
        offsetX: 0,
        offsetY: 0,
        scale: 1,
        prism: {
          intensity: Math.sin(p * Math.PI),
          shift,
        },
      };
    }

    case 'flash': {
      const flashIntensity = Math.pow(Math.sin(p * Math.PI), 3);
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
    ctxA.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctxA.lineWidth = 1;
    for (let x = 0; x < width; x += 20) {
      ctxA.beginPath();
      ctxA.moveTo(x, 0);
      ctxA.lineTo(x, height);
      ctxA.stroke();
    }
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
    ctxB.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctxB.lineWidth = 1;
    for (let y = 0; y < height; y += 20) {
      ctxB.beginPath();
      ctxB.moveTo(0, y);
      ctxB.lineTo(width, y);
      ctxB.stroke();
    }
    ctxB.fillStyle = '#fde047';
    ctxB.font = `bold ${Math.round(height * 0.42)}px sans-serif`;
    ctxB.textAlign = 'center';
    ctxB.textBaseline = 'middle';
    ctxB.fillText('B', width / 2, height / 2);
  }
  return [cachedSurfaceA, cachedSurfaceB];
}

/**
 * Unified Canvas Renderer for all 100 Transitions.
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
  const resolvedType = resolveTransitionType(type);
  let surfA = surfaceA;
  let surfB = surfaceB;

  if (!surfA || !surfB) {
    const [defA, defB] = getOrCreateABSurfaces(width, height);
    if (!surfA) surfA = defA;
    if (!surfB) surfB = defB;
  }

  ctx.save();
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, width, height);

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
  switch (resolvedType) {
    // ==========================================
    // 1. TEMEL GEÇİŞLER (Basic)
    // ==========================================
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
      if (p <= 0.5) {
        drawSurface(surfA, 1 - p * 2);
      } else {
        drawSurface(surfB, (p - 0.5) * 2);
      }
      break;
    }

    case 'fade-white': {
      if (p <= 0.5) {
        drawSurface(surfA, 1);
        ctx.fillStyle = `rgba(255, 255, 255, ${p * 2})`;
        ctx.fillRect(0, 0, width, height);
      } else {
        drawSurface(surfB, 1);
        ctx.fillStyle = `rgba(255, 255, 255, ${(1 - p) * 2})`;
        ctx.fillRect(0, 0, width, height);
      }
      break;
    }

    case 'dip-color': {
      const hex = options?.color || '#3b82f6';
      const parsedHex = hex.replace('#', '');
      const r = parseInt(parsedHex.substring(0, 2), 16) || 59;
      const g = parseInt(parsedHex.substring(2, 4), 16) || 130;
      const b = parseInt(parsedHex.substring(4, 6), 16) || 246;

      if (p <= 0.5) {
        drawSurface(surfA, 1);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${p * 2})`;
        ctx.fillRect(0, 0, width, height);
      } else {
        drawSurface(surfB, 1);
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${(1 - p) * 2})`;
        ctx.fillRect(0, 0, width, height);
      }
      break;
    }

    case 'additive-dissolve': {
      drawSurface(surfA, 1);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      drawSurface(surfB, p);
      ctx.restore();
      break;
    }

    case 'soft-dissolve':
    case 'dissolve': {
      const easeP = p * p * (3 - 2 * p);
      drawSurface(surfA, 1);
      drawSurface(surfB, easeP);
      break;
    }

    case 'luma-fade': {
      drawSurface(surfA, 1);
      ctx.save();
      ctx.globalAlpha = p;
      drawSurface(surfB, 1);
      ctx.restore();
      break;
    }

    case 'camera-shutter': {
      if (p < 0.45) {
        drawSurface(surfA, 1 - p / 0.45);
      } else if (p < 0.55) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
      } else {
        drawSurface(surfB, (p - 0.55) / 0.45);
      }
      break;
    }

    case 'strobe-cut': {
      if (p < 0.25) drawSurface(surfA, 1);
      else if (p < 0.5) {
        drawSurface(surfB, 1);
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(0, 0, width, height);
      } else if (p < 0.75) drawSurface(surfA, 1);
      else drawSurface(surfB, 1);
      break;
    }

    case 'non-additive-dissolve': {
      drawSurface(surfA, 1);
      ctx.save();
      ctx.globalCompositeOperation = 'screen';
      drawSurface(surfB, p * 0.85);
      ctx.restore();
      break;
    }

    case 'optical-dissolve': {
      const expoP = Math.pow(p, 1.4);
      drawSurface(surfA, 1);
      drawSurface(surfB, expoP);
      const glow = Math.sin(p * Math.PI) * 0.45;
      if (glow > 0.05) {
        const grad = ctx.createRadialGradient(width/2, height/2, 10, width/2, height/2, width*0.7);
        grad.addColorStop(0, `rgba(255, 255, 255, ${glow})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
      }
      break;
    }

    // ==========================================
    // 2. KAYDIRMA, İTME & BÖLME (Slide & Push)
    // ==========================================
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

    case 'push-diagonal-tl': {
      drawSurface(surfA, 1, -p * width, -p * height);
      drawSurface(surfB, 1, (1 - p) * width, (1 - p) * height);
      break;
    }

    case 'push-diagonal-tr': {
      drawSurface(surfA, 1, p * width, -p * height);
      drawSurface(surfB, 1, -(1 - p) * width, (1 - p) * height);
      break;
    }

    case 'push-diagonal-bl': {
      drawSurface(surfA, 1, -p * width, p * height);
      drawSurface(surfB, 1, (1 - p) * width, -(1 - p) * height);
      break;
    }

    case 'push-diagonal-br': {
      drawSurface(surfA, 1, p * width, p * height);
      drawSurface(surfB, 1, -(1 - p) * width, -(1 - p) * height);
      break;
    }

    case 'split-open-horizontal': {
      drawSurface(surfB, 1);
      const splitW = (1 - p) * (width / 2);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, splitW, height);
      ctx.rect(width - splitW, 0, splitW, height);
      ctx.clip();
      drawSurface(surfA, 1);
      ctx.restore();
      break;
    }

    case 'split-open-vertical': {
      drawSurface(surfB, 1);
      const splitH = (1 - p) * (height / 2);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, splitH);
      ctx.rect(0, height - splitH, width, splitH);
      ctx.clip();
      drawSurface(surfA, 1);
      ctx.restore();
      break;
    }

    case 'split-close-horizontal': {
      drawSurface(surfA, 1);
      const splitW = p * (width / 2);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, splitW, height);
      ctx.rect(width - splitW, 0, splitW, height);
      ctx.clip();
      drawSurface(surfB, 1);
      ctx.restore();
      break;
    }

    case 'split-close-vertical': {
      drawSurface(surfA, 1);
      const splitH = p * (height / 2);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width, splitH);
      ctx.rect(0, height - splitH, width, splitH);
      ctx.clip();
      drawSurface(surfB, 1);
      ctx.restore();
      break;
    }

    case 'split-four-corners': {
      drawSurface(surfB, 1);
      const ox = p * width * 0.55;
      const oy = p * height * 0.55;
      const hw = width / 2;
      const hh = height / 2;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, hw, hh); ctx.clip();
      drawSurface(surfA, 1 - p * 0.3, -ox, -oy); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(hw, 0, hw, hh); ctx.clip();
      drawSurface(surfA, 1 - p * 0.3, ox, -oy); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(0, hh, hw, hh); ctx.clip();
      drawSurface(surfA, 1 - p * 0.3, -ox, oy); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(hw, hh, hw, hh); ctx.clip();
      drawSurface(surfA, 1 - p * 0.3, ox, oy); ctx.restore();
      break;
    }

    case 'split-four-pinch': {
      drawSurface(surfA, 1);
      const ox = (1 - p) * width * 0.55;
      const oy = (1 - p) * height * 0.55;
      const hw = width / 2;
      const hh = height / 2;
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, hw, hh); ctx.clip();
      drawSurface(surfB, p, -ox, -oy); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(hw, 0, hw, hh); ctx.clip();
      drawSurface(surfB, p, ox, -oy); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(0, hh, hw, hh); ctx.clip();
      drawSurface(surfB, p, -ox, oy); ctx.restore();
      ctx.save(); ctx.beginPath(); ctx.rect(hw, hh, hw, hh); ctx.clip();
      drawSurface(surfB, p, ox, oy); ctx.restore();
      break;
    }

    case 'band-slide-horizontal': {
      const stripes = 6;
      const sh = height / stripes;
      for (let i = 0; i < stripes; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, i * sh, width, sh);
        ctx.clip();
        drawSurface(surfA, 1, dir * p * width, 0);
        drawSurface(surfB, 1, -dir * (1 - p) * width, 0);
        ctx.restore();
      }
      break;
    }

    case 'band-slide-vertical': {
      const stripes = 8;
      const sw = width / stripes;
      for (let i = 0; i < stripes; i++) {
        const dir = i % 2 === 0 ? 1 : -1;
        ctx.save();
        ctx.beginPath();
        ctx.rect(i * sw, 0, sw, height);
        ctx.clip();
        drawSurface(surfA, 1, 0, dir * p * height);
        drawSurface(surfB, 1, 0, -dir * (1 - p) * height);
        ctx.restore();
      }
      break;
    }

    case 'multi-slice-push-h': {
      const slices = 4;
      const sh = height / slices;
      for (let i = 0; i < slices; i++) {
        const sliceP = Math.max(0, Math.min(1, (p - i * 0.08) / 0.76));
        ctx.save();
        ctx.beginPath();
        ctx.rect(0, i * sh, width, sh);
        ctx.clip();
        drawSurface(surfA, 1, -sliceP * width, 0);
        drawSurface(surfB, 1, (1 - sliceP) * width, 0);
        ctx.restore();
      }
      break;
    }

    case 'multi-slice-push-v': {
      const slices = 4;
      const sw = width / slices;
      for (let i = 0; i < slices; i++) {
        const sliceP = Math.max(0, Math.min(1, (p - i * 0.08) / 0.76));
        ctx.save();
        ctx.beginPath();
        ctx.rect(i * sw, 0, sw, height);
        ctx.clip();
        drawSurface(surfA, 1, 0, -sliceP * height);
        drawSurface(surfB, 1, 0, (1 - sliceP) * height);
        ctx.restore();
      }
      break;
    }

    case 'elastic-push-left': {
      const c4 = (2 * Math.PI) / 3;
      const elasticP = p === 0 ? 0 : p === 1 ? 1 : Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * c4) + 1;
      drawSurface(surfA, 1, -elasticP * width, 0);
      drawSurface(surfB, 1, (1 - elasticP) * width, 0);
      break;
    }

    case 'elastic-push-right': {
      const c4 = (2 * Math.PI) / 3;
      const elasticP = p === 0 ? 0 : p === 1 ? 1 : Math.pow(2, -10 * p) * Math.sin((p * 10 - 0.75) * c4) + 1;
      drawSurface(surfA, 1, elasticP * width, 0);
      drawSurface(surfB, 1, -(1 - elasticP) * width, 0);
      break;
    }

    // ==========================================
    // 3. SİLME, PANJUR & MASKE (Wipe & Masks)
    // ==========================================
    case 'wipe-left': {
      drawSurface(surfA, 1);
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, width * p, height);
      ctx.clip();
      drawSurface(surfB, 1);
      ctx.restore();
      break;
    }

    case 'wipe-right': {
      drawSurface(surfA, 1);
      ctx.save();
      ctx.beginPath();
      ctx.rect(width * (1 - p), 0, width * p, height);
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
      const progress = p * 2;
      ctx.moveTo(0, 0);
      ctx.lineTo(progress * width, 0);
      ctx.lineTo(0, progress * height);
      ctx.closePath();
      ctx.clip();
      drawSurface(surfB, 1);
      ctx.restore();
      break;
    }

    case 'diagonal-wipe-reverse': {
      drawSurface(surfA, 1);
      ctx.save();
      ctx.beginPath();
      const progress = p * 2;
      ctx.moveTo(width, 0);
      ctx.lineTo(width - progress * width, 0);
      ctx.lineTo(width, progress * height);
      ctx.closePath();
      ctx.clip();
      drawSurface(surfB, 1);
      ctx.restore();
      break;
    }

    case 'circle-reveal': {
      drawSurface(surfA, 1);
      ctx.save();
      ctx.beginPath();
      const maxR = Math.hypot(width, height) / 2;
      ctx.arc(width / 2, height / 2, maxR * p, 0, Math.PI * 2);
      ctx.clip();
      drawSurface(surfB, 1);
      ctx.restore();
      break;
    }

    case 'iris-in':
    case 'circle-close':
    case 'iris-out': {
      drawSurface(surfB, 1);
      ctx.save();
      ctx.beginPath();
      const maxR = Math.hypot(width, height) / 2;
      ctx.arc(width / 2, height / 2, maxR * (1 - p), 0, Math.PI * 2);
      ctx.clip();
      drawSurface(surfA, 1);
      ctx.restore();
      break;
    }

    case 'iris-diamond': {
      drawSurface(surfA, 1);
      ctx.save();
      const r = Math.hypot(width, height) * p * 0.85;
      ctx.beginPath();
      ctx.moveTo(width / 2, height / 2 - r);
      ctx.lineTo(width / 2 + r, height / 2);
      ctx.lineTo(width / 2, height / 2 + r);
      ctx.lineTo(width / 2 - r, height / 2);
      ctx.closePath();
      ctx.clip();
      drawSurface(surfB, 1);
      ctx.restore();
      break;
    }

    case 'iris-hexagon': {
      drawSurface(surfA, 1);
      ctx.save();
      const r = Math.hypot(width, height) * p * 0.65;
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (i * Math.PI) / 3;
        const hx = width / 2 + r * Math.cos(ang);
        const hy = height / 2 + r * Math.sin(ang);
        if (i === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.clip();
      drawSurface(surfB, 1);
      ctx.restore();
      break;
    }

    case 'iris-star': {
      drawSurface(surfA, 1);
      ctx.save();
      const outerR = Math.hypot(width, height) * p * 0.75;
      const innerR = outerR * 0.42;
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 === 0 ? outerR : innerR;
        const ang = (i * Math.PI) / 5 - Math.PI / 2;
        const sx = width / 2 + r * Math.cos(ang);
        const sy = height / 2 + r * Math.sin(ang);
        if (i === 0) ctx.moveTo(sx, sy);
        else ctx.lineTo(sx, sy);
      }
      ctx.closePath();
      ctx.clip();
      drawSurface(surfB, 1);
      ctx.restore();
      break;
    }

    case 'iris-heart': {
      drawSurface(surfA, 1);
      ctx.save();
      const scale = p * Math.hypot(width, height) * 0.045;
      ctx.translate(width / 2, height / 2 + scale * 4);
      ctx.beginPath();
      for (let t = 0; t <= Math.PI * 2; t += 0.05) {
        const hx = 16 * Math.pow(Math.sin(t), 3) * scale;
        const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t)) * scale;
        if (t === 0) ctx.moveTo(hx, hy);
        else ctx.lineTo(hx, hy);
      }
      ctx.closePath();
      ctx.clip();
      ctx.translate(-width / 2, -(height / 2 + scale * 4));
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

    case 'radial-counter-clock': {
      drawSurface(surfA, 1);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(width / 2, height / 2);
      ctx.arc(
        width / 2,
        height / 2,
        Math.hypot(width, height),
        -Math.PI / 2,
        -Math.PI / 2 - p * 2 * Math.PI,
        true
      );
      ctx.closePath();
      ctx.clip();
      drawSurface(surfB, 1);
      ctx.restore();
      break;
    }

    case 'radial-dual-wipe': {
      drawSurface(surfA, 1);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(width / 2, height / 2);
      ctx.arc(width / 2, height / 2, Math.hypot(width, height), -Math.PI / 2, -Math.PI / 2 + p * Math.PI);
      ctx.closePath();
      ctx.moveTo(width / 2, height / 2);
      ctx.arc(width / 2, height / 2, Math.hypot(width, height), Math.PI / 2, Math.PI / 2 + p * Math.PI);
      ctx.closePath();
      ctx.clip();
      drawSurface(surfB, 1);
      ctx.restore();
      break;
    }

    case 'radial-quad-wipe': {
      drawSurface(surfA, 1);
      ctx.save();
      ctx.beginPath();
      for (let k = 0; k < 4; k++) {
        const startAng = (k * Math.PI) / 2;
        ctx.moveTo(width / 2, height / 2);
        ctx.arc(width / 2, height / 2, Math.hypot(width, height), startAng, startAng + p * (Math.PI / 2));
        ctx.closePath();
      }
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

    case 'venetian-blinds-v': {
      drawSurface(surfA, 1);
      const slatCount = 12;
      const slatW = width / slatCount;
      ctx.save();
      ctx.beginPath();
      for (let i = 0; i < slatCount; i++) {
        ctx.rect(i * slatW, 0, slatW * p, height);
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

    case 'checkerboard-diagonal': {
      drawSurface(surfA, 1);
      const cols = 10;
      const rows = 6;
      const cw = width / cols;
      const ch = height / rows;
      ctx.save();
      ctx.beginPath();
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const diagIdx = (r + c) / (rows + cols - 2);
          if (p >= diagIdx * 0.85) {
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
      ctx.save();
      ctx.globalAlpha = p;
      drawSurface(surfB, 1);
      ctx.restore();
      break;
    }

    case 'circle-wipe-rings': {
      drawSurface(surfA, 1);
      ctx.save();
      ctx.beginPath();
      const ringCount = 5;
      const maxR = Math.hypot(width, height) / 2;
      for (let i = 0; i < ringCount; i++) {
        const ringP = Math.max(0, Math.min(1, (p - i * 0.12) / 0.52));
        if (ringP > 0) {
          ctx.arc(width / 2, height / 2, ringP * maxR * ((i + 1) / ringCount), 0, Math.PI * 2);
        }
      }
      ctx.clip();
      drawSurface(surfB, 1);
      ctx.restore();
      break;
    }

    case 'spiral-wipe': {
      drawSurface(surfA, 1);
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(width / 2, height / 2);
      const maxAngle = p * Math.PI * 4;
      const maxR = Math.hypot(width, height) / 2;
      for (let a = 0; a <= maxAngle; a += 0.1) {
        const r = (a / (Math.PI * 4)) * maxR;
        ctx.lineTo(width / 2 + r * Math.cos(a), height / 2 + r * Math.sin(a));
      }
      ctx.arc(width / 2, height / 2, maxR * p, maxAngle, maxAngle + Math.PI * 2);
      ctx.closePath();
      ctx.clip();
      drawSurface(surfB, 1);
      ctx.restore();
      break;
    }

    case 'box-zoom-mask': {
      drawSurface(surfA, 1);
      ctx.save();
      const bw = width * p;
      const bh = height * p;
      ctx.beginPath();
      ctx.rect((width - bw) / 2, (height - bh) / 2, bw, bh);
      ctx.clip();
      drawSurface(surfB, 1);
      ctx.restore();
      break;
    }

    // ==========================================
    // 4. KAMERA HAREKETİ, WHIP PAN & 3D
    // ==========================================
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

    case 'zoom-punch': {
      const punchBlur = Math.round(Math.sin(p * Math.PI) * 16);
      ctx.save();
      if (punchBlur > 0) ctx.filter = `blur(${punchBlur}px)`;
      if (p < 0.48) {
        const zoomP = p / 0.48;
        const scale = 1.0 + Math.pow(zoomP, 2) * 0.65;
        drawSurface(surfA, 1 - Math.pow(zoomP, 3) * 0.3, 0, 0, scale);
      } else {
        const punchP = (p - 0.48) / 0.52;
        const scale = 1.0 + Math.sin((1 - punchP) * Math.PI) * 0.4;
        drawSurface(surfA, Math.max(0, 1 - punchP * 4), 0, 0, scale + 0.3);
        drawSurface(surfB, Math.min(1, punchP * 2), 0, 0, scale);
      }
      ctx.restore();
      break;
    }

    case 'zoom-blur': {
      const blurFactor = Math.sin(p * Math.PI) * 20;
      ctx.save();
      if (blurFactor > 0) ctx.filter = `blur(${Math.round(blurFactor)}px)`;
      drawSurface(surfA, 1 - p, 0, 0, 1 + p * 0.4);
      drawSurface(surfB, p, 0, 0, 1.4 - p * 0.4);
      ctx.restore();
      break;
    }

    case 'whip-pan': {
      const dir = options?.direction || 'left';
      const easeP = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const blurPx = Math.round(Math.sin(p * Math.PI) * 20);
      ctx.save();
      if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;
      if (dir === 'right') {
        drawSurface(surfA, 1, easeP * width, 0);
        drawSurface(surfB, 1, -(1 - easeP) * width, 0);
      } else if (dir === 'up') {
        drawSurface(surfA, 1, 0, -easeP * height);
        drawSurface(surfB, 1, 0, (1 - easeP) * height);
      } else if (dir === 'down') {
        drawSurface(surfA, 1, 0, easeP * height);
        drawSurface(surfB, 1, 0, -(1 - easeP) * height);
      } else {
        drawSurface(surfA, 1, -easeP * width, 0);
        drawSurface(surfB, 1, (1 - easeP) * width, 0);
      }
      ctx.restore();
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

    case 'whip-pan-diagonal-tl': {
      const easeP = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const blurPx = Math.round(Math.sin(p * Math.PI) * 16);
      ctx.save();
      if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;
      drawSurface(surfA, 1, -easeP * width, -easeP * height);
      drawSurface(surfB, 1, (1 - easeP) * width, (1 - easeP) * height);
      ctx.restore();
      break;
    }

    case 'whip-pan-diagonal-tr': {
      const easeP = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      const blurPx = Math.round(Math.sin(p * Math.PI) * 16);
      ctx.save();
      if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;
      drawSurface(surfA, 1, easeP * width, -easeP * height);
      drawSurface(surfB, 1, -(1 - easeP) * width, (1 - easeP) * height);
      ctx.restore();
      break;
    }

    case 'spin':
    case 'spin-cw': {
      const scaleDip = 1 - Math.sin(p * Math.PI) * 0.25;
      drawSurface(surfA, 1 - p, 0, 0, scaleDip, p * 180);
      drawSurface(surfB, p, 0, 0, scaleDip, (p - 1) * 180);
      break;
    }

    case 'spin-ccw': {
      const scaleDip = 1 - Math.sin(p * Math.PI) * 0.25;
      drawSurface(surfA, 1 - p, 0, 0, scaleDip, -p * 180);
      drawSurface(surfB, p, 0, 0, scaleDip, -(p - 1) * 180);
      break;
    }

    case 'spin-zoom': {
      const scale = 1.0 + Math.sin(p * Math.PI) * 0.7;
      const blurPx = Math.round(Math.sin(p * Math.PI) * 12);
      ctx.save();
      if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;
      drawSurface(surfA, 1 - p, 0, 0, scale, p * 360);
      drawSurface(surfB, p, 0, 0, 2.0 - p * 1.0, (p - 1) * 360);
      ctx.restore();
      break;
    }

    case 'flip-horizontal': {
      if (p <= 0.5) {
        const sX = Math.max(0.01, 1 - p * 2);
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(sX, 1);
        ctx.drawImage(surfA, -width / 2, -height / 2, width, height);
        ctx.restore();
      } else {
        const sX = Math.max(0.01, (p - 0.5) * 2);
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
        const sY = Math.max(0.01, 1 - p * 2);
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(1, sY);
        ctx.drawImage(surfA, -width / 2, -height / 2, width, height);
        ctx.restore();
      } else {
        const sY = Math.max(0.01, (p - 0.5) * 2);
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(1, sY);
        ctx.drawImage(surfB, -width / 2, -height / 2, width, height);
        ctx.restore();
      }
      break;
    }

    case 'cube-rotate-left': {
      if (p <= 0.5) {
        const sX = Math.cos(p * Math.PI);
        const shiftX = -Math.sin(p * Math.PI) * (width * 0.25);
        ctx.save();
        ctx.translate(width / 2 + shiftX, height / 2);
        ctx.scale(sX, 1 - p * 0.2);
        ctx.drawImage(surfA, -width / 2, -height / 2, width, height);
        ctx.restore();
      } else {
        const sX = Math.sin((p - 0.5) * Math.PI);
        const shiftX = Math.cos((p - 0.5) * Math.PI) * (width * 0.25);
        ctx.save();
        ctx.translate(width / 2 + shiftX, height / 2);
        ctx.scale(sX, 0.8 + (p - 0.5) * 0.4);
        ctx.drawImage(surfB, -width / 2, -height / 2, width, height);
        ctx.restore();
      }
      break;
    }

    case 'cube-rotate-right': {
      if (p <= 0.5) {
        const sX = Math.cos(p * Math.PI);
        const shiftX = Math.sin(p * Math.PI) * (width * 0.25);
        ctx.save();
        ctx.translate(width / 2 + shiftX, height / 2);
        ctx.scale(sX, 1 - p * 0.2);
        ctx.drawImage(surfA, -width / 2, -height / 2, width, height);
        ctx.restore();
      } else {
        const sX = Math.sin((p - 0.5) * Math.PI);
        const shiftX = -Math.cos((p - 0.5) * Math.PI) * (width * 0.25);
        ctx.save();
        ctx.translate(width / 2 + shiftX, height / 2);
        ctx.scale(sX, 0.8 + (p - 0.5) * 0.4);
        ctx.drawImage(surfB, -width / 2, -height / 2, width, height);
        ctx.restore();
      }
      break;
    }

    case 'door-swing-open': {
      drawSurface(surfB, 1);
      ctx.save();
      const sX = Math.max(0.01, 1 - p);
      ctx.translate(0, height / 2);
      ctx.scale(sX, 1 - p * 0.15);
      ctx.drawImage(surfA, 0, -height / 2, width, height);
      ctx.restore();
      break;
    }

    case 'camera-shake-impact': {
      const intensity = Math.sin(p * Math.PI) * 25;
      const jx = Math.sin(p * 50) * intensity;
      const jy = Math.cos(p * 45) * intensity;
      if (p < 0.5) drawSurface(surfA, 1, jx, jy);
      else drawSurface(surfB, 1, jx, jy);
      break;
    }

    // ==========================================
    // 5. SİNEMATİK, DİJİTAL & GLITCH
    // ==========================================
    case 'light-leak': {
      drawSurface(surfA, 1 - p);
      drawSurface(surfB, p);
      const intensity = Math.sin(p * Math.PI);
      if (intensity > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const grad = ctx.createRadialGradient(
          width * (0.2 + p * 0.6),
          height * 0.3,
          10,
          width * (0.2 + p * 0.6),
          height * 0.3,
          width * 0.75
        );
        grad.addColorStop(0, `rgba(255, 230, 150, ${intensity * 0.9})`);
        grad.addColorStop(0.4, `rgba(255, 120, 50, ${intensity * 0.6})`);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
      break;
    }

    case 'light-leak-rainbow': {
      drawSurface(surfA, 1 - p);
      drawSurface(surfB, p);
      const intensity = Math.sin(p * Math.PI);
      if (intensity > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, `rgba(239, 68, 68, ${intensity * 0.7})`);
        grad.addColorStop(0.3, `rgba(234, 179, 8, ${intensity * 0.7})`);
        grad.addColorStop(0.6, `rgba(34, 197, 94, ${intensity * 0.7})`);
        grad.addColorStop(1, `rgba(59, 130, 246, ${intensity * 0.7})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
      break;
    }

    case 'light-leak-blue': {
      drawSurface(surfA, 1 - p);
      drawSurface(surfB, p);
      const intensity = Math.sin(p * Math.PI);
      if (intensity > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const grad = ctx.createLinearGradient(0, height * 0.35, width, height * 0.65);
        grad.addColorStop(0, 'rgba(6, 182, 212, 0)');
        grad.addColorStop(0.5, `rgba(56, 189, 248, ${intensity * 0.85})`);
        grad.addColorStop(1, 'rgba(99, 102, 241, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, height * 0.3, width, height * 0.4);
        ctx.restore();
      }
      break;
    }

    case 'film-burn': {
      drawSurface(surfA, 1 - p);
      drawSurface(surfB, p);
      const intensity = Math.sin(p * Math.PI);
      if (intensity > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const grad1 = ctx.createRadialGradient(
          width * 0.8,
          height * 0.8,
          20,
          width * 0.8,
          height * 0.8,
          width * 0.6
        );
        grad1.addColorStop(0, `rgba(255, 255, 200, ${intensity * 0.95})`);
        grad1.addColorStop(0.3, `rgba(255, 80, 0, ${intensity * 0.85})`);
        grad1.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = grad1;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
      break;
    }

    case 'film-burn-edges': {
      drawSurface(surfA, 1 - p);
      drawSurface(surfB, p);
      const intensity = Math.sin(p * Math.PI);
      if (intensity > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const grad = ctx.createRadialGradient(width/2, height/2, width*0.3, width/2, height/2, width*0.7);
        grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
        grad.addColorStop(1, `rgba(249, 115, 22, ${intensity * 0.9})`);
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
      break;
    }

    case 'lens-flare': {
      drawSurface(surfA, 1 - p);
      drawSurface(surfB, p);
      const intensity = Math.sin(p * Math.PI);
      if (intensity > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        ctx.fillStyle = `rgba(255, 255, 255, ${intensity * 0.8})`;
        ctx.fillRect(0, height / 2 - 3, width, 6);
        ctx.restore();
      }
      break;
    }

    case 'chromatic-flare': {
      const shift = Math.round(Math.sin(p * Math.PI) * 18);
      drawSurface(surfA, 1 - p, -shift * 0.4, 0);
      drawSurface(surfB, p, shift * 0.4, 0);
      const flare = Math.pow(Math.sin(p * Math.PI), 2) * 0.9;
      if (flare > 0.05) {
        ctx.save();
        ctx.globalCompositeOperation = 'screen';
        const grad = ctx.createLinearGradient(0, height / 2 - 15, 0, height / 2 + 15);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        grad.addColorStop(0.5, `rgba(255, 255, 255, ${flare})`);
        grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, height / 2 - 20, width, 40);
        ctx.restore();
      }
      break;
    }

    case 'glitch': {
      drawSurface(surfA, 1 - p);
      drawSurface(surfB, p);
      const intensity = Math.sin(p * Math.PI);
      if (intensity > 0.08) {
        ctx.save();
        const sliceCount = 8;
        const sliceH = height / sliceCount;
        for (let i = 0; i < sliceCount; i++) {
          if (i % 2 === 1) {
            const shiftX = (Math.sin(i * 99 + p * 10) * 28 * intensity);
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, i * sliceH, width, sliceH);
            ctx.clip();
            if (p < 0.5) drawSurface(surfA, 1, shiftX, 0);
            else drawSurface(surfB, 1, shiftX, 0);
            ctx.restore();
          }
        }
        ctx.fillStyle = `rgba(0, 255, 255, ${intensity * 0.25})`;
        ctx.fillRect(0, height * 0.25, width, 4);
        ctx.fillStyle = `rgba(255, 0, 128, ${intensity * 0.25})`;
        ctx.fillRect(0, height * 0.7, width, 4);
        ctx.restore();
      }
      break;
    }

    case 'glitch-line-tear': {
      drawSurface(surfA, 1 - p);
      drawSurface(surfB, p);
      const intensity = Math.sin(p * Math.PI);
      if (intensity > 0.08) {
        const bands = 8;
        const bh = height / bands;
        for (let b = 0; b < bands; b++) {
          if (b % 2 === 1) {
            const shift = (Math.sin(b * 12.3 + p * 30) * 35 * intensity);
            ctx.save();
            ctx.beginPath();
            ctx.rect(0, b * bh, width, bh);
            ctx.clip();
            if (p < 0.5) drawSurface(surfA, 1, shift, 0);
            else drawSurface(surfB, 1, shift, 0);
            ctx.restore();
          }
        }
      }
      break;
    }

    case 'rgb-split': {
      const shift = Math.round(Math.sin(p * Math.PI) * 16);
      drawSurface(surfA, 1 - p, -shift, 0);
      drawSurface(surfB, p, shift, 0);
      break;
    }

    case 'pixel-dissolve': {
      drawSurface(surfA, 1 - p);
      drawSurface(surfB, p);
      break;
    }

    case 'pixel-sort': {
      drawSurface(surfA, 1 - p);
      drawSurface(surfB, p);
      const intensity = Math.sin(p * Math.PI);
      if (intensity > 0.05) {
        const columns = 20;
        const colW = width / columns;
        ctx.save();
        for (let c = 0; c < columns; c++) {
          const streakLen = Math.abs(Math.sin(c * 7.1 + p * 15)) * height * 0.45 * intensity;
          const startY = (c % 2 === 0) ? 0 : height - streakLen;
          ctx.fillStyle = c % 2 === 0 ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.35)';
          ctx.fillRect(c * colW, startY, colW * 0.8, streakLen);
        }
        ctx.restore();
      }
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

    case 'crt-tv-off': {
      if (p < 0.48) {
        const collapseY = Math.pow(1 - p / 0.48, 2);
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(1, Math.max(0.015, collapseY));
        ctx.drawImage(surfA, -width / 2, -height / 2, width, height);
        ctx.restore();
      } else if (p < 0.6) {
        const lineP = (p - 0.48) / 0.12;
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = '#ffffff';
        const lineW = width * (1 - lineP * 0.85);
        ctx.fillRect((width - lineW) / 2, height / 2 - 2, lineW, 4);
      } else {
        const openP = (p - 0.6) / 0.4;
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.scale(Math.min(1, openP * 1.5), Math.min(1, openP * 1.5));
        ctx.drawImage(surfB, -width / 2, -height / 2, width, height);
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

    case 'directional-blur': {
      const blurPx = Math.round(Math.sin(p * Math.PI) * 22);
      ctx.save();
      if (blurPx > 0) ctx.filter = `blur(${blurPx}px)`;
      drawSurface(surfA, 1 - p);
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

    case 'kaleidoscope-hex': {
      drawSurface(surfA, 1 - p);
      ctx.save();
      ctx.globalAlpha = p;
      const angleStep = Math.PI / 3;
      for (let i = 0; i < 6; i++) {
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.rotate(i * angleStep + p * Math.PI * 0.5);
        ctx.drawImage(surfB, -width / 4, -height / 4, width / 2, height / 2);
        ctx.restore();
      }
      ctx.restore();
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

    case 'datamosh-melt': {
      drawSurface(surfA, 1);
      const slices = 16;
      const sw = width / slices;
      ctx.save();
      for (let s = 0; s < slices; s++) {
        const meltY = Math.pow(p, 1.8) * height * (0.4 + (s % 4) * 0.2);
        ctx.beginPath();
        ctx.rect(s * sw, 0, sw, height);
        ctx.clip();
        drawSurface(surfB, p, 0, -height + meltY);
      }
      ctx.restore();
      break;
    }

    default: {
      drawSurface(surfA, 1);
      drawSurface(surfB, p);
      break;
    }
  }

  ctx.restore();
}

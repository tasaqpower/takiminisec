/**
 * FORMA Professional Video Editor — Type Definitions
 * Non-destructive, multi-track, client-side project model
 */

export type TrackType = 'video' | 'audio' | 'text' | 'image' | 'subtitle';

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5' | '3:4' | 'custom';
export type ResolutionPreset = '480p' | '720p' | '1080p' | '4K' | 'original' | 'custom';

export type TransitionType =
  // Temel (Basic)
  | 'none'
  | 'cut'
  | 'crossfade'
  | 'fade-black'
  | 'fade-white'
  | 'fade-through-blur'
  | 'dissolve'
  // Kaydırma ve İtme (Slide & Push)
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'push-left'
  | 'push-right'
  | 'push-up'
  | 'push-down'
  | 'whip-pan-left'
  | 'whip-pan-right'
  // Perde ve Maske (Wipe & Mask)
  | 'wipe-left'
  | 'wipe-right'
  | 'wipe-up'
  | 'wipe-down'
  | 'diagonal-wipe'
  | 'circle-reveal'
  | 'circle-close'
  | 'soft-mask-reveal'
  // Kamera ve Hareket (Camera & Motion)
  | 'zoom-in'
  | 'zoom-out'
  | 'zoom-blur'
  | 'spin'
  | 'flip-horizontal'
  | 'flip-vertical'
  // Stilize (Stylized)
  | 'blur-dissolve'
  | 'pixel-dissolve'
  | 'rgb-split'
  | 'glitch'
  | 'light-leak'
  | 'film-burn'
  | 'flash'
  | 'vhs-distortion';

export interface Transition {
  type: TransitionType;
  duration: number; // in seconds
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  intensity?: number;
  direction?: 'left' | 'right' | 'up' | 'down';
}

export interface TimelineTransition {
  id: string;
  trackId: string;
  type: TransitionType;
  duration: number;
  cutTime: number; // Cut time position on timeline
  leftClipId?: string;
  rightClipId?: string;
  alignment: 'between' | 'in' | 'out';
  easing?: 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out';
  intensity?: number;
  direction?: 'left' | 'right' | 'up' | 'down';
}

export interface EffectSegment {
  id: string;
  effectId: string;
  effectKind: 'filter' | 'blur' | 'distortion' | 'color' | 'stylize';
  name: string;
  targetClipId?: string;
  trackId?: string;
  startTime: number;
  duration: number;
  parameters: Record<string, any>;
  enabled: boolean;
  blendMode?: string;
  createdAt: number;
}

export interface TextAnimationSegment {
  id: string;
  type: 'in' | 'loop' | 'out';
  animationName: string;
  startTime: number; // Offset relative to text clip start (seconds)
  duration: number;
  easing?: TextEasingType;
  speed?: number;
  intensity?: number;
  delay?: number;
}

export type DragPayloadType =
  | 'transition'
  | 'video-effect'
  | 'text-animation'
  | 'title-template'
  | 'audio-sfx'
  | 'overlay'
  | 'filter-preset'
  | 'video'
  | 'audio'
  | 'image'
  | 'media';

export interface DragPayload {
  type: DragPayloadType;
  id: string;
  name: string;
  icon?: string;
  duration?: number;
  category?: string;
  data?: any;
}

export type TextInAnimationType =
  | 'none'
  | 'fade'
  | 'slide-up'
  | 'slide-down'
  | 'slide-left'
  | 'slide-right'
  | 'scale'
  | 'pop'
  | 'bounce-in'
  | 'bounce-drop'
  | 'elastic-in'
  | 'blur-in'
  | 'rotate-in'
  | 'flip-in'
  | 'flip'
  | 'mask-reveal'
  | 'wipe-reveal'
  | 'tracking-in'
  | 'tracking'
  | 'typewriter'
  | 'word-by-word'
  | 'char-cascade'
  | 'char-by-char'
  | 'glitch-in'
  | 'glitch'
  | 'neon-flicker-in'
  | 'neon-flash'
  | 'wave'
  | 'crash-zoom';

export type TextLoopAnimationType =
  | 'none'
  | 'pulse'
  | 'heartbeat'
  | 'float'
  | 'gentle-shake'
  | 'wiggle'
  | 'shimmer'
  | 'breathing'
  | 'neon-flicker'
  | 'glow-breathe'
  | 'wave'
  | 'subtle-zoom'
  | 'color-sweep'
  | 'jitter'
  | 'strobe'
  | 'spin-slow';

export type TextOutAnimationType =
  | 'none'
  | 'fade'
  | 'slide-down'
  | 'slide-up'
  | 'slide-left'
  | 'slide-right'
  | 'scale-down'
  | 'pop-out'
  | 'blur-out'
  | 'rotate-out'
  | 'flip-out'
  | 'mask-close'
  | 'typewriter-erase'
  | 'char-scatter'
  | 'glitch-out'
  | 'crash-out';

export type TextEasingType =
  | 'linear'
  | 'ease-in'
  | 'ease-out'
  | 'ease-in-out'
  | 'back'
  | 'elastic'
  | 'bounce';

export type TextAnimationType = TextInAnimationType;

export interface TextLayerData {
  text: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: 'normal' | 'bold' | '100' | '200' | '300' | '400' | '500' | '600' | '700' | '800' | '900' | number;
  fontStyle?: 'normal' | 'italic';
  underline?: boolean;
  color?: string;
  fillColor?: string;
  fill?: string;
  position?: { x: number; y: number };
  strokeColor?: string;
  strokeWidth?: number;
  boxColor?: string;
  backgroundColor?: string;
  backgroundOpacity?: number;
  padding?: number;
  paddingX?: number;
  paddingY?: number;
  boxPadding?: number;
  borderRadius?: number;
  boxRadius?: number;
  alignment?: 'left' | 'center' | 'right';
  textAlign?: 'left' | 'center' | 'right';
  letterSpacing?: number;
  lineHeight?: number;
  textTransform?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
  verticalAlign?: 'top' | 'middle' | 'bottom';
  shadow?: {
    color: string;
    blur: number;
    offsetX: number;
    offsetY: number;
  };
  shadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
  // Unified Animation Properties
  inAnimation?: TextInAnimationType;
  inDuration?: number;
  inDelay?: number;
  inEasing?: TextEasingType;
  loopAnimation?: TextLoopAnimationType;
  loopSpeed?: number;
  loopIntensity?: number;
  outAnimation?: TextOutAnimationType;
  outDuration?: number;
  outEasing?: TextEasingType;
  animation?: {
    type?: TextAnimationType | string;
    duration?: number;
    [key: string]: any;
  } | string;
}

export interface SubtitleItem {
  id: string;
  start: number;
  end: number;
  text: string;
}

export interface ChromaKeySettings {
  enabled: boolean;
  color: string; // hex color e.g. '#00FF00'
  similarity: number; // 0.0 to 1.0 (default 0.35)
  smoothness: number; // 0.0 to 1.0 (default 0.1)
}

export interface MaskSettings {
  type: 'none' | 'circle' | 'rounded-rect' | 'star' | 'heart';
  radius?: number; // for rounded-rect (in px)
}

export interface CropSettings {
  top: number;    // % 0-50
  right: number;  // % 0-50
  bottom: number; // % 0-50
  left: number;   // % 0-50
}

export interface ClipEffects {
  brightness?: number;   // -1 to 1 or 0 to 2
  contrast?: number;     // 0 to 3
  saturation?: number;   // 0 to 3
  exposure?: number;     // -1 to 1
  temperature?: number;  // -100 to 100
  tint?: number;         // -1 to 1
  shadows?: number;      // -1 to 1
  highlights?: number;   // -1 to 1
  sharpness?: number;    // 0 to 1
  blur?: number;         // 0 to 20 px
  grayscale?: number;    // 0 to 1
  sepia?: number;        // 0 to 1
  vignette?: number;     // 0 to 1
  chromaKey?: ChromaKeySettings;
  mask?: MaskSettings;
  crop?: CropSettings;
}

export interface Keyframe {
  id: string;
  time: number; // relative to clip start (0 to clip.duration)
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  opacity?: number;
  easing?: 'linear' | 'ease-in-out';
}

export interface Transform2D {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
  scale?: number;
  rotation: number;
  opacity: number;
}

export interface MediaAsset {
  id: string;
  name: string;
  type: 'video' | 'audio' | 'image';
  mimeType: string;
  size: number;
  url?: string;
  blob?: Blob | File;
  file?: File;
  duration: number;
  width?: number;
  height?: number;
  thumbnailUrl?: string;
  waveform?: number[];
  sampleRate?: number;
  channels?: number;
}

export interface VideoClip {
  id: string;
  trackId: string;
  assetId?: string;
  type: TrackType;
  name: string;

  // Timeline position
  startTime: number;
  duration: number;

  // Trimming
  trimIn: number;
  trimOut: number;
  sourceDuration?: number;
  sourceUrl?: string;

  // Playback
  speed?: number;
  isReversed?: boolean;

  // Audio
  volume?: number;
  muted?: boolean;
  fadeIn?: number;
  fadeOut?: number;

  // Transform
  transform?: Transform2D;

  // Effects & transitions
  effects?: Partial<ClipEffects>;
  transitionIn?: Transition;
  transitionOut?: Transition;
  keyframes?: Keyframe[];

  // Text
  textData?: TextLayerData;
  animationSegments?: TextAnimationSegment[];

  // Effect segments on this clip
  effectSegments?: EffectSegment[];

  // Compatibility fields
  start?: number;
  isMuted?: boolean;
  x?: number;
  y?: number;
  scaleX?: number;
  scaleY?: number;
  rotation?: number;
  opacity?: number;
  flipH?: boolean;
  flipV?: boolean;
  fitMode?: 'fit' | 'fill' | 'custom';
  cornerRadius?: number;
}

export interface TimelineTrack {
  id: string;
  name: string;
  type: TrackType;
  clips: VideoClip[];
  muted: boolean;
  locked: boolean;
  visible: boolean;

  // Track-level transitions between clips
  transitions?: TimelineTransition[];

  // Track-level effect segments
  effectSegments?: EffectSegment[];

  // Compatibility
  order?: number;
  isMuted?: boolean;
  isLocked?: boolean;
  isHidden?: boolean;
}

export interface CanvasSettings {
  aspectRatio?: AspectRatio;
  resolution?: ResolutionPreset;
  width: number;
  height: number;
  fps: number;
  backgroundColor: string;
  blurBackground?: boolean;
}

export interface VideoProject {
  id: string;
  name: string;
  title?: string;
  createdAt: number;
  updatedAt: number;
  duration: number;
  currentTime?: number;
  fps: number;
  resolution: { width: number; height: number };
  backgroundColor?: string;
  tracks: TimelineTrack[];

  // Global transitions & effect segments (for fast indexing)
  transitions?: TimelineTransition[];
  effectSegments?: EffectSegment[];

  // Optional collections
  clips?: Record<string, VideoClip>;
  assets?: Record<string, MediaAsset>;
  subtitles?: SubtitleItem[];
  canvas?: CanvasSettings;
}

export type ExportFormat = 'mp4' | 'webm' | 'gif' | 'mp3' | 'wav' | 'png';

export interface ExportOptions {
  format: ExportFormat;
  resolution: { width: number; height: number };
  fps?: number;
  quality?: 'draft' | 'standard' | 'high' | 'ultra';
  filename?: string;
  bitrate?: number;
}


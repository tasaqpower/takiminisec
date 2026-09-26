/**
 * FORMA Professional Video Editor — Type Definitions
 * Non-destructive, multi-track, client-side project model
 */

export type TrackType = 'video' | 'audio' | 'text' | 'image' | 'subtitle';

export type AspectRatio = '16:9' | '9:16' | '1:1' | '4:5' | '3:4' | 'custom';
export type ResolutionPreset = '480p' | '720p' | '1080p' | '4K' | 'original' | 'custom';

export type TransitionType =
  | 'none'
  | 'cut'
  | 'crossfade'
  | 'fade-black'
  | 'fade-white'
  | 'slide-left'
  | 'slide-right'
  | 'slide-up'
  | 'slide-down'
  | 'zoom-in'
  | 'zoom-out'
  | 'blur-dissolve'
  | 'wipe-left'
  | 'wipe-right';

export interface Transition {
  type: TransitionType;
  duration: number; // in seconds
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
  | 'blur-in'
  | 'typewriter'
  | 'word-by-word'
  | 'char-by-char';

export type TextLoopAnimationType =
  | 'none'
  | 'pulse'
  | 'heartbeat'
  | 'float'
  | 'shimmer';

export type TextOutAnimationType =
  | 'none'
  | 'fade'
  | 'slide-down'
  | 'slide-up'
  | 'scale-down'
  | 'blur-out'
  | 'typewriter-erase';

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
}

export interface Keyframe {
  id: string;
  time: number;
  x?: number;
  y?: number;
  scale?: number;
  rotation?: number;
  opacity?: number;
  easing?: 'linear' | 'ease-in-out';
}

export interface Transform2D {
  x: number;
  y: number;
  scaleX: number;
  scaleY: number;
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

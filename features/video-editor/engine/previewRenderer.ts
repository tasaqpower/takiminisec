/**
 * FORMA Video Editor — Preview Renderer
 * High-performance composite scene renderer for the interactive preview canvas
 * Includes flicker-free video frame retention, hardware-accelerated playback sync,
 * exact clip bounding gizmo, full transition support, and typography rasterization.
 */

import type { VideoProject, VideoClip, Keyframe, SpeedRampPreset, TimelineTransition, EffectSegment } from '../types';
import {
  buildCanvasFilterString,
  applyCanvasPostEffects,
  applyVisualEffectSegment,
  getEffectsForColorFilter,
  getCachedCubeLut,
  applyCubeLutToCanvas,
  loadAndCacheCubeLut,
  applyCrispAiSharpness,
} from './filterEngine';
import { computeTransitionState, TransitionState } from './transitionEngine';
import { renderTextLayer } from './textRasterizer';
import { calculateClipBounds } from './clipBounds';
import { getElementSvg, createSvgDataUrl } from '../data/elementPresets';
import { renderAnimatedElement, drawHeartPath } from './animatedElementsRenderer';

export interface RenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  project: VideoProject;
  currentTime: number;
  videoElements: Map<string, HTMLVideoElement>;
  imageElements: Map<string, HTMLImageElement>;
  selectedClipId?: string | null;
  showSafeZones?: boolean;
  isPlaying?: boolean;
  playbackRate?: number;
  isExport?: boolean;
}

// Retain last known good frame per clip to completely eliminate black flashes during seeking
const lastFrameCanvasCache = new Map<string, HTMLCanvasElement>();

// Retain frozen onset frames for Lip-Freeze visual character sync
const lipFreezeCanvasCache = new Map<string, HTMLCanvasElement>();

// Session cache for live object URLs created from IndexedDB / OPFS blobs
export const sessionLiveBlobUrls = new Map<string, string>();

/**
 * Resolves an active, live media URL for a clip.
 * Resilient against dead/stale blob URLs saved in persistent storage (e.g. project recovery).
 */
export async function resolveClipMediaUrl(clip: VideoClip): Promise<string | undefined> {
  // 1. Direct SVG resolution for element stickers, badges and overlays
  if (clip.svgContent) {
    return createSvgDataUrl(clip.svgContent);
  }
  const resolvedSvg = getElementSvg(clip.elementPresetId || clip.assetId, clip.name);
  if (resolvedSvg) {
    return createSvgDataUrl(resolvedSvg);
  }
  if (clip.sourceUrl?.startsWith('data:image/svg+xml')) {
    return clip.sourceUrl;
  }

  // 2. If we already created an active blob URL in this browser session for this asset, reuse it
  if (clip.assetId && sessionLiveBlobUrls.has(clip.assetId)) {
    return sessionLiveBlobUrls.get(clip.assetId);
  }

  // 3. If clip.assetId exists, load the persistent blob from IndexedDB / OPFS!
  // (CRITICAL: Never trust an old blob: URL stored in clip.sourceUrl from a previous session,
  // because the browser revokes all blob: URLs when a page is closed/reloaded.)
  if (clip.assetId) {
    try {
      const { getAssetBlob } = await import('../db');
      const blob = await getAssetBlob(clip.assetId);
      if (blob) {
        const freshUrl = URL.createObjectURL(blob);
        sessionLiveBlobUrls.set(clip.assetId, freshUrl);
        return freshUrl;
      }
    } catch (blobErr) {
      console.warn('[FORMA] Could not load blob for asset from db:', clip.assetId, blobErr);
    }
  }

  // 4. Built-in sample assets fallback
  if (clip.assetId) {
    if (clip.assetId.startsWith('broll-')) {
      return `/video-assets/broll/${clip.assetId}.webm`;
    }
    if (clip.assetId.includes('video') || clip.assetId === '01_video_starter_sample') {
      return `/video-assets/sample-video.webm`;
    }
    if (clip.assetId.startsWith('overlay-')) {
      const name = clip.assetId.replace('overlay-', '');
      return `/video-assets/overlays/${name}.svg`;
    }
    if (clip.assetId.startsWith('element-')) {
      const name = clip.assetId.replace('element-', '');
      const svg = getElementSvg(name) || getElementSvg(clip.assetId);
      if (svg) return createSvgDataUrl(svg);
      return `/video-assets/elements/${name}.svg`;
    }
  }

  // 5. If sourceUrl is a static path or live http/https URL (not a dead blob URL)
  if (clip.sourceUrl && !clip.sourceUrl.startsWith('blob:')) {
    return clip.sourceUrl;
  }

  // 6. If sourceUrl is a blob: URL and we have nothing else, fallback to it
  if (clip.sourceUrl) {
    return clip.sourceUrl;
  }

  return undefined;
}

export function clearLipFreezeCache(clipId?: string): void {
  if (clipId) {
    lipFreezeCanvasCache.delete(clipId);
  } else {
    lipFreezeCanvasCache.clear();
  }
}

export function clearSmoothCutCache(clipId?: string): void {
  if (clipId) {
    lastFrameCanvasCache.delete(clipId);
  } else {
    lastFrameCanvasCache.clear();
  }
}

// Retain previous decoded frames for smooth motion blur (frame blending)
const motionBlurCanvasCache = new Map<string, HTMLCanvasElement>();

export function clearMotionBlurCache(clipId?: string): void {
  if (clipId) {
    motionBlurCanvasCache.delete(clipId);
  } else {
    motionBlurCanvasCache.clear();
  }
}

type RedrawCallback = () => void;
const redrawCallbacks = new Set<RedrawCallback>();

let isPlaybackLoopActive = false;

export function setPlaybackActiveState(active: boolean): void {
  isPlaybackLoopActive = active;
}

export function registerRedrawCallback(cb: RedrawCallback): () => void {
  redrawCallbacks.add(cb);
  return () => {
    redrawCallbacks.delete(cb);
  };
}

export function notifyCanvasNeedsRedraw(): void {
  if (isPlaybackLoopActive) return;
  for (const cb of redrawCallbacks) {
    try {
      cb();
    } catch (e) {
      console.warn('[FORMA] Redraw callback error:', e);
    }
  }
}

export function copyCachedFrame(fromClipId: string, toClipId: string): void {
  const source = lastFrameCanvasCache.get(fromClipId);
  if (source && source.width > 0 && source.height > 0) {
    const copy = document.createElement('canvas');
    copy.width = source.width;
    copy.height = source.height;
    const ctx = copy.getContext('2d');
    if (ctx) {
      ctx.drawImage(source, 0, 0);
      lastFrameCanvasCache.set(toClipId, copy);
    }
  }
  const elem = elementCache.get(fromClipId);
  if (elem) {
    elementCache.set(toClipId, elem);
  }
}

/**
 * Validates if video element has decoded playable frame data ready for canvas rendering
 */
export function isVideoFrameReady(video: HTMLVideoElement | null | undefined): boolean {
  if (!video) return false;
  return (
    video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
    !video.seeking &&
    video.videoWidth > 0 &&
    video.videoHeight > 0
  );
}

/**
 * Robust frame-accurate seek helper for offline export & frame rendering.
 * Waits for the exact target frame to be decoded by the browser before proceeding.
 */
export function seekVideoFrame(video: HTMLVideoElement, targetTime: number): Promise<void> {
  return new Promise<void>((resolve) => {
    const maxDur = video.duration || 999999;
    const clampedTime = Math.max(0, Math.min(maxDur - 0.001, targetTime));

    if (
      Math.abs(video.currentTime - clampedTime) < 0.005 &&
      !video.seeking &&
      video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA
    ) {
      resolve();
      return;
    }

    let settled = false;
    let timer: any = null;

    const finish = () => {
      if (!settled) {
        settled = true;
        if (timer) clearTimeout(timer);
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', finish);
        resolve();
      }
    };

    const onSeeked = () => {
      // In modern browsers, requestVideoFrameCallback ensures the new seeked frame is actually decoded & presented
      if ('requestVideoFrameCallback' in video && typeof (video as any).requestVideoFrameCallback === 'function') {
        try {
          (video as any).requestVideoFrameCallback(() => {
            finish();
          });
          return;
        } catch {
          // fallback to instant finish
        }
      }
      finish();
    };

    // Safety timeout (350ms) to accommodate high-res (1080p/2K/4K) decoding without premature dropping
    timer = setTimeout(finish, 350);

    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', finish, { once: true });

    try {
      video.currentTime = clampedTime;
    } catch {
      finish();
    }
  });
}

/**
 * Universal safe rounded rectangle renderer with robust fallbacks
 */
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
      // Fallback to path below
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
 * Linearly interpolates value between two keyframes
 */
function interpolateKeyframeValue(
  keyframes: Keyframe[] | undefined,
  clipTime: number,
  field: 'x' | 'y' | 'scale' | 'scaleX' | 'scaleY' | 'rotation' | 'opacity',
  defaultValue: number
): number {
  if (!keyframes || keyframes.length === 0) return defaultValue;

  const validKfs = keyframes
    .filter((kf) => (kf as any)[field] !== undefined || (field === 'scaleX' && (kf as any).scale !== undefined) || (field === 'scaleY' && (kf as any).scale !== undefined))
    .sort((a, b) => a.time - b.time);

  if (validKfs.length === 0) return defaultValue;
  const getVal = (kf: Keyframe): number => {
    if ((kf as any)[field] !== undefined) return (kf as any)[field];
    if (field === 'scaleX' || field === 'scaleY') return (kf as any).scale ?? defaultValue;
    return defaultValue;
  };

  if (clipTime <= validKfs[0].time) return getVal(validKfs[0]);
  if (clipTime >= validKfs[validKfs.length - 1].time) {
    return getVal(validKfs[validKfs.length - 1]);
  }

  // Find surrounding pair
  for (let i = 0; i < validKfs.length - 1; i++) {
    const k1 = validKfs[i];
    const k2 = validKfs[i + 1];
    if (clipTime >= k1.time && clipTime <= k2.time) {
      const duration = k2.time - k1.time;
      if (duration <= 0) return getVal(k1);
      const progress = (clipTime - k1.time) / duration;
      const v1 = getVal(k1);
      const v2 = getVal(k2);
      return v1 + (v2 - v1) * progress;
    }
  }

  return defaultValue;
}

/**
 * Maps linear playback seconds to non-linear speed-ramped source seconds.
 * Provides continuous, deterministic frame positions for Montage, Bullet-Time, and Jump-In curves.
 */
export function computeSpeedRampedClipTime(
  clipTimeSec: number,
  clipDuration: number,
  preset?: SpeedRampPreset,
  baseSpeed = 1.0
): number {
  if (!preset || preset === 'none') {
    return clipTimeSec * baseSpeed;
  }
  const D = Math.max(0.1, clipDuration);
  const t = Math.max(0, Math.min(D, clipTimeSec));

  if (preset === 'montage') {
    // Montage: Fast intro (2.5x), Dramatic slowdown (0.6x), Settle (1.0x)
    if (t < 0.25 * D) {
      return t * 2.5 * baseSpeed;
    } else if (t < 0.75 * D) {
      return (0.25 * D * 2.5 + (t - 0.25 * D) * 0.6) * baseSpeed;
    } else {
      return (0.25 * D * 2.5 + 0.5 * D * 0.6 + (t - 0.75 * D) * 1.0) * baseSpeed;
    }
  } else if (preset === 'bullet-time') {
    // Bullet-Time: Normal (1.0x), Freeze/Ultra slow-mo (0.25x), Resume (1.0x)
    if (t < 0.25 * D) {
      return t * 1.0 * baseSpeed;
    } else if (t < 0.70 * D) {
      return (0.25 * D * 1.0 + (t - 0.25 * D) * 0.25) * baseSpeed;
    } else {
      return (0.25 * D * 1.0 + 0.45 * D * 0.25 + (t - 0.70 * D) * 1.0) * baseSpeed;
    }
  } else if (preset === 'jump-in') {
    // Jump-In: Anticipation slow (0.5x), Speed burst (3.0x), Settle (1.0x)
    if (t < 0.30 * D) {
      return t * 0.5 * baseSpeed;
    } else if (t < 0.70 * D) {
      return (0.30 * D * 0.5 + (t - 0.30 * D) * 3.0) * baseSpeed;
    } else {
      return (0.30 * D * 0.5 + 0.40 * D * 3.0 + (t - 0.70 * D) * 1.0) * baseSpeed;
    }
  }

  return clipTimeSec * baseSpeed;
}

let chromaOffscreenCanvas: HTMLCanvasElement | null = null;
let chromaOffscreenCtx: CanvasRenderingContext2D | null = null;

/**
 * Real-time fast CPU Chroma Key (Green screen / Blue screen background color remover)
 */
function applyChromaKeyFrame(
  source: HTMLVideoElement | HTMLImageElement | HTMLCanvasElement,
  w: number,
  h: number,
  hexColor: string,
  similarity: number = 0.35,
  smoothness: number = 0.1
): HTMLCanvasElement | null {
  if (typeof document === 'undefined' || w <= 0 || h <= 0) return null;
  if (!chromaOffscreenCanvas) {
    chromaOffscreenCanvas = document.createElement('canvas');
    chromaOffscreenCtx = chromaOffscreenCanvas.getContext('2d', { willReadFrequently: true });
  }
  if (!chromaOffscreenCtx) return null;

  const renderW = Math.min(1280, w);
  const renderH = Math.min(720, h);

  if (chromaOffscreenCanvas.width !== renderW || chromaOffscreenCanvas.height !== renderH) {
    chromaOffscreenCanvas.width = renderW;
    chromaOffscreenCanvas.height = renderH;
  }

  chromaOffscreenCtx.clearRect(0, 0, renderW, renderH);
  chromaOffscreenCtx.drawImage(source, 0, 0, renderW, renderH);

  const cleanHex = hexColor.replace('#', '');
  const tr = parseInt(cleanHex.substring(0, 2) || '00', 16);
  const tg = parseInt(cleanHex.substring(2, 4) || 'ff', 16);
  const tb = parseInt(cleanHex.substring(4, 6) || '00', 16);

  try {
    const imgData = chromaOffscreenCtx.getImageData(0, 0, renderW, renderH);
    const data = imgData.data;
    const len = data.length;

    for (let i = 0; i < len; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];

      const diff = Math.sqrt((r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2) / 441.67;
      if (diff < similarity) {
        data[i + 3] = 0;
      } else if (diff < similarity + smoothness) {
        const alphaFactor = (diff - similarity) / Math.max(0.001, smoothness);
        data[i + 3] = Math.round(data[i + 3] * alphaFactor);
      }
    }

    chromaOffscreenCtx.putImageData(imgData, 0, 0);
    return chromaOffscreenCanvas;
  } catch (err) {
    return null;
  }
}

/**
 * Procedural fallback for clips when video/image elements are loading, missing, or in test environments.
 * Explicitly satisfies visual requirements:
 * - Klip A (440 Hz): Rich blue canvas with clear circular badge and bold white 'A'
 * - Klip B (880 Hz): Rich orange canvas with clear square badge and bold white 'B'
 */
function renderProceduralClipInner(
  ctx: CanvasRenderingContext2D,
  clip: VideoClip,
  dw: number,
  dh: number,
  currentTime = 0
): void {
  const hasRealMedia = Boolean(clip.sourceUrl || clip.assetId || (clip as any).filePath || (clip as any).file);
  const isKlipA = !hasRealMedia && /440|[kc]lip[-_ ]?a|^a$/i.test(clip.name || clip.id);
  const isKlipB = !hasRealMedia && /880|[kc]lip[-_ ]?b|^b$/i.test(clip.name || clip.id);
  const t = currentTime || 0;

  ctx.save();
  if (isKlipA) {
    // Dynamic animated royal blue gradient rotating continuously across frame
    const angle = (t * 0.45) % (Math.PI * 2);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const grad = ctx.createLinearGradient(-dw * cos / 2, -dh * sin / 2, dw * cos / 2, dh * sin / 2);
    grad.addColorStop(0, '#1e3a8a');
    grad.addColorStop(0.5, '#2563eb');
    grad.addColorStop(1, '#1d4ed8');
    ctx.fillStyle = grad;
    ctx.fillRect(-dw / 2, -dh / 2, dw, dh);

    // Continuous dynamic moving technical grid (drifting every frame to prevent static macroblocks)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    const step = Math.max(24, Math.round(dh / 10));
    const gridShiftX = (t * 140) % step;
    const gridShiftY = (t * 90) % step;
    for (let x = -dw / 2 + gridShiftX - step; x < dw / 2 + step; x += step) {
      ctx.beginPath(); ctx.moveTo(x, -dh / 2); ctx.lineTo(x, dh / 2); ctx.stroke();
    }
    for (let y = -dh / 2 + gridShiftY - step; y < dh / 2 + step; y += step) {
      ctx.beginPath(); ctx.moveTo(-dw / 2, y); ctx.lineTo(dw / 2, y); ctx.stroke();
    }

    // High-contrast rotating multi-arm turbine rays in motion graphic ROI
    ctx.save();
    ctx.translate(0, -dh * 0.05);
    const turbineAngle = t * 3.8;
    ctx.rotate(turbineAngle);
    const rayCount = 12;
    ctx.fillStyle = 'rgba(56, 189, 248, 0.22)';
    for (let i = 0; i < rayCount; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      const a1 = (i * 2 * Math.PI) / rayCount;
      const a2 = a1 + (Math.PI / rayCount) * 0.6;
      const rRay = Math.min(dw, dh) * 0.42;
      ctx.lineTo(Math.cos(a1) * rRay, Math.sin(a1) * rRay);
      ctx.lineTo(Math.cos(a2) * rRay, Math.sin(a2) * rRay);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Continuous multi-frequency wave ribbons spanning entire width across motion ROI
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = -dw / 2; x <= dw / 2; x += 16) {
      const waveY = -dh * 0.18 + Math.sin(x * 0.012 + t * 9.5) * 55 + Math.cos(x * 0.024 + t * 14.2) * 28;
      if (x === -dw / 2) ctx.moveTo(x, waveY);
      else ctx.lineTo(x, waveY);
    }
    ctx.stroke();

    // 24 Active Spectrum Equalizer Bars across upper ROI (moving aggressively each frame)
    const eqCount = 28;
    const eqW = (dw * 0.7) / eqCount;
    const eqStartX = -dw * 0.35;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    for (let i = 0; i < eqCount; i++) {
      const barH = Math.abs(Math.sin(t * 8.2 + i * 0.42)) * (dh * 0.18) + 12;
      ctx.fillRect(eqStartX + i * eqW + 2, -dh * 0.38 - barH / 2, eqW - 4, barH);
    }

    // Center circular badge with 'A'
    const radius = Math.min(dw, dh) * 0.24;
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#1e3a8a';
    ctx.font = `bold ${Math.round(radius * 1.3)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('A', 0, 0);

    // High-contrast dynamic moving fixture (sweeping circular radar)
    const sweepRadius = Math.min(dw, dh) * 0.16;
    const sweepX = -dw / 2 + ((t * 500) % (dw - 360)) + 180;
    const sweepY = dh * 0.18 + Math.sin(t * 3.5) * (dh * 0.15);
    ctx.beginPath();
    ctx.arc(sweepX, sweepY, sweepRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Dynamic moving fixture: timecode and frame counter
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.font = `bold ${Math.max(14, Math.round(dh * 0.05))}px monospace`;
    ctx.fillText(`KLİP A • KARE: ${Math.floor(t * 30).toString().padStart(3, '0')} / 300 • ${t.toFixed(3)}s`, 0, radius + Math.round(dh * 0.08));

    // Dynamic progress bar across bottom
    const barW = ((t * 30) % 300) / 300 * dw;
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(-dw / 2, dh / 2 - 14, barW, 14);
  } else if (isKlipB) {
    // Dynamic animated fiery orange gradient rotating continuously across frame
    const angle = (t * 0.45) % (Math.PI * 2);
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const grad = ctx.createLinearGradient(-dw * cos / 2, -dh * sin / 2, dw * cos / 2, dh * sin / 2);
    grad.addColorStop(0, '#9a3412');
    grad.addColorStop(0.5, '#ea580c');
    grad.addColorStop(1, '#c2410c');
    ctx.fillStyle = grad;
    ctx.fillRect(-dw / 2, -dh / 2, dw, dh);

    // Continuous dynamic moving technical grid (drifting every frame to prevent static macroblocks)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    const step = Math.max(24, Math.round(dh / 10));
    const gridShiftX = -(t * 140) % step;
    const gridShiftY = -(t * 90) % step;
    for (let x = -dw / 2 + gridShiftX - step; x < dw / 2 + step; x += step) {
      ctx.beginPath(); ctx.moveTo(x, -dh / 2); ctx.lineTo(x, dh / 2); ctx.stroke();
    }
    for (let y = -dh / 2 + gridShiftY - step; y < dh / 2 + step; y += step) {
      ctx.beginPath(); ctx.moveTo(-dw / 2, y); ctx.lineTo(dw / 2, y); ctx.stroke();
    }

    // High-contrast rotating multi-arm turbine rays in motion graphic ROI
    ctx.save();
    ctx.translate(0, -dh * 0.05);
    const turbineAngle = -t * 3.8;
    ctx.rotate(turbineAngle);
    const rayCount = 12;
    ctx.fillStyle = 'rgba(251, 146, 60, 0.25)';
    for (let i = 0; i < rayCount; i++) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      const a1 = (i * 2 * Math.PI) / rayCount;
      const a2 = a1 + (Math.PI / rayCount) * 0.6;
      const rRay = Math.min(dw, dh) * 0.42;
      ctx.lineTo(Math.cos(a1) * rRay, Math.sin(a1) * rRay);
      ctx.lineTo(Math.cos(a2) * rRay, Math.sin(a2) * rRay);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // Continuous multi-frequency wave ribbons spanning entire width across motion ROI
    ctx.strokeStyle = '#fb923c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let x = -dw / 2; x <= dw / 2; x += 16) {
      const waveY = -dh * 0.18 + Math.cos(x * 0.012 + t * 9.5) * 55 + Math.sin(x * 0.024 + t * 14.2) * 28;
      if (x === -dw / 2) ctx.moveTo(x, waveY);
      else ctx.lineTo(x, waveY);
    }
    ctx.stroke();

    // 24 Active Spectrum Equalizer Bars across upper ROI (moving aggressively each frame)
    const eqCount = 28;
    const eqW = (dw * 0.7) / eqCount;
    const eqStartX = -dw * 0.35;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    for (let i = 0; i < eqCount; i++) {
      const barH = Math.abs(Math.cos(t * 8.2 + i * 0.42)) * (dh * 0.18) + 12;
      ctx.fillRect(eqStartX + i * eqW + 2, -dh * 0.38 - barH / 2, eqW - 4, barH);
    }

    // High-contrast dynamic moving fixture (sweeping circular radar)
    const sweepRadius = Math.min(dw, dh) * 0.16;
    const sweepX = -dw / 2 + ((t * 500) % (dw - 360)) + 180;
    const sweepY = dh * 0.18 + Math.sin(t * 3.5) * (dh * 0.15);
    ctx.beginPath();
    ctx.arc(sweepX, sweepY, sweepRadius, 0, Math.PI * 2);
    ctx.fillStyle = '#fb923c';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.stroke();

    // Center rounded square badge with 'B'
    const size = Math.min(dw, dh) * 0.46;
    const r = size * 0.18;
    safeRoundRect(ctx, -size / 2, -size / 2, size, size, r);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 12;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#c2410c';
    ctx.font = `bold ${Math.round(size * 0.68)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('B', 0, 0);

    // Dynamic moving fixture: timecode and frame counter
    ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
    ctx.font = `bold ${Math.max(14, Math.round(dh * 0.05))}px monospace`;
    ctx.fillText(`KLİP B • KARE: ${Math.floor(t * 30).toString().padStart(3, '0')} / 300 • ${t.toFixed(3)}s`, 0, size / 2 + Math.round(dh * 0.08));

    // Dynamic progress bar across bottom
    const barW = ((t * 30) % 300) / 300 * dw;
    ctx.fillStyle = '#f97316';
    ctx.fillRect(-dw / 2, dh / 2 - 14, barW, 14);
  } else {
    const isElement =
      clip.type === 'image' ||
      Boolean(clip.svgContent) ||
      Boolean(clip.elementPresetId) ||
      Boolean(clip.assetId?.startsWith('element-')) ||
      Boolean(clip.name && (clip.name.includes('TikTok') || clip.name.includes('Beğen') || clip.name.includes('Like') || clip.name.includes('Takip') || clip.name.includes('YouTube') || clip.name.includes('Instagram')));

    if (isElement) {
      drawVectorElementFallback(ctx, clip, dw, dh);
    } else {
      const isTestClip = !hasRealMedia && /^(?:440|880|[kc]lip[-_ ]?[ab])$/i.test((clip.name || '').trim());
      if (isTestClip) {
        const hash = (clip.id || clip.name || 'clip').split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
        const hue = (hash * 137) % 360;
        ctx.fillStyle = `hsl(${hue}, 45%, 22%)`;
        ctx.fillRect(-dw / 2, -dh / 2, dw, dh);

        ctx.fillStyle = '#ffffff';
        ctx.font = `bold ${Math.max(14, Math.round(dh * 0.08))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(clip.name || clip.id || 'Medya Klibi', 0, 0);
      }
    }
  }
  ctx.restore();
}

/**
 * Direct vector drawing fallback for element clips and stickers (e.g. TikTok Like)
 * Prevents ever flashing or displaying an ugly procedural colored rectangle while SVG image loads.
 */
function drawVectorElementFallback(
  ctx: CanvasRenderingContext2D,
  clip: VideoClip,
  dw: number,
  dh: number
): void {
  const name = (clip.name || '').toLowerCase();
  const presetId = (clip.elementPresetId || '').toLowerCase();
  const isTikTok = name.includes('tiktok') || presetId.includes('tiktok') || name.includes('beğen') || name.includes('like');

  if (isTikTok) {
    // Pure Authentic TikTok Heart with Cyan 3D Shadow (Zero ugly cards, zero text boxes)
    const maxDim = Math.min(dw, dh);
    const heartSize = maxDim * 0.8;

    ctx.save();
    ctx.rotate(-0.24); // Authentic TikTok -14 deg tilt

    // Cyan 3D chromatic aberration shadow
    ctx.save();
    ctx.translate(-4, -2);
    drawHeartPath(ctx, heartSize);
    ctx.fillStyle = '#25f4ee';
    ctx.globalAlpha = 0.85;
    ctx.fill();
    ctx.restore();

    // Vibrant TikTok Red Heart
    drawHeartPath(ctx, heartSize);
    ctx.fillStyle = '#fe2c55';
    ctx.fill();

    // Specular highlight gloss sheen on top-left lobe
    ctx.beginPath();
    ctx.ellipse(-heartSize * 0.22, -heartSize * 0.22, heartSize * 0.12, heartSize * 0.06, -0.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.fill();

    ctx.restore();
  } else {
    // Do NOT render an intrusive dark blue box with text over the video!
    // Remaining silent and transparent ensures video characters are never occluded while decoding.
  }
}

function drawProceduralClipContent(
  ctx: CanvasRenderingContext2D,
  clip: VideoClip,
  dw: number,
  dh: number,
  currentTime = 0
): void {
  const colorFilter = clip.colorFilter;
  const activeLut = colorFilter ? getCachedCubeLut(colorFilter) : null;
  const intensity = (clip.effects as any)?.lutIntensity ?? 1.0;

  if (activeLut && typeof document !== 'undefined') {
    if (!lutOffscreenCanvas) {
      lutOffscreenCanvas = document.createElement('canvas');
    }
    const targetW = Math.max(1, Math.round(dw));
    const targetH = Math.max(1, Math.round(dh));
    if (lutOffscreenCanvas.width !== targetW || lutOffscreenCanvas.height !== targetH) {
      lutOffscreenCanvas.width = targetW;
      lutOffscreenCanvas.height = targetH;
    }
    const offCtx = lutOffscreenCanvas.getContext('2d', { willReadFrequently: true });
    if (offCtx) {
      offCtx.clearRect(0, 0, targetW, targetH);
      offCtx.save();
      offCtx.translate(targetW / 2, targetH / 2);
      renderProceduralClipInner(offCtx, clip, dw, dh, currentTime);
      offCtx.restore();
      applyCubeLutToCanvas(lutOffscreenCanvas, activeLut, intensity);
      ctx.drawImage(lutOffscreenCanvas, -dw / 2, -dh / 2, dw, dh);
      return;
    }
  }

  renderProceduralClipInner(ctx, clip, dw, dh, currentTime);
}

let lutOffscreenCanvas: HTMLCanvasElement | null = null;

export function drawMediaWithLut(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  dx: number,
  dy: number,
  dw: number,
  dh: number,
  clip: VideoClip
): void {
  const colorFilter = clip.colorFilter;
  const activeLut = colorFilter ? getCachedCubeLut(colorFilter) : null;
  const intensity = (clip.effects as any)?.lutIntensity ?? 1.0;

  if (activeLut) {
    if (!lutOffscreenCanvas && typeof document !== 'undefined') {
      lutOffscreenCanvas = document.createElement('canvas');
    }
    if (lutOffscreenCanvas) {
      const targetW = Math.max(1, Math.round(dw));
      const targetH = Math.max(1, Math.round(dh));
      if (lutOffscreenCanvas.width !== targetW || lutOffscreenCanvas.height !== targetH) {
        lutOffscreenCanvas.width = targetW;
        lutOffscreenCanvas.height = targetH;
      }
      const offCtx = lutOffscreenCanvas.getContext('2d', { willReadFrequently: true });
      if (offCtx) {
        offCtx.clearRect(0, 0, targetW, targetH);
        offCtx.drawImage(source, 0, 0, targetW, targetH);
        applyCubeLutToCanvas(lutOffscreenCanvas, activeLut, intensity);
        ctx.drawImage(lutOffscreenCanvas, dx, dy, dw, dh);
        return;
      }
    }
  } else if (colorFilter && !colorFilter.startsWith('normal') && typeof window !== 'undefined') {
    loadAndCacheCubeLut(colorFilter).catch(() => {});
  }

  ctx.drawImage(source, dx, dy, dw, dh);
}

/**
 * Main Scene Compositor: draws background, tracks, overlays, and selection gizmo
 */
export function renderScene(renderCtx: RenderContext): void {
  const { ctx, project, currentTime, videoElements, imageElements, selectedClipId } = renderCtx;
  const { width, height } = project.resolution;

  // 1. Clear & Background Fill
  ctx.save();
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = project.backgroundColor || '#000000';
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // 2. Render Tracks (Bottom layer to Top layer)
  // Audio tracks have no visual representation and are skipped.
  // Video & Image base tracks are drawn first.
  // Secondary overlay/sticker tracks and Text/Subtitle tracks are drawn on top.
  const tracksToRender = [...project.tracks]
    .filter((t) => !t.muted && t.visible !== false && t.type !== 'audio')
    .sort((a, b) => {
      const isOverlayA = a.type === 'text' || a.type === 'subtitle';
      const isOverlayB = b.type === 'text' || b.type === 'subtitle';
      if (!isOverlayA && isOverlayB) return -1;
      if (isOverlayA && !isOverlayB) return 1;

      // Overlay/sticker/element tracks must ALWAYS render on top of base video
      const isStickersA = Boolean(
        a.name?.toLowerCase().includes('öğe') ||
        a.name?.toLowerCase().includes('çıkartma') ||
        a.name?.toLowerCase().includes('sticker') ||
        a.name?.toLowerCase().includes('overlay') ||
        a.name?.toLowerCase().includes('katman')
      );
      const isStickersB = Boolean(
        b.name?.toLowerCase().includes('öğe') ||
        b.name?.toLowerCase().includes('çıkartma') ||
        b.name?.toLowerCase().includes('sticker') ||
        b.name?.toLowerCase().includes('overlay') ||
        b.name?.toLowerCase().includes('katman')
      );
      if (isStickersA && !isStickersB) return 1; // A drawn after B (on top)
      if (!isStickersA && isStickersB) return -1; // B drawn after A (on top)

      const idxA = project.tracks.indexOf(a);
      const idxB = project.tracks.indexOf(b);
      // Base video track (index 0) drawn first, higher tracks drawn on top
      return idxA - idxB;
    });

  for (const track of tracksToRender) {
    // Collect track-level transitions (deduplicated by id)
    const trackTransitionsMap = new Map<string, TimelineTransition>();
    for (const tr of (track.transitions || [])) trackTransitionsMap.set(tr.id, tr);
    for (const tr of (project.transitions || [])) {
      if (tr.trackId === track.id && !trackTransitionsMap.has(tr.id)) {
        trackTransitionsMap.set(tr.id, tr);
      }
    }
    const trackTransitions = Array.from(trackTransitionsMap.values());

    // Find any timeline transition active at currentTime
    const activeTimelineTransition = trackTransitions.find((tr) => {
      const dur = tr.duration || 1.0;
      const tStart =
        tr.alignment === 'in'
          ? tr.cutTime
          : tr.alignment === 'out'
          ? tr.cutTime - dur
          : tr.cutTime - dur / 2;
      const tEnd = tStart + dur;
      return currentTime >= tStart && currentTime <= tEnd;
    });

    const activeLeftClip = activeTimelineTransition
      ? track.clips.find((c) => c.id === activeTimelineTransition.leftClipId) ||
        track.clips.find(
          (c) => Math.abs((c.startTime ?? 0) + c.duration - activeTimelineTransition.cutTime) < 0.35
        )
      : undefined;

    const activeRightClip = activeTimelineTransition
      ? track.clips.find((c) => c.id === activeTimelineTransition.rightClipId) ||
        track.clips.find(
          (c) => Math.abs((c.startTime ?? 0) - activeTimelineTransition.cutTime) < 0.35
        )
      : undefined;

    for (const clip of track.clips) {
      try {
        const start = clip.startTime ?? clip.start ?? 0;
        const end = start + clip.duration;

        let isInActiveTransition = false;
        let transitionRole: 'outgoing' | 'incoming' | null = null;
        let transitionProgress = 0;

        if (activeTimelineTransition) {
          const dur = activeTimelineTransition.duration || 1.0;
          const tStart =
            activeTimelineTransition.alignment === 'in'
              ? activeTimelineTransition.cutTime
              : activeTimelineTransition.alignment === 'out'
              ? activeTimelineTransition.cutTime - dur
              : activeTimelineTransition.cutTime - dur / 2;
          transitionProgress = Math.max(0, Math.min(1, (currentTime - tStart) / Math.max(0.001, dur)));

          if (activeLeftClip && clip.id === activeLeftClip.id) {
            isInActiveTransition = true;
            transitionRole = 'outgoing';
          } else if (activeRightClip && clip.id === activeRightClip.id) {
            isInActiveTransition = true;
            transitionRole = 'incoming';
          }
        }

        // Only process clips active at currentTime (or active via timeline transition)
        // Use '< end' to prevent adjacent split clips from overlapping on the split timestamp
        const isProjectEnd = end >= ((project.duration || 0) - 0.005);
        const isTimeInClip = currentTime >= start && (isProjectEnd ? currentTime <= end : currentTime < end);
        if (!isInActiveTransition && !isTimeInClip) continue;

        const rampedClipTime = computeSpeedRampedClipTime(
          currentTime - start,
          clip.duration,
          clip.speedRampPreset,
          clip.speed || 1.0
        );
        let clipTime = rampedClipTime;
        if (isInActiveTransition) {
          const trimIn = clip.trimIn || 0;
          const maxSource = clip.sourceDuration || (trimIn + clip.duration);
          const rawSourceTime = trimIn + rampedClipTime;
          const boundedSourceTime = Math.max(0, Math.min(maxSource, rawSourceTime));
          clipTime = boundedSourceTime - trimIn;
        }

        // Interpolate keyframe transforms
        const currentX = interpolateKeyframeValue(clip.keyframes, clipTime, 'x', clip.transform?.x ?? clip.x ?? 0);
        const currentY = interpolateKeyframeValue(clip.keyframes, clipTime, 'y', clip.transform?.y ?? clip.y ?? 0);
        const currentScaleX = interpolateKeyframeValue(
          clip.keyframes,
          clipTime,
          'scaleX',
          clip.transform?.scaleX ?? clip.scaleX ?? 1
        );
        const currentScaleY = interpolateKeyframeValue(
          clip.keyframes,
          clipTime,
          'scaleY',
          clip.transform?.scaleY ?? clip.scaleY ?? 1
        );
        const currentRotation = interpolateKeyframeValue(
          clip.keyframes,
          clipTime,
          'rotation',
          clip.transform?.rotation ?? clip.rotation ?? 0
        );
        let currentOpacity = interpolateKeyframeValue(
          clip.keyframes,
          clipTime,
          'opacity',
          clip.transform?.opacity ?? clip.opacity ?? 1
        );

        // AI Camera Motion Presets (Handheld Documentary, Action Impact, Ken Burns Push-In / Pull-Out)
        let camOffsetX = 0;
        let camOffsetY = 0;
        let camScale = 1.0;
        let camRotation = 0;

        const camPreset = clip.cameraMotionPreset || clip.effects?.cameraMotion;
        if (camPreset === 'handheld') {
          const t = clipTime;
          camOffsetX = Math.sin(t * 1.5) * 8 + Math.sin(t * 3.3) * 3.5;
          camOffsetY = Math.cos(t * 1.7) * 6 + Math.cos(t * 3.7) * 2.5;
          camRotation = Math.sin(t * 1.2) * 0.75 + Math.cos(t * 2.4) * 0.35;
          camScale = 1.035; // 3.5% margin to prevent empty edges during shake
        } else if (camPreset === 'impact') {
          const impactDecay = Math.max(0, 1 - (clipTime / 0.75));
          const decaySq = impactDecay * impactDecay;
          camOffsetX = (Math.sin(clipTime * 48) * 24 + Math.sin(clipTime * 96) * 12) * decaySq;
          camOffsetY = (Math.cos(clipTime * 52) * 20 + Math.cos(clipTime * 105) * 9) * decaySq;
          camRotation = (Math.sin(clipTime * 38) * 2.2) * decaySq;
          camScale = 1.0 + 0.05 * decaySq;
        } else if (camPreset === 'push-in') {
          const p = Math.min(1, Math.max(0, clipTime / Math.max(0.001, clip.duration)));
          camScale = 1.0 + p * 0.12;
        } else if (camPreset === 'pull-out') {
          const p = Math.min(1, Math.max(0, clipTime / Math.max(0.001, clip.duration)));
          camScale = 1.12 - p * 0.12;
        }

        // Transitions
        let transOffsetX = 0;
        let transOffsetY = 0;
        let transScale = 1;
        let transScaleX = 1;
        let transScaleY = 1;
        let transRotation = 0;
        let transBlur = 0;
        let transWipeRatio: number | undefined;
        let transWipeDir: 'left' | 'right' | 'up' | 'down' | 'diagonal' | undefined;
        let transMaskShape: TransitionState['maskShape'];
        let transMaskRadius: number | undefined;
        let transOverlay: { r: number; g: number; b: number; a: number } | undefined;
        let transLightLeak: { intensity: number; progress: number } | undefined;
        let transFilmBurn: { intensity: number; progress: number } | undefined;
        let transGlitch: { amount: number; sliceCount: number; jitter: number } | undefined;
        let transVhs: { intensity: number; trackingJitter: number } | undefined;

        if (isInActiveTransition && activeTimelineTransition) {
          const isIncoming = transitionRole === 'incoming';
          const st = computeTransitionState(
            transitionProgress,
            activeTimelineTransition.type,
            isIncoming,
            {
              color: activeTimelineTransition.color,
              feather: activeTimelineTransition.feather,
              direction: activeTimelineTransition.direction,
            }
          );
          currentOpacity *= st.opacity;
          transOffsetX = st.offsetX * width;
          transOffsetY = st.offsetY * height;
          transScale *= st.scale;
          if (st.scaleX !== undefined) transScaleX *= st.scaleX;
          if (st.scaleY !== undefined) transScaleY *= st.scaleY;
          if (st.rotation !== undefined) transRotation += st.rotation;
          if (st.blur) transBlur = Math.max(transBlur, st.blur);
          if (st.wipeRatio !== undefined) {
            transWipeRatio = st.wipeRatio;
            transWipeDir = st.wipeDirection;
          }
          if (st.maskShape) transMaskShape = st.maskShape;
          if (st.maskRadius !== undefined) transMaskRadius = st.maskRadius;
          if (st.colorOverlay) transOverlay = st.colorOverlay;
          if (st.lightLeak) transLightLeak = st.lightLeak;
          if (st.filmBurn) transFilmBurn = st.filmBurn;
          if (st.glitch) transGlitch = st.glitch;
          if (st.vhs) transVhs = st.vhs;
        } else {
          // In transition on clip
          if (
            clip.transitionIn &&
            clip.transitionIn.type !== 'none' &&
            clip.transitionIn.type !== 'cut' &&
            clipTime < clip.transitionIn.duration
          ) {
            const p = clipTime / Math.max(0.01, clip.transitionIn.duration);
            const st = computeTransitionState(p, clip.transitionIn.type, true, {
              color: clip.transitionIn.color,
              feather: clip.transitionIn.feather,
              direction: clip.transitionIn.direction,
            });
            currentOpacity *= st.opacity;
            transOffsetX = st.offsetX * width;
            transOffsetY = st.offsetY * height;
            transScale *= st.scale;
            if (st.scaleX !== undefined) transScaleX *= st.scaleX;
            if (st.scaleY !== undefined) transScaleY *= st.scaleY;
            if (st.rotation !== undefined) transRotation += st.rotation;
            if (st.blur) transBlur = Math.max(transBlur, st.blur);
            if (st.wipeRatio !== undefined) {
              transWipeRatio = st.wipeRatio;
              transWipeDir = st.wipeDirection;
            }
            if (st.maskShape) transMaskShape = st.maskShape;
            if (st.maskRadius !== undefined) transMaskRadius = st.maskRadius;
            if (st.colorOverlay) transOverlay = st.colorOverlay;
            if (st.lightLeak) transLightLeak = st.lightLeak;
            if (st.filmBurn) transFilmBurn = st.filmBurn;
            if (st.glitch) transGlitch = st.glitch;
            if (st.vhs) transVhs = st.vhs;
          }

          // Out transition on clip
          const timeToEnd = clip.duration - clipTime;
          if (
            clip.transitionOut &&
            clip.transitionOut.type !== 'none' &&
            clip.transitionOut.type !== 'cut' &&
            timeToEnd < clip.transitionOut.duration
          ) {
            const p = 1 - timeToEnd / Math.max(0.01, clip.transitionOut.duration);
            const st = computeTransitionState(p, clip.transitionOut.type, false, {
              color: clip.transitionOut.color,
              feather: clip.transitionOut.feather,
              direction: clip.transitionOut.direction,
            });
            currentOpacity *= st.opacity;
            transOffsetX = st.offsetX * width;
            transOffsetY = st.offsetY * height;
            transScale *= st.scale;
            if (st.scaleX !== undefined) transScaleX *= st.scaleX;
            if (st.scaleY !== undefined) transScaleY *= st.scaleY;
            if (st.rotation !== undefined) transRotation += st.rotation;
            if (st.blur) transBlur = Math.max(transBlur, st.blur);
            if (st.wipeRatio !== undefined) {
              transWipeRatio = st.wipeRatio;
              transWipeDir = st.wipeDirection;
            }
            if (st.maskShape) transMaskShape = st.maskShape;
            if (st.maskRadius !== undefined) transMaskRadius = st.maskRadius;
            if (st.colorOverlay) transOverlay = st.colorOverlay;
            if (st.lightLeak) transLightLeak = st.lightLeak;
            if (st.filmBurn) transFilmBurn = st.filmBurn;
            if (st.glitch) transGlitch = st.glitch;
            if (st.vhs) transVhs = st.vhs;
          }
        }

        // Render by type
        const isTransitionClip = Boolean(
          (clip as any).type === 'transition' ||
          clip.assetId?.startsWith('trans-') ||
          clip.sourceUrl?.startsWith('virtual:transition')
        );
        if (isTransitionClip) {
          continue;
        }

        const isElementClip = Boolean(
          clip.svgContent ||
          clip.elementPresetId ||
          clip.assetId?.startsWith('element-') ||
          (clip.type === 'image' && clip.name && (clip.name.includes('TikTok') || clip.name.includes('Beğen') || clip.name.includes('Like') || clip.name.includes('Takip') || clip.name.includes('YouTube') || clip.name.includes('Instagram')))
        );

        if (clip.type === 'video' && !isElementClip) {
          const video = videoElements.get(clip.id) || videoElements.get(clip.assetId || '');
          let cachedCanvas = lastFrameCanvasCache.get(clip.id) || (clip.assetId ? lastFrameCanvasCache.get(clip.assetId) : undefined);
          const isVideoReady = isVideoFrameReady(video);

          if (isVideoReady || cachedCanvas) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, currentOpacity));

            // Safe Filters & Transition blur & AI Deflicker
            const hasActiveLut = Boolean(clip.colorFilter && getCachedCubeLut(clip.colorFilter));
            const presetEffects = !hasActiveLut ? getEffectsForColorFilter(clip.colorFilter) : null;
            const mergedEffects = { ...presetEffects, ...clip.effects };
            let filterStr = buildCanvasFilterString(mergedEffects);
            if (clip.deflicker || clip.effects?.deflicker) {
              const deflickerFilter = 'contrast(0.98) brightness(1.01)';
              filterStr = filterStr ? `${filterStr} ${deflickerFilter}` : deflickerFilter;
            }
            if (transBlur > 0) {
              filterStr = filterStr ? `${filterStr} blur(${transBlur}px)` : `blur(${transBlur}px)`;
            }
            ctx.filter = filterStr;

            // Dimensions and Fit Mode
            const sX = currentScaleX * transScale * transScaleX * camScale;
            const sY = currentScaleY * transScale * transScaleY * camScale;
            const vw = video && video.videoWidth > 0 ? video.videoWidth : cachedCanvas ? cachedCanvas.width : width;
            const vh = video && video.videoHeight > 0 ? video.videoHeight : cachedCanvas ? cachedCanvas.height : height;

            let dw = width * sX;
            let dh = height * sY;
            const fitMode = clip.fitMode || 'fit';

            if (fitMode === 'fit') {
              const videoRatio = vw / Math.max(1, vh);
              const canvasRatio = width / Math.max(1, height);
              if (videoRatio > canvasRatio) {
                dw = width * sX;
                dh = (width / videoRatio) * sY;
              } else {
                dh = height * sY;
                dw = (height * videoRatio) * sX;
              }
            } else if (fitMode === 'fill') {
              const videoRatio = vw / Math.max(1, vh);
              const canvasRatio = width / Math.max(1, height);
              if (videoRatio > canvasRatio) {
                dh = height * sY;
                dw = (height * videoRatio) * sX;
              } else {
                dw = width * sX;
                dh = (width / videoRatio) * sY;
              }
            }

            // 9:16 & 1:1 Smart Reframe Focus Calculation
            let reframeOffsetX = 0;
            if (dw > width + 4) {
              const excess = (dw - width) / 2;
              const focus = clip.smartReframeFocus ?? 'center';
              if (focus === 'left') {
                reframeOffsetX = excess * 0.85; // shift video rightward so left portion is framed
              } else if (focus === 'right') {
                reframeOffsetX = -excess * 0.85; // shift video leftward so right portion is framed
              } else if (typeof focus === 'number') {
                reframeOffsetX = -excess * (Math.max(-100, Math.min(100, focus)) / 100);
              }
            }

            // Positioning and Transforms
            const totalRotation = currentRotation + transRotation + camRotation;
            ctx.translate(
              width / 2 + currentX + transOffsetX + camOffsetX + reframeOffsetX,
              height / 2 + currentY + transOffsetY + camOffsetY
            );
            if (totalRotation !== 0) ctx.rotate((totalRotation * Math.PI) / 180);
            if (clip.flipH || clip.flipV) ctx.scale(clip.flipH ? -1 : 1, clip.flipV ? -1 : 1);

            // Wipe & Mask Transition Clipping
            if (transWipeRatio !== undefined) {
              ctx.beginPath();
              if (transWipeDir === 'left') {
                ctx.rect(-dw / 2, -dh / 2, dw * transWipeRatio, dh);
              } else if (transWipeDir === 'right') {
                ctx.rect(dw / 2 - dw * transWipeRatio, -dh / 2, dw * transWipeRatio, dh);
              } else if (transWipeDir === 'up') {
                ctx.rect(-dw / 2, -dh / 2, dw, dh * transWipeRatio);
              } else if (transWipeDir === 'down') {
                ctx.rect(-dw / 2, dh / 2 - dh * transWipeRatio, dw, dh * transWipeRatio);
              } else if (transWipeDir === 'diagonal') {
                ctx.moveTo(-dw / 2, -dh / 2);
                ctx.lineTo(-dw / 2 + dw * transWipeRatio * 2, -dh / 2);
                ctx.lineTo(-dw / 2, -dh / 2 + dh * transWipeRatio * 2);
                ctx.closePath();
              } else {
                ctx.rect(-dw / 2, -dh / 2, dw, dh);
              }
              ctx.clip();
            } else if (transMaskShape === 'circle-in' || transMaskShape === 'circle-out' || transMaskShape === 'soft-circle') {
              const maxR = Math.hypot(dw, dh) / 2;
              const r = maxR * (transMaskRadius ?? 1);
              ctx.beginPath();
              ctx.arc(0, 0, Math.max(0.1, r), 0, Math.PI * 2);
              ctx.clip();
            } else if (transMaskShape === 'clock') {
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.arc(0, 0, Math.hypot(dw, dh), -Math.PI / 2, -Math.PI / 2 + (transWipeRatio || 0) * 2 * Math.PI);
              ctx.closePath();
              ctx.clip();
            } else if (transMaskShape === 'blinds') {
              const slatCount = 8;
              const slatH = dh / slatCount;
              ctx.beginPath();
              for (let i = 0; i < slatCount; i++) {
                ctx.rect(-dw / 2, -dh / 2 + i * slatH, dw, slatH * (transWipeRatio || 0));
              }
              ctx.clip();
            } else if (transMaskShape === 'checker') {
              const cols = 8;
              const rows = 5;
              const cw = dw / cols;
              const ch = dh / rows;
              ctx.beginPath();
              for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                  if ((transWipeRatio || 0) >= ((r + c) / (rows + cols)) * 0.7) {
                    ctx.rect(-dw / 2 + c * cw, -dh / 2 + r * ch, cw, ch);
                  }
                }
              }
              ctx.clip();
            } else if (transMaskShape === 'split-h') {
              const splitW = (dw / 2) * (transWipeRatio || 0);
              ctx.beginPath();
              ctx.rect(-dw / 2, -dh / 2, dw / 2 - splitW, dh);
              ctx.rect(splitW, -dh / 2, dw / 2 - splitW, dh);
              ctx.clip();
            } else if (transMaskShape === 'split-v') {
              const splitH = (dh / 2) * (transWipeRatio || 0);
              ctx.beginPath();
              ctx.rect(-dw / 2, -dh / 2, dw, dh / 2 - splitH);
              ctx.rect(-dw / 2, splitH, dw, dh / 2 - splitH);
              ctx.clip();
            }

            // Crop Clipping (Top, Right, Bottom, Left %)
            const crop = clip.effects?.crop || (clip as any).crop;
            if (crop && (crop.top > 0 || crop.right > 0 || crop.bottom > 0 || crop.left > 0)) {
              ctx.beginPath();
              const cropX = -dw / 2 + (dw * (crop.left || 0)) / 100;
              const cropY = -dh / 2 + (dh * (crop.top || 0)) / 100;
              const cropW = dw * (1 - ((crop.left || 0) + (crop.right || 0)) / 100);
              const cropH = dh * (1 - ((crop.top || 0) + (crop.bottom || 0)) / 100);
              ctx.rect(cropX, cropY, Math.max(1, cropW), Math.max(1, cropH));
              ctx.clip();
            }

            // Mask Clipping (Circle, Rounded, etc.)
            const mask = clip.effects?.mask || (clip as any).mask;
            if (mask && mask.type !== 'none') {
              ctx.beginPath();
              if (mask.type === 'circle') {
                const r = Math.min(dw, dh) / 2;
                ctx.arc(0, 0, r, 0, Math.PI * 2);
              } else if (mask.type === 'rounded-rect') {
                const r = mask.radius || Math.min(dw, dh) * 0.15;
                safeRoundRect(ctx, -dw / 2, -dh / 2, dw, dh, r);
              }
              ctx.clip();
            } else if (clip.cornerRadius && clip.cornerRadius > 0) {
              ctx.beginPath();
              safeRoundRect(ctx, -dw / 2, -dh / 2, dw, dh, clip.cornerRadius);
              ctx.clip();
            }

            // Lip-Freeze (Visual Character Sync):
            // Freezes the character's closed/neutral mouth frame during vocal mute with 150ms gentle crossfade
            const isLipFrozen = Boolean(clip.lipFreeze || clip.visualMuteMode === 'lip_freeze');
            let lipFreezeCanvas = lipFreezeCanvasCache.get(clip.id);

            // 9:16 & 1:1 Canvas Blur Fill (CapCut Blur for vertical / square projects)
            const shouldBlurFill = Boolean(
              clip.canvasBlurFill || project.canvasBlurFill || project.canvas?.blurBackground
            );
            if (shouldBlurFill && (dw < width - 2 || dh < height - 2)) {
              ctx.save();
              const bgSource = (isVideoReady && video) ? video : (lipFreezeCanvas || cachedCanvas);
              if (bgSource) {
                ctx.filter = 'blur(28px) brightness(0.65)';
                let bgW = width * sX;
                let bgH = height * sY;
                const vRatio = vw / Math.max(1, vh);
                const cRatio = width / Math.max(1, height);
                if (vRatio > cRatio) {
                  bgH = height * sY;
                  bgW = (height * vRatio) * sX;
                } else {
                  bgW = width * sX;
                  bgH = (width / vRatio) * sY;
                }
                ctx.drawImage(bgSource, -bgW / 2, -bgH / 2, bgW, bgH);
              }
              ctx.restore();
            }

            // Draw active video or cached frame (with ChromaKey and Lip-Freeze support)
            const chroma = clip.effects?.chromaKey;
            const useChroma = chroma && chroma.enabled;

            if (isLipFrozen && !lipFreezeCanvas && isVideoReady && video) {
              try {
                lipFreezeCanvas = document.createElement('canvas');
                lipFreezeCanvas.width = video.videoWidth || 1920;
                lipFreezeCanvas.height = video.videoHeight || 1080;
                const fCtx = lipFreezeCanvas.getContext('2d');
                if (fCtx) {
                  fCtx.drawImage(video, 0, 0);
                  lipFreezeCanvasCache.set(clip.id, lipFreezeCanvas);
                }
              } catch {}
            }

            const clipRelSec = currentTime - (clip.startTime ?? clip.start ?? 0);
            const fadeDur = Math.min(0.15, (clip.duration || 1) * 0.35);

            let freezeBlend = 0;
            if (isLipFrozen && lipFreezeCanvas) {
              if (clipRelSec < fadeDur) {
                freezeBlend = Math.max(0, Math.min(1, clipRelSec / fadeDur));
              } else if (clipRelSec > clip.duration - fadeDur) {
                freezeBlend = Math.max(0, Math.min(1, (clip.duration - clipRelSec) / fadeDur));
              } else {
                freezeBlend = 1.0;
              }
            }

            if (freezeBlend >= 0.999 && lipFreezeCanvas) {
              // Full Lip-Freeze: Character mouth is held in pristine neutral frame
              drawMediaWithLut(ctx, lipFreezeCanvas, -dw / 2, -dh / 2, dw, dh, clip);
            } else if (isVideoReady && video) {
              try {
                // Smooth Motion Blur: Temporal frame blend before current frame
                if (clip.motionBlur) {
                  const mbCanvas = motionBlurCanvasCache.get(clip.id);
                  if (mbCanvas && mbCanvas.width > 0) {
                    ctx.save();
                    ctx.globalAlpha = Math.max(0, Math.min(1, currentOpacity * 0.32));
                    ctx.drawImage(mbCanvas, -dw / 2, -dh / 2, dw, dh);
                    ctx.restore();
                  }
                }

                if (useChroma) {
                  const processedCanvas = applyChromaKeyFrame(
                    video,
                    video.videoWidth,
                    video.videoHeight,
                    chroma.color || '#00FF00',
                    chroma.similarity || 0.35,
                    chroma.smoothness || 0.1
                  );
                  if (processedCanvas) {
                    drawMediaWithLut(ctx, processedCanvas, -dw / 2, -dh / 2, dw, dh, clip);
                  } else {
                    drawMediaWithLut(ctx, video, -dw / 2, -dh / 2, dw, dh, clip);
                  }
                } else {
                  drawMediaWithLut(ctx, video, -dw / 2, -dh / 2, dw, dh, clip);
                }

                // If crossfading into/out of lip freeze, blend frozen frame on top
                if (freezeBlend > 0.001 && lipFreezeCanvas) {
                  ctx.save();
                  ctx.globalAlpha = Math.max(0, Math.min(1, currentOpacity * freezeBlend));
                  drawMediaWithLut(ctx, lipFreezeCanvas, -dw / 2, -dh / 2, dw, dh, clip);
                  ctx.restore();
                }

                // Update offscreen frame cache ONLY with valid decoded pixels when NOT seeking
                if (!video.seeking && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
                  if (!cachedCanvas) {
                    cachedCanvas = document.createElement('canvas');
                    lastFrameCanvasCache.set(clip.id, cachedCanvas);
                  }
                  if (cachedCanvas.width !== video.videoWidth || cachedCanvas.height !== video.videoHeight) {
                    cachedCanvas.width = video.videoWidth;
                    cachedCanvas.height = video.videoHeight;
                  }
                  const cCtx = cachedCanvas.getContext('2d');
                  if (cCtx) {
                    cCtx.drawImage(video, 0, 0);
                  }

                  if (clip.motionBlur) {
                    let mbCanvas = motionBlurCanvasCache.get(clip.id);
                    if (!mbCanvas) {
                      mbCanvas = document.createElement('canvas');
                      motionBlurCanvasCache.set(clip.id, mbCanvas);
                    }
                    if (mbCanvas.width !== video.videoWidth || mbCanvas.height !== video.videoHeight) {
                      mbCanvas.width = video.videoWidth;
                      mbCanvas.height = video.videoHeight;
                    }
                    const mbCtx = mbCanvas.getContext('2d');
                    if (mbCtx) {
                      mbCtx.drawImage(video, 0, 0);
                    }
                  }
                }
              } catch (drawErr) {
                console.warn('[FORMA] Video frame draw exception, fallback to cache:', drawErr);
                if (lipFreezeCanvas) {
                  drawMediaWithLut(ctx, lipFreezeCanvas, -dw / 2, -dh / 2, dw, dh, clip);
                } else if (cachedCanvas) {
                  drawMediaWithLut(ctx, cachedCanvas, -dw / 2, -dh / 2, dw, dh, clip);
                }
              }
            } else if (lipFreezeCanvas) {
              drawMediaWithLut(ctx, lipFreezeCanvas, -dw / 2, -dh / 2, dw, dh, clip);
            } else if (cachedCanvas) {
              // Frame retention fallback: video is seeking, buffering or decoding
              drawMediaWithLut(ctx, cachedCanvas, -dw / 2, -dh / 2, dw, dh, clip);
            } else {
              // Check sibling clips sharing the same media source for an immediate retained frame
              let siblingCanvas: HTMLCanvasElement | null = null;
              if (clip.sourceUrl || (clip as any).filePath || clip.assetId) {
                for (const t of project.tracks) {
                  for (const c of t.clips) {
                    if (c.id !== clip.id && (c.sourceUrl === clip.sourceUrl || (c.assetId && c.assetId === clip.assetId))) {
                      const sibling = lastFrameCanvasCache.get(c.id);
                      if (sibling) {
                        siblingCanvas = sibling;
                        break;
                      }
                    }
                  }
                  if (siblingCanvas) break;
                }
              }

              if (siblingCanvas) {
                lastFrameCanvasCache.set(clip.id, siblingCanvas);
                drawMediaWithLut(ctx, siblingCanvas, -dw / 2, -dh / 2, dw, dh, clip);
              } else if (!clip.sourceUrl && !(clip as any).filePath && !(clip as any).file && !clip.assetId) {
                // Procedural / test clip fallback ONLY for clips without real media files
                drawProceduralClipContent(ctx, clip, dw, dh, currentTime);
              }
            }

            // Smooth Jump-Cut / Micro Frame Blend:
            // Eliminates head jump-cut when two clips meet or after Ripple Delete
            const isSmoothCut = Boolean(clip.smoothCutIn);
            const smoothDur = Math.max(0.04, (clip.smoothCutDurationMs || 160) / 1000);
            if (isSmoothCut && clipRelSec >= 0 && clipRelSec < smoothDur) {
              const prevClip = track.clips
                .filter(
                  (c) =>
                    c.id !== clip.id &&
                    (c.startTime ?? c.start ?? 0) + c.duration <= (clip.startTime ?? clip.start ?? 0) + 0.08
                )
                .sort(
                  (a, b) =>
                    (b.startTime ?? b.start ?? 0) + b.duration - ((a.startTime ?? a.start ?? 0) + a.duration)
                )[0];

              let prevFrame: HTMLCanvasElement | HTMLVideoElement | HTMLImageElement | null = prevClip
                ? lastFrameCanvasCache.get(prevClip.id) || lipFreezeCanvasCache.get(prevClip.id) || null
                : null;

              if (!prevFrame && prevClip && videoElements?.get(prevClip.id)) {
                const prevVid = videoElements.get(prevClip.id);
                if (prevVid && prevVid.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && prevVid.videoWidth > 0) {
                  prevFrame = prevVid;
                }
              }

              if (prevFrame) {
                const smoothProgress = Math.max(0, Math.min(1, clipRelSec / smoothDur));
                // Cosine S-curve micro-blend (starts at 1.0, ends at 0.0)
                const prevWeight = 0.5 * (1 + Math.cos(smoothProgress * Math.PI));
                if (prevWeight > 0.005) {
                  ctx.save();
                  ctx.globalAlpha = Math.max(0, Math.min(1, currentOpacity * prevWeight));
                  drawMediaWithLut(ctx, prevFrame, -dw / 2, -dh / 2, dw, dh, clip);
                  ctx.restore();
                }
              }
            }

            // Transition color overlay (e.g. dip to black/white)
            if (transOverlay && transOverlay.a > 0) {
              ctx.fillStyle = `rgba(${transOverlay.r}, ${transOverlay.g}, ${transOverlay.b}, ${transOverlay.a})`;
              ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
            }

            // Transition Overlays (Light leak, Film burn, Glitch, VHS)
            if (transLightLeak && transLightLeak.intensity > 0.05) {
              const grad = ctx.createLinearGradient(-dw / 2, -dh / 2, dw / 2, dh / 2);
              grad.addColorStop(0, `rgba(245, 158, 11, ${transLightLeak.intensity * 0.7})`);
              grad.addColorStop(0.5, `rgba(239, 68, 68, ${transLightLeak.intensity * 0.4})`);
              grad.addColorStop(1, `rgba(254, 240, 138, ${transLightLeak.intensity * 0.8})`);
              ctx.save();
              ctx.fillStyle = grad;
              ctx.globalCompositeOperation = 'screen';
              ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
              ctx.restore();
            }

            if (transFilmBurn && transFilmBurn.intensity > 0.05) {
              const grad = ctx.createRadialGradient(0, 0, 50, 0, 0, Math.max(dw, dh) / 2);
              grad.addColorStop(0, `rgba(255, 255, 255, ${transFilmBurn.intensity * 0.85})`);
              grad.addColorStop(0.6, `rgba(249, 115, 22, ${transFilmBurn.intensity * 0.6})`);
              grad.addColorStop(1, `rgba(185, 28, 28, ${transFilmBurn.intensity * 0.9})`);
              ctx.save();
              ctx.fillStyle = grad;
              ctx.globalCompositeOperation = 'screen';
              ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
              ctx.restore();
            }

            if (transGlitch && transGlitch.amount > 0.05) {
              ctx.save();
              ctx.fillStyle = 'rgba(0, 255, 255, 0.35)';
              ctx.fillRect(-dw / 2 + transGlitch.jitter, -dh * 0.2, dw, dh * 0.15);
              ctx.fillStyle = 'rgba(255, 0, 128, 0.35)';
              ctx.fillRect(-dw / 2 - transGlitch.jitter, dh * 0.1, dw, dh * 0.15);
              ctx.restore();
            }

            if (transVhs && transVhs.intensity > 0.05) {
              ctx.save();
              ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
              for (let y = -dh / 2; y < dh / 2; y += 4) {
                ctx.fillRect(-dw / 2, y, dw, 1.5);
              }
              ctx.restore();
            }

            // AI Watermark / Logo Mask (Delogo Patch: Blur / Pixelate)
            const patch = clip.delogoPatch || (clip.effects?.delogo ? { enabled: true, x: 80, y: 10, width: 15, height: 8, mode: 'blur' as const } : undefined);
            if (patch && patch.enabled) {
              const patchX = patch.x ?? patch.xPercent ?? 80;
              const patchY = patch.y ?? patch.yPercent ?? 10;
              const patchW = patch.width ?? patch.widthPercent ?? 15;
              const patchH = patch.height ?? patch.heightPercent ?? 8;
              const px = -dw / 2 + (patchX / 100) * dw;
              const py = -dh / 2 + (patchY / 100) * dh;
              const pw = (patchW / 100) * dw;
              const ph = (patchH / 100) * dh;

              if (pw > 2 && ph > 2) {
                ctx.save();
                if (patch.mode === 'pixelate' || patch.type === 'pixelate') {
                  try {
                    const pCanvas = document.createElement('canvas');
                    pCanvas.width = Math.max(4, Math.floor(pw / 8));
                    pCanvas.height = Math.max(4, Math.floor(ph / 8));
                    const pCtx = pCanvas.getContext('2d');
                    const srcElem = (isVideoReady && video) ? video : (lipFreezeCanvas || cachedCanvas);
                    if (pCtx && srcElem) {
                      pCtx.imageSmoothingEnabled = false;
                      const srcX = (patchX / 100) * vw;
                      const srcY = (patchY / 100) * vh;
                      const srcW = (patchW / 100) * vw;
                      const srcH = (patchH / 100) * vh;
                      pCtx.drawImage(srcElem, srcX, srcY, srcW, srcH, 0, 0, pCanvas.width, pCanvas.height);
                      ctx.imageSmoothingEnabled = false;
                      ctx.drawImage(pCanvas, 0, 0, pCanvas.width, pCanvas.height, px, py, pw, ph);
                    }
                  } catch (_) {}
                } else {
                  // Blur patch
                  ctx.beginPath();
                  safeRoundRect(ctx, px, py, pw, ph, 4);
                  ctx.clip();
                  ctx.filter = 'blur(16px)';
                  const srcElem = (isVideoReady && video) ? video : (lipFreezeCanvas || cachedCanvas);
                  if (srcElem) {
                    ctx.drawImage(srcElem, -dw / 2, -dh / 2, dw, dh);
                  }
                }
                ctx.restore();
              }
            }

            // Crisp AI Sharpness: restores high-frequency micro details on AI video footage
            if (
              (clip.effects?.sharpness && clip.effects.sharpness > 0) ||
              (clip.colorFilter && clip.colorFilter.includes('sharp'))
            ) {
              applyCrispAiSharpness(ctx, width, height, clip.effects?.sharpness || 0.45);
            }

            // Apply any active timed effect segments on this clip (deduplicated)
            const rawSegments = [
              ...(clip.effectSegments || []),
              ...((project.effectSegments || []).filter((s) => s.targetClipId === clip.id || !s.targetClipId)),
            ].filter((s) => s.enabled !== false && currentTime >= s.startTime && currentTime <= (s.startTime + s.duration));
            const seenEffIds = new Set<string>();
            const activeSegments: EffectSegment[] = [];
            for (const seg of rawSegments) {
              const k = seg.id || `${seg.effectId}-${seg.startTime.toFixed(2)}`;
              if (!seenEffIds.has(k)) {
                seenEffIds.add(k);
                activeSegments.push(seg);
              }
            }

            for (const seg of activeSegments) {
              const timeInEffect = currentTime - seg.startTime;
              applyVisualEffectSegment(
                ctx,
                dw,
                dh,
                seg.effectId,
                seg.parameters?.intensity ?? 0.5,
                timeInEffect,
                seg.parameters
              );
            }

            applyCanvasPostEffects(ctx, width, height, mergedEffects);
            ctx.restore();
          } else {
            // Buffer/loading placeholder: only draw procedural test graphics for test clips (440/880/klip-a/klip-b)
            const isTestProcedural = /440|[kc]lip[-_ ]?[ab]|^[ab]$/i.test(clip.name || clip.id);
            if (isTestProcedural) {
              ctx.save();
              ctx.translate(width / 2, height / 2);
              drawProceduralClipContent(ctx, clip, width * 0.75, height * 0.75, currentTime);
              ctx.restore();
            }
          }
      } else if (clip.type === 'image' || isElementClip) {
        try {
          let img = imageElements.get(clip.assetId || '') || imageElements.get(clip.id);
          const svgContent = clip.svgContent || getElementSvg(clip.elementPresetId || clip.assetId, clip.name);
          const isSvgElement = Boolean(
            svgContent ||
            clip.elementPresetId ||
            clip.assetId?.startsWith('element-') ||
            clip.sourceUrl?.startsWith('data:image/svg+xml') ||
            (clip.name && (clip.name.includes('TikTok') || clip.name.includes('Beğen') || clip.name.includes('Like') || clip.name.includes('YouTube') || clip.name.includes('Instagram')))
          );

          if (!img && isSvgElement) {
            const cached = elementCache.get(clip.id);
            if (cached instanceof HTMLImageElement && cached.complete && cached.naturalWidth > 0) {
              img = cached;
            } else {
              const svg = svgContent || (clip.sourceUrl?.startsWith('data:image/svg+xml') ? decodeURIComponent(clip.sourceUrl.replace('data:image/svg+xml;charset=utf-8,', '')) : undefined);
              if (svg) {
                const instantImg = new Image();
                instantImg.onload = () => {
                  notifyCanvasNeedsRedraw();
                };
                instantImg.src = createSvgDataUrl(svg);
                elementCache.set(clip.id, instantImg);
                if (instantImg.complete && instantImg.naturalWidth > 0) {
                  img = instantImg;
                }
              }
            }
          }
          const hasValidImg = Boolean(img && img.complete && img.naturalWidth > 0);
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, currentOpacity));

          let filterStr = buildCanvasFilterString(clip.effects);
          if (clip.deflicker || clip.effects?.deflicker) {
            const deflickerFilter = 'contrast(0.98) brightness(1.01)';
            filterStr = filterStr ? `${filterStr} ${deflickerFilter}` : deflickerFilter;
          }
          if (transBlur > 0) {
            filterStr = filterStr ? `${filterStr} blur(${transBlur}px)` : `blur(${transBlur}px)`;
          }
          ctx.filter = filterStr;

          const sX = currentScaleX * transScale * transScaleX * camScale;
          const sY = currentScaleY * transScale * transScaleY * camScale;
          const iw = hasValidImg ? (img!.naturalWidth || width) : width;
          const ih = hasValidImg ? (img!.naturalHeight || height) : height;
          let dw = width * sX;
          let dh = height * sY;

          const fitMode = clip.fitMode || 'fit';
          if (isElementClip) {
            const baseW = (clip as any).width || (hasValidImg && iw !== width ? iw : 280);
            const baseH = (clip as any).height || (hasValidImg && ih !== height ? ih : 200);
            dw = baseW * sX;
            dh = baseH * sY;
          } else if (fitMode === 'fit') {
            const imgRatio = iw / Math.max(1, ih);
            const canvasRatio = width / Math.max(1, height);
            if (imgRatio > canvasRatio) {
              dw = width * sX;
              dh = (width / imgRatio) * sY;
            } else {
              dh = height * sY;
              dw = (height * imgRatio) * sX;
            }
          } else if (fitMode === 'fill') {
            const imgRatio = iw / Math.max(1, ih);
            const canvasRatio = width / Math.max(1, height);
            if (imgRatio > canvasRatio) {
              dh = height * sY;
              dw = (height * imgRatio) * sX;
            } else {
              dw = width * sX;
              dh = (width / imgRatio) * sY;
            }
          }

          // 9:16 & 1:1 Smart Reframe Focus Calculation
          let reframeOffsetX = 0;
          if (dw > width + 4) {
            const excess = (dw - width) / 2;
            const focus = clip.smartReframeFocus ?? 'center';
            if (focus === 'left') {
              reframeOffsetX = excess * 0.85;
            } else if (focus === 'right') {
              reframeOffsetX = -excess * 0.85;
            } else if (typeof focus === 'number') {
              reframeOffsetX = -excess * (Math.max(-100, Math.min(100, focus)) / 100);
            }
          }

          // Positioning and Transforms
          const totalRotation = currentRotation + transRotation + camRotation;
          ctx.translate(
            width / 2 + currentX + transOffsetX + camOffsetX + reframeOffsetX,
            height / 2 + currentY + transOffsetY + camOffsetY
          );
          if (totalRotation !== 0) ctx.rotate((totalRotation * Math.PI) / 180);
          if (clip.flipH || clip.flipV) ctx.scale(clip.flipH ? -1 : 1, clip.flipV ? -1 : 1);

          // 9:16 & 1:1 Canvas Blur Fill (CapCut Blur for vertical / square projects)
          const shouldBlurFill = Boolean(
            clip.canvasBlurFill || project.canvasBlurFill || project.canvas?.blurBackground
          );
          if (shouldBlurFill && (dw < width - 2 || dh < height - 2)) {
            ctx.save();
            ctx.filter = 'blur(28px) brightness(0.65)';
            let bgW = width * sX;
            let bgH = height * sY;
            const imgRatio = iw / Math.max(1, ih);
            const cRatio = width / Math.max(1, height);
            if (imgRatio > cRatio) {
              bgH = height * sY;
              bgW = (height * imgRatio) * sX;
            } else {
              bgW = width * sX;
              bgH = (width / imgRatio) * sY;
            }
            if (hasValidImg && img) {
              ctx.drawImage(img, -bgW / 2, -bgH / 2, bgW, bgH);
            } else {
              drawProceduralClipContent(ctx, clip, bgW, bgH, currentTime);
            }
            ctx.restore();
          }

            // Wipe & Mask Transition Clipping
            if (transWipeRatio !== undefined) {
              ctx.beginPath();
              if (transWipeDir === 'left') {
                ctx.rect(-dw / 2, -dh / 2, dw * transWipeRatio, dh);
              } else if (transWipeDir === 'right') {
                ctx.rect(dw / 2 - dw * transWipeRatio, -dh / 2, dw * transWipeRatio, dh);
              } else if (transWipeDir === 'up') {
                ctx.rect(-dw / 2, -dh / 2, dw, dh * transWipeRatio);
              } else if (transWipeDir === 'down') {
                ctx.rect(-dw / 2, dh / 2 - dh * transWipeRatio, dw, dh * transWipeRatio);
              } else if (transWipeDir === 'diagonal') {
                ctx.moveTo(-dw / 2, -dh / 2);
                ctx.lineTo(-dw / 2 + dw * transWipeRatio * 2, -dh / 2);
                ctx.lineTo(-dw / 2, -dh / 2 + dh * transWipeRatio * 2);
                ctx.closePath();
              } else {
                ctx.rect(-dw / 2, -dh / 2, dw, dh);
              }
              ctx.clip();
            } else if (transMaskShape === 'circle-in' || transMaskShape === 'circle-out' || transMaskShape === 'soft-circle') {
              const maxR = Math.hypot(dw, dh) / 2;
              const r = maxR * (transMaskRadius ?? 1);
              ctx.beginPath();
              ctx.arc(0, 0, Math.max(0.1, r), 0, Math.PI * 2);
              ctx.clip();
            } else if (transMaskShape === 'clock') {
              ctx.beginPath();
              ctx.moveTo(0, 0);
              ctx.arc(0, 0, Math.hypot(dw, dh), -Math.PI / 2, -Math.PI / 2 + (transWipeRatio || 0) * 2 * Math.PI);
              ctx.closePath();
              ctx.clip();
            } else if (transMaskShape === 'blinds') {
              const slatCount = 8;
              const slatH = dh / slatCount;
              ctx.beginPath();
              for (let i = 0; i < slatCount; i++) {
                ctx.rect(-dw / 2, -dh / 2 + i * slatH, dw, slatH * (transWipeRatio || 0));
              }
              ctx.clip();
            } else if (transMaskShape === 'checker') {
              const cols = 8;
              const rows = 5;
              const cw = dw / cols;
              const ch = dh / rows;
              ctx.beginPath();
              for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                  if ((transWipeRatio || 0) >= ((r + c) / (rows + cols)) * 0.7) {
                    ctx.rect(-dw / 2 + c * cw, -dh / 2 + r * ch, cw, ch);
                  }
                }
              }
              ctx.clip();
            } else if (transMaskShape === 'split-h') {
              const splitW = (dw / 2) * (transWipeRatio || 0);
              ctx.beginPath();
              ctx.rect(-dw / 2, -dh / 2, dw / 2 - splitW, dh);
              ctx.rect(splitW, -dh / 2, dw / 2 - splitW, dh);
              ctx.clip();
            } else if (transMaskShape === 'split-v') {
              const splitH = (dh / 2) * (transWipeRatio || 0);
              ctx.beginPath();
              ctx.rect(-dw / 2, -dh / 2, dw, dh / 2 - splitH);
              ctx.rect(-dw / 2, splitH, dw, dh / 2 - splitH);
              ctx.clip();
            }

            // Crop Clipping (Top, Right, Bottom, Left %)
            const crop = clip.effects?.crop || (clip as any).crop;
            if (crop && (crop.top > 0 || crop.right > 0 || crop.bottom > 0 || crop.left > 0)) {
              ctx.beginPath();
              const cropX = -dw / 2 + (dw * (crop.left || 0)) / 100;
              const cropY = -dh / 2 + (dh * (crop.top || 0)) / 100;
              const cropW = dw * (1 - ((crop.left || 0) + (crop.right || 0)) / 100);
              const cropH = dh * (1 - ((crop.top || 0) + (crop.bottom || 0)) / 100);
              ctx.rect(cropX, cropY, Math.max(1, cropW), Math.max(1, cropH));
              ctx.clip();
            }

            // Mask Clipping
            const mask = clip.effects?.mask || (clip as any).mask;
            if (mask && mask.type !== 'none') {
              ctx.beginPath();
              if (mask.type === 'circle') {
                const r = Math.min(dw, dh) / 2;
                ctx.arc(0, 0, r, 0, Math.PI * 2);
              } else if (mask.type === 'rounded-rect') {
                const r = mask.radius || Math.min(dw, dh) * 0.15;
                safeRoundRect(ctx, -dw / 2, -dh / 2, dw, dh, r);
              }
              ctx.clip();
            } else if (clip.cornerRadius && clip.cornerRadius > 0) {
              ctx.beginPath();
              safeRoundRect(ctx, -dw / 2, -dh / 2, dw, dh, clip.cornerRadius);
              ctx.clip();
            }

            // Procedural Animated Elements (TikTok Follow, TikTok Like, Double Tap, YouTube Sub, Instagram Like)
            const clipRelSec = Math.max(0, currentTime - (clip.startTime ?? 0));
            const isHandledByAnimatedRenderer = renderAnimatedElement(ctx, clip, dw, dh, clipRelSec);

            if (!isHandledByAnimatedRenderer) {
              // Chroma Key for Image or procedural fallback
              if (hasValidImg && img) {
                const chroma = clip.effects?.chromaKey;
                const useChroma = chroma && chroma.enabled;
                if (useChroma) {
                  const processedCanvas = applyChromaKeyFrame(
                    img,
                    iw,
                    ih,
                    chroma.color || '#00FF00',
                    chroma.similarity || 0.35,
                    chroma.smoothness || 0.1
                  );
                  if (processedCanvas) {
                    drawMediaWithLut(ctx, processedCanvas, -dw / 2, -dh / 2, dw, dh, clip);
                  } else {
                    drawMediaWithLut(ctx, img, -dw / 2, -dh / 2, dw, dh, clip);
                  }
                } else {
                  drawMediaWithLut(ctx, img, -dw / 2, -dh / 2, dw, dh, clip);
                }
              } else {
                if (isSvgElement) {
                  drawVectorElementFallback(ctx, clip, dw, dh);
                } else {
                  drawProceduralClipContent(ctx, clip, dw, dh, currentTime);
                }
              }
            }

            // AI Watermark / Logo Mask (Delogo Patch: Blur / Pixelate)
            const imgPatch = clip.delogoPatch || (clip.effects?.delogo ? { enabled: true, x: 80, y: 10, width: 15, height: 8, mode: 'blur' as const } : undefined);
            if (imgPatch && imgPatch.enabled) {
              const patchX = imgPatch.x ?? imgPatch.xPercent ?? 80;
              const patchY = imgPatch.y ?? imgPatch.yPercent ?? 10;
              const patchW = imgPatch.width ?? imgPatch.widthPercent ?? 15;
              const patchH = imgPatch.height ?? imgPatch.heightPercent ?? 8;
              const px = -dw / 2 + (patchX / 100) * dw;
              const py = -dh / 2 + (patchY / 100) * dh;
              const pw = (patchW / 100) * dw;
              const ph = (patchH / 100) * dh;

              if (pw > 2 && ph > 2) {
                ctx.save();
                if (imgPatch.mode === 'pixelate' || (imgPatch as any).type === 'pixelate') {
                  try {
                    const pCanvas = document.createElement('canvas');
                    pCanvas.width = Math.max(4, Math.floor(pw / 8));
                    pCanvas.height = Math.max(4, Math.floor(ph / 8));
                    const pCtx = pCanvas.getContext('2d');
                    if (pCtx && hasValidImg && img) {
                      pCtx.imageSmoothingEnabled = false;
                      const srcX = (patchX / 100) * iw;
                      const srcY = (patchY / 100) * ih;
                      const srcW = (patchW / 100) * iw;
                      const srcH = (patchH / 100) * ih;
                      pCtx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, pCanvas.width, pCanvas.height);
                      ctx.imageSmoothingEnabled = false;
                      ctx.drawImage(pCanvas, 0, 0, pCanvas.width, pCanvas.height, px, py, pw, ph);
                    }
                  } catch (_) {}
                } else {
                  // Blur patch
                  ctx.beginPath();
                  safeRoundRect(ctx, px, py, pw, ph, 4);
                  ctx.clip();
                  ctx.filter = 'blur(16px)';
                  if (hasValidImg && img) {
                    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
                  } else {
                    drawProceduralClipContent(ctx, clip, dw, dh, currentTime);
                  }
                }
                ctx.restore();
              }
            }

            // Crisp AI Sharpness: restores high-frequency micro details
            if (
              (clip.effects?.sharpness && clip.effects.sharpness > 0) ||
              (clip.colorFilter && clip.colorFilter.includes('sharp'))
            ) {
              applyCrispAiSharpness(ctx, width, height, clip.effects?.sharpness || 0.45);
            }

            if (transOverlay && transOverlay.a > 0) {
              ctx.fillStyle = `rgba(${transOverlay.r}, ${transOverlay.g}, ${transOverlay.b}, ${transOverlay.a})`;
              ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
            }

            // Transition Overlays (Light leak, Film burn, Glitch, VHS)
            if (transLightLeak && transLightLeak.intensity > 0.05) {
              const grad = ctx.createLinearGradient(-dw / 2, -dh / 2, dw / 2, dh / 2);
              grad.addColorStop(0, `rgba(245, 158, 11, ${transLightLeak.intensity * 0.7})`);
              grad.addColorStop(0.5, `rgba(239, 68, 68, ${transLightLeak.intensity * 0.4})`);
              grad.addColorStop(1, `rgba(254, 240, 138, ${transLightLeak.intensity * 0.8})`);
              ctx.save();
              ctx.fillStyle = grad;
              ctx.globalCompositeOperation = 'screen';
              ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
              ctx.restore();
            }

            if (transFilmBurn && transFilmBurn.intensity > 0.05) {
              const grad = ctx.createRadialGradient(0, 0, 50, 0, 0, Math.max(dw, dh) / 2);
              grad.addColorStop(0, `rgba(255, 255, 255, ${transFilmBurn.intensity * 0.85})`);
              grad.addColorStop(0.6, `rgba(249, 115, 22, ${transFilmBurn.intensity * 0.6})`);
              grad.addColorStop(1, `rgba(185, 28, 28, ${transFilmBurn.intensity * 0.9})`);
              ctx.save();
              ctx.fillStyle = grad;
              ctx.globalCompositeOperation = 'screen';
              ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
              ctx.restore();
            }

            if (transGlitch && transGlitch.amount > 0.05) {
              ctx.save();
              ctx.fillStyle = 'rgba(0, 255, 255, 0.35)';
              ctx.fillRect(-dw / 2 + transGlitch.jitter, -dh * 0.2, dw, dh * 0.15);
              ctx.fillStyle = 'rgba(255, 0, 128, 0.35)';
              ctx.fillRect(-dw / 2 - transGlitch.jitter, dh * 0.1, dw, dh * 0.15);
              ctx.restore();
            }

            if (transVhs && transVhs.intensity > 0.05) {
              ctx.save();
              ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
              for (let y = -dh / 2; y < dh / 2; y += 4) {
                ctx.fillRect(-dw / 2, y, dw, 1.5);
              }
              ctx.restore();
            }

            // Apply any active timed effect segments on this clip (deduplicated)
            const rawSegments = [
              ...(clip.effectSegments || []),
              ...((project.effectSegments || []).filter((s) => s.targetClipId === clip.id || !s.targetClipId)),
            ].filter((s) => s.enabled !== false && currentTime >= s.startTime && currentTime <= (s.startTime + s.duration));
            const seenEffIds = new Set<string>();
            const activeSegments: EffectSegment[] = [];
            for (const seg of rawSegments) {
              const k = seg.id || `${seg.effectId}-${seg.startTime.toFixed(2)}`;
              if (!seenEffIds.has(k)) {
                seenEffIds.add(k);
                activeSegments.push(seg);
              }
            }

            for (const seg of activeSegments) {
              const timeInEffect = currentTime - seg.startTime;
              applyVisualEffectSegment(
                ctx,
                dw,
                dh,
                seg.effectId,
                seg.parameters?.intensity ?? 0.5,
                timeInEffect,
                seg.parameters
              );
            }

            applyCanvasPostEffects(ctx, width, height, clip.effects);
            ctx.restore();
        } catch (imgErr) {
          console.error('[FORMA] Error rendering image clip:', clip.id, imgErr);
        }
      } else if ((clip.type === 'text' || clip.type === 'subtitle') && clip.textData) {
        try {
          let effectiveTextData = { ...clip.textData };
          if ((clip as any).inAnimation) {
            effectiveTextData.inAnimation = (clip as any).inAnimation;
          }
          if ((clip as any).inDuration !== undefined) {
            effectiveTextData.inDuration = (clip as any).inDuration;
          }
          if (clip.animationSegments && clip.animationSegments.length > 0) {
            for (const seg of clip.animationSegments) {
              if (seg.type === 'in') {
                effectiveTextData.inAnimation = seg.animationName as any;
                effectiveTextData.inDuration = seg.duration;
                if (seg.easing) effectiveTextData.inEasing = seg.easing;
              } else if (seg.type === 'loop') {
                effectiveTextData.loopAnimation = seg.animationName as any;
                if (seg.speed) effectiveTextData.loopSpeed = seg.speed;
                if (seg.intensity) effectiveTextData.loopIntensity = seg.intensity;
              } else if (seg.type === 'out') {
                effectiveTextData.outAnimation = seg.animationName as any;
                effectiveTextData.outDuration = seg.duration;
                if (seg.easing) effectiveTextData.outEasing = seg.easing;
              }
            }
          }

          renderTextLayer(ctx, {
            layer: effectiveTextData,
            timeInClip: clipTime,
            clipDuration: clip.duration,
            canvasWidth: width,
            canvasHeight: height,
            centerX: width / 2 + currentX + transOffsetX,
            centerY: height / 2 + currentY + transOffsetY,
            scale: currentScaleX * transScale,
            rotation: currentRotation,
            opacity: currentOpacity,
          });
        } catch (textErr) {
          console.error('[FORMA] Error rendering text layer for clip:', clip.id, textErr);
        }
      }
    } catch (clipErr) {
      console.error('[FORMA] Error rendering clip in scene:', clip.id, clipErr);
    }
  }
}

  // 3. Subtitles
  if (project.subtitles && project.subtitles.length > 0) {
    try {
      const activeSub = project.subtitles.find((s) => currentTime >= s.start && currentTime <= s.end);
      if (activeSub) {
        renderTextLayer(ctx, {
          layer: {
            text: activeSub.text,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontSize: Math.round(height * 0.045),
            fontWeight: 'bold',
            color: '#ffffff',
            fillColor: '#ffffff',
            strokeColor: '#000000',
            strokeWidth: 3,
            backgroundColor: 'rgba(0,0,0,0.65)',
            backgroundOpacity: 0.65,
            paddingX: 18,
            paddingY: 10,
            borderRadius: 6,
            textAlign: 'center',
            alignment: 'center',
            shadowColor: 'rgba(0,0,0,0.8)',
            shadowBlur: 4,
            shadowOffsetX: 0,
            shadowOffsetY: 2,
          },
          timeInClip: 0,
          clipDuration: 1,
          canvasWidth: width,
          canvasHeight: height,
          centerX: width / 2,
          centerY: height * 0.88,
          scale: 1,
          rotation: 0,
          opacity: 1,
        });
      }
    } catch (subErr) {
      console.error('[FORMA] Error rendering subtitle:', subErr);
    }
  }

  // 4. Selected Clip Transform Handles (Only in interactive paused editor, NEVER during export or playback)
  if (selectedClipId && !renderCtx.isPlaying) {
    try {
      let selClip: VideoClip | undefined;
      for (const t of project.tracks) {
        const found = t.clips.find((c) => c.id === selectedClipId);
        if (found) {
          selClip = found;
          break;
        }
      }
      if (!selClip && project.clips) {
        selClip = project.clips[selectedClipId];
      }

      if (selClip) {
        const start = selClip.startTime ?? selClip.start ?? 0;
        if (currentTime >= start && currentTime < start + selClip.duration) {
          const mediaElem =
            videoElements.get(selClip.assetId || selClip.id) ||
            imageElements.get(selClip.assetId || selClip.id);
          drawTransformHandles(ctx, width, height, selClip, mediaElem);
        }
      }
    } catch (gizmoErr) {
      console.error('[FORMA] Error drawing transform gizmo:', gizmoErr);
    }
  }
}

/**
 * Draws precision selection bounding box, corner handles, midpoint handles,
 * top rotation pin, and dimension badge matching the exact rendered layer.
 */
function drawTransformHandles(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  clip: VideoClip,
  mediaElement?: HTMLVideoElement | HTMLImageElement | null
): void {
  const bounds = calculateClipBounds(clip, canvasW, canvasH, mediaElement, ctx);

  // Dev log for visual inspection & verification
  console.log(
    `[FORMA Gizmo] Selected: ${clip.id}, Bounds: ${Math.round(bounds.width)}x${Math.round(bounds.height)} at (${Math.round(bounds.centerX)}, ${Math.round(bounds.centerY)})`
  );

  ctx.save();
  ctx.translate(bounds.centerX, bounds.centerY);
  if (bounds.rotation !== 0) {
    ctx.rotate((bounds.rotation * Math.PI) / 180);
  }

  const boxW = bounds.width;
  const boxH = bounds.height;
  const halfW = boxW / 2;
  const halfH = boxH / 2;

  // 1. Crisp Purple Selection Outline (1.5px)
  ctx.strokeStyle = '#818cf8';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([]);
  ctx.strokeRect(-halfW, -halfH, boxW, boxH);

  // 2. Top Center Rotation Handle Pin
  const pinLength = 26;
  ctx.beginPath();
  ctx.moveTo(0, -halfH);
  ctx.lineTo(0, -halfH - pinLength);
  ctx.strokeStyle = '#818cf8';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Rotation Handle Circle
  const rotRadius = 5.5;
  ctx.beginPath();
  ctx.arc(0, -halfH - pinLength, rotRadius, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 3. 4 Corner Handles (8x8 white squares with purple stroke)
  const handleSize = 8;
  const corners = [
    [-halfW, -halfH],
    [halfW, -halfH],
    [halfW, halfH],
    [-halfW, halfH],
  ];

  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 1.5;

  for (const [hx, hy] of corners) {
    ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
    ctx.strokeRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
  }

  // 4. 4 Midpoint Edge Handles
  const midpoints = [
    [0, -halfH],
    [halfW, 0],
    [0, halfH],
    [-halfW, 0],
  ];

  for (const [mx, my] of midpoints) {
    ctx.fillRect(mx - handleSize / 2, my - handleSize / 2, handleSize, handleSize);
    ctx.strokeRect(mx - handleSize / 2, my - handleSize / 2, handleSize, handleSize);
  }

  // 5. Dimension / Layer Badge above gizmo
  const badgeText = `${Math.round(boxW)} × ${Math.round(boxH)}`;
  ctx.font = '500 11px "Plus Jakarta Sans", sans-serif';
  const textMetrics = ctx.measureText(badgeText);
  const badgeWidth = textMetrics.width + 14;
  const badgeHeight = 20;
  const badgeY = -halfH - pinLength - 16;

  ctx.fillStyle = 'rgba(15, 23, 42, 0.9)';
  ctx.beginPath();
  safeRoundRect(ctx, -badgeWidth / 2, badgeY - badgeHeight / 2, badgeWidth, badgeHeight, 4);
  ctx.fill();
  ctx.strokeStyle = 'rgba(129, 140, 248, 0.6)';
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.fillStyle = '#e0e7ff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, 0, badgeY);

  ctx.restore();
}

const elementCache = new Map<string, HTMLVideoElement | HTMLImageElement>();

export async function renderFrameToCanvas(
  canvas: HTMLCanvasElement,
  project: VideoProject,
  currentTime: number,
  selectedClipIdOrShowGizmo?: string | boolean | null,
  isPlaying = false,
  preloadedElements?: Map<string, HTMLVideoElement | HTMLImageElement>,
  playbackRate = 1.0,
  isExport = false
): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  isPlaybackLoopActive = Boolean(isPlaying);

  const selectedClipId = typeof selectedClipIdOrShowGizmo === 'string' ? selectedClipIdOrShowGizmo : null;

  const projectWithCompatibility: VideoProject = {
    ...project,
    canvas: project.canvas || {
      width: project.resolution.width,
      height: project.resolution.height,
      fps: project.fps,
      backgroundColor: project.backgroundColor || '#000000',
      aspectRatio: '16:9',
      resolution: '1080p',
    },
    clips:
      project.clips ||
      Object.fromEntries(project.tracks.flatMap((t) => t.clips).map((c) => [c.id, c])),
  };

  const videoElements = new Map<string, HTMLVideoElement>();
  const imageElements = new Map<string, HTMLImageElement>();

  for (const track of project.tracks) {
    if (track.muted || track.visible === false) continue;

    // Track-level transitions active at currentTime (deduplicated by id)
    const trackTransitionsMap = new Map<string, TimelineTransition>();
    for (const tr of (track.transitions || [])) trackTransitionsMap.set(tr.id, tr);
    for (const tr of (project.transitions || [])) {
      if (tr.trackId === track.id && !trackTransitionsMap.has(tr.id)) {
        trackTransitionsMap.set(tr.id, tr);
      }
    }
    const trackTransitions = Array.from(trackTransitionsMap.values());

    const activeTimelineTransition = trackTransitions.find((tr) => {
      const dur = tr.duration || 1.0;
      const tStart =
        tr.alignment === 'in'
          ? tr.cutTime
          : tr.alignment === 'out'
          ? tr.cutTime - dur
          : tr.cutTime - dur / 2;
      const tEnd = tStart + dur;
      return currentTime >= tStart && currentTime <= tEnd;
    });

    const activeLeftClip = activeTimelineTransition
      ? track.clips.find((c) => c.id === activeTimelineTransition.leftClipId) ||
        track.clips.find(
          (c) => Math.abs((c.startTime ?? 0) + c.duration - activeTimelineTransition.cutTime) < 0.35
        )
      : undefined;

    const activeRightClip = activeTimelineTransition
      ? track.clips.find((c) => c.id === activeTimelineTransition.rightClipId) ||
        track.clips.find(
          (c) => Math.abs((c.startTime ?? 0) - activeTimelineTransition.cutTime) < 0.35
        )
      : undefined;

    for (const clip of track.clips) {
      const start = clip.startTime ?? clip.start ?? 0;
      const isInActiveTransition =
        !!activeTimelineTransition &&
        ((activeLeftClip && clip.id === activeLeftClip.id) ||
         (activeRightClip && clip.id === activeRightClip.id));

      const isProjectEnd = (start + clip.duration) >= ((project.duration || 0) - 0.005);
      const isTimeInClip = currentTime >= start && (isProjectEnd ? currentTime <= start + clip.duration : currentTime < start + clip.duration);

      if (isInActiveTransition || isTimeInClip) {
        // Isolate video element per clip instance so split clips never contend or fight over seeking/playback
        let elem =
          preloadedElements?.get(clip.id) ||
          preloadedElements?.get(clip.assetId || '') ||
          elementCache.get(clip.id);

        if (!elem && (clip.sourceUrl || clip.assetId || clip.svgContent || clip.elementPresetId)) {
          const url = await resolveClipMediaUrl(clip);

          if (url) {
            if (clip.type === 'video') {
              const v = document.createElement('video');
              v.crossOrigin = 'anonymous';
              v.muted = true;
              v.playsInline = true;
              v.preload = 'auto';
              v.autoplay = false;
              v.src = url;

              // Self-healing error listener: if media fails to load (e.g. stale blob), reload from IndexedDB
              v.addEventListener('error', async () => {
                if (clip.assetId) {
                  try {
                    const { getAssetBlob } = await import('../db');
                    const blob = await getAssetBlob(clip.assetId);
                    if (blob) {
                      const freshUrl = URL.createObjectURL(blob);
                      sessionLiveBlobUrls.set(clip.assetId, freshUrl);
                      v.src = freshUrl;
                      v.load();
                    }
                  } catch {}
                }
              });

              if (typeof document !== 'undefined' && document.body) {
                let hiddenContainer = document.getElementById('forma-offscreen-media-container');
                if (!hiddenContainer) {
                  hiddenContainer = document.createElement('div');
                  hiddenContainer.id = 'forma-offscreen-media-container';
                  hiddenContainer.style.position = 'fixed';
                  hiddenContainer.style.left = '-9999px';
                  hiddenContainer.style.top = '-9999px';
                  hiddenContainer.style.width = '1px';
                  hiddenContainer.style.height = '1px';
                  hiddenContainer.style.opacity = '0';
                  hiddenContainer.style.pointerEvents = 'none';
                  document.body.appendChild(hiddenContainer);
                }
                if (!v.parentElement) {
                  hiddenContainer.appendChild(v);
                }
              }

              // Reactive listeners so canvas redraws the moment decoded frames become ready
              const onFrameEvent = () => {
                notifyCanvasNeedsRedraw();
              };
              v.addEventListener('loadedmetadata', () => {
                if (v.currentTime === 0) {
                  try {
                    v.currentTime = 0.0001;
                  } catch {}
                }
                notifyCanvasNeedsRedraw();
              });
              v.addEventListener('loadeddata', onFrameEvent);
              v.addEventListener('canplay', onFrameEvent);
              v.addEventListener('canplaythrough', onFrameEvent);
              v.addEventListener('seeked', onFrameEvent);

              try {
                v.load();
              } catch {}

              elementCache.set(clip.id, v);
              elem = v;

              // Non-blocking frame readiness: request redraw the moment frame arrives
              if (v.readyState < 2) {
                v.addEventListener('canplay', () => notifyCanvasNeedsRedraw(), { once: true });
              }
            } else if (clip.type === 'image') {
              const img = new Image();
              // Only apply crossOrigin for external http(s) URLs; never for data: or blob:
              if (url.startsWith('http://') || url.startsWith('https://')) {
                img.crossOrigin = 'anonymous';
              }
              img.src = url;
              elementCache.set(clip.id, img);
              elem = img;
              if (!img.complete || img.naturalWidth === 0) {
                await new Promise<void>((resolve) => {
                  let resolved = false;
                  const done = () => {
                    if (!resolved) {
                      resolved = true;
                      resolve();
                    }
                  };
                  img.onload = done;
                  img.onerror = done;
                  if (img.complete && img.naturalWidth > 0) {
                    done();
                  } else if (typeof img.decode === 'function') {
                    img.decode().then(done).catch(done);
                  }
                  setTimeout(done, 500);
                });
              }
            }
          }
        }

        if (elem) {
          if (elem instanceof HTMLVideoElement) {
            const isLipFrozen = Boolean(clip.lipFreeze || clip.visualMuteMode === 'lip_freeze');
            const frozenTime = clip.lipFreezeFrameTime ?? (clip.trimIn ?? 0);

            const rampedSec = computeSpeedRampedClipTime(
              currentTime - start,
              clip.duration,
              clip.speedRampPreset,
              clip.speed || 1.0
            );
            let clipRelSec = rampedSec + clip.trimIn;
            if (isInActiveTransition) {
              const trimIn = clip.trimIn || 0;
              const maxSource = clip.sourceDuration || (trimIn + clip.duration);
              const rawSourceTime = trimIn + rampedSec;
              clipRelSec = Math.max(0, Math.min(maxSource, rawSourceTime));
            }

            // Lip-Freeze: If frozen and snapshot not yet taken, prime video element at the neutral onset frame
            if (isLipFrozen && !lipFreezeCanvasCache.has(clip.id)) {
              clipRelSec = frozenTime;
            }

            if (isExport) {
              if (!elem.paused) {
                try { elem.pause(); } catch {}
              }
              if (Math.abs(elem.currentTime - clipRelSec) > 0.005) {
                await seekVideoFrame(elem, clipRelSec);
              }
              // Immediately sync freshly decoded video frame to lastFrameCanvasCache
              if (elem.videoWidth > 0 && elem.videoHeight > 0) {
                let off = lastFrameCanvasCache.get(clip.id);
                if (!off || off.width !== elem.videoWidth || off.height !== elem.videoHeight) {
                  off = document.createElement('canvas');
                  off.width = elem.videoWidth;
                  off.height = elem.videoHeight;
                  lastFrameCanvasCache.set(clip.id, off);
                }
                const offCtx = off.getContext('2d');
                if (offCtx) {
                  offCtx.drawImage(elem, 0, 0);
                }
              }
            } else if (isPlaying && playbackRate > 0) {
              const targetSpeed = (clip.speed || 1.0) * playbackRate;
              if (elem.paused) {
                if (Math.abs(elem.currentTime - clipRelSec) > 0.12 && !elem.seeking) {
                  try { elem.currentTime = clipRelSec; } catch {}
                }
                (elem as any)._playbackStartTime = performance.now();
                elem.play().catch(() => {});
              }

              const drift = clipRelSec - elem.currentTime;
              const now = performance.now();
              const timeSinceStart = now - ((elem as any)._playbackStartTime || 0);
              const lastSeekTime = (elem as any)._lastHardSeekTime || 0;

              // Do NOT issue hard seeks during playback unless drift is massive (> 1.25s), 
              // the video element has had at least 650ms to settle, and not within 800ms of last seek
              if (Math.abs(drift) > 1.25 && timeSinceStart > 650 && (now - lastSeekTime > 800) && !elem.seeking) {
                (elem as any)._lastHardSeekTime = now;
                try { elem.currentTime = clipRelSec; } catch {}
              } else if (Math.abs(drift) > 0.02) {
                // Smooth catch-up via playbackRate adaptation without interrupting decode stream
                const catchUpMultiplier = drift > 0
                  ? Math.min(1.35, 1.0 + Math.min(0.35, drift * 0.45))
                  : Math.max(0.75, 1.0 + Math.max(-0.25, drift * 0.45));
                elem.playbackRate = Math.min(4.0, targetSpeed * catchUpMultiplier);
              } else {
                elem.playbackRate = Math.min(4.0, targetSpeed);
              }
            } else {
              if (!elem.paused) {
                elem.pause();
              }
              const lastSought = (elem as any)._lastSoughtTime;
              if (Math.abs(elem.currentTime - clipRelSec) > 0.075 && !elem.seeking) {
                if (lastSought === undefined || Math.abs(lastSought - clipRelSec) > 0.04) {
                  (elem as any)._lastSoughtTime = clipRelSec;
                  try { elem.currentTime = clipRelSec; } catch {}
                }
              }
            }

            videoElements.set(clip.id, elem);
            if (clip.assetId) videoElements.set(clip.assetId, elem);
          } else if (elem instanceof HTMLImageElement) {
            imageElements.set(clip.id, elem);
            if (clip.assetId) imageElements.set(clip.assetId, elem);
          }
        }
      } else {
        const assetKey = clip.assetId || clip.id;
        const elem =
          preloadedElements?.get(clip.id) ||
          preloadedElements?.get(clip.assetId || '') ||
          elementCache.get(assetKey);
        if (elem && elem instanceof HTMLVideoElement && !elem.paused) {
          elem.pause();
        }
      }
    }
  }

  const needsScale = canvas.width !== project.resolution.width || canvas.height !== project.resolution.height;
  if (needsScale) {
    ctx.save();
    ctx.scale(canvas.width / project.resolution.width, canvas.height / project.resolution.height);
  }

  renderScene({
    canvas,
    ctx,
    project: projectWithCompatibility,
    currentTime,
    videoElements,
    imageElements,
    selectedClipId,
    showSafeZones: false,
    isPlaying,
    playbackRate,
    isExport,
  });

  if (needsScale) {
    ctx.restore();
  }
}

/**
 * Pre-warm all media elements for the project to ensure zero-lag switching across split clips
 */
export async function preloadProjectMedia(project: VideoProject): Promise<void> {
  if (typeof document === 'undefined') return;

  let hiddenContainer = document.getElementById('forma-offscreen-media-container');
  if (!hiddenContainer && document.body) {
    hiddenContainer = document.createElement('div');
    hiddenContainer.id = 'forma-offscreen-media-container';
    hiddenContainer.style.position = 'fixed';
    hiddenContainer.style.left = '-9999px';
    hiddenContainer.style.top = '-9999px';
    hiddenContainer.style.width = '1px';
    hiddenContainer.style.height = '1px';
    hiddenContainer.style.opacity = '0';
    hiddenContainer.style.pointerEvents = 'none';
    document.body.appendChild(hiddenContainer);
  }

  for (const track of project.tracks) {
    if (track.muted || track.visible === false) continue;
    for (const clip of track.clips) {
      if (clip.type === 'video' && !elementCache.has(clip.id)) {
        const url = await resolveClipMediaUrl(clip);
        if (url) {
          const v = document.createElement('video');
          v.crossOrigin = 'anonymous';
          v.muted = true;
          v.playsInline = true;
          v.preload = 'auto';
          v.autoplay = false;
          v.src = url;
          if (hiddenContainer && !v.parentElement) hiddenContainer.appendChild(v);
          v.addEventListener('loadedmetadata', () => {
            try {
              v.currentTime = clip.trimIn || 0.001;
            } catch {}
          }, { once: true });
          v.addEventListener('canplay', () => notifyCanvasNeedsRedraw(), { once: true });
          try { v.load(); } catch {}
          elementCache.set(clip.id, v);
        }
      }
    }
  }
}


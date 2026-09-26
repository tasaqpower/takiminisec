/**
 * FORMA Video Editor — Preview Renderer
 * High-performance composite scene renderer for the interactive preview canvas
 * Includes flicker-free video frame retention, hardware-accelerated playback sync,
 * exact clip bounding gizmo, full transition support, and typography rasterization.
 */

import type { VideoProject, VideoClip, Keyframe } from '../types';
import { buildCanvasFilterString, applyCanvasPostEffects } from './filterEngine';
import { computeTransitionState } from './transitionEngine';
import { renderTextLayer } from './textRasterizer';
import { calculateClipBounds } from './clipBounds';

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
}

// Retain last known good frame per clip to completely eliminate black flashes during seeking
const lastFrameCanvasCache = new Map<string, HTMLCanvasElement>();

type RedrawCallback = () => void;
const redrawCallbacks = new Set<RedrawCallback>();

export function registerRedrawCallback(cb: RedrawCallback): () => void {
  redrawCallbacks.add(cb);
  return () => {
    redrawCallbacks.delete(cb);
  };
}

export function notifyCanvasNeedsRedraw(): void {
  for (const cb of redrawCallbacks) {
    try {
      cb();
    } catch (e) {
      console.warn('[FORMA] Redraw callback error:', e);
    }
  }
}

/**
 * Validates if video element has decoded playable frame data ready for canvas rendering
 */
export function isVideoFrameReady(video: HTMLVideoElement | null | undefined): boolean {
  if (!video) return false;
  return video.readyState >= 2 && !video.seeking && video.videoWidth > 0 && video.videoHeight > 0;
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
  // Video & Image tracks are base layers (drawn first).
  // Text & Subtitle tracks are overlay layers (drawn on top of video/image).
  // Within each group, tracks that appear lower in the timeline UI (higher index) are drawn first,
  // so the topmost track in the timeline UI appears on the very top of the scene.
  const tracksToRender = [...project.tracks]
    .filter((t) => !t.muted && t.visible !== false && t.type !== 'audio')
    .sort((a, b) => {
      const isOverlayA = a.type === 'text' || a.type === 'subtitle';
      const isOverlayB = b.type === 'text' || b.type === 'subtitle';
      if (!isOverlayA && isOverlayB) return -1;
      if (isOverlayA && !isOverlayB) return 1;
      const idxA = project.tracks.indexOf(a);
      const idxB = project.tracks.indexOf(b);
      return idxB - idxA;
    });

  for (const track of tracksToRender) {
    for (const clip of track.clips) {
      try {
        const start = clip.startTime ?? clip.start ?? 0;
        const end = start + clip.duration;

        // Only process clips active at currentTime
        if (currentTime < start || currentTime > end) continue;

        const clipTime = (currentTime - start) * (clip.speed || 1.0);

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

        // Transitions
        let transOffsetX = 0;
        let transOffsetY = 0;
        let transScale = 1;
        let transBlur = 0;
        let transWipeRatio: number | undefined;
        let transWipeDir: 'left' | 'right' | 'up' | 'down' | undefined;
        let transOverlay: { r: number; g: number; b: number; a: number } | undefined;

        // In transition
        if (
          clip.transitionIn &&
          clip.transitionIn.type !== 'none' &&
          clip.transitionIn.type !== 'cut' &&
          clipTime < clip.transitionIn.duration
        ) {
          const p = clipTime / Math.max(0.01, clip.transitionIn.duration);
          const st = computeTransitionState(p, clip.transitionIn.type, true);
          currentOpacity *= st.opacity;
          transOffsetX = st.offsetX * width;
          transOffsetY = st.offsetY * height;
          transScale *= st.scale;
          if (st.blur) transBlur = Math.max(transBlur, st.blur);
          if (st.wipeRatio !== undefined) {
            transWipeRatio = st.wipeRatio;
            transWipeDir = st.wipeDirection;
          }
          if (st.colorOverlay) transOverlay = st.colorOverlay;
        }

        // Out transition
        const timeToEnd = clip.duration - clipTime;
        if (
          clip.transitionOut &&
          clip.transitionOut.type !== 'none' &&
          clip.transitionOut.type !== 'cut' &&
          timeToEnd < clip.transitionOut.duration
        ) {
          const p = 1 - timeToEnd / Math.max(0.01, clip.transitionOut.duration);
          const st = computeTransitionState(p, clip.transitionOut.type, false);
          currentOpacity *= st.opacity;
          transOffsetX = st.offsetX * width;
          transOffsetY = st.offsetY * height;
          transScale *= st.scale;
          if (st.blur) transBlur = Math.max(transBlur, st.blur);
          if (st.wipeRatio !== undefined) {
            transWipeRatio = st.wipeRatio;
            transWipeDir = st.wipeDirection;
          }
          if (st.colorOverlay) transOverlay = st.colorOverlay;
        }

        // Render by type
        if (clip.type === 'video') {
          const video = videoElements.get(clip.assetId || '') || videoElements.get(clip.id);
          const cacheKey = clip.assetId || clip.id;
          let cachedCanvas = lastFrameCanvasCache.get(cacheKey) || lastFrameCanvasCache.get(clip.id);
          const isVideoReady = isVideoFrameReady(video);

          if (isVideoReady || cachedCanvas) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, currentOpacity));

            // Safe Filters & Transition blur
            let filterStr = buildCanvasFilterString(clip.effects);
            if (transBlur > 0) {
              filterStr = filterStr ? `${filterStr} blur(${transBlur}px)` : `blur(${transBlur}px)`;
            }
            ctx.filter = filterStr;

            // Positioning and Transforms
            ctx.translate(width / 2 + currentX + transOffsetX, height / 2 + currentY + transOffsetY);
            if (currentRotation !== 0) ctx.rotate((currentRotation * Math.PI) / 180);
            if (clip.flipH || clip.flipV) ctx.scale(clip.flipH ? -1 : 1, clip.flipV ? -1 : 1);

            const sX = currentScaleX * transScale;
            const sY = currentScaleY * transScale;
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

            // Wipe Transition Clipping
            if (transWipeRatio !== undefined && transWipeDir) {
              ctx.beginPath();
              if (transWipeDir === 'left') {
                ctx.rect(-dw / 2, -dh / 2, dw * transWipeRatio, dh);
              } else if (transWipeDir === 'right') {
                ctx.rect(dw / 2 - dw * transWipeRatio, -dh / 2, dw * transWipeRatio, dh);
              } else {
                ctx.rect(-dw / 2, -dh / 2, dw, dh);
              }
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

            // Draw active video or cached frame (with ChromaKey support)
            const chroma = clip.effects?.chromaKey;
            const useChroma = chroma && chroma.enabled;

            if (isVideoReady && video) {
              try {
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
                    ctx.drawImage(processedCanvas, -dw / 2, -dh / 2, dw, dh);
                  } else {
                    ctx.drawImage(video, -dw / 2, -dh / 2, dw, dh);
                  }
                } else {
                  ctx.drawImage(video, -dw / 2, -dh / 2, dw, dh);
                }

                // Update offscreen frame cache ONLY with valid decoded pixels
                if (!cachedCanvas) {
                  cachedCanvas = document.createElement('canvas');
                  lastFrameCanvasCache.set(clip.id, cachedCanvas);
                  if (clip.assetId) lastFrameCanvasCache.set(clip.assetId, cachedCanvas);
                }
                if (cachedCanvas.width !== video.videoWidth || cachedCanvas.height !== video.videoHeight) {
                  cachedCanvas.width = video.videoWidth;
                  cachedCanvas.height = video.videoHeight;
                }
                const cCtx = cachedCanvas.getContext('2d');
                if (cCtx) {
                  cCtx.drawImage(video, 0, 0);
                }
              } catch (drawErr) {
                console.warn('[FORMA] Video frame draw exception, fallback to cache:', drawErr);
                if (cachedCanvas) {
                  ctx.drawImage(cachedCanvas, -dw / 2, -dh / 2, dw, dh);
                }
              }
            } else if (cachedCanvas) {
              // Frame retention fallback: video is seeking, buffering or decoding
              ctx.drawImage(cachedCanvas, -dw / 2, -dh / 2, dw, dh);
            }

            // Transition color overlay (e.g. dip to black/white)
            if (transOverlay && transOverlay.a > 0) {
              ctx.fillStyle = `rgba(${transOverlay.r}, ${transOverlay.g}, ${transOverlay.b}, ${transOverlay.a})`;
              ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
            }

            applyCanvasPostEffects(ctx, width, height, clip.effects);
            ctx.restore();
          }
      } else if (clip.type === 'image') {
        try {
          const img = imageElements.get(clip.assetId || '') || imageElements.get(clip.id);
          if (img && img.complete && img.naturalWidth > 0) {
            ctx.save();
            ctx.globalAlpha = Math.max(0, Math.min(1, currentOpacity));

            let filterStr = buildCanvasFilterString(clip.effects);
            if (transBlur > 0) {
              filterStr = filterStr ? `${filterStr} blur(${transBlur}px)` : `blur(${transBlur}px)`;
            }
            ctx.filter = filterStr;

            ctx.translate(width / 2 + currentX + transOffsetX, height / 2 + currentY + transOffsetY);
            if (currentRotation !== 0) ctx.rotate((currentRotation * Math.PI) / 180);
            if (clip.flipH || clip.flipV) ctx.scale(clip.flipH ? -1 : 1, clip.flipV ? -1 : 1);

            const sX = currentScaleX * transScale;
            const sY = currentScaleY * transScale;
            const iw = img.naturalWidth || width;
            const ih = img.naturalHeight || height;
            let dw = width * sX;
            let dh = height * sY;

            const fitMode = clip.fitMode || 'fit';
            if (fitMode === 'fit') {
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

            if (transWipeRatio !== undefined && transWipeDir) {
              ctx.beginPath();
              if (transWipeDir === 'left') {
                ctx.rect(-dw / 2, -dh / 2, dw * transWipeRatio, dh);
              } else if (transWipeDir === 'right') {
                ctx.rect(dw / 2 - dw * transWipeRatio, -dh / 2, dw * transWipeRatio, dh);
              } else {
                ctx.rect(-dw / 2, -dh / 2, dw, dh);
              }
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

            // Chroma Key for Image
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
                ctx.drawImage(processedCanvas, -dw / 2, -dh / 2, dw, dh);
              } else {
                ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
              }
            } else {
              ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
            }

            if (transOverlay && transOverlay.a > 0) {
              ctx.fillStyle = `rgba(${transOverlay.r}, ${transOverlay.g}, ${transOverlay.b}, ${transOverlay.a})`;
              ctx.fillRect(-dw / 2, -dh / 2, dw, dh);
            }

            applyCanvasPostEffects(ctx, width, height, clip.effects);
            ctx.restore();
          }
        } catch (imgErr) {
          console.error('[FORMA] Error rendering image clip:', clip.id, imgErr);
        }
      } else if ((clip.type === 'text' || clip.type === 'subtitle') && clip.textData) {
        try {
          renderTextLayer(ctx, {
            layer: clip.textData,
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
  isPlaying = false
): Promise<void> {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

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

    for (const clip of track.clips) {
      const start = clip.startTime ?? clip.start ?? 0;

      if (currentTime >= start && currentTime <= start + clip.duration) {
        const assetKey = clip.assetId || clip.id;
        let elem = elementCache.get(assetKey);

        if (!elem && (clip.sourceUrl || clip.assetId)) {
          let url = clip.sourceUrl;
          if (clip.assetId) {
            try {
              const { getAssetBlob } = await import('../db');
              const blob = await getAssetBlob(clip.assetId);
              if (blob) url = URL.createObjectURL(blob);
            } catch (blobErr) {
              console.warn('[FORMA] Could not load blob for asset:', clip.assetId, blobErr);
            }
          }

          if (url) {
            if (clip.type === 'video') {
              const v = document.createElement('video');
              v.crossOrigin = 'anonymous';
              v.muted = true;
              v.playsInline = true;
              v.preload = 'auto';
              v.autoplay = false;
              v.src = url;

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

              elementCache.set(assetKey, v);
              elem = v;

              // Ensure video initial frame data is ready before first draw
              if (v.readyState < 2) {
                await new Promise<void>((resolve) => {
                  const onReady = () => {
                    v.removeEventListener('loadeddata', onReady);
                    v.removeEventListener('canplay', onReady);
                    resolve();
                  };
                  v.addEventListener('loadeddata', onReady);
                  v.addEventListener('canplay', onReady);
                  setTimeout(resolve, 400);
                });
              }
            } else if (clip.type === 'image') {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.src = url;
              elementCache.set(assetKey, img);
              elem = img;
              if (!img.complete) {
                await new Promise<void>((resolve) => {
                  img.onload = () => resolve();
                  img.onerror = () => resolve();
                  setTimeout(resolve, 350);
                });
              }
            }
          }
        }

        if (elem) {
          if (elem instanceof HTMLVideoElement) {
            const clipRelSec = (currentTime - start) * (clip.speed || 1.0) + clip.trimIn;

            if (isPlaying) {
              elem.playbackRate = clip.speed || 1.0;
              if (elem.paused) {
                elem.play().catch(() => {});
              }
              if (Math.abs(elem.currentTime - clipRelSec) > 0.25) {
                elem.currentTime = clipRelSec;
              }
            } else {
              if (!elem.paused) {
                elem.pause();
              }
              if (Math.abs(elem.currentTime - clipRelSec) > 0.03) {
                elem.currentTime = clipRelSec;
                if (elem.seeking) {
                  await new Promise<void>((resolve) => {
                    const onSeeked = () => {
                      elem.removeEventListener('seeked', onSeeked);
                      resolve();
                    };
                    elem.addEventListener('seeked', onSeeked);
                    setTimeout(resolve, 200);
                  });
                }
              }
            }

            videoElements.set(clip.assetId || clip.id, elem);
            videoElements.set(clip.id, elem);
          } else if (elem instanceof HTMLImageElement) {
            imageElements.set(clip.assetId || clip.id, elem);
            imageElements.set(clip.id, elem);
          }
        }
      } else {
        const assetKey = clip.assetId || clip.id;
        const elem = elementCache.get(assetKey);
        if (elem && elem instanceof HTMLVideoElement && !elem.paused) {
          elem.pause();
        }
      }
    }
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
  });
}

/**
 * FORMA Video Editor — Preview Renderer
 * High-performance composite scene renderer for the interactive preview canvas
 * Includes flicker-free video frame retention and hardware-accelerated playback sync.
 */

import type { VideoProject, VideoClip, Keyframe } from '../types';
import { buildCanvasFilterString, applyCanvasPostEffects } from './filterEngine';
import { computeTransitionState } from './transitionEngine';
import { renderTextLayer } from './textRasterizer';

export interface RenderContext {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  project: VideoProject;
  currentTime: number;
  videoElements: Map<string, HTMLVideoElement>;
  imageElements: Map<string, HTMLImageElement>;
  selectedClipId?: string | null;
  showSafeZones?: boolean;
}

// Retain last known good frame per clip to completely eliminate black flashes during seeking
const lastFrameCanvasCache = new Map<string, HTMLCanvasElement>();

/**
 * Linearly interpolates value between two keyframes
 */
function interpolateKeyframeValue(
  keyframes: Keyframe[] | undefined,
  clipTime: number,
  field: 'x' | 'y' | 'scale' | 'rotation' | 'opacity',
  defaultValue: number
): number {
  if (!keyframes || keyframes.length === 0) return defaultValue;

  const validKfs = keyframes
    .filter((kf) => kf[field] !== undefined)
    .sort((a, b) => a.time - b.time);

  if (validKfs.length === 0) return defaultValue;
  if (clipTime <= validKfs[0].time) return validKfs[0][field] ?? defaultValue;
  if (clipTime >= validKfs[validKfs.length - 1].time) {
    return validKfs[validKfs.length - 1][field] ?? defaultValue;
  }

  // Find surrounding pair
  for (let i = 0; i < validKfs.length - 1; i++) {
    const k1 = validKfs[i];
    const k2 = validKfs[i + 1];
    if (clipTime >= k1.time && clipTime <= k2.time) {
      let t = (clipTime - k1.time) / (k2.time - k1.time);
      if (k2.easing === 'ease-in-out') {
        t = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
      }
      const v1 = k1[field] ?? defaultValue;
      const v2 = k2[field] ?? defaultValue;
      return v1 + (v2 - v1) * t;
    }
  }

  return defaultValue;
}

/**
 * Master render function
 */
export function renderScene(rc: RenderContext): void {
  const {
    canvas,
    ctx,
    project,
    currentTime,
    videoElements,
    imageElements,
    selectedClipId,
    showSafeZones = false,
  } = rc;

  const width = canvas.width;
  const height = canvas.height;

  // 1. Clear background
  ctx.save();
  ctx.fillStyle = project.canvas?.backgroundColor || project.backgroundColor || '#000000';
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // 2. Sort tracks by order ascending (bottom to top)
  const sortedTracks = [...project.tracks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  // 3. Render active clips per track
  for (const track of sortedTracks) {
    if (track.isHidden || track.visible === false) continue;

    const clipsList = track.clips || (project.clips ? Object.values(project.clips).filter((c) => c.trackId === track.id) : []);

    const trackClips = clipsList.filter(
      (c) => {
        const start = c.startTime ?? c.start ?? 0;
        return currentTime >= start && currentTime < start + c.duration;
      }
    );

    for (const clip of trackClips) {
      const start = clip.startTime ?? clip.start ?? 0;
      const clipTime = (currentTime - start) * (clip.speed || 1.0);

      // Evaluate keyframed transforms or static clip values
      const currentX = interpolateKeyframeValue(clip.keyframes, clipTime, 'x', clip.transform?.x ?? clip.x ?? 0);
      const currentY = interpolateKeyframeValue(clip.keyframes, clipTime, 'y', clip.transform?.y ?? clip.y ?? 0);
      const currentScale = interpolateKeyframeValue(clip.keyframes, clipTime, 'scale', clip.transform?.scaleX ?? clip.scaleX ?? 1);
      const currentRotation = interpolateKeyframeValue(clip.keyframes, clipTime, 'rotation', clip.transform?.rotation ?? clip.rotation ?? 0);
      let currentOpacity = interpolateKeyframeValue(clip.keyframes, clipTime, 'opacity', clip.transform?.opacity ?? clip.opacity ?? 1);

      // Transitions
      let transOffsetX = 0;
      let transOffsetY = 0;
      let transScale = 1;

      // In transition
      if (clip.transitionIn && clip.transitionIn.type !== 'none' && clip.transitionIn.type !== 'cut' && clipTime < clip.transitionIn.duration) {
        const p = clipTime / clip.transitionIn.duration;
        const st = computeTransitionState(p, clip.transitionIn.type, true);
        currentOpacity *= st.opacity;
        transOffsetX = st.offsetX * width;
        transOffsetY = st.offsetY * height;
        transScale *= st.scale;
      }

      // Out transition
      const timeToEnd = clip.duration - clipTime;
      if (clip.transitionOut && clip.transitionOut.type !== 'none' && clip.transitionOut.type !== 'cut' && timeToEnd < clip.transitionOut.duration) {
        const p = 1 - timeToEnd / clip.transitionOut.duration;
        const st = computeTransitionState(p, clip.transitionOut.type, false);
        currentOpacity *= st.opacity;
        transOffsetX = st.offsetX * width;
        transOffsetY = st.offsetY * height;
        transScale *= st.scale;
      }

      // Render by type
      if (clip.type === 'video') {
        const video = videoElements.get(clip.assetId || '') || videoElements.get(clip.id);
        const canDrawVideo = video && (video.readyState >= 1 || video.videoWidth > 0);
        let cachedCanvas = lastFrameCanvasCache.get(clip.id);

        if (canDrawVideo || cachedCanvas) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, currentOpacity));

          // Safe Filters
          ctx.filter = buildCanvasFilterString(clip.effects);

          // Positioning and Transforms
          ctx.translate(width / 2 + currentX + transOffsetX, height / 2 + currentY + transOffsetY);
          if (currentRotation !== 0) ctx.rotate((currentRotation * Math.PI) / 180);
          if (clip.flipH || clip.flipV) ctx.scale(clip.flipH ? -1 : 1, clip.flipV ? -1 : 1);

          const scale = currentScale * transScale;
          const vw = (video && video.videoWidth) ? video.videoWidth : (cachedCanvas ? cachedCanvas.width : width);
          const vh = (video && video.videoHeight) ? video.videoHeight : (cachedCanvas ? cachedCanvas.height : height);

          let dw = width * scale;
          let dh = height * scale;
          const fitMode = clip.fitMode || 'fit';

          if (fitMode === 'fit') {
            const videoRatio = vw / vh;
            const canvasRatio = width / height;
            if (videoRatio > canvasRatio) {
              dw = width * scale;
              dh = (width / videoRatio) * scale;
            } else {
              dh = height * scale;
              dw = (height * videoRatio) * scale;
            }
          } else if (fitMode === 'fill') {
            const videoRatio = vw / vh;
            const canvasRatio = width / height;
            if (videoRatio > canvasRatio) {
              dh = height * scale;
              dw = (height * videoRatio) * scale;
            } else {
              dw = width * scale;
              dh = (width / videoRatio) * scale;
            }
          }

          if (clip.cornerRadius && clip.cornerRadius > 0) {
            ctx.beginPath();
            ctx.roundRect(-dw / 2, -dh / 2, dw, dh, clip.cornerRadius);
            ctx.clip();
          }

          // If video element is ready, draw it and update cache
          if (canDrawVideo && video) {
            ctx.drawImage(video, -dw / 2, -dh / 2, dw, dh);

            // Update offscreen frame cache
            if (!cachedCanvas) {
              cachedCanvas = document.createElement('canvas');
              lastFrameCanvasCache.set(clip.id, cachedCanvas);
            }
            if (cachedCanvas.width !== video.videoWidth || cachedCanvas.height !== video.videoHeight) {
              cachedCanvas.width = video.videoWidth || 640;
              cachedCanvas.height = video.videoHeight || 360;
            }
            const cCtx = cachedCanvas.getContext('2d');
            if (cCtx && video.videoWidth > 0) {
              cCtx.drawImage(video, 0, 0);
            }
          } else if (cachedCanvas) {
            // Draw retained last frame to prevent black flash
            ctx.drawImage(cachedCanvas, -dw / 2, -dh / 2, dw, dh);
          }

          applyCanvasPostEffects(ctx, width, height, clip.effects);
          ctx.restore();
        }
      } else if (clip.type === 'image') {
        const img = imageElements.get(clip.assetId || '') || imageElements.get(clip.id);
        if (img && img.complete && img.naturalWidth > 0) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, currentOpacity));
          ctx.filter = buildCanvasFilterString(clip.effects);

          ctx.translate(width / 2 + currentX + transOffsetX, height / 2 + currentY + transOffsetY);
          if (currentRotation !== 0) ctx.rotate((currentRotation * Math.PI) / 180);
          if (clip.flipH || clip.flipV) ctx.scale(clip.flipH ? -1 : 1, clip.flipV ? -1 : 1);

          const scale = currentScale * transScale;
          const iw = img.naturalWidth || width;
          const ih = img.naturalHeight || height;
          let dw = width * scale;
          let dh = height * scale;

          const fitMode = clip.fitMode || 'fit';
          if (fitMode === 'fit') {
            const imgRatio = iw / ih;
            const canvasRatio = width / height;
            if (imgRatio > canvasRatio) {
              dw = width * scale;
              dh = (width / imgRatio) * scale;
            } else {
              dh = height * scale;
              dw = (height * imgRatio) * scale;
            }
          }

          ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
          applyCanvasPostEffects(ctx, width, height, clip.effects);
          ctx.restore();
        }
      } else if (clip.type === 'text' && clip.textData) {
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, currentOpacity));
        ctx.translate(width / 2 + currentX + transOffsetX, height / 2 + currentY + transOffsetY);
        if (currentRotation !== 0) ctx.rotate((currentRotation * Math.PI) / 180);
        ctx.scale(currentScale * transScale, currentScale * transScale);

        renderTextLayer(ctx, clip.textData, clipTime, clip.duration, width, height);
        ctx.restore();
      }
    }
  }

  // 4. Subtitles
  if (project.subtitles && project.subtitles.length > 0) {
    const activeSub = project.subtitles.find((s) => currentTime >= s.start && currentTime <= s.end);
    if (activeSub) {
      renderTextLayer(
        ctx,
        {
          text: activeSub.text,
          fontFamily: 'Plus Jakarta Sans, sans-serif',
          fontSize: Math.round(height * 0.045),
          fontWeight: 'bold',
          fontStyle: 'normal',
          underline: false,
          color: '#ffffff',
          fillColor: '#ffffff',
          strokeColor: '#000000',
          strokeWidth: 3,
          boxColor: 'rgba(0,0,0,0.6)',
          backgroundColor: 'rgba(0,0,0,0.6)',
          backgroundOpacity: 0.6,
          boxPadding: 12,
          padding: 12,
          boxRadius: 6,
          borderRadius: 6,
          alignment: 'center',
          textAlign: 'center',
          letterSpacing: 0,
          lineHeight: 1.2,
          shadow: { color: 'rgba(0,0,0,0.8)', blur: 4, offsetX: 0, offsetY: 2 },
          animation: { type: 'none', duration: 0 },
        },
        0,
        1,
        width,
        height
      );
    }
  }

  // 5. Selected Clip Transform Handles
  if (selectedClipId) {
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
        drawTransformHandles(ctx, width, height, selClip);
      }
    }
  }
}

/**
 * Draws selection bounding box and corner resize/rotate handles
 */
function drawTransformHandles(
  ctx: CanvasRenderingContext2D,
  canvasW: number,
  canvasH: number,
  clip: VideoClip
): void {
  ctx.save();
  const cx = canvasW / 2 + (clip.transform?.x ?? clip.x ?? 0);
  const cy = canvasH / 2 + (clip.transform?.y ?? clip.y ?? 0);

  ctx.translate(cx, cy);
  const rot = clip.transform?.rotation ?? clip.rotation ?? 0;
  if (rot !== 0) ctx.rotate((rot * Math.PI) / 180);

  const scaleX = clip.transform?.scaleX ?? clip.scaleX ?? 1;
  const scaleY = clip.transform?.scaleY ?? clip.scaleY ?? 1;
  const boxW = Math.max(100, (canvasW * 0.5) * scaleX);
  const boxH = Math.max(60, (canvasH * 0.5) * scaleY);

  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 2;
  ctx.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);

  // Corner handles
  const handleSize = 8;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#6366f1';
  ctx.lineWidth = 2;

  const corners = [
    [-boxW / 2, -boxH / 2],
    [boxW / 2, -boxH / 2],
    [-boxW / 2, boxH / 2],
    [boxW / 2, boxH / 2],
  ];

  for (const [hx, hy] of corners) {
    ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
    ctx.strokeRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
  }

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
    clips: project.clips || Object.fromEntries(
      project.tracks.flatMap((t) => t.clips).map((c) => [c.id, c])
    ),
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
          if (!url && clip.assetId) {
            const { getAssetBlob } = await import('../db');
            const blob = await getAssetBlob(clip.assetId);
            if (blob) url = URL.createObjectURL(blob);
          }

          if (url) {
            if (clip.type === 'video') {
              const v = document.createElement('video');
              v.crossOrigin = 'anonymous';
              v.muted = true;
              v.playsInline = true;
              v.preload = 'auto';
              v.src = url;
              elementCache.set(assetKey, v);
              elem = v;
            } else if (clip.type === 'image') {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.src = url;
              elementCache.set(assetKey, img);
              elem = img;
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
              // Only resync if drift exceeds 0.25s
              if (Math.abs(elem.currentTime - clipRelSec) > 0.25) {
                elem.currentTime = clipRelSec;
              }
            } else {
              if (!elem.paused) {
                elem.pause();
              }
              if (Math.abs(elem.currentTime - clipRelSec) > 0.04) {
                elem.currentTime = clipRelSec;
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
        // Clip is not active; if it was playing, pause it
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
  });
}

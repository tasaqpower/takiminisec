/**
 * FORMA Video Editor — Preview Renderer
 * High-performance composite scene renderer for the interactive preview canvas
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

/**
 * Linearly interpolates value between two keyframes
 */
function interpolateKeyframeValue(
  keyframes: Keyframe[],
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
    showSafeZones = false
  } = rc;

  const width = canvas.width;
  const height = canvas.height;

  // 1. Clear background
  ctx.save();
  ctx.fillStyle = project.canvas.backgroundColor || '#000000';
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  // 2. Sort tracks by order ascending (bottom to top)
  const sortedTracks = [...project.tracks].sort((a, b) => a.order - b.order);

  // 3. Render active clips per track
  for (const track of sortedTracks) {
    if (track.isHidden) continue;

    const trackClips = Object.values(project.clips).filter(
      (c) => c.trackId === track.id && currentTime >= c.start && currentTime < c.start + c.duration
    );

    for (const clip of trackClips) {
      const clipTime = (currentTime - clip.start) * clip.speed;

      // Evaluate keyframed transforms or static clip values
      const currentX = interpolateKeyframeValue(clip.keyframes, clipTime, 'x', clip.x);
      const currentY = interpolateKeyframeValue(clip.keyframes, clipTime, 'y', clip.y);
      const currentScale = interpolateKeyframeValue(clip.keyframes, clipTime, 'scale', clip.scaleX);
      const currentRotation = interpolateKeyframeValue(clip.keyframes, clipTime, 'rotation', clip.rotation);
      let currentOpacity = interpolateKeyframeValue(clip.keyframes, clipTime, 'opacity', clip.opacity);

      // Transitions
      let transOffsetX = 0;
      let transOffsetY = 0;
      let transScale = 1;

      // In transition
      if (clip.transitionIn && clip.transitionIn.type !== 'none' && clipTime < clip.transitionIn.duration) {
        const p = clipTime / clip.transitionIn.duration;
        const st = computeTransitionState(p, clip.transitionIn.type, true);
        currentOpacity *= st.opacity;
        transOffsetX = st.offsetX * width;
        transOffsetY = st.offsetY * height;
        transScale *= st.scale;
      }

      // Out transition
      const timeToEnd = clip.duration - clipTime;
      if (clip.transitionOut && clip.transitionOut.type !== 'none' && timeToEnd < clip.transitionOut.duration) {
        const p = 1 - timeToEnd / clip.transitionOut.duration;
        const st = computeTransitionState(p, clip.transitionOut.type, false);
        currentOpacity *= st.opacity;
        transOffsetX = st.offsetX * width;
        transOffsetY = st.offsetY * height;
        transScale *= st.scale;
      }

      // Render by type
      if (clip.type === 'video') {
        const video = videoElements.get(clip.assetId);
        if (video && video.readyState >= 2) {
          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, currentOpacity));

          // Filters
          ctx.filter = buildCanvasFilterString(clip.effects);

          // Positioning and Transforms
          ctx.translate(width / 2 + currentX + transOffsetX, height / 2 + currentY + transOffsetY);
          if (currentRotation !== 0) ctx.rotate((currentRotation * Math.PI) / 180);
          if (clip.flipH || clip.flipV) ctx.scale(clip.flipH ? -1 : 1, clip.flipV ? -1 : 1);

          const scale = currentScale * transScale;
          const vw = video.videoWidth || width;
          const vh = video.videoHeight || height;

          let dw = width * scale;
          let dh = height * scale;

          if (clip.fitMode === 'fit') {
            const videoRatio = vw / vh;
            const canvasRatio = width / height;
            if (videoRatio > canvasRatio) {
              dw = width * scale;
              dh = (width / videoRatio) * scale;
            } else {
              dh = height * scale;
              dw = (height * videoRatio) * scale;
            }
          } else if (clip.fitMode === 'fill') {
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

          if (clip.cornerRadius > 0) {
            ctx.beginPath();
            ctx.roundRect(-dw / 2, -dh / 2, dw, dh, clip.cornerRadius);
            ctx.clip();
          }

          ctx.drawImage(video, -dw / 2, -dh / 2, dw, dh);
          applyCanvasPostEffects(ctx, width, height, clip.effects);
          ctx.restore();
        }
      } else if (clip.type === 'image') {
        const img = imageElements.get(clip.assetId);
        if (img && img.complete) {
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

          const ratio = iw / ih;
          if (clip.fitMode === 'fit') {
            if (ratio > width / height) {
              dw = width * scale;
              dh = (width / ratio) * scale;
            } else {
              dh = height * scale;
              dw = (height * ratio) * scale;
            }
          }

          if (clip.cornerRadius > 0) {
            ctx.beginPath();
            ctx.roundRect(-dw / 2, -dh / 2, dw, dh, clip.cornerRadius);
            ctx.clip();
          }

          ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
          applyCanvasPostEffects(ctx, width, height, clip.effects);
          ctx.restore();
        }
      } else if (clip.type === 'text' && clip.textData) {
        renderTextLayer(ctx, {
          layer: clip.textData,
          timeInClip: clipTime,
          clipDuration: clip.duration,
          canvasWidth: width,
          canvasHeight: height,
          centerX: width / 2 + currentX + transOffsetX,
          centerY: height / 2 + currentY + transOffsetY,
          scale: currentScale * transScale,
          rotation: currentRotation,
          opacity: currentOpacity
        });
      }
    }
  }

  // 4. Render Active Subtitles
  if (project.subtitles && project.subtitles.length > 0) {
    const activeSub = project.subtitles.find(
      (s) => currentTime >= s.start && currentTime <= s.end
    );
    if (activeSub && activeSub.text) {
      ctx.save();
      const fontSize = Math.max(18, Math.round(height * 0.045));
      ctx.font = `600 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      const paddingX = 16;
      const paddingY = 8;
      const textMetrics = ctx.measureText(activeSub.text);
      const boxW = textMetrics.width + paddingX * 2;
      const boxH = fontSize * 1.4 + paddingY * 2;
      const subX = width / 2;
      const subY = height * 0.88;

      // Subtitle pill background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.beginPath();
      ctx.roundRect(subX - boxW / 2, subY - boxH / 2, boxW, boxH, 8);
      ctx.fill();

      // Text stroke + fill
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#000000';
      ctx.strokeText(activeSub.text, subX, subY);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(activeSub.text, subX, subY);
      ctx.restore();
    }
  }

  // 5. Safe Area Guides (Optional)
  if (showSafeZones) {
    ctx.save();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.setLineDash([6, 6]);

    // Action Safe (90%)
    ctx.strokeRect(width * 0.05, height * 0.05, width * 0.9, height * 0.9);

    // Title Safe (80%)
    ctx.strokeStyle = 'rgba(100, 200, 255, 0.4)';
    ctx.strokeRect(width * 0.1, height * 0.1, width * 0.8, height * 0.8);

    // Center crosshairs
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.beginPath();
    ctx.moveTo(width / 2, height / 2 - 15);
    ctx.lineTo(width / 2, height / 2 + 15);
    ctx.moveTo(width / 2 - 15, height / 2);
    ctx.lineTo(width / 2 + 15, height / 2);
    ctx.stroke();

    ctx.restore();
  }

  // 6. Selected Clip Transform Handles
  if (selectedClipId && project.clips[selectedClipId]) {
    const selClip = project.clips[selectedClipId];
    if (currentTime >= selClip.start && currentTime < selClip.start + selClip.duration) {
      drawTransformHandles(ctx, width, height, selClip);
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
  const cx = canvasW / 2 + clip.x;
  const cy = canvasH / 2 + clip.y;

  ctx.translate(cx, cy);
  if (clip.rotation) ctx.rotate((clip.rotation * Math.PI) / 180);

  const boxW = Math.max(100, (canvasW * 0.5) * clip.scaleX);
  const boxH = Math.max(60, (canvasH * 0.5) * clip.scaleY);

  ctx.strokeStyle = '#6552df';
  ctx.lineWidth = 2;
  ctx.strokeRect(-boxW / 2, -boxH / 2, boxW, boxH);

  // Corner handles
  const handleSize = 8;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = '#6552df';
  ctx.lineWidth = 2;

  const corners = [
    [-boxW / 2, -boxH / 2],
    [boxW / 2, -boxH / 2],
    [-boxW / 2, boxH / 2],
    [boxW / 2, boxH / 2]
  ];

  for (const [hx, hy] of corners) {
    ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
    ctx.strokeRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize);
  }

  // Top rotation pin
  const pinDist = 24;
  ctx.beginPath();
  ctx.moveTo(0, -boxH / 2);
  ctx.lineTo(0, -boxH / 2 - pinDist);
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, -boxH / 2 - pinDist, handleSize / 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.restore();
}

const elementCache = new Map<string, HTMLVideoElement | HTMLImageElement>();

export async function renderFrameToCanvas(
  canvas: HTMLCanvasElement,
  project: VideoProject,
  currentTime: number,
  selectedClipIdOrShowGizmo?: string | boolean | null
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
      project.tracks.flatMap((t) => t.clips).map((c) => [c.id, {
        ...c,
        start: c.startTime,
        x: c.transform?.x || c.x || 0,
        y: c.transform?.y || c.y || 0,
        scaleX: c.transform?.scaleX || c.scaleX || 1,
        scaleY: c.transform?.scaleY || c.scaleY || 1,
        rotation: c.transform?.rotation || c.rotation || 0,
        opacity: c.transform?.opacity ?? c.opacity ?? 1,
        flipH: c.flipH || false,
        flipV: c.flipV || false,
        fitMode: c.fitMode || 'fit',
        effects: c.effects || {
          brightness: 1,
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
        },
        keyframes: c.keyframes || [],
      }])
    ),
  };

  const videoElements = new Map<string, HTMLVideoElement>();
  const imageElements = new Map<string, HTMLImageElement>();

  for (const track of project.tracks) {
    if (track.muted) continue;
    for (const clip of track.clips) {
      if (currentTime >= clip.startTime && currentTime <= clip.startTime + clip.duration) {
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
            const clipRelSec = (currentTime - clip.startTime) * (clip.speed || 1.0) + clip.trimIn;
            if (Math.abs(elem.currentTime - clipRelSec) > 0.08) {
              elem.currentTime = clipRelSec;
            }
            videoElements.set(clip.assetId || clip.id, elem);
          } else if (elem instanceof HTMLImageElement) {
            imageElements.set(clip.assetId || clip.id, elem);
          }
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

/**
 * FORMA Video Editor — Thumbnail Generator
 * Generates and caches thumbnail strips for video clips in timeline
 */

export async function extractSingleFrameThumbnail(
  videoSource: string | File | Blob,
  timeInSeconds: number = 0.5,
  targetWidth: number = 160,
  targetHeight: number = 90
): Promise<string> {
  if (typeof window === 'undefined') return '';

  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    const url = typeof videoSource === 'string' ? videoSource : URL.createObjectURL(videoSource);
    video.src = url;

    const cleanup = () => {
      video.pause();
      video.removeAttribute('src');
      video.load();
      if (typeof videoSource !== 'string') {
        URL.revokeObjectURL(url);
      }
    };

    video.onloadedmetadata = () => {
      const seekTime = Math.min(Math.max(0, timeInSeconds), video.duration || 1);
      video.currentTime = seekTime;
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = targetWidth;
        canvas.height = targetHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
          cleanup();
          resolve(dataUrl);
        } else {
          cleanup();
          resolve('');
        }
      } catch (err) {
        cleanup();
        reject(err);
      }
    };

    video.onerror = (e) => {
      cleanup();
      reject(new Error('Failed to load video for thumbnail extraction'));
    };
  });
}

export async function generateThumbnailStrip(
  videoSource: string | File | Blob,
  duration: number,
  count: number = 6,
  thumbWidth: number = 100,
  thumbHeight: number = 60
): Promise<string[]> {
  if (typeof window === 'undefined' || duration <= 0) return [];

  const thumbs: string[] = [];
  const step = duration / (count + 1);

  for (let i = 1; i <= count; i++) {
    const time = i * step;
    try {
      const thumb = await extractSingleFrameThumbnail(videoSource, time, thumbWidth, thumbHeight);
      thumbs.push(thumb);
    } catch {
      // If individual thumb fails, skip or push empty
      thumbs.push('');
    }
  }

  return thumbs;
}

export const generateCoverThumbnail = extractSingleFrameThumbnail;

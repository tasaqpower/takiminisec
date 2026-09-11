export interface CameraResult {
  success: boolean;
  stream?: MediaStream;
  error?: string;
}

/**
 * Request camera access safely with error catching
 */
export async function startCamera(videoElement: HTMLVideoElement): Promise<CameraResult> {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    return {
      success: false,
      error: 'Bu tarayıcı veya ortam kamera erişimini desteklemiyor.',
    };
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'environment', // Prefer back camera on mobile
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    });

    videoElement.srcObject = stream;
    await videoElement.play().catch(() => {});

    return { success: true, stream };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('Permission') || message.includes('denied') || message.includes('NotAllowedError')) {
      return {
        success: false,
        error: 'Kamera erişim izni kullanıcı tarafından reddedildi.',
      };
    }
    if (message.includes('NotFoundError') || message.includes('DevicesNotFoundError')) {
      return {
        success: false,
        error: 'Cihaza bağlı kullanılabilir kamera bulunamadı.',
      };
    }
    return {
      success: false,
      error: `Kamera başlatılamadı: ${message}`,
    };
  }
}

/**
 * Completely stop all tracks on the active stream
 */
export function stopCamera(stream?: MediaStream | null, videoElement?: HTMLVideoElement | null): void {
  if (stream) {
    stream.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {}
    });
  }
  if (videoElement) {
    videoElement.srcObject = null;
  }
}

/**
 * Capture high-resolution still frame from active video element
 */
export function captureFrame(videoElement: HTMLVideoElement): string | null {
  if (!videoElement.videoWidth || !videoElement.videoHeight) return null;

  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.92);
}
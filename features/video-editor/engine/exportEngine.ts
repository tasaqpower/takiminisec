import { VideoProject, ExportOptions } from '../types';
import { renderFrameToCanvas } from './previewRenderer';
import { audioMixer } from './audioMixer';
import { getAssetBlob } from '../db';

export interface ExportProgress {
  percent: number;
  currentFrame: number;
  totalFrames: number;
  etaSeconds: number;
  statusText: string;
}

export type ExportProgressCallback = (progress: ExportProgress) => void;

class ExportEngine {
  private isCancelled = false;

  /**
   * Cancel the currently running export job
   */
  public cancel(): void {
    this.isCancelled = true;
  }

  /**
   * Main export dispatcher based on options
   */
  public async exportProject(
    project: VideoProject,
    options: ExportOptions,
    currentTime: number,
    onProgress: ExportProgressCallback
  ): Promise<Blob | null> {
    this.isCancelled = false;

    // 1. PNG Snapshot
    if (options.format === 'png') {
      return this.exportSnapshotPng(project, currentTime, options);
    }

    // 2. Audio Only (WAV / MP3)
    if (options.format === 'wav' || options.format === 'mp3') {
      return this.exportAudioOnly(project, options, onProgress);
    }

    // 3. Animated GIF
    if (options.format === 'gif') {
      return this.exportGif(project, options, onProgress);
    }

    // 4. Video (MP4 / WebM)
    return this.exportVideo(project, options, onProgress);
  }

  /**
   * Export single frame snapshot at high resolution
   */
  private async exportSnapshotPng(
    project: VideoProject,
    currentTime: number,
    options: ExportOptions
  ): Promise<Blob | null> {
    const canvas = document.createElement('canvas');
    canvas.width = options.resolution.width;
    canvas.height = options.resolution.height;

    // Ensure assets are loaded
    await this.preloadAssetsForExport(project);

    await renderFrameToCanvas(canvas, project, currentTime, false);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, 'image/png');
    });
  }

  /**
   * Export audio only (WAV or audio blob)
   */
  private async exportAudioOnly(
    project: VideoProject,
    options: ExportOptions,
    onProgress: ExportProgressCallback
  ): Promise<Blob | null> {
    onProgress({
      percent: 10,
      currentFrame: 0,
      totalFrames: 100,
      etaSeconds: 5,
      statusText: 'Ses kanalları ayrıştırılıyor ve miksleniyor...',
    });

    const duration = project.duration || 10;
    const mixedBuffer = await audioMixer.renderMixedAudio(project, duration);

    if (this.isCancelled) return null;

    if (!mixedBuffer) {
      // Create empty 1-second silent WAV
      const ctx = audioMixer.getAudioContext();
      const emptyBuffer = ctx.createBuffer(2, 44100, 44100);
      return audioMixer.audioBufferToWav(emptyBuffer);
    }

    onProgress({
      percent: 90,
      currentFrame: 90,
      totalFrames: 100,
      etaSeconds: 1,
      statusText: 'WAV formatında kodlanıyor...',
    });

    const wavBlob = audioMixer.audioBufferToWav(mixedBuffer);

    onProgress({
      percent: 100,
      currentFrame: 100,
      totalFrames: 100,
      etaSeconds: 0,
      statusText: 'Tamamlandı!',
    });

    return wavBlob;
  }

  /**
   * Preload media blobs into HTML elements for rendering
   */
  private async preloadAssetsForExport(project: VideoProject): Promise<Map<string, HTMLVideoElement | HTMLImageElement>> {
    const elements = new Map<string, HTMLVideoElement | HTMLImageElement>();

    for (const track of project.tracks) {
      for (const clip of track.clips) {
        if (clip.type === 'video' || clip.type === 'image') {
          let url = clip.sourceUrl;
          if (clip.assetId) {
            const blob = await getAssetBlob(clip.assetId);
            if (blob) {
              url = URL.createObjectURL(blob);
            }
          }

          if (url) {
            if (clip.type === 'video') {
              const video = document.createElement('video');
              video.crossOrigin = 'anonymous';
              video.muted = true;
              video.playsInline = true;
              video.preload = 'auto';
              video.src = url;
              await new Promise<void>((res) => {
                video.onloadeddata = () => res();
                video.onerror = () => res();
                setTimeout(res, 3000);
              });
              elements.set(clip.id, video);
            } else {
              const img = new Image();
              img.crossOrigin = 'anonymous';
              img.src = url;
              await new Promise<void>((res) => {
                img.onload = () => res();
                img.onerror = () => res();
                setTimeout(res, 2000);
              });
              elements.set(clip.id, img);
            }
          }
        }
      }
    }

    return elements;
  }

  /**
   * Export video as WebM or MP4 using real-time canvas stream capture & MediaRecorder
   */
  private async exportVideo(
    project: VideoProject,
    options: ExportOptions,
    onProgress: ExportProgressCallback
  ): Promise<Blob | null> {
    onProgress({
      percent: 2,
      currentFrame: 0,
      totalFrames: 100,
      etaSeconds: 0,
      statusText: 'Medya kaynakları hazırlanıyor...',
    });

    await this.preloadAssetsForExport(project);
    if (this.isCancelled) return null;

    const fps = options.fps || 30;
    const duration = Math.max(0.5, project.duration || 5);
    const totalFrames = Math.ceil(duration * fps);
    const frameIntervalMs = 1000 / fps;

    // Canvas setup
    const canvas = document.createElement('canvas');
    canvas.width = options.resolution.width;
    canvas.height = options.resolution.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D canvas context for export');

    // Audio setup
    const mixedAudio = await audioMixer.renderMixedAudio(project, duration);
    if (this.isCancelled) return null;

    let combinedStream: MediaStream;
    const canvasStream = canvas.captureStream(fps);

    if (mixedAudio) {
      const audioCtx = audioMixer.getAudioContext();
      const destNode = audioCtx.createMediaStreamDestination();
      const audioSource = audioCtx.createBufferSource();
      audioSource.buffer = mixedAudio;
      audioSource.connect(destNode);

      combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...destNode.stream.getAudioTracks(),
      ]);

      audioSource.start(0);
    } else {
      combinedStream = canvasStream;
    }

    // Determine MIME type
    const mimeCandidates = [
      options.format === 'mp4' ? 'video/mp4;codecs=avc1.42E01E,mp4a.40.2' : '',
      options.format === 'mp4' ? 'video/mp4' : '',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ].filter(Boolean);

    let selectedMime = 'video/webm';
    for (const mime of mimeCandidates) {
      if (MediaRecorder.isTypeSupported(mime)) {
        selectedMime = mime;
        break;
      }
    }

    const recordedChunks: Blob[] = [];
    const bitrate = options.bitrate || (options.quality === 'ultra' ? 16_000_000 : options.quality === 'high' ? 8_000_000 : 4_000_000);

    const recorder = new MediaRecorder(combinedStream, {
      mimeType: selectedMime,
      videoBitsPerSecond: bitrate,
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunks.push(e.data);
      }
    };

    recorder.start(100);

    const startTime = performance.now();

    // Render loop
    for (let frameIndex = 0; frameIndex < totalFrames; frameIndex++) {
      if (this.isCancelled) {
        recorder.stop();
        combinedStream.getTracks().forEach((t) => t.stop());
        return null;
      }

      const frameTime = frameIndex / fps;
      await renderFrameToCanvas(canvas, project, frameTime, false);

      const elapsed = (performance.now() - startTime) / 1000;
      const progressRatio = (frameIndex + 1) / totalFrames;
      const estimatedTotal = progressRatio > 0 ? elapsed / progressRatio : 0;
      const etaSeconds = Math.max(0, Math.round(estimatedTotal - elapsed));

      onProgress({
        percent: Math.min(99, Math.round(progressRatio * 100)),
        currentFrame: frameIndex + 1,
        totalFrames,
        etaSeconds,
        statusText: `Kare işleniyor (${frameIndex + 1}/${totalFrames})...`,
      });

      // Maintain pacing for captureStream
      await new Promise((resolve) => setTimeout(resolve, Math.max(1, frameIntervalMs * 0.7)));
    }

    onProgress({
      percent: 99,
      currentFrame: totalFrames,
      totalFrames,
      etaSeconds: 1,
      statusText: 'Video dosyası paketleniyor...',
    });

    return new Promise((resolve) => {
      recorder.onstop = () => {
        combinedStream.getTracks().forEach((t) => t.stop());
        const finalBlob = new Blob(recordedChunks, { type: selectedMime });
        onProgress({
          percent: 100,
          currentFrame: totalFrames,
          totalFrames,
          etaSeconds: 0,
          statusText: 'Tamamlandı!',
        });
        resolve(finalBlob);
      };

      recorder.stop();
    });
  }

  /**
   * Export animated GIF using a pure client-side GIF89a encoder
   */
  private async exportGif(
    project: VideoProject,
    options: ExportOptions,
    onProgress: ExportProgressCallback
  ): Promise<Blob | null> {
    onProgress({
      percent: 5,
      currentFrame: 0,
      totalFrames: 100,
      etaSeconds: 0,
      statusText: 'GIF kareleri hazırlanıyor...',
    });

    await this.preloadAssetsForExport(project);
    if (this.isCancelled) return null;

    // For GIF, cap resolution at max 640px width and 12 fps for fast encode & reasonable size
    const origW = options.resolution.width;
    const origH = options.resolution.height;
    const scale = Math.min(1, 480 / origW);
    const gifW = Math.round(origW * scale);
    const gifH = Math.round(origH * scale);
    const gifFps = 10;
    const duration = Math.min(15, project.duration || 5); // limit GIF to 15s max
    const totalFrames = Math.ceil(duration * gifFps);
    const delayHundredths = Math.round(100 / gifFps);

    const canvas = document.createElement('canvas');
    canvas.width = gifW;
    canvas.height = gifH;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    // Collect frame pixels
    const framePixelList: ImageData[] = [];
    for (let f = 0; f < totalFrames; f++) {
      if (this.isCancelled) return null;
      const t = f / gifFps;
      await renderFrameToCanvas(canvas, project, t, false);
      framePixelList.push(ctx.getImageData(0, 0, gifW, gifH));

      onProgress({
        percent: Math.round((f / totalFrames) * 50),
        currentFrame: f + 1,
        totalFrames,
        etaSeconds: Math.round(((totalFrames - f) * 0.1)),
        statusText: `Kare yakalanıyor (${f + 1}/${totalFrames})...`,
      });
    }

    onProgress({
      percent: 55,
      currentFrame: totalFrames,
      totalFrames,
      etaSeconds: 2,
      statusText: 'GIF sıkıştırması uygulanıyor...',
    });

    // Build standard GIF89a bytes
    const gifBlob = this.encodeGifBytes(gifW, gifH, framePixelList, delayHundredths);

    onProgress({
      percent: 100,
      currentFrame: totalFrames,
      totalFrames,
      etaSeconds: 0,
      statusText: 'Tamamlandı!',
    });

    return gifBlob;
  }

  /**
   * Pure JS Animated GIF89a Encoder (Global palette with 64-color quantization for fast performance)
   */
  private encodeGifBytes(width: number, height: number, frames: ImageData[], delay: number): Blob {
    const bytes: number[] = [];

    const writeString = (s: string) => {
      for (let i = 0; i < s.length; i++) bytes.push(s.charCodeAt(i));
    };
    const writeShort = (v: number) => {
      bytes.push(v & 0xff, (v >> 8) & 0xff);
    };

    // Header
    writeString('GIF89a');

    // Logical Screen Descriptor
    writeShort(width);
    writeShort(height);
    // GCT Flag = 1, Color Res = 7 (8 bits), Sort = 0, GCT Size = 5 (64 colors: 2^(5+1) = 64)
    bytes.push(0xb5); // 1 011 0 101 -> 64 colors palette
    bytes.push(0);    // Background Color Index
    bytes.push(0);    // Pixel Aspect Ratio

    // Generate 64-color palette (4 red x 4 green x 4 blue)
    for (let r = 0; r < 4; r++) {
      for (let g = 0; g < 4; g++) {
        for (let b = 0; b < 4; b++) {
          bytes.push(r * 85, g * 85, b * 85);
        }
      }
    }

    // Netscape Application Block for looping
    bytes.push(0x21, 0xff, 0x0b);
    writeString('NETSCAPE2.0');
    bytes.push(0x03, 0x01);
    writeShort(0); // Loop count 0 = infinite
    bytes.push(0x00);

    // Write each frame
    for (const frame of frames) {
      // Graphics Control Extension
      bytes.push(0x21, 0xf9, 0x04);
      bytes.push(0x04); // Disposal method 1 (do not dispose)
      writeShort(delay);
      bytes.push(0x00); // Transparent color index
      bytes.push(0x00); // Block terminator

      // Image Descriptor
      bytes.push(0x2c);
      writeShort(0); // Left
      writeShort(0); // Top
      writeShort(width);
      writeShort(height);
      bytes.push(0x00); // Local Color Table Flag = 0

      // Map pixels to palette indices
      const data = frame.data;
      const pixelIndices = new Uint8Array(width * height);
      for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        const r = Math.min(3, Math.floor(data[i] / 64));
        const g = Math.min(3, Math.floor(data[i + 1] / 64));
        const b = Math.min(3, Math.floor(data[i + 2] / 64));
        pixelIndices[p] = (r * 16) + (g * 4) + b;
      }

      // LZW compression
      bytes.push(6); // Minimum LZW code size for 64 colors
      const lzwData = this.lzwEncode(6, pixelIndices);
      let offset = 0;
      while (offset < lzwData.length) {
        const chunkLen = Math.min(255, lzwData.length - offset);
        bytes.push(chunkLen);
        for (let k = 0; k < chunkLen; k++) {
          bytes.push(lzwData[offset + k]);
        }
        offset += chunkLen;
      }
      bytes.push(0x00); // Block terminator
    }

    // Trailer
    bytes.push(0x3b);

    return new Blob([new Uint8Array(bytes)], { type: 'image/gif' });
  }

  /**
   * Fast LZW sub-encoder for GIF image data
   */
  private lzwEncode(minCodeSize: number, pixelData: Uint8Array): Uint8Array {
    const clearCode = 1 << minCodeSize;
    const eoiCode = clearCode + 1;
    let codeSize = minCodeSize + 1;
    let nextCode = eoiCode + 1;

    const dict = new Map<string, number>();
    const resetDict = () => {
      dict.clear();
      for (let i = 0; i < clearCode; i++) {
        dict.set(String(i), i);
      }
      codeSize = minCodeSize + 1;
      nextCode = eoiCode + 1;
    };

    resetDict();

    const outputBits: number[] = [];
    const writeBits = (code: number, size: number) => {
      for (let b = 0; b < size; b++) {
        outputBits.push((code >> b) & 1);
      }
    };

    writeBits(clearCode, codeSize);

    let prefix = '';
    for (let i = 0; i < pixelData.length; i++) {
      const char = String(pixelData[i]);
      const current = prefix === '' ? char : `${prefix},${char}`;

      if (dict.has(current)) {
        prefix = current;
      } else {
        writeBits(dict.get(prefix)!, codeSize);

        if (nextCode < 4096) {
          dict.set(current, nextCode++);
          if (nextCode === (1 << codeSize) && codeSize < 12) {
            codeSize++;
          }
        } else {
          writeBits(clearCode, codeSize);
          resetDict();
        }

        prefix = char;
      }
    }

    if (prefix !== '') {
      writeBits(dict.get(prefix)!, codeSize);
    }
    writeBits(eoiCode, codeSize);

    // Pack bits into bytes
    const packedBytes = new Uint8Array(Math.ceil(outputBits.length / 8));
    for (let i = 0; i < outputBits.length; i++) {
      if (outputBits[i]) {
        packedBytes[i >> 3] |= 1 << (i & 7);
      }
    }

    return packedBytes;
  }

  /**
   * Helper to trigger automatic file download in the browser
   */
  public downloadBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
}

export const exportEngine = new ExportEngine();

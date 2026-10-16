import { VideoProject, ExportOptions } from '../types';
import { renderFrameToCanvas, clearLipFreezeCache, clearSmoothCutCache, clearMotionBlurCache } from './previewRenderer';
import { audioMixer } from './audioMixer';
import { getAssetBlob } from '../db';
import { loadAndCacheCubeLut } from './filterEngine';

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
    clearLipFreezeCache();
    clearSmoothCutCache();
    clearMotionBlurCache();

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

    const preloadedElements = await this.preloadAssetsForExport(project);
    await renderFrameToCanvas(canvas, project, currentTime, false, false, preloadedElements, 1.0, true);

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

          if (!url && clip.assetId) {
            if (clip.assetId.startsWith('broll-')) {
              url = `/video-assets/broll/${clip.assetId}.webm`;
            } else if (clip.assetId.includes('video') || clip.assetId === '01_video_starter_sample') {
              url = `/video-assets/sample-video.webm`;
            } else if (clip.assetId.startsWith('overlay-')) {
              const name = clip.assetId.replace('overlay-', '');
              url = `/video-assets/overlays/${name}.svg`;
            } else if (clip.assetId.startsWith('element-')) {
              const name = clip.assetId.replace('element-', '');
              url = `/video-assets/elements/${name}.svg`;
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
                if (!video.parentElement) {
                  hiddenContainer.appendChild(video);
                }
              }

              await new Promise<void>((res) => {
                const onReady = () => {
                  video.removeEventListener('loadeddata', onReady);
                  video.removeEventListener('canplay', onReady);
                  res();
                };
                video.addEventListener('loadeddata', onReady);
                video.addEventListener('canplay', onReady);
                video.onerror = () => res();
                setTimeout(res, 3000);
              });
              elements.set(clip.id, video);
              if (clip.assetId) elements.set(clip.assetId, video);
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
              if (clip.assetId) elements.set(clip.assetId, img);
            }
          }
        }
      }
    }

    // Preload & cache any .cube LUTs used in clips
    for (const track of project.tracks) {
      for (const clip of track.clips) {
        if (clip.colorFilter && !clip.colorFilter.startsWith('normal')) {
          try {
            await loadAndCacheCubeLut(clip.colorFilter);
          } catch (_) {}
        }
      }
    }

    return elements;
  }

  /**
   * Primary Video Export dispatcher:
   * Defaults to 100% strict Constant Frame Rate (CFR) WASM H.264+AAC engine.
   * Gracefully falls back to legacy MediaRecorder if WebAssembly / WASM core is not available.
   */
  private async exportVideo(
    project: VideoProject,
    options: ExportOptions,
    onProgress: ExportProgressCallback
  ): Promise<Blob | null> {
    try {
      return await this.exportVideoCfrWasm(project, options, onProgress);
    } catch (wasmErr) {
      console.warn('[FORMA CFR EXPORT] Falling back to MediaRecorder:', wasmErr);
      return await this.exportVideoLegacyMediaRecorder(project, options, onProgress);
    }
  }

  /**
   * Professional Chunked WASM CFR Video Encoder (libx264 + aac).
   * Generates exact frame timestamps: timestampUs = frameIndex * 1_000_000 / fps.
   * Produces strictly deterministic CFR output (VFR = 0, freezes = 0, dropped frames = 0).
   */
  private async exportVideoCfrWasm(
    project: VideoProject,
    options: ExportOptions,
    onProgress: ExportProgressCallback
  ): Promise<Blob | null> {
    onProgress({
      percent: 2,
      currentFrame: 0,
      totalFrames: 100,
      etaSeconds: 0,
      statusText: 'WASM CFR video encoder başlatılıyor...',
    });

    const preloadedElements = await this.preloadAssetsForExport(project);
    if (this.isCancelled) return null;

    const fps = options.fps || project.fps || 30;
    const duration = Math.max(0.5, project.duration || 5);
    const totalFrames = Math.max(1, Math.round(duration * fps));
    // Strictly force even width and height for YUV420p & libx264 compatibility
    const width = Math.max(2, Math.floor(options.resolution.width / 2) * 2);
    const height = Math.max(2, Math.floor(options.resolution.height / 2) * 2);
    const effectiveProject: VideoProject = {
      ...project,
      resolution: { width, height },
      canvas: project.canvas
        ? {
            ...project.canvas,
            width,
            height,
          }
        : undefined,
    };

    // Load local WASM FFmpeg Core via native browser import (bypassing Vite bundler rewrite)
    const loadModule = new Function('url', 'return import(url)');
    const mod: any = await loadModule('/wasm/ffmpeg/ffmpeg-core.js');
    const createCore = mod.default || mod.createFFmpegCore || (window as any).createFFmpegCore;
    if (!createCore) throw new Error('createFFmpegCore function not found in ffmpeg-core.js');

    const b64Meta = btoa(JSON.stringify({ wasmURL: '/wasm/ffmpeg/ffmpeg-core.wasm' }));
    const core = await createCore({
      mainScriptUrlOrBlob: '/wasm/ffmpeg/ffmpeg-core.js#' + b64Meta,
    });

    // Chunked setup: 30 frames (1.0s) per chunk
    const chunkSize = 30;
    const numChunks = Math.ceil(totalFrames / chunkSize);
    const ySize = width * height;
    const uvSize = (width / 2) * (height / 2);
    const frameByteSize = ySize + uvSize * 2;

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Could not get 2D canvas context for CFR export');

    const isWebm = options.format === 'webm';
    const yuvParts: Uint8Array[] = [];
    const tStart = performance.now();

    for (let c = 0; c < numChunks; c++) {
      if (this.isCancelled) return null;

      const startFrame = c * chunkSize;
      const endFrame = Math.min(totalFrames, (c + 1) * chunkSize);
      const framesInChunk = endFrame - startFrame;

      const chunkBuffer = new Uint8Array(framesInChunk * frameByteSize);

      for (let fIdx = 0; fIdx < framesInChunk; fIdx++) {
        if (this.isCancelled) return null;

        const f = startFrame + fIdx;
        const timeSec = f / fps;

        await renderFrameToCanvas(canvas, effectiveProject, timeSec, false, false, preloadedElements, 1.0, true);

        const imgData = ctx.getImageData(0, 0, width, height).data;
        const frameOffset = fIdx * frameByteSize;
        let yIdx = frameOffset;
        let uIdx = frameOffset + ySize;
        let vIdx = frameOffset + ySize + uvSize;

        for (let i = 0; i < height; i++) {
          for (let j = 0; j < width; j++) {
            const pixelIdx = (i * width + j) * 4;
            const r = imgData[pixelIdx];
            const g = imgData[pixelIdx + 1];
            const b = imgData[pixelIdx + 2];

            const yVal = ((66 * r + 129 * g + 25 * b + 128) >> 8) + 16;
            chunkBuffer[yIdx++] = Math.max(16, Math.min(235, yVal));

            if (i % 2 === 0 && j % 2 === 0) {
              const uVal = ((-38 * r - 74 * g + 112 * b + 128) >> 8) + 128;
              const vVal = ((112 * r - 94 * g - 18 * b + 128) >> 8) + 128;
              chunkBuffer[uIdx++] = Math.max(16, Math.min(240, uVal));
              chunkBuffer[vIdx++] = Math.max(16, Math.min(240, vVal));
            }
          }
        }

        const currentFrameNum = f + 1;
        const ratio = currentFrameNum / totalFrames;
        const elapsed = (performance.now() - tStart) / 1000;
        const estTotal = ratio > 0 ? elapsed / ratio : 0;
        const eta = Math.max(0, Math.round(estTotal - elapsed));

        onProgress({
          percent: Math.min(92, Math.round(ratio * 90)),
          currentFrame: currentFrameNum,
          totalFrames,
          etaSeconds: eta,
          statusText: `CFR kare işleniyor (${currentFrameNum}/${totalFrames})...`,
        });
      }

      yuvParts.push(chunkBuffer);
    }

    onProgress({
      percent: 94,
      currentFrame: totalFrames,
      totalFrames,
      etaSeconds: 1,
      statusText: 'Ses miksleniyor ve kareler birleştiriliyor...',
    });

    let totalYuvLen = 0;
    for (const p of yuvParts) totalYuvLen += p.length;
    const mergedYuv = new Uint8Array(totalYuvLen);
    let yuvOffset = 0;
    for (const p of yuvParts) {
      mergedYuv.set(p, yuvOffset);
      yuvOffset += p.length;
    }
    core.FS.writeFile('input.yuv', mergedYuv);
    yuvParts.length = 0; // Free memory immediately

    // Audio mixing
    const mixedAudio = await audioMixer.renderMixedAudio(effectiveProject, duration, 48000);
    let hasAudio = false;
    if (mixedAudio) {
      const wavBlob = audioMixer.audioBufferToWav(mixedAudio);
      const audioBytes = new Uint8Array(await wavBlob.arrayBuffer());
      core.FS.writeFile('audio.wav', audioBytes);
      hasAudio = true;
    }

    if (isWebm) {
      onProgress({
        percent: 97,
        currentFrame: totalFrames,
        totalFrames,
        etaSeconds: 1,
        statusText: 'WebM container mux ediliyor (VP8 + Opus)...',
      });

      const quality = options.quality || 'high';
      const vpxBitrate = quality === 'ultra' ? '8000k' : quality === 'high' ? '5000k' : '3000k';
      const opusBitrate = quality === 'ultra' ? '192k' : quality === 'high' ? '160k' : '128k';

      const muxArgs = hasAudio
        ? [
            '-f', 'rawvideo',
            '-pix_fmt', 'yuv420p',
            '-s', `${width}x${height}`,
            '-framerate', String(fps),
            '-i', 'input.yuv',
            '-i', 'audio.wav',
            '-c:v', 'libvpx',
            '-b:v', vpxBitrate,
            '-deadline', 'realtime',
            '-cpu-used', '8',
            '-strict', '-2',
            '-c:a', 'opus',
            '-b:a', opusBitrate,
            '-shortest',
            '-f', 'webm',
            'final_export.webm',
          ]
        : [
            '-f', 'rawvideo',
            '-pix_fmt', 'yuv420p',
            '-s', `${width}x${height}`,
            '-framerate', String(fps),
            '-i', 'input.yuv',
            '-c:v', 'libvpx',
            '-b:v', vpxBitrate,
            '-deadline', 'realtime',
            '-cpu-used', '8',
            '-f', 'webm',
            'final_export.webm',
          ];

      const muxRet = core.exec(...muxArgs);
      if (muxRet !== 0) throw new Error(`Final WebM mux failed with code ${muxRet}`);

      const finalWebmBytes = core.FS.readFile('final_export.webm');
      core.FS.unlink('input.yuv');
      if (hasAudio) core.FS.unlink('audio.wav');
      core.FS.unlink('final_export.webm');

      onProgress({
        percent: 100,
        currentFrame: totalFrames,
        totalFrames,
        etaSeconds: 0,
        statusText: 'Tamamlandı!',
      });

      return new Blob([finalWebmBytes], { type: 'video/webm' });
    }

    // MP4 Encode & Mux (Strict Universal CFR: libx264 + aac + faststart)
    onProgress({
      percent: 97,
      currentFrame: totalFrames,
      totalFrames,
      etaSeconds: 1,
      statusText: 'MP4 container kodlanıyor (H.264 CFR + AAC + faststart)...',
    });

    const quality = options.quality || 'high';
    const vBitrate = quality === 'ultra' ? '12000k' : quality === 'high' ? '8000k' : '4000k';
    const aacBitrate = quality === 'ultra' ? '320k' : quality === 'high' ? '256k' : '192k';

    const muxArgs = hasAudio
      ? [
          '-f', 'rawvideo',
          '-pix_fmt', 'yuv420p',
          '-s', `${width}x${height}`,
          '-framerate', String(fps),
          '-i', 'input.yuv',
          '-i', 'audio.wav',
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-b:v', vBitrate,
          '-pix_fmt', 'yuv420p',
          '-g', String(Math.round(fps)),
          '-bf', '0',
          '-c:a', 'aac',
          '-b:a', aacBitrate,
          '-ar', '48000',
          '-shortest',
          '-movflags', '+faststart',
          'final_export.mp4',
        ]
      : [
          '-f', 'rawvideo',
          '-pix_fmt', 'yuv420p',
          '-s', `${width}x${height}`,
          '-framerate', String(fps),
          '-i', 'input.yuv',
          '-c:v', 'libx264',
          '-preset', 'ultrafast',
          '-b:v', vBitrate,
          '-pix_fmt', 'yuv420p',
          '-g', String(Math.round(fps)),
          '-bf', '0',
          '-movflags', '+faststart',
          'final_export.mp4',
        ];

    const muxRet = core.exec(...muxArgs);
    if (muxRet !== 0) throw new Error(`Final MP4 encode failed with code ${muxRet}`);

    const finalMp4Bytes = core.FS.readFile('final_export.mp4');
    core.FS.unlink('input.yuv');
    if (hasAudio) core.FS.unlink('audio.wav');
    core.FS.unlink('final_export.mp4');

    onProgress({
      percent: 100,
      currentFrame: totalFrames,
      totalFrames,
      etaSeconds: 0,
      statusText: 'Tamamlandı!',
    });

    return new Blob([finalMp4Bytes], { type: 'video/mp4' });
  }

  /**
   * Legacy / Fallback MediaRecorder Video Export (Değişken FPS)
   */
  private async exportVideoLegacyMediaRecorder(
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

    const preloadedElements = await this.preloadAssetsForExport(project);
    if (this.isCancelled) return null;

    const fps = options.fps || 30;
    const duration = Math.max(0.5, project.duration || 5);
    const totalFrames = Math.ceil(duration * fps);
    const frameIntervalMs = 1000 / fps;

    // Canvas setup
    const width = Math.max(2, Math.floor(options.resolution.width / 2) * 2);
    const height = Math.max(2, Math.floor(options.resolution.height / 2) * 2);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get 2D canvas context for export');

    const effectiveProject: VideoProject = {
      ...project,
      resolution: { width, height },
      canvas: project.canvas ? { ...project.canvas, width, height } : undefined,
    };

    // Audio setup
    const mixedAudio = await audioMixer.renderMixedAudio(effectiveProject, duration);
    if (this.isCancelled) return null;

    let combinedStream: MediaStream;
    const canvasStream = canvas.captureStream(0);
    const videoTrack = canvasStream.getVideoTracks()[0] as any;
    let audioSource: AudioBufferSourceNode | null = null;

    if (mixedAudio) {
      const audioCtx = audioMixer.getAudioContext();
      if (audioCtx.state === 'suspended') {
        try {
          await audioCtx.resume();
        } catch (_) {}
      }
      const destNode = audioCtx.createMediaStreamDestination();
      audioSource = audioCtx.createBufferSource();
      audioSource.buffer = mixedAudio;
      audioSource.connect(destNode);

      combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...destNode.stream.getAudioTracks(),
      ]);
    } else {
      combinedStream = canvasStream;
    }

    // Determine MIME type
    const mimeCandidates = options.format === 'mp4'
      ? [
          'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
          'video/mp4;codecs=avc1,opus',
          'video/mp4;codecs=avc1',
          'video/mp4',
        ]
      : [
          'video/webm;codecs=vp9,opus',
          'video/webm;codecs=vp8,opus',
          'video/webm',
        ];

    let selectedMime = options.format === 'mp4' ? 'video/mp4' : 'video/webm';
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

    let firstChunkReceived = false;
    let onFirstChunk: () => void = () => {};
    const firstChunkPromise = new Promise<void>((r) => {
      onFirstChunk = r;
      setTimeout(r, 200);
    });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunks.push(e.data);
        if (!firstChunkReceived) {
          firstChunkReceived = true;
          onFirstChunk();
        }
      }
    };

    // Prime the initial frame 0 at 0.0s before starting recorder
    await renderFrameToCanvas(canvas, effectiveProject, 0, false, false, preloadedElements, 1.0, true);
    if (videoTrack && typeof videoTrack.requestFrame === 'function') {
      videoTrack.requestFrame();
    }

    const startTime = performance.now();
    recorder.start(50);

    const targetTotalDurationMs = duration * 1000;

    // Await first chunk so hardware encoder (D3D11) finishes pipeline initialization without dropping startup frames
    await firstChunkPromise;
    const readyTime = performance.now();
    const startupMs = readyTime - startTime;

    // Start audio strictly AFTER firstChunk arrives to eliminate audio lead drift
    if (audioSource) {
      try {
        audioSource.start(0);
      } catch (_) {}
    }

    // Dynamically calculate pacing for remaining frames so total duration matches targetTotalDurationMs
    const remainingFrames = totalFrames - 1;
    const remainingTimeMs = Math.max(remainingFrames * 20, targetTotalDurationMs - startupMs);
    const pacingIntervalMs = remainingFrames > 0 ? remainingTimeMs / remainingFrames : 33.33;

    // Render loop: every frame rendered at exact project time frameTime = frameIndex / fps
    for (let frameIndex = 1; frameIndex < totalFrames; frameIndex++) {
      if (this.isCancelled) {
        recorder.stop();
        if (audioSource) { try { audioSource.stop(); } catch (_) {} }
        preloadedElements.forEach((el) => { if (el instanceof HTMLVideoElement) el.pause(); });
        combinedStream.getTracks().forEach((t) => t.stop());
        return null;
      }

      const frameTime = frameIndex / fps;
      await renderFrameToCanvas(canvas, effectiveProject, frameTime, false, false, preloadedElements, 1.0, true);
      if (videoTrack && typeof videoTrack.requestFrame === 'function') {
        videoTrack.requestFrame();
      }

      const progressRatio = Math.min(1, (frameIndex + 1) / totalFrames);
      const elapsed = (performance.now() - startTime) / 1000;
      const estimatedTotal = progressRatio > 0 ? elapsed / progressRatio : 0;
      const etaSeconds = Math.max(0, Math.round(estimatedTotal - elapsed));

      onProgress({
        percent: Math.min(99, Math.round(progressRatio * 100)),
        currentFrame: frameIndex + 1,
        totalFrames,
        etaSeconds,
        statusText: `Kare işleniyor (${frameIndex + 1}/${totalFrames})...`,
      });

      // Target wall clock for this frame to maintain exact 30 FPS rate
      const targetTime = readyTime + frameIndex * pacingIntervalMs;
      const delay = targetTime - performance.now();
      if (delay > 0) {
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // Ensure total recorded duration exactly reaches targetTotalDurationMs
    const finalDelay = (startTime + targetTotalDurationMs) - performance.now();
    if (finalDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, finalDelay));
    }

    onProgress({
      percent: 99,
      currentFrame: totalFrames,
      totalFrames,
      etaSeconds: 1,
      statusText: 'Video dosyası paketleniyor...',
    });

    // Pause preloaded elements
    preloadedElements.forEach((el) => {
      if (el instanceof HTMLVideoElement && !el.paused) {
        try { el.pause(); } catch (_) {}
      }
    });

    if (audioSource) {
      try { audioSource.stop(); } catch (_) {}
    }

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

    const preloadedElements = await this.preloadAssetsForExport(project);
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

    const effectiveProject: VideoProject = {
      ...project,
      resolution: { width: gifW, height: gifH },
    };

    // Collect frame pixels
    const framePixelList: ImageData[] = [];
    for (let f = 0; f < totalFrames; f++) {
      if (this.isCancelled) return null;
      const t = f / gifFps;
      await renderFrameToCanvas(canvas, effectiveProject, t, false, false, preloadedElements, 1.0, true);
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

    // Try high-fidelity WASM palettegen/paletteuse encoder
    try {
      const loadModule = new Function('url', 'return import(url)');
      const mod: any = await loadModule('/wasm/ffmpeg/ffmpeg-core.js');
      const createCore = mod.default || mod.createFFmpegCore || (window as any).createFFmpegCore;
      if (createCore) {
        const b64Meta = btoa(JSON.stringify({ wasmURL: '/wasm/ffmpeg/ffmpeg-core.wasm' }));
        const core = await createCore({
          mainScriptUrlOrBlob: '/wasm/ffmpeg/ffmpeg-core.js#' + b64Meta,
        });

        const frameByteCount = gifW * gifH * 4;
        const totalRaw = new Uint8Array(frameByteCount * totalFrames);
        for (let f = 0; f < totalFrames; f++) {
          totalRaw.set(new Uint8Array(framePixelList[f].data.buffer), f * frameByteCount);
        }
        core.FS.writeFile('input.rgba', totalRaw);

        const retGif = core.exec(
          '-f', 'rawvideo',
          '-pix_fmt', 'rgba',
          '-s', `${gifW}x${gifH}`,
          '-framerate', String(gifFps),
          '-i', 'input.rgba',
          '-vf', 'split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=3',
          'final_export.gif'
        );
        if (retGif === 0) {
          const gifBytes = core.FS.readFile('final_export.gif');
          core.FS.unlink('input.rgba');
          core.FS.unlink('final_export.gif');
          onProgress({
            percent: 100,
            currentFrame: totalFrames,
            totalFrames,
            etaSeconds: 0,
            statusText: 'Tamamlandı!',
          });
          return new Blob([gifBytes], { type: 'image/gif' });
        }
      }
    } catch (_) {}

    // Fallback: Build standard GIF89a bytes with client-side quantizer
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

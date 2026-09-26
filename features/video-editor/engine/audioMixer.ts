import { VideoProject, TimelineTrack, VideoClip } from '../types';
import { getAssetBlob } from '../db';

/**
 * AudioMixer handles:
 * 1. Decoding audio from clips/assets into AudioBuffers with local memory caching.
 * 2. Real-time preview playback synchronized with timeline playhead.
 * 3. Master and per-clip volume gains with fade-in and fade-out automation.
 * 4. Offline audio mixing for export rendering (returns mixed AudioBuffer).
 * 5. WAV file encoder for audio exports.
 * 6. Voiceover microphone recording.
 */

class AudioMixer {
  private audioCtx: AudioContext | null = null;
  private bufferCache: Map<string, AudioBuffer> = new Map();
  private activeSources: Map<string, { source: AudioBufferSourceNode; gainNode: GainNode }> = new Map();
  private isMixing = false;
  private masterGain: GainNode | null = null;

  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];

  constructor() {
    // AudioContext will be initialized on first user interaction to comply with browser autoplay policy
  }

  public getAudioContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.connect(this.audioCtx.destination);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
    return this.audioCtx;
  }

  /**
   * Load and decode an audio buffer from a clip or asset blob
   */
  public async getAudioBuffer(clip: VideoClip): Promise<AudioBuffer | null> {
    const cacheKey = clip.assetId || clip.id;
    if (this.bufferCache.has(cacheKey)) {
      return this.bufferCache.get(cacheKey)!;
    }

    try {
      let blob: Blob | null = null;
      if (clip.assetId) {
        blob = await getAssetBlob(clip.assetId);
      }
      if (!blob && clip.sourceUrl) {
        const resp = await fetch(clip.sourceUrl);
        blob = await resp.blob();
      }

      if (!blob) return null;

      const arrayBuffer = await blob.arrayBuffer();
      const ctx = this.getAudioContext();
      const decoded = await ctx.decodeAudioData(arrayBuffer);
      this.bufferCache.set(cacheKey, decoded);
      return decoded;
    } catch (err) {
      console.warn('Audio decoding failed for clip:', clip.id, err);
      return null;
    }
  }

  /**
   * Preload audio for all audio/video clips in the project
   */
  public async preloadProjectAudio(project: VideoProject): Promise<void> {
    const audioClips: VideoClip[] = [];
    for (const track of project.tracks) {
      if (track.type === 'audio' || track.type === 'video') {
        for (const clip of track.clips) {
          if (!clip.muted && (clip.type === 'audio' || clip.type === 'video')) {
            audioClips.push(clip);
          }
        }
      }
    }
    await Promise.all(audioClips.map((c) => this.getAudioBuffer(c)));
  }

  /**
   * Synchronize audio preview playback at given timeline position
   */
  public async syncPlayback(project: VideoProject, currentTime: number, isPlaying: boolean): Promise<void> {
    if (!isPlaying) {
      this.stopAll();
      return;
    }

    const ctx = this.getAudioContext();
    const tracksById = new Map(project.tracks.map((t) => [t.id, t]));
    const activeClipIds = new Set<string>();

    for (const track of project.tracks) {
      if (track.muted || (track.type !== 'audio' && track.type !== 'video')) continue;

      for (const clip of track.clips) {
        if (clip.muted) continue;

        const clipStart = clip.startTime;
        const clipEnd = clip.startTime + clip.duration;

        if (currentTime >= clipStart && currentTime < clipEnd) {
          activeClipIds.add(clip.id);

          // If not already playing, start it
          if (!this.activeSources.has(clip.id)) {
            const buffer = await this.getAudioBuffer(clip);
            if (!buffer) continue;

            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.playbackRate.value = clip.speed || 1.0;

            const gainNode = ctx.createGain();
            const clipRelTime = (currentTime - clipStart) * (clip.speed || 1.0) + clip.trimIn;
            const remainingClipDuration = (clipEnd - currentTime);

            // Compute volume curve
            this.applyVolumeEnvelope(gainNode, clip, currentTime - clipStart, ctx.currentTime);

            source.connect(gainNode);
            if (this.masterGain) {
              gainNode.connect(this.masterGain);
            } else {
              gainNode.connect(ctx.destination);
            }

            try {
              source.start(0, clipRelTime, remainingClipDuration);
              this.activeSources.set(clip.id, { source, gainNode });

              source.onended = () => {
                this.activeSources.delete(clip.id);
              };
            } catch (err) {
              console.warn('Failed to start audio source for clip:', clip.id, err);
            }
          }
        }
      }
    }

    // Stop clips that are no longer active
    for (const [id, { source }] of this.activeSources.entries()) {
      if (!activeClipIds.has(id)) {
        try {
          source.stop();
        } catch (_) {}
        this.activeSources.delete(id);
      }
    }
  }

  /**
   * Apply clip volume, fade-in, and fade-out to a gain node
   */
  private applyVolumeEnvelope(
    gainNode: GainNode,
    clip: VideoClip,
    clipElapsedSec: number,
    audioCtxTime: number
  ): void {
    const baseVolume = clip.volume ?? 1.0;
    const fadeIn = clip.fadeIn ?? 0;
    const fadeOut = clip.fadeOut ?? 0;
    const duration = clip.duration;

    const gain = gainNode.gain;
    gain.cancelScheduledValues(audioCtxTime);

    if (fadeIn <= 0 && fadeOut <= 0) {
      gain.setValueAtTime(baseVolume, audioCtxTime);
      return;
    }

    // Current volume calculation based on position
    let initialVol = baseVolume;
    if (fadeIn > 0 && clipElapsedSec < fadeIn) {
      initialVol = baseVolume * (clipElapsedSec / fadeIn);
    } else if (fadeOut > 0 && clipElapsedSec > duration - fadeOut) {
      const remaining = duration - clipElapsedSec;
      initialVol = baseVolume * Math.max(0, remaining / fadeOut);
    }

    gain.setValueAtTime(initialVol, audioCtxTime);

    // Schedule remaining fade in
    if (fadeIn > 0 && clipElapsedSec < fadeIn) {
      const remainingFadeIn = fadeIn - clipElapsedSec;
      gain.linearRampToValueAtTime(baseVolume, audioCtxTime + remainingFadeIn);
    }

    // Schedule fade out
    if (fadeOut > 0) {
      const fadeOutStartTime = audioCtxTime + Math.max(0, duration - fadeOut - clipElapsedSec);
      const fadeOutEndTime = audioCtxTime + (duration - clipElapsedSec);
      if (fadeOutStartTime > audioCtxTime) {
        gain.setValueAtTime(baseVolume, fadeOutStartTime);
      }
      gain.linearRampToValueAtTime(0, Math.max(audioCtxTime, fadeOutEndTime));
    }
  }

  /**
   * Stop all currently playing preview audio
   */
  public stopAll(): void {
    for (const [, { source }] of this.activeSources.entries()) {
      try {
        source.stop();
      } catch (_) {}
    }
    this.activeSources.clear();
  }

  /**
   * Set master preview volume
   */
  public setMasterVolume(volume: number): void {
    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), this.audioCtx.currentTime);
    }
  }

  /**
   * Render all project audio tracks to a single mixed AudioBuffer using OfflineAudioContext.
   * Frame-accurate and completely offline.
   */
  public async renderMixedAudio(project: VideoProject, totalDuration: number, sampleRate = 44100): Promise<AudioBuffer | null> {
    if (totalDuration <= 0) return null;

    const length = Math.ceil(totalDuration * sampleRate);
    const offlineCtx = new OfflineAudioContext(2, length, sampleRate);

    let hasAudio = false;

    for (const track of project.tracks) {
      if (track.muted || (track.type !== 'audio' && track.type !== 'video')) continue;

      for (const clip of track.clips) {
        if (clip.muted || clip.volume === 0) continue;

        const buffer = await this.getAudioBuffer(clip);
        if (!buffer) continue;

        hasAudio = true;
        const source = offlineCtx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = clip.speed || 1.0;

        const gainNode = offlineCtx.createGain();
        const baseVolume = clip.volume ?? 1.0;
        const fadeIn = clip.fadeIn ?? 0;
        const fadeOut = clip.fadeOut ?? 0;
        const clipDuration = clip.duration;
        const startTime = clip.startTime;

        // Apply gain schedule in offline timeline
        gainNode.gain.setValueAtTime(fadeIn > 0 ? 0 : baseVolume, startTime);
        if (fadeIn > 0) {
          gainNode.gain.linearRampToValueAtTime(baseVolume, startTime + fadeIn);
        }
        if (fadeOut > 0) {
          const fadeStart = startTime + clipDuration - fadeOut;
          gainNode.gain.setValueAtTime(baseVolume, Math.max(startTime, fadeStart));
          gainNode.gain.linearRampToValueAtTime(0, startTime + clipDuration);
        }

        source.connect(gainNode);
        gainNode.connect(offlineCtx.destination);

        const offset = clip.trimIn;
        const playDuration = clip.duration * (clip.speed || 1.0);
        source.start(startTime, offset, playDuration);
      }
    }

    if (!hasAudio) return null;

    try {
      return await offlineCtx.startRendering();
    } catch (err) {
      console.error('Offline audio rendering failed:', err);
      return null;
    }
  }

  /**
   * Convert an AudioBuffer to an uncompressed 16-bit PCM WAV Blob
   */
  public audioBufferToWav(buffer: AudioBuffer): Blob {
    const numChannels = buffer.numberOfChannels;
    const sampleRate = buffer.sampleRate;
    const format = 1; // PCM
    const bitDepth = 16;
    const bytesPerSample = bitDepth / 8;
    const blockAlign = numChannels * bytesPerSample;

    const length = buffer.length * blockAlign;
    const bufferSize = 44 + length;
    const arrayBuffer = new ArrayBuffer(bufferSize);
    const view = new DataView(arrayBuffer);

    // Write WAV header
    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + length, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // SubChunk1Size
    view.setUint16(20, format, true); // AudioFormat
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * blockAlign, true); // ByteRate
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitDepth, true);
    writeString(36, 'data');
    view.setUint32(40, length, true);

    // Interleave channels and write PCM samples
    const channels: Float32Array[] = [];
    for (let i = 0; i < numChannels; i++) {
      channels.push(buffer.getChannelData(i));
    }

    let offset = 44;
    for (let i = 0; i < buffer.length; i++) {
      for (let ch = 0; ch < numChannels; ch++) {
        let sample = channels[ch][i];
        // Clip sample between -1 and 1
        sample = Math.max(-1, Math.min(1, sample));
        // Scale to 16-bit signed integer
        const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return new Blob([arrayBuffer], { type: 'audio/wav' });
  }

  /**
   * Start live microphone voiceover recording
   */
  public async startVoiceRecording(): Promise<void> {
    if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.recordedChunks = [];
    this.mediaRecorder = new MediaRecorder(stream);
    this.mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        this.recordedChunks.push(e.data);
      }
    };
    this.mediaRecorder.start(100);
  }

  /**
   * Stop voiceover recording and return the recorded Blob
   */
  public async stopVoiceRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
      if (!this.mediaRecorder || this.mediaRecorder.state === 'inactive') {
        resolve(null);
        return;
      }

      this.mediaRecorder.onstop = () => {
        const tracks = this.mediaRecorder?.stream.getTracks();
        tracks?.forEach((t) => t.stop());
        const blob = new Blob(this.recordedChunks, { type: 'audio/webm' });
        this.recordedChunks = [];
        this.mediaRecorder = null;
        resolve(blob);
      };

      this.mediaRecorder.stop();
    });
  }

  public isRecordingVoice(): boolean {
    return this.mediaRecorder?.state === 'recording';
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.stopAll();
    this.bufferCache.clear();
  }
}

export const audioMixer = new AudioMixer();

import { VideoProject, TimelineTrack, VideoClip } from '../types';
import { getAssetBlob } from '../db';
import { computeSpeedRampedClipTime } from './previewRenderer';

/**
 * AudioMixer handles:
 * 1. Decoding audio from clips/assets into AudioBuffers with local memory caching.
 * 2. Real-time preview playback synchronized with timeline playhead.
 * 3. Master and per-clip volume gains with fade-in and fade-out automation.
 * 4. Offline audio mixing for export rendering (returns mixed AudioBuffer).
 * 5. WAV file encoder for audio exports.
 * 6. Voiceover microphone recording.
 * 7. Real-time PCM audio energy analysis & multi-clip transition synchronization.
 */

interface ActiveAudioSource {
  source: AudioBufferSourceNode;
  gainNode: GainNode;
  clipId: string;
  startedAtTimelineSec: number;
}

class AudioMixer {
  private audioCtx: AudioContext | null = null;
  private bufferCache: Map<string, AudioBuffer | null> = new Map();
  private pendingDecodes: Map<string, Promise<AudioBuffer | null>> = new Map();
  private activeSources: Map<string, ActiveAudioSource> = new Map();
  private isMixing = false;
  private masterGain: GainNode | null = null;
  private analyser: AnalyserNode | null = null;

  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private waveformPeakCache: Map<string, number[]> = new Map();

  constructor() {
    if (typeof window !== 'undefined') {
      (window as any).__audioMixer = this;
    }
  }

  public getAudioContext(): AudioContext {
    if (!this.audioCtx || this.audioCtx.state === 'closed') {
      const AudioCtxClass =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioCtx = new AudioCtxClass();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(1.0, this.audioCtx.currentTime);

      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 512;
      this.analyser.smoothingTimeConstant = 0.3;

      this.masterGain.connect(this.analyser);
      this.analyser.connect(this.audioCtx.destination);
    }
    if (this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  public getAnalyserNode(): AnalyserNode | null {
    this.getAudioContext();
    return this.analyser;
  }

  public getAudioEnergy(): { rms: number; peak: number } {
    if (!this.analyser) {
      this.getAudioContext();
    }
    if (!this.analyser) return { rms: 0, peak: 0 };

    const data = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(data);
    let sum = 0;
    let peak = 0;
    for (let i = 0; i < data.length; i++) {
      const absVal = Math.abs(data[i]);
      if (absVal > peak) peak = absVal;
      sum += absVal * absVal;
    }
    return {
      rms: Math.sqrt(sum / data.length),
      peak,
    };
  }

  public getActiveSourcesCount(): number {
    return this.activeSources.size;
  }

  public getActiveClipIds(): string[] {
    return Array.from(this.activeSources.keys());
  }

  /**
   * Procedural Cinematic SFX Synthesizer:
   * Generates sample-accurate audio buffers directly via Web Audio synthesis
   * without needing external WAV/MP3 files. Supports whoosh, sub-bass-boom,
   * tension-riser, glitch-zap, and camera-shutter.
   */
  public generateProceduralSfxBuffer(
    type: 'whoosh' | 'sub-bass-boom' | 'tension-riser' | 'glitch-zap' | 'camera-shutter' | string,
    ctx: BaseAudioContext,
    sampleRate = 48000
  ): AudioBuffer {
    if (type === 'whoosh') {
      const duration = 0.45;
      const length = Math.ceil(duration * sampleRate);
      const buffer = ctx.createBuffer(2, length, sampleRate);
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);

      let yL1 = 0, yL2 = 0, yR1 = 0, yR2 = 0;
      for (let i = 0; i < length; i++) {
        const p = i / length;
        const fCenter = 250 + Math.sin(p * Math.PI) * 2550;
        const w0 = (2 * Math.PI * fCenter) / sampleRate;
        const alpha = Math.sin(w0) / (2 * 1.8);
        const b0 = alpha;
        const a0 = 1 + alpha;
        const a1 = -2 * Math.cos(w0);
        const a2 = 1 - alpha;

        const noiseL = Math.random() * 2 - 1;
        const noiseR = Math.random() * 2 - 1;
        const env = Math.pow(Math.sin(p * Math.PI), 2.2);

        const outL = (b0 / a0) * noiseL - (a1 / a0) * yL1 - (a2 / a0) * yL2;
        yL2 = yL1;
        yL1 = outL;

        const outR = (b0 / a0) * noiseR - (a1 / a0) * yR1 - (a2 / a0) * yR2;
        yR2 = yR1;
        yR1 = outR;

        const panL = Math.cos(p * (Math.PI / 2));
        const panR = Math.sin(p * (Math.PI / 2));

        left[i] = Math.max(-1, Math.min(1, outL * env * panL * 2.2));
        right[i] = Math.max(-1, Math.min(1, outR * env * panR * 2.2));
      }
      return buffer;
    } else if (type === 'sub-bass-boom') {
      const duration = 1.2;
      const length = Math.ceil(duration * sampleRate);
      const buffer = ctx.createBuffer(2, length, sampleRate);
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);

      let phase = 0;
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const freq = 32 + (60 - 32) * Math.exp(-t * 3.5);
        phase += (2 * Math.PI * freq) / sampleRate;

        const attack = Math.min(1, t / 0.005);
        const decay = Math.exp(-t * 2.8);
        const env = attack * decay;

        const fundamental = Math.sin(phase);
        const harmonic = Math.sin(phase * 2) * 0.3;
        const saturated = Math.tanh((fundamental + harmonic) * 1.4) * 0.85;

        left[i] = saturated * env;
        right[i] = saturated * env;
      }
      return buffer;
    } else if (type === 'tension-riser') {
      const duration = 2.0;
      const length = Math.ceil(duration * sampleRate);
      const buffer = ctx.createBuffer(2, length, sampleRate);
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);

      let phase1 = 0;
      let phase2 = 0;
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        const p = t / duration;
        const freq = 85 * Math.pow(1800 / 85, p);
        phase1 += (2 * Math.PI * freq) / sampleRate;
        phase2 += (2 * Math.PI * (freq * 1.01)) / sampleRate;

        const env = Math.pow(p, 1.8) * 0.75;
        const osc = (Math.sin(phase1) + Math.sin(phase2)) * 0.45;
        const noise = (Math.random() * 2 - 1) * p * 0.25;

        const val = (osc + noise) * env;
        left[i] = Math.max(-1, Math.min(1, val));
        right[i] = Math.max(-1, Math.min(1, val * (0.8 + 0.4 * Math.sin(p * 15))));
      }
      return buffer;
    } else if (type === 'glitch-zap') {
      const duration = 0.28;
      const length = Math.ceil(duration * sampleRate);
      const buffer = ctx.createBuffer(2, length, sampleRate);
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);

      let phase = 0;
      let currFreq = 800;
      for (let i = 0; i < length; i++) {
        if (i % Math.floor(sampleRate * 0.015) === 0) {
          currFreq = 300 + Math.random() * 2400;
        }
        phase += (2 * Math.PI * currFreq) / sampleRate;
        const p = i / length;
        const env = Math.max(0, 1 - p * p);
        const bitNoise = Math.sin(phase) > 0 ? 0.6 : -0.6;
        const sample = (bitNoise * 0.5 + (Math.random() * 2 - 1) * 0.5) * env * 0.8;
        left[i] = sample;
        right[i] = sample * (Math.random() > 0.5 ? 1 : -0.8);
      }
      return buffer;
    } else {
      // camera-shutter
      const duration = 0.18;
      const length = Math.ceil(duration * sampleRate);
      const buffer = ctx.createBuffer(2, length, sampleRate);
      const left = buffer.getChannelData(0);
      const right = buffer.getChannelData(1);

      const click1Time = 0.0;
      const click2Time = 0.07;
      for (let i = 0; i < length; i++) {
        const t = i / sampleRate;
        let s = 0;
        if (t >= click1Time && t < click1Time + 0.04) {
          const dt = t - click1Time;
          s += Math.sin(2 * Math.PI * 1800 * dt) * Math.exp(-dt * 120) * 0.7;
        }
        if (t >= click2Time && t < click2Time + 0.06) {
          const dt = t - click2Time;
          s += (Math.sin(2 * Math.PI * 1100 * dt) + Math.sin(2 * Math.PI * 350 * dt) * 0.5) * Math.exp(-dt * 80) * 0.85;
        }
        left[i] = Math.max(-1, Math.min(1, s));
        right[i] = Math.max(-1, Math.min(1, s));
      }
      return buffer;
    }
  }

  /**
   * Load and decode an audio buffer from a clip or asset blob.
   * Caches results and debounces concurrent decodes.
   */
  public async getAudioBuffer(clip: VideoClip): Promise<AudioBuffer | null> {
    const cacheKey = clip.assetId || clip.sourceUrl || clip.id;
    if (this.bufferCache.has(cacheKey)) {
      return this.bufferCache.get(cacheKey) || null;
    }

    if (this.pendingDecodes.has(cacheKey)) {
      return this.pendingDecodes.get(cacheKey)!;
    }

    // Procedural SFX generation (whoosh, sub-bass-boom, tension-riser, glitch-zap, camera-shutter)
    if (clip.isProceduralSfx || clip.proceduralSfxType || (clip.assetId && clip.assetId.startsWith('sfx-procedural-'))) {
      const sfxType = clip.proceduralSfxType || (clip.assetId ? clip.assetId.replace('sfx-procedural-', '') : 'whoosh');
      const ctx = this.getAudioContext();
      const sfxBuffer = this.generateProceduralSfxBuffer(sfxType, ctx);
      this.bufferCache.set(cacheKey, sfxBuffer);
      return sfxBuffer;
    }

    // Explicit test tone only if explicitly set on clip object
    const toneHz = (clip as any).audioToneHz || null;

    if (toneHz) {
      const sampleRate = 48000;
      const duration = Math.max(1, clip.sourceDuration || clip.duration || 10);
      const ctx = this.getAudioContext();
      const toneBuffer = ctx.createBuffer(2, Math.ceil(duration * sampleRate), sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const channelData = toneBuffer.getChannelData(ch);
        for (let i = 0; i < channelData.length; i++) {
          const t = i / sampleRate;
          channelData[i] = Math.sin(2 * Math.PI * toneHz * t) * 0.4;
        }
      }
      this.bufferCache.set(cacheKey, toneBuffer);
      return toneBuffer;
    }

    const decodePromise = (async () => {
      try {
        let blob: Blob | null = null;
        if (clip.assetId) {
          blob = await getAssetBlob(clip.assetId);
        }
        if (!blob && clip.sourceUrl) {
          const resp = await fetch(clip.sourceUrl).catch(() => null);
          if (resp && resp.ok) blob = await resp.blob();
        }
        if (!blob && clip.assetId) {
          if (clip.assetId.startsWith('music-')) {
            const name = clip.assetId.replace('music-', '');
            const resp = await fetch(`/video-assets/audio/music/${name}.wav`).catch(() => null);
            if (resp && resp.ok) blob = await resp.blob();
          } else if (clip.assetId.startsWith('sfx-')) {
            const name = clip.assetId.replace('sfx-', '');
            const resp = await fetch(`/video-assets/audio/sfx/${name}.wav`).catch(() => null);
            if (resp && resp.ok) blob = await resp.blob();
          }
        }

        if (!blob) {
          if (clip.assetId?.includes('censor-bleep') || clip.name?.toLowerCase().includes('sansür')) {
            const ctx = this.getAudioContext();
            const sampleRate = ctx.sampleRate || 44100;
            const bleepDur = Math.max(0.1, clip.duration || 1.0);
            const buffer = ctx.createBuffer(1, Math.floor(sampleRate * bleepDur), sampleRate);
            const data = buffer.getChannelData(0);
            for (let i = 0; i < data.length; i++) {
              data[i] = Math.sin(2 * Math.PI * 1000 * (i / sampleRate)) * 0.75;
            }
            this.bufferCache.set(cacheKey, buffer);
            return buffer;
          }
          this.bufferCache.set(cacheKey, null);
          return null;
        }

        // Only decode audio or video blobs
        if (blob.type && !blob.type.includes('audio') && !blob.type.includes('video') && !blob.type.includes('ogg')) {
          this.bufferCache.set(cacheKey, null);
          return null;
        }

        const arrayBuffer = await blob.arrayBuffer();
        const ctx = this.getAudioContext();
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        this.bufferCache.set(cacheKey, decoded);
        return decoded;
      } catch (err) {
        // Video file might not have an audio track (e.g. silent recording)
        this.bufferCache.set(cacheKey, null);
        return null;
      } finally {
        this.pendingDecodes.delete(cacheKey);
      }
    })();

    this.pendingDecodes.set(cacheKey, decodePromise);
    return decodePromise;
  }

  /**
   * Preload audio for all audio/video clips in the project so transitions have zero delay
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
   * Synchronize audio preview playback at given timeline position.
   * Handles multi-clip playback, sequential clips, overlapping clips, and seek re-alignment.
   */
  public async syncPlayback(
    project: VideoProject,
    currentTime: number,
    isPlaying: boolean,
    forceSeek = false,
    playbackRate = 1.0
  ): Promise<void> {
    if (!isPlaying || playbackRate < 0) {
      this.stopAll();
      return;
    }

    const ctx = this.getAudioContext();
    if (ctx.state === 'suspended') {
      try {
        await ctx.resume();
      } catch {}
    }

    if (forceSeek) {
      this.stopAll();
    }

    const activeClipIds = new Set<string>();

    for (const track of project.tracks) {
      if (track.muted || (track.type !== 'audio' && track.type !== 'video')) continue;

      for (const clip of track.clips) {
        if (clip.muted || (clip.volume !== undefined && clip.volume <= 0)) continue;

        const jCutOffset = clip.jCutOffsetSec || 0;
        const lCutOffset = clip.lCutOffsetSec || 0;
        const clipStart = Math.max(0, clip.startTime - jCutOffset);
        const clipEnd = clip.startTime + clip.duration + lCutOffset;

        if (currentTime >= clipStart && currentTime < clipEnd) {
          activeClipIds.add(clip.id);

          const existing = this.activeSources.get(clip.id);

          // If not playing, or if forced seek, start it
          if (!existing) {
            const buffer = await this.getAudioBuffer(clip);
            if (!buffer) continue;

            const speed = clip.speed || 1.0;
            const remainingClipDuration = Math.max(0.01, clipEnd - currentTime);
            const shouldLoop =
              Boolean(clip.loop) ||
              clip.duration > buffer.duration ||
              (clip.assetId && clip.assetId.includes('censor-bleep')) ||
              (clip.name && clip.name.toLowerCase().includes('sansür'));

            const audioOffsetSec = (clip.audioOffsetMs || 0) / 1000;
            let rampedElapsed = (currentTime - clipStart) * speed;
            let instantaneousSpeed = speed;

            if (clip.speedRampPreset && clip.speedRampPreset !== 'none') {
              rampedElapsed = computeSpeedRampedClipTime(
                currentTime - clipStart,
                clip.duration,
                clip.speedRampPreset,
                speed
              );
              const dt = 0.05;
              const t1 = computeSpeedRampedClipTime(
                currentTime - clipStart,
                clip.duration,
                clip.speedRampPreset,
                speed
              );
              const t2 = computeSpeedRampedClipTime(
                currentTime - clipStart + dt,
                clip.duration,
                clip.speedRampPreset,
                speed
              );
              instantaneousSpeed = Math.max(0.1, (t2 - t1) / dt);
            }

            const rawRelTime = rampedElapsed + (clip.trimIn ?? 0) + audioOffsetSec;
            if (rawRelTime < -0.001) {
              // Audio is delayed by negative slip and has not reached its starting sample yet
              continue;
            }
            let clipRelTime = Math.max(0, rawRelTime);
            if (shouldLoop && buffer.duration > 0) {
              clipRelTime = clipRelTime % buffer.duration;
            } else if (clipRelTime >= buffer.duration) {
              continue;
            }

            const source = ctx.createBufferSource();
            source.buffer = buffer;
            const clipPlayRate = instantaneousSpeed * (playbackRate || 1.0);
            source.playbackRate.value = Math.max(0.2, Math.min(4.0, clipPlayRate));
            if (shouldLoop && buffer.duration > 0) {
              source.loop = true;
              source.loopStart = 0;
              source.loopEnd = buffer.duration;
            }

            const gainNode = ctx.createGain();
            this.applyVolumeEnvelope(gainNode, clip, currentTime - clipStart, ctx.currentTime);

            if (clip.vocalMute) {
              const vocalFilter = this.createVocalSuppressionNodes(ctx);
              source.connect(vocalFilter.input);
              vocalFilter.output.connect(gainNode);
            } else {
              source.connect(gainNode);
            }

            if (this.masterGain) {
              gainNode.connect(this.masterGain);
            } else {
              gainNode.connect(ctx.destination);
            }

            try {
              source.start(0, clipRelTime, remainingClipDuration);
              this.activeSources.set(clip.id, {
                source,
                gainNode,
                clipId: clip.id,
                startedAtTimelineSec: currentTime,
              });

              source.onended = () => {
                const current = this.activeSources.get(clip.id);
                if (current && current.source === source) {
                  this.activeSources.delete(clip.id);
                }
              };
            } catch (err) {
              console.warn('[FORMA AudioMixer] Failed to start audio source for clip:', clip.id, err);
            }
          }
        }
      }
    }

    // Auto-Whoosh on cuts & transitions
    if (project.autoWhoosh) {
      const cuts = new Set<number>();
      for (const track of project.tracks) {
        if (track.transitions) {
          for (const tr of track.transitions) cuts.add(tr.cutTime);
        }
        for (let i = 0; i < track.clips.length - 1; i++) {
          const c1 = track.clips[i];
          const c2 = track.clips[i + 1];
          if (Math.abs(c1.startTime + c1.duration - c2.startTime) < 0.1) {
            cuts.add(Number(((c1.startTime + c1.duration + c2.startTime) / 2).toFixed(2)));
          }
        }
      }

      for (const cutTime of cuts) {
        const whooshStart = cutTime - 0.22;
        const whooshEnd = whooshStart + 0.45;
        if (currentTime >= whooshStart && currentTime < whooshEnd) {
          const autoKey = `auto-whoosh-${cutTime.toFixed(2)}`;
          activeClipIds.add(autoKey);
          if (!this.activeSources.has(autoKey)) {
            const whooshBuf = this.generateProceduralSfxBuffer('whoosh', ctx);
            const source = ctx.createBufferSource();
            source.buffer = whooshBuf;
            const g = ctx.createGain();
            g.gain.setValueAtTime(0.85, ctx.currentTime);
            source.connect(g);
            if (this.masterGain) g.connect(this.masterGain);
            else g.connect(ctx.destination);
            try {
              const relTime = currentTime - whooshStart;
              source.start(0, Math.max(0, relTime), whooshEnd - currentTime);
              this.activeSources.set(autoKey, {
                source,
                gainNode: g,
                clipId: autoKey,
                startedAtTimelineSec: currentTime,
              });
              source.onended = () => {
                if (this.activeSources.get(autoKey)?.source === source) {
                  this.activeSources.delete(autoKey);
                }
              };
            } catch {}
          }
        }
      }
    }

    // Stop clips that are no longer active on the timeline
    for (const [id, active] of this.activeSources.entries()) {
      if (!activeClipIds.has(id)) {
        try {
          active.source.stop();
        } catch (_) {}
        this.activeSources.delete(id);
      }
    }
  }

  /**
   * Calculate audio crossfade gains for outgoing and incoming audio sources
   */
  public calculateCrossfadeGains(
    progress: number,
    curve: 'linear' | 'constant-power' | 'ease-in-out' = 'constant-power'
  ): { gainOut: number; gainIn: number } {
    const p = Math.max(0, Math.min(1, progress));
    if (curve === 'linear') {
      return { gainOut: 1 - p, gainIn: p };
    } else if (curve === 'ease-in-out') {
      const s = p * p * (3 - 2 * p);
      return { gainOut: 1 - s, gainIn: s };
    } else {
      // Constant power (equal power: cos^2 + sin^2 = 1.0)
      return {
        gainOut: Math.cos((p * Math.PI) / 2),
        gainIn: Math.sin((p * Math.PI) / 2),
      };
    }
  }

  /**
   * Telemetry inspection for audio crossfade state & measurements
   */
  public getCrossfadeTelemetry(
    progress: number,
    curve: 'linear' | 'constant-power' | 'ease-in-out' = 'constant-power'
  ) {
    const gains = this.calculateCrossfadeGains(progress, curve);
    return {
      progress,
      curve,
      gainOut: Number(gains.gainOut.toFixed(4)),
      gainIn: Number(gains.gainIn.toFixed(4)),
      totalPower: Number((gains.gainOut * gains.gainOut + gains.gainIn * gains.gainIn).toFixed(4)),
    };
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
    // Automatic 15ms anti-pop/click micro-fade protection
    const microFadeSec = 0.015;
    const fadeIn = Math.max(microFadeSec, clip.fadeIn ?? 0);
    const fadeOut = Math.max(microFadeSec, clip.fadeOut ?? 0);
    const duration = clip.duration;

    const gain = gainNode.gain;
    gain.cancelScheduledValues(audioCtxTime);

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
    for (const [, active] of this.activeSources.entries()) {
      try {
        active.source.stop();
      } catch (_) {}
    }
    this.activeSources.clear();
  }

  /**
   * Set master preview volume
   */
  public setMasterVolume(volume: number): void {
    const ctx = this.getAudioContext();
    if (this.masterGain && ctx) {
      this.masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), ctx.currentTime);
    }
  }

  /**
   * Render all project audio tracks to a single mixed AudioBuffer using OfflineAudioContext.
   * Frame-accurate and completely offline.
   */
  public async renderMixedAudio(
    project: VideoProject,
    totalDuration: number,
    sampleRate = 48000
  ): Promise<AudioBuffer | null> {
    if (totalDuration <= 0) return null;

    const length = Math.ceil(totalDuration * sampleRate);
    const offlineCtx = new OfflineAudioContext(2, length, sampleRate);

    let hasAudio = false;

    // Detect speech intervals across timeline for Auto-Ducking
    const speechIntervals: Array<{ start: number; end: number }> = [];
    if (project.autoDucking) {
      for (const track of project.tracks) {
        if (track.muted) continue;
        const isMusic =
          track.name?.toLowerCase().includes('müzik') ||
          track.name?.toLowerCase().includes('music') ||
          track.name?.toLowerCase().includes('bg') ||
          track.name?.toLowerCase().includes('arka plan');
        if (isMusic) continue;

        for (const clip of track.clips) {
          if (clip.muted || clip.volume === 0 || clip.vocalMute) continue;
          const jCut = clip.jCutOffsetSec || 0;
          const lCut = clip.lCutOffsetSec || 0;
          const s = Math.max(0, clip.startTime - jCut);
          const e = clip.startTime + clip.duration + lCut;
          speechIntervals.push({ start: s, end: e });
        }
      }
      if (project.subtitles && project.subtitles.length > 0) {
        for (const sub of project.subtitles) {
          speechIntervals.push({ start: sub.startTime, end: sub.endTime });
        }
      }
    }

    const mergedSpeechIntervals: Array<{ start: number; end: number }> = [];
    if (speechIntervals.length > 0) {
      speechIntervals.sort((a, b) => a.start - b.start);
      let cur = { ...speechIntervals[0] };
      for (let i = 1; i < speechIntervals.length; i++) {
        if (speechIntervals[i].start <= cur.end + 0.05) {
          cur.end = Math.max(cur.end, speechIntervals[i].end);
        } else {
          mergedSpeechIntervals.push(cur);
          cur = { ...speechIntervals[i] };
        }
      }
      mergedSpeechIntervals.push(cur);
    }

    const duckDb = project.autoDuckingDb ?? -12;
    const duckRatio = Math.max(0.05, Math.min(1.0, Math.pow(10, duckDb / 20))); // ~0.25 (-12dB)
    const duckFadeSec = (project.autoDuckingFadeMs ?? 300) / 1000; // 300ms fade

    for (const track of project.tracks) {
      if (track.muted || (track.type !== 'audio' && track.type !== 'video')) continue;

      const isMusicTrack =
        track.name?.toLowerCase().includes('müzik') ||
        track.name?.toLowerCase().includes('music') ||
        track.name?.toLowerCase().includes('bg') ||
        track.name?.toLowerCase().includes('arka plan');

      const trackTransitions = [
        ...(track.transitions || []),
        ...(project.transitions?.filter((tr) => tr.trackId === track.id) || []),
      ];

      for (const clip of track.clips) {
        if (clip.muted || clip.volume === 0) continue;

        const buffer = await this.getAudioBuffer(clip);
        if (!buffer) continue;

        hasAudio = true;
        const source = offlineCtx.createBufferSource();
        source.buffer = buffer;
        let effectiveSpeed = clip.speed || 1.0;
        if (clip.speedRampPreset && clip.speedRampPreset !== 'none') {
          const totalRampedSec = computeSpeedRampedClipTime(
            clip.duration,
            clip.duration,
            clip.speedRampPreset,
            effectiveSpeed
          );
          effectiveSpeed = totalRampedSec / Math.max(0.1, clip.duration);
        }
        source.playbackRate.value = Math.max(0.2, Math.min(4.0, effectiveSpeed));

        const gainNode = offlineCtx.createGain();
        const baseVolume = clip.volume ?? 1.0;
        const clipDuration = clip.duration;
        const startTime = clip.startTime;

        // Check for outgoing transition at clip end
        const outgoingTrans = trackTransitions.find(
          (tr) =>
            tr.leftClipId === clip.id ||
            Math.abs(clip.startTime + clip.duration - tr.cutTime) < 0.25
        );

        // Check for incoming transition at clip start
        const incomingTrans = trackTransitions.find(
          (tr) =>
            tr.rightClipId === clip.id ||
            Math.abs(clip.startTime - tr.cutTime) < 0.25
        );

        const jCutOffset = clip.jCutOffsetSec || 0;
        const lCutOffset = clip.lCutOffsetSec || 0;
        const audioOffsetSec = (clip.audioOffsetMs || 0) / 1000;

        let actualStartTime = Math.max(0, startTime - jCutOffset);
        const rawOffset = (clip.trimIn || 0) + audioOffsetSec - jCutOffset;
        let actualOffset = Math.max(0, rawOffset);
        if (rawOffset < 0) {
          actualStartTime = startTime - rawOffset;
        }

        let preRoll = 0;
        let extension = 0;

        if (incomingTrans) {
          const transDur = incomingTrans.duration || 1.0;
          const tStart =
            incomingTrans.alignment === 'in'
              ? incomingTrans.cutTime
              : incomingTrans.alignment === 'out'
              ? incomingTrans.cutTime - transDur
              : incomingTrans.cutTime - transDur / 2;
          const leftHandle = Math.max(0, clip.trimIn || 0);
          preRoll = Math.min(leftHandle, Math.max(0, startTime - tStart));
          actualStartTime = Math.max(0, startTime - preRoll - jCutOffset);
          actualOffset = Math.max(0, (clip.trimIn || 0) - preRoll + audioOffsetSec - jCutOffset);
        }

        if (outgoingTrans) {
          const transDur = outgoingTrans.duration || 1.0;
          const tStart =
            outgoingTrans.alignment === 'in'
              ? outgoingTrans.cutTime
              : outgoingTrans.alignment === 'out'
              ? outgoingTrans.cutTime - transDur
              : outgoingTrans.cutTime - transDur / 2;
          const tEnd = tStart + transDur;
          const srcDur = clip.sourceDuration || buffer.duration || (clip.trimIn + clip.duration);
          const rightHandle = Math.max(0, srcDur - ((clip.trimIn || 0) + clip.duration));
          extension = Math.min(rightHandle, Math.max(0, tEnd - (startTime + clipDuration)));
        }

        const totalPlayDuration =
          (clipDuration + preRoll + extension + jCutOffset + lCutOffset) * (clip.speed || 1.0);

        // 15ms Micro-Fade Anti-Pop protection
        const microFadeSec = 0.015;
        const effectiveFadeIn = Math.max(microFadeSec, clip.fadeIn ?? 0);
        const effectiveFadeOut = Math.max(microFadeSec, clip.fadeOut ?? 0);

        // Gain schedule with micro-fade and crossfade transitions
        if (incomingTrans && preRoll > 0) {
          const transDur = incomingTrans.duration || 1.0;
          const tStart =
            incomingTrans.alignment === 'in'
              ? incomingTrans.cutTime
              : incomingTrans.alignment === 'out'
              ? incomingTrans.cutTime - transDur
              : incomingTrans.cutTime - transDur / 2;
          const tEnd = tStart + transDur;
          gainNode.gain.setValueAtTime(0, actualStartTime);
          gainNode.gain.linearRampToValueAtTime(baseVolume, tEnd);
        } else {
          gainNode.gain.setValueAtTime(0, actualStartTime);
          gainNode.gain.linearRampToValueAtTime(baseVolume, actualStartTime + effectiveFadeIn);
        }

        // Auto-Ducking on background music during speech
        const isMusic =
          isMusicTrack || (clip.assetId && clip.assetId.includes('music')) || (clip.name && clip.name.toLowerCase().includes('müzik'));
        if (project.autoDucking && isMusic && mergedSpeechIntervals.length > 0) {
          const clipEndSec = actualStartTime + totalPlayDuration;
          for (const sp of mergedSpeechIntervals) {
            if (sp.end <= actualStartTime || sp.start >= clipEndSec) continue;

            const duckStart = Math.max(actualStartTime + effectiveFadeIn, sp.start - duckFadeSec);
            const duckLowStart = Math.max(actualStartTime, sp.start);
            const duckLowEnd = Math.min(clipEndSec - effectiveFadeOut, sp.end);
            const duckRecoverEnd = Math.min(clipEndSec, sp.end + duckFadeSec);

            if (duckLowStart < duckLowEnd) {
              gainNode.gain.setValueAtTime(baseVolume, duckStart);
              gainNode.gain.linearRampToValueAtTime(baseVolume * duckRatio, duckLowStart);
              gainNode.gain.setValueAtTime(baseVolume * duckRatio, duckLowEnd);
              gainNode.gain.linearRampToValueAtTime(baseVolume, duckRecoverEnd);
            }
          }
        }

        if (outgoingTrans && extension > 0) {
          const transDur = outgoingTrans.duration || 1.0;
          const tStart =
            outgoingTrans.alignment === 'in'
              ? outgoingTrans.cutTime
              : outgoingTrans.alignment === 'out'
              ? outgoingTrans.cutTime - transDur
              : outgoingTrans.cutTime - transDur / 2;
          const tEnd = tStart + transDur;
          gainNode.gain.setValueAtTime(baseVolume, tStart);
          gainNode.gain.linearRampToValueAtTime(0, tEnd);
        } else {
          const fadeStart = actualStartTime + totalPlayDuration - effectiveFadeOut;
          if (fadeStart > actualStartTime + effectiveFadeIn) {
            gainNode.gain.setValueAtTime(baseVolume, fadeStart);
            gainNode.gain.linearRampToValueAtTime(0, actualStartTime + totalPlayDuration);
          }
        }

        if (totalPlayDuration > buffer.duration) {
          source.loop = true;
          source.loopStart = 0;
          source.loopEnd = buffer.duration;
        }

        if (clip.vocalMute) {
          const vocalFilter = this.createVocalSuppressionNodes(offlineCtx);
          source.connect(vocalFilter.input);
          vocalFilter.output.connect(gainNode);
        } else {
          source.connect(gainNode);
        }
        gainNode.connect(offlineCtx.destination);
        source.start(actualStartTime, actualOffset, totalPlayDuration);
      }
    }

    // Auto-Whoosh on cuts in exported audio
    if (project.autoWhoosh) {
      const cuts = new Set<number>();
      for (const track of project.tracks) {
        if (track.transitions) {
          for (const tr of track.transitions) cuts.add(tr.cutTime);
        }
        for (let i = 0; i < track.clips.length - 1; i++) {
          const c1 = track.clips[i];
          const c2 = track.clips[i + 1];
          if (Math.abs(c1.startTime + c1.duration - c2.startTime) < 0.1) {
            cuts.add(Number(((c1.startTime + c1.duration + c2.startTime) / 2).toFixed(2)));
          }
        }
      }
      for (const cutTime of cuts) {
        const whooshStart = Math.max(0, cutTime - 0.22);
        const whooshBuf = this.generateProceduralSfxBuffer('whoosh', offlineCtx, sampleRate);
        const wSrc = offlineCtx.createBufferSource();
        wSrc.buffer = whooshBuf;
        const wGain = offlineCtx.createGain();
        wGain.gain.setValueAtTime(0.85, whooshStart);
        wSrc.connect(wGain);
        wGain.connect(offlineCtx.destination);
        wSrc.start(whooshStart);
        hasAudio = true;
      }
    }

    if (!hasAudio) return null;

    try {
      return await offlineCtx.startRendering();
    } catch (err) {
      console.error('[FORMA AudioMixer] Offline audio rendering failed:', err);
      return null;
    }
  }

  /**
   * Creates an audio processing graph that suppresses human vocal/speech frequencies
   * (formant notch + speech band attenuation 250Hz - 3500Hz) while keeping background
   * music (sub-bass, basslines, kicks < 250Hz) and ambient highs/reverb (> 3500Hz) intact.
   */
  public createVocalSuppressionNodes(ctx: BaseAudioContext): { input: AudioNode; output: AudioNode } {
    const input = ctx.createGain();
    const output = ctx.createGain();

    // 1. Low-frequency path: keeps basslines, 808s, kicks, and deep room tone (< 250Hz)
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.setValueAtTime(250, 0);
    lowpass.Q.setValueAtTime(0.707, 0);

    // 2. High-frequency path: keeps hi-hats, presence, room air, reverb sparkle (> 3500Hz)
    const highpass = ctx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(3500, 0);
    highpass.Q.setValueAtTime(0.707, 0);

    // 3. Dialogue suppression notch filters across speech formants (450Hz, 1000Hz, 2200Hz)
    const notch1 = ctx.createBiquadFilter();
    notch1.type = 'peaking';
    notch1.frequency.setValueAtTime(450, 0);
    notch1.Q.setValueAtTime(1.2, 0);
    notch1.gain.setValueAtTime(-28, 0);

    const notch2 = ctx.createBiquadFilter();
    notch2.type = 'peaking';
    notch2.frequency.setValueAtTime(1000, 0);
    notch2.Q.setValueAtTime(1.4, 0);
    notch2.gain.setValueAtTime(-32, 0);

    const notch3 = ctx.createBiquadFilter();
    notch3.type = 'peaking';
    notch3.frequency.setValueAtTime(2200, 0);
    notch3.Q.setValueAtTime(1.4, 0);
    notch3.gain.setValueAtTime(-28, 0);

    const midBand = ctx.createBiquadFilter();
    midBand.type = 'bandpass';
    midBand.frequency.setValueAtTime(1400, 0);
    midBand.Q.setValueAtTime(0.7, 0);

    const midAttenuator = ctx.createGain();
    midAttenuator.gain.setValueAtTime(0.06, 0);

    // Connect paths
    input.connect(lowpass);
    lowpass.connect(output);

    input.connect(highpass);
    highpass.connect(output);

    input.connect(midBand);
    midBand.connect(notch1);
    notch1.connect(notch2);
    notch2.connect(notch3);
    notch3.connect(midAttenuator);
    midAttenuator.connect(output);

    return { input, output };
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
   * Computes normalized audio waveform peaks for a clip.
   * Works for both audio clips and video clips with embedded audio.
   */
  public async getWaveformPeaks(clip: VideoClip, numBars: number = 72): Promise<number[]> {
    const speed = clip.speed || 1.0;
    const trimIn = clip.trimIn ?? 0;
    const duration = clip.duration;
    const cacheKey = `${clip.assetId || clip.sourceUrl || clip.id}_${trimIn.toFixed(2)}_${duration.toFixed(2)}_${speed}_${numBars}`;

    if (this.waveformPeakCache.has(cacheKey)) {
      return this.waveformPeakCache.get(cacheKey)!;
    }

    try {
      const buffer = await this.getAudioBuffer(clip);
      if (!buffer || buffer.length === 0) {
        return [];
      }

      const channelData = buffer.getChannelData(0);
      const sampleRate = buffer.sampleRate;
      const startSec = trimIn;
      const endSec = Math.min(buffer.duration, trimIn + duration * speed);
      const startSample = Math.floor(Math.max(0, startSec * sampleRate));
      const endSample = Math.floor(Math.min(channelData.length, endSec * sampleRate));
      const totalSamples = endSample - startSample;

      if (totalSamples <= 0) {
        return [];
      }

      const peaks: number[] = new Array(numBars);
      const samplesPerBar = totalSamples / numBars;
      let maxPeak = 0.0001;

      for (let i = 0; i < numBars; i++) {
        const bStart = Math.floor(startSample + i * samplesPerBar);
        const bEnd = Math.floor(Math.min(endSample, bStart + samplesPerBar));
        let sumSq = 0;
        let count = 0;
        const step = Math.max(1, Math.floor((bEnd - bStart) / 100));
        for (let s = bStart; s < bEnd; s += step) {
          const val = channelData[s];
          sumSq += val * val;
          count++;
        }
        const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
        peaks[i] = rms;
        if (rms > maxPeak) maxPeak = rms;
      }

      // Normalize between 0.08 and 1.0
      const normalized = peaks.map((p) => Math.max(0.08, Math.min(1.0, p / maxPeak)));
      this.waveformPeakCache.set(cacheKey, normalized);
      return normalized;
    } catch {
      return [];
    }
  }

  /**
   * Scans audio track for silence intervals (RMS below threshold for at least minDurationSec).
   * Returns array of silence intervals in clip timeline seconds (relative to clip.startTime).
   */
  public async detectSilenceIntervals(
    clip: VideoClip,
    minDurationSec: number = 0.35,
    silenceThresholdRms: number = 0.016
  ): Promise<{ startSec: number; endSec: number; duration: number }[]> {
    try {
      const buffer = await this.getAudioBuffer(clip);
      if (!buffer || buffer.length === 0) return [];

      const channelData = buffer.getChannelData(0);
      const sampleRate = buffer.sampleRate;
      const speed = clip.speed || 1.0;
      const trimIn = clip.trimIn ?? 0;
      const clipDuration = clip.duration;
      const startSec = trimIn;
      const endSec = Math.min(buffer.duration, trimIn + clipDuration * speed);
      const startSample = Math.floor(Math.max(0, startSec * sampleRate));
      const endSample = Math.floor(Math.min(channelData.length, endSec * sampleRate));

      const chunkSizeSec = 0.05; // 50ms chunk
      const chunkSizeSamples = Math.floor(sampleRate * chunkSizeSec);
      if (chunkSizeSamples <= 0) return [];

      const silences: { startSec: number; endSec: number; duration: number }[] = [];
      let currentSilenceStartSec: number | null = null;

      for (let s = startSample; s < endSample; s += chunkSizeSamples) {
        const chunkEnd = Math.min(endSample, s + chunkSizeSamples);
        let sumSq = 0;
        let count = 0;
        for (let i = s; i < chunkEnd; i += 4) {
          const v = channelData[i];
          sumSq += v * v;
          count++;
        }
        const rms = count > 0 ? Math.sqrt(sumSq / count) : 0;
        const offsetSecFromClipStart = ((s - startSample) / sampleRate) / speed;

        if (rms < silenceThresholdRms) {
          if (currentSilenceStartSec === null) {
            currentSilenceStartSec = offsetSecFromClipStart;
          }
        } else {
          if (currentSilenceStartSec !== null) {
            const silenceDur = offsetSecFromClipStart - currentSilenceStartSec;
            if (silenceDur >= minDurationSec) {
              silences.push({
                startSec: currentSilenceStartSec,
                endSec: offsetSecFromClipStart,
                duration: silenceDur,
              });
            }
            currentSilenceStartSec = null;
          }
        }
      }

      if (currentSilenceStartSec !== null) {
        const finalSec = clipDuration;
        const silenceDur = finalSec - currentSilenceStartSec;
        if (silenceDur >= minDurationSec) {
          silences.push({
            startSec: currentSilenceStartSec,
            endSec: finalSec,
            duration: silenceDur,
          });
        }
      }

      return silences;
    } catch {
      return [];
    }
  }

  /**
   * Clear cache
   */
  public clearCache(): void {
    this.stopAll();
    this.bufferCache.clear();
    this.pendingDecodes.clear();
    this.waveformPeakCache.clear();
  }
}

export const audioMixer = new AudioMixer();

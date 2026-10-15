/**
 * FORMA Video Editor — 100% Client-Side In-Browser Whisper Transcriber
 * 
 * Powered by @huggingface/transformers (WASM / WebGPU).
 * - Zero API keys, zero external backend costs, 100% private in-browser STT.
 * - Auto-downloads and caches 'onnx-community/whisper-tiny' (or 'Xenova/whisper-tiny') in Cache API.
 * - Processes 16000 Hz Mono Float32Array PCM extracted directly from clip AudioBuffer.
 * - Emits word-level timestamps (startSec, endSec, word) in Turkish (tr).
 */

import { VideoClip } from '../types';
import { audioMixer } from './audioMixer';
import type { TimestampedWord, SpeechSegment, SpeechTranscriptionResult } from './speechRecognitionEngine';

export interface WhisperProgressCallback {
  (percent: number, statusText: string): void;
}

// Pipeline singleton to avoid reloading weights multiple times
let whisperPipelinePromise: Promise<any> | null = null;

/**
 * Resamples an AudioBuffer to 16000 Hz Mono Float32Array PCM for Whisper.
 */
export async function extract16kMonoPcm(
  clip: VideoClip,
  onProgress?: (pct: number, status: string) => void
): Promise<{ pcm: Float32Array; duration: number }> {
  onProgress?.(5, 'Ses tamponu (AudioBuffer) okunuyor...');
  const buffer = await audioMixer.getAudioBuffer(clip);
  if (!buffer || buffer.length === 0) {
    return { pcm: new Float32Array(0), duration: 0 };
  }

  const speed = clip.speed || 1.0;
  const trimIn = clip.trimIn ?? 0;
  const clipDuration = clip.duration;
  const sourceDuration = Math.min(buffer.duration - trimIn, clipDuration * speed);

  if (sourceDuration <= 0) {
    return { pcm: new Float32Array(0), duration: 0 };
  }

  const targetSampleRate = 16000;
  const targetLength = Math.max(1, Math.ceil(sourceDuration * targetSampleRate));

  // High-fidelity sinc/FIR downmixing via OfflineAudioContext in browser
  if (typeof window !== 'undefined' && (window.OfflineAudioContext || (window as any).webkitOfflineAudioContext)) {
    try {
      const OfflineCtxClass = window.OfflineAudioContext || (window as any).webkitOfflineAudioContext;
      const offlineCtx = new OfflineCtxClass(1, targetLength, targetSampleRate);

      const source = offlineCtx.createBufferSource();
      source.buffer = buffer;
      source.playbackRate.value = speed;
      source.connect(offlineCtx.destination);
      source.start(0, trimIn, sourceDuration);

      const renderedBuffer = await offlineCtx.startRendering();
      const pcmData = renderedBuffer.getChannelData(0);
      return { pcm: pcmData, duration: sourceDuration };
    } catch (e) {
      console.warn('[Whisper] OfflineAudioContext resampling fallback:', e);
    }
  }

  // Fast mathematical linear interpolation fallback
  const channelData = buffer.getChannelData(0);
  const startSample = Math.floor(trimIn * buffer.sampleRate);
  const endSample = Math.min(channelData.length, Math.floor((trimIn + sourceDuration) * buffer.sampleRate));
  const rawSlice = channelData.subarray(startSample, endSample);

  const ratio = buffer.sampleRate / targetSampleRate;
  const outSamples = Math.floor(rawSlice.length / ratio);
  const pcm = new Float32Array(outSamples);

  for (let i = 0; i < outSamples; i++) {
    const origIdx = i * ratio;
    const i1 = Math.floor(origIdx);
    const i2 = Math.min(rawSlice.length - 1, i1 + 1);
    const frac = origIdx - i1;
    pcm[i] = rawSlice[i1] * (1 - frac) + rawSlice[i2] * frac;
  }

  return { pcm, duration: sourceDuration };
}

/**
 * Initializes and caches the Transformers.js Whisper pipeline.
 */
async function getWhisperPipeline(onProgress?: WhisperProgressCallback): Promise<any> {
  if (whisperPipelinePromise) {
    return whisperPipelinePromise;
  }

  whisperPipelinePromise = (async () => {
    if (typeof window === 'undefined') {
      throw new Error('Whisper in-browser pipeline can only run in client-side browser environment.');
    }

    onProgress?.(15, 'Yapay zeka ses motoru (Transformers.js) başlatılıyor...');
    const { pipeline, env } = await import('@huggingface/transformers');

    // Configure Transformers.js to use browser Cache API without local backend
    env.allowLocalModels = false;
    env.useBrowserCache = true;

    // Check WebGPU availability
    const hasWebGpu = Boolean(typeof navigator !== 'undefined' && (navigator as any).gpu);
    const device = hasWebGpu ? 'webgpu' : 'wasm';

    onProgress?.(25, `Yapay zeka modeli hazırlanıyor (${device.toUpperCase()})...`);

    try {
      const transcriber = await pipeline(
        'automatic-speech-recognition',
        'onnx-community/whisper-tiny',
        {
          dtype: 'q8', // Quantized q8 is ~39MB, blazing fast on both WebGPU and WASM
          device,
          progress_callback: (info: any) => {
            if (info && info.status === 'progress' && typeof info.progress === 'number') {
              const fileProgress = Math.round(info.progress);
              const mapped = 25 + Math.round(fileProgress * 0.45); // 25% -> 70%
              onProgress?.(
                mapped,
                `Yapay Zeka Ses Modeli İndiriliyor / Önbelleğe Alınıyor: %${fileProgress}...`
              );
            }
          },
        }
      );
      return transcriber;
    } catch (primaryErr) {
      console.warn('[Whisper] onnx-community/whisper-tiny failed, falling back to Xenova/whisper-tiny:', primaryErr);
      const fallbackTranscriber = await pipeline(
        'automatic-speech-recognition',
        'Xenova/whisper-tiny',
        {
          quantized: true,
          progress_callback: (info: any) => {
            if (info && info.status === 'progress' && typeof info.progress === 'number') {
              const fileProgress = Math.round(info.progress);
              onProgress?.(
                30 + Math.round(fileProgress * 0.4),
                `Yapay Zeka Ses Modeli İndiriliyor: %${fileProgress}...`
              );
            }
          },
        }
      );
      return fallbackTranscriber;
    }
  })();

  return whisperPipelinePromise;
}

export class InBrowserWhisperEngine {
  /**
   * Transcribes raw 16kHz Float32Array PCM using local Whisper WASM/WebGPU.
   */
  public async transcribePcm(
    pcm16k: Float32Array,
    options: {
      language?: string;
      onProgress?: WhisperProgressCallback;
    } = {}
  ): Promise<{
    text: string;
    words: TimestampedWord[];
    chunks: Array<{ text: string; timestamp: [number, number] }>;
  }> {
    const language = options.language || 'turkish';
    const transcriber = await getWhisperPipeline(options.onProgress);

    options.onProgress?.(72, 'Ses çözümleniyor (Whisper Neural Decoder)...');

    // Run Whisper inference
    const output = await transcriber(pcm16k, {
      language,
      task: 'transcribe',
      return_timestamps: 'word',
      chunk_length_s: 30,
      stride_length_s: 5,
    });

    options.onProgress?.(92, 'Kelimeler ve zaman damgaları hizalanıyor...');

    const fullText = (output.text || '').trim();
    const rawChunks = Array.isArray(output.chunks) ? output.chunks : [];

    const words: TimestampedWord[] = [];
    const validChunks: Array<{ text: string; timestamp: [number, number] }> = [];

    let currentCursor = 0;

    for (const chunk of rawChunks) {
      const rawText = (chunk.text || '').trim();
      if (!rawText) continue;

      let start = chunk.timestamp?.[0];
      let end = chunk.timestamp?.[1];

      if (start === null || start === undefined || isNaN(start)) {
        start = currentCursor;
      }
      if (end === null || end === undefined || isNaN(end) || end <= start) {
        end = start + Math.max(0.12, rawText.length * 0.05);
      }

      currentCursor = end;

      words.push({
        word: rawText,
        startSec: parseFloat(start.toFixed(3)),
        endSec: parseFloat(end.toFixed(3)),
      });

      validChunks.push({
        text: rawText,
        timestamp: [parseFloat(start.toFixed(3)), parseFloat(end.toFixed(3))],
      });
    }

    return {
      text: fullText,
      words,
      chunks: validChunks,
    };
  }

  /**
   * End-to-end clip transcription: converts clip audio to 16kHz mono, runs Whisper,
   * partitions into natural sentences and speech segments.
   */
  public async transcribeClip(
    clip: VideoClip,
    options: {
      language?: string;
      onProgress?: WhisperProgressCallback;
    } = {}
  ): Promise<SpeechTranscriptionResult> {
    const { pcm, duration } = await extract16kMonoPcm(clip, options.onProgress);
    if (pcm.length === 0) {
      return {
        segments: [],
        fullText: '',
        totalDuration: clip.duration,
        speechDuration: 0,
        silenceDuration: clip.duration,
      };
    }

    options.onProgress?.(15, `${(pcm.length / 16000).toFixed(1)} saniye ses hazırlandı, Whisper modeli yükleniyor...`);

    const { text, words } = await this.transcribePcm(pcm, {
      language: options.language || 'turkish',
      onProgress: options.onProgress,
    });

    options.onProgress?.(96, 'Konuşma segmentleri ve cümle yapıları oluşturuluyor...');

    // Group words into natural sentence-based segments (by punctuation or 0.4s pauses)
    const segments: SpeechSegment[] = [];
    let currentWords: TimestampedWord[] = [];

    const commitSegment = () => {
      if (currentWords.length === 0) return;
      const segStart = currentWords[0].startSec;
      const segEnd = currentWords[currentWords.length - 1].endSec;
      const segText = currentWords.map((w) => w.word).join(' ');
      const segDuration = Math.max(0.1, segEnd - segStart);

      segments.push({
        id: `whisper-seg-${clip.id}-${segments.length}-${Math.round(segStart * 100)}`,
        startSec: parseFloat(segStart.toFixed(3)),
        endSec: parseFloat(segEnd.toFixed(3)),
        duration: parseFloat(segDuration.toFixed(3)),
        energy: 0.85,
        confidence: 0.95,
        text: segText,
        words: [...currentWords],
      });
      currentWords = [];
    };

    for (let i = 0; i < words.length; i++) {
      const w = words[i];
      const prevW = i > 0 ? words[i - 1] : null;

      const pauseBefore = prevW ? w.startSec - prevW.endSec : 0;
      const endsWithPunctuation = /[.!?]$/.test(w.word);

      currentWords.push(w);

      if (endsWithPunctuation || pauseBefore >= 0.42 || currentWords.length >= 10) {
        commitSegment();
      }
    }

    commitSegment();

    let speechDuration = 0;
    segments.forEach((s) => (speechDuration += s.duration));
    const silenceDuration = Math.max(0, clip.duration - speechDuration);

    options.onProgress?.(100, 'Whisper transkripsiyonu tamamlandı!');

    return {
      segments,
      fullText: text || segments.map((s) => s.text).join(' '),
      totalDuration: parseFloat(clip.duration.toFixed(3)),
      speechDuration: parseFloat(speechDuration.toFixed(3)),
      silenceDuration: parseFloat(silenceDuration.toFixed(3)),
    };
  }
}

export const inBrowserWhisperEngine = new InBrowserWhisperEngine();

/**
 * FORMA Video Editor — Built-in SFX & Audio Synthesizer
 * 100% Client-side procedural sound effect and background music generator
 * Produces standard WAV blobs with zero external downloads or copyright restrictions
 */

export type SfxType =
  | 'whoosh'
  | 'ding'
  | 'pop'
  | 'shutter'
  | 'typewriter'
  | 'bass-drop'
  | 'lofi-chord';

export interface BuiltinSfxItem {
  id: SfxType;
  name: string;
  category: 'sfx' | 'bgm';
  icon: string;
  duration: number;
  description: string;
}

export const BUILTIN_SFX_LIST: BuiltinSfxItem[] = [
  {
    id: 'whoosh',
    name: 'Hızlı Geçiş (Woosh)',
    category: 'sfx',
    icon: '💨',
    duration: 0.45,
    description: 'Klip ve sahne geçişleri için dinamik hava süpürme sesi',
  },
  {
    id: 'ding',
    name: 'Başarı / Tamam (Chime)',
    category: 'sfx',
    icon: '✨',
    duration: 1.2,
    description: 'Önemli vurgular ve tamamlanma anları için parlak kristal zil',
  },
  {
    id: 'pop',
    name: 'Baloncuk / Bildirim (Pop)',
    category: 'sfx',
    icon: '🫧',
    duration: 0.16,
    description: 'Yazı ve ikon animasyonları için tatlı bildirim sesi',
  },
  {
    id: 'shutter',
    name: 'Kamera Deklanşör',
    category: 'sfx',
    icon: '📷',
    duration: 0.28,
    description: 'Fotoğraf çekimi ve donma anları için mekanik deklanşör',
  },
  {
    id: 'typewriter',
    name: 'Daktilo Tuşu (Click)',
    category: 'sfx',
    icon: '⌨️',
    duration: 0.08,
    description: 'Metin belirme ve başlık animasyonları için mekanik tıkırtı',
  },
  {
    id: 'bass-drop',
    name: 'Sinematik Vuruş (Bass Impact)',
    category: 'sfx',
    icon: '💥',
    duration: 2.2,
    description: 'Dramatik sahne girişleri için derin bas darbesi ve yankı',
  },
  {
    id: 'lofi-chord',
    name: 'Lofi Piyano Fonu (Warm Chill)',
    category: 'bgm',
    icon: '🎹',
    duration: 6.4,
    description: 'Arka plan için rahatlatıcı 4 akorlu elektrik piyano döngüsü',
  },
];

/**
 * Encodes an AudioBuffer into an uncompressed 16-bit PCM WAV Blob
 */
export function audioBufferToWavBlob(buffer: AudioBuffer): Blob {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // PCM
  const bitDepth = 16;
  const numFrames = buffer.length;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numFrames * blockAlign;
  const bufferSize = 44 + dataSize;

  const arrayBuffer = new ArrayBuffer(bufferSize);
  const view = new DataView(arrayBuffer);

  // Write ASCII string helper
  const writeString = (offset: number, string: string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  // RIFF Header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  // fmt Subchunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // Subchunk1Size (16 for PCM)
  view.setUint16(20, format, true); // AudioFormat
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);

  // data Subchunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Write interleaved PCM samples
  const channelData: Float32Array[] = [];
  for (let ch = 0; ch < numChannels; ch++) {
    channelData.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < numFrames; i++) {
    for (let ch = 0; ch < numChannels; ch++) {
      let sample = channelData[ch][i];
      // Clamping between -1 and 1
      sample = Math.max(-1, Math.min(1, sample));
      // Convert to 16-bit signed integer (-32768 to 32767)
      const intSample = sample < 0 ? sample * 32768 : sample * 32767;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([arrayBuffer], { type: 'audio/wav' });
}

/**
 * Procedurally generates audio and returns a WAV Blob
 */
export async function generateSfxBlob(type: SfxType): Promise<Blob> {
  const sampleRate = 44100;
  let duration = 0.5;

  const item = BUILTIN_SFX_LIST.find((s) => s.id === type);
  if (item) duration = item.duration;

  const length = Math.ceil(sampleRate * duration);
  const OfflineCtx = (window as any).OfflineAudioContext || (window as any).webkitOfflineAudioContext;
  if (!OfflineCtx) {
    throw new Error('OfflineAudioContext is not supported in this browser.');
  }

  const ctx = new OfflineCtx(2, length, sampleRate);

  if (type === 'whoosh') {
    // Filtered noise with frequency sweep
    const bufferSize = length;
    const noiseBuffer = ctx.createBuffer(1, bufferSize, sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = Math.random() * 2 - 1;
    }

    const whiteNoise = ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 3.0;
    filter.frequency.setValueAtTime(150, 0);
    filter.frequency.exponentialRampToValueAtTime(2600, duration * 0.45);
    filter.frequency.exponentialRampToValueAtTime(180, duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.001, 0);
    gain.gain.linearRampToValueAtTime(0.85, duration * 0.4);
    gain.gain.exponentialRampToValueAtTime(0.001, duration);

    whiteNoise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    whiteNoise.start(0);
  } else if (type === 'ding') {
    // Crystal bell sine harmonics
    const fundamental = 880; // A5
    const harmonics = [1, 2.76, 5.4, 8.9];
    const gains = [0.6, 0.25, 0.1, 0.05];

    harmonics.forEach((h, idx) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(fundamental * h, 0);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(gains[idx], 0);
      gain.gain.exponentialRampToValueAtTime(0.0001, duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(0);
      osc.stop(duration);
    });
  } else if (type === 'pop') {
    // Bubble pop frequency sweep
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(350, 0);
    osc.frequency.exponentialRampToValueAtTime(950, duration * 0.7);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.9, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(0);
    osc.stop(duration);
  } else if (type === 'shutter') {
    // Double camera click
    const createClick = (startTime: number, pitch: number) => {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(pitch, startTime);
      osc.frequency.exponentialRampToValueAtTime(120, startTime + 0.05);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(0.7, startTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.07);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.08);
    };

    createClick(0, 1800);
    createClick(0.12, 1400);
  } else if (type === 'typewriter') {
    // Mechanical key tick
    const osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(1200, 0);
    osc.frequency.exponentialRampToValueAtTime(80, duration);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.8, 0);
    gain.gain.exponentialRampToValueAtTime(0.001, duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(0);
    osc.stop(duration);
  } else if (type === 'bass-drop') {
    // Cinematic Sub Bass Drop
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, 0);
    osc.frequency.exponentialRampToValueAtTime(32, duration * 0.85);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.95, 0);
    gain.gain.linearRampToValueAtTime(0.85, 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(0);
    osc.stop(duration);
  } else if (type === 'lofi-chord') {
    // 4-chord electric piano progression: Fmaj7 -> Em7 -> Dm7 -> Cmaj7
    const chords = [
      [349.23, 440.0, 523.25, 659.25], // F4, A4, C5, E5
      [329.63, 392.0, 493.88, 587.33], // E4, G4, B4, D5
      [293.66, 349.23, 440.0, 523.25], // D4, F4, A4, C5
      [261.63, 329.63, 392.0, 493.88], // C4, E4, G4, B4
    ];

    const chordDuration = duration / chords.length;

    chords.forEach((chord, chordIdx) => {
      const chordStart = chordIdx * chordDuration;
      chord.forEach((freq) => {
        const osc = ctx.createOscillator();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, chordStart);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.001, chordStart);
        gain.gain.linearRampToValueAtTime(0.18, chordStart + 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, chordStart + chordDuration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(chordStart);
        osc.stop(chordStart + chordDuration);
      });
    });
  }

  const renderedBuffer = await ctx.startRendering();
  return audioBufferToWavBlob(renderedBuffer);
}

/**
 * Quick preview player using AudioContext
 */
let previewAudioElement: HTMLAudioElement | null = null;
export async function playSfxPreview(type: SfxType): Promise<void> {
  try {
    if (previewAudioElement) {
      previewAudioElement.pause();
      previewAudioElement.currentTime = 0;
    }
    const blob = await generateSfxBlob(type);
    const url = URL.createObjectURL(blob);
    previewAudioElement = new Audio(url);
    previewAudioElement.onended = () => URL.revokeObjectURL(url);
    await previewAudioElement.play();
  } catch (err) {
    console.warn('Failed to preview SFX:', err);
  }
}

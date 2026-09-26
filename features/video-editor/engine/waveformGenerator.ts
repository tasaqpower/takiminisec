/**
 * FORMA Video Editor — Audio Waveform Generator
 * Decodes audio track into normalized peak amplitudes for timeline visualization
 */

let sharedAudioContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioContext || sharedAudioContext.state === 'closed') {
    sharedAudioContext = new AudioCtx();
  }
  return sharedAudioContext;
}

export async function generateWaveformPeaks(
  source: Blob | File | ArrayBuffer,
  targetPoints: number = 200
): Promise<number[]> {
  const ctx = getAudioContext();
  if (!ctx) return [];

  let arrayBuffer: ArrayBuffer;
  if (source instanceof ArrayBuffer) {
    arrayBuffer = source;
  } else {
    arrayBuffer = await source.arrayBuffer();
  }

  try {
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const channelData = audioBuffer.getChannelData(0); // Primary mono/left channel
    const totalSamples = channelData.length;
    const blockSize = Math.floor(totalSamples / targetPoints);

    if (blockSize <= 0) return [];

    const peaks: number[] = new Array(targetPoints);

    for (let i = 0; i < targetPoints; i++) {
      const start = i * blockSize;
      let max = 0;
      for (let j = 0; j < blockSize; j++) {
        const val = Math.abs(channelData[start + j]);
        if (val > max) max = val;
      }
      peaks[i] = Math.min(1.0, max);
    }

    return peaks;
  } catch (err) {
    console.warn('Failed to decode audio for waveform:', err);
    return [];
  }
}

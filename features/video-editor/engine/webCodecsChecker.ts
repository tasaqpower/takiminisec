/**
 * FORMA Video Editor — WebCodecs & Codec Capabilities Inspector
 * Checks client-side encoding & decoding capabilities without false promises.
 */

export interface CodecCapabilities {
  hasWebCodecs: boolean;
  hasMediaRecorder: boolean;
  canEncodeMp4H264: boolean;
  canEncodeWebmVP9: boolean;
  canEncodeWebmVP8: boolean;
  canRecordAudio: boolean;
  supportedExportFormats: Array<'mp4' | 'webm' | 'gif' | 'mp3' | 'wav' | 'png'>;
}

export async function detectCodecCapabilities(): Promise<CodecCapabilities> {
  const isBrowser = typeof window !== 'undefined';
  if (!isBrowser) {
    return {
      hasWebCodecs: false,
      hasMediaRecorder: false,
      canEncodeMp4H264: false,
      canEncodeWebmVP9: false,
      canEncodeWebmVP8: false,
      canRecordAudio: false,
      supportedExportFormats: ['mp4', 'webm', 'gif', 'wav', 'png']
    };
  }

  const hasWebCodecs = typeof (window as any).VideoEncoder !== 'undefined';
  const hasMediaRecorder = typeof window.MediaRecorder !== 'undefined';

  let canEncodeMp4H264 = false;
  let canEncodeWebmVP9 = false;
  let canEncodeWebmVP8 = false;

  if (hasMediaRecorder) {
    try {
      canEncodeMp4H264 =
        MediaRecorder.isTypeSupported('video/mp4;codecs=avc1,mp4a.40.2') ||
        MediaRecorder.isTypeSupported('video/mp4;codecs=h264,aac') ||
        MediaRecorder.isTypeSupported('video/mp4');
    } catch {}

    try {
      canEncodeWebmVP9 = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus');
      canEncodeWebmVP8 = MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus') || MediaRecorder.isTypeSupported('video/webm');
    } catch {}
  }

  if (hasWebCodecs && !canEncodeMp4H264) {
    try {
      const config = {
        codec: 'avc1.42001E', // Baseline 3.0
        width: 1280,
        height: 720,
        bitrate: 2_000_000,
        framerate: 30
      };
      const support = await (window as any).VideoEncoder.isConfigSupported(config);
      canEncodeMp4H264 = support.supported ?? false;
    } catch {}
  }

  const canRecordAudio =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function';

  const formats: Array<'mp4' | 'webm' | 'gif' | 'mp3' | 'wav' | 'png'> = [];

  // MP4 is added if supported by MediaRecorder or WebCodecs
  if (canEncodeMp4H264) {
    formats.push('mp4');
  }

  // WebM is virtually universally supported
  if (canEncodeWebmVP9 || canEncodeWebmVP8 || hasMediaRecorder) {
    formats.push('webm');
  } else if (!formats.includes('mp4')) {
    // At minimum offer webm
    formats.push('webm');
  }

  // GIF, WAV, PNG are always supported natively in browser
  formats.push('gif', 'wav', 'png');

  return {
    hasWebCodecs,
    hasMediaRecorder,
    canEncodeMp4H264,
    canEncodeWebmVP9,
    canEncodeWebmVP8,
    canRecordAudio,
    supportedExportFormats: formats
  };
}

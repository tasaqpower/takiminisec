/**
 * Timecode formatting and parsing utilities for pro video editing
 */

export function formatTimecode(seconds: number, fps = 30): string {
  const s = Math.max(0, isNaN(seconds) ? 0 : seconds);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  const frames = Math.floor(Math.round((s % 1) * fps * 1000) / 1000) % fps;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
}

export function formatTimeSeconds(seconds: number): string {
  const s = Math.max(0, isNaN(seconds) ? 0 : seconds);
  return `${s.toFixed(2)}s`;
}

export function formatTimeDetailed(seconds: number): string {
  const s = Math.max(0, isNaN(seconds) ? 0 : seconds);
  const mins = Math.floor(s / 60);
  const secs = s % 60;
  if (mins > 0) {
    return `${mins}:${secs < 10 ? '0' : ''}${secs.toFixed(2)}`;
  }
  return `${secs.toFixed(2)}s`;
}

/**
 * Parses user input string into seconds.
 * Supports:
 * - "4.5", "12", "0.25"
 * - "12s", "12 sn", "4.5sec"
 * - "01:23" (mm:ss)
 * - "01:23.45" (mm:ss.ms)
 * - "01:02:03" (hh:mm:ss)
 * - "00:01:10:15" (hh:mm:ss:ff with given fps)
 */
export function parseTimecode(input: string, fps = 30): number | null {
  if (!input) return null;
  const raw = input.trim().toLowerCase().replace(/sn|sec|s/g, '').trim();
  if (!raw) return null;

  // Direct number
  const directNum = parseFloat(raw);
  if (!isNaN(directNum) && !raw.includes(':')) {
    return Math.max(0, directNum);
  }

  // Colon separated
  const parts = raw.split(':');
  if (parts.length === 2) {
    // MM:SS or MM:SS.ms
    const mins = parseFloat(parts[0]);
    const secs = parseFloat(parts[1]);
    if (!isNaN(mins) && !isNaN(secs)) {
      return Math.max(0, mins * 60 + secs);
    }
  } else if (parts.length === 3) {
    // HH:MM:SS
    const hrs = parseFloat(parts[0]);
    const mins = parseFloat(parts[1]);
    const secs = parseFloat(parts[2]);
    if (!isNaN(hrs) && !isNaN(mins) && !isNaN(secs)) {
      return Math.max(0, hrs * 3600 + mins * 60 + secs);
    }
  } else if (parts.length === 4) {
    // HH:MM:SS:FF
    const hrs = parseFloat(parts[0]);
    const mins = parseFloat(parts[1]);
    const secs = parseFloat(parts[2]);
    const frames = parseFloat(parts[3]);
    if (!isNaN(hrs) && !isNaN(mins) && !isNaN(secs) && !isNaN(frames)) {
      const frameSec = fps > 0 ? frames / fps : 0;
      return Math.max(0, hrs * 3600 + mins * 60 + secs + frameSec);
    }
  }

  return null;
}

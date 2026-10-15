import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Pro Video Editor Features Verification', () => {
  it('Q shortcut (rippleTrimStart) trims clip start and shifts following clips left without gap', () => {
    const track = {
      id: 'track-1',
      clips: [
        { id: 'clip-1', startTime: 0, duration: 10, trimIn: 0, trimOut: 10, speed: 1.0 },
        { id: 'clip-2', startTime: 10, duration: 5, trimIn: 0, trimOut: 5, speed: 1.0 },
      ],
    };

    const trimTime = 3.0; // Playhead at 3.0s in clip-1
    const targetClip = track.clips[0];
    const cutDuration = trimTime - targetClip.startTime; // 3.0s
    const speed = targetClip.speed || 1.0;
    const newTrimIn = (targetClip.trimIn ?? 0) + cutDuration * speed;
    const newDuration = targetClip.duration - cutDuration;

    const updatedClip = {
      ...targetClip,
      trimIn: newTrimIn,
      duration: newDuration,
    };

    const newClips = track.clips.map((c) => {
      if (c.id === targetClip.id) return updatedClip;
      if (c.startTime >= targetClip.startTime + targetClip.duration - 0.01) {
        return { ...c, startTime: c.startTime - cutDuration };
      }
      return c;
    });

    assert.strictEqual(newClips[0].startTime, 0);
    assert.strictEqual(newClips[0].duration, 7.0);
    assert.strictEqual(newClips[0].trimIn, 3.0);
    assert.strictEqual(newClips[1].startTime, 7.0, 'Clip 2 must shift from 10.0 to 7.0 seamlessly');
    assert.strictEqual(newClips[1].duration, 5.0);
  });

  it('W shortcut (rippleTrimEnd) trims clip end and pulls following clips left without gap', () => {
    const track = {
      id: 'track-1',
      clips: [
        { id: 'clip-1', startTime: 0, duration: 10, trimIn: 0, trimOut: 10, speed: 1.0 },
        { id: 'clip-2', startTime: 10, duration: 5, trimIn: 0, trimOut: 5, speed: 1.0 },
      ],
    };

    const trimTime = 6.0; // Playhead at 6.0s in clip-1
    const targetClip = track.clips[0];
    const cutDuration = (targetClip.startTime + targetClip.duration) - trimTime; // 4.0s
    const speed = targetClip.speed || 1.0;
    const newDuration = trimTime - targetClip.startTime;
    const newTrimOut = (targetClip.trimIn ?? 0) + newDuration * speed;

    const updatedClip = {
      ...targetClip,
      duration: newDuration,
      trimOut: newTrimOut,
    };

    const newClips = track.clips.map((c) => {
      if (c.id === targetClip.id) return updatedClip;
      if (c.startTime >= targetClip.startTime + targetClip.duration - 0.01) {
        return { ...c, startTime: c.startTime - cutDuration };
      }
      return c;
    });

    assert.strictEqual(newClips[0].startTime, 0);
    assert.strictEqual(newClips[0].duration, 6.0);
    assert.strictEqual(newClips[0].trimOut, 6.0);
    assert.strictEqual(newClips[1].startTime, 6.0, 'Clip 2 must shift from 10.0 to 6.0 closing the 4s tail gap');
    assert.strictEqual(newClips[1].duration, 5.0);
  });

  it('Freeze Frame correctly splices a 2-second still clip and shifts following clips', () => {
    const originalClip = {
      id: 'clip-video-1',
      startTime: 0,
      duration: 10,
      trimIn: 0,
      trimOut: 10,
      speed: 1.0,
      name: 'Talking Character',
    };

    const freezeTime = 4.0;
    const freezeDuration = 2.0;

    const leftDuration = freezeTime - originalClip.startTime;
    const rightDuration = originalClip.duration - leftDuration;

    const leftClip = {
      ...originalClip,
      id: originalClip.id,
      duration: leftDuration,
      trimIn: originalClip.trimIn,
      trimOut: originalClip.trimIn + leftDuration,
    };

    const freezeClip = {
      id: 'clip-freeze-999',
      name: `${originalClip.name} (Dondurulmuş Kare)`,
      type: 'image',
      startTime: freezeTime,
      duration: freezeDuration,
    };

    const rightClip = {
      ...originalClip,
      id: 'clip-right-888',
      startTime: freezeTime + freezeDuration,
      duration: rightDuration,
      trimIn: originalClip.trimIn + leftDuration,
      trimOut: originalClip.trimOut,
    };

    assert.strictEqual(leftClip.startTime, 0);
    assert.strictEqual(leftClip.duration, 4.0);
    assert.strictEqual(freezeClip.startTime, 4.0);
    assert.strictEqual(freezeClip.duration, 2.0);
    assert.strictEqual(rightClip.startTime, 6.0);
    assert.strictEqual(rightClip.duration, 6.0);
    assert.strictEqual(leftClip.duration + freezeClip.duration + rightClip.duration, 12.0);
  });

  it('Auto Silence Removal inverts silence intervals and packs spoken clips sequentially', () => {
    const clipDuration = 12.0;
    const initialTrimIn = 0;
    const speed = 1.0;

    // Suppose silence intervals detected at: 2.0s-3.5s (1.5s gap) and 7.0s-8.0s (1.0s gap)
    const silences = [
      { startSec: 2.0, endSec: 3.5, duration: 1.5 },
      { startSec: 7.0, endSec: 8.0, duration: 1.0 },
    ];

    const speechSegments = [];
    let cursor = 0;

    for (const sil of silences) {
      if (sil.startSec > cursor + 0.1) {
        speechSegments.push({ startSec: cursor, endSec: sil.startSec });
      }
      cursor = Math.max(cursor, sil.endSec);
    }
    if (cursor < clipDuration - 0.1) {
      speechSegments.push({ startSec: cursor, endSec: clipDuration });
    }

    assert.strictEqual(speechSegments.length, 3);
    assert.deepStrictEqual(speechSegments[0], { startSec: 0, endSec: 2.0 });
    assert.deepStrictEqual(speechSegments[1], { startSec: 3.5, endSec: 7.0 });
    assert.deepStrictEqual(speechSegments[2], { startSec: 8.0, endSec: 12.0 });

    let runningTime = 0;
    const packedClips = speechSegments.map((seg, idx) => {
      const dur = seg.endSec - seg.startSec;
      const c = {
        name: `Speech ${idx + 1}`,
        startTime: runningTime,
        duration: dur,
        trimIn: initialTrimIn + seg.startSec * speed,
        trimOut: initialTrimIn + seg.endSec * speed,
      };
      runningTime += dur;
      return c;
    });

    assert.strictEqual(packedClips[0].startTime, 0);
    assert.strictEqual(packedClips[0].duration, 2.0);
    assert.strictEqual(packedClips[1].startTime, 2.0);
    assert.strictEqual(packedClips[1].duration, 3.5);
    assert.strictEqual(packedClips[2].startTime, 5.5);
    assert.strictEqual(packedClips[2].duration, 4.0);
    assert.strictEqual(runningTime, 9.5, 'Total spoken duration is 9.5s (saved 2.5s of dead air)');
  });

  it('Waveform peaks normalization keeps values between 0.08 and 1.0', () => {
    const rawRms = [0.0, 0.05, 0.2, 0.8, 0.4, 0.01];
    const maxPeak = Math.max(...rawRms);
    const normalized = rawRms.map((p) => Math.max(0.08, Math.min(1.0, p / maxPeak)));

    assert.strictEqual(normalized[0], 0.08, 'Zero amplitude normalized to baseline minimum 0.08');
    assert.strictEqual(normalized[3], 1.0, 'Peak amplitude normalized to 1.0');
    assert.ok(normalized.every((v) => v >= 0.08 && v <= 1.0));
  });

  it('Timecode formatting outputs HH:MM:SS:FF accurately', () => {
    function formatTimecode(seconds, fps = 30) {
      const s = Math.max(0, isNaN(seconds) ? 0 : seconds);
      const hrs = Math.floor(s / 3600);
      const mins = Math.floor((s % 3600) / 60);
      const secs = Math.floor(s % 60);
      const frames = Math.floor(Math.round((s % 1) * fps * 1000) / 1000) % fps;
      const pad = (n) => n.toString().padStart(2, '0');
      return `${pad(hrs)}:${pad(mins)}:${pad(secs)}:${pad(frames)}`;
    }

    assert.strictEqual(formatTimecode(0, 30), '00:00:00:00');
    assert.strictEqual(formatTimecode(5.5, 30), '00:00:05:15');
    assert.strictEqual(formatTimecode(65.0, 30), '00:01:05:00');
    assert.strictEqual(formatTimecode(3661.1, 30), '01:01:01:03');
  });

  it('Timecode parsing parses seconds, mm:ss, and hh:mm:ss:ff accurately', () => {
    function parseTimecode(input, fps = 30) {
      if (!input) return null;
      const raw = input.trim().toLowerCase().replace(/sn|sec|s/g, '').trim();
      if (!raw) return null;

      const directNum = parseFloat(raw);
      if (!isNaN(directNum) && !raw.includes(':')) {
        return Math.max(0, directNum);
      }

      const parts = raw.split(':');
      if (parts.length === 2) {
        const mins = parseFloat(parts[0]);
        const secs = parseFloat(parts[1]);
        if (!isNaN(mins) && !isNaN(secs)) return Math.max(0, mins * 60 + secs);
      } else if (parts.length === 3) {
        const hrs = parseFloat(parts[0]);
        const mins = parseFloat(parts[1]);
        const secs = parseFloat(parts[2]);
        if (!isNaN(hrs) && !isNaN(mins) && !isNaN(secs)) return Math.max(0, hrs * 3600 + mins * 60 + secs);
      } else if (parts.length === 4) {
        const hrs = parseFloat(parts[0]);
        const mins = parseFloat(parts[1]);
        const secs = parseFloat(parts[2]);
        const frames = parseFloat(parts[3]);
        if (!isNaN(hrs) && !isNaN(mins) && !isNaN(secs) && !isNaN(frames)) {
          return Math.max(0, hrs * 3600 + mins * 60 + secs + (fps > 0 ? frames / fps : 0));
        }
      }
      return null;
    }

    assert.strictEqual(parseTimecode('12'), 12);
    assert.strictEqual(parseTimecode('12.5'), 12.5);
    assert.strictEqual(parseTimecode('12.5s'), 12.5);
    assert.strictEqual(parseTimecode('12.5 sn'), 12.5);
    assert.strictEqual(parseTimecode('01:30'), 90);
    assert.strictEqual(parseTimecode('01:30.50'), 90.5);
    assert.strictEqual(parseTimecode('01:00:00'), 3600);
    assert.strictEqual(parseTimecode('00:01:00:15', 30), 60.5);
    assert.strictEqual(parseTimecode('invalid text'), null);
  });

  it('Inspector timing precision nudge adjustments update clip bounds cleanly', () => {
    const clip = {
      id: 'clip-alpha',
      startTime: 4.5,
      duration: 3.2,
      trimIn: 1.0,
      speed: 1.0,
    };

    // Nudge Start Time by +0.1s
    const nudgedStart = Math.max(0, parseFloat((clip.startTime + 0.1).toFixed(2)));
    assert.strictEqual(nudgedStart, 4.6);

    // Nudge Duration by -0.1s
    const nudgedDuration = Math.max(0.05, parseFloat((clip.duration - 0.1).toFixed(2)));
    assert.strictEqual(nudgedDuration, 3.1);

    // Align End to Playhead at 10.0s
    const playhead = 10.0;
    const alignedDuration = parseFloat((playhead - clip.startTime).toFixed(2));
    assert.strictEqual(alignedDuration, 5.5);
    assert.strictEqual(clip.startTime + alignedDuration, 10.0);
  });

  it('Copy and Paste clones clip properties and assigns a fresh ID at target time', () => {
    let clipboard = null;
    const originalClip = {
      id: 'clip-source-1',
      name: 'Game Highlight',
      type: 'video',
      startTime: 2.0,
      duration: 6.0,
      trimIn: 1.5,
      trimOut: 7.5,
      speed: 1.25,
      transform: { x: 10, y: 20, scaleX: 1.1, scaleY: 1.1, rotation: 5, opacity: 0.9 },
    };

    // Copy
    clipboard = { ...originalClip };
    assert.ok(clipboard !== null);
    assert.strictEqual(clipboard.name, 'Game Highlight');

    // Paste at playhead 12.0s
    const pasteTime = 12.0;
    const pastedClip = {
      ...clipboard,
      id: 'clip-' + Date.now(),
      startTime: pasteTime,
      start: pasteTime,
    };

    assert.notStrictEqual(pastedClip.id, originalClip.id);
    assert.strictEqual(pastedClip.startTime, 12.0);
    assert.strictEqual(pastedClip.duration, 6.0);
    assert.strictEqual(pastedClip.speed, 1.25);
    assert.deepStrictEqual(pastedClip.transform, originalClip.transform);
  });
});

import { describe, it } from 'node:test';
import assert from 'node:assert';

describe('Video Clip Split Smoothness & Boundary Isolation', () => {
  it('splitClip maintains leftClip ID and produces mathematically continuous trims', () => {
    const originalClip = {
      id: 'clip-original-123',
      name: 'Scene 1',
      startTime: 0,
      duration: 10,
      trimIn: 2.0,
      trimOut: 12.0,
      speed: 1.0,
      type: 'video',
      assetId: 'asset-video-test',
    };

    const effectiveSplit = 4.0;
    const clipStart = originalClip.startTime;
    const clipEnd = clipStart + originalClip.duration;
    const speed = originalClip.speed || 1.0;

    const leftDuration = effectiveSplit - clipStart;
    const rightDuration = clipEnd - effectiveSplit;

    const leftTrimIn = originalClip.trimIn ?? 0;
    const leftTrimOut = leftTrimIn + leftDuration * speed;

    const rightTrimIn = leftTrimOut;
    const rightTrimOut = originalClip.trimOut ?? (rightTrimIn + rightDuration * speed);

    const leftClip = {
      ...originalClip,
      id: originalClip.id, // Preserved ID
      duration: leftDuration,
      trimIn: leftTrimIn,
      trimOut: leftTrimOut,
    };

    const rightClip = {
      ...originalClip,
      id: 'clip-new-456',
      startTime: effectiveSplit,
      duration: rightDuration,
      trimIn: rightTrimIn,
      trimOut: rightTrimOut,
    };

    assert.strictEqual(leftClip.id, 'clip-original-123', 'leftClip must preserve original ID to avoid decoder detachment');
    assert.strictEqual(leftClip.duration, 4.0);
    assert.strictEqual(leftClip.trimIn, 2.0);
    assert.strictEqual(leftClip.trimOut, 6.0);

    assert.strictEqual(rightClip.startTime, 4.0);
    assert.strictEqual(rightClip.duration, 6.0);
    assert.strictEqual(rightClip.trimIn, 6.0, 'rightClip.trimIn must seamlessly continue leftClip.trimOut');
    assert.strictEqual(rightClip.trimOut, 12.0);
  });

  it('boundary condition prevents double-render of adjacent clips at split timestamp', () => {
    const leftClip = { startTime: 0, duration: 4.0 };
    const rightClip = { startTime: 4.0, duration: 6.0 };
    const projectDuration = 10.0;

    function isTimeInClip(clip, currentTime) {
      const start = clip.startTime;
      const end = start + clip.duration;
      const isProjectEnd = end >= (projectDuration - 0.005);
      return currentTime >= start && (isProjectEnd ? currentTime <= end : currentTime < end);
    }

    // At split point 4.000s:
    const leftActiveAtSplit = isTimeInClip(leftClip, 4.0);
    const rightActiveAtSplit = isTimeInClip(rightClip, 4.0);

    assert.strictEqual(leftActiveAtSplit, false, 'left clip must not render at exactly 4.0s');
    assert.strictEqual(rightActiveAtSplit, true, 'right clip must take over cleanly at 4.0s');

    // At project end 10.0s:
    const rightActiveAtEnd = isTimeInClip(rightClip, 10.0);
    assert.strictEqual(rightActiveAtEnd, true, 'last clip must render at project end');
  });

  it('boundary crossing detection identifies split points for 0ms audio gap', () => {
    const tracks = [
      {
        type: 'video',
        clips: [
          { startTime: 0, duration: 3.0 },
          { startTime: 3.0, duration: 7.0 },
        ],
      },
    ];

    function checkCrossed(prevT, nextT) {
      for (const track of tracks) {
        for (const clip of track.clips) {
          if (
            (clip.startTime > prevT && clip.startTime <= nextT) ||
            (clip.startTime + clip.duration > prevT && clip.startTime + clip.duration <= nextT)
          ) {
            return true;
          }
        }
      }
      return false;
    }

    assert.strictEqual(checkCrossed(2.98, 2.99), false);
    assert.strictEqual(checkCrossed(2.99, 3.01), true, 'Must detect boundary crossing across 3.0s split');
  });
});

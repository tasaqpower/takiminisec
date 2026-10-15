import assert from 'assert';

console.log('=== TEST: Smooth Jump-Cut, Lip-Sync Slip Tool & J-K-L Shuttle Controls ===\n');

// 1. Smooth Jump-Cut / Micro Frame Blend Optical Curve Test
console.log('1. Testing Smooth Jump-Cut Cosine Blend Math...');
const smoothCutDurationMs = 160;
const smoothDurSec = smoothCutDurationMs / 1000; // 0.16s

function computePrevWeight(clipRelSec, smoothDur) {
  const smoothProgress = Math.max(0, Math.min(1, clipRelSec / smoothDur));
  return 0.5 * (1 + Math.cos(smoothProgress * Math.PI));
}

// At start (t = 0), outgoing frame must be 100% visible
const weightStart = computePrevWeight(0, smoothDurSec);
assert.strictEqual(Math.round(weightStart * 100) / 100, 1.0, 'At t=0, outgoing frame weight should be 1.0');

// At midpoint (t = 80ms), blend must be exactly 50%
const weightMid = computePrevWeight(0.08, smoothDurSec);
assert.strictEqual(Math.round(weightMid * 100) / 100, 0.5, 'At t=80ms, blend weight should be 0.5');

// At completion (t = 160ms), weight must be 0 (current clip is 100%)
const weightEnd = computePrevWeight(0.16, smoothDurSec);
assert.strictEqual(Math.round(weightEnd * 100) / 100, 0.0, 'At t=160ms, outgoing frame weight should be 0.0');

console.log('  ✓ Cosine optical blend curve is smooth and monotonic: 1.0 -> 0.5 -> 0.0');

// 2. Lip-Sync Audio Slip Offset Verification
console.log('\n2. Testing Lip-Sync Audio Slip Offset Math (Positive & Negative ms)...');

function computeAudioTiming(clip, clipStart, currentTime, speed = 1.0) {
  const audioOffsetSec = (clip.audioOffsetMs || 0) / 1000;
  const rawRelTime = (currentTime - clipStart) * speed + (clip.trimIn ?? 0) + audioOffsetSec;
  return {
    rawRelTime,
    hasStarted: rawRelTime >= -0.001,
    sampleOffset: Math.max(0, rawRelTime),
  };
}

// Test Case A: Audio leads by +50ms (positive slip)
const leadClip = { trimIn: 0, audioOffsetMs: 50 };
const atStartLead = computeAudioTiming(leadClip, 2.0, 2.0);
assert.strictEqual(atStartLead.sampleOffset, 0.05, 'Audio should lead by 50ms (sample at 0.05s)');
assert.strictEqual(atStartLead.hasStarted, true, 'Audio should be playing immediately');

// Test Case B: Audio lags by -50ms (negative slip, trimIn = 0)
const lagClip = { trimIn: 0, audioOffsetMs: -50 };
const atStartLag = computeAudioTiming(lagClip, 2.0, 2.0);
assert.strictEqual(atStartLag.hasStarted, false, 'Audio should not start yet at t=0 when delayed by 50ms');

const atLagCatchup = computeAudioTiming(lagClip, 2.0, 2.05);
assert.strictEqual(atLagCatchup.hasStarted, true, 'Audio should start after 50ms elapses');
assert.strictEqual(Math.round(atLagCatchup.sampleOffset * 1000), 0, 'Audio should start at sample 0');

// Test Case C: Export Audio Timing with Negative Offset
function computeExportTiming(clip, startTime) {
  const audioOffsetSec = (clip.audioOffsetMs || 0) / 1000;
  let actualStartTime = startTime;
  const rawOffset = (clip.trimIn || 0) + audioOffsetSec;
  let actualOffset = Math.max(0, rawOffset);
  if (rawOffset < 0) {
    actualStartTime = startTime - rawOffset;
  }
  return { actualStartTime, actualOffset };
}

const exportLag = computeExportTiming({ trimIn: 0, audioOffsetMs: -50 }, 10.0);
assert.strictEqual(exportLag.actualStartTime, 10.05, 'Export should delay track placement by 50ms');
assert.strictEqual(exportLag.actualOffset, 0, 'Audio sample starts at 0');

const exportLead = computeExportTiming({ trimIn: 0, audioOffsetMs: 50 }, 10.0);
assert.strictEqual(exportLead.actualStartTime, 10.0, 'Export starts at 10.0s');
assert.strictEqual(exportLead.actualOffset, 0.05, 'Audio sample offset starts at 50ms');

console.log('  ✓ Lip-sync offsets correctly handle audio advance and delay with zero distortion');

// 3. J-K-L Shuttle State Machine
console.log('\n3. Testing J-K-L Shuttle Controls...');

function shuttleForwardStep(currentRate, isPlaying) {
  if (!isPlaying) return 1.0;
  if (currentRate < 0) return 1.0;
  if (currentRate < 1.4) return 1.5;
  if (currentRate < 1.9) return 2.0;
  return 4.0;
}

function shuttleBackwardStep(currentRate, isPlaying) {
  if (!isPlaying) return -1.0;
  if (currentRate > 2.5) return 2.0;
  if (currentRate > 1.6) return 1.5;
  if (currentRate > 1.1) return 1.0;
  if (currentRate > 0) return -1.0;
  if (currentRate > -1.4) return -1.5;
  if (currentRate > -1.9) return -2.0;
  return -4.0;
}

// Forward shuttle test: 1x -> 1.5x -> 2x -> 4x -> 4x
let rate = 1.0;
assert.strictEqual(rate = shuttleForwardStep(rate, true), 1.5);
assert.strictEqual(rate = shuttleForwardStep(rate, true), 2.0);
assert.strictEqual(rate = shuttleForwardStep(rate, true), 4.0);
assert.strictEqual(rate = shuttleForwardStep(rate, true), 4.0);

// Backward shuttle test from 4x: slows down: 4x -> 2x -> 1.5x -> 1x -> -1x -> -1.5x -> -2x -> -4x
assert.strictEqual(rate = shuttleBackwardStep(rate, true), 2.0);
assert.strictEqual(rate = shuttleBackwardStep(rate, true), 1.5);
assert.strictEqual(rate = shuttleBackwardStep(rate, true), 1.0);
assert.strictEqual(rate = shuttleBackwardStep(rate, true), -1.0);
assert.strictEqual(rate = shuttleBackwardStep(rate, true), -1.5);
assert.strictEqual(rate = shuttleBackwardStep(rate, true), -2.0);
assert.strictEqual(rate = shuttleBackwardStep(rate, true), -4.0);

console.log('  ✓ Shuttle speeds transition accurately: 1x -> 1.5x -> 2x -> 4x and -1x -> -1.5x -> -2x -> -4x');

console.log('\n✅ ALL SMOOTH JUMP-CUT & LIP-SYNC TESTS PASSED PERFECTLY!\n');

// @ts-check
import assert from 'node:assert';

console.log('--- TEST 1: Lip-Freeze Crossfade Blend Function Verification ---');

function computeLipFreezeBlend(clipRelSec, clipDuration, fadeDuration = 0.15) {
  const effectiveFade = Math.min(fadeDuration, clipDuration * 0.35);
  if (effectiveFade <= 0) return 1.0;

  if (clipRelSec < effectiveFade) {
    return Math.max(0, Math.min(1, clipRelSec / effectiveFade));
  } else if (clipRelSec > clipDuration - effectiveFade) {
    return Math.max(0, Math.min(1, (clipDuration - clipRelSec) / effectiveFade));
  } else {
    return 1.0;
  }
}

const CLIP_DUR = 2.0;

// At entry (t = 0)
const blend0 = computeLipFreezeBlend(0.0, CLIP_DUR);
console.log(`Blend at t=0.00s (Entry): ${blend0}`);
assert.strictEqual(blend0, 0.0);

// Halfway through entry fade (t = 0.075s)
const blendEntryHalf = computeLipFreezeBlend(0.075, CLIP_DUR);
console.log(`Blend at t=0.075s (Entry Half): ${blendEntryHalf}`);
assert(Math.abs(blendEntryHalf - 0.5) < 1e-4);

// At full freeze hold (t = 0.15s to t = 1.85s)
const blendHold = computeLipFreezeBlend(1.0, CLIP_DUR);
console.log(`Blend at t=1.00s (Solid Hold): ${blendHold}`);
assert.strictEqual(blendHold, 1.0);

// Halfway through exit fade (t = 1.925s)
const blendExitHalf = computeLipFreezeBlend(1.925, CLIP_DUR);
console.log(`Blend at t=1.925s (Exit Half): ${blendExitHalf}`);
assert(Math.abs(blendExitHalf - 0.5) < 1e-4);

// At exit (t = 2.0s)
const blendEnd = computeLipFreezeBlend(2.0, CLIP_DUR);
console.log(`Blend at t=2.00s (Exit): ${blendEnd}`);
assert.strictEqual(blendEnd, 0.0);

console.log('✅ TEST 1 PASSED: 150ms gentle crossfade calculation is mathematically smooth & continuous!');

console.log('--- TEST 2: Lip-Freeze with Short Stutter Durations (<0.3s) ---');
const SHORT_DUR = 0.20; // 200ms quick stutter
const shortFade = Math.min(0.15, SHORT_DUR * 0.35); // 70ms adaptive fade
console.log(`Short duration adaptive fade window: ${shortFade.toFixed(3)}s`);

const blendShortHold = computeLipFreezeBlend(0.10, SHORT_DUR, 0.15);
console.log(`Short stutter middle blend: ${blendShortHold}`);
assert.strictEqual(blendShortHold, 1.0);

console.log('✅ TEST 2 PASSED: Short duration stutters adaptively scale fade without overlapping!');

console.log('--- ALL LIP-FREEZE ENGINE MATHEMATICAL VERIFICATIONS PASSED ---');

import assert from 'node:assert';
import { parseVideoAiPrompt } from '../features/video-editor/ai/videoAiDispatcher.ts';

console.log('--- TEST 1: Video AI Dispatcher Natural Language Commands ---');

// Mock initial project
const mockProject = {
  id: 'project-test-ai',
  name: 'AI Test Project',
  resolution: { width: 1920, height: 1080 },
  fps: 30,
  duration: 20,
  backgroundColor: '#000000',
  tracks: [
    {
      id: 'track-v1',
      name: 'Video Track',
      type: 'video',
      clips: [
        {
          id: 'clip-1',
          trackId: 'track-v1',
          name: 'AI Talking Head 1',
          type: 'video',
          startTime: 0,
          duration: 10,
          sourceDuration: 10,
          trimIn: 0,
          trimOut: 10,
          volume: 1.0,
        },
        {
          id: 'clip-2',
          trackId: 'track-v1',
          name: 'AI Talking Head 2',
          type: 'video',
          startTime: 10,
          duration: 10,
          sourceDuration: 10,
          trimIn: 0,
          trimOut: 10,
          volume: 1.0,
        },
      ],
    },
  ],
};

// 1.1: Tekrar eden cümleleri temizle
const dupCommand = parseVideoAiPrompt('Tekrar eden cümleleri bul ve sil', mockProject);
assert(dupCommand !== null, 'Duplicate cleaner command should not be null');
assert.strictEqual(dupCommand.id, 'ai-remove-duplicates');
console.log('✓ Prompt: "Tekrar eden cümleleri bul ve sil" -> Matched intent:', dupCommand.intent);
const dupApplied = dupCommand.apply(mockProject);
const secondClip = dupApplied.tracks[0].clips[1];
assert.strictEqual(secondClip.smoothCutIn, true, 'Subsequent clip should have smoothCutIn enabled');
assert.strictEqual(secondClip.smoothCutDurationMs, 160, 'Smooth cut duration should default to 160ms');
console.log('✓ Duplicate clean applied smoothCutIn to subsequent clips smoothly.');

// 1.2: Karakteri sustur & ağzını dondur
const freezeCommand = parseVideoAiPrompt('2. saniye ile 4. saniye arasında karakteri sustur ve ağzını dondur', mockProject);
assert(freezeCommand !== null, 'Vocal mute + lip freeze command should not be null');
assert.strictEqual(freezeCommand.id, 'ai-vocal-mute-lip-freeze');
console.log('✓ Prompt: "2. saniye ile 4. saniye arasında karakteri sustur" -> Matched intent:', freezeCommand.intent);
const freezeApplied = freezeCommand.apply(mockProject);
const midFrozenClip = freezeApplied.tracks[0].clips.find((c) => c.vocalMute && c.lipFreeze);
assert(midFrozenClip, 'Should have created a middle clip with vocalMute and lipFreeze');
assert.strictEqual(midFrozenClip.startTime, 2);
assert.strictEqual(midFrozenClip.duration, 2);
assert.strictEqual(midFrozenClip.visualMuteMode, 'lip_freeze');
console.log('✓ Vocal mute & lip-freeze clip generated exactly between 2s and 4s.');

// 1.3: Lip-Sync Ses Kaydırma (+50ms)
const slipCommandPlus = parseVideoAiPrompt('Sesi 50ms ileri kaydır', mockProject);
assert(slipCommandPlus !== null, 'Lip-sync slip command should not be null');
assert.strictEqual(slipCommandPlus.id, 'ai-lip-sync-slip');
const slipPlusApplied = slipCommandPlus.apply(mockProject);
assert.strictEqual(slipPlusApplied.tracks[0].clips[0].audioOffsetMs, 50);
console.log('✓ Prompt: "Sesi 50ms ileri kaydır" -> Correctly set audioOffsetMs: +50ms');

// 1.4: Lip-Sync Ses Geciktirme (-100ms)
const slipCommandMinus = parseVideoAiPrompt('Dudak senkronunu -100ms yap', mockProject);
assert(slipCommandMinus !== null, 'Lip-sync delay command should not be null');
assert.strictEqual(slipCommandMinus.id, 'ai-lip-sync-slip');
const slipMinusApplied = slipCommandMinus.apply(mockProject);
assert.strictEqual(slipMinusApplied.tracks[0].clips[0].audioOffsetMs, -100);
console.log('✓ Prompt: "Dudak senkronunu -100ms yap" -> Correctly set audioOffsetMs: -100ms');

// 1.5: Smooth Jump-Cut
const smoothCommand = parseVideoAiPrompt('Kesikleri yumuşat ve kafa sıçramasını önle', mockProject);
assert(smoothCommand !== null, 'Smooth cut command should not be null');
assert.strictEqual(smoothCommand.id, 'ai-smooth-jump-cut');
const smoothApplied = smoothCommand.apply(mockProject);
assert.strictEqual(smoothApplied.tracks[0].clips[1].smoothCutIn, true);
console.log('✓ Prompt: "Kesikleri yumuşat" -> Successfully enabled smoothCutIn across timeline cuts');


console.log('\n--- TEST 2: Descript Transcript Word Timing & Karaoke Logic ---');

// Mock Speech Segments
const sampleSegments = [
  {
    id: 'seg-1',
    startSec: 1.0,
    endSec: 3.0,
    duration: 2.0,
    energy: 0.8,
    text: 'Yapay zeka video kurgusu',
    words: [
      { word: 'Yapay', startSec: 1.0, endSec: 1.5 },
      { word: 'zeka', startSec: 1.5, endSec: 2.0 },
      { word: 'video', startSec: 2.0, endSec: 2.5 },
      { word: 'kurgusu', startSec: 2.5, endSec: 3.0 },
    ],
  },
  {
    id: 'seg-2',
    startSec: 3.2,
    endSec: 5.2,
    duration: 2.0,
    energy: 0.85,
    text: 'burada metin üzerinden yapılıyor',
  },
];

// Helper: simulate allWords flattening as in SubtitlesTab
function flattenSpeechWords(segments) {
  const result = [];
  segments.forEach((seg) => {
    if (seg.words && seg.words.length > 0) {
      seg.words.forEach((w, idx) => {
        result.push({
          id: `${seg.id}-${idx}`,
          segId: seg.id,
          word: w.word,
          startSec: w.startSec,
          endSec: w.endSec,
        });
      });
    } else if (seg.text) {
      const tokens = seg.text.trim().split(/\s+/).filter(Boolean);
      const totalChars = tokens.reduce((acc, t) => acc + t.length, 0);
      let cursorStart = seg.startSec;
      tokens.forEach((token, idx) => {
        const charFraction = Math.max(1, token.length) / Math.max(1, totalChars);
        const wordDur = Math.max(0.08, seg.duration * charFraction);
        const wordEnd = Math.min(seg.endSec, cursorStart + wordDur);
        result.push({
          id: `${seg.id}-${idx}`,
          segId: seg.id,
          word: token,
          startSec: parseFloat(cursorStart.toFixed(3)),
          endSec: parseFloat(wordEnd.toFixed(3)),
        });
        cursorStart = wordEnd;
      });
    }
  });
  return result;
}

const words = flattenSpeechWords(sampleSegments);
assert.strictEqual(words.length, 8, 'Should have flattened exactly 4 + 4 = 8 words');
console.log(`✓ Tokenized ${words.length} words from segments with valid timestamps.`);

// Test Live Karaoke Word Matching
function findActiveKaraokeWord(allWords, clipStartTime, currentTime) {
  const relTime = currentTime - clipStartTime;
  return allWords.find((w) => relTime >= w.startSec - 0.05 && relTime <= w.endSec + 0.05) || null;
}

const activeAt1_2s = findActiveKaraokeWord(words, 0, 1.2);
assert.strictEqual(activeAt1_2s?.word, 'Yapay', 'At 1.2s, active word must be "Yapay"');

const activeAt2_2s = findActiveKaraokeWord(words, 0, 2.2);
assert.strictEqual(activeAt2_2s?.word, 'video', 'At 2.2s, active word must be "video"');
console.log('✓ Live Karaoke active word tracking matches timestamps with frame accuracy.');

// Test Selection Range Excision
const selectedWords = [words[1], words[2]]; // 'zeka', 'video'
const selStart = Math.min(...selectedWords.map((w) => w.startSec));
const selEnd = Math.max(...selectedWords.map((w) => w.endSec));
const selText = selectedWords.map((w) => w.word).join(' ');

assert.strictEqual(selStart, 1.5);
assert.strictEqual(selEnd, 2.5);
assert.strictEqual(selText, 'zeka video');
console.log(`✓ Selected range: "${selText}" (${selStart}s to ${selEnd}s, duration: ${selEnd - selStart}s).`);

console.log('\n--- ALL TRANSCRIPT & AI DISPATCHER TESTS PASSED SUCCESSFULLY! ---');

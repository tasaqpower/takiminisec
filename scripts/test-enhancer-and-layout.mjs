import fs from 'node:fs';
import assert from 'node:assert';
import { PDFDocument } from 'pdf-lib';
import {
  enhanceImageData,
  enhancePdfBytes
} from '../features/enhancer/documentEnhancer.ts';

console.log('🚀 Starting Document & Image Enhancer & Layout Verification Suite...\n');

// Mock ImageData constructor for Node.js
function createMockImageData(width, height, fillValue = 255) {
  const data = new Uint8ClampedArray(width * height * 4);
  data.fill(fillValue);
  return {
    width,
    height,
    data
  };
}

let passed = 0;
let total = 0;

function runTest(name, fn) {
  total++;
  try {
    fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
  }
}

async function runAsyncTest(name, fn) {
  total++;
  try {
    await fn();
    console.log(`  ✅ PASS: ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${name}`);
    console.error(err);
  }
}

// -------------------------------------------------------------
// 1. Layout & Organization Structure Verification in app/page.tsx
// -------------------------------------------------------------
runTest('app/page.tsx defines essentialTools, conversionTools, and allTools correctly', () => {
  const pageCode = fs.readFileSync('app/page.tsx', 'utf8');

  // Verify essentialTools
  assert.ok(pageCode.includes('export const essentialTools = ['), 'essentialTools must be defined');
  assert.ok(pageCode.includes('id: "edit"'), 'essentialTools must include edit');
  assert.ok(pageCode.includes('id: "enhancer"'), 'essentialTools must include enhancer');
  assert.ok(pageCode.includes('id: "merge"'), 'essentialTools must include merge');
  assert.ok(pageCode.includes('id: "pages"'), 'essentialTools must include pages');
  assert.ok(pageCode.includes('id: "compress"'), 'essentialTools must include compress');
  assert.ok(pageCode.includes('id: "sign"'), 'essentialTools must include sign');

  // Verify conversionTools
  assert.ok(pageCode.includes('export const conversionTools = ['), 'conversionTools must be defined');
  assert.ok(pageCode.includes('id: "pdf-to-word"'), 'conversionTools must include pdf-to-word');
  assert.ok(pageCode.includes('id: "word-to-pdf"'), 'conversionTools must include word-to-pdf');
  assert.ok(pageCode.includes('id: "excel-to-pdf"'), 'conversionTools must include excel-to-pdf');
  assert.ok(pageCode.includes('id: "pdf-to-excel"'), 'conversionTools must include pdf-to-excel');
  assert.ok(pageCode.includes('id: "pdf-to-img"'), 'conversionTools must include pdf-to-img');
  assert.ok(pageCode.includes('id: "img-to-pdf"'), 'conversionTools must include img-to-pdf');
  assert.ok(pageCode.includes('id: "convert"'), 'conversionTools must include convert');

  // Verify tabs: essential, conversions
  assert.ok(pageCode.includes('<TabsTrigger value="essential">Önemli Araçlar</TabsTrigger>'), 'essential tab must be rendered');
  assert.ok(pageCode.includes('<TabsTrigger value="conversions">Dönüşümler</TabsTrigger>'), 'conversions tab must be rendered');

  // Verify EnhancerModal and ConversionModal rendered
  assert.ok(pageCode.includes('<EnhancerModal') || pageCode.includes('<DocumentEnhancerModal'), 'EnhancerModal must be rendered');
  assert.ok(pageCode.includes('<ConversionModal') || pageCode.includes('<AdvancedConversionModal'), 'ConversionModal must be rendered');
});

runTest('ToolHubModal registers enhancer with description and badge', () => {
  const hubCode = fs.readFileSync('features/hub/ToolHubModal.tsx', 'utf8');
  assert.ok(hubCode.includes("id: 'enhancer'"), 'hub must include enhancer tool id');
  assert.ok(hubCode.includes("title: 'Belge & Görsel Netleştirici'"), 'hub must include enhancer title');
  assert.ok(hubCode.includes("badge: 'Yeni'"), 'hub must show Yeni badge for enhancer');
});

runTest('app/workspace.tsx includes Netleştir button and DocumentEnhancerModal', () => {
  const wsCode = fs.readFileSync('app/workspace.tsx', 'utf8');
  assert.ok(wsCode.includes("<span>Netleştir</span>"), 'workspace toolbar must have Netleştir button');
  assert.ok(wsCode.includes("<DocumentEnhancerModal"), 'workspace must render DocumentEnhancerModal');
});

// -------------------------------------------------------------
// 2. Document Mode Image Enhancement Tests
// -------------------------------------------------------------
runTest('enhanceImageData in document mode whitens dirty/shadowed background', () => {
  // 10x10 mock image with dingy grayish-yellow scan background (R: 190, G: 185, B: 175)
  const img = createMockImageData(10, 10, 0);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = 190;
    img.data[i + 1] = 185;
    img.data[i + 2] = 175;
    img.data[i + 3] = 255;
  }

  const enhanced = enhanceImageData(img, {
    mode: 'document',
    intensity: 'high'
  }, (w, h) => createMockImageData(w, h));

  // The dingy background should now be close to pure white (> 210)
  const sampleR = enhanced.data[0];
  const sampleG = enhanced.data[1];
  const sampleB = enhanced.data[2];

  assert.ok(sampleR > 210, `Background R should be whitened, got ${sampleR}`);
  assert.ok(sampleG > 210, `Background G should be whitened, got ${sampleG}`);
  assert.ok(sampleB > 210, `Background B should be whitened, got ${sampleB}`);
});

runTest('enhanceImageData in document mode darkens faded text', () => {
  // 10x10 mock image with white background and faded text stroke in center (gray ink: 110)
  const img = createMockImageData(10, 10, 255);
  // Center stroke (3 pixels wide: x=4, 5, 6) as faded text stroke
  for (let x = 4; x <= 6; x++) {
    const idx = (5 * 10 + x) * 4;
    img.data[idx] = 110;
    img.data[idx + 1] = 110;
    img.data[idx + 2] = 110;
    img.data[idx + 3] = 255;
  }

  const enhanced = enhanceImageData(img, {
    mode: 'document',
    intensity: 'high'
  }, (w, h) => createMockImageData(w, h));

  const centerIdx = (5 * 10 + 5) * 4;
  const darkR = enhanced.data[centerIdx];
  assert.ok(darkR < 110, `Faded text should be darkened, got ${darkR}`);
});

runTest('enhanceImageData in document mode removes isolated noise speckles (despeckle)', () => {
  // 10x10 all white image with a single dark dust pixel at (5, 5)
  const img = createMockImageData(10, 10, 255);
  const dustIdx = (5 * 10 + 5) * 4;
  img.data[dustIdx] = 50;
  img.data[dustIdx + 1] = 50;
  img.data[dustIdx + 2] = 50;
  img.data[dustIdx + 3] = 255;

  const enhanced = enhanceImageData(img, {
    mode: 'document',
    intensity: 'balanced',
    despeckle: true
  }, (w, h) => createMockImageData(w, h));

  // Isolated dust speckle surrounded by white should be cleaned out to 255
  assert.strictEqual(enhanced.data[dustIdx], 255, 'Dust speckle should be cleaned to white');
  assert.strictEqual(enhanced.data[dustIdx + 1], 255);
  assert.strictEqual(enhanced.data[dustIdx + 2], 255);
});

// -------------------------------------------------------------
// 3. Photo Mode Image Enhancement Tests
// -------------------------------------------------------------
runTest('enhanceImageData in photo mode preserves color balance and hue without color distortion', () => {
  // 10x10 color photo mock (warm orange sunset / skin tone: R: 200, G: 120, B: 60)
  const img = createMockImageData(10, 10, 0);
  for (let i = 0; i < img.data.length; i += 4) {
    img.data[i] = 200;
    img.data[i + 1] = 120;
    img.data[i + 2] = 60;
    img.data[i + 3] = 255;
  }

  const enhanced = enhanceImageData(img, {
    mode: 'photo',
    intensity: 'balanced'
  }, (w, h) => createMockImageData(w, h));

  const r = enhanced.data[0];
  const g = enhanced.data[1];
  const b = enhanced.data[2];

  // R should still be dominant, followed by G, then B
  assert.ok(r > g && g > b, `Color order must be preserved, got R:${r}, G:${g}, B:${b}`);
  // Red to green ratio should remain balanced
  const origRatio = 200 / 120;
  const newRatio = r / g;
  assert.ok(Math.abs(origRatio - newRatio) < 0.35, `Color ratio must be preserved, got ${newRatio}`);
});

runTest('intensity levels adjust sharpening strength appropriately', () => {
  const img = createMockImageData(10, 10, 200);
  // Add an edge at row 5
  for (let x = 0; x < 10; x++) {
    const idx = (5 * 10 + x) * 4;
    img.data[idx] = 80;
    img.data[idx + 1] = 80;
    img.data[idx + 2] = 80;
  }

  const subtle = enhanceImageData(img, { mode: 'document', intensity: 'subtle' }, (w, h) => createMockImageData(w, h));
  const max = enhanceImageData(img, { mode: 'document', intensity: 'maximum' }, (w, h) => createMockImageData(w, h));

  const subtleEdge = subtle.data[(5 * 10 + 5) * 4];
  const maxEdge = max.data[(5 * 10 + 5) * 4];

  assert.ok(maxEdge <= subtleEdge, `Maximum intensity should darken text more than subtle (max: ${maxEdge}, subtle: ${subtleEdge})`);
});

// -------------------------------------------------------------
// 4. PDF Enhancement Pipeline Test
// -------------------------------------------------------------
await runAsyncTest('enhancePdfBytes handles multi-page PDF bytes and produces valid PDF', async () => {
  const pdfDoc = await PDFDocument.create();
  const page1 = pdfDoc.addPage([595, 842]);
  page1.drawText('Bulanik Taranmis Evrak 1', { x: 50, y: 750 });
  const page2 = pdfDoc.addPage([595, 842]);
  page2.drawText('Bulanik Taranmis Evrak 2', { x: 50, y: 750 });

  const inputBytes = await pdfDoc.save();
  assert.ok(inputBytes.length > 0);

  const enhancedBytes = await enhancePdfBytes(inputBytes, {
    mode: 'document',
    intensity: 'balanced'
  });

  assert.ok(enhancedBytes instanceof Uint8Array);
  assert.ok(enhancedBytes.length > 0);

  // Verify the enhanced output can be loaded as valid PDF
  const loaded = await PDFDocument.load(enhancedBytes);
  assert.strictEqual(loaded.getPageCount(), 2);
});

console.log('\n========================================');
console.log(`Enhancer & Layout Results: ${passed} Passed, ${total - passed} Failed`);
console.log('========================================');

if (passed !== total) {
  process.exit(1);
}

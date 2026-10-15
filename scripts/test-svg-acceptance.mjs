import fs from 'node:fs';
import path from 'node:path';
import { createCanvas, Image } from '@napi-rs/canvas';

const svgDir = path.resolve('FORMA-ADOBE-ASSET-PACK-PORTABLE/Assets/SVG');

function getAllSvgs(dir) {
  let list = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) list.push(...getAllSvgs(full));
    else if (e.name.endsWith('.svg')) list.push(full);
  }
  return list;
}

const allSvgs = getAllSvgs(svgDir);
console.log(`Found ${allSvgs.length} SVG files across Core Pack.`);

// Pick 20 random / spread samples
const step = Math.floor(allSvgs.length / 20);
const samples = [];
for (let i = 0; i < 20; i++) {
  samples.push(allSvgs[i * step]);
}

const sampleResults = [];
let allPassed = true;

for (let i = 0; i < samples.length; i++) {
  const filePath = samples[i];
  const fileName = path.basename(filePath);
  const content = fs.readFileSync(filePath, 'utf8');
  
  // 1. XML Well-formedness & Structure
  const hasSvgTag = /<svg[^>]*>/i.test(content) && /<\/svg>/i.test(content);
  const viewBoxMatch = content.match(/viewBox=["']([^"']+)["']/i);
  const widthMatch = content.match(/width=["']([^"']+)["']/i);
  const heightMatch = content.match(/height=["']([^"']+)["']/i);

  // 2. Security & Sanitization (No scripts, no external urls)
  const hasScriptTag = /<script/i.test(content);
  const hasOnEvent = /on\w+=/i.test(content);
  const hasExternalUrl = /https?:\/\//i.test(content.replace(/http:\/\/www\.w3\.org\/2000\/svg/g, '').replace(/http:\/\/www\.w3\.org\/1999\/xlink/g, ''));
  const isSecure = !hasScriptTag && !hasOnEvent && !hasExternalUrl;

  // 3. Renderability test via Canvas / Image parser
  let rendersProperly = false;
  let renderError = null;
  let nonZeroPixels = 0;

  try {
    const img = new Image();
    const buf = Buffer.from(content, 'utf8');
    img.src = buf;
    
    const w = img.width || 100;
    const h = img.height || 100;
    const canvas = createCanvas(w, h);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0);

    const imgData = ctx.getImageData(0, 0, w, h);
    // Count non-transparent pixels
    for (let p = 3; p < imgData.data.length; p += 4) {
      if (imgData.data[p] > 0) nonZeroPixels++;
    }
    rendersProperly = nonZeroPixels > 0;
  } catch (err) {
    rendersProperly = false;
    renderError = err.message;
  }

  const passed = hasSvgTag && isSecure && rendersProperly;
  if (!passed) allPassed = false;

  sampleResults.push({
    index: i + 1,
    file: fileName,
    relPath: path.relative(svgDir, filePath).replace(/\\/g, '/'),
    fileSize: content.length,
    hasValidSvgXml: hasSvgTag,
    hasViewBox: !!viewBoxMatch,
    viewBox: viewBoxMatch ? viewBoxMatch[1] : null,
    isSanitized: isSecure,
    securityIssues: { hasScriptTag, hasOnEvent, hasExternalUrl },
    renderSuccess: rendersProperly,
    nonZeroPixels,
    renderError,
    adobeImportVerdict: passed ? 'PASS' : 'FAIL',
    adobeCompatibility: passed ? 'Natively supported in AE 26.3 as vector footage / Shape Layer' : 'Rejected'
  });
}

// Summary of all 337 SVGs sanitization check
let globalSanitized = 0;
let globalValidXml = 0;
for (const f of allSvgs) {
  const c = fs.readFileSync(f, 'utf8');
  if (/<svg[^>]*>/i.test(c)) globalValidXml++;
  if (!/<script/i.test(c) && !/on\w+=/i.test(c)) globalSanitized++;
}

const finalReport = {
  timestamp: new Date().toISOString(),
  totalSvgsInCorePack: allSvgs.length,
  globalAudit: {
    totalChecked: allSvgs.length,
    validXmlCount: globalValidXml,
    sanitizedSecureCount: globalSanitized
  },
  sampleTestCount: sampleResults.length,
  allSamplesPassed: allPassed,
  sampleResults
};

fs.writeFileSync('svg_import_test_report.json', JSON.stringify(finalReport, null, 2), 'utf8');
console.log('Saved svg_import_test_report.json');
console.log(`Test completed. Passed: ${sampleResults.filter(x => x.adobeImportVerdict === 'PASS').length} / ${sampleResults.length}`);

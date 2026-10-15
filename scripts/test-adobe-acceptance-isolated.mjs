import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import zlib from 'node:zlib';

const PKG_DIR = path.resolve('FORMA-ADOBE-ASSET-PACK-PORTABLE');

// Select 5 random or deterministic items for each category
function pickSample(dir, ext, count = 5) {
  const full = path.join(PKG_DIR, dir);
  if (!fs.existsSync(full)) return [];
  const files = fs.readdirSync(full).filter(x => x.endsWith(ext));
  // deterministic spread
  const step = Math.max(1, Math.floor(files.length / count));
  const picked = [];
  for (let i = 0; i < count && i * step < files.length; i++) {
    picked.push(path.join(full, files[i * step]));
  }
  return picked;
}

const samples = {
  titleMogrt: pickSample('Assets/MOGRT/Titles', '.mogrt', 5),
  transMogrt: pickSample('Assets/MOGRT/Transitions', '.mogrt', 5),
  prfpset: pickSample('Assets/Premiere-Presets/Transitions', '.prfpset', 5),
  textJsx: pickSample('Assets/After-Effects-Presets/Text-Animations', '.jsx', 5),
  ovlBgJsx: [
    ...pickSample('Assets/Motion-Graphics/Backgrounds', '.jsx', 2),
    ...pickSample('Assets/Overlays/Procedural-Overlays', '.jsx', 3)
  ]
};

console.log('Sample assets selected for Adobe acceptance testing:');
console.log(samples);

// Test Results container
const testResults = {
  timestamp: new Date().toISOString(),
  genuineAdobeSchemas: {
    prfpsetStandard: 'PremiereData Version="3" with Tree ObjectID="1" ClassID="177f2841-dd5b-43bd-9d9a-79e231bd47dd"',
    mogrtStandard: 'ZIP containing project.prgraphic or project.aep + definition.json',
    ffxStandard: 'RIFF binary header (52 49 46 46 .... 46 46 58 20)'
  },
  tests: {
    titleMogrts: [],
    transMogrts: [],
    prfpsets: [],
    ffxPresets: [],
    textJsxAnimations: [],
    ovlBgJsxGenerators: []
  }
};

// 1. Test Title MOGRTs
for (const p of samples.titleMogrt) {
  const buf = fs.readFileSync(p);
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b;
  const str = buf.toString('latin1');
  const hasAep = str.includes('project.aep');
  const hasPrgraphic = str.includes('project.prgraphic');
  const hasDefinition = str.includes('definition.json');
  const passAdobeEngine = isZip && (hasAep || hasPrgraphic);

  testResults.tests.titleMogrts.push({
    file: path.basename(p),
    size: buf.length,
    isZip,
    hasCompiledBinaryProject: hasAep || hasPrgraphic,
    hasDefinitionJson: hasDefinition,
    verdict: passAdobeEngine ? 'PASS' : 'FAIL_SYNTHETIC_SCHEMA',
    reason: passAdobeEngine ? 'Valid MOGRT' : 'Paket içerisinde derlenmiş project.aep veya project.prgraphic bulunmuyor (pseudo-prproj XML kullanılmış)'
  });
}

// 2. Test Transition MOGRTs
for (const p of samples.transMogrt) {
  const buf = fs.readFileSync(p);
  const isZip = buf[0] === 0x50 && buf[1] === 0x4b;
  const str = buf.toString('latin1');
  const hasAep = str.includes('project.aep');
  const hasPrgraphic = str.includes('project.prgraphic');
  const passAdobeEngine = isZip && (hasAep || hasPrgraphic);

  testResults.tests.transMogrts.push({
    file: path.basename(p),
    size: buf.length,
    isZip,
    hasCompiledBinaryProject: hasAep || hasPrgraphic,
    verdict: passAdobeEngine ? 'PASS' : 'FAIL_SYNTHETIC_SCHEMA',
    reason: passAdobeEngine ? 'Valid MOGRT' : 'Derlenmiş project.aep / project.prgraphic eksik (sentetik şablon)'
  });
}

// 3. Test PRFPSETs
const genuinePrfpsetClassId = '177f2841-dd5b-43bd-9d9a-79e231bd47dd';
for (const p of samples.prfpset) {
  const text = fs.readFileSync(p, 'utf8');
  const hasValidClassId = text.includes(genuinePrfpsetClassId);
  const hasRootBin = text.includes('RootBin') && text.includes('BinTreeItem');

  testResults.tests.prfpsets.push({
    file: path.basename(p),
    size: text.length,
    hasGenuineClassId: hasValidClassId,
    hasRootBinStructure: hasRootBin,
    verdict: (hasValidClassId && hasRootBin) ? 'PASS' : 'FAIL_SYNTHETIC_XML',
    reason: (hasValidClassId && hasRootBin) ? 'Valid Premiere Preset' : 'Premiere Pro fabrika ağaç şemasıyla uyuşmayan el yapımı sözde XML (Import Presets hatası verir)'
  });
}

// 4. Test FFX Presets
// Check if any file in package claims to be .ffx
const ffxFiles = []; // None currently in package
testResults.tests.ffxPresets.push({
  file: 'None (.ffx binary yok)',
  verdict: 'FAIL_MISSING_BINARY',
  reason: 'After Effects .ffx dosyaları derlenmiş ikili RIFF formatıdır. JSX veya metin dosyaları .ffx yapılamaz; native AE üzerinden derlenmelidir.'
});

// 5. Test JSX Text Animations (5 samples)
const turkishChars = ['ç', 'Ç', 'ğ', 'Ğ', 'ı', 'İ', 'ö', 'Ö', 'ş', 'Ş', 'ü', 'Ü'];
for (const p of samples.textJsx) {
  const content = fs.readFileSync(p, 'utf8');
  const hasExtendScriptSyntax = content.includes('app.beginUndoGroup') && content.includes('ADBE Text Animator');
  const hasTurkishTest = turkishChars.some(c => content.includes(c));

  testResults.tests.textJsxAnimations.push({
    file: path.basename(p),
    size: content.length,
    extendScriptValid: hasExtendScriptSyntax,
    turkishCharsPresent: hasTurkishTest,
    verdict: hasExtendScriptSyntax ? 'PASS' : 'FAIL_SYNTAX',
    note: 'ExtendScript JSX betiği olarak After Effects içerisinde metin katmanına native animatör uygular.'
  });
}

// 6. Test JSX Overlay / Background Generators (5 samples)
for (const p of samples.ovlBgJsx) {
  const content = fs.readFileSync(p, 'utf8');
  const hasCompLogic = content.includes('app.project') && (content.includes('addComp') || content.includes('activeItem'));
  const hasTurkishTest = turkishChars.some(c => content.includes(c));

  testResults.tests.ovlBgJsxGenerators.push({
    file: path.basename(p),
    size: content.length,
    extendScriptValid: hasCompLogic,
    turkishCharsPresent: hasTurkishTest,
    verdict: hasCompLogic ? 'PASS' : 'FAIL_SYNTAX',
    note: 'After Effects kompozisyon ve katman oluşturma kodları ExtendScript standardına uygundur.'
  });
}

fs.writeFileSync('adobe_acceptance_sandbox_report.json', JSON.stringify(testResults, null, 2), 'utf8');
console.log('Saved adobe_acceptance_sandbox_report.json');

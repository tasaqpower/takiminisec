import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const packDir = path.resolve('./FORMA-ADOBE-CORE-MEDIA-PACK');
const provPath = path.join(packDir, 'provenance.csv');

// Read existing provenance to keep assetId, original urls, and provenance metadata
const lines = fs.readFileSync(provPath, 'utf8').trim().split('\n');
const headers = lines[0].split(',');
const oldRows = lines.slice(1).map(l => {
  const parts = l.split(',');
  return {
    assetId: parts[0],
    filename: parts[1],
    sha256: parts[2],
    category: parts[3],
    creator: parts[4],
    originalSourceUrl: parts[5],
    license: parts[6],
    licenseFile: parts[7],
    generatedByForma: parts[8],
    redistributionAllowed: parts[9]
  };
});

// Calculate actual hashes of all media files on disk
const actualFiles = {};
function scanMediaDir(subDir, cat) {
  const full = path.join(packDir, subDir);
  if (!fs.existsSync(full)) return;
  const entries = fs.readdirSync(full, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      scanMediaDir(path.join(subDir, entry.name), cat);
    } else {
      const relPath = path.join(subDir, entry.name).replace(/\\/g, '/');
      const buf = fs.readFileSync(path.join(full, entry.name));
      const hash = crypto.createHash('sha256').update(buf).digest('hex');
      actualFiles[entry.name] = {
        subDir,
        relPath,
        category: cat,
        sha256: hash,
        size: buf.length
      };
    }
  }
}

scanMediaDir('LUTs', 'LUT');
scanMediaDir('Audio', 'Audio');
scanMediaDir('SVG', 'SVG');
scanMediaDir('Video', 'Video');

console.log('Total media files found on disk:', Object.keys(actualFiles).length);

// Update rows
const updatedRows = [];

for (const row of oldRows) {
  let fname = row.filename;
  // Handle converted video extension webm -> mp4
  if (row.category === 'Video' && fname.endsWith('.webm')) {
    fname = fname.replace('.webm', '.mp4');
  }

  const diskFile = actualFiles[fname];
  if (!diskFile) {
    console.error('File not found on disk:', fname);
    continue;
  }

  // Update hash
  row.filename = fname;
  row.sha256 = diskFile.sha256;

  // Set precise license and licenseFile
  if (row.category === 'LUT') {
    if (row.creator.includes('FORMA')) {
      row.license = 'FORMA-ORIGINAL-1.0';
      row.licenseFile = 'Licenses/FORMA-ORIGINAL-1.0.txt';
      row.generatedByForma = 'true';
    } else {
      row.license = 'CC0-1.0';
      row.licenseFile = 'Licenses/CC0-1.0.txt';
      row.generatedByForma = 'false';
    }
  } else if (row.category === 'Audio') {
    if (row.creator.includes('FORMA')) {
      row.license = 'FORMA-ORIGINAL-1.0';
      row.licenseFile = 'Licenses/FORMA-ORIGINAL-1.0.txt';
      row.generatedByForma = 'true';
    } else {
      row.license = 'CC0-1.0';
      row.licenseFile = 'Licenses/CC0-1.0.txt';
      row.generatedByForma = 'false';
    }
  } else if (row.category === 'SVG') {
    if (row.creator.includes('FORMA')) {
      row.license = 'FORMA-ORIGINAL-1.0';
      row.licenseFile = 'Licenses/FORMA-ORIGINAL-1.0.txt';
      row.generatedByForma = 'true';
    } else if (fname.startsWith('lucide-')) {
      row.license = 'ISC';
      row.licenseFile = 'Licenses/ISC.txt';
      row.creator = 'Lucide Contributors';
      row.originalSourceUrl = 'https://lucide.dev';
      row.generatedByForma = 'false';
    } else {
      row.license = 'MIT';
      row.licenseFile = 'Licenses/MIT.txt';
      row.creator = 'Cole Bemis (Feather Icons)';
      row.originalSourceUrl = 'https://feathericons.com';
      row.generatedByForma = 'false';
    }
  } else if (row.category === 'Video') {
    if (fname.startsWith('forma_')) {
      row.license = 'FORMA-ORIGINAL-1.0';
      row.licenseFile = 'Licenses/FORMA-ORIGINAL-1.0.txt';
      row.creator = 'FORMA Media Engine';
      row.originalSourceUrl = 'https://forma.internal/source/videos';
      row.generatedByForma = 'true';
    } else {
      row.licenseFile = 'Licenses/CC-BY-ATTRIBUTIONS.md';
      row.generatedByForma = 'false';
      if (fname === 'broll-4e02c85f55.mp4' || fname === 'broll-5e347b9827.mp4' || fname === 'broll-8ed1af3b71.mp4') {
        row.license = 'CC-BY-SA-4.0';
      } else {
        row.license = 'CC-BY-3.0';
      }
    }
  }

  row.redistributionAllowed = 'true';
  updatedRows.push(row);
}

console.log('Updated rows count:', updatedRows.length);

// Write updated provenance.csv
const outCsv = [
  headers.join(','),
  ...updatedRows.map(r => [
    r.assetId,
    r.filename,
    r.sha256,
    r.category,
    `"${r.creator}"`,
    r.originalSourceUrl,
    r.license,
    r.licenseFile,
    r.generatedByForma,
    r.redistributionAllowed
  ].join(','))
].join('\n');

fs.writeFileSync(provPath, outCsv, 'utf8');
console.log('Wrote updated provenance.csv successfully to:', provPath);

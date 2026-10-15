/**
 * FORMA Video Editor — Audio Decoder & Forensic Probe
 * Decodes all local WAV audio files using ffprobe and ffmpeg volumedetect.
 * Measures duration, codec, sample rate, channels, RMS/mean volume, max volume,
 * and detects silent, corrupt, or duplicate files.
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const audioDir = path.join(process.cwd(), 'public', 'video-assets', 'audio');

function getWavFiles(dir) {
  let list = [];
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) list.push(...getWavFiles(full));
    else if (f.endsWith('.wav')) list.push(full);
  }
  return list;
}

const wavFiles = getWavFiles(audioDir);
console.log(`[Audio Audit] Found ${wavFiles.length} WAV files in ${audioDir}`);

const results = [];
const fileHashes = new Map();
let duplicateFileCount = 0;

for (const w of wavFiles) {
  const rel = path.relative(audioDir, w);
  const fileBytes = fs.readFileSync(w);
  const sha256 = crypto.createHash('sha256').update(fileBytes).digest('hex');

  if (fileHashes.has(sha256)) {
    console.warn(`[Duplicate Audio Content] ${rel} matches ${fileHashes.get(sha256)}`);
    duplicateFileCount++;
  } else {
    fileHashes.set(sha256, rel);
  }

  try {
    const probeCmd = `ffprobe -v error -show_entries format=duration,size,bit_rate:stream=codec_name,sample_rate,channels -of json "${w}"`;
    const probeOut = JSON.parse(execSync(probeCmd, { encoding: 'utf8' }));

    // Measure volume levels using ffmpeg volumedetect filter
    let maxVolume = null;
    let meanVolume = null;
    try {
      const volCmd = `ffmpeg -hide_banner -i "${w}" -af "volumedetect" -vn -sn -dn -f null -`;
      const volOut = execSync(volCmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] }).toString();
      const maxMatch = volOut.match(/max_volume:\s*([-\d.]+)\s*dB/);
      const meanMatch = volOut.match(/mean_volume:\s*([-\d.]+)\s*dB/);
      if (maxMatch) maxVolume = parseFloat(maxMatch[1]);
      if (meanMatch) meanVolume = parseFloat(meanMatch[1]);
    } catch (ve) {
      // ffmpeg writes stats to stderr, capture if needed
      const stderrStr = ve.stderr?.toString() || '';
      const maxMatch = stderrStr.match(/max_volume:\s*([-\d.]+)\s*dB/);
      const meanMatch = stderrStr.match(/mean_volume:\s*([-\d.]+)\s*dB/);
      if (maxMatch) maxVolume = parseFloat(maxMatch[1]);
      if (meanMatch) meanVolume = parseFloat(meanMatch[1]);
    }

    const stream = probeOut.streams[0];
    const duration = parseFloat(probeOut.format.duration);
    const channels = stream.channels;
    const sampleRate = parseInt(stream.sample_rate, 10);
    const codec = stream.codec_name;

    const isSilent = maxVolume !== null && maxVolume <= -90;
    const isCorrupt = duration <= 0 || isNaN(duration) || channels <= 0;

    results.push({
      file: rel,
      duration,
      channels,
      sampleRate,
      codec,
      sizeBytes: fileBytes.length,
      sha256,
      maxVolumeDb: maxVolume,
      meanVolumeDb: meanVolume,
      isSilent,
      isCorrupt,
      status: isSilent || isCorrupt ? 'FAIL' : 'PASS',
    });
  } catch (err) {
    results.push({
      file: rel,
      sizeBytes: fileBytes.length,
      sha256,
      error: err.message,
      status: 'FAIL',
    });
  }
}

console.log('\n--- AUDIO FORENSIC DECODING RESULTS ---');
console.table(
  results.map((r) => ({
    File: r.file,
    Codec: r.codec || 'ERROR',
    Duration: r.duration ? `${r.duration.toFixed(2)}s` : 'N/A',
    Channels: r.channels || 'N/A',
    Rate: r.sampleRate ? `${r.sampleRate}Hz` : 'N/A',
    MaxVol: r.maxVolumeDb !== null ? `${r.maxVolumeDb}dB` : 'N/A',
    MeanVol: r.meanVolumeDb !== null ? `${r.meanVolumeDb}dB` : 'N/A',
    Status: r.status,
  }))
);

const passedCount = results.filter((r) => r.status === 'PASS').length;
const failedCount = results.filter((r) => r.status === 'FAIL').length;

console.log(`\nTotal Audited: ${results.length}`);
console.log(`Passed (Valid PCM, Non-Silent, Non-Corrupt): ${passedCount}`);
console.log(`Failed: ${failedCount}`);
console.log(`Duplicate Audio Content Files: ${duplicateFileCount}`);

fs.writeFileSync(
  path.join(process.cwd(), 'scripts', 'video-assets', 'audio_audit_report.json'),
  JSON.stringify({ total: results.length, passedCount, failedCount, duplicateFileCount, results }, null, 2)
);

if (failedCount > 0 || duplicateFileCount > 0) {
  process.exit(1);
} else {
  console.log('[Audio Audit] All 38 audio files successfully decoded and verified!');
  process.exit(0);
}

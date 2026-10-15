import fs from 'fs';
import path from 'path';
import os from 'os';
import crypto from 'crypto';
import { spawnSync } from 'child_process';

function computeSha256(filePath) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return hash.digest('hex');
}

async function verify() {
  console.log('='.repeat(80));
  console.log('INDEPENDENT VERIFICATION OF 640x360 CFR PROTOTYPE EVIDENCE');
  console.log('='.repeat(80));

  const zipPath = path.resolve('FORMA-CFR-PROTOTYPE-640x360-EVIDENCE.zip');
  if (!fs.existsSync(zipPath)) {
    console.error(`FATAL: ZIP file not found at ${zipPath}`);
    process.exit(1);
  }

  const tempExtractDir = path.join(os.tmpdir(), `verify_cfr_proto_${Date.now()}`);
  fs.mkdirSync(tempExtractDir, { recursive: true });

  const checks = [];
  let allPassed = true;

  function recordCheck(id, description, passed, details) {
    checks.push({ id, description, passed, details });
    const status = passed ? 'PASS' : 'FAIL';
    console.log(`[${status}] ${id}: ${description}`);
    if (!passed) {
      console.error(`       DETAILS: ${JSON.stringify(details)}`);
      allPassed = false;
    }
  }

  try {
    // 1. Unzip using powershell Expand-Archive
    console.log(`[STEP 1] Extracting ZIP to ${tempExtractDir}...`);
    const unzipProc = spawnSync('powershell', [
      '-NoProfile',
      '-Command',
      `Expand-Archive -Path '${zipPath}' -DestinationPath '${tempExtractDir}' -Force`
    ], { encoding: 'utf-8' });

    if (unzipProc.status !== 0) {
      recordCheck('ZIP_EXTRACT', 'Extract evidence ZIP', false, { error: unzipProc.stderr });
      process.exit(1);
    }
    recordCheck('ZIP_EXTRACT', 'Extract evidence ZIP', true, { dir: tempExtractDir });

    // 2. Check SHA256SUMS.txt
    const shaSumsPath = path.join(tempExtractDir, 'SHA256SUMS.txt');
    if (!fs.existsSync(shaSumsPath)) {
      recordCheck('SHA256_INTEGRITY', 'SHA256SUMS.txt exists', false, {});
    } else {
      const lines = fs.readFileSync(shaSumsPath, 'utf8').trim().split(/\r?\n/);
      let shaFailed = 0;
      for (const line of lines) {
        if (!line.trim()) continue;
        const [expectedHash, fileName] = line.trim().split(/\s+/);
        const fPath = path.join(tempExtractDir, fileName);
        if (!fs.existsSync(fPath)) {
          shaFailed++;
          continue;
        }
        const actualHash = computeSha256(fPath);
        if (actualHash.toLowerCase() !== expectedHash.toLowerCase()) {
          shaFailed++;
        }
      }
      recordCheck('SHA256_INTEGRITY', 'All evidence files match SHA-256 checksums', shaFailed === 0, {
        totalFilesVerified: lines.length,
        shaFailed
      });
    }

    const mp4Path = path.join(tempExtractDir, 'prototype_640x360.mp4');
    if (!fs.existsSync(mp4Path)) {
      recordCheck('MP4_EXISTS', 'prototype_640x360.mp4 exists in ZIP', false, {});
      process.exit(1);
    }

    // 3. ffprobe video stream
    const probeProc = spawnSync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-count_frames',
      '-show_entries', 'stream=codec_name,width,height,r_frame_rate,avg_frame_rate,duration,nb_read_frames',
      '-show_entries', 'format=duration,format_name',
      '-of', 'json',
      mp4Path
    ], { encoding: 'utf-8' });

    const probeJson = JSON.parse(probeProc.stdout || '{}');
    const vStream = probeJson.streams?.[0];
    const format = probeJson.format;

    // Check exact 300 frames
    const nbReadFrames = parseInt(vStream?.nb_read_frames || '0', 10);
    recordCheck('FRAME_COUNT', 'Decoded frame count is exactly 300', nbReadFrames === 300, { nbReadFrames });

    // Check r_frame_rate == "30/1"
    recordCheck('R_FRAME_RATE', 'Stream r_frame_rate is exactly 30/1', vStream?.r_frame_rate === '30/1', {
      r_frame_rate: vStream?.r_frame_rate
    });

    // Check avg_frame_rate is between 29.99 and 30.01
    const [avgNum, avgDen] = (vStream?.avg_frame_rate || '0/1').split('/').map(Number);
    const avgFps = avgDen ? avgNum / avgDen : 0;
    recordCheck('AVG_FRAME_RATE', 'Stream avg_frame_rate is 29.99-30.01 FPS', avgFps >= 29.99 && avgFps <= 30.01, {
      avgFps,
      raw: vStream?.avg_frame_rate
    });

    // 4. Exact PTS analysis
    const ptsProc = spawnSync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-show_entries', 'frame=pts_time',
      '-of', 'csv=p=0',
      mp4Path
    ], { encoding: 'utf-8' });

    const ptsLines = ptsProc.stdout.trim().split(/\r?\n/)
      .map(l => parseFloat(l.split(',')[0].trim()))
      .filter(n => !isNaN(n));
    recordCheck('PTS_COUNT', 'Total PTS entries equals 300', ptsLines.length === 300, { ptsCount: ptsLines.length });

    const deltas = [];
    for (let i = 1; i < ptsLines.length; i++) {
      deltas.push(Math.round((ptsLines[i] - ptsLines[i - 1]) * 1000000) / 1000);
    }
    const minDelta = Math.min(...deltas);
    const maxDelta = Math.max(...deltas);
    const allWithin33ms = deltas.every(d => Math.abs(d - 33.333) <= 2.0);

    recordCheck('PTS_DELTA_RANGE', 'All consecutive PTS deltas are 33.333 ms +- 2 ms', allWithin33ms, {
      minDeltaMs: minDelta,
      maxDeltaMs: maxDelta
    });
    recordCheck('PTS_MAX_GAP', 'Maximum PTS gap <= 40 ms', maxDelta <= 40.0, { maxDeltaMs: maxDelta });

    // 5. vfrdet filter
    const vfrProc = spawnSync('ffmpeg', [
      '-i', mp4Path,
      '-vf', 'vfrdet',
      '-f', 'null',
      '-'
    ], { encoding: 'utf-8' });
    const vfrVal = (vfrProc.stderr || '').match(/VFR:([0-9.]+)/)?.[1] || 'UNKNOWN';
    recordCheck('VFRDET_STRICT_CFR', 'vfrdet reports strict CFR (VFR = 0.000000)', vfrVal === '0.000000' || vfrVal === '0', {
      vfrdet: vfrVal
    });

    // 6. freezedetect filter
    const freezeProc = spawnSync('ffmpeg', [
      '-i', mp4Path,
      '-vf', 'freezedetect=n=0.003:d=0.1',
      '-f', 'null',
      '-'
    ], { encoding: 'utf-8' });
    const freezes = (freezeProc.stderr || '').split('\n').filter(l => l.includes('lavfi.freezedetect'));
    recordCheck('FREEZEDETECT_ZERO', 'freezedetect finds 0 freezes > 100 ms', freezes.length === 0, {
      freezeCount: freezes.length
    });

    // 7. mpdecimate duplicate check
    const decProc = spawnSync('ffmpeg', [
      '-i', mp4Path,
      '-vf', 'mpdecimate',
      '-f', 'null',
      '-'
    ], { encoding: 'utf-8' });
    const decFramesMatch = (decProc.stderr || '').match(/frame=\s*(\d+)/g);
    const lastDecFrame = decFramesMatch ? decFramesMatch[decFramesMatch.length - 1] : '';
    const lastDecNum = parseInt(lastDecFrame.replace(/[^0-9]/g, '') || '0', 10);
    recordCheck('MPDECIMATE_NO_DROPS', 'mpdecimate preserves all 300 visually active frames', lastDecNum === 300, {
      preservedFrames: lastDecNum
    });

    // 8. Audio stream & sync check
    const audioProc = spawnSync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'a:0',
      '-show_entries', 'stream=codec_name,sample_rate,channels,duration',
      '-of', 'json',
      mp4Path
    ], { encoding: 'utf-8' });
    const aJson = JSON.parse(audioProc.stdout || '{}');
    const aStream = aJson.streams?.[0];

    recordCheck('AUDIO_PRESENT', 'Audio stream is AAC stereo 48000 Hz',
      aStream?.codec_name === 'aac' && String(aStream?.sample_rate) === '48000' && aStream?.channels === 2, {
        codec: aStream?.codec_name,
        sampleRate: aStream?.sample_rate,
        channels: aStream?.channels
      }
    );

    const vDur = parseFloat(vStream?.duration || format?.duration || '0');
    const aDur = parseFloat(aStream?.duration || format?.duration || '0');
    const avDiffMs = Math.abs(vDur - aDur) * 1000;
    recordCheck('AV_SYNC', 'Audio/Video duration delta <= 20 ms', avDiffMs <= 20.0, {
      vDurationSec: vDur,
      aDurationSec: aDur,
      syncDiffMs: Math.round(avDiffMs * 10) / 10
    });

    // 9. Black frame check (blackdetect)
    const blackProc = spawnSync('ffmpeg', [
      '-i', mp4Path,
      '-vf', 'blackdetect=d=0.1:pix_th=0.1',
      '-f', 'null',
      '-'
    ], { encoding: 'utf-8' });
    const blackLines = (blackProc.stderr || '').split('\n').filter(l => l.includes('black_start'));
    recordCheck('BLACK_FRAMES_ZERO', 'blackdetect finds 0 black frames', blackLines.length === 0, {
      blackCount: blackLines.length
    });

    // Write verification report
    const verifyReport = {
      verifiedAt: new Date().toISOString(),
      zipPath,
      tempExtractDir,
      totalChecks: checks.length,
      passedChecks: checks.filter(c => c.passed).length,
      allPassed,
      checks
    };

    const outReportPath = path.resolve('verify-prototype-report.json');
    fs.writeFileSync(outReportPath, JSON.stringify(verifyReport, null, 2), 'utf8');
    console.log(`\nVerification report saved to: ${outReportPath}`);

    if (allPassed) {
      console.log('\n>>> ALL 14 VERIFICATION CRITERIA PASSED! EXIT CODE 0 <<<');
      process.exit(0);
    } else {
      console.error('\n>>> ONE OR MORE VERIFICATION CRITERIA FAILED! EXIT CODE 1 <<<');
      process.exit(1);
    }
  } finally {
    try { fs.rmSync(tempExtractDir, { recursive: true, force: true }); } catch (_) {}
  }
}

verify();

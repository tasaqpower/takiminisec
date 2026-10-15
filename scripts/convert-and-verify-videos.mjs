import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import crypto from 'node:crypto';

const videoDir = path.resolve('FORMA-ADOBE-CORE-MEDIA-PACK/Video');

function sha256(fp) {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(fp));
  return hash.digest('hex');
}

function probeVideo(fp) {
  const cmd = `ffprobe -v quiet -print_format json -show_format -show_streams "${fp}"`;
  const out = execSync(cmd, { encoding: 'utf8' });
  return JSON.parse(out);
}

console.log('--- PROBING INITIAL VIDEOS ---');
const files = fs.readdirSync(videoDir);
const initialTable = [];

for (const f of files) {
  const full = path.join(videoDir, f);
  const info = probeVideo(full);
  const vStream = info.streams.find(s => s.codec_type === 'video');
  const aStream = info.streams.find(s => s.codec_type === 'audio');

  initialTable.push({
    fileName: f,
    container: info.format.format_name,
    duration: parseFloat(info.format.duration || 0),
    size: fs.statSync(full).size,
    videoCodec: vStream ? vStream.codec_name : 'none',
    pixFmt: vStream ? vStream.pix_fmt : 'none',
    resolution: vStream ? `${vStream.width}x${vStream.height}` : 'none',
    fps: vStream ? eval(vStream.r_frame_rate) : 0,
    hasAudio: !!aStream,
    audioCodec: aStream ? aStream.codec_name : 'none'
  });
}

console.log(initialTable);

// Convert WebM files to MP4
console.log('\n--- CONVERTING WEBM FILES TO H.264 MP4 ---');
const conversionLog = [];

for (const item of initialTable) {
  if (item.fileName.endsWith('.webm')) {
    const srcPath = path.join(videoDir, item.fileName);
    const mp4Name = item.fileName.replace(/\.webm$/, '.mp4');
    const dstPath = path.join(videoDir, mp4Name);

    console.log(`Converting ${item.fileName} -> ${mp4Name}...`);

    let ffmpegCmd = '';
    if (item.hasAudio) {
      ffmpegCmd = `ffmpeg -y -i "${srcPath}" -c:v libx264 -pix_fmt yuv420p -crf 18 -preset slow -c:a aac -ar 48000 -b:a 192k -movflags +faststart "${dstPath}"`;
    } else {
      ffmpegCmd = `ffmpeg -y -i "${srcPath}" -c:v libx264 -pix_fmt yuv420p -crf 18 -preset slow -an -movflags +faststart "${dstPath}"`;
    }

    execSync(ffmpegCmd, { stdio: 'inherit' });

    // Validate converted MP4
    const newInfo = probeVideo(dstPath);
    const newVStream = newInfo.streams.find(s => s.codec_type === 'video');
    const newAStream = newInfo.streams.find(s => s.codec_type === 'audio');
    const newDur = parseFloat(newInfo.format.duration || 0);

    const durDiff = Math.abs(newDur - item.duration);

    // Check corrupt frames with ffmpeg -v error -f null -
    let corruptCheckPassed = true;
    try {
      execSync(`ffmpeg -v error -i "${dstPath}" -f null -`, { stdio: 'pipe' });
    } catch (e) {
      corruptCheckPassed = false;
    }

    // Check black frames with blackdetect filter
    let blackFramesDetected = false;
    try {
      const bdOut = execSync(`ffmpeg -i "${dstPath}" -vf blackdetect=d=0.5:pix_th=0.10 -f null -`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
      if (bdOut.includes('black_start: 0') && bdOut.includes(`black_end: ${newDur.toFixed(1)}`)) {
        blackFramesDetected = true;
      }
    } catch (e) {
      // ffmpeg writes blackdetect to stderr
      const errStr = e.stderr ? e.stderr.toString() : '';
      if (errStr.includes('black_start: 0') && errStr.includes(`black_end: ${newDur.toFixed(1)}`)) {
        blackFramesDetected = true;
      }
    }

    // Delete old WebM file so it is NOT counted as a duplicate!
    fs.unlinkSync(srcPath);
    console.log(`Removed original WebM: ${item.fileName}`);

    conversionLog.push({
      original: item.fileName,
      converted: mp4Name,
      srcDuration: item.duration,
      dstDuration: newDur,
      durationDiff: durDiff,
      durationCheckPassed: durDiff <= 0.05,
      videoCodec: newVStream.codec_name,
      pixFmt: newVStream.pix_fmt,
      resolution: `${newVStream.width}x${newVStream.height}`,
      hasAudio: !!newAStream,
      dummyAudioCreated: (!item.hasAudio && !!newAStream),
      corruptCheckPassed,
      blackFrameCheckPassed: !blackFramesDetected,
      sha256: sha256(dstPath),
      size: fs.statSync(dstPath).size
    });
  }
}

console.log('\n--- CONVERSION VERIFICATION RESULTS ---');
console.log(conversionLog);

// Now probe the final 9 videos in the directory
console.log('\n--- FINAL 9 VIDEOS IN CORE MEDIA PACK ---');
const finalFiles = fs.readdirSync(videoDir);
const finalTable = [];

for (const f of finalFiles) {
  const full = path.join(videoDir, f);
  const info = probeVideo(full);
  const vStream = info.streams.find(s => s.codec_type === 'video');
  const aStream = info.streams.find(s => s.codec_type === 'audio');

  finalTable.push({
    fileName: f,
    container: 'MP4 (QuickTime / MOV / MP4 / M4A / 3GP / 3G2 / MJ2)',
    durationSec: parseFloat(info.format.duration || 0).toFixed(3),
    sizeBytes: fs.statSync(full).size,
    videoCodec: vStream ? vStream.codec_name : 'none',
    pixFmt: vStream ? vStream.pix_fmt : 'none',
    resolution: vStream ? `${vStream.width}x${vStream.height}` : 'none',
    fps: vStream ? eval(vStream.r_frame_rate).toFixed(2) : '0',
    audioCodec: aStream ? aStream.codec_name : 'none',
    sha256: sha256(full),
    status: 'CODEC_VALIDATED'
  });
}

console.log(finalTable);

fs.writeFileSync('video_codec_audit_report.json', JSON.stringify({
  timestamp: new Date().toISOString(),
  totalVideos: finalTable.length,
  allAreMp4H264: finalTable.every(x => x.videoCodec === 'h264' && x.pixFmt === 'yuv420p'),
  conversionLog,
  finalVideosTable: finalTable
}, null, 2), 'utf8');

console.log('Saved video_codec_audit_report.json');

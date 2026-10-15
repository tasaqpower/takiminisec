import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs';
import { spawnSync } from 'child_process';

async function testFullExport300() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9293',
    '--no-first-run',
    '--disable-web-security',
    '--allow-running-insecure-content',
    '--autoplay-policy=no-user-gesture-required',
    '--user-data-dir=C:\\Windows\\Temp\\cdp_test_9293',
  ]);
  
  await new Promise(r => setTimeout(r, 1500));
  const v = await (await fetch('http://127.0.0.1:9293/json/version')).json();
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise(r => ws.once('open', r));

  let msgId = 1;
  const send = (m, p, s) => new Promise(res => {
    const id = msgId++;
    const h = d => { const j = JSON.parse(d); if (j.id === id) { ws.off('message', h); res(j.result); }};
    ws.on('message', h);
    const payload = { id, method: m, params: p };
    if (s) payload.sessionId = s;
    ws.send(JSON.stringify(payload));
  });

  const t = await send('Target.createTarget', { url: 'about:blank' });
  const a = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });

  const evalResult = await send('Runtime.evaluate', {
    expression: `(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d');
      const canvasStream = canvas.captureStream(0);
      const videoTrack = canvasStream.getVideoTracks()[0];
      
      // Setup Web Audio (10s sine wave for testing audio sync)
      const audioCtx = new AudioContext({ sampleRate: 48000 });
      const destNode = audioCtx.createMediaStreamDestination();
      const osc = audioCtx.createOscillator();
      osc.frequency.setValueAtTime(440, audioCtx.currentTime);
      osc.connect(destNode);
      osc.start();
      
      const combinedStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...destNode.stream.getAudioTracks(),
      ]);

      const mime = 'video/mp4;codecs=avc1.42E01E,mp4a.40.2';
      const actualMime = MediaRecorder.isTypeSupported(mime) ? mime : 'video/mp4';

      const chunks = [];
      const recorder = new MediaRecorder(combinedStream, {
        mimeType: actualMime,
        videoBitsPerSecond: 8000000
      });
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

      const fps = 30;
      const duration = 10;
      const totalFrames = duration * fps; // 300
      const frameIntervalMs = 1000 / fps;

      // Draw initial frame 0
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(0, 0, 1920, 1080);
      ctx.fillStyle = '#ffffff';
      ctx.font = '64px sans-serif';
      ctx.fillText('Frame 0 at 0.00s', 200, 500);
      videoTrack.requestFrame();

      recorder.start(100);
      const startTime = performance.now();

      for (let i = 1; i < totalFrames; i++) {
        const frameTime = i / fps;
        
        ctx.fillStyle = (i % 2 === 0) ? '#1e293b' : '#0f172a';
        ctx.fillRect(0, 0, 1920, 1080);
        ctx.fillStyle = '#38bdf8';
        ctx.font = '64px sans-serif';
        ctx.fillText('Frame ' + i + ' at ' + frameTime.toFixed(3) + 's', 200, 500);
        
        if (frameTime >= 9.0) {
          ctx.fillStyle = '#f43f5e';
          ctx.font = '72px sans-serif';
          ctx.fillText('ANIMATION AT SECOND 9 ACTIVE', 200, 650);
        }
        
        videoTrack.requestFrame();

        const targetTime = startTime + i * frameIntervalMs;
        const remaining = targetTime - performance.now();
        if (remaining > 2) {
          await new Promise(r => setTimeout(r, remaining - 1));
        }
        while (performance.now() < targetTime) {}
      }

      // Finish at exact 10.00s
      const finalTarget = startTime + totalFrames * frameIntervalMs;
      while (performance.now() < finalTarget) {}
      
      osc.stop();
      recorder.stop();

      const blob = await new Promise(r => { recorder.onstop = () => r(new Blob(chunks, { type: actualMime })); });
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      const CHUNK = 8192;
      for (let i = 0; i < bytes.length; i += CHUNK) {
        binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
      }
      return btoa(binary);
    })()`,
    awaitPromise: true,
    returnByValue: true
  }, a.sessionId);

  const buffer = Buffer.from(evalResult.result.value, 'base64');
  fs.writeFileSync('test-full-export-300.mp4', buffer);
  console.log('Saved test-full-export-300.mp4, size:', buffer.length);
  chrome.kill();

  // Probe with ffprobe
  const probe = spawnSync('ffprobe', [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-count_frames',
    '-show_entries', 'stream=nb_read_frames,r_frame_rate,avg_frame_rate,duration',
    '-show_entries', 'format=duration',
    '-of', 'json',
    'test-full-export-300.mp4'
  ], { encoding: 'utf8' });

  console.log('FFPROBE OUTPUT:\n', probe.stdout);
}

testFullExport300().catch(console.error);

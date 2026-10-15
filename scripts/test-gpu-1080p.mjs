import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs';

async function testGpu() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9287',
    '--no-first-run',
    '--disable-web-security',
    '--allow-running-insecure-content',
    '--autoplay-policy=no-user-gesture-required',
    '--user-data-dir=C:\\Windows\\Temp\\cdp_test_9287',
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const v = await (await fetch('http://127.0.0.1:9287/json/version')).json();
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise(r => ws.once('open', r));

  const send = (m, p, s) => new Promise(res => {
    const id = Math.random();
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
      const stream = canvas.captureStream(0);
      const track = stream.getVideoTracks()[0];
      const mime = 'video/mp4;codecs=avc1';
      
      const chunks = [];
      const recorder = new MediaRecorder(stream, { mimeType: mime });
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      
      const fps = 30;
      const totalFrames = 300;
      const frameIntervalMs = 1000 / fps;
      
      recorder.start();
      const startTime = performance.now();
      
      for (let i = 0; i < totalFrames; i++) {
        ctx.fillStyle = (i % 2 === 0) ? 'blue' : 'green';
        ctx.fillRect(0, 0, 1920, 1080);
        ctx.fillStyle = 'white';
        ctx.font = '48px sans-serif';
        ctx.fillText('Frame ' + i, 100, 100);
        track.requestFrame();
        
        const targetTime = startTime + (i + 1) * frameIntervalMs;
        while (performance.now() < targetTime - 2) {
          await new Promise(r => setTimeout(r, 1));
        }
        while (performance.now() < targetTime) {}
      }
      
      recorder.stop();
      const blob = await new Promise(r => { recorder.onstop = () => r(new Blob(chunks, { type: mime })); });
      const buf = await blob.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      return btoa(binary);
    })()`,
    awaitPromise: true,
    returnByValue: true
  }, a.sessionId);

  const buffer = Buffer.from(evalResult.result.value, 'base64');
  fs.writeFileSync('test-gpu-1080p.mp4', buffer);
  console.log('Saved test-gpu-1080p.mp4, size:', buffer.length);
  chrome.kill();
  process.exit(0);
}

testGpu().catch(console.error);

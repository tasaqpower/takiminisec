import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs';

async function run() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9289',
    '--user-data-dir=C:\\Windows\\Temp\\cdp_test_9289',
  ]);
  
  await new Promise(r => setTimeout(r, 1500));
  const versionRes = await fetch('http://127.0.0.1:9289/json/version');
  const version = await versionRes.json();
  const client = new WebSocket(version.webSocketDebuggerUrl);
  
  let id = 1;
  const send = (method, params = {}, sessionId) => new Promise((resolve) => {
    const curId = id++;
    const handler = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === curId) { client.off('message', handler); resolve(msg.result); }
    };
    client.on('message', handler);
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    client.send(JSON.stringify(payload));
  });

  client.on('open', async () => {
    const target = await send('Target.createTarget', { url: 'about:blank' });
    const attach = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    const sessionId = attach.sessionId;

    const evalResult = await send('Runtime.evaluate', {
      expression: `(async () => {
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext('2d');
        const stream = canvas.captureStream(0);
        const track = stream.getVideoTracks()[0];
        const mime = 'video/mp4;codecs=avc1';
        
        // Initial draw
        ctx.fillStyle = 'black';
        ctx.fillRect(0,0,640,360);
        track.requestFrame();
        
        // Warm up MediaRecorder pipeline
        const warmup = new MediaRecorder(stream, { mimeType: mime });
        warmup.start();
        track.requestFrame();
        await new Promise(r => setTimeout(r, 150));
        warmup.stop();
        await new Promise(r => { warmup.onstop = r; });
        
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
          ctx.fillRect(0, 0, 640, 360);
          ctx.fillStyle = 'white';
          ctx.font = '24px sans-serif';
          ctx.fillText('Frame ' + i, 50, 50);
          track.requestFrame();
          
          const targetTime = startTime + (i + 1) * frameIntervalMs;
          while (performance.now() < targetTime - 2) {
            await new Promise(r => setTimeout(r, 1));
          }
          while (performance.now() < targetTime) {}
        }
        
        // Wait small interval for encoder to process final frame
        await new Promise(r => setTimeout(r, 30));
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
    }, sessionId);

    if (evalResult.exceptionDetails) {
      console.error('Eval error:', evalResult.exceptionDetails);
    } else {
      const buffer = Buffer.from(evalResult.result.value, 'base64');
      fs.writeFileSync('test-warmup-300.mp4', buffer);
      console.log('Saved test-warmup-300.mp4, size:', buffer.length);
    }
    chrome.kill();
    process.exit(0);
  });
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

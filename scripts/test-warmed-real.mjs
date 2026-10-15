import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs';

async function run() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9291',
    '--user-data-dir=C:\\Windows\\Temp\\cdp_test_9291',
  ]);
  
  await new Promise(r => setTimeout(r, 1500));
  const versionRes = await fetch('http://127.0.0.1:9291/json/version');
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
        const mime = 'video/mp4;codecs=avc1';

        // 1. Warm up browser encoder subsystem
        const dummyCanvas = document.createElement('canvas');
        dummyCanvas.width = 64;
        dummyCanvas.height = 64;
        const dummyStream = dummyCanvas.captureStream(0);
        const dummyTrack = dummyStream.getVideoTracks()[0];
        const dummyRec = new MediaRecorder(dummyStream, { mimeType: mime });
        let gotChunk = false;
        dummyRec.ondataavailable = () => { gotChunk = true; };
        dummyRec.start(50);
        dummyTrack.requestFrame();
        
        await new Promise(resolve => {
          const iv = setInterval(() => {
            dummyTrack.requestFrame();
            if (gotChunk) {
              clearInterval(iv);
              resolve();
            }
          }, 33);
          setTimeout(() => { clearInterval(iv); resolve(); }, 1500);
        });
        dummyRec.stop();
        await new Promise(r => { dummyRec.onstop = r; });
        await new Promise(r => setTimeout(r, 100));

        // 2. Real Recording
        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext('2d');
        const stream = canvas.captureStream(0);
        const track = stream.getVideoTracks()[0];

        const chunks = [];
        const recorder = new MediaRecorder(stream, { mimeType: mime });
        recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

        const fps = 30;
        const totalFrames = 300;
        const frameIntervalMs = 1000 / fps;

        ctx.fillStyle = 'blue';
        ctx.fillRect(0,0,640,360);
        track.requestFrame();

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
          const remaining = targetTime - performance.now();
          if (remaining > 2) {
            await new Promise(r => setTimeout(r, remaining - 1));
          }
        }

        await new Promise(r => setTimeout(r, 60));
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
      fs.writeFileSync('test-warmed-real.mp4', buffer);
      console.log('Saved test-warmed-real.mp4, size:', buffer.length);
    }
    chrome.kill();
    process.exit(0);
  });
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});

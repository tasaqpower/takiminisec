import { spawn } from 'child_process';
import WebSocket from 'ws';

async function main() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--user-data-dir=' + process.env.TEMP + '\\chrome_test_profile_' + Date.now(),
  ]);

  let versionData = null;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      if (res.ok) { versionData = await res.json(); break; }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }

  const newTabRes = await fetch('http://127.0.0.1:9222/json/new?http://localhost:5173/video-editor', { method: 'PUT' });
  const tab = await newTabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.once('open', resolve));

  let msgId = 1;
  const pending = new Map();
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  });

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Console.enable');

  await new Promise((r) => setTimeout(r, 3000));

  // Run in-browser test: inspect HTMLVideoElement behavior
  const testCode = `
    (async () => {
      // Create a real video blob
      const vCanvas = document.createElement('canvas');
      vCanvas.width = 300;
      vCanvas.height = 300;
      const vCtx = vCanvas.getContext('2d');
      const stream = vCanvas.captureStream(30);
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.start();
      for (let i = 0; i < 15; i++) {
        vCtx.fillStyle = '#00ff88';
        vCtx.fillRect(0, 0, 300, 300);
        await new Promise((r) => setTimeout(r, 30));
      }
      rec.stop();
      await new Promise((r) => rec.onstop = r);

      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);

      // Create video element
      const v = document.createElement('video');
      v.muted = true;
      v.playsInline = true;
      v.src = url;

      const state0 = { readyState: v.readyState, videoWidth: v.videoWidth, seeking: v.seeking };

      // Wait for loadeddata
      await new Promise((res) => {
        v.onloadeddata = res;
      });

      const state1 = { readyState: v.readyState, videoWidth: v.videoWidth, seeking: v.seeking };

      // Test draw on canvas at state1
      const testC = document.createElement('canvas');
      testC.width = 300;
      testC.height = 300;
      const testCtx = testC.getContext('2d');
      testCtx.drawImage(v, 0, 0);
      const pix1 = testCtx.getImageData(150, 150, 1, 1).data;

      // Now set currentTime to 0.2 (causes seeking)
      v.currentTime = 0.2;
      const state2 = { readyState: v.readyState, videoWidth: v.videoWidth, seeking: v.seeking };
      testCtx.clearRect(0, 0, 300, 300);
      testCtx.drawImage(v, 0, 0);
      const pix2DuringSeeking = testCtx.getImageData(150, 150, 1, 1).data;

      // Wait for seeked
      await new Promise((res) => {
        v.onseeked = res;
      });
      const state3 = { readyState: v.readyState, videoWidth: v.videoWidth, seeking: v.seeking };
      testCtx.clearRect(0, 0, 300, 300);
      testCtx.drawImage(v, 0, 0);
      const pix3AfterSeeked = testCtx.getImageData(150, 150, 1, 1).data;

      return {
        state0,
        state1,
        pix1: Array.from(pix1),
        state2,
        pix2DuringSeeking: Array.from(pix2DuringSeeking),
        state3,
        pix3AfterSeeked: Array.from(pix3AfterSeeked),
      };
    })()
  `;

  const result = await send('Runtime.evaluate', {
    expression: testCode,
    awaitPromise: true,
    returnByValue: true,
  });

  console.log('Video behavior result:', JSON.stringify(result.result.value, null, 2));

  ws.close();
  chromeProc.kill();
  process.exit(0);
}

main().catch(console.error);

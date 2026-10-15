import { spawn } from 'child_process';
import WebSocket from 'ws';

async function main() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9265',
    '--no-first-run',
    '--autoplay-policy=no-user-gesture-required',
    '--user-data-dir=C:\\Windows\\Temp\\test_chrome_play'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const res = await fetch('http://127.0.0.1:9265/json/version');
  const ver = await res.json();
  const ws = new WebSocket(ver.webSocketDebuggerUrl);
  await new Promise(r => ws.once('open', r));
  let id = 1;
  const send = (method, params = {}) => new Promise((resolve) => {
    const curId = id++;
    const handler = (data) => {
      const msg = JSON.parse(data);
      if (msg.id === curId) {
        ws.off('message', handler);
        resolve(msg.result);
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id: curId, method, params }));
  });
  await send('Target.createTarget', { url: 'http://localhost:5174/video-editor' });
  const targets = await (await fetch('http://127.0.0.1:9265/json')).json();
  const pageTab = targets.find(t => t.url.includes('video-editor'));
  const pageWs = new WebSocket(pageTab.webSocketDebuggerUrl);
  await new Promise(r => pageWs.once('open', r));
  const pageSend = (method, params = {}) => new Promise((resolve) => {
    const curId = id++;
    const handler = (data) => {
      const msg = JSON.parse(data);
      if (msg.id === curId) {
        pageWs.off('message', handler);
        resolve(msg.result);
      }
    };
    pageWs.on('message', handler);
    pageWs.send(JSON.stringify({ id: curId, method, params }));
  });
  await pageSend('Runtime.enable');
  await pageSend('Page.enable');
  const testRes = await pageSend('Runtime.evaluate', {
    expression: `(async () => {
      const v = document.createElement('video');
      v.src = '/video-assets/sample-video.webm';
      v.muted = true;
      v.playsInline = true;
      document.body.appendChild(v);
      await new Promise(r => { v.onloadedmetadata = r; setTimeout(r, 2000); });
      const t0 = v.currentTime;
      await v.play();
      await new Promise(r => setTimeout(r, 1500));
      const t1 = v.currentTime;
      const paused = v.paused;
      return { t0, t1, paused, duration: v.duration };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Test result:', JSON.stringify(testRes.result.value));
  chrome.kill();
  process.exit(0);
}

main().catch(console.error);

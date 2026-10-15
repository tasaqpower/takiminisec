import { spawn } from 'child_process';
import WebSocket from 'ws';

async function testGpuSpeed() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9292',
    '--no-first-run',
    '--disable-web-security',
    '--allow-running-insecure-content',
    '--autoplay-policy=no-user-gesture-required',
    '--user-data-dir=C:\\Windows\\Temp\\cdp_test_9292',
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const v = await (await fetch('http://127.0.0.1:9292/json/version')).json();
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

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d');
      
      const t0 = performance.now();
      for (let i = 0; i < 100; i++) {
        ctx.fillStyle = i % 2 === 0 ? 'red' : 'blue';
        ctx.fillRect(0, 0, 1920, 1080);
      }
      const total = performance.now() - t0;
      return { totalMs: total, perFrameMs: total / 100 };
    })()`,
    returnByValue: true
  }, a.sessionId);

  console.log('1080p 100 frames timing:', res.result.value);
  chrome.kill();
  process.exit(0);
}

testGpuSpeed().catch(console.error);

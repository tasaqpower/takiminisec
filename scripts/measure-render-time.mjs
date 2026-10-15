import { spawn } from 'child_process';
import WebSocket from 'ws';

async function measureRenderTime() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9288',
    '--user-data-dir=C:\\Windows\\Temp\\cdp_test_9288',
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const v = await (await fetch('http://127.0.0.1:9288/json/version')).json();
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

  const t = await send('Target.createTarget', { url: 'http://localhost:5173/video-editor' });
  const a = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
  await new Promise(r => setTimeout(r, 3000));

  const res = await send('Runtime.evaluate', {
    expression: `(async () => {
      // Find canvas or create canvas and render
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d');
      
      const times = [];
      for (let i = 0; i < 30; i++) {
        const t0 = performance.now();
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, 1920, 1080);
        ctx.fillStyle = '#38bdf8';
        ctx.font = '64px sans-serif';
        ctx.fillText('Testing 1080p frame ' + i, 200, 200);
        times.push(performance.now() - t0);
      }
      const avg = times.reduce((a, b) => a + b, 0) / times.length;
      return { avgMs: avg, minMs: Math.min(...times), maxMs: Math.max(...times) };
    })()`,
    awaitPromise: true,
    returnByValue: true
  }, a.sessionId);

  console.log('2D Canvas 1080p render timing:', res.result.value);
  chrome.kill();
  process.exit(0);
}

measureRenderTime().catch(console.error);

import { spawn } from 'child_process';
import WebSocket from 'ws';

async function test() {
  const c = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9277',
    '--no-first-run'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const v = await (await fetch('http://127.0.0.1:9277/json/version')).json();
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise(r => ws.once('open', r));
  let id = 1;
  const send = (m, p, s) => new Promise(res => {
    const i = id++;
    const h = d => { const j = JSON.parse(d); if (j.id === i) { ws.off('message', h); res(j.result); } };
    ws.on('message', h);
    const payload = { id: i, method: m, params: p };
    if (s) payload.sessionId = s;
    ws.send(JSON.stringify(payload));
  });
  const t = await send('Target.createTarget', { url: 'http://localhost:5173/video-editor' });
  const a = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });
  await new Promise(r => setTimeout(r, 3500));
  const r = await send('Runtime.evaluate', {
    expression: `(async () => {
      const { exportEngine } = await import('/features/video-editor/engine/exportEngine.ts');
      const project = window.__formaEditor?.project;
      if (!project) return { error: 'No project' };
      const options = {
        format: 'mp4',
        resolution: { width: 1920, height: 1080 },
        fps: 30,
        quality: 'high',
        filename: 'benchmark_export.mp4'
      };
      const t0 = performance.now();
      const blob = await exportEngine.exportProject(project, options, 0, (p) => {});
      const elapsed = performance.now() - t0;
      return { elapsedMs: Math.round(elapsed), blobSize: blob ? blob.size : 0, duration: project.duration };
    })()`,
    awaitPromise: true,
    returnByValue: true
  }, a.sessionId);
  console.log('exportProject benchmark:', r.result.value);
  c.kill();
}
test().catch(console.error);

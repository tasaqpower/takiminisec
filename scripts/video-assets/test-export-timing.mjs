import { spawn, spawnSync } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';

async function run() {
  const c = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9288',
    '--no-first-run',
    '--autoplay-policy=no-user-gesture-required'
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const v = await (await fetch('http://127.0.0.1:9288/json/version')).json();
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
  await new Promise(r => setTimeout(r, 3000));

  console.log('Testing exportProject timing...');
  const expRes = await send('Runtime.evaluate', {
    expression: `(async () => {
      const { exportEngine } = await import('/features/video-editor/engine/exportEngine.ts');
      const project = window.__formaEditor?.project;
      if (!project) return { error: 'No project' };
      
      const options = {
        format: 'mp4',
        resolution: { width: 1280, height: 720 },
        fps: 30,
        quality: 'high',
        filename: 'test_timing.mp4'
      };

      const t0 = performance.now();
      const blob = await exportEngine.exportProject(project, options, 0, () => {});
      const elapsed = performance.now() - t0;
      if (!blob) return { error: 'No blob' };

      const reader = new FileReader();
      const b64 = await new Promise(res => {
        reader.onloadend = () => {
          const s = reader.result || '';
          res(s.includes(';base64,') ? s.split(';base64,')[1] : s.slice(s.lastIndexOf(',') + 1));
        };
        reader.readAsDataURL(blob);
      });

      return {
        elapsedMs: Math.round(elapsed),
        sizeBytes: blob.size,
        base64: b64
      };
    })()`,
    awaitPromise: true,
    returnByValue: true
  }, a.sessionId);

  const val = expRes?.result?.value;
  console.log('Export result:', { elapsedMs: val?.elapsedMs, sizeBytes: val?.sizeBytes, error: val?.error });

  if (val?.base64) {
    const tmpFile = path.resolve('test_timing.mp4');
    fs.writeFileSync(tmpFile, Buffer.from(val.base64, 'base64'));

    const probe = spawnSync('ffprobe', [
      '-v', 'error',
      '-select_streams', 'v:0',
      '-count_frames',
      '-show_entries', 'stream=codec_name,width,height,avg_frame_rate,duration,nb_read_frames',
      '-show_entries', 'format=duration',
      '-of', 'json',
      tmpFile
    ], { encoding: 'utf-8' });

    console.log('FFprobe output:\n', probe.stdout);
    fs.unlinkSync(tmpFile);
  }

  c.kill();
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});

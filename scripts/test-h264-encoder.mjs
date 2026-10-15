import { spawn } from 'child_process';
import WebSocket from 'ws';

async function testH264Encoder() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9285',
    '--user-data-dir=C:\\Windows\\Temp\\cdp_test_9285',
    '--unsafely-treat-insecure-origin-as-secure=http://localhost:5173',
    '--enable-gpu',
    '--use-gl=angle',
    '--use-angle=d3d11',
    '--enable-gpu-rasterization',
    '--enable-zero-copy',
    '--ignore-gpu-blocklist',
    '--enable-features=WebCodecs,WebCodecsPlatformVideoEncoder,AcceleratedVideoEncoder',
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const v = await (await fetch('http://127.0.0.1:9285/json/version')).json();
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
  await new Promise(r => setTimeout(r, 2000));
  
  const res = await send('Runtime.evaluate', {
    expression: `(async () => {
      const codecs = [
        'avc1.42001e', 'avc1.42001f', 'avc1.42E01E', 'avc1.4D401F', 'avc1.64001F', 'avc1.640028',
        'vp8', 'vp09.00.10.08', 'av01.0.04M.08'
      ];
      const results = {};
      for (const c of codecs) {
        try {
          const r = await VideoEncoder.isConfigSupported({
            codec: c,
            width: 1920,
            height: 1080,
            bitrate: 8000000,
            framerate: 30,
            hardwareAcceleration: 'prefer-hardware'
          });
          results[c] = r.supported;
        } catch (e) {
          results[c] = e.message;
        }
      }
      return results;
    })()`,
    awaitPromise: true,
    returnByValue: true
  }, a.sessionId);
  console.log('VideoEncoder results with GPU flags:', JSON.stringify(res.result.value, null, 2));
  chrome.kill();
  process.exit(0);
}

testH264Encoder().catch(console.error);

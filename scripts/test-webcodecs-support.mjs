import { spawn } from 'child_process';
import WebSocket from 'ws';

async function testWebCodecs() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9280',
    '--user-data-dir=C:\\Windows\\Temp\\cdp_test_9280',
    '--unsafely-treat-insecure-origin-as-secure=http://localhost:5173',
    '--use-gl=angle',
    '--use-angle=d3d11',
    '--enable-gpu-rasterization',
    '--enable-zero-copy',
    '--enable-features=WebCodecs,WebCodecsPlatformAudioDecoder,WebCodecsPlatformAudioEncoder',
  ]);
  await new Promise(r => setTimeout(r, 1500));
  const versionRes = await fetch('http://127.0.0.1:9280/json/version');
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
    const payload = { id: curId, method, params };
    if (sessionId) payload.sessionId = sessionId;
    client.send(JSON.stringify(payload));
  });

  client.on('open', async () => {
    const target = await send('Target.createTarget', { url: 'http://localhost:5173/video-editor' });
    const attach = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    const sessionId = attach.sessionId;
    await new Promise(r => setTimeout(r, 2000));
    const res = await send('Runtime.evaluate', {
      expression: `(async () => {
        const support = {
          href: window.location.href,
          isSecureContext: window.isSecureContext,
          hasVideoEncoder: typeof VideoEncoder !== 'undefined',
          hasAudioEncoder: typeof AudioEncoder !== 'undefined',
          hasVideoFrame: typeof VideoFrame !== 'undefined',
        };
        const codecsToTest = [
          'avc1.42001f',
          'avc1.42E01E',
          'avc1.4d001f',
          'avc1.64001f',
          'vp8',
          'vp09.00.10.08',
          'av01.0.04M.08',
        ];
        support.videoCodecs = {};
        for (const c of codecsToTest) {
          try {
            const res = await VideoEncoder.isConfigSupported({
              codec: c,
              width: 1920,
              height: 1080,
              bitrate: 8000000,
              framerate: 30,
            });
            support.videoCodecs[c] = res.supported;
          } catch (e) {
            support.videoCodecs[c] = e.message;
          }
        }
        if (support.hasAudioEncoder) {
          try {
            support.aac = await AudioEncoder.isConfigSupported({
              codec: 'mp4a.40.2',
              sampleRate: 48000,
              numberOfChannels: 2,
              bitrate: 192000,
            });
          } catch (e) {
            support.aacError = e.message;
          }
        }
        return support;
      })()`,
      awaitPromise: true,
      returnByValue: true
    }, sessionId);
    console.log('WebCodecs support:', JSON.stringify(res.result.value, null, 2));
    chrome.kill();
    process.exit(0);
  });
}

testWebCodecs().catch(err => {
  console.error(err);
  process.exit(1);
});

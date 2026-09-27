import { spawn } from 'child_process';
import WebSocket from 'ws';

async function test() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9239',
    '--no-first-run',
    '--disable-gpu',
    '--user-data-dir=C:\\Windows\\Temp\\cdp_test_mime3',
  ]);
  await new Promise(r => setTimeout(r, 1200));
  const newTabRes = await fetch('http://127.0.0.1:9239/json/new?http://localhost:5173/video-editor', { method: 'PUT' });
  const tab = await newTabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(r => ws.once('open', r));

  let id = 1;
  const send = (method, params = {}) => new Promise((resolve) => {
    const curId = id++;
    const handler = (data) => {
      const m = JSON.parse(data);
      if (m.id === curId) { ws.off('message', handler); resolve(m.result); }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id: curId, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await new Promise(r => setTimeout(r, 2000));

  const res = await send('Runtime.evaluate', {
    expression: `(() => {
      const types = [
        'video/mp4',
        'video/mp4;codecs=avc1',
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4;codecs=avc1.4d002a',
        'video/mp4;codecs=h264',
        'video/mp4;codecs=avc1,aac',
        'video/mp4;codecs=avc1,opus',
        'video/webm',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm;codecs=h264',
      ];
      if (typeof MediaRecorder === 'undefined') return 'NO_MEDIA_RECORDER';
      return JSON.stringify(types.map(t => ({ mime: t, supported: MediaRecorder.isTypeSupported(t) })));
    })()`,
    returnByValue: true,
  });

  console.log('CHROME MIME RESULTS:', res?.result?.value);

  // Also check WebCodecs VideoEncoder support
  const wcRes = await send('Runtime.evaluate', {
    expression: `(async () => {
      if (typeof VideoEncoder === 'undefined') return { webCodecs: false };
      const config = {
        codec: 'avc1.42001E',
        width: 640,
        height: 360,
        bitrate: 1000000,
        framerate: 30,
      };
      try {
        const support = await VideoEncoder.isConfigSupported(config);
        return { webCodecs: true, support };
      } catch (e) {
        return { webCodecs: true, error: String(e) };
      }
    })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  console.log('WEBCODECS SUPPORT:', wcRes?.result?.value);

  ws.close();
  chrome.kill();
}
test().catch(console.error);

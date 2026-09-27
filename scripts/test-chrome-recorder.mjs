import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs/promises';

async function test() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9250',
    '--no-first-run',
    '--disable-gpu',
    '--user-data-dir=C:\\Windows\\Temp\\cdp_test_recorder',
  ]);
  await new Promise((r) => setTimeout(r, 1200));

  const newTabRes = await fetch('http://127.0.0.1:9250/json/new?http://localhost:5173/video-editor', { method: 'PUT' });
  const tab = await newTabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r) => ws.once('open', r));

  let id = 1;
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const curId = id++;
      const handler = (data) => {
        const m = JSON.parse(data);
        if (m.id === curId) {
          ws.off('message', handler);
          resolve(m.result);
        }
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });

  await send('Page.enable');
  await send('Runtime.enable');
  await new Promise((r) => setTimeout(r, 1000));

  const evalResult = await send('Runtime.evaluate', {
    expression: `(async () => {
      const candidates = [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4;codecs=avc1,opus',
        'video/mp4;codecs=avc1',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm',
      ];
      const support = {};
      for (const c of candidates) {
        support[c] = MediaRecorder.isTypeSupported(c);
      }

      // Test recording with first supported mp4
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      const ctx = canvas.getContext('2d');
      const vStream = canvas.captureStream(30);

      const aCtx = new AudioContext();
      const dest = aCtx.createMediaStreamDestination();
      const osc = aCtx.createOscillator();
      osc.connect(dest);
      osc.start();

      const combined = new MediaStream([
        ...vStream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);

      const testResults = {};

      for (const mime of candidates) {
        if (!MediaRecorder.isTypeSupported(mime)) continue;
        try {
          const rec = new MediaRecorder(combined, { mimeType: mime });
          const chunks = [];
          rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
          rec.start();
          
          ctx.fillStyle = 'blue';
          ctx.fillRect(0,0,320,180);

          await new Promise(r => setTimeout(r, 500));
          
          await new Promise(resolve => {
            rec.onstop = resolve;
            rec.stop();
          });

          const blob = new Blob(chunks, { type: mime });
          const buf = await blob.arrayBuffer();
          const u8 = new Uint8Array(buf.slice(0, 16));
          const hex = Array.from(u8).map(b => b.toString(16).padStart(2, '0')).join(' ');

          testResults[mime] = {
            size: blob.size,
            first16Hex: hex,
          };
        } catch (e) {
          testResults[mime] = { error: e.message };
        }
      }

      osc.stop();
      aCtx.close();

      return { support, testResults };
    })()`,
    returnByValue: true,
    awaitPromise: true,
  });

  console.log(JSON.stringify(evalResult.result.value, null, 2));
  ws.close();
  chrome.kill();
}

test().catch(console.error);

import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs';

async function testWarmupTiming() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9294',
    '--user-data-dir=C:\\Windows\\Temp\\cdp_test_9294',
  ]);
  
  await new Promise(r => setTimeout(r, 1500));
  const versionRes = await fetch('http://127.0.0.1:9294/json/version');
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
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    client.send(JSON.stringify(payload));
  });

  client.on('open', async () => {
    const target = await send('Target.createTarget', { url: 'about:blank' });
    const attach = await send('Target.attachToTarget', { targetId: target.targetId, flatten: true });
    const sessionId = attach.sessionId;

    const evalResult = await send('Runtime.evaluate', {
      expression: `(async () => {
        const mime = 'video/mp4;codecs=avc1';

        // 1. Warm up MediaRecorder 1
        const dummyCanvas = document.createElement('canvas');
        dummyCanvas.width = 64;
        dummyCanvas.height = 64;
        const dummyStream = dummyCanvas.captureStream(0);
        const dummyTrack = dummyStream.getVideoTracks()[0];
        
        const dummyRec = new MediaRecorder(dummyStream, { mimeType: mime });
        let firstChunkTime1 = 0;
        const t0_1 = performance.now();
        dummyRec.ondataavailable = e => {
          if (e.data.size > 0 && firstChunkTime1 === 0) {
            firstChunkTime1 = performance.now() - t0_1;
          }
        };
        dummyRec.start(50);
        dummyTrack.requestFrame();
        
        // Wait until first chunk or timeout
        await new Promise(res => {
          const iv = setInterval(() => {
            dummyTrack.requestFrame();
            if (firstChunkTime1 > 0) { clearInterval(iv); res(); }
          }, 30);
          setTimeout(() => { clearInterval(iv); res(); }, 3000);
        });
        
        await new Promise(res => {
          dummyRec.onstop = () => res();
          dummyRec.stop();
        });

        // 2. Now start MediaRecorder 2 (warmed up!)
        const canvas2 = document.createElement('canvas');
        canvas2.width = 1920;
        canvas2.height = 1080;
        const stream2 = canvas2.captureStream(0);
        const track2 = stream2.getVideoTracks()[0];
        
        const rec2 = new MediaRecorder(stream2, { mimeType: mime });
        let firstChunkTime2 = 0;
        const t0_2 = performance.now();
        rec2.ondataavailable = e => {
          if (e.data.size > 0 && firstChunkTime2 === 0) {
            firstChunkTime2 = performance.now() - t0_2;
          }
        };
        rec2.start(50);
        track2.requestFrame();
        
        await new Promise(res => {
          const iv = setInterval(() => {
            track2.requestFrame();
            if (firstChunkTime2 > 0) { clearInterval(iv); res(); }
          }, 30);
          setTimeout(() => { clearInterval(iv); res(); }, 3000);
        });
        
        await new Promise(res => {
          rec2.onstop = () => res();
          rec2.stop();
        });

        return { firstChunkTime1, firstChunkTime2 };
      })()`,
      awaitPromise: true,
      returnByValue: true
    }, sessionId);

    console.log('Warmup timing comparison:', evalResult.result.value);
    chrome.kill();
    process.exit(0);
  });
}

testWarmupTiming().catch(console.error);

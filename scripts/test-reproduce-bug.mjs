import { spawn } from 'child_process';
import WebSocket from 'ws';

async function main() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--user-data-dir=' + process.env.TEMP + '\\chrome_test_profile_' + Date.now(),
  ]);

  let versionData = null;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      if (res.ok) { versionData = await res.json(); break; }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }

  const newTabRes = await fetch('http://127.0.0.1:9222/json/new?http://localhost:5173/video-editor', { method: 'PUT' });
  const tab = await newTabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.once('open', resolve));

  let msgId = 1;
  const pending = new Map();
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      console.log('[BROWSER CONSOLE]', msg.params.type, msg.params.args.map((a) => a.value || a.description).join(' '));
    } else if (msg.method === 'Runtime.exceptionThrown') {
      console.error('[BROWSER EXCEPTION]', msg.params.exceptionDetails);
    }
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  });

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Console.enable');

  await new Promise((r) => setTimeout(r, 3000));

  const testCode = `
    (async () => {
      // Create vivid 720x1280 test video with animation
      const vCanvas = document.createElement('canvas');
      vCanvas.width = 720;
      vCanvas.height = 1280;
      const vCtx = vCanvas.getContext('2d');
      const stream = vCanvas.captureStream(30);
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.start();

      for (let f = 0; f < 30; f++) {
        vCtx.fillStyle = '#ff2255';
        vCtx.fillRect(0, 0, 720, 1280);
        vCtx.fillStyle = '#ffffff';
        vCtx.font = 'bold 70px sans-serif';
        vCtx.fillText('TEST VIDEO ' + f, 80, 400);
        await new Promise((r) => setTimeout(r, 20));
      }
      rec.stop();
      await new Promise((r) => rec.onstop = r);

      const blob = new Blob(chunks, { type: 'video/webm' });
      const file = new File([blob], 'test.webm', { type: 'video/webm' });

      const fileInput = document.querySelector('input[type="file"]');
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));

      // Wait 3 seconds for IndexedDB, blob URL, loadedmetadata, render
      await new Promise((r) => setTimeout(r, 3000));

      const canvas = document.querySelector('canvas');
      const ctx = canvas.getContext('2d');
      const img1 = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let nonBlack1 = 0;
      for (let i = 0; i < img1.data.length; i += 4) {
        if (img1.data[i] > 30 || img1.data[i+1] > 30 || img1.data[i+2] > 30) nonBlack1++;
      }

      // Check all video elements created in DOM
      const allVideos = Array.from(document.querySelectorAll('video')).map((v) => ({
        src: v.src ? v.src.substring(0, 30) : '',
        readyState: v.readyState,
        videoWidth: v.videoWidth,
        videoHeight: v.videoHeight,
        currentTime: v.currentTime,
        paused: v.paused,
      }));

      // Click Metin
      const btns = Array.from(document.querySelectorAll('button'));
      const textTab = btns.find((b) => b.textContent && b.textContent.includes('Metin'));
      textTab?.click();
      await new Promise((r) => setTimeout(r, 500));

      // Click Heading
      const headBtn = Array.from(document.querySelectorAll('button')).find((b) => b.textContent && b.textContent.includes('Başlık (Heading)'));
      headBtn?.click();
      await new Promise((r) => setTimeout(r, 1500));

      const img2 = ctx.getImageData(0, 0, canvas.width, canvas.height);
      let nonBlack2 = 0;
      for (let i = 0; i < img2.data.length; i += 4) {
        if (img2.data[i] > 30 || img2.data[i+1] > 30 || img2.data[i+2] > 30) nonBlack2++;
      }

      return {
        step1_nonBlackPct: (nonBlack1 / (canvas.width * canvas.height)) * 100,
        step2_nonBlackPct: (nonBlack2 / (canvas.width * canvas.height)) * 100,
        allVideos,
      };
    })()
  `;

  const result = await send('Runtime.evaluate', {
    expression: testCode,
    awaitPromise: true,
    returnByValue: true,
  });

  console.log('Result:', JSON.stringify(result.result.value, null, 2));

  ws.close();
  chromeProc.kill();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs/promises';

async function main() {
  const videoBuffer = await fs.readFile('C:\\Users\\sinan\\Downloads\\Ayaz_sleeping_in_quiet_bedroom_20260926001246.mp4');
  const videoBase64 = videoBuffer.toString('base64');
  
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--disable-gpu',
    '--user-data-dir=' + process.env.TEMP + '\\test_black_' + Date.now(),
  ]);
  
  await new Promise(r => setTimeout(r, 1500));
  const newTabRes = await fetch('http://127.0.0.1:9222/json/new?http://localhost:5173/video-editor', { method: 'PUT' });
  const tab = await newTabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(r => ws.once('open', r));
  
  let msgId = 1;
  const pending = new Map();
  ws.on('message', data => {
    const msg = JSON.parse(data);
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
  await new Promise(r => setTimeout(r, 2000));
  
  const evalCode = async (code) => {
    const res = await send('Runtime.evaluate', { expression: code, awaitPromise: true, returnByValue: true });
    return res.result?.value;
  };
  
  const scriptToRun = `
    (async () => {
      const canvas = document.querySelector('canvas');
      const ctx = canvas.getContext('2d');
      const isBlack = () => {
        const d = ctx.getImageData(0,0,canvas.width,canvas.height).data;
        let nb = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i] > 20 || d[i+1] > 20 || d[i+2] > 20) nb++;
        }
        return { nonBlack: nb, ratio: (nb / (canvas.width * canvas.height)) * 100 };
      };
      
      const rawB64 = "${videoBase64}";
      const byteChars = atob(rawB64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      const file = new File([new Uint8Array(byteNumbers)], 'test.mp4', { type: 'video/mp4' });
      
      const fileInput = document.querySelector('input[type="file"]');
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));
      
      const log = [];
      log.push({ t: '0s', stats: isBlack() });
      await new Promise(r => setTimeout(r, 1000));
      log.push({ t: '1s', stats: isBlack() });
      await new Promise(r => setTimeout(r, 2000));
      log.push({ t: '3s', stats: isBlack() });
      await new Promise(r => setTimeout(r, 2000));
      log.push({ t: '5s', stats: isBlack() });
      
      // Check video elements in memory/DOM
      const videoElementsInfo = Array.from(document.querySelectorAll('video')).map(v => ({
        src: v.src ? v.src.substring(0, 30) : '',
        readyState: v.readyState,
        videoWidth: v.videoWidth,
        videoHeight: v.videoHeight,
        currentTime: v.currentTime,
        paused: v.paused,
        seeking: v.seeking
      }));
      
      // Now click 1080p resolution or 16:9 button
      const btn169 = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('16:9'));
      btn169?.click();
      await new Promise(r => setTimeout(r, 600));
      log.push({ t: 'after_click_169', stats: isBlack(), videoElementsInfo });
      
      return log;
    })()
  `;
  
  const result = await evalCode(scriptToRun);
  console.log('Diagnosis Result:', JSON.stringify(result, null, 2));
  
  ws.close();
  chromeProc.kill();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs/promises';

async function main() {
  console.log('--- TESTING LIVE WEBSITE: https://takiminisec.lol/video-editor ---');
  const videoFilePath = 'C:\\Users\\sinan\\Downloads\\Ayaz_sleeping_in_quiet_bedroom_20260926001246.mp4';
  const videoBuffer = await fs.readFile(videoFilePath);
  const videoBase64 = videoBuffer.toString('base64');

  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--disable-gpu',
    '--user-data-dir=' + process.env.TEMP + '\\test_live_' + Date.now(),
  ]);

  let versionData = null;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      if (res.ok) { versionData = await res.json(); break; }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }

  const newTabRes = await fetch('http://127.0.0.1:9222/json/new?https://takiminisec.lol/video-editor', { method: 'PUT' });
  const tab = await newTabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.once('open', resolve));

  let msgId = 1;
  const pending = new Map();
  const consoleLogs = [];

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map((a) => a.value || a.description || JSON.stringify(a)).join(' ');
      consoleLogs.push({ type: msg.params.type, text });
      console.log('[LIVE CONSOLE]', msg.params.type, text);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      console.error('[LIVE EXCEPTION]', msg.params.exceptionDetails);
      consoleLogs.push({ type: 'exception', text: JSON.stringify(msg.params.exceptionDetails) });
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

  const runEval = async (code) => {
    const res = await send('Runtime.evaluate', {
      expression: code,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      console.error('Browser eval exception:', JSON.stringify(res.exceptionDetails, null, 2));
    }
    return res.result?.value;
  };

  const results = await runEval(`
    (async () => {
      const canvas = document.querySelector('canvas');
      if (!canvas) return { error: 'No canvas on page' };
      const ctx = canvas.getContext('2d');

      const measure = () => {
        const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let nb = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i] > 20 || d[i+1] > 20 || d[i+2] > 20) nb++;
        }
        return {
          totalPixels: canvas.width * canvas.height,
          nonBlack: nb,
          ratio: (nb / (canvas.width * canvas.height)) * 100
        };
      };

      const log = [];
      log.push({ step: '1_initial', stats: measure() });

      // Upload video
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

      await new Promise(r => setTimeout(r, 2000));
      log.push({ step: '2_video_uploaded', stats: measure() });

      // Click Metin tab
      const allBtns = Array.from(document.querySelectorAll('button'));
      const textTab = allBtns.find(b => b.textContent && b.textContent.includes('Metin'));
      textTab?.click();
      await new Promise(r => setTimeout(r, 500));

      // Click first text template: "Başlık (Heading)"
      const headBtn = Array.from(document.querySelectorAll('button')).find(
        b => b.textContent && (b.textContent.includes('Başlık (Heading)') || b.textContent.includes('Büyük Başlık'))
      );
      headBtn?.click();
      await new Promise(r => setTimeout(r, 1000));
      log.push({ step: '3_after_heading_template', stats: measure() });

      // Click another preset: Modern Beyaz
      const modernBtn = Array.from(document.querySelectorAll('button')).find(
        b => b.textContent && b.textContent.includes('Modern Beyaz')
      );
      modernBtn?.click();
      await new Promise(r => setTimeout(r, 1000));
      log.push({ step: '4_after_modern_beyaz', stats: measure() });

      // Snapshot
      return { log, snapshot: canvas.toDataURL('image/png') };
    })()
  `);

  console.log('Results on LIVE SITE:', JSON.stringify(results?.log, null, 2));

  if (results?.snapshot) {
    const base64Data = results.snapshot.replace(/^data:image\/png;base64,/, '');
    await fs.writeFile('C:\\Users\\sinan\\OneDrive\\Belgeler\\ChatGPT\\pdf\\scripts\\live_site_snap.png', Buffer.from(base64Data, 'base64'));
    console.log('Snapshot written to live_site_snap.png');
  }

  ws.close();
  chromeProc.kill();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs/promises';

async function main() {
  console.log('--- TESTING ALL 16 TEXT TEMPLATES ---');
  const videoFilePath = 'C:\\Users\\sinan\\Downloads\\Ayaz_sleeping_in_quiet_bedroom_20260926001246.mp4';
  const videoBuffer = await fs.readFile(videoFilePath);
  const videoBase64 = videoBuffer.toString('base64');

  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--disable-gpu',
    '--user-data-dir=' + process.env.TEMP + '\\test_templates_' + Date.now(),
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
  const consoleErrors = [];

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      if (msg.params.type === 'error' || msg.params.type === 'warning') {
        const text = msg.params.args.map((a) => a.value || a.description || JSON.stringify(a)).join(' ');
        consoleErrors.push(text);
        console.log('[BROWSER ERR]', text);
      }
    } else if (msg.method === 'Runtime.exceptionThrown') {
      console.error('[BROWSER EXCEPTION]', msg.params.exceptionDetails);
      consoleErrors.push(JSON.stringify(msg.params.exceptionDetails));
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

  await new Promise((r) => setTimeout(r, 2000));

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
      const log = [];
      log.push({ step: 'video_uploaded', stats: measure() });

      // Click Metin Tab
      const allBtns = Array.from(document.querySelectorAll('button'));
      const textTab = allBtns.find(b => b.textContent && b.textContent.includes('Metin'));
      textTab?.click();
      await new Promise(r => setTimeout(r, 500));

      // Test each template button in the sidebar
      // Find all buttons inside active tab
      const tabContent = textTab.closest('.h-full')?.querySelector('.p-3') || document.querySelector('.space-y-4');
      const templateButtons = Array.from(document.querySelectorAll('button')).filter(b => {
        const txt = b.textContent || '';
        return txt.includes('Ekle') || txt.includes('Başlık') || txt.includes('Beyaz') || txt.includes('Altın') || txt.includes('Neon') || txt.includes('Altyazı');
      });

      log.push({ templateButtonsFound: templateButtons.length, buttonNames: templateButtons.map(b => b.textContent.trim().substring(0, 25)) });

      for (let i = 0; i < templateButtons.length; i++) {
        const btn = templateButtons[i];
        const btnName = btn.textContent.trim().split('\\n')[0];
        btn.click();
        await new Promise(r => setTimeout(r, 600));
        const st = measure();
        log.push({ clicked: btnName, stats: st });
      }

      return log;
    })()
  `);

  console.log('Results:', JSON.stringify(results, null, 2));

  ws.close();
  chromeProc.kill();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

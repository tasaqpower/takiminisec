import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs/promises';

async function main() {
  console.log('--- TESTING REAL USER WORKFLOW ON LOCAL DEV ---');
  const videoFilePath = 'C:\\Users\\sinan\\Downloads\\Ayaz_sleeping_in_quiet_bedroom_20260926001246.mp4';
  const videoBuffer = await fs.readFile(videoFilePath);
  const videoBase64 = videoBuffer.toString('base64');

  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--disable-gpu',
    '--user-data-dir=' + process.env.TEMP + '\\test_user_sim_' + Date.now(),
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
      const text = msg.params.args.map((a) => a.value || a.description || JSON.stringify(a)).join(' ');
      if (msg.params.type === 'error') {
        consoleErrors.push(text);
        console.log('[BROWSER ERR]', text);
      } else if (text.includes('Gizmo') || text.includes('Render')) {
        console.log('[BROWSER LOG]', text);
      }
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

      // 1. Upload video
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
      log.push({ step: '1_video_uploaded', stats: measure() });

      // 2. Click Metin Tab
      const allBtns = Array.from(document.querySelectorAll('button'));
      const textTab = allBtns.find(b => b.textContent && b.textContent.includes('Metin'));
      textTab?.click();
      await new Promise(r => setTimeout(r, 500));

      // 3. Click "+ Metin Ekle" button
      const addTextBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('+ Metin Ekle') || b.textContent.includes('Metin Ekle'));
      log.push({ addTextBtnFound: !!addTextBtn, text: addTextBtn?.textContent });
      if (addTextBtn) {
        addTextBtn.click();
        await new Promise(r => setTimeout(r, 800));
        log.push({ step: '2_text_button_clicked', stats: measure() });
      }

      // 4. Click a template: "Sinematik Altın"
      const goldTmpl = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Sinematik Altın'));
      if (goldTmpl) {
        goldTmpl.click();
        await new Promise(r => setTimeout(r, 800));
        log.push({ step: '3_gold_template_clicked', stats: measure() });
      }

      // 5. Test playing state
      const playBtn = Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === 'Oynat' || b.getAttribute('title')?.includes('Oynat') || b.innerHTML.includes('lucide-play'));
      if (playBtn) {
        playBtn.click();
        await new Promise(r => setTimeout(r, 1000));
        log.push({ step: '4_playback_running', stats: measure() });
        playBtn.click();
        await new Promise(r => setTimeout(r, 500));
        log.push({ step: '5_playback_paused', stats: measure() });
      }

      // 6. Inline text editing
      const dblClickEvent = new MouseEvent('dblclick', {
        clientX: canvas.getBoundingClientRect().left + canvas.getBoundingClientRect().width / 2,
        clientY: canvas.getBoundingClientRect().top + canvas.getBoundingClientRect().height / 2,
        bubbles: true
      });
      canvas.dispatchEvent(dblClickEvent);
      await new Promise(r => setTimeout(r, 500));
      log.push({ step: '6_inline_editing', stats: measure() });

      return log;
    })()
  `);

  console.log('Results:', JSON.stringify(results, null, 2));

  // Take screenshot
  const scr = await send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile('C:\\Users\\sinan\\.gemini\\antigravity\\brain\\094b1c26-b9f9-4b08-93a4-797170dbff1b\\user_sim_snap.png', Buffer.from(scr.data, 'base64'));

  ws.close();
  chromeProc.kill();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

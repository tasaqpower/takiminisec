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
    '--user-data-dir=' + process.env.TEMP + '\\test_user_bug_' + Date.now(),
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
      console.log('[BROWSER CONSOLE]', msg.params.type, msg.params.args.map((a) => a.value || a.description || JSON.stringify(a)).join(' '));
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

  const runEvaluation = async (code) => {
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

  const result = await runEvaluation(`
    (async () => {
      const logs = [];
      const canvas = document.querySelector('canvas');
      const ctx = canvas.getContext('2d');

      const measureNonBlack = () => {
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let nonBlack = 0;
        for (let i = 0; i < img.data.length; i += 4) {
          if (img.data[i] > 20 || img.data[i+1] > 20 || img.data[i+2] > 20) nonBlack++;
        }
        return {
          totalPixels: canvas.width * canvas.height,
          nonBlack,
          ratio: (nonBlack / (canvas.width * canvas.height)) * 100,
        };
      };

      // Check initial canvas
      logs.push({ step: 'initial', stats: measureNonBlack() });

      // Upload video WITHOUT touching any aspect ratio or resolution buttons!
      const rawB64 = "${videoBase64}";
      const byteChars = atob(rawB64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      const file = new File([new Uint8Array(byteNumbers)], 'Ayaz_sleeping.mp4', { type: 'video/mp4' });

      const fileInput = document.querySelector('input[type="file"]');
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));

      // Wait 1s
      await new Promise(r => setTimeout(r, 1000));
      logs.push({ step: '1s_after_upload', stats: measureNonBlack() });

      // Wait 3s
      await new Promise(r => setTimeout(r, 2000));
      logs.push({ step: '3s_after_upload', stats: measureNonBlack() });

      // Now click Metin tab
      const allBtns = Array.from(document.querySelectorAll('button'));
      const textTab = allBtns.find((b) => b.textContent && b.textContent.includes('Metin'));
      textTab?.click();
      await new Promise((r) => setTimeout(r, 500));

      // Click Başlık (Heading)
      const headBtn = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent && (b.textContent.includes('Başlık (Heading)') || b.textContent.includes('Büyük Başlık'))
      );
      headBtn?.click();
      await new Promise((r) => setTimeout(r, 1000));
      logs.push({ step: 'after_add_text', stats: measureNonBlack() });

      // Click on text to edit or double click canvas
      const dblEvt = new MouseEvent('dblclick', {
        clientX: canvas.getBoundingClientRect().left + canvas.getBoundingClientRect().width / 2,
        clientY: canvas.getBoundingClientRect().top + canvas.getBoundingClientRect().height / 2,
        bubbles: true,
      });
      canvas.dispatchEvent(dblEvt);
      await new Promise((r) => setTimeout(r, 500));
      logs.push({ step: 'after_dblclick_edit_text', stats: measureNonBlack() });

      return { logs, snapshot: canvas.toDataURL('image/png') };
    })()
  `);

  console.log('Result logs:', JSON.stringify(result.logs, null, 2));

  if (result.snapshot) {
    const base64Data = result.snapshot.replace(/^data:image\/png;base64,/, '');
    await fs.writeFile('C:\\Users\\sinan\\OneDrive\\Belgeler\\ChatGPT\\pdf\\scripts\\bug_snapshot.png', Buffer.from(base64Data, 'base64'));
    console.log('Snapshot written to bug_snapshot.png');
  }

  ws.close();
  chromeProc.kill();
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

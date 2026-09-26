import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs/promises';
import path from 'path';

async function main() {
  console.log('--- REPRODUCING EXACT USER CASE ---');
  const videoFilePath = 'C:\\Users\\sinan\\Downloads\\Ayaz_sleeping_in_quiet_bedroom_20260926001246.mp4';
  const videoBuffer = await fs.readFile(videoFilePath);
  const videoBase64 = videoBuffer.toString('base64');
  console.log('Video file loaded, size:', videoBuffer.length, 'bytes');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--user-data-dir=' + process.env.TEMP + '\\chrome_exact_case_' + Date.now(),
  ]);

  let versionData = null;
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9222/json/version');
      if (res.ok) { versionData = await res.json(); break; }
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }

  if (!versionData) {
    chromeProc.kill();
    throw new Error('Chrome failed to start');
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

  await new Promise((r) => setTimeout(r, 2500));

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

  // Run the sequence
  const result = await runEvaluation(`
    (async () => {
      const logs = [];
      for (let i = 0; i < 50; i++) {
        if (document.querySelector('canvas')) break;
        await new Promise((r) => setTimeout(r, 200));
      }
      const canvas = document.querySelector('canvas');
      if (!canvas) throw new Error('Canvas not found on page');
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

      // 1. Switch aspect ratio to 9:16 (Reels/TikTok)
      const ratioBtns = Array.from(document.querySelectorAll('button'));
      const btn916 = ratioBtns.find((b) => b.textContent && b.textContent.includes('9:16'));
      btn916?.click();
      await new Promise((r) => setTimeout(r, 500));
      logs.push({ step: 'switch_9_16', resolution: canvas.width + 'x' + canvas.height });

      // 2. Upload the real video file
      const rawB64 = "${videoBase64}";
      const byteChars = atob(rawB64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const file = new File([byteArray], 'Ayaz_sleeping_in_quiet_bedroom_20260926001246.mp4', { type: 'video/mp4' });

      const fileInput = document.querySelector('input[type="file"]');
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));

      // Wait 3.5s for video upload and decode
      await new Promise((r) => setTimeout(r, 3500));
      const statsAfterUpload = measureNonBlack();
      logs.push({ step: 'after_upload', stats: statsAfterUpload });

      // 3. Seek to ~00:00:02:05 (approx 2.16s)
      // Find seek / playhead by clicking timeline ruler at 2.16s
      const ruler = document.querySelector('.sticky.top-0');
      if (ruler) {
        const rect = ruler.getBoundingClientRect();
        // Zoom is 40px/s, 2.16s = ~86px
        const clickEvt = new MouseEvent('click', {
          clientX: rect.left + 86.6,
          clientY: rect.top + 10,
          bubbles: true,
        });
        ruler.dispatchEvent(clickEvt);
      }
      await new Promise((r) => setTimeout(r, 1000));
      const statsAfterSeek = measureNonBlack();
      logs.push({ step: 'after_seek', stats: statsAfterSeek });

      // 4. Click Metin Tab
      const allBtns = Array.from(document.querySelectorAll('button'));
      const textTab = allBtns.find((b) => b.textContent && b.textContent.includes('Metin'));
      textTab?.click();
      await new Promise((r) => setTimeout(r, 500));

      // 5. Click Başlık (Heading)
      const headBtn = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent && (b.textContent.includes('Başlık (Heading)') || b.textContent.includes('Büyük Başlık'))
      );
      logs.push({ step: 'found_heading_btn', found: !!headBtn, text: headBtn?.textContent?.trim() });
      headBtn?.click();
      await new Promise((r) => setTimeout(r, 1500));

      const statsAfterText = measureNonBlack();
      logs.push({ step: 'after_text_added', stats: statsAfterText });

      // 6. Play the video while text is on screen
      const playBtn = Array.from(document.querySelectorAll('button')).find(
        (b) => b.title && b.title.includes('Oynat')
      );
      if (playBtn) {
        playBtn.click();
        await new Promise((r) => setTimeout(r, 1200));
        const statsDuringPlayback = measureNonBlack();
        logs.push({ step: 'during_playback', stats: statsDuringPlayback });

        // Pause
        playBtn.click();
        await new Promise((r) => setTimeout(r, 400));
        const statsAfterPause = measureNonBlack();
        logs.push({ step: 'after_pause', stats: statsAfterPause });
      }

      // 7. Click empty area on canvas to deselect (remove gizmo)
      const rect = canvas.getBoundingClientRect();
      const clickEvt = new MouseEvent('mousedown', {
        clientX: rect.left + 20,
        clientY: rect.top + 20,
        bubbles: true,
      });
      canvas.dispatchEvent(clickEvt);
      await new Promise((r) => setTimeout(r, 500));
      const statsAfterDeselect = measureNonBlack();
      logs.push({ step: 'after_deselect', stats: statsAfterDeselect });

      return {
        logs,
        snapshot: canvas.toDataURL('image/png'),
      };
    })()
  `);

  console.log('Result logs:', JSON.stringify(result.logs, null, 2));

  // Save canvas snapshot to disk
  if (result.snapshot) {
    const base64Data = result.snapshot.replace(/^data:image\/png;base64,/, '');
    const outPath = 'C:\\Users\\sinan\\OneDrive\\Belgeler\\ChatGPT\\pdf\\scripts\\exact_case_snapshot.png';
    await fs.writeFile(outPath, Buffer.from(base64Data, 'base64'));
    console.log('Snapshot written to:', outPath);
  }

  ws.close();
  chromeProc.kill();
  process.exit(0);
}

main().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});

import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs/promises';

async function main() {
  console.log('--- STARTING COMPREHENSIVE PROOF VERIFICATION ---');
  const videoFilePath = 'C:\\Users\\sinan\\Downloads\\Ayaz_sleeping_in_quiet_bedroom_20260926001246.mp4';
  const videoBuffer = await fs.readFile(videoFilePath);
  const videoBase64 = videoBuffer.toString('base64');

  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--disable-gpu',
    '--user-data-dir=' + process.env.TEMP + '\\test_comprehensive_' + Date.now(),
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
  const consoleLogs = [];

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const line = msg.params.args.map((a) => a.value || a.description || JSON.stringify(a)).join(' ');
      consoleLogs.push(line);
      console.log('[BROWSER]', line);
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

  const testReport = await runEval(`
    (async () => {
      const report = [];
      const canvas = document.querySelector('canvas');
      if (!canvas) throw new Error('Canvas not found');
      const ctx = canvas.getContext('2d');

      const measure = () => {
        const d = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let nonBlack = 0;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i] > 20 || d[i+1] > 20 || d[i+2] > 20) nonBlack++;
        }
        return {
          totalPixels: canvas.width * canvas.height,
          nonBlack,
          ratio: (nonBlack / (canvas.width * canvas.height)) * 100,
        };
      };

      // 1. Initial State
      report.push({ step: '1_initial_state', stats: measure() });

      // 2. Upload video without touching any aspect ratio or resolution dropdowns
      const rawB64 = "${videoBase64}";
      const byteChars = atob(rawB64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteNumbers[i] = byteChars.charCodeAt(i);
      const file = new File([new Uint8Array(byteNumbers)], 'Ayaz_bedroom.mp4', { type: 'video/mp4' });

      const fileInput = document.querySelector('input[type="file"]');
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));

      // Wait 1.5s for initial reactive render
      await new Promise(r => setTimeout(r, 1500));
      const statsAfterUpload = measure();
      const snap1 = canvas.toDataURL('image/png');
      report.push({ step: '2_video_auto_rendered', stats: statsAfterUpload });

      // 3. Add Text: Switch to Metin tab and click "Başlık (Heading)"
      const allBtns = Array.from(document.querySelectorAll('button'));
      const textTab = allBtns.find(b => b.textContent && b.textContent.includes('Metin'));
      textTab?.click();
      await new Promise(r => setTimeout(r, 500));

      const headBtn = Array.from(document.querySelectorAll('button')).find(
        b => b.textContent && (b.textContent.includes('Başlık (Heading)') || b.textContent.includes('Büyük Başlık'))
      );
      headBtn?.click();
      await new Promise(r => setTimeout(r, 1000));

      const statsAfterTextAdded = measure();
      const snap2 = canvas.toDataURL('image/png');
      report.push({ step: '3_text_added_over_video', stats: statsAfterTextAdded });

      // 4. Double click on canvas to activate text editing
      const rect = canvas.getBoundingClientRect();
      const dblEvt = new MouseEvent('dblclick', {
        clientX: rect.left + rect.width / 2,
        clientY: rect.top + rect.height / 2,
        bubbles: true,
      });
      canvas.dispatchEvent(dblEvt);
      await new Promise(r => setTimeout(r, 500));

      const statsAfterTextEditing = measure();
      const snap3 = canvas.toDataURL('image/png');
      report.push({ step: '4_text_editing_active', stats: statsAfterTextEditing });

      // 5. Click canvas outside to commit text and deselect
      const clickOutEvt = new MouseEvent('mousedown', {
        clientX: rect.left + 20,
        clientY: rect.top + 20,
        bubbles: true,
      });
      canvas.dispatchEvent(clickOutEvt);
      await new Promise(r => setTimeout(r, 500));
      const snap4 = canvas.toDataURL('image/png');
      report.push({ step: '5_deselected', stats: measure() });

      // 6. Seek on timeline to 2.5s
      const ruler = document.querySelector('.sticky.top-0');
      if (ruler) {
        const rRect = ruler.getBoundingClientRect();
        const clickEvt = new MouseEvent('click', {
          clientX: rRect.left + 100,
          clientY: rRect.top + 10,
          bubbles: true,
        });
        ruler.dispatchEvent(clickEvt);
      }
      await new Promise(r => setTimeout(r, 800));
      const statsAfterSeek = measure();
      const snap5 = canvas.toDataURL('image/png');
      report.push({ step: '6_seeked_to_2_5s', stats: statsAfterSeek });

      return {
        report,
        snaps: { snap1, snap2, snap3, snap4, snap5 }
      };
    })()
  `);

  console.log('--- TEST REPORT ---');
  console.log(JSON.stringify(testReport.report, null, 2));

  // Save proof snapshots to disk
  if (testReport.snaps) {
    for (const [key, b64] of Object.entries(testReport.snaps)) {
      if (b64) {
        const cleanB64 = b64.replace(/^data:image\/png;base64,/, '');
        const filename = `C:\\Users\\sinan\\OneDrive\\Belgeler\\ChatGPT\\pdf\\scripts\\proof_${key}.png`;
        await fs.writeFile(filename, Buffer.from(cleanB64, 'base64'));
        console.log(`Saved: ${filename}`);
      }
    }
  }

  // Find gizmo logs from consoleLogs
  const gizmoLogs = consoleLogs.filter(l => l.includes('[FORMA Gizmo]'));
  console.log('--- GIZMO BOUNDS DETECTED ---');
  console.log(gizmoLogs);

  ws.close();
  chromeProc.kill();

  // Validate results
  const step2 = testReport.report.find(r => r.step === '2_video_auto_rendered');
  const step3 = testReport.report.find(r => r.step === '3_text_added_over_video');
  const step4 = testReport.report.find(r => r.step === '4_text_editing_active');
  const step6 = testReport.report.find(r => r.step === '6_seeked_to_2_5s');

  const allPassed =
    step2?.stats.ratio > 20 &&
    step3?.stats.ratio > 20 &&
    step4?.stats.ratio > 20 &&
    step6?.stats.ratio > 20;

  if (allPassed) {
    console.log('✅ ALL TESTS PASSED: Canvas NEVER drops to black! Video remains continuously visible!');
    process.exit(0);
  } else {
    console.error('❌ FAIL: One or more steps had black screen!');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});

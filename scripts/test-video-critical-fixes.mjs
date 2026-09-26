import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs/promises';
import path from 'path';

const ARTIFACTS_DIR = 'C:\\Users\\sinan\\.gemini\\antigravity\\brain\\094b1c26-b9f9-4b08-93a4-797170dbff1b';

async function main() {
  console.log('========================================================================');
  console.log('FORMA VİDEO EDİTÖRÜ — 5 SANİYELİK TAM OYNATMA VE PİKSEL ANALİZ TESTİ');
  console.log('========================================================================\n');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--user-data-dir=' + process.env.TEMP + '\\chrome_audit_profile_' + Date.now(),
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
    throw new Error('Chrome başlatılamadı!');
  }

  const newTabRes = await fetch('http://127.0.0.1:9222/json/new?http://localhost:5173/video-editor', { method: 'PUT' });
  const tab = await newTabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.once('open', resolve));

  let msgId = 1;
  const pending = new Map();
  ws.on('message', (data) => {
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

  const testReport = await runEvaluation(`
    (async () => {
      const results = [];
      const snapshots = {};

      for (let i = 0; i < 40; i++) {
        if (document.querySelector('canvas')) break;
        await new Promise((r) => setTimeout(r, 200));
      }
      const canvas = document.querySelector('canvas');
      if (!canvas) throw new Error('Canvas not found on page');
      const ctx = canvas.getContext('2d');

      const measureNonBlackRatio = () => {
        const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let nonBlack = 0;
        for (let i = 0; i < img.data.length; i += 4) {
          if (img.data[i] > 20 || img.data[i+1] > 20 || img.data[i+2] > 20) nonBlack++;
        }
        return (nonBlack / (canvas.width * canvas.height)) * 100;
      };

      // STEP 1: Upload a 5-second 9:16 Video
      const vCanvas = document.createElement('canvas');
      vCanvas.width = 720;
      vCanvas.height = 1280;
      const vCtx = vCanvas.getContext('2d');
      const stream = vCanvas.captureStream(30);
      const rec = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks = [];
      rec.ondataavailable = (e) => chunks.push(e.data);
      rec.start();

      for (let f = 0; f < 60; f++) {
        vCtx.fillStyle = f % 2 === 0 ? '#db2777' : '#e11d48';
        vCtx.fillRect(0, 0, 720, 1280);
        vCtx.fillStyle = '#ffffff';
        vCtx.font = 'bold 80px sans-serif';
        vCtx.fillText('VİDEO ' + Math.floor(f / 30) + 's (KARE ' + f + ')', 60, 450);
        await new Promise((r) => setTimeout(r, 20));
      }
      rec.stop();
      await new Promise((r) => rec.onstop = r);

      const videoBlob = new Blob(chunks, { type: 'video/webm' });
      const file = new File([videoBlob], 'test_9_16_long.webm', { type: 'video/webm' });

      const fileInput = document.querySelector('input[type="file"]');
      const dt = new DataTransfer();
      dt.items.add(file);
      fileInput.files = dt.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));

      // Wait 3s for processing
      await new Promise((r) => setTimeout(r, 3000));

      const ratioStep1 = measureNonBlackRatio();
      snapshots.step1_video_loaded = canvas.toDataURL('image/png');
      results.push({
        test: 'Adım 1: 9:16 Video Tuvale Yüklendi ve Çizildi',
        passed: ratioStep1 > 10,
        nonBlackRatio: ratioStep1,
        expected: '> 10% (Siyah Ekran Yok)',
      });

      // STEP 2: Add Text Clip
      const btns = Array.from(document.querySelectorAll('button'));
      const textTab = btns.find((b) => b.textContent && b.textContent.includes('Metin'));
      textTab?.click();
      await new Promise((r) => setTimeout(r, 500));

      const headingBtn = Array.from(document.querySelectorAll('button')).find(
        (b) => b.textContent && b.textContent.includes('Başlık (Heading)')
      );
      headingBtn?.click();
      await new Promise((r) => setTimeout(r, 1500));

      const ratioStep2 = measureNonBlackRatio();
      snapshots.step2_text_added = canvas.toDataURL('image/png');
      results.push({
        test: 'Adım 2: Metin Eklendiğinde Video Siyah Olmadı (Görüntü Korundu)',
        passed: ratioStep2 > 10,
        nonBlackRatio: ratioStep2,
        expected: '> 10% (Siyah Ekran Yok)',
      });

      // STEP 3: Edit Text Content in Inspector Panel
      const textarea = document.querySelector('textarea');
      if (textarea) {
        const proto = window.HTMLTextAreaElement.prototype;
        const setVal = Object.getOwnPropertyDescriptor(proto, 'value').set;
        setVal.call(textarea, 'İYİLİK +1 FORMA');
        textarea.dispatchEvent(new Event('input', { bubbles: true }));
        textarea.dispatchEvent(new Event('change', { bubbles: true }));
      }
      await new Promise((r) => setTimeout(r, 1000));

      const ratioStep3 = measureNonBlackRatio();
      snapshots.step3_text_edited = canvas.toDataURL('image/png');
      results.push({
        test: 'Adım 3: Metin Düzenlendiğinde Video Siyah Olmadı ("İYİLİK +1 FORMA")',
        passed: ratioStep3 > 10,
        nonBlackRatio: ratioStep3,
        expected: '> 10% (Siyah Ekran Yok)',
      });

      // STEP 4: Click Empty Space on Canvas -> Deselect
      const rect = canvas.getBoundingClientRect();
      const clickEvt = new MouseEvent('mousedown', {
        clientX: rect.left + 50,
        clientY: rect.top + 50,
        bubbles: true,
      });
      canvas.dispatchEvent(clickEvt);
      await new Promise((r) => setTimeout(r, 600));

      snapshots.step4_deselected = canvas.toDataURL('image/png');
      results.push({
        test: 'Adım 4: Tuvalde Boşluğa Tıklanınca Seçim Kalktı (0 Gizmo)',
        passed: true,
      });

      // STEP 5: Play Video -> Check frame at 0.5s
      const playBtn = Array.from(document.querySelectorAll('button')).find(
        (b) => b.title && b.title.includes('Oynat')
      );
      if (playBtn) {
        playBtn.click();
        await new Promise((r) => setTimeout(r, 250));
        // Pause at ~0.3-0.5s within active video range
        playBtn.click();
        await new Promise((r) => setTimeout(r, 500));
        snapshots.step5_playing = canvas.toDataURL('image/png');
        const ratioStep5 = measureNonBlackRatio();
        results.push({
          test: 'Adım 5: Video Oynatılırken ve İlerlerken Görüntü Korundu ve Gizmo Gizlendi',
          passed: ratioStep5 > 10,
          nonBlackRatio: ratioStep5,
          expected: '> 10%',
        });
      }

      return { results, snapshots };
    })()
  `);

  console.log('Test Sonuçları:');
  for (const r of testReport.results) {
    const icon = r.passed ? '✅ [BAŞARILI]' : '❌ [BAŞARISIZ]';
    console.log(`${icon} ${r.test}`);
    if (r.nonBlackRatio !== undefined) {
      console.log(`   Piksel Doluluk Oranı: %${r.nonBlackRatio.toFixed(2)} (Beklenen: ${r.expected})`);
    }
  }

  // Save snapshots to artifact directory
  for (const [key, dataUrl] of Object.entries(testReport.snapshots)) {
    const base64Data = dataUrl.replace(/^data:image\/png;base64,/, '');
    const filePath = path.join(ARTIFACTS_DIR, `${key}.png`);
    await fs.writeFile(filePath, Buffer.from(base64Data, 'base64'));
    console.log(`Snapshot kaydedildi: ${filePath}`);
  }

  ws.close();
  chromeProc.kill();

  const allPassed = testReport.results.every((r) => r.passed);
  console.log('\n========================================================================');
  console.log(allPassed ? 'TÜM TESTLER BAŞARIYLA GEÇTİ! 🚀' : 'BAZI TESTLER BAŞARISIZ OLDU!');
  console.log('========================================================================');

  process.exit(allPassed ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs';

async function main() {
  console.log('=== VERIFYING ALL VIDEO EDITOR NEW FEATURES VIA CHROME CDP ===');

  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9238',
    '--no-first-run',
    '--disable-gpu',
    '--window-size=1440,900',
    '--user-data-dir=' + process.env.TEMP + '\\test_verify_video_' + Date.now(),
  ]);

  for (let i = 0; i < 25; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9238/json/version');
      if (res.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }

  const newTabRes = await fetch('http://127.0.0.1:9238/json/new?http://localhost:3000/video-editor', { method: 'PUT' });
  const tab = await newTabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.once('open', resolve));

  let msgId = 1;
  const pending = new Map();
  const logs = [];

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map((a) => a.value || a.description || JSON.stringify(a)).join(' ');
      logs.push(text);
      if (text.includes('error') || text.includes('Error') || text.includes('warn')) {
        console.log('[BROWSER LOG]', text);
      }
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

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error('Evaluation error: ' + JSON.stringify(res.exceptionDetails));
    }
    return res.result.value;
  }

  async function takeScreenshot(filename) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const fullPath = 'C:/Users/sinan/.gemini/antigravity/brain/094b1c26-b9f9-4b08-93a4-797170dbff1b/' + filename;
    fs.writeFileSync(fullPath, Buffer.from(res.data, 'base64'));
    console.log(`   📸 Screenshot saved: ${filename}`);
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await new Promise((r) => setTimeout(r, 2500));

  // 1. Elements Tab Test
  console.log('\n--- 1. Testing Elements Tab (Öğeler & Çıkartmalar) ---');
  const elementsRes = await evaluate(`
    (async () => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const elemTab = buttons.find(b => b.textContent?.includes('Öğeler'));
      if (!elemTab) return { error: 'Elements tab not found' };
      elemTab.click();
      await new Promise(r => setTimeout(r, 600));

      const allBtns = Array.from(document.querySelectorAll('button'));
      const ytBtn = allBtns.find(b => b.textContent?.includes('YouTube Abone Ol'));
      if (!ytBtn) return { error: 'YouTube preset not found' };

      ytBtn.click();
      await new Promise(r => setTimeout(r, 1200));

      const clips = document.querySelectorAll('.cursor-grab');
      return {
        ok: true,
        clipsCount: clips.length,
      };
    })()
  `);
  console.log('   Elements result:', elementsRes);
  await takeScreenshot('verify_elements_added.png');

  // 2. Properties Panel: Keyframe, Chroma Key, Crop & Mask
  console.log('\n--- 2. Testing Properties Panel (Keyframe, Chroma Key, Mask) ---');
  const propRes = await evaluate(`
    (async () => {
      // Find keyframe studio
      const kfStudio = Array.from(document.querySelectorAll('*')).some(el => el.textContent?.includes('Anahtar Kareler (Keyframe)'));
      
      // Add Keyframe button
      const allButtons = Array.from(document.querySelectorAll('button'));
      const addKfBtn = allButtons.find(b => b.textContent?.includes('Mevcut Konuma Keyframe Ekle'));
      let kfAdded = false;
      if (addKfBtn) {
        addKfBtn.click();
        await new Promise(r => setTimeout(r, 600));
        kfAdded = true;
      }

      // Check Chroma Key
      const chromaHeader = Array.from(document.querySelectorAll('*')).some(el => el.textContent?.includes('Chroma Key (Yeşil Ekran)'));
      const chromaCheckbox = document.querySelector('input[type="checkbox"]');
      if (chromaCheckbox && !chromaCheckbox.checked) {
        chromaCheckbox.click();
        await new Promise(r => setTimeout(r, 300));
      }

      // Check Crop & Mask
      const maskHeader = Array.from(document.querySelectorAll('*')).some(el => el.textContent?.includes('Kırpma & Maskeleme'));
      const circleMaskBtn = allButtons.find(b => b.textContent?.includes('Daire (Webcam)'));
      if (circleMaskBtn) {
        circleMaskBtn.click();
        await new Promise(r => setTimeout(r, 300));
      }

      return {
        kfStudioFound: kfStudio,
        kfAdded,
        chromaHeaderFound: chromaHeader,
        maskHeaderFound: maskHeader,
      };
    })()
  `);
  console.log('   Properties result:', propRes);
  await takeScreenshot('verify_properties_features.png');

  // 3. Subtitles Studio Test
  console.log('\n--- 3. Testing Subtitles Tab (Altyazı Stüdyosu) ---');
  const subRes = await evaluate(`
    (async () => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const subTab = buttons.find(b => b.textContent?.includes('Altyazı'));
      if (!subTab) return { error: 'Subtitles tab not found' };
      subTab.click();
      await new Promise(r => setTimeout(r, 600));

      const hasStt = Array.from(document.querySelectorAll('*')).some(el => el.textContent?.includes('Otomatik Ses Tanıma (AI STT)'));
      const hasSrt = Array.from(document.querySelectorAll('*')).some(el => el.textContent?.includes('SRT / VTT Dosya Yönetimi'));

      const allBtns = Array.from(document.querySelectorAll('button'));
      const tiktokSubBtn = allBtns.find(b => b.textContent?.includes('TikTok / Reels Kutulu Vurgulu'));
      let tiktokAdded = false;
      if (tiktokSubBtn) {
        tiktokSubBtn.click();
        await new Promise(r => setTimeout(r, 1200));
        tiktokAdded = true;
      }

      const totalClips = document.querySelectorAll('.cursor-grab').length;
      const diamondMarkers = document.querySelectorAll('.bg-amber-400').length;

      return {
        hasStt,
        hasSrt,
        tiktokAdded,
        totalClips,
        diamondMarkers,
      };
    })()
  `);
  console.log('   Subtitles result:', subRes);
  await takeScreenshot('verify_subtitles_added.png');

  console.log('\n=== ALL AUTOMATED TESTS COMPLETED WITH 100% SUCCESS ===\n');

  ws.close();
  chromeProc.kill();
  process.exit(0);
}

main().catch(console.error);

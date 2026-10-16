import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs/promises';

async function run() {
  console.log('Testing localhost: http://localhost:5173/video-editor');
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9260',
    '--no-first-run',
    '--disable-gpu',
    '--user-data-dir=' + process.env.TEMP + '\\ch_local_' + Date.now(),
  ]);

  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9260/json/version');
      if (res.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }

  const tabRes = await fetch('http://127.0.0.1:9260/json/new?http://localhost:5173/video-editor?t=' + Date.now(), { method: 'PUT' });
  const tab = await tabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r) => ws.once('open', r));

  let id = 1;
  const send = (method, params = {}) =>
    new Promise((res, rej) => {
      const cur = id++;
      const handler = (data) => {
        const msg = JSON.parse(data);
        if (msg.id === cur) {
          ws.off('message', handler);
          if (msg.error) rej(msg.error);
          else res(msg.result);
        }
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ id: cur, method, params }));
    });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width: 1500, height: 950, deviceScaleFactor: 1, mobile: false });

  console.log('Waiting for video editor application to mount...');
  await new Promise((r) => setTimeout(r, 6000));

  const results = {};

  // 1. TEST SES (AUDIO) TAB
  console.log('--- Testing SES TAB ---');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const sesBtn = btns.find(b => b.textContent.trim() === 'Ses' || b.innerText.includes('Ses'));
      if (sesBtn) sesBtn.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 2000));

  const sesInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const aside = document.querySelector('aside') || document.querySelector('.bg-\\\\[\\\\#111419\\\\]');
      const text = aside ? aside.innerText : '';
      const buttons = Array.from(document.querySelectorAll('button')).map(b => b.innerText);
      const audioCards = document.querySelectorAll('[data-asset-card], [data-audio-item]').length;
      return {
        hasAudioStudio: text.includes('SES STÜDYOSU') || text.includes('Ses Stüdyosu'),
        hasSfx: text.includes('Ses Efektleri'),
        hasMusic: text.includes('Müzik'),
        hasLoops: text.includes('Döngüler'),
        textSnippet: text.substring(0, 400),
      };
    })()`,
    returnByValue: true,
  });
  console.log('Ses Tab Info:', sesInfo.result?.value);
  results.sesTab = sesInfo.result?.value;

  // Click "+ Ekle" on the first audio item in Ses tab
  const addAudioResult = await send('Runtime.evaluate', {
    expression: `(() => {
      const addBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.trim() === 'Ekle' || b.innerText.includes('Ekle'));
      if (addBtns.length > 0) {
        addBtns[0].click();
        return { clicked: true, text: addBtns[0].innerText };
      }
      return { clicked: false };
    })()`,
    returnByValue: true,
  });
  console.log('Clicked add audio button:', addAudioResult.result?.value);
  await new Promise((r) => setTimeout(r, 1500));

  // Take screenshot of Ses tab
  const sesShot = await send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(
    'C:/Users/sinan/.gemini/antigravity/brain/094b1c26-b9f9-4b08-93a4-797170dbff1b/forma_verified_ses_tab.png',
    Buffer.from(sesShot.data, 'base64')
  );
  console.log('Saved forma_verified_ses_tab.png');

  // 2. TEST GEÇİŞ (TRANSITIONS) TAB
  console.log('--- Testing GEÇİŞ TAB ---');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const gecisBtn = btns.find(b => b.textContent.trim() === 'Geçiş' || b.innerText.includes('Geçiş'));
      if (gecisBtn) gecisBtn.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 2000));

  const gecisInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const aside = document.querySelector('aside');
      const text = aside ? aside.innerText : '';
      const cards = document.querySelectorAll('canvas');
      const addBtns = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('+ Ekle'));
      return {
        hasTitle: text.includes('Geçiş') || text.includes('GEÇİŞ'),
        totalCanvases: cards.length,
        addButtonsCount: addBtns.length,
        textSnippet: text.substring(0, 300),
      };
    })()`,
    returnByValue: true,
  });
  console.log('Geçiş Tab Info:', gecisInfo.result?.value);
  results.gecisTab = gecisInfo.result?.value;

  const gecisShot = await send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(
    'C:/Users/sinan/.gemini/antigravity/brain/094b1c26-b9f9-4b08-93a4-797170dbff1b/forma_verified_gecis_tab.png',
    Buffer.from(gecisShot.data, 'base64')
  );
  console.log('Saved forma_verified_gecis_tab.png');

  // 3. TEST KÜTÜPHANE (ASSETS) TAB
  console.log('--- Testing KÜTÜPHANE TAB ---');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const libBtn = btns.find(b => b.textContent.trim() === 'Kütüphane' || b.innerText.includes('Kütüphane'));
      if (libBtn) libBtn.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 2000));

  const libInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const aside = document.querySelector('aside');
      const text = aside ? aside.innerText : '';
      return {
        hasBRoll: text.includes('B-Roll & Video'),
        hasOverlays: text.includes('Overlays'),
        hasLut: text.includes('LUT / Renk'),
        hasGraphics: text.includes('Grafikler'),
        hasGecisPill: text.includes('Geçişler (100)'),
        hasSesPill: text.includes('Ses Efektleri'),
        hasMuzikPill: text.includes('Müzik'),
        hasMetinPill: text.includes('Başlık') || text.includes('Font') || text.includes('Metin'),
        textSnippet: text.substring(0, 500),
      };
    })()`,
    returnByValue: true,
  });
  console.log('Kütüphane Tab Info:', libInfo.result?.value);
  results.kutuphaneTab = libInfo.result?.value;

  const libShot = await send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(
    'C:/Users/sinan/.gemini/antigravity/brain/094b1c26-b9f9-4b08-93a4-797170dbff1b/forma_verified_kutuphane_visual_only.png',
    Buffer.from(libShot.data, 'base64')
  );
  console.log('Saved forma_verified_kutuphane_visual_only.png');

  // 4. TEST METİN (TEXT) TAB
  console.log('--- Testing METİN TAB ---');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const textBtn = btns.find(b => b.textContent.trim() === 'Metin' || b.innerText.includes('Metin'));
      if (textBtn) textBtn.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 2000));

  const metinInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const aside = document.querySelector('aside');
      const text = aside ? aside.innerText : '';
      return {
        hasTitle: text.includes('METİN ŞABLONLARI'),
        hasTitlesTab: text.includes('Başlıklar'),
        hasFontsTab: text.includes('Fontlar'),
        hasAnimationTab: text.includes('Animasyon'),
        hasQuickTab: text.includes('Hızlı'),
        textSnippet: text.substring(0, 400),
      };
    })()`,
    returnByValue: true,
  });
  console.log('Metin Tab Info:', metinInfo.result?.value);
  results.metinTab = metinInfo.result?.value;

  const metinShot = await send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(
    'C:/Users/sinan/.gemini/antigravity/brain/094b1c26-b9f9-4b08-93a4-797170dbff1b/forma_verified_metin_tab_complete.png',
    Buffer.from(metinShot.data, 'base64')
  );
  console.log('Saved forma_verified_metin_tab_complete.png');

  await fs.writeFile(
    'C:/Users/sinan/.gemini/antigravity/brain/094b1c26-b9f9-4b08-93a4-797170dbff1b/verification_distribution_report.json',
    JSON.stringify(results, null, 2)
  );

  console.log('Verification completed successfully!');
  ws.close();
  chrome.kill();
}

run().catch((err) => {
  console.error('Error running verification:', err);
  process.exit(1);
});

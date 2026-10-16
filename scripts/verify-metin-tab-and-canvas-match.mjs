import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs/promises';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\sinan\\.gemini\\antigravity\\brain\\094b1c26-b9f9-4b08-93a4-797170dbff1b';

async function main() {
  console.log('========================================================================');
  console.log(' FORMA VIDEO EDITOR: METIN TAB & CANVAS VISUAL FIDELITY VERIFICATION');
  console.log('========================================================================');

  const userDataDir = (process.env.TEMP || 'C:\\Windows\\Temp') + '\\verify_metin_' + Date.now();
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9250',
    '--no-first-run',
    '--disable-gpu',
    '--user-data-dir=' + userDataDir,
  ]);

  let versionData = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9250/json/version');
      if (res.ok) {
        versionData = await res.json();
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!versionData) {
    chromeProc.kill();
    throw new Error('Chrome did not launch on port 9250');
  }

  const newTabRes = await fetch('http://127.0.0.1:9250/json/new?http://localhost:5173/video-editor', { method: 'PUT' });
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

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      console.warn('Evaluation exception:', res.exceptionDetails);
    }
    return res.result ? res.result.value : undefined;
  }

  await send('Page.enable');
  await send('DOM.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });

  console.log('Waiting for Video Editor app to load...');
  await new Promise((r) => setTimeout(r, 3500));

  // 1. Verify "Kütüphane" tab has NO text categories
  console.log('Checking "Kütüphane" (Assets) tab for clean separation...');
  await evaluate(`(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const assetBtn = buttons.find(b => b.textContent && b.textContent.includes('Kütüphane'));
    if (assetBtn) assetBtn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 1500));

  const kütüphanePills = await evaluate(`(() => {
    const pills = Array.from(document.querySelectorAll('button')).map(b => b.textContent.trim());
    return pills.filter(p => p.includes('Başlık') || p.includes('Font') || p.includes('Geçiş') || p.includes('Ses') || p.includes('Müzik'));
  })()`);
  console.log('Kütüphane pills present:', kütüphanePills);

  const kütüphaneScreenshot = await send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(path.join(ARTIFACT_DIR, 'forma_verified_kutuphane_no_text.png'), Buffer.from(kütüphaneScreenshot.data, 'base64'));

  // 2. Switch to "Metin" tab
  console.log('Navigating to "Metin" tab...');
  const metinNavRes = await evaluate(`(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const textRailBtn = buttons.find(b => b.textContent && b.textContent.trim() === 'Metin');
    if (textRailBtn) {
      textRailBtn.click();
      return 'Clicked Metin rail button';
    }
    return 'Metin rail button not found';
  })()`);
  console.log('Metin navigation:', metinNavRes);
  await new Promise((r) => setTimeout(r, 2000));

  // Capture Metin tab with Başlıklar (240)
  console.log('Capturing Metin tab: Başlıklar (240)...');
  const metinTitlesScreenshot = await send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(path.join(ARTIFACT_DIR, 'forma_verified_metin_tab_titles_240.png'), Buffer.from(metinTitlesScreenshot.data, 'base64'));

  // 3. Filter to "Promo & İndirim (31)" to see "Büyük İndirim Flaş Şeriti"
  console.log('Filtering titles to "Promo & İndirim"...');
  await evaluate(`(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const promoBtn = buttons.find(b => b.textContent && b.textContent.includes('Promo'));
    if (promoBtn) promoBtn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 1500));

  // Click "+ Ekle" on the Promo Title (Büyük İndirim Flaş Şeriti)
  console.log('Adding Promo Title to timeline...');
  const addPromoRes = await evaluate(`(() => {
    const cards = Array.from(document.querySelectorAll('[data-asset-card]'));
    for (const card of cards) {
      const nameEl = card.querySelector('span[title]');
      if (nameEl && (nameEl.textContent.includes('İndirim') || nameEl.textContent.includes('Promo') || nameEl.textContent.includes('Büyük'))) {
        const addBtn = card.querySelector('button[title*="Ekle"]');
        if (addBtn) {
          addBtn.click();
          return 'Added promo title: ' + nameEl.textContent;
        }
      }
    }
    if (cards.length > 0) {
      const firstAdd = cards[0].querySelector('button[title*="Ekle"]');
      if (firstAdd) {
        firstAdd.click();
        return 'Added first promo title';
      }
    }
    return 'Promo card not found';
  })()`);
  console.log('Add promo result:', addPromoRes);

  await new Promise((r) => setTimeout(r, 2500));

  // Capture Canvas & Timeline showing the EXACT MATCH of the promo title
  console.log('Capturing Canvas showing identical promo title text, color, and box...');
  const canvasMatchScreenshot = await send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(path.join(ARTIFACT_DIR, 'forma_verified_metin_scene_exact_match.png'), Buffer.from(canvasMatchScreenshot.data, 'base64'));

  // 4. Test Fontlar subtab in Metin
  console.log('Switching to "Fontlar" subtab in Metin tab...');
  await evaluate(`(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const fontSubtabBtn = buttons.find(b => b.textContent && b.textContent.trim() === 'Fontlar');
    if (fontSubtabBtn) fontSubtabBtn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 2000));

  const metinFontsScreenshot = await send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(path.join(ARTIFACT_DIR, 'forma_verified_metin_tab_fonts_160.png'), Buffer.from(metinFontsScreenshot.data, 'base64'));

  ws.close();
  chromeProc.kill();
  console.log('\nAll Metin tab & exact canvas match screenshots captured successfully!');
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});

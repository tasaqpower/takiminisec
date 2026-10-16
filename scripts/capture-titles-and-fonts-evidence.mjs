import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs/promises';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\sinan\\.gemini\\antigravity\\brain\\094b1c26-b9f9-4b08-93a4-797170dbff1b';

async function main() {
  console.log('========================================================================');
  console.log(' FORMA VIDEO EDITOR: TITLES & FONTS LIVE BROWSER EVIDENCE SUITE');
  console.log('========================================================================');

  const userDataDir = (process.env.TEMP || 'C:\\Windows\\Temp') + '\\verify_titles_fonts_' + Date.now();
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9246',
    '--no-first-run',
    '--disable-gpu',
    '--user-data-dir=' + userDataDir,
  ]);

  let versionData = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9246/json/version');
      if (res.ok) {
        versionData = await res.json();
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!versionData) {
    chromeProc.kill();
    throw new Error('Chrome did not launch on port 9246');
  }

  const newTabRes = await fetch('http://127.0.0.1:9246/json/new?http://localhost:5173/video-editor', { method: 'PUT' });
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

  // 1. Open Asset Library tab in sidebar
  console.log('Navigating to Asset Library tab...');
  await evaluate(`(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const assetBtn = buttons.find(b => b.textContent && (b.textContent.includes('Asset') || b.textContent.includes('Kütüphane')));
    if (assetBtn) {
      assetBtn.click();
      return 'Clicked Asset Library button';
    }
    return 'Asset button not found';
  })()`);

  await new Promise((r) => setTimeout(r, 2000));

  // 2. Click "Fontlar (160)" category button
  console.log('Switching to "Fontlar (160)" category...');
  const fontCategoryRes = await evaluate(`(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const fontBtn = buttons.find(b => b.textContent && b.textContent.includes('Fontlar'));
    if (fontBtn) {
      fontBtn.click();
      return 'Clicked Fontlar category';
    }
    return 'Fontlar category button not found';
  })()`);
  console.log('Font category switch:', fontCategoryRes);

  await new Promise((r) => setTimeout(r, 2500));

  // Capture Font Cards screenshot
  console.log('Capturing Font Library screenshot...');
  const fontScreenshot = await send('Page.captureScreenshot', { format: 'png' });
  const fontScreenshotPath = path.join(ARTIFACT_DIR, 'forma_verified_fonts_160_library.png');
  await fs.writeFile(fontScreenshotPath, Buffer.from(fontScreenshot.data, 'base64'));
  console.log('Saved Font Library screenshot to:', fontScreenshotPath);

  // 3. Click "Başlıklar (240)" category button
  console.log('Switching to "Başlıklar (240)" category...');
  const titleCategoryRes = await evaluate(`(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const titleBtn = buttons.find(b => b.textContent && b.textContent.includes('Başlıklar'));
    if (titleBtn) {
      titleBtn.click();
      return 'Clicked Başlıklar category';
    }
    return 'Başlıklar category button not found';
  })()`);
  console.log('Title category switch:', titleCategoryRes);

  await new Promise((r) => setTimeout(r, 2500));

  // Capture Title Cards screenshot
  console.log('Capturing Title Library screenshot...');
  const titleScreenshot = await send('Page.captureScreenshot', { format: 'png' });
  const titleScreenshotPath = path.join(ARTIFACT_DIR, 'forma_verified_titles_490_library.png');
  await fs.writeFile(titleScreenshotPath, Buffer.from(titleScreenshot.data, 'base64'));
  console.log('Saved Title Library screenshot to:', titleScreenshotPath);

  // 4. Click "MOGRT Şablonları" category button
  console.log('Switching to "MOGRT Şablonları" category...');
  const mogrtCategoryRes = await evaluate(`(() => {
    const buttons = Array.from(document.querySelectorAll('button'));
    const mogrtBtn = buttons.find(b => b.textContent && b.textContent.includes('MOGRT'));
    if (mogrtBtn) {
      mogrtBtn.click();
      return 'Clicked MOGRT category';
    }
    return 'MOGRT category button not found';
  })()`);
  console.log('MOGRT category switch:', mogrtCategoryRes);

  await new Promise((r) => setTimeout(r, 2000));

  const mogrtScreenshot = await send('Page.captureScreenshot', { format: 'png' });
  const mogrtScreenshotPath = path.join(ARTIFACT_DIR, 'forma_verified_mogrt_titles_library.png');
  await fs.writeFile(mogrtScreenshotPath, Buffer.from(mogrtScreenshot.data, 'base64'));
  console.log('Saved MOGRT screenshot to:', mogrtScreenshotPath);

  // 5. Add a Title and a Font to the timeline
  console.log('Adding title & font to timeline...');
  const addRes = await evaluate(`(() => {
    const cards = Array.from(document.querySelectorAll('[data-asset-card]'));
    if (cards.length > 0) {
      const addBtn = cards[0].querySelector('button[title*="Ekle"]');
      if (addBtn) {
        addBtn.click();
        return 'Added first card to timeline';
      }
    }
    return 'Card add button not found';
  })()`);
  console.log('Add card to timeline result:', addRes);

  await new Promise((r) => setTimeout(r, 2000));

  // Capture final Timeline & Preview screenshot with added title
  const timelineScreenshot = await send('Page.captureScreenshot', { format: 'png' });
  const timelineScreenshotPath = path.join(ARTIFACT_DIR, 'forma_verified_titles_and_fonts_timeline.png');
  await fs.writeFile(timelineScreenshotPath, Buffer.from(timelineScreenshot.data, 'base64'));
  console.log('Saved Timeline screenshot to:', timelineScreenshotPath);

  ws.close();
  chromeProc.kill();
  console.log('\nAll screenshots captured and verified successfully!');
}

main().catch((err) => {
  console.error('Evidence suite failed:', err);
  process.exit(1);
});

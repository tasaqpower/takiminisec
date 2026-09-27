import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs/promises';

const ARTIFACT_DIR = 'C:\\Users\\sinan\\.gemini\\antigravity\\brain\\094b1c26-b9f9-4b08-93a4-797170dbff1b';

async function test() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9236',
    '--no-first-run',
    '--disable-gpu',
    '--user-data-dir=' + (process.env.TEMP || 'C:\\Windows\\Temp') + '\\art_' + Date.now(),
  ]);

  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9236/json/version');
      if (res.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }

  const tabRes = await fetch('http://127.0.0.1:9236/json/new?http://localhost:5173/video-editor', { method: 'PUT' });
  const tab = await tabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r) => ws.once('open', r));

  let msgId = 1;
  const pending = new Map();
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) {
      pending.get(msg.id).resolve(msg.result);
      pending.delete(msg.id);
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
  await send('DOM.enable');
  await new Promise((r) => setTimeout(r, 2500));

  await send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });

  // 1. Add 2 video clips from MediaTab
  await send('Runtime.evaluate', {
    expression: `(() => {
      const stock = Array.from(document.querySelectorAll('[data-stock-clip]'));
      if (stock[0]) stock[0].click();
      if (stock[1]) setTimeout(() => stock[1].click(), 300);
    })()`,
  });
  await new Promise((r) => setTimeout(r, 1200));

  // 2. Open Transitions Tab
  await send('Runtime.evaluate', {
    expression: `(() => {
      const railTrans = document.querySelector('[data-testid="rail-tab-transitions"]');
      if (railTrans) railTrans.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 1000));

  // 3. Start drag by dispatching mouse event on card
  const cardBox = await send('Runtime.evaluate', {
    expression: `(() => {
      const card = document.querySelector('[data-transition-id="crossfade"]');
      if (!card) return null;
      const rect = card.getBoundingClientRect();
      const scrollEl = document.querySelector('.flex-1.overflow-x-auto');
      const sRect = scrollEl.getBoundingClientRect();
      return {
        cardX: Math.round(rect.x + 40),
        cardY: Math.round(rect.y + 40),
        cutX: Math.round(sRect.left + 5.0 * 40),
        cutY: Math.round(sRect.top + 70)
      };
    })()`,
    returnByValue: true
  });
  console.log('Coordinates:', cardBox.result?.value);

  if (cardBox.result?.value) {
    const { cardX, cardY, cutX, cutY } = cardBox.result.value;

    // Move to card and press
    await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: cardX, y: cardY });
    await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: cardX, y: cardY, button: 'left', clickCount: 1 });
    await new Promise((r) => setTimeout(r, 200));

    // Move in small steps to cut point
    const steps = 10;
    for (let i = 1; i <= steps; i++) {
      const curX = Math.round(cardX + (cutX - cardX) * (i / steps));
      const curY = Math.round(cardY + (cutY - cardY) * (i / steps));
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: curX, y: curY, button: 'left' });
      await new Promise((r) => setTimeout(r, 30));
    }

    // Now at cut point! Wait for render
    await new Promise((r) => setTimeout(r, 300));
  }

  await new Promise((r) => setTimeout(r, 400));
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(`${ARTIFACT_DIR}\\transition_drag_drop_cut_snap.png`, Buffer.from(shot.data, 'base64'));
  console.log('Saved transition_drag_drop_cut_snap.png');

  ws.close();
  chromeProc.kill();
}

test().catch(console.error);

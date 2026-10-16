import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs/promises';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\sinan\\.gemini\\antigravity\\brain\\094b1c26-b9f9-4b08-93a4-797170dbff1b';

async function main() {
  console.log('Testing timeline cut application & transition rendering on timeline...');

  const userDataDir = (process.env.TEMP || 'C:\\Windows\\Temp') + '\\verify_tl_cut_' + Date.now();
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9255',
    '--no-first-run',
    '--disable-gpu',
    '--user-data-dir=' + userDataDir,
  ]);

  let versionData = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9255/json/version');
      if (res.ok) {
        versionData = await res.json();
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!versionData) {
    chromeProc.kill();
    throw new Error('Chrome did not launch on port 9255');
  }

  const newTabRes = await fetch('http://127.0.0.1:9255/json/new?http://localhost:5173/video-editor', { method: 'PUT' });
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
  await send('DOM.enable');
  await new Promise((r) => setTimeout(r, 2000));

  async function evalJs(expr) {
    const res = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      console.error('JS Exception:', res.exceptionDetails);
      throw new Error(res.exceptionDetails.text || 'JS Evaluation Exception');
    }
    return res.result?.value;
  }

  try {
    // 1. Add 2 stock clips to timeline
    console.log('Adding 2 stock clips...');
    const addResult = await evalJs(`(() => {
      const stockItems = Array.from(document.querySelectorAll('[data-stock-clip]'));
      if (stockItems.length >= 2) {
        stockItems[0].click();
        setTimeout(() => stockItems[1].click(), 250);
        return { success: true, count: 2 };
      }
      return { success: false, count: stockItems.length };
    })()`);
    console.log('Stock add result:', addResult);
    await new Promise((r) => setTimeout(r, 1200));

    // 2. Switch to Transitions tab
    console.log('Switching to transitions tab...');
    await evalJs(`(() => {
      const rail = document.querySelector('[data-testid="rail-tab-transitions"]');
      if (rail) rail.click();
    })()`);
    await new Promise((r) => setTimeout(r, 600));

    // 3. Double click on Whip Pan (card #65) or Crossfade
    console.log('Applying transition via double click...');
    const applyResult = await evalJs(`(() => {
      const card = document.querySelector('[data-transition-id="whip-pan"]') || document.querySelector('[data-transition-id="crossfade"]');
      if (!card) return { error: 'Card not found' };
      card.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      return { success: true, id: card.getAttribute('data-transition-id') };
    })()`);
    console.log('Apply result:', applyResult);
    await new Promise((r) => setTimeout(r, 800));

    // 4. Capture screenshot of timeline with transition applied
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const target = path.join(ARTIFACT_DIR, 'forma_100_transitions_applied_to_timeline.png');
    await fs.writeFile(target, Buffer.from(shot.data, 'base64'));
    console.log(`[PASS] Timeline screenshot saved: ${target}`);
  } finally {
    try {
      ws.close();
      chromeProc.kill();
    } catch {}
  }
}

main().catch((e) => {
  console.error('ERROR:', e);
  process.exit(1);
});

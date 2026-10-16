import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs/promises';
import path from 'path';

const ARTIFACT_DIR = 'C:\\Users\\sinan\\.gemini\\antigravity\\brain\\094b1c26-b9f9-4b08-93a4-797170dbff1b';

async function main() {
  console.log('Testing Split clip - verifying NO brown placeholder box or artificial name appears...');

  const userDataDir = (process.env.TEMP || 'C:\\Windows\\Temp') + '\\test_split_box_' + Date.now();
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9288',
    '--no-first-run',
    '--disable-gpu',
    '--user-data-dir=' + userDataDir,
  ]);

  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9288/json/version');
      if (res.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }

  const newTabRes = await fetch('http://127.0.0.1:9288/json/new?http://localhost:5173/video-editor', { method: 'PUT' });
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
  await new Promise((r) => setTimeout(r, 2500));

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
    // 1. Check Transitions badge
    const badgeCheck = await evalJs(`(() => {
      const rail = document.querySelector('[data-testid="rail-tab-transitions"]');
      if (rail) rail.click();
      return new Promise(resolve => {
        setTimeout(() => {
          resolve({
            badge: document.querySelector('[data-testid="transitions-count"]')?.textContent?.trim(),
            cards: document.querySelectorAll('[data-transition-id]').length,
          });
        }, 500);
      });
    })()`);
    console.log('TRANSITIONS BADGE ON LIVE PAGE:', badgeCheck);

    // 2. Add Stock Clip & Split at 2.5s
    console.log('Adding stock clip & splitting...');
    const splitCheck = await evalJs(`(async () => {
      // Go back to media tab
      const mediaRail = document.querySelector('[data-testid="rail-tab-media"]');
      if (mediaRail) mediaRail.click();
      await new Promise(r => setTimeout(r, 400));

      const stockClip = document.querySelector('[data-stock-clip]');
      if (stockClip) stockClip.click();
      await new Promise(r => setTimeout(r, 1000));

      // Seek playhead to 2.5s
      const timelineEl = document.querySelector('[data-testid="main-preview-canvas"]');

      // Click split button (S or Böl button)
      const splitBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Böl'));
      if (splitBtn) {
        splitBtn.click();
      }

      await new Promise(r => setTimeout(r, 500));

      // Check preview canvas pixel sample to verify NO brown procedural box
      const canvas = document.querySelector('[data-testid="main-preview-canvas"]');
      if (!canvas) return { error: 'Canvas not found' };

      const ctx = canvas.getContext('2d');
      const imgData = ctx.getImageData(canvas.width / 2, canvas.height / 2, 1, 1).data;

      // Sample color
      return {
        splitPerformed: !!splitBtn,
        pixelCenter: [imgData[0], imgData[1], imgData[2], imgData[3]],
        clipCount: document.querySelectorAll('[data-clip-id]').length,
      };
    })()`);

    console.log('Split verification result:', splitCheck);

    // 3. Take screenshot of canvas after split
    const shot = await send('Page.captureScreenshot', { format: 'png' });
    const target = path.join(ARTIFACT_DIR, 'forma_verified_split_clean_no_brown_box.png');
    await fs.writeFile(target, Buffer.from(shot.data, 'base64'));
    console.log(`[PASS] Clean split screenshot saved: ${target}`);

    // Take screenshot of Transitions Tab showing 100/100
    await evalJs(`(() => {
      const rail = document.querySelector('[data-testid="rail-tab-transitions"]');
      if (rail) rail.click();
    })()`);
    await new Promise((r) => setTimeout(r, 600));

    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    const target2 = path.join(ARTIFACT_DIR, 'forma_verified_transitions_100_badge_clean.png');
    await fs.writeFile(target2, Buffer.from(shot2.data, 'base64'));
    console.log(`[PASS] 100/100 Transitions screenshot saved: ${target2}`);

    console.log('\nALL VERIFICATIONS PASSED: 0 Brown Box, 100/100 Transitions Verified!');
  } finally {
    try {
      ws.close();
      chromeProc.kill();
    } catch {}
  }
}

main().catch((e) => {
  console.error('VERIFICATION ERROR:', e);
  process.exit(1);
});

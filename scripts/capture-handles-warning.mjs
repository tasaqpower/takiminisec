import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs/promises';

const ARTIFACT_DIR = 'C:\\Users\\sinan\\.gemini\\antigravity\\brain\\094b1c26-b9f9-4b08-93a4-797170dbff1b';

async function capture() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9247',
    '--no-first-run',
    '--disable-gpu',
    '--window-size=1920,1080',
    '--user-data-dir=C:\\Windows\\Temp\\cdp_capture_warning',
  ]);

  await new Promise((r) => setTimeout(r, 1500));

  const newTabRes = await fetch('http://127.0.0.1:9247/json/new?http://localhost:5173/video-editor', {
    method: 'PUT',
  });
  const tab = await newTabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r) => ws.once('open', r));

  let reqId = 1;
  const send = (method, params = {}) =>
    new Promise((resolve) => {
      const curId = reqId++;
      const handler = (data) => {
        const m = JSON.parse(data);
        if (m.id === curId) {
          ws.off('message', handler);
          resolve(m.result);
        }
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await new Promise((r) => setTimeout(r, 2000));

  // Click on a timeline transition to select it and open the inspector panel
  await send('Runtime.evaluate', {
    expression: `(() => {
      let badge = document.querySelector('[data-testid="timeline-transition"]');
      if (!badge) {
        const card = document.querySelector('[data-transition-id="crossfade"]');
        if (card) card.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
      }
      setTimeout(() => {
        const b = document.querySelector('[data-testid="timeline-transition"]');
        if (b) b.click();
      }, 300);
    })()`,
  });

  await new Promise((r) => setTimeout(r, 1200));

  // Find inspector panel position
  const panelBounds = await send('Runtime.evaluate', {
    expression: `(() => {
      const warningHeader = Array.from(document.querySelectorAll('*')).find(
        (el) => el.textContent && el.textContent.includes('Yetersiz Medya Kolu')
      );
      if (!warningHeader) return null;
      // Get the warning card or panel container
      const card = warningHeader.closest('.rounded') || warningHeader.closest('div');
      const rect = card.getBoundingClientRect();
      return {
        x: Math.max(0, rect.x - 20),
        y: Math.max(0, rect.y - 60),
        width: Math.min(1920, rect.width + 40),
        height: Math.min(1080, rect.height + 180),
      };
    })()`,
    returnByValue: true,
  });

  console.log('Panel bounds:', panelBounds?.result?.value);

  const clip = panelBounds?.result?.value || {
    x: 1920 - 320,
    y: 46,
    width: 320,
    height: 380,
  };

  const shot = await send('Page.captureScreenshot', {
    format: 'png',
    clip: {
      x: clip.x,
      y: clip.y,
      width: clip.width,
      height: clip.height,
      scale: 1,
    },
  });

  ws.close();
  chrome.kill();

  if (shot?.data) {
    const p = `${ARTIFACT_DIR}\\transition_media_handles_warning.png`;
    await fs.writeFile(p, Buffer.from(shot.data, 'base64'));
    console.log('Saved updated transition_media_handles_warning.png to:', p);
  } else {
    console.error('Screenshot capture failed');
  }
}

capture().catch(console.error);

import { spawn } from 'child_process';
import WebSocket from 'ws';

async function check() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9277',
    '--no-first-run',
    '--disable-gpu',
    '--user-data-dir=' + (process.env.TEMP || 'C:\\Windows\\Temp') + '\\check_live_dom_' + Date.now(),
  ]);

  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9277/json/version');
      if (res.ok) break;
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }

  const newTabRes = await fetch('http://127.0.0.1:9277/json/new?http://localhost:5173/video-editor', { method: 'PUT' });
  const tab = await newTabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(r => ws.once('open', r));

  let msgId = 1;
  const pending = new Map();
  ws.on('message', data => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve } = pending.get(msg.id);
      pending.delete(msg.id);
      resolve(msg.result);
    }
  });
  function send(method, params = {}) {
    return new Promise(resolve => {
      const id = msgId++;
      pending.set(id, { resolve });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await new Promise(r => setTimeout(r, 2500));

  // Click on transitions rail
  const res = await send('Runtime.evaluate', {
    expression: `(() => {
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
    })()`,
    awaitPromise: true,
    returnByValue: true,
  });

  console.log('LIVE DOM CHECK RESULT:', res.result?.value);
  ws.close();
  chromeProc.kill();
}
check().catch(e => console.error(e));

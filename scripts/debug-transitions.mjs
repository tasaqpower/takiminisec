import { spawn } from 'child_process';
import WebSocket from 'ws';

async function test() {
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9232',
    '--no-first-run',
    '--disable-gpu',
    '--user-data-dir=' + (process.env.TEMP || 'C:\\Windows\\Temp') + '\\debug_' + Date.now(),
  ]);

  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9232/json/version');
      if (res.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }

  const tabRes = await fetch('http://127.0.0.1:9232/json/new?http://localhost:5173/video-editor', { method: 'PUT' });
  const tab = await tabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((r) => ws.once('open', r));

  let msgId = 1;
  const pending = new Map();
  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      console.log('[BROWSER CONSOLE]', msg.params.type, msg.params.args.map((a) => a.value || a.description).join(' '));
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      console.error('[BROWSER EXCEPTION]', msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
    }
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
  await new Promise((r) => setTimeout(r, 2000));

  console.log('Clicking Transitions Tab button...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btn = document.querySelector('[data-testid="rail-tab-transitions"]');
      if (btn) btn.click();
    })()`,
  });

  await new Promise((r) => setTimeout(r, 1500));

  const check = await send('Runtime.evaluate', {
    expression: `(() => {
      const transIdCards = document.querySelectorAll('[data-transition-id]');
      const transCardCards = document.querySelectorAll('[data-transition-card]');
      return {
        transIdCount: transIdCards.length,
        transCardCount: transCardCards.length,
        sampleIds: Array.from(transIdCards).slice(0, 10).map(c => c.getAttribute('data-transition-id')),
      };
    })()`,
    returnByValue: true,
  });
  console.log('Cards check result:', JSON.stringify(check.result?.value, null, 2));

  ws.close();
  chromeProc.kill();
}

test().catch(console.error);

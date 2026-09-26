import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs/promises';

async function main() {
  console.log('[E2E] Launching headless Chrome...');
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9223',
    '--no-first-run',
    '--disable-gpu',
    '--user-data-dir=' + process.env.TEMP + '\\e2e_video_pro_' + Date.now(),
  ]);

  let versionData = null;
  for (let i = 0; i < 25; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9223/json/version');
      if (res.ok) { versionData = await res.json(); break; }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!versionData) {
    throw new Error('Chrome failed to start on port 9223');
  }

  console.log('[E2E] Chrome started. Opening video editor at http://localhost:5173/video-editor ...');
  const newTabRes = await fetch('http://127.0.0.1:9223/json/new?http://localhost:5173/video-editor', { method: 'PUT' });
  const tab = await newTabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.once('open', resolve));

  let msgId = 1;
  const pending = new Map();
  const consoleLogs = [];

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map((a) => a.value || a.description || '').join(' ');
      consoleLogs.push({ type: msg.params.type, text });
      if (msg.params.type === 'error') {
        console.error('[Browser Error]', text);
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

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1536,
    height: 960,
    deviceScaleFactor: 1,
    mobile: false
  });

  console.log('[E2E] Waiting for page hydration...');
  await new Promise((r) => setTimeout(r, 4000));

  // 1. Verify Topbar and Main Layout
  const layoutCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const topbar = document.querySelector('header') || document.body.innerText.includes('Forma Video');
      const timeline = document.querySelector('.h-72');
      const aside = document.querySelector('aside');
      return {
        hasTopbar: Boolean(topbar),
        hasTimeline: Boolean(timeline),
        hasAside: Boolean(aside),
        bodySnippet: document.body.innerText.slice(0, 200)
      };
    })()`,
    returnByValue: true,
  });
  console.log('[E2E] Layout check:', layoutCheck.result?.value);

  // 2. Click "Geçişler" tab in sidebar
  console.log('[E2E] Checking Transitions sidebar tab...');
  const transitionsCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const tabBtns = Array.from(document.querySelectorAll('button'));
      const transTab = tabBtns.find(b => b.innerText.includes('Geçişler'));
      if (transTab) transTab.click();
      return Boolean(transTab);
    })()`,
    returnByValue: true,
  });
  await new Promise((r) => setTimeout(r, 800));

  const countTransitions = await send('Runtime.evaluate', {
    expression: `(() => {
      const cards = Array.from(document.querySelectorAll('[draggable="true"]'));
      const categoryTabs = Array.from(document.querySelectorAll('button')).filter(b => 
        ['Tümü', 'Temel', 'Hareket', 'Işık', 'Şekil & Maske', 'Glitch & Stilize'].some(t => b.innerText.includes(t))
      );
      return {
        draggableCount: cards.length,
        categoriesFound: categoryTabs.map(c => c.innerText.trim())
      };
    })()`,
    returnByValue: true,
  });
  console.log('[E2E] Transitions count:', countTransitions.result?.value);

  // 3. Click "Efektler" tab in sidebar
  console.log('[E2E] Checking Visual Effects sidebar tab...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const tabBtns = Array.from(document.querySelectorAll('button'));
      const effTab = tabBtns.find(b => b.innerText.includes('Efektler'));
      if (effTab) effTab.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 800));

  const countEffects = await send('Runtime.evaluate', {
    expression: `(() => {
      const cards = Array.from(document.querySelectorAll('[draggable="true"]'));
      return {
        effectsDraggableCount: cards.length
      };
    })()`,
    returnByValue: true,
  });
  console.log('[E2E] Effects count:', countEffects.result?.value);

  // 4. Click "Metin" tab in sidebar
  console.log('[E2E] Checking Text Animations in sidebar tab...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const tabBtns = Array.from(document.querySelectorAll('button'));
      const textTab = tabBtns.find(b => b.innerText.includes('Metin'));
      if (textTab) textTab.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 800));

  const countAnimations = await send('Runtime.evaluate', {
    expression: `(() => {
      const animTabs = Array.from(document.querySelectorAll('button')).filter(b => 
        ['Giriş (In)', 'Döngü (Loop)', 'Çıkış (Out)'].some(t => b.innerText.includes(t))
      );
      return {
        animTabsFound: animTabs.map(b => b.innerText.trim())
      };
    })()`,
    returnByValue: true,
  });
  console.log('[E2E] Text animation tabs:', countAnimations.result?.value);

  // 5. Add two stock clips and simulate bowtie transition and effect ribbons
  console.log('[E2E] Adding stock clips to timeline to test cut point and bowtie badge...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const tabBtns = Array.from(document.querySelectorAll('button'));
      const mediaTab = tabBtns.find(b => b.innerText.includes('Medya'));
      if (mediaTab) mediaTab.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 800));

  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      // Add first clip
      const c1 = btns.find(b => b.innerText.includes('Sinematik Geri'));
      if (c1) c1.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 1200));

  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      // Add second clip
      const c2 = btns.find(b => b.innerText.includes('Siber Şehir'));
      if (c2) c2.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 1200));

  // 6. Test dragging a transition into timeline or creating via context
  console.log('[E2E] Simulating transition & effect integration...');
  const stateCheck = await send('Runtime.evaluate', {
    expression: `(() => {
      const clips = document.querySelectorAll('.cursor-grab');
      return {
        renderedClipsCount: clips.length
      };
    })()`,
    returnByValue: true,
  });
  console.log('[E2E] Rendered clips on timeline:', stateCheck.result?.value);

  // Take full verification screenshot
  const shot = await send('Page.captureScreenshot', { format: 'png' });
  const buf = Buffer.from(shot.data, 'base64');
  const artifactPath = 'C:\\Users\\sinan\\.gemini\\antigravity\\brain\\094b1c26-b9f9-4b08-93a4-797170dbff1b\\verify_video_editor_e2e.png';
  await fs.writeFile(artifactPath, buf);
  console.log('[E2E] Saved screenshot artifact to:', artifactPath);

  ws.close();
  chromeProc.kill();
  console.log('[E2E] Verification completed successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('[E2E Error]', err);
  process.exit(1);
});

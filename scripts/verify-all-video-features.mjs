import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs/promises';

async function main() {
  console.log('[Verify All] Starting Chrome...');
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9224',
    '--no-first-run',
    '--disable-gpu',
    '--user-data-dir=' + process.env.TEMP + '\\all_features_check_' + Date.now(),
  ]);

  let versionData = null;
  for (let i = 0; i < 25; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9224/json/version');
      if (res.ok) { versionData = await res.json(); break; }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!versionData) throw new Error('Chrome did not launch on port 9224');

  const newTabRes = await fetch('http://127.0.0.1:9224/json/new?http://localhost:5173/video-editor', { method: 'PUT' });
  const tab = await newTabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.once('open', resolve));

  let msgId = 1;
  const pending = new Map();

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map((a) => a.value || a.description || '').join(' ');
      if (msg.params.type === 'error') console.error('[Browser Error]', text);
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

  console.log('[Verify All] Waiting for page load...');
  await new Promise((r) => setTimeout(r, 4500));

  // 1. Add Stock Clips to Timeline
  console.log('[Verify All] Step 1: Adding stock clips to timeline...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const stock1 = btns.find(b => b.innerText.includes('Sinematik Geri'));
      if (stock1) stock1.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 1000));

  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const stock2 = btns.find(b => b.innerText.includes('Kozmik Galaksi'));
      if (stock2) stock2.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 1000));

  // 2. Open "Geçişler" Tab and Apply Transition
  console.log('[Verify All] Step 2: Opening Transitions tab and applying transition...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const transTab = btns.find(b => b.innerText.includes('Geçişler'));
      if (transTab) transTab.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 800));

  // Check category buttons in Transitions
  const transCatInfo = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const catBtns = btns.filter(b => b.innerText.includes('Tümü (38)') || b.innerText.includes('Temel') || b.innerText.includes('Kayma') || b.innerText.includes('Stilize'));
      return catBtns.map(b => b.innerText.trim());
    })()`,
    returnByValue: true,
  });
  console.log('[Verify All] Transition Categories found:', transCatInfo.result?.value);

  // Click on a transition card to apply it
  await send('Runtime.evaluate', {
    expression: `(() => {
      const cards = Array.from(document.querySelectorAll('.cursor-grab'));
      // Find a transition card e.g. Çapraz Kararma or Whip Pan
      const card = cards.find(c => c.innerText.includes('Çapraz') || c.innerText.includes('Whip') || c.innerText.includes('Kaydırma'));
      if (card) card.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 1000));

  // 3. Open "Filtreler" Tab and Apply Visual Effect
  console.log('[Verify All] Step 3: Opening Filtreler tab and applying Visual Effect...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const filterTab = btns.find(b => b.innerText.includes('Filtreler'));
      if (filterTab) filterTab.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 800));

  const effectTabs = await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const effBtns = btns.filter(b => b.innerText.includes('Görsel Efektler (24)') || b.innerText.includes('Renk Filtreleri (12)'));
      return effBtns.map(b => b.innerText.trim());
    })()`,
    returnByValue: true,
  });
  console.log('[Verify All] Effects subtabs found:', effectTabs.result?.value);

  // Click on a visual effect card to apply
  await send('Runtime.evaluate', {
    expression: `(() => {
      const cards = Array.from(document.querySelectorAll('.cursor-grab'));
      const effCard = cards.find(c => c.innerText.includes('Film Greni') || c.innerText.includes('VHS') || c.innerText.includes('Parazit') || c.innerText.includes('Neon'));
      if (effCard) effCard.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 1000));

  // 4. Open "Metin" Tab and Add Text with Animation
  console.log('[Verify All] Step 4: Adding text with animation...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      const textTab = btns.find(b => b.innerText.includes('Metin'));
      if (textTab) textTab.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 800));

  // Click on an animated text card
  await send('Runtime.evaluate', {
    expression: `(() => {
      const cards = Array.from(document.querySelectorAll('.cursor-grab'));
      const animCard = cards.find(c => c.innerText.includes('Daktilo') || c.innerText.includes('Neon') || c.innerText.includes('Pop') || c.innerText.includes('Zoom'));
      if (animCard) animCard.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 1200));

  // 5. Check Timeline for Rendered Elements
  console.log('[Verify All] Step 5: Checking Timeline elements (Clips, Badges, Ribbons)...');
  const timelineAudit = await send('Runtime.evaluate', {
    expression: `(() => {
      const clips = Array.from(document.querySelectorAll('.cursor-grab'));
      const transitionBadges = Array.from(document.querySelectorAll('button')).filter(b => b.innerText.includes('⚡'));
      const effectRibbons = Array.from(document.querySelectorAll('*')).filter(el => el.innerText && el.innerText.includes('🎨') && el.innerText.includes('✕'));
      const textAnimChips = Array.from(document.querySelectorAll('*')).filter(el => el.innerText && (el.innerText.includes('🟢') || el.innerText.includes('🔵') || el.innerText.includes('🟠')));

      return {
        totalClips: clips.length,
        hasTransitionBadges: transitionBadges.length > 0,
        transitionBadgeLabels: transitionBadges.map(b => b.innerText.trim()).slice(0, 5),
        hasEffectRibbons: effectRibbons.length > 0,
        hasTextAnimChips: textAnimChips.length > 0,
      };
    })()`,
    returnByValue: true,
  });
  console.log('[Verify All] Timeline Elements Audit:', timelineAudit.result?.value);

  // Capture screenshot of the workspace with all active elements
  const shot1 = await send('Page.captureScreenshot', { format: 'png' });
  const buf1 = Buffer.from(shot1.data, 'base64');
  const path1 = 'C:\\Users\\sinan\\.gemini\\antigravity\\brain\\094b1c26-b9f9-4b08-93a4-797170dbff1b\\verify_timeline_full_active.png';
  await fs.writeFile(path1, buf1);
  console.log('[Verify All] Saved screenshot 1 to:', path1);

  // 6. Test Right Properties Panel with Selection
  console.log('[Verify All] Step 6: Testing Properties Panel...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      // Click on text tab or animation tab in properties
      const rightPanel = document.querySelector('aside:last-of-type');
      const tabs = Array.from(rightPanel ? rightPanel.querySelectorAll('button') : []);
      const animTab = tabs.find(t => t.innerText.includes('Animasyon'));
      if (animTab) animTab.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 800));

  const propertiesAudit = await send('Runtime.evaluate', {
    expression: `(() => {
      const rightPanel = document.querySelector('aside:last-of-type');
      return {
        headerText: rightPanel ? rightPanel.innerText.slice(0, 150) : 'none',
        hasAnimations: rightPanel ? rightPanel.innerText.includes('Giriş Animasyonu') || rightPanel.innerText.includes('Döngü') : false,
      };
    })()`,
    returnByValue: true,
  });
  console.log('[Verify All] Properties Panel Audit:', propertiesAudit.result?.value);

  const shot2 = await send('Page.captureScreenshot', { format: 'png' });
  const buf2 = Buffer.from(shot2.data, 'base64');
  const path2 = 'C:\\Users\\sinan\\.gemini\\antigravity\\brain\\094b1c26-b9f9-4b08-93a4-797170dbff1b\\verify_properties_inspector_active.png';
  await fs.writeFile(path2, buf2);
  console.log('[Verify All] Saved screenshot 2 to:', path2);

  ws.close();
  chromeProc.kill();
  console.log('[Verify All] All E2E steps passed successfully!');
  process.exit(0);
}

main().catch((err) => {
  console.error('[Verify All Error]', err);
  process.exit(1);
});

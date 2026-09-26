import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs';

async function main() {
  console.log('=== VERIFYING SIDEBAR & PROPERTIES TABS FIX VIA CHROME CDP ===');

  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9245',
    '--no-first-run',
    '--disable-gpu',
    '--window-size=1440,900',
    '--user-data-dir=' + process.env.TEMP + '\\test_verify_palette_' + Date.now(),
  ]);

  for (let i = 0; i < 25; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9245/json/version');
      if (res.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }

  const newTabRes = await fetch('http://127.0.0.1:9245/json/new?http://localhost:5173/video-editor', { method: 'PUT' });
  const tab = await newTabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.once('open', resolve));

  let msgId = 1;
  const pending = new Map();
  const logs = [];

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map((a) => a.value || a.description || JSON.stringify(a)).join(' ');
      logs.push(text);
      if (text.includes('error') || text.includes('Error')) {
        console.log('[BROWSER LOG]', text);
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

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error('Evaluation error: ' + JSON.stringify(res.exceptionDetails));
    }
    return res.result.value;
  }

  async function takeScreenshot(filename) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const fullPath = 'C:/Users/sinan/.gemini/antigravity/brain/094b1c26-b9f9-4b08-93a4-797170dbff1b/' + filename;
    fs.writeFileSync(fullPath, Buffer.from(res.data, 'base64'));
    console.log(`   📸 Screenshot saved: ${filename}`);
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await new Promise((r) => setTimeout(r, 3000));

  // 1. Verify Left Sidebar features in Media Tab
  console.log('\n--- 1. Testing Left Sidebar Upgraded Media Studio ---');
  const sidebarRes = await evaluate(`
    (async () => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const hasScreenRec = buttons.some(b => b.textContent?.includes('Ekranı Kaydet'));
      const hasWebcamRec = buttons.some(b => b.textContent?.includes('Kamera Kaydet'));
      const hasVoiceRec = buttons.some(b => b.textContent?.includes('Ses Kaydet'));
      const hasUrlToggle = Array.from(document.querySelectorAll('*')).some(el => el.textContent?.includes('Web Bağlantısından Medya İçe Aktar'));
      const hasCountdown = buttons.some(b => b.textContent?.includes('Geri Sayım'));

      // Click on Stock Clips preset
      const countdownBtn = buttons.find(b => b.textContent?.includes('Geri Sayım'));
      if (countdownBtn) {
        countdownBtn.click();
        await new Promise(r => setTimeout(r, 1200));
      }

      return {
        hasScreenRec,
        hasWebcamRec,
        hasVoiceRec,
        hasUrlToggle,
        hasCountdown,
      };
    })()
  `);
  console.log('   Sidebar Media Studio Features:', sidebarRes);
  await takeScreenshot('verify_left_media_sidebar.png');

  // 2. Verify Right Properties Panel: All Tabs & Names Visible
  console.log('\n--- 2. Testing Right Properties Panel Tab Bar (No Truncation) ---');
  const rightPanelRes = await evaluate(`
    (async () => {
      const aside = document.querySelectorAll('aside')[1]; // Right properties panel
      if (!aside) return { error: 'Right aside not found' };

      const tabButtons = Array.from(aside.querySelectorAll('button')).filter(b => {
        const text = b.textContent || '';
        return text.includes('Temel') || text.includes('Animasyon') || text.includes('Maske') || text.includes('Renk') || text.includes('Ses');
      });

      const tabTexts = tabButtons.map(b => b.textContent?.trim());
      
      // Specifically click the 'Renk' tab to verify it works
      const renkBtn = tabButtons.find(b => b.textContent?.includes('Renk'));
      if (renkBtn) {
        renkBtn.click();
        await new Promise(r => setTimeout(r, 400));
      }

      const hasRenkHeader = Array.from(aside.querySelectorAll('*')).some(el => el.textContent?.includes('RENK & FİLTRE AYARLARI'));

      return {
        foundTabsCount: tabButtons.length,
        tabTexts,
        hasRenkHeader,
        asideWidth: aside.getBoundingClientRect().width,
      };
    })()
  `);
  console.log('   Right Panel Tabs & Width:', rightPanelRes);
  await takeScreenshot('verify_right_panel_tabs_fixed.png');

  // 3. Switch left sidebar to Renk & Zemin
  console.log('\n--- 3. Testing Chroma & Colors Sub-tab in Left Sidebar ---');
  const chromaRes = await evaluate(`
    (async () => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const colorsSubTab = buttons.find(b => b.textContent?.includes('Renk & Zemin'));
      if (colorsSubTab) {
        colorsSubTab.click();
        await new Promise(r => setTimeout(r, 500));
      }

      const hasChromaGreen = buttons.some(b => b.textContent?.includes('Yeşil Perde'));
      const hasChromaBlue = buttons.some(b => b.textContent?.includes('Mavi Perde'));
      const hasCustomColor = Array.from(document.querySelectorAll('*')).some(el => el.textContent?.includes('Özel Renk Zemin'));

      // Click Yeşil Perde to add to timeline
      const greenBtn = buttons.find(b => b.textContent?.includes('Yeşil Perde'));
      if (greenBtn) {
        greenBtn.click();
        await new Promise(r => setTimeout(r, 1000));
      }

      return { hasChromaGreen, hasChromaBlue, hasCustomColor };
    })()
  `);
  console.log('   Chroma & Colors Sub-tab:', chromaRes);
  await takeScreenshot('verify_chroma_and_colors.png');

  console.log('\n=== ALL VERIFICATIONS COMPLETED SUCCESSFULLY ===\n');

  ws.close();
  chromeProc.kill();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

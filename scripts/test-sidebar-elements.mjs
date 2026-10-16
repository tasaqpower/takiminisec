import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 5173;
const CDP_PORT = 9225;

function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

function getChromePath() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
    process.env.PROGRAMFILES + '\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const c of candidates) {
    if (c && fs.existsSync(c)) return c;
  }
  return null;
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.pending = new Map();
  }

  async connect() {
    const WebSocketModule = await import('ws');
    const WebSocket = WebSocketModule.default || WebSocketModule;
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.on('open', resolve);
      this.ws.on('error', reject);
      this.ws.on('message', (data) => {
        const msg = JSON.parse(data.toString());
        if (msg.id && this.pending.has(msg.id)) {
          const { resolve, reject } = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) reject(new Error(msg.error.message));
          else resolve(msg.result);
        }
      });
    });
  }

  send(method, params = {}) {
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(JSON.stringify(res.exceptionDetails));
    }
    return res.result?.value;
  }
}

async function main() {
  const chromePath = getChromePath();
  const userDataDir = path.join(process.cwd(), '.chrome-sidebar-test-' + Date.now());
  const chromeProc = spawn(
    chromePath,
    [
      '--headless=new',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${userDataDir}`,
      '--disable-gpu',
      '--window-size=1600,1000',
      `http://localhost:${PORT}/video-editor`,
    ],
    { stdio: 'ignore' }
  );

  try {
    let targets = null;
    for (let i = 0; i < 30; i++) {
      await delay(500);
      try {
        targets = await new Promise((res, rej) => {
          http.get(`http://127.0.0.1:${CDP_PORT}/json`, (r) => {
            let data = '';
            r.on('data', (c) => (data += c));
            r.on('end', () => res(JSON.parse(data)));
          }).on('error', rej);
        });
        if (targets && targets.length > 0) break;
      } catch {}
    }

    const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
    const cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    await delay(3500);

    // Open Elements sidebar tab
    const openTabResult = await cdp.evaluate(`
      (() => {
        // Find sidebar button for Elements (Grafik & Çıkartmalar or Shapes icon)
        const buttons = Array.from(document.querySelectorAll('button'));
        const elemBtn = buttons.find(b => b.textContent.includes('Öğeler') || b.textContent.includes('Çıkartma') || b.querySelector('svg.lucide-shapes'));
        if (elemBtn) {
          elemBtn.click();
          return { clicked: true, text: elemBtn.textContent };
        }
        return { clicked: false, availableButtons: buttons.map(b => b.textContent.trim()).filter(Boolean).slice(0, 15) };
      })()
    `);
    console.log('[TEST] Elements tab button click:', openTabResult);
    await delay(1500);

    // Inspect elements list in sidebar
    const listInfo = await cdp.evaluate(`
      (() => {
        const categoryButtons = Array.from(document.querySelectorAll('button')).filter(b => 
          b.textContent.includes('Tümü') || 
          b.textContent.includes('TikTok') || 
          b.textContent.includes('YouTube') || 
          b.textContent.includes('Instagram') ||
          b.textContent.includes('Canlı') ||
          b.textContent.includes('AI')
        ).map(b => b.textContent.trim());

        const items = Array.from(document.querySelectorAll('[data-element-item]')).map(el => {
          return {
            id: el.getAttribute('data-element-item'),
            title: el.querySelector('p')?.textContent?.trim(),
            badge: el.querySelector('span')?.textContent?.trim()
          };
        });

        // Check if any AI element exists
        const hasAiElements = items.some(item => item.id.includes('ai-') || (item.title && item.title.includes('AI ')));
        const hasAiCategory = categoryButtons.some(cat => cat.includes('AI'));

        return {
          categoryButtons,
          itemCount: items.length,
          topItems: items.slice(0, 8),
          hasAiElements,
          hasAiCategory
        };
      })()
    `);

    console.log('[TEST] Sidebar inspection result:', JSON.stringify(listInfo, null, 2));

    // Capture screenshot of the sidebar
    const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const outPath = path.join(process.cwd(), 'artifacts', 'elements_tab_sidebar_verified.png');
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, Buffer.from(screenshot.data, 'base64'));
    console.log(`[TEST] Saved screenshot to: ${outPath}`);

    // Click on TikTok category
    await cdp.evaluate(`
      (() => {
        const buttons = Array.from(document.querySelectorAll('button'));
        const ttBtn = buttons.find(b => b.textContent.includes('TikTok'));
        if (ttBtn) ttBtn.click();
      })()
    `);
    await delay(1000);

    const ttItems = await cdp.evaluate(`
      (() => {
        return Array.from(document.querySelectorAll('[data-element-item]')).map(el => ({
          id: el.getAttribute('data-element-item'),
          title: el.querySelector('p')?.textContent?.trim(),
        }));
      })()
    `);
    console.log('[TEST] TikTok category items in sidebar:', ttItems);

    const screenshotTT = await cdp.send('Page.captureScreenshot', { format: 'png' });
    const outPathTT = path.join(process.cwd(), 'artifacts', 'elements_tab_tiktok_category_verified.png');
    fs.writeFileSync(outPathTT, Buffer.from(screenshotTT.data, 'base64'));
    console.log(`[TEST] Saved TikTok category screenshot to: ${outPathTT}`);

    return { listInfo, ttItems };
  } finally {
    try { chromeProc.kill('SIGKILL'); } catch {}
    try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch(err => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});

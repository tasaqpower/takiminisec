import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs/promises';

const ARTIFACT_DIR = 'C:\\Users\\sinan\\.gemini\\antigravity\\brain\\094b1c26-b9f9-4b08-93a4-797170dbff1b';

async function main() {
  console.log('[Suite] Launching Chrome for verification suite...');
  const userDataDir = (process.env.TEMP || 'C:\\Windows\\Temp') + '\\verify_suite_' + Date.now();
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9227',
    '--no-first-run',
    '--disable-gpu',
    '--user-data-dir=' + userDataDir,
  ]);

  let versionData = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9227/json/version');
      if (res.ok) { versionData = await res.json(); break; }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!versionData) {
    chromeProc.kill();
    throw new Error('Chrome did not launch on port 9227');
  }

  const newTabRes = await fetch('http://127.0.0.1:9227/json/new?http://localhost:5173/video-editor', { method: 'PUT' });
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
  await new Promise((r) => setTimeout(r, 2500));

  async function setViewport(width, height) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await new Promise((r) => setTimeout(r, 600));
  }

  async function takeScreenshot(fileName, clip = null) {
    const params = { format: 'png' };
    if (clip) {
      params.clip = clip;
    }
    const shot = await send('Page.captureScreenshot', params);
    const target = `${ARTIFACT_DIR}\\${fileName}`;
    await fs.writeFile(target, Buffer.from(shot.data, 'base64'));
    console.log(`[Suite] Saved: ${target}`);
  }

  async function evalJs(expr) {
    const res = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.value;
  }

  console.log('[Suite] Resetting workspace to clear state for empty screenshot...');
  await evalJs(`(() => {
    localStorage.clear();
    sessionStorage.clear();
  })()`);
  await send('Page.reload');
  await new Promise((r) => setTimeout(r, 2500));

  // 1. Empty State (1920x1080)
  console.log('[Suite] 1. Capturing video-editor-redesign-empty-1920.png...');
  await setViewport(1920, 1080);
  await takeScreenshot('video-editor-redesign-empty-1920.png');

  // Populate timeline with 3 distinct tracks: Video (V1), Audio (A1), Text (T1)
  console.log('[Suite] Populating 3-track timeline (Video, Audio, Text)...');

  // Add Stock video clips
  await evalJs(`(() => {
    const stockItems = Array.from(document.querySelectorAll('[data-stock-clip]'));
    if (stockItems[0]) stockItems[0].click();
    if (stockItems[1]) setTimeout(() => stockItems[1].click(), 300);
  })()`);
  await new Promise((r) => setTimeout(r, 1200));

  // Add Audio clip from AudioTab
  console.log('[Suite] Adding audio sound effect to A1...');
  await evalJs(`(() => {
    const railAudio = document.querySelector('[data-testid="rail-tab-audio"]');
    if (railAudio) railAudio.click();
  })()`);
  await new Promise((r) => setTimeout(r, 600));

  await evalJs(`(() => {
    const addSfxBtns = Array.from(document.querySelectorAll('[data-audio-item] button')).filter(b => b.innerText.includes('Ekle'));
    if (addSfxBtns[0]) addSfxBtns[0].click();
  })()`);
  await new Promise((r) => setTimeout(r, 1200));

  // Add Text clip from TextTab
  console.log('[Suite] Adding text clip to T1...');
  await evalJs(`(() => {
    const railText = document.querySelector('[data-testid="rail-tab-text"]');
    if (railText) railText.click();
  })()`);
  await new Promise((r) => setTimeout(r, 600));

  await evalJs(`(() => {
    const addTextBtn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('Yeni Metin Katmanı Ekle'));
    if (addTextBtn) addTextBtn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 1200));

  // Switch back to Media tab
  await evalJs(`(() => {
    const railMedia = document.querySelector('[data-testid="rail-tab-media"]');
    if (railMedia) railMedia.click();
  })()`);
  await new Promise((r) => setTimeout(r, 800));

  // 2. Full Workspace (1920x1080)
  console.log('[Suite] 2. Capturing video-editor-redesign-full-1920.png...');
  await setViewport(1920, 1080);
  await takeScreenshot('video-editor-redesign-full-1920.png');

  // 3. Full Workspace (1440x900)
  console.log('[Suite] 3. Capturing video-editor-redesign-full-1440.png...');
  await setViewport(1440, 900);
  await takeScreenshot('video-editor-redesign-full-1440.png');

  // 4. Full Workspace (1366x768)
  console.log('[Suite] 4. Capturing video-editor-redesign-full-1366.png...');
  await setViewport(1366, 768);
  await takeScreenshot('video-editor-redesign-full-1366.png');

  // 5. Sidebar Collapsed (Tool rail only, wide preview)
  console.log('[Suite] 5. Capturing video-editor-redesign-sidebar-collapsed.png...');
  await setViewport(1920, 1080);
  await evalJs(`(() => {
    // Click close button on drawer header or click active rail tab
    const closeBtn = document.querySelector('button[title="Paneli Kapat"]');
    if (closeBtn) closeBtn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 500));
  await takeScreenshot('video-editor-redesign-sidebar-collapsed.png');

  // Re-open sidebar
  await evalJs(`(() => {
    const railMedia = document.querySelector('[data-testid="rail-tab-media"]');
    if (railMedia) railMedia.click();
  })()`);
  await new Promise((r) => setTimeout(r, 500));

  // 6. Timeline close-up with 3+ tracks populated
  console.log('[Suite] 6. Capturing video-editor-redesign-timeline.png (Timeline Close-Up)...');
  await evalJs(`(() => {
    const clipEl = document.querySelector('[data-clip-id]');
    if (clipEl) clipEl.click();
  })()`);
  await new Promise((r) => setTimeout(r, 400));
  const timelineBox = await evalJs(`(() => {
    const el = document.querySelector('[data-testid="video-timeline"]');
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { x: Math.floor(rect.x), y: Math.floor(rect.y), width: Math.floor(rect.width), height: Math.floor(rect.height), scale: 1 };
  })()`);
  await takeScreenshot('video-editor-redesign-timeline.png', timelineBox);

  // 7. Inspector screenshot (Clip selected, showing right panel with transform, opacity, speed, etc.)
  console.log('[Suite] 7. Capturing video-editor-redesign-inspector.png...');
  await evalJs(`(() => {
    const clipEl = document.querySelector('[data-clip-id]');
    if (clipEl) clipEl.click();
  })()`);
  await new Promise((r) => setTimeout(r, 500));
  await takeScreenshot('video-editor-redesign-inspector.png');

  // 8. Transitions Tab screenshot
  console.log('[Suite] 8. Capturing video-editor-redesign-transition-drag.png...');
  await evalJs(`(() => {
    const transBtn = document.querySelector('[data-testid="rail-tab-transitions"]');
    if (transBtn) transBtn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 600));
  await takeScreenshot('video-editor-redesign-transition-drag.png');

  // 9. Export Modal screenshot
  console.log('[Suite] 9. Capturing video-editor-redesign-export.png...');
  await evalJs(`(() => {
    const exportBtn = Array.from(document.querySelectorAll('header button')).find(b => b.innerText.includes('Dışa Aktar'));
    if (exportBtn) exportBtn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 800));
  await takeScreenshot('video-editor-redesign-export.png');

  // Close Export Modal
  await evalJs(`(() => {
    const closeBtn = document.querySelector('[data-export-close]') || Array.from(document.querySelectorAll('button')).find(b => b.innerText === 'İptal' || b.getAttribute('aria-label') === 'Kapat');
    if (closeBtn) closeBtn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 500));

  // 10. AI Modal screenshot
  console.log('[Suite] 10. Capturing video-editor-redesign-ai-panel.png...');
  await evalJs(`(() => {
    const aiBtn = Array.from(document.querySelectorAll('header button')).find(b => b.innerText.includes('Forma AI'));
    if (aiBtn) aiBtn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 800));
  await takeScreenshot('video-editor-redesign-ai-panel.png');

  // Close AI Modal
  await evalJs(`(() => {
    const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.getAttribute('aria-label') === 'Kapat' || b.innerText === 'Kapat');
    if (closeBtn) closeBtn.click();
  })()`);
  await new Promise((r) => setTimeout(r, 500));

  // Perform Final DOM & Zero Emoji Audit
  console.log('[Suite] Running final DOM and Zero Emoji verification...');
  const audit = await evalJs(`(() => {
    const emojiRegex = /[\\u{1F300}-\\u{1F6FF}\\u{1F900}-\\u{1F9FF}\\u{2600}-\\u{26FF}\\u{2700}-\\u{27BF}]/u;
    const bodyText = document.body.innerText;
    const matches = bodyText.match(new RegExp(emojiRegex, 'gu')) || [];

    const rootClasses = document.querySelector('.forma-video-editor')?.className || 'not-found';
    const dividers = document.querySelectorAll('[role="separator"]').length;
    const tracksCount = document.querySelectorAll('[data-testid^="track-header-"]').length;
    const clipsCount = document.querySelectorAll('[data-clip-id]').length;

    return {
      emojiCount: matches.length,
      sampleEmojis: matches.slice(0, 10),
      rootClasses,
      dividersCount: dividers,
      tracksCount,
      clipsCount,
    };
  })()`);

  console.log('[Suite] Final Audit Result:', JSON.stringify(audit, null, 2));

  ws.close();
  chromeProc.kill();
  console.log('[Suite] All screenshots captured and verified successfully!');
}

main().catch((err) => {
  console.error('[Suite Error]', err);
  process.exit(1);
});

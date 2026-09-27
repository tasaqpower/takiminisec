import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs/promises';

const ARTIFACT_DIR = 'C:\\Users\\sinan\\.gemini\\antigravity\\brain\\094b1c26-b9f9-4b08-93a4-797170dbff1b';

async function main() {
  console.log('[Artifacts] Starting high-fidelity transition screenshot capture...');

  const userDataDir = (process.env.TEMP || 'C:\\Windows\\Temp') + '\\art_' + Date.now();
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9235',
    '--no-first-run',
    '--disable-gpu',
    '--user-data-dir=' + userDataDir,
  ]);

  let versionData = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9235/json/version');
      if (res.ok) {
        versionData = await res.json();
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!versionData) {
    chromeProc.kill();
    throw new Error('Chrome did not launch on port 9235');
  }

  const newTabRes = await fetch('http://127.0.0.1:9235/json/new?http://localhost:5173/video-editor', { method: 'PUT' });
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

  async function setViewport(width, height) {
    await send('Emulation.setDeviceMetricsOverride', {
      width,
      height,
      deviceScaleFactor: 1,
      mobile: false,
    });
    await new Promise((r) => setTimeout(r, 500));
  }

  async function takeScreenshot(fileName, clip = null) {
    const params = { format: 'png' };
    if (clip) {
      params.clip = clip;
    }
    const shot = await send('Page.captureScreenshot', params);
    const target = `${ARTIFACT_DIR}\\${fileName}`;
    await fs.writeFile(target, Buffer.from(shot.data, 'base64'));
    console.log(`[PASS] Saved: ${fileName}`);
  }

  async function evalJs(expr) {
    const res = await send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    return res.result?.value;
  }

  try {
    await setViewport(1920, 1080);
    await evalJs(`(() => {
      localStorage.clear();
      sessionStorage.clear();
    })()`);
    await send('Page.reload');
    await new Promise((r) => setTimeout(r, 2500));

    // 1. Add 2 video clips from MediaTab
    console.log('[Artifacts] Adding 2 clips to timeline...');
    await evalJs(`(() => {
      const stock = Array.from(document.querySelectorAll('[data-stock-clip]'));
      if (stock[0]) stock[0].click();
      if (stock[1]) setTimeout(() => stock[1].click(), 300);
    })()`);
    await new Promise((r) => setTimeout(r, 1200));

    // 2. Open Transitions Tab
    console.log('[Artifacts] Opening Transitions tab...');
    await evalJs(`(() => {
      const railTrans = document.querySelector('[data-testid="rail-tab-transitions"]');
      if (railTrans) railTrans.click();
    })()`);
    await new Promise((r) => setTimeout(r, 1000));

    // Capture Grid Screenshot
    await takeScreenshot('transitions_browser_52_grid.png');

    // Capture Compact List Screenshot
    await evalJs(`(() => {
      const tabRoot = document.querySelector('[data-testid="transitions-tab"]');
      if (tabRoot) {
        tabRoot.style.maxWidth = '300px';
        tabRoot.style.width = '300px';
        window.dispatchEvent(new Event('resize'));
      }
    })()`);
    await new Promise((r) => setTimeout(r, 500));
    await takeScreenshot('transitions_browser_compact_list.png');

    // Restore width
    await evalJs(`(() => {
      const tabRoot = document.querySelector('[data-testid="transitions-tab"]');
      if (tabRoot) {
        tabRoot.style.maxWidth = '';
        tabRoot.style.width = '';
        window.dispatchEvent(new Event('resize'));
      }
    })()`);
    await new Promise((r) => setTimeout(r, 400));

    // 3. Single click scrub drawer
    console.log('[Artifacts] Opening single-click scrub drawer...');
    await evalJs(`(() => {
      const crossfadeCard = document.querySelector('[data-transition-id="crossfade"]') || document.querySelector('[data-transition-id]');
      if (crossfadeCard) crossfadeCard.click();
    })()`);
    await new Promise((r) => setTimeout(r, 600));
    await takeScreenshot('transition_single_click_scrub.png');

    // 4. Simulate Drag and Drop over cut point to capture transition_drag_drop_cut_snap.png
    console.log('[Artifacts] Simulating transition drag over cut point (cutTime = 5.0s)...');
    await evalJs(`(() => {
      // Find drag handle on crossfade card
      const crossfadeCard = document.querySelector('[data-transition-id="crossfade"]') || document.querySelector('[data-transition-id]');
      const dragHandle = crossfadeCard?.querySelector('svg, .cursor-grab') || crossfadeCard;

      if (dragHandle) {
        const rect = dragHandle.getBoundingClientRect();
        dragHandle.dispatchEvent(new PointerEvent('pointerdown', {
          clientX: rect.x + 10,
          clientY: rect.y + 10,
          bubbles: true,
          button: 0
        }));
      }

      // Find timeline cut coordinate at 5.0 seconds
      // Track clips: first is 0..5s, second is 5..11s
      // Zoom is 40px/sec, so cut is at 5 * 40 = 200px relative to tracks
      const timelineEl = document.querySelector('[data-testid="video-timeline"]') || document.querySelector('.forma-video-editor > div:last-child');
      const trackArea = document.querySelector('.relative.min-h-full') || timelineEl;
      if (trackArea) {
        const tRect = trackArea.getBoundingClientRect();
        const cutX = tRect.left + 5.0 * 40;
        const cutY = tRect.top + 60;

        window.dispatchEvent(new PointerEvent('pointermove', {
          clientX: cutX,
          clientY: cutY,
          bubbles: true
        }));
      }
    })()`);
    await new Promise((r) => setTimeout(r, 600));
    await takeScreenshot('transition_drag_drop_cut_snap.png');

    // End drag (pointerup)
    await evalJs(`(() => {
      window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true }));
    })()`);
    await new Promise((r) => setTimeout(r, 400));

    // 5. Apply transition via double-click to create Bowtie badge
    console.log('[Artifacts] Double clicking to apply transition to cut...');
    await evalJs(`(() => {
      const crossfadeCard = document.querySelector('[data-transition-id="crossfade"]') || document.querySelector('[data-transition-id]');
      if (crossfadeCard) crossfadeCard.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    })()`);
    await new Promise((r) => setTimeout(r, 800));
    await takeScreenshot('transition_timeline_bowtie_badge.png');

    // 6. Click Bowtie badge to open right inspector and scroll down to Telemetry card
    console.log('[Artifacts] Selecting transition and scrolling inspector to telemetry card...');
    await evalJs(`(() => {
      const bowtie = document.querySelector('[data-testid="timeline-transition"]');
      if (bowtie) bowtie.click();
    })()`);
    await new Promise((r) => setTimeout(r, 600));

    // Scroll inspector to show audio telemetry & 52 transition selector
    await evalJs(`(() => {
      const inspectorAside = Array.from(document.querySelectorAll('aside')).find(a => a.textContent?.includes('Geçiş Özellikleri'));
      if (inspectorAside) {
        inspectorAside.scrollTop = 380;
      }
    })()`);
    await new Promise((r) => setTimeout(r, 500));
    await takeScreenshot('transition_properties_inspector_telemetry.png');

    // 7. Full workspace views
    await evalJs(`(() => {
      const inspectorAside = Array.from(document.querySelectorAll('aside')).find(a => a.textContent?.includes('Geçiş Özellikleri'));
      if (inspectorAside) inspectorAside.scrollTop = 0;
    })()`);
    await new Promise((r) => setTimeout(r, 400));
    await takeScreenshot('video-editor-transitions-full-1920.png');

    await setViewport(1366, 768);
    await takeScreenshot('video-editor-transitions-full-1366.png');

    console.log('[Artifacts] All screenshots captured successfully!');
  } finally {
    ws.close();
    chromeProc.kill();
  }
}

main().catch(console.error);

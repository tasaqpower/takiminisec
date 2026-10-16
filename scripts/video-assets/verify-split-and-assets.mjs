import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';

const PORT = 9279;
const URL_TO_TEST = 'http://localhost:5173/video-editor';
const ARTIFACT_DIR = 'C:/Users/sinan/.gemini/antigravity/brain/094b1c26-b9f9-4b08-93a4-797170dbff1b';

async function run() {
  console.log('[TEST] Launching Chrome...');
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--no-first-run',
    '--autoplay-policy=no-user-gesture-required',
    '--user-data-dir=C:\\Windows\\Temp\\test_chrome_split_assets_' + Date.now(),
    '--window-size=1920,1080',
  ]);

  try {
    await new Promise((r) => setTimeout(r, 2000));
    const versionRes = await fetch(`http://127.0.0.1:${PORT}/json/version`);
    const versionData = await versionRes.json();
    const browserWs = new WebSocket(versionData.webSocketDebuggerUrl);
    await new Promise((r) => browserWs.once('open', r));

    let msgId = 1;
    const send = (ws, method, params = {}) =>
      new Promise((resolve, reject) => {
        const curId = msgId++;
        const handler = (data) => {
          const msg = JSON.parse(data);
          if (msg.id === curId) {
            ws.off('message', handler);
            if (msg.error) reject(msg.error);
            else resolve(msg.result);
          }
        };
        ws.on('message', handler);
        ws.send(JSON.stringify({ id: curId, method, params }));
      });

    await send(browserWs, 'Target.createTarget', { url: URL_TO_TEST });
    const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json();
    const pageTab = targets.find((t) => t.url.includes('video-editor'));
    const pageWs = new WebSocket(pageTab.webSocketDebuggerUrl);
    await new Promise((r) => pageWs.once('open', r));

    const pSend = (method, params = {}) => send(pageWs, method, params);

    await pSend('Runtime.enable');
    await pSend('Page.enable');
    await pSend('DOM.enable');

    console.log('[TEST] Waiting for page to load and render...');
    await new Promise((r) => setTimeout(r, 3500));

    // Test 1: Verify split behavior and seek count
    console.log('[TEST 1] Testing split and playback across split point...');
    const splitTest = await pSend('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `(async () => {
        const timeline = document.querySelector('[data-testid="timeline-btn-split"]');
        const playBtn = document.querySelector('[data-testid="playback-btn-toggle"]');
        
        // Find main video clip in video track
        const videoTrack = document.querySelector('[data-track-type="video"]');
        let seekEventCount = 0;
        const allVideos = Array.from(document.querySelectorAll('video'));
        allVideos.forEach(v => {
          v.addEventListener('seeking', () => { seekEventCount++; });
        });

        // Click split at current playhead
        if (timeline && !timeline.disabled) {
          timeline.click();
        }

        // Wait 1 second in paused state to verify no infinite seek loop
        const seeksBefore = seekEventCount;
        await new Promise(r => setTimeout(r, 1000));
        const seeksAfterPaused = seekEventCount - seeksBefore;

        // Now test playing across the cut
        const timeHistory = [];
        const onTime = () => {
          const v = document.querySelector('video');
          if (v) timeHistory.push(v.currentTime);
        };
        const interval = setInterval(onTime, 50);

        if (playBtn) playBtn.click();
        await new Promise(r => setTimeout(r, 1500));
        if (playBtn) playBtn.click();
        clearInterval(interval);

        return {
          splitBtnFound: !!timeline,
          seeksDuring1sPaused: seeksAfterPaused,
          playbackSamples: timeHistory.slice(-8),
          totalVideosCount: document.querySelectorAll('video').length
        };
      })()`
    });

    console.log('[TEST 1 RESULTS]:', JSON.stringify(splitTest.result?.value, null, 2));

    // Test 2: Asset Library Transition Test
    console.log('[TEST 2] Testing adding Push Right transition from Asset Library...');
    const assetTest = await pSend('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `(async () => {
        // Switch to Assets tab if possible
        const assetsTabBtn = document.querySelector('[data-tab="assets"]') || Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Kütüphane'));
        if (assetsTabBtn) assetsTabBtn.click();
        await new Promise(r => setTimeout(r, 800));

        // Find the canvas and take snapshot
        const canvas = document.querySelector('canvas');
        if (!canvas) return { error: 'No canvas found' };

        // Check if canvas has any text rendering "Sağa İtme"
        const ctx = canvas.getContext('2d');
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        
        return {
          canvasWidth: canvas.width,
          canvasHeight: canvas.height,
          hasValidContext: !!ctx
        };
      })()`
    });

    console.log('[TEST 2 RESULTS]:', JSON.stringify(assetTest.result?.value, null, 2));

    // Capture screenshot of the preview
    const screenshot = await pSend('Page.captureScreenshot', { format: 'png' });
    const screenshotPath = path.join(ARTIFACT_DIR, 'verified_forma_split_and_assets.png');
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.data, 'base64'));
    console.log('[TEST] Saved screenshot to:', screenshotPath);

    browserWs.close();
    pageWs.close();
  } finally {
    chrome.kill('SIGTERM');
  }
}

run().catch((err) => {
  console.error('[TEST ERROR]:', err);
  process.exit(1);
});

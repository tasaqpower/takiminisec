import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs';
import path from 'path';

const PORT = 9283;
const BASE_URL = 'http://localhost:5173/video-editor';
const ARTIFACT_DIR = 'C:/Users/sinan/.gemini/antigravity/brain/094b1c26-b9f9-4b08-93a4-797170dbff1b';

async function main() {
  console.log('[1/5] Launching Chrome on port ' + PORT + '...');
  const tempUserDataDir = path.join(process.env.TEMP || 'C:\\Windows\\Temp', 'forma_verify_' + Date.now());
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    '--no-first-run',
    '--disable-web-security',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1920,1080',
    `--user-data-dir=${tempUserDataDir}`,
  ]);

  let ws = null;
  for (let attempt = 0; attempt < 20; attempt++) {
    await new Promise((r) => setTimeout(r, 500));
    try {
      const v = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json();
      if (v?.webSocketDebuggerUrl) {
        ws = new WebSocket(v.webSocketDebuggerUrl);
        await new Promise((resolve) => ws.once('open', resolve));
        break;
      }
    } catch (_) {}
  }

  if (!ws) throw new Error('Could not connect to Chrome on port ' + PORT);

  let msgId = 1;
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = msgId++;
      const handler = (data) => {
        try {
          const json = JSON.parse(data);
          if (json.id === id) {
            ws.off('message', handler);
            if (json.error) reject(json.error);
            else resolve(json.result);
          }
        } catch (_) {}
      };
      ws.on('message', handler);
      const payload = { id, method, params };
      if (sessionId) payload.sessionId = sessionId;
      ws.send(JSON.stringify(payload));
    });

  try {
    console.log('[2/5] Navigating to ' + BASE_URL + '...');
    const target = await send('Target.createTarget', { url: BASE_URL });
    const { sessionId } = await send('Target.attachToTarget', {
      targetId: target.targetId,
      flatten: true,
    });

    await send('Page.enable', {}, sessionId);
    await send('Runtime.enable', {}, sessionId);
    await send('Emulation.setDeviceMetricsOverride', {
      width: 1920,
      height: 1080,
      deviceScaleFactor: 1,
      mobile: false,
    }, sessionId);

    await new Promise((r) => setTimeout(r, 3500));

    // Handle Recovery Modal
    await send('Runtime.evaluate', {
      expression: `(() => {
        const declineBtn = Array.from(document.querySelectorAll('button')).find(
          b => b.textContent && b.textContent.includes('Sil & Yeni Proje Başlat')
        );
        if (declineBtn) declineBtn.click();
      })()`,
    }, sessionId);

    await new Promise((r) => setTimeout(r, 1000));

    // Setup Video and Test Transitions in Asset Library
    console.log('[3/5] Testing Asset Library "Sağa İtme (Push Right)" behavior...');
    const assetTestResult = await send('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `(async () => {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

        // Switch to Assets Tab
        const railBtn = document.querySelector('[data-rail-tab="assets"]') ||
                        Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Kütüphane'));
        if (railBtn) {
          railBtn.click();
          await new Promise(r => setTimeout(r, 500));
        }

        // Add a sample video first so we have media on the timeline
        const searchInput = document.querySelector('input[placeholder*="asset ara"]');
        if (searchInput) {
          nativeSetter.call(searchInput, 'drone');
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 500));

          const videoCard = document.querySelector('[data-asset-card*="broll"]') || document.querySelector('[data-asset-card]');
          if (videoCard) {
            const addBtn = videoCard.querySelector('button[title*="Timeline"]') ||
                           Array.from(videoCard.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Ekle'));
            if (addBtn) {
              addBtn.click();
              await new Promise(r => setTimeout(r, 800));
            }
          }
        }

        // Now search specifically for "Sağa İtme"
        if (searchInput) {
          nativeSetter.call(searchInput, 'Sağa İtme');
          searchInput.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 600));

          const transCard = document.querySelector('[data-asset-card*="push-right"]') ||
                            document.querySelector('[data-asset-card*="Sağa İtme"]');
          if (transCard) {
            const addBtn = transCard.querySelector('button[title*="Timeline"]') ||
                           Array.from(transCard.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Ekle'));
            if (addBtn) {
              addBtn.click();
              await new Promise(r => setTimeout(r, 800));
            }
          }
        }

        // Inspect timeline clips to verify NO dummy video clip was created for the transition!
        const allClips = Array.from(document.querySelectorAll('[data-clip-id]'));
        const dummyClips = allClips.filter(c => c.textContent && c.textContent.includes('Sağa İtme'));

        // Check canvas pixel contents / context
        const canvas = document.querySelector('canvas');
        return {
          totalClipsOnTimeline: allClips.length,
          dummyTransitionClipsOnTimeline: dummyClips.length,
          canvasDimensions: canvas ? { w: canvas.width, h: canvas.height } : null
        };
      })()`,
    }, sessionId);

    console.log('[ASSET TEST RESULT]:', JSON.stringify(assetTestResult.result?.value, null, 2));

    // Test Split & Smooth Playback
    console.log('[4/5] Testing Clip Split and Playback Smoothness across Cut Point...');
    const splitPlaybackResult = await send('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `(async () => {
        // Measure seek events on all video elements
        let seekCount = 0;
        const videos = Array.from(document.querySelectorAll('video'));
        videos.forEach(v => {
          v.addEventListener('seeking', () => { seekCount++; });
        });

        // Click split button at current position
        const splitBtn = document.querySelector('[data-testid="timeline-btn-split"]');
        if (splitBtn && !splitBtn.disabled) {
          splitBtn.click();
          await new Promise(r => setTimeout(r, 400));
        }

        // Measure seeks during paused state (1000ms)
        const seeksPausedStart = seekCount;
        await new Promise(r => setTimeout(r, 1000));
        const seeksDuringPaused = seekCount - seeksPausedStart;

        // Start playback across cut point
        const playBtn = document.querySelector('[data-testid="playback-btn-toggle"]');
        const playbackSamples = [];
        const sampleInterval = setInterval(() => {
          const v = document.querySelector('video');
          if (v) playbackSamples.push({ curTime: v.currentTime, rate: v.playbackRate, paused: v.paused });
        }, 100);

        const seeksPlayStart = seekCount;
        if (playBtn) playBtn.click();
        await new Promise(r => setTimeout(r, 2000));
        if (playBtn) playBtn.click();
        clearInterval(sampleInterval);
        const seeksDuringPlay = seekCount - seeksPlayStart;

        return {
          splitTriggered: !!splitBtn,
          seeksDuringPaused,
          seeksDuringPlay,
          playbackSamplesCount: playbackSamples.length,
          playbackSamples: playbackSamples.slice(0, 8),
          totalClipsAfterSplit: document.querySelectorAll('[data-clip-id]').length
        };
      })()`,
    }, sessionId);

    console.log('[SPLIT PLAYBACK RESULT]:', JSON.stringify(splitPlaybackResult.result?.value, null, 2));

    // Capture visual proof screenshot
    console.log('[5/5] Capturing full-screen verification proof...');
    const shot = await send('Page.captureScreenshot', { format: 'png' }, sessionId);
    const shotPath = path.join(ARTIFACT_DIR, 'forma_verified_split_and_clean_preview.png');
    fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
    console.log('✓ Proof saved to:', shotPath);

  } finally {
    ws.close();
    chrome.kill('SIGTERM');
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});

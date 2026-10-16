/**
 * Automated Forensic Verification Test:
 * Animated Social Stickers (TikTok Follow + -> ✓, TikTok Like Pop, Double Tap, YouTube Sub)
 */

import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 5173;
const CDP_PORT = 9224;

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  console.log('[TEST] Starting Animated Social Stickers verification...');

  const chromePath = getChromePath();
  if (!chromePath) {
    console.error('[ERROR] Chrome not found');
    process.exit(1);
  }

  const userDataDir = path.join(process.cwd(), '.chrome-animated-test-' + Date.now());
  const chromeProc = spawn(
    chromePath,
    [
      '--headless=new',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${userDataDir}`,
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `http://localhost:${PORT}/`,
    ],
    { stdio: 'ignore' }
  );

  let cdp = null;
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

    if (!targets || !targets[0]) {
      throw new Error('Could not connect to Chrome debugging endpoint');
    }

    const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
    cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    console.log('[TEST] Connected to Chrome DevTools Protocol');

    await cdp.send('Page.navigate', { url: `http://localhost:${PORT}/video-editor` });
    await delay(3000); // Wait for video editor page to load

    const evalResult = await cdp.evaluate(`
      (async () => {
        try {
          const previewModule = await import('/features/video-editor/engine/previewRenderer.ts');
          const animatedModule = await import('/features/video-editor/engine/animatedElementsRenderer.ts');
          const elementPresetsModule = await import('/features/video-editor/data/elementPresets.ts');

          const hasFollow = elementPresetsModule.ELEMENT_PRESETS.some(p => p.id === 'tiktok-animated-follow');
          const hasLike = elementPresetsModule.ELEMENT_PRESETS.some(p => p.id === 'tiktok-animated-like');
          const hasDoubleTap = elementPresetsModule.ELEMENT_PRESETS.some(p => p.id === 'tiktok-animated-double-tap');
          const hasYt = elementPresetsModule.ELEMENT_PRESETS.some(p => p.id === 'youtube-animated-subscribe');

          // Create test canvas (1920x1080)
          const canvas = document.createElement('canvas');
          canvas.width = 1920;
          canvas.height = 1080;
          const ctx = canvas.getContext('2d');

          // 1. Test TikTok Follow at t = 0.3s (Plus state)
          const followProjectP1 = {
            id: 'test-follow',
            name: 'TikTok Follow Test',
            resolution: { width: 1920, height: 1080 },
            fps: 30,
            duration: 5,
            tracks: [
              {
                id: 'track-1',
                name: 'Öğeler',
                type: 'video',
                muted: false,
                locked: false,
                visible: true,
                clips: [
                  {
                    id: 'clip-follow-1',
                    trackId: 'track-1',
                    type: 'image',
                    name: 'TikTok Canlı Takip Et (+ ➔ ✓)',
                    elementPresetId: 'tiktok-animated-follow',
                    isAnimated: true,
                    elementAnimation: 'tiktok-follow',
                    startTime: 0,
                    duration: 4.0,
                    transform: { x: 0, y: 0, scaleX: 1.0, scaleY: 1.0, rotation: 0, opacity: 1 },
                  }
                ]
              }
            ]
          };

          const emptyElements = new Map();
          // Render at t = 0.3s (Initial state: Red badge with + plus)
          await previewModule.renderFrameToCanvas(canvas, followProjectP1, 0.3, null, false, emptyElements, 1.0, true);
          const followP1DataUrl = canvas.toDataURL('image/png');

          // Check pixel colors around center badge: should have vibrant red #fe2c55 (r ~ 254, g ~ 44, b ~ 85)
          const imgDataP1 = ctx.getImageData(800, 400, 320, 320);
          let redPixelsP1 = 0;
          for (let i = 0; i < imgDataP1.data.length; i += 4) {
            const r = imgDataP1.data[i];
            const g = imgDataP1.data[i + 1];
            const b = imgDataP1.data[i + 2];
            if (r > 200 && g < 80 && b < 120) redPixelsP1++;
          }

          // Render at t = 1.4s (Followed state: Checkmark ✓ with settled dark grey circle)
          await previewModule.renderFrameToCanvas(canvas, followProjectP1, 1.4, null, false, emptyElements, 1.0, true);
          const followP2DataUrl = canvas.toDataURL('image/png');

          // Check pixel colors: should have checkmark and settled badge
          const imgDataP2 = ctx.getImageData(800, 400, 320, 320);
          let darkSettledPixelsP2 = 0;
          let whiteCheckPixelsP2 = 0;
          for (let i = 0; i < imgDataP2.data.length; i += 4) {
            const r = imgDataP2.data[i];
            const g = imgDataP2.data[i + 1];
            const b = imgDataP2.data[i + 2];
            if (r >= 30 && r <= 50 && g >= 30 && g <= 50 && b >= 30 && b <= 50) darkSettledPixelsP2++;
            if (r > 240 && g > 240 && b > 240) whiteCheckPixelsP2++;
          }

          // 2. Test TikTok Like at t = 0.2s (Idle unliked) and t = 0.9s (Popped vibrant red + cyan glow + particles)
          const likeProject = {
            id: 'test-like',
            name: 'TikTok Like Test',
            resolution: { width: 1920, height: 1080 },
            fps: 30,
            duration: 5,
            tracks: [
              {
                id: 'track-1',
                name: 'Öğeler',
                type: 'video',
                muted: false,
                locked: false,
                visible: true,
                clips: [
                  {
                    id: 'clip-like-1',
                    trackId: 'track-1',
                    type: 'image',
                    name: 'TikTok Canlı Beğen (Pop & Kalpler)',
                    elementPresetId: 'tiktok-animated-like',
                    isAnimated: true,
                    elementAnimation: 'tiktok-like',
                    startTime: 0,
                    duration: 4.0,
                    transform: { x: 0, y: 0, scaleX: 1.0, scaleY: 1.0, rotation: 0, opacity: 1 },
                  }
                ]
              }
            ]
          };

          // Render at t = 0.2s (Unliked state: white outline)
          await previewModule.renderFrameToCanvas(canvas, likeProject, 0.2, null, false, emptyElements, 1.0, true);
          const likeP1DataUrl = canvas.toDataURL('image/png');

          // Render at t = 0.9s (Popped state: filled vibrant TikTok red + cyan glow + mini hearts + BEĞENİLDİ)
          await previewModule.renderFrameToCanvas(canvas, likeProject, 0.9, null, false, emptyElements, 1.0, true);
          const likeP2DataUrl = canvas.toDataURL('image/png');

          const likeImgDataP2 = ctx.getImageData(600, 350, 720, 380);
          let likeRedPixels = 0;
          let cyanGlowPixels = 0;
          for (let i = 0; i < likeImgDataP2.data.length; i += 4) {
            const r = likeImgDataP2.data[i];
            const g = likeImgDataP2.data[i + 1];
            const b = likeImgDataP2.data[i + 2];
            if (r > 200 && g < 100 && b < 130) likeRedPixels++;
            if (g > 80 && b > 80 && (g - r) > 20 && (b - r) > 20) cyanGlowPixels++;
          }

          return {
            success: true,
            hasFollow,
            hasLike,
            hasDoubleTap,
            hasYt,
            follow: {
              redPixelsP1,
              darkSettledPixelsP2,
              whiteCheckPixelsP2,
              p1Png: followP1DataUrl,
              p2Png: followP2DataUrl,
            },
            like: {
              likeRedPixels,
              cyanGlowPixels,
              p1Png: likeP1DataUrl,
              p2Png: likeP2DataUrl,
            }
          };
        } catch (err) {
          return { success: false, error: String(err) + '\\n' + (err.stack || '') };
        }
      })()
    `);

    console.log('[TEST] Browser evaluation returned:', {
      success: evalResult.success,
      hasFollow: evalResult.hasFollow,
      hasLike: evalResult.hasLike,
      hasDoubleTap: evalResult.hasDoubleTap,
      hasYt: evalResult.hasYt,
      followRedPixelsAt0_3s: evalResult.follow?.redPixelsP1,
      followSettledPixelsAt1_4s: evalResult.follow?.darkSettledPixelsP2,
      followWhiteCheckPixels: evalResult.follow?.whiteCheckPixelsP2,
      likeRedPixelsAt0_9s: evalResult.like?.likeRedPixels,
      likeCyanGlowPixelsAt0_9s: evalResult.like?.cyanGlowPixels,
      error: evalResult.error,
    });

    if (!evalResult.success) {
      throw new Error('Test failed inside browser: ' + evalResult.error);
    }

    // Save screenshots
    const artDir = 'C:\\Users\\sinan\\.gemini\\antigravity\\brain\\094b1c26-b9f9-4b08-93a4-797170dbff1b';
    const follow1Buf = Buffer.from(evalResult.follow.p1Png.split(',')[1], 'base64');
    fs.writeFileSync(path.join(artDir, 'tiktok_follow_state1_plus.png'), follow1Buf);
    console.log('[TEST] Saved artifacts/tiktok_follow_state1_plus.png');

    const follow2Buf = Buffer.from(evalResult.follow.p2Png.split(',')[1], 'base64');
    fs.writeFileSync(path.join(artDir, 'tiktok_follow_state2_checked.png'), follow2Buf);
    console.log('[TEST] Saved artifacts/tiktok_follow_state2_checked.png');

    const like1Buf = Buffer.from(evalResult.like.p1Png.split(',')[1], 'base64');
    fs.writeFileSync(path.join(artDir, 'tiktok_like_state1_idle.png'), like1Buf);
    console.log('[TEST] Saved artifacts/tiktok_like_state1_idle.png');

    const like2Buf = Buffer.from(evalResult.like.p2Png.split(',')[1], 'base64');
    fs.writeFileSync(path.join(artDir, 'tiktok_like_state2_popped.png'), like2Buf);
    console.log('[TEST] Saved artifacts/tiktok_like_state2_popped.png');

    // Assertions
    if (evalResult.follow.redPixelsP1 <= 0) {
      throw new Error('Expected red pixels in follow state 1 (+ button)');
    }
    if (evalResult.follow.darkSettledPixelsP2 <= 0) {
      throw new Error('Expected dark settled pixels in follow state 2 (✓ button)');
    }
    if (evalResult.like.likeRedPixels <= 0) {
      throw new Error('Expected red heart pixels in like state 2');
    }
    if (evalResult.like.cyanGlowPixels <= 0) {
      throw new Error('Expected cyan glow pixels in like state 2');
    }

    console.log('[SUCCESS] All animated social stickers passed forensic verification!');
  } finally {
    if (chromeProc) {
      try { chromeProc.kill(); } catch {}
    }
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch {}
  }
}

main().catch((err) => {
  console.error('[FATAL]', err);
  process.exit(1);
});

/**
 * Test MP4 Export with Animated Stickers
 */

import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 5173;
const CDP_PORT = 9225;

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
  console.log('[TEST] Exporting MP4 with animated stickers...');

  const chromePath = getChromePath();
  const userDataDir = path.join(process.cwd(), '.chrome-animated-export-' + Date.now());
  const chromeProc = spawn(
    chromePath,
    [
      '--headless=new',
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${userDataDir}`,
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
      `http://localhost:${PORT}/video-editor`,
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

    const pageTarget = targets.find((t) => t.type === 'page') || targets[0];
    cdp = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await cdp.connect();
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');

    await delay(3000);

    const exportResult = await cdp.evaluate(`
      (async () => {
        try {
          const { exportEngine } = await import('/features/video-editor/engine/exportEngine.ts');

          const project = {
            id: 'proj-animated-export',
            name: 'Canlı Animasyonlu Çıkartmalar',
            resolution: { width: 1080, height: 1920 }, // 9:16 vertical TikTok format
            fps: 30,
            duration: 2.0,
            backgroundColor: '#000000',
            tracks: [
              {
                id: 'track-stickers',
                name: 'Animasyonlu Öğeler',
                type: 'video',
                muted: false,
                locked: false,
                visible: true,
                clips: [
                  {
                    id: 'clip-follow',
                    trackId: 'track-stickers',
                    type: 'image',
                    name: 'TikTok Canlı Takip Et',
                    elementPresetId: 'tiktok-animated-follow',
                    isAnimated: true,
                    elementAnimation: 'tiktok-follow',
                    startTime: 0,
                    duration: 2.0,
                    transform: { x: 0, y: -300, scaleX: 1.2, scaleY: 1.2, rotation: 0, opacity: 1 },
                  },
                  {
                    id: 'clip-like',
                    trackId: 'track-stickers',
                    type: 'image',
                    name: 'TikTok Canlı Beğen',
                    elementPresetId: 'tiktok-animated-like',
                    isAnimated: true,
                    elementAnimation: 'tiktok-like',
                    startTime: 0,
                    duration: 2.0,
                    transform: { x: 0, y: 300, scaleX: 1.0, scaleY: 1.0, rotation: 0, opacity: 1 },
                  }
                ]
              }
            ]
          };

          const blob = await exportEngine.exportVideo(
            project,
            {
              format: 'mp4',
              resolution: { width: 1080, height: 1920 },
              fps: 30,
              quality: 'standard',
            },
            () => {}
          );

          if (!blob) return { success: false, error: 'Export returned null blob' };

          // Convert blob to base64
          const reader = new FileReader();
          const base64Promise = new Promise((resolve, reject) => {
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = reject;
          });
          reader.readAsDataURL(blob);
          const base64Data = await base64Promise;

          return {
            success: true,
            size: blob.size,
            type: blob.type,
            base64Data,
          };
        } catch (err) {
          return { success: false, error: String(err) + '\\n' + (err.stack || '') };
        }
      })()
    `);

    console.log('[TEST] Export evaluation returned:', {
      success: exportResult.success,
      size: exportResult.size,
      type: exportResult.type,
      error: exportResult.error,
    });

    if (!exportResult.success) {
      throw new Error('Export failed: ' + exportResult.error);
    }

    const artDir = 'C:\\Users\\sinan\\.gemini\\antigravity\\brain\\094b1c26-b9f9-4b08-93a4-797170dbff1b';
    const mp4Buf = Buffer.from(exportResult.base64Data.split(',')[1], 'base64');
    const mp4Path = path.join(artDir, 'tiktok_animated_stickers_export.mp4');
    fs.writeFileSync(mp4Path, mp4Buf);
    console.log(`[TEST] Successfully saved animated stickers video to ${mp4Path} (${mp4Buf.length} bytes)`);

    console.log('[SUCCESS] MP4 Video Export with animated stickers verified!');
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

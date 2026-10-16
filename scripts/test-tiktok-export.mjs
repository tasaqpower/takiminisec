import { spawn } from 'child_process';
import http from 'http';
import fs from 'fs';
import path from 'path';

const PORT = 5173;
const CDP_PORT = 9222;

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

class SimpleCDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.id = 1;
    this.pending = new Map();
  }

  async connect() {
    const { WebSocket } = await import('ws');
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

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval failed: ${res.exceptionDetails.text} (${JSON.stringify(res.exceptionDetails.exception)})`);
    }
    return res.result?.value;
  }

  close() {
    try {
      this.ws?.close();
    } catch {}
  }
}

function getChromePath() {
  const candidates = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    process.env.LOCALAPPDATA + '\\Google\\Chrome\\Application\\chrome.exe',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  throw new Error('Chrome executable not found on host');
}

async function main() {
  console.log('Testing export of project containing TikTok Like element...');

  const chromePath = getChromePath();
  const tempProfile = path.join(process.cwd(), '.temp-chrome-tiktok-export-test');
  fs.mkdirSync(tempProfile, { recursive: true });

  const chromeProc = spawn(
    chromePath,
    [
      `--remote-debugging-port=${CDP_PORT}`,
      `--user-data-dir=${tempProfile}`,
      '--no-first-run',
      '--no-default-browser-check',
      '--headless=new',
      'about:blank',
    ],
    { stdio: 'ignore' }
  );

  await delay(1500);

  const targets = await new Promise((resolve, reject) => {
    http.get(`http://127.0.0.1:${CDP_PORT}/json`, (res) => {
      let body = '';
      res.on('data', (c) => (body += c));
      res.on('end', () => resolve(JSON.parse(body)));
    }).on('error', reject);
  });

  const pageTarget = targets.find((t) => t.type === 'page');
  if (!pageTarget) throw new Error('No page target found');

  const cdp = new SimpleCDP(pageTarget.webSocketDebuggerUrl);
  await cdp.connect();
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  await cdp.send('Page.navigate', { url: `http://localhost:${PORT}/video-editor` });
  await delay(3000);

  const exportResult = await cdp.eval(`
    (async () => {
      try {
        const { exportEngine } = await import('/features/video-editor/engine/exportEngine.ts');
        const { getElementSvg, createSvgDataUrl } = await import('/features/video-editor/data/elementPresets.ts');

        const testProj = {
          id: 'proj-export-tiktok',
          name: 'TikTok Export Test',
          resolution: { width: 720, height: 1280 },
          fps: 30,
          duration: 1.0,
          backgroundColor: '#000000',
          tracks: [
            {
              id: 'track-bg',
              name: 'Arka Plan',
              type: 'video',
              muted: false,
              locked: false,
              visible: true,
              clips: [
                {
                  id: 'c-bg',
                  trackId: 'track-bg',
                  type: 'video',
                  name: 'BG',
                  startTime: 0,
                  duration: 1.0,
                  trimIn: 0,
                  trimOut: 1.0,
                }
              ]
            },
            {
              id: 'track-tt',
              name: 'TikTok Öğe',
              type: 'image',
              muted: false,
              locked: false,
              visible: true,
              clips: [
                {
                  id: 'c-tt',
                  trackId: 'track-tt',
                  type: 'image',
                  name: 'TikTok Beğen',
                  startTime: 0,
                  duration: 1.0,
                  trimIn: 0,
                  trimOut: 1.0,
                  fitMode: 'fit',
                  transform: {
                    x: 0,
                    y: 0,
                    scaleX: 0.6,
                    scaleY: 0.6,
                    rotation: 0,
                    opacity: 1,
                  }
                }
              ]
            }
          ]
        };

        let progressUpdates = 0;
        const blob = await exportEngine.exportProject(testProj, {
          format: 'mp4',
          quality: 'medium',
          resolution: { width: 720, height: 1280 },
          fps: 30,
        }, 0, (prog) => {
          progressUpdates++;
        });

        if (!blob) return { error: 'Export returned null' };

        // Convert blob to base64
        const reader = new FileReader();
        const base64Promise = new Promise((resolve) => {
          reader.onloadend = () => resolve(reader.result.split(',')[1]);
        });
        reader.readAsDataURL(blob);
        const b64 = await base64Promise;

        return {
          size: blob.size,
          type: blob.type,
          base64: b64,
          progressUpdates,
        };
      } catch (err) {
        return { error: err.message, stack: err.stack };
      }
    })()
  `);

  if (exportResult.error) {
    console.error('Export error:', exportResult.error, exportResult.stack);
  } else {
    console.log('✓ Export SUCCESSFUL!');
    console.log(`  - File Size: ${exportResult.size} bytes (${(exportResult.size / 1024).toFixed(1)} KB)`);
    console.log(`  - MIME Type: ${exportResult.type}`);
    const outPath = path.join(process.cwd(), 'artifacts', 'tiktok_like_test_export.mp4');
    fs.writeFileSync(outPath, Buffer.from(exportResult.base64, 'base64'));
    console.log('✓ Saved exported MP4 to:', outPath);
  }

  cdp.close();
  try { chromeProc?.kill(); } catch {}
}

main().catch(console.error);

/**
 * FORMA V7.3 — 64 REAL CDP MOUSE DRAG TEST SUITE
 * 
 * Matrix:
 *   4 Zooms:     50% (0.5), 100% (1.0), 150% (1.5), 200% (2.0)
 *   4 Rotations: 0°, 90°, 180°, 270°
 *   4 Handles:   nw, ne, se, sw
 *   Total:       64 separate real CDP mouse drag operations.
 * 
 * Invariants & Assertions for each combination:
 *   1. Reset object to known position (x=200, y=200, w=160, h=80, AR=2.0).
 *   2. Find real DOM handle center coordinate. Fail if handle not found.
 *   3. Measure handle center vs calculated corner difference.
 *   4. Dispatch real CDP mouse drag (mousePressed -> 5 mouseMoved steps -> mouseReleased).
 *   5. Verify opposite corner invariance: drift <= 1.0 PDF unit.
 *   6. Verify aspect ratio preservation in aspect-locked mark: |AR_after - 2.0| <= 0.05.
 *   7. Verify mark was actually resized (w_after !== w_before || h_after !== h_before).
 *   8. Log complete metrics synchronously to log file and collect in JSON summary.
 */

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import WebSocket from 'ws';
import {
  getProjectRoot,
  findNodeBinary,
  findChromeBinary,
  getTempDir
} from './portable-paths.mjs';

const projectRoot = getProjectRoot();
const outputsDir = path.join(projectRoot, 'outputs', 'v73-evidence');
const logsDir = path.join(outputsDir, 'logs');
const testResultsDir = path.join(outputsDir, 'test-results');

for (const d of [outputsDir, logsDir, testResultsDir]) {
  if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
}

const logFilePath = path.join(logsDir, 'test-64-drags.log');
fs.writeFileSync(logFilePath, '', 'utf8');

function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(msg);
  fs.appendFileSync(logFilePath, line + '\n', 'utf8');
}

class CDPClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.callbacks = new Map();
    this.logs = [];

    this.ws.on('message', (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id && this.callbacks.has(msg.id)) {
        const { resolve, reject } = this.callbacks.get(msg.id);
        this.callbacks.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      }
    });
  }

  send(method, params = {}, timeoutMs = 25000) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      const timer = setTimeout(() => {
        if (this.callbacks.has(id)) {
          this.callbacks.delete(id);
          reject(new Error(`CDP command ${method} timed out after ${timeoutMs}ms`));
        }
      }, timeoutMs);
      this.callbacks.set(id, {
        resolve: (val) => { clearTimeout(timer); resolve(val); },
        reject: (err) => { clearTimeout(timer); reject(err); }
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true
    });
    if (res?.exceptionDetails) {
      throw new Error(`Eval error: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res?.result?.value;
  }

  async mouseDrag(x1, y1, x2, y2, steps = 5) {
    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseMoved',
      x: x1,
      y: y1
    });
    await new Promise((r) => setTimeout(r, 20));

    await this.send('Input.dispatchMouseEvent', {
      type: 'mousePressed',
      x: x1,
      y: y1,
      button: 'left',
      clickCount: 1
    });
    await new Promise((r) => setTimeout(r, 30));

    for (let i = 1; i <= steps; i++) {
      const curX = x1 + ((x2 - x1) * i) / steps;
      const curY = y1 + ((y2 - y1) * i) / steps;
      await this.send('Input.dispatchMouseEvent', {
        type: 'mouseMoved',
        x: curX,
        y: curY,
        button: 'left'
      });
      await new Promise((r) => setTimeout(r, 25));
    }

    await this.send('Input.dispatchMouseEvent', {
      type: 'mouseReleased',
      x: x2,
      y: y2,
      button: 'left',
      clickCount: 1
    });
    await new Promise((r) => setTimeout(r, 40));
  }
}

function baseToScreenDelta(dpx, dpy, rotation, zoom) {
  const normRot = ((rotation % 360) + 360) % 360;
  let sx = 0, sy = 0;
  if (normRot === 0) {
    sx = dpx * zoom;
    sy = dpy * zoom;
  } else if (normRot === 90) {
    sx = -dpy * zoom;
    sy = dpx * zoom;
  } else if (normRot === 180) {
    sx = -dpx * zoom;
    sy = -dpy * zoom;
  } else if (normRot === 270) {
    sx = dpy * zoom;
    sy = -dpx * zoom;
  }
  return { sx, sy };
}

async function run64DragSuite() {
  const startTime = new Date().toISOString();
  log('================================================================');
  log('  FORMA V7.3: 64 REAL CDP MOUSE DRAG VERIFICATION SUITE');
  log('  4 Zooms × 4 Rotations × 4 Handles (64 Combinations)');
  log('================================================================');

  let devServerProc = null;
  let chromeProc = null;
  let ws = null;

  try {
    // 1. Verify dev server active
    let devServerReady = false;
    for (let i = 0; i < 5; i++) {
      try {
        const res = await fetch('http://localhost:5173/');
        if (res.ok) { devServerReady = true; break; }
      } catch {}
      await new Promise(r => setTimeout(r, 300));
    }

    if (!devServerReady) {
      log('Starting dev server on port 5173...');
      const nodeBin = findNodeBinary();
      devServerProc = spawn(nodeBin, ['scripts/run-framework.mjs', 'dev'], {
        cwd: projectRoot,
        env: { ...process.env, NEXT_PUBLIC_ENABLE_TEST_API: 'true' },
        stdio: 'ignore',
        detached: true
      });
      devServerProc.unref();

      for (let i = 0; i < 30; i++) {
        try {
          const res = await fetch('http://localhost:5173/');
          if (res.ok) { devServerReady = true; break; }
        } catch {}
        await new Promise(r => setTimeout(r, 500));
      }
    }
    assert.ok(devServerReady, 'Dev server ready on http://localhost:5173/');
    log('✓ Dev server active on http://localhost:5173/');

    // 2. Launch Chrome CDP
    const cdpPort = 9231;
    const tempDir = path.join(getTempDir(), `forma_drag64_${Date.now()}`);
    const profileDir = path.join(tempDir, 'profile');
    fs.mkdirSync(profileDir, { recursive: true });

    const chromeBin = findChromeBinary();
    log(`Launching headless Chrome from ${chromeBin} on port ${cdpPort}...`);
    chromeProc = spawn(
      chromeBin,
      [
        `--remote-debugging-port=${cdpPort}`,
        '--headless=new',
        `--user-data-dir=${profileDir}`,
        '--disable-gpu',
        '--no-first-run',
        '--no-default-browser-check',
        '--window-size=2560,1600'
      ],
      { detached: true, stdio: 'ignore' }
    );
    chromeProc.unref();

    let chromeReady = false;
    for (let i = 0; i < 30; i++) {
      try {
        const res = await fetch(`http://127.0.0.1:${cdpPort}/json/version`);
        if (res.ok) { chromeReady = true; break; }
      } catch {}
      await new Promise(r => setTimeout(r, 300));
    }
    assert.ok(chromeReady, `Chrome CDP ready on port ${cdpPort}`);

    const newTargetRes = await fetch(`http://127.0.0.1:${cdpPort}/json/new`, { method: 'PUT' });
    const target = await newTargetRes.json();
    ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
    });

    const cdp = new CDPClient(ws);
    await cdp.send('Runtime.enable');
    await cdp.send('Page.enable');
    await cdp.send('DOM.enable');
    await cdp.send('Emulation.setDeviceMetricsOverride', {
      width: 2560,
      height: 2000,
      deviceScaleFactor: 1,
      mobile: false
    });

    log('Navigating to editor at http://localhost:5173/...');
    await cdp.send('Page.navigate', { url: 'http://localhost:5173/' });
    await new Promise(r => setTimeout(r, 2000));

    // Upload a basic PDF to initialize editor workspace
    const dummyPdfBase64 = 'JVBERi0xLjQKJeLjz9MKMSAwIG9iago8PAovVHlwZSAvQ2F0YWxvZwovUGFnZXMgMiAwIFIKPj4KZW5kb2JqCjIgMCBvYmoKPDwKL1R5cGUgL1BhZ2VzCi9LaWRzIFszIDAgUl0KL0NvdW50IDEKPj4KZW5kb2JqCjMgMCBvYmoKPDwKL1R5cGUgL1BhZ2UKL1BhcmVudCAyIDAgUgovTWVkaWFCb3ggWzAgMCA2MDAgODAwXQo+PgplbmRvYmoKeHJlZgowIDQKMDAwMDAwMDAwMCA2NTUzNSBmIAowMDAwMDAwMDE4IDAwMDAwIG4gCjAwMDAwMDAwNjggMDAwMDAgbiAKMDAwMDAwMDEyNSAwMDAwMCBuIAp0cmFpbGVyCjw8Ci9TaXplIDQKL1Jvb3QgMSAwIFIKPj4Kc3RhcnR4cmVmCjE5NQolJUVPRg==';
    await cdp.evaluate(`
      (() => {
        const binaryString = atob("${dummyPdfBase64}");
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const file = new File([bytes], "test-drag64.pdf", { type: "application/pdf" });
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        const input = document.querySelector('input[type="file"]');
        if (input) {
          input.files = dataTransfer.files;
          input.dispatchEvent(new Event('change', { bubbles: true }));
        }
      })()
    `);

    // Wait for workspace ready
    let workspaceReady = false;
    for (let i = 0; i < 40; i++) {
      const isReady = await cdp.evaluate(`
        (() => {
          if (!window.__formaTestApi) return false;
          const s = window.__formaTestApi.getState();
          const hasCanvas = document.querySelectorAll('canvas').length >= 1;
          return Boolean(hasCanvas && !s.busy && s.pageCount >= 1);
        })()
      `);
      if (isReady) { workspaceReady = true; break; }
      await new Promise(r => setTimeout(r, 250));
    }
    assert.ok(workspaceReady, 'Workspace ready for drag tests');
    log('✓ Editor workspace ready with rendered canvas.');

    // Matrix definition
    const ZOOMS = [0.5, 1.0, 1.5, 2.0];
    const ROTATIONS = [0, 90, 180, 270];
    const HANDLES = ['nw', 'ne', 'se', 'sw'];

    // Place mark comfortably at page center (600x800 page, center is 300, 400)
    const KNOWN_MARK = {
      id: 'drag-64-test-mark',
      page: 0,
      kind: 'stamp', // aspect-locked item (vector projection + anchor invariance)
      x: 240,
      y: 360,
      w: 120,
      h: 60,
      size: 16,
      color: '#2563eb',
      image: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      stampPreset: 'approved',
      stampCustomText: 'DRAG64'
    };
    const INITIAL_AR = KNOWN_MARK.w / KNOWN_MARK.h; // 2.0

    const results = [];
    let passedCount = 0;
    let failedCount = 0;
    let totalCombinations = 0;

    log('\n--- Commencing 64 Distinct Real CDP Mouse Drag Tests ---\n');

    for (const zoom of ZOOMS) {
      for (const rot of ROTATIONS) {
        for (const handle of HANDLES) {
          totalCombinations++;
          const comboId = `DRAG-${totalCombinations.toString().padStart(2, '0')}`;
          const comboLabel = `[${comboId}] Zoom: ${(zoom * 100).toFixed(0)}% | Rot: ${rot}° | Handle: ${handle.toUpperCase()}`;

          // Step 1: Set zoom and rotation in editor state
          await cdp.evaluate(`
            (() => {
              window.__formaTestApi.setZoom(${zoom});
              const curRot = window.__formaTestApi.getState().pages[0]?.rotation || 0;
              const diff = (${rot} - curRot + 360) % 360;
              if (diff !== 0) {
                window.__formaTestApi.rotatePage(diff);
              }
            })()
          `);

          // Wait for render / busy state to settle
          for (let i = 0; i < 30; i++) {
            const isBusy = await cdp.evaluate(`Boolean(window.__formaTestApi.getState().busy)`);
            if (!isBusy) break;
            await new Promise(r => setTimeout(r, 50));
          }
          await new Promise(r => setTimeout(r, 100));

          // Step 2: Reset object to known position
          await cdp.evaluate(`
            (() => {
              window.__formaTestApi.setMarks([${JSON.stringify(KNOWN_MARK)}]);
              window.__formaTestApi.setSelected("drag-64-test-mark");
              window.__formaTestApi.setTool("select");
            })()
          `);
          await new Promise(r => setTimeout(r, 150));

          // Step 3: Find real DOM handle center and scroll into view
          const domHandle = await cdp.evaluate(`
            (() => {
              const hit = document.querySelector('.resize-handle-hit.${handle}');
              if (!hit) return null;
              hit.scrollIntoView({ block: 'center', inline: 'center' });
              const rect = hit.getBoundingClientRect();
              const surface = document.querySelector('.pdf-surface');
              const sRect = surface ? surface.getBoundingClientRect() : null;
              return {
                found: true,
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
                rectWidth: rect.width,
                rectHeight: rect.height,
                surfaceRect: sRect ? { left: sRect.left, top: sRect.top, width: sRect.width, height: sRect.height } : null
              };
            })()
          `);

          if (!domHandle || !domHandle.found) {
            log(`  ✗ ${comboLabel} -> FAIL: Real DOM handle .resize-handle-hit.${handle} not found!`);
            failedCount++;
            results.push({
              id: comboId,
              zoom,
              rotation: rot,
              handle,
              passed: false,
              error: 'DOM handle not found'
            });
            continue;
          }

          // Step 4: Measure handle center vs calculated corner difference
          const sBox = domHandle.surfaceRect || { left: 0, top: 0 };
          const baseW = 600;
          const baseH = 800;

          // Corner in base PDF coords before drag
          let cornerBaseX = 0, cornerBaseY = 0;
          if (handle === 'nw') { cornerBaseX = KNOWN_MARK.x; cornerBaseY = KNOWN_MARK.y; }
          else if (handle === 'ne') { cornerBaseX = KNOWN_MARK.x + KNOWN_MARK.w; cornerBaseY = KNOWN_MARK.y; }
          else if (handle === 'se') { cornerBaseX = KNOWN_MARK.x + KNOWN_MARK.w; cornerBaseY = KNOWN_MARK.y + KNOWN_MARK.h; }
          else if (handle === 'sw') { cornerBaseX = KNOWN_MARK.x; cornerBaseY = KNOWN_MARK.y + KNOWN_MARK.h; }

          // Transform cornerBase to view space based on rotation
          let viewX = 0, viewY = 0;
          if (rot === 0) {
            viewX = cornerBaseX; viewY = cornerBaseY;
          } else if (rot === 90) {
            viewX = baseH - cornerBaseY; viewY = cornerBaseX;
          } else if (rot === 180) {
            viewX = baseW - cornerBaseX; viewY = baseH - cornerBaseY;
          } else if (rot === 270) {
            viewX = cornerBaseY; viewY = baseW - cornerBaseX;
          }

          const calcScreenX = sBox.left + viewX * zoom;
          const calcScreenY = sBox.top + viewY * zoom;
          const handleDiff = Math.hypot(domHandle.x - calcScreenX, domHandle.y - calcScreenY);

          // Step 5: Calculate drag displacement in screen coordinates
          // Scale displacement so that mouse moves by at least 25 screen pixels regardless of zoom
          const baseStep = Math.max(15, Math.round(25 / zoom));
          let dpx = 0, dpy = 0;
          if (handle === 'se') { dpx = baseStep; dpy = baseStep; }
          else if (handle === 'nw') { dpx = -baseStep; dpy = -baseStep; }
          else if (handle === 'ne') { dpx = baseStep; dpy = -baseStep; }
          else if (handle === 'sw') { dpx = -baseStep; dpy = baseStep; }

          const { sx: screenDx, sy: screenDy } = baseToScreenDelta(dpx, dpy, rot, zoom);

          // Step 6: Perform real CDP mouse drag on DOM handle
          const startMouseX = domHandle.x;
          const startMouseY = domHandle.y;
          const targetMouseX = domHandle.x + screenDx;
          const targetMouseY = domHandle.y + screenDy;

          await cdp.mouseDrag(startMouseX, startMouseY, targetMouseX, targetMouseY, 6);
          await new Promise(r => setTimeout(r, 200));


          // Step 7: Read state after drag
          const afterMark = await cdp.evaluate(`
            (() => {
              const m = window.__formaTestApi.getState().marks.find(item => item.id === 'drag-64-test-mark');
              return m ? { x: m.x, y: m.y, w: m.w, h: m.h } : null;
            })()
          `);

          if (!afterMark) {
            log(`  ✗ ${comboLabel} -> FAIL: Mark missing after drag!`);
            failedCount++;
            results.push({
              id: comboId,
              zoom,
              rotation: rot,
              handle,
              passed: false,
              error: 'Mark missing after drag'
            });
            continue;
          }

          // Step 8: Measure opposite corner drift in base PDF coordinates
          let oppositeDrift = 0;
          let oppositeName = '';
          let expectedAnchor = { x: 0, y: 0 };
          let actualAnchor = { x: 0, y: 0 };

          if (handle === 'se') {
            oppositeName = 'NW (top-left)';
            expectedAnchor = { x: KNOWN_MARK.x, y: KNOWN_MARK.y }; // (200, 200)
            actualAnchor = { x: afterMark.x, y: afterMark.y };
            oppositeDrift = Math.max(
              Math.abs(afterMark.x - expectedAnchor.x),
              Math.abs(afterMark.y - expectedAnchor.y)
            );
          } else if (handle === 'nw') {
            oppositeName = 'SE (bottom-right)';
            expectedAnchor = { x: KNOWN_MARK.x + KNOWN_MARK.w, y: KNOWN_MARK.y + KNOWN_MARK.h }; // (360, 280)
            actualAnchor = { x: afterMark.x + afterMark.w, y: afterMark.y + afterMark.h };
            oppositeDrift = Math.max(
              Math.abs(actualAnchor.x - expectedAnchor.x),
              Math.abs(actualAnchor.y - expectedAnchor.y)
            );
          } else if (handle === 'ne') {
            oppositeName = 'SW (bottom-left)';
            expectedAnchor = { x: KNOWN_MARK.x, y: KNOWN_MARK.y + KNOWN_MARK.h }; // (200, 280)
            actualAnchor = { x: afterMark.x, y: afterMark.y + afterMark.h };
            oppositeDrift = Math.max(
              Math.abs(actualAnchor.x - expectedAnchor.x),
              Math.abs(actualAnchor.y - expectedAnchor.y)
            );
          } else if (handle === 'sw') {
            oppositeName = 'NE (top-right)';
            expectedAnchor = { x: KNOWN_MARK.x + KNOWN_MARK.w, y: KNOWN_MARK.y }; // (360, 200)
            actualAnchor = { x: afterMark.x + afterMark.w, y: afterMark.y };
            oppositeDrift = Math.max(
              Math.abs(actualAnchor.x - expectedAnchor.x),
              Math.abs(actualAnchor.y - expectedAnchor.y)
            );
          }

          // Step 9: Measure aspect ratio preservation
          const afterAR = afterMark.w / afterMark.h;
          const arDiff = Math.abs(afterAR - INITIAL_AR);
          const didResize = (afterMark.w !== KNOWN_MARK.w || afterMark.h !== KNOWN_MARK.h);

          // Criteria:
          // 1. oppositeDrift <= 1.0 PDF unit
          // 2. didResize === true
          // 3. arDiff <= 0.05
          const pass = (oppositeDrift <= 1.0) && didResize && (arDiff <= 0.05);

          const resultItem = {
            id: comboId,
            zoom: `${(zoom * 100).toFixed(0)}%`,
            zoomVal: zoom,
            rotation: `${rot}°`,
            rotationVal: rot,
            handle,
            passed: pass,
            before: { x: KNOWN_MARK.x, y: KNOWN_MARK.y, w: KNOWN_MARK.w, h: KNOWN_MARK.h },
            after: { x: afterMark.x, y: afterMark.y, w: afterMark.w, h: afterMark.h },
            oppositeName,
            expectedAnchor,
            actualAnchor,
            oppositeCornerDrift: Number(oppositeDrift.toFixed(3)),
            handleDiffFromCalc: Number(handleDiff.toFixed(2)),
            initialAspectRatio: INITIAL_AR,
            finalAspectRatio: Number(afterAR.toFixed(4)),
            aspectRatioDelta: Number(arDiff.toFixed(4)),
            didResize
          };

          results.push(resultItem);

          if (pass) {
            passedCount++;
            log(`  [PASS] ${comboLabel} -> Drift: ${oppositeDrift.toFixed(2)} pt (<=1.0 pt), AR: ${afterAR.toFixed(2)} (Δ=${arDiff.toFixed(3)}), HandleDiff: ${handleDiff.toFixed(1)}px, w=${afterMark.w}, h=${afterMark.h}`);
          } else {
            failedCount++;
            log(`  [FAIL] ${comboLabel} -> Drift: ${oppositeDrift.toFixed(2)} pt, didResize: ${didResize}, AR diff: ${arDiff.toFixed(3)}`);
          }
        }
      }
    }

    log('\n================================================================');
    log(`  64 DRAG SUITE SUMMARY: ${passedCount} / ${totalCombinations} PASSED (${failedCount} FAILURES)`);
    log('================================================================');

    const summaryPayload = {
      suite: '64_REAL_CDP_MOUSE_DRAGS',
      totalCombinations,
      passedCount,
      failedCount,
      startTime,
      endTime: new Date().toISOString(),
      allPassed: (passedCount === 64 && failedCount === 0),
      matrix: {
        zooms: ZOOMS,
        rotations: ROTATIONS,
        handles: HANDLES
      },
      results
    };

    const summaryJsonPath = path.join(testResultsDir, 'v73-drag-64-summary.json');
    fs.writeFileSync(summaryJsonPath, JSON.stringify(summaryPayload, null, 2), 'utf8');
    log(`✓ Summary written to ${summaryJsonPath}`);

    log('\n[EXIT CODE] ' + (failedCount === 0 && passedCount === 64 ? 0 : 1));

    if (failedCount > 0 || passedCount !== 64) {
      throw new Error(`CRITICAL: 64 drag suite failed with ${failedCount} failures (passed: ${passedCount}/64)`);
    }

  } finally {
    if (ws) {
      try { ws.close(); } catch {}
    }
    if (chromeProc && chromeProc.pid) {
      try { process.kill(chromeProc.pid); } catch {}
    }
  }
}

run64DragSuite().catch((err) => {
  log(`CRITICAL SUITE ERROR: ${err.message}`);
  process.exit(1);
});

import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs/promises';

async function main() {
  console.log('[Verify DragDrop & Audio] Starting real Chromium instance...');
  const userDataDir = (process.env.TEMP || 'C:\\Windows\\Temp') + '\\verify_dragdrop_audio_' + Date.now();
  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9225',
    '--no-first-run',
    '--disable-gpu',
    '--autoplay-policy=no-user-gesture-required',
    '--user-data-dir=' + userDataDir,
  ]);

  let versionData = null;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9225/json/version');
      if (res.ok) {
        versionData = await res.json();
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }

  if (!versionData) {
    chromeProc.kill();
    throw new Error('Chrome did not launch on port 9225');
  }

  console.log('[Verify DragDrop & Audio] Opening video editor page...');
  const newTabRes = await fetch('http://127.0.0.1:9225/json/new?http://localhost:5173/video-editor', {
    method: 'PUT',
  });
  const tab = await newTabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.once('open', resolve));

  let msgId = 1;
  const pending = new Map();

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map((a) => a.value || a.description || '').join(' ');
      if (msg.params.type === 'error') console.error('[Browser Error]', text);
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

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1536,
    height: 960,
    deviceScaleFactor: 1,
    mobile: false,
  });

  console.log('[Verify DragDrop & Audio] Waiting for page load...');
  await new Promise((r) => setTimeout(r, 3000));

  // Synthesize two test videos with audible sine wave audio (440 Hz & 880 Hz)
  console.log('[Verify DragDrop & Audio] Synthesizing Video 1 (440Hz, 3s) and Video 2 (880Hz, 3s)...');
  const synthResult = await send('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      const makeVideoBlob = (freq, durationSec, color, label) => {
        return new Promise((resolve) => {
          const canvas = document.createElement('canvas');
          canvas.width = 640;
          canvas.height = 360;
          const ctx = canvas.getContext('2d');
          
          let frame = 0;
          const draw = () => {
            frame++;
            ctx.fillStyle = color;
            ctx.fillRect(0, 0, 640, 360);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 36px sans-serif';
            ctx.fillText(label, 60, 180);
            ctx.font = '24px sans-serif';
            ctx.fillText('Frame: ' + frame + ' | ' + freq + ' Hz', 60, 230);
          };
          draw();
          const timer = setInterval(draw, 1000 / 30);

          const stream = canvas.captureStream(30);

          const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
          const audioCtx = new AudioCtxClass();
          const osc = audioCtx.createOscillator();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
          const gain = audioCtx.createGain();
          gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
          const dst = audioCtx.createMediaStreamDestination();
          osc.connect(gain);
          gain.connect(dst);
          osc.start();

          const combined = new MediaStream([
            ...stream.getVideoTracks(),
            ...dst.stream.getAudioTracks(),
          ]);

          const recorder = new MediaRecorder(combined, { mimeType: 'video/webm' });
          const chunks = [];
          recorder.ondataavailable = (e) => {
            if (e.data && e.data.size > 0) chunks.push(e.data);
          };
          recorder.onstop = () => {
            clearInterval(timer);
            osc.stop();
            audioCtx.close();
            const blob = new Blob(chunks, { type: 'video/webm' });
            resolve(blob);
          };

          recorder.start();
          setTimeout(() => recorder.stop(), durationSec * 1000);
        });
      };

      const b1 = await makeVideoBlob(440, 3, '#1e3a8a', 'Klip 1 (Mavi, 440Hz)');
      const b2 = await makeVideoBlob(880, 3, '#831843', 'Klip 2 (Kırmızı, 880Hz)');

      const f1 = new File([b1], 'test_clip_1.webm', { type: 'video/webm' });
      const f2 = new File([b2], 'test_clip_2.webm', { type: 'video/webm' });

      // Find file input and upload f1
      const input = document.querySelector('input[type="file"]');
      if (!input) return { ok: false, error: 'File input not found' };

      const dt1 = new DataTransfer();
      dt1.items.add(f1);
      input.files = dt1.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));

      // Wait a moment for f1 to be processed and added
      await new Promise(r => setTimeout(r, 1500));

      // Upload f2 sequentially
      const dt2 = new DataTransfer();
      dt2.items.add(f2);
      input.files = dt2.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));

      await new Promise(r => setTimeout(r, 2000));

      return {
        ok: true,
        b1Size: b1.size,
        b2Size: b2.size,
      };
    })()`,
  });

  console.log('[Verify DragDrop & Audio] Synthesized and uploaded clips:', synthResult.result?.value);

  // Inspect timeline clips after upload
  const timelineClips = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const clipEls = Array.from(document.querySelectorAll('[data-clip-id]'));
      return {
        clipCount: clipEls.length,
        clips: clipEls.map(el => ({
          id: el.getAttribute('data-clip-id'),
          text: el.innerText.trim().slice(0, 40),
          left: el.style.left,
          width: el.style.width,
        })),
      };
    })()`,
  });
  console.log('[Verify DragDrop & Audio] Timeline clips detected:', timelineClips.result?.value);

  // TEST 1: Real Drag & Drop Test
  console.log('[Verify DragDrop & Audio] TEST 1: Testing Sidebar Drag-and-Drop...');
  // 1. Switch to 'Geçişler' (Transitions) tab in the sidebar
  await send('Runtime.evaluate', {
    expression: `(() => {
      const tabs = Array.from(document.querySelectorAll('aside button'));
      const trTab = tabs.find(b => b.innerText.includes('Geçişler') || b.innerText.includes('Geçiş'));
      if (trTab) trTab.click();
    })()`,
  });
  await new Promise((r) => setTimeout(r, 800));

  // Find position of the first transition card
  const cardPos = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      // Find draggable transition card
      const cards = Array.from(document.querySelectorAll('aside [class*="cursor-grab"]'));
      if (cards.length === 0) return null;
      const rect = cards[0].getBoundingClientRect();
      return {
        x: rect.x + rect.width / 2,
        y: rect.y + rect.height / 2,
        text: cards[0].innerText.slice(0, 30),
      };
    })()`,
  });
  console.log('[Verify DragDrop & Audio] Draggable transition card found:', cardPos.result?.value);

  // Find position of the timeline (between clip 1 and clip 2 or over the track)
  const timelinePos = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const scrollEl = document.querySelector('[data-timeline-scroll-container="true"]');
      if (!scrollEl) return null;
      const rect = scrollEl.getBoundingClientRect();
      const clip1 = document.querySelector('[data-clip-id]');
      let cutX = rect.left + 120;
      let cutY = rect.top + 24 + 64 + 32;
      if (clip1) {
        const c1Rect = clip1.getBoundingClientRect();
        cutX = c1Rect.right;
        cutY = c1Rect.top + c1Rect.height / 2;
      }
      return {
        x: cutX,
        y: cutY,
      };
    })()`,
  });
  console.log('[Verify DragDrop & Audio] Target timeline position:', timelinePos.result?.value);

  if (cardPos.result?.value && timelinePos.result?.value) {
    const fromX = cardPos.result.value.x;
    const fromY = cardPos.result.value.y;
    const toX = timelinePos.result.value.x;
    const toY = timelinePos.result.value.y;

    // Dispatch real pointerdown, pointermove sequence, and pointerup
    console.log(`[Verify DragDrop & Audio] Dragging from (${fromX}, ${fromY}) to (${toX}, ${toY})...`);
    await send('Runtime.evaluate', {
      expression: `(() => {
        const startEl = document.elementFromPoint(${fromX}, ${fromY});
        if (!startEl) return;
        
        // 1. Pointerdown
        const downEvent = new PointerEvent('pointerdown', {
          bubbles: true,
          cancelable: true,
          clientX: ${fromX},
          clientY: ${fromY},
          button: 0,
          buttons: 1,
          pointerId: 1,
        });
        startEl.dispatchEvent(downEvent);
      })()`,
    });
    await new Promise((r) => setTimeout(r, 200));

    // 2. Pointermove intermediate steps
    const steps = 5;
    for (let s = 1; s <= steps; s++) {
      const curX = fromX + ((toX - fromX) * s) / steps;
      const curY = fromY + ((toY - fromY) * s) / steps;
      await send('Runtime.evaluate', {
        expression: `(() => {
          const moveEvent = new PointerEvent('pointermove', {
            bubbles: true,
            cancelable: true,
            clientX: ${curX},
            clientY: ${curY},
            button: 0,
            buttons: 1,
            pointerId: 1,
          });
          window.dispatchEvent(moveEvent);
        })()`,
      });
      await new Promise((r) => setTimeout(r, 50));
    }

    // Capture screenshot while dragging is active
    const shotDrag = await send('Page.captureScreenshot', { format: 'png' });
    await fs.writeFile(
      'C:\\Users\\sinan\\.gemini\\antigravity\\brain\\094b1c26-b9f9-4b08-93a4-797170dbff1b\\verify_dragdrop_active.png',
      Buffer.from(shotDrag.data, 'base64')
    );
    console.log('[Verify DragDrop & Audio] Captured drag-in-progress screenshot!');

    // 3. Pointerup over timeline
    await send('Runtime.evaluate', {
      expression: `(() => {
        const upEvent = new PointerEvent('pointerup', {
          bubbles: true,
          cancelable: true,
          clientX: ${toX},
          clientY: ${toY},
          button: 0,
          buttons: 0,
          pointerId: 1,
        });
        window.dispatchEvent(upEvent);
      })()`,
    });
    await new Promise((r) => setTimeout(r, 1000));

    // Verify drop badge or transition applied
    const dropVerification = await send('Runtime.evaluate', {
      returnByValue: true,
      expression: `(() => {
        const trEls = Array.from(document.querySelectorAll('[data-transition-id], [data-testid="timeline-transition"]'));
        const badges = Array.from(document.querySelectorAll('[data-transition-badge], [class*="bowtie"]'));
        return {
          hasTimelineTransition: trEls.length > 0,
          transitionCount: trEls.length,
          transitionId: trEls[0] ? trEls[0].getAttribute('data-transition-id') : null,
          hasTransitionBadge: badges.length > 0,
          hasAudioMixer: !!window.__audioMixer,
        };
      })()`,
    });
    console.log('[Verify DragDrop & Audio] Drop verification result:', dropVerification.result?.value);

    // Save screenshot with transition applied
    const shotTr = await send('Page.captureScreenshot', { format: 'png' });
    await fs.writeFile(
      'C:\\Users\\sinan\\.gemini\\antigravity\\brain\\094b1c26-b9f9-4b08-93a4-797170dbff1b\\verify_transition_applied.png',
      Buffer.from(shotTr.data, 'base64')
    );
    console.log('[Verify DragDrop & Audio] Saved transition applied screenshot!');
  }

  // TEST 2: Multi-Clip Audio Playback & Energy Measurement
  console.log('[Verify DragDrop & Audio] TEST 2: Testing Multi-Video Audio Playback...');

  // Start playback
  await send('Runtime.evaluate', {
    expression: `(() => {
      // Find play button
      const playBtn = document.querySelector('button[title*="Oynat"], button[aria-label*="Play"], button[title*="Play"]');
      if (playBtn) playBtn.click();
      else {
        // Fallback space bar
        window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', code: 'Space', bubbles: true }));
      }
    })()`,
  });
  console.log('[Verify DragDrop & Audio] Playback initiated.');

  // Wait 1.0 second and measure Clip 1 audio energy
  await new Promise((r) => setTimeout(r, 1200));
  const energyClip1 = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const mixer = window.__audioMixer;
      if (!mixer) return { error: 'No mixer' };
      const energy = mixer.getAudioEnergy ? mixer.getAudioEnergy() : { rms: -1, peak: -1 };
      const ctx = mixer.audioCtx;
      return {
        rms: energy.rms,
        peak: energy.peak,
        ctxState: ctx ? ctx.state : 'none',
        currentTime: mixer.lastTime || 0,
      };
    })()`,
  });
  console.log('[Verify DragDrop & Audio] Telemetry Clip 1 (t ~ 1.2s):', energyClip1.result?.value);

  // Wait for playhead to advance across cut into Clip 2 (t ~ 3.5s - 4.5s)
  console.log('[Verify DragDrop & Audio] Playing into Clip 2...');
  await new Promise((r) => setTimeout(r, 2800));

  const energyClip2 = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const mixer = window.__audioMixer;
      if (!mixer) return { error: 'No mixer' };
      const energy = mixer.getAudioEnergy ? mixer.getAudioEnergy() : { rms: -1, peak: -1 };
      const ctx = mixer.audioCtx;
      return {
        rms: energy.rms,
        peak: energy.peak,
        ctxState: ctx ? ctx.state : 'none',
        currentTime: mixer.lastTime || 0,
      };
    })()`,
  });
  console.log('[Verify DragDrop & Audio] Telemetry Clip 2 (t ~ 4.0s):', energyClip2.result?.value);

  // Test seek back to Clip 1
  console.log('[Verify DragDrop & Audio] Testing Seek back to t=1.0s...');
  await send('Runtime.evaluate', {
    expression: `(() => {
      // Seek via timeline click or space
      const mixer = window.__audioMixer;
      // Seek playhead to 1.0s
      const timeline = document.querySelector('[data-timeline-tracks]') || document.querySelector('.overflow-x-auto');
      if (timeline) {
        const rect = timeline.getBoundingClientRect();
        // click at 1s position
        timeline.dispatchEvent(new MouseEvent('click', { clientX: rect.x + 60, clientY: rect.y + 20, bubbles: true }));
      }
    })()`,
  });
  await new Promise((r) => setTimeout(r, 600));

  const energyAfterSeek = await send('Runtime.evaluate', {
    returnByValue: true,
    expression: `(() => {
      const mixer = window.__audioMixer;
      if (!mixer) return { error: 'No mixer' };
      const energy = mixer.getAudioEnergy ? mixer.getAudioEnergy() : { rms: -1, peak: -1 };
      return {
        rms: energy.rms,
        peak: energy.peak,
      };
    })()`,
  });
  console.log('[Verify DragDrop & Audio] Telemetry after Seek to Clip 1:', energyAfterSeek.result?.value);

  // Capture final screenshot
  const shotFinal = await send('Page.captureScreenshot', { format: 'png' });
  await fs.writeFile(
    'C:\\Users\\sinan\\.gemini\\antigravity\\brain\\094b1c26-b9f9-4b08-93a4-797170dbff1b\\verify_multivideo_audio_playback.png',
    Buffer.from(shotFinal.data, 'base64')
  );
  console.log('[Verify DragDrop & Audio] Saved final verification screenshot!');

  ws.close();
  chromeProc.kill();

  console.log('[Verify DragDrop & Audio] Verification complete.');
  process.exit(0);
}

main().catch((err) => {
  console.error('[Verify DragDrop & Audio Fatal Error]', err);
  process.exit(1);
});

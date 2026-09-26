import { spawn } from 'child_process';
import WebSocket from 'ws';

async function main() {
  console.log('=== REPRODUCING USER BUGS IN REAL CHROMIUM ===');
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9225',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--autoplay-policy=no-user-gesture-required',
    '--user-data-dir=' + process.env.TEMP + '\\repro_bugs_' + Date.now(),
  ]);

  let versionData = null;
  for (let i = 0; i < 25; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9225/json/version');
      if (res.ok) { versionData = await res.json(); break; }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  if (!versionData) {
    console.error('Failed to launch Chrome');
    process.exit(1);
  }

  const newTabRes = await fetch('http://127.0.0.1:9225/json/new?http://localhost:5173/video-editor', { method: 'PUT' });
  const tab = await newTabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.once('open', resolve));

  let msgId = 1;
  const pending = new Map();
  const consoleLogs = [];

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map((a) => a.value || a.description || JSON.stringify(a)).join(' ');
      consoleLogs.push({ type: msg.params.type, text });
      console.log(`[BROWSER ${msg.params.type.toUpperCase()}]`, text);
    } else if (msg.method === 'Runtime.exceptionThrown') {
      console.error('[BROWSER EXCEPTION]', msg.params.exceptionDetails);
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
  await send('Console.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1536,
    height: 960,
    deviceScaleFactor: 1,
    mobile: false
  });

  console.log('Waiting for video editor page load...');
  await new Promise((r) => setTimeout(r, 4000));

  const runEval = async (code) => {
    const res = await send('Runtime.evaluate', {
      expression: code,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      console.error('Eval error:', JSON.stringify(res.exceptionDetails));
    }
    return res.result?.value;
  };

  // TEST 1: Check drag and drop on real DOM elements
  console.log('\n--- TEST 1: Drag & Drop Transition/Effect to Timeline ---');
  const dndResult = await runEval(`
    (async () => {
      const results = {};

      // 1. Open Transitions Tab
      const tabs = Array.from(document.querySelectorAll('button'));
      const transTab = tabs.find(b => b.innerText.includes('Geçişler'));
      if (!transTab) return { error: 'Geçişler tab not found' };
      transTab.click();
      await new Promise(r => setTimeout(r, 600));

      // Find first transition card
      const cards = Array.from(document.querySelectorAll('div[class*="group/card"]'));
      results.cardCount = cards.length;
      if (cards.length === 0) return { error: 'No transition cards found' };

      const card = cards[0];
      const cardRect = card.getBoundingClientRect();
      results.cardRect = { x: cardRect.x, y: cardRect.y, w: cardRect.width, h: cardRect.height };

      // Find timeline track area
      const timelineScroll = document.querySelector('div[class*="overflow-x-auto"][class*="overflow-y-auto"]');
      if (!timelineScroll) return { error: 'Timeline scroll container not found' };
      const timelineRect = timelineScroll.getBoundingClientRect();
      results.timelineRect = { x: timelineRect.x, y: timelineRect.y, w: timelineRect.width, h: timelineRect.height };

      // Test pointer dispatch from card to timeline
      const startX = cardRect.x + cardRect.width / 2;
      const startY = cardRect.y + cardRect.height / 2;
      const endX = timelineRect.x + 200;
      const endY = timelineRect.y + 60;

      // Dispatch pointerdown on card
      card.dispatchEvent(new PointerEvent('pointerdown', {
        bubbles: true,
        cancelable: true,
        clientX: startX,
        clientY: startY,
        button: 0,
        buttons: 1,
        pointerId: 1
      }));

      // Check if isDragging became true in DOM / ghost element
      await new Promise(r => setTimeout(r, 50));
      const ghostBefore = document.querySelector('div[style*="z-index: 99999"], div[style*="zIndex: 99999"]');
      results.ghostPresent = Boolean(ghostBefore);

      // Move pointer towards timeline
      window.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true,
        cancelable: true,
        clientX: endX,
        clientY: endY,
        button: 0,
        buttons: 1,
        pointerId: 1
      }));
      await new Promise(r => setTimeout(r, 50));

      // Dispatch pointerup
      timelineScroll.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        clientX: endX,
        clientY: endY,
        button: 0,
        buttons: 0,
        pointerId: 1
      }));
      window.dispatchEvent(new PointerEvent('pointerup', {
        bubbles: true,
        cancelable: true,
        clientX: endX,
        clientY: endY,
        button: 0,
        buttons: 0,
        pointerId: 1
      }));

      await new Promise(r => setTimeout(r, 300));

      // Check bowtie badges or transitions
      const bowties = document.querySelectorAll('button[title*="Geçiş"]');
      results.bowtieCount = bowties.length;

      return results;
    })()
  `);
  console.log('DND Result:', dndResult);

  // TEST 2: Two videos with audio
  console.log('\n--- TEST 2: Adding Two Videos with Audio ---');
  const audioTestResult = await runEval(`
    (async () => {
      const results = {};

      // Helper to generate a webm video with audio oscillator
      async function createVideoBlob(freq, durationSec, text) {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const dest = audioCtx.createMediaStreamDestination();
        const osc = audioCtx.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        const gain = audioCtx.createGain();
        gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
        osc.connect(gain);
        gain.connect(dest);
        osc.start();

        const canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 360;
        const ctx = canvas.getContext('2d');
        const vStream = canvas.captureStream(30);

        const combinedStream = new MediaStream([
          ...vStream.getVideoTracks(),
          ...dest.stream.getAudioTracks()
        ]);

        const rec = new MediaRecorder(combinedStream, { mimeType: 'video/webm' });
        const chunks = [];
        rec.ondataavailable = e => chunks.push(e.data);
        rec.start();

        const frames = Math.round(durationSec * 30);
        for (let i = 0; i < frames; i++) {
          ctx.fillStyle = freq === 440 ? '#1e40af' : '#b91c1c';
          ctx.fillRect(0, 0, 640, 360);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 36px sans-serif';
          ctx.fillText(text + ' ' + (i/30).toFixed(1) + 's', 50, 180);
          await new Promise(r => setTimeout(r, 1000/30));
        }

        rec.stop();
        osc.stop();
        await audioCtx.close();
        await new Promise(r => rec.onstop = r);

        return new Blob(chunks, { type: 'video/webm' });
      }

      // Go to media tab
      const tabs = Array.from(document.querySelectorAll('button'));
      const mediaTab = tabs.find(b => b.innerText.includes('Medya') || b.innerText.includes('İçerik'));
      if (mediaTab) mediaTab.click();
      await new Promise(r => setTimeout(r, 400));

      const fileInput = document.querySelector('input[type="file"]');
      if (!fileInput) return { error: 'No file input found' };

      // Upload Video 1 (440 Hz, 3s)
      console.log('Generating Video 1 (440Hz)...');
      const blob1 = await createVideoBlob(440, 3, 'VIDEO 1 (440Hz)');
      const file1 = new File([blob1], 'video1.webm', { type: 'video/webm' });
      const dt1 = new DataTransfer();
      dt1.items.add(file1);
      fileInput.files = dt1.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));

      await new Promise(r => setTimeout(r, 2000));

      // Upload Video 2 (880 Hz, 3s)
      console.log('Generating Video 2 (880Hz)...');
      const blob2 = await createVideoBlob(880, 3, 'VIDEO 2 (880Hz)');
      const file2 = new File([blob2], 'video2.webm', { type: 'video/webm' });
      const dt2 = new DataTransfer();
      dt2.items.add(file2);
      fileInput.files = dt2.files;
      fileInput.dispatchEvent(new Event('change', { bubbles: true }));

      await new Promise(r => setTimeout(r, 2000));

      // Inspect tracks and clips in DOM or audioMixer
      const clipsOnTimeline = document.querySelectorAll('div[class*="rounded-md"][class*="border"]');
      results.clipElementsCount = clipsOnTimeline.length;

      // Click Play button
      const playBtn = document.querySelector('button[title*="Oynat"], button[title*="Play"]');
      if (playBtn) {
        playBtn.click();
        results.playClicked = true;
      }

      await new Promise(r => setTimeout(r, 1000));

      // Inspect active AudioBufferSourceNodes or audio mixer state
      return results;
    })()
  `);
  console.log('Audio Test Result:', audioTestResult);

  ws.close();
  chromeProc.kill();
  process.exit(0);
}

main().catch(err => {
  console.error('Fatal in test:', err);
  process.exit(1);
});

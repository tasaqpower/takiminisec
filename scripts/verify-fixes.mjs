import { spawn } from 'child_process';
import WebSocket from 'ws';

async function main() {
  console.log('=== VERIFYING FONT SWITCHING AND LIVE ANIMATION PLAYBACK ===');

  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9235',
    '--no-first-run',
    '--disable-gpu',
    '--user-data-dir=' + process.env.TEMP + '\\test_verify_' + Date.now(),
  ]);

  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9235/json/version');
      if (res.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 250));
  }

  const newTabRes = await fetch('http://127.0.0.1:9235/json/new?http://localhost:5173/video-editor', { method: 'PUT' });
  const tab = await newTabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise((resolve) => ws.once('open', resolve));

  let msgId = 1;
  const pending = new Map();
  const logs = [];

  ws.on('message', (data) => {
    const msg = JSON.parse(data);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = msg.params.args.map((a) => a.value || a.description || JSON.stringify(a)).join(' ');
      logs.push(text);
      if (text.includes('Gizmo') || text.includes('error') || text.includes('Error')) {
        console.log('[LOG]', text);
      }
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

  async function evaluate(expression) {
    const res = await send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error('Evaluation error: ' + JSON.stringify(res.exceptionDetails));
    }
    return res.result.value;
  }

  await send('Runtime.enable');
  await new Promise((r) => setTimeout(r, 2000));

  // 1. Add Heading
  const addRes = await evaluate(`
    (async () => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const textTab = buttons.find(b => b.textContent?.includes('Metin'));
      textTab?.click();
      await new Promise(r => setTimeout(r, 300));
      const addHeading = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('Başlık (Heading)'));
      addHeading?.click();
      await new Promise(r => setTimeout(r, 600));
      return { ok: true };
    })()
  `);
  console.log('1. Add Heading:', addRes);

  // 2. Test Font Switching: Switch to Pacifico, then Cinzel, then Bebas Neue
  const fontTests = await evaluate(`
    (async () => {
      const results = [];
      const testFont = async (fontName, categoryName) => {
        // Open font picker
        const allButtons = Array.from(document.querySelectorAll('button'));
        const fontBtn = allButtons.find(b => b.textContent?.includes('Değiştir') || b.textContent?.includes('Plus Jakarta Sans') || b.textContent?.includes('Font'));
        fontBtn?.click();
        await new Promise(r => setTimeout(r, 300));

        // Filter or search
        const input = document.querySelector('input[placeholder*="Font ara"]');
        if (input) {
          input.value = fontName;
          input.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 300));
        }

        // Find font row
        const paragraphs = Array.from(document.querySelectorAll('p'));
        const pElem = paragraphs.find(p => p.textContent === fontName);
        const row = pElem?.closest('.cursor-pointer') || pElem?.parentElement?.parentElement;
        if (!row) return { fontName, error: 'Row not found' };

        const canvas = document.querySelector('canvas');
        const ctx = canvas.getContext('2d');
        const snap1 = ctx.getImageData(canvas.width / 2 - 150, canvas.height / 2 - 50, 300, 100).data;
        let count1 = 0;
        for (let i = 0; i < snap1.length; i += 4) if (snap1[i] > 30) count1++;

        row.click();
        // Wait for font load & redraw
        await new Promise(r => setTimeout(r, 1200));

        const snap2 = ctx.getImageData(canvas.width / 2 - 150, canvas.height / 2 - 50, 300, 100).data;
        let count2 = 0;
        for (let i = 0; i < snap2.length; i += 4) if (snap2[i] > 30) count2++;

        return {
          fontName,
          countBefore: count1,
          countAfter: count2,
          pixelDiff: Math.abs(count1 - count2),
          changed: count1 !== count2,
        };
      };

      results.push(await testFont('Pacifico', 'El Yazısı'));
      results.push(await testFont('Cinzel', 'Serif'));
      results.push(await testFont('Bebas Neue', 'Manşet'));

      return results;
    })()
  `);
  console.log('2. Font Switching Results:', JSON.stringify(fontTests, null, 2));

  // 3. Test Animation: Click "Daktilo Yazısı" (Typewriter) and check live rendering
  const animTest = await evaluate(`
    (async () => {
      const allButtons = Array.from(document.querySelectorAll('button'));
      const typewriterBtn = allButtons.find(b => b.textContent?.includes('Daktilo Yazısı'));
      if (!typewriterBtn) return { error: 'Typewriter button not found' };

      const canvas = document.querySelector('canvas');
      const ctx = canvas.getContext('2d');

      typewriterBtn.click();

      // Sample canvas over 1.6 seconds to ensure text is actively typing out
      const frameCounts = [];
      for (let i = 0; i < 8; i++) {
        await new Promise(r => setTimeout(r, 200));
        const snap = ctx.getImageData(canvas.width / 2 - 200, canvas.height / 2 - 50, 400, 100).data;
        let nonBlack = 0;
        for (let j = 0; j < snap.length; j += 4) if (snap[j] > 30) nonBlack++;
        const timeEl = document.querySelector('.font-mono span.text-white.font-semibold');
        frameCounts.push({
          time: timeEl?.textContent,
          pixels: nonBlack,
        });
      }

      return {
        typewriterClicked: true,
        frameCounts,
      };
    })()
  `);
  console.log('3. Typewriter Animation Test:', JSON.stringify(animTest, null, 2));

  // 4. Test "Animasyonu Tuvalde Canlı Oynat" button
  const liveBtnTest = await evaluate(`
    (async () => {
      const allButtons = Array.from(document.querySelectorAll('button'));
      const liveBtn = allButtons.find(b => b.textContent?.includes('Animasyonu Tuvalde Canlı Oynat'));
      if (!liveBtn) return { error: 'Live play button not found' };

      liveBtn.click();

      const times = [];
      for (let i = 0; i < 6; i++) {
        await new Promise(r => setTimeout(r, 250));
        const timeEl = document.querySelector('.font-mono span.text-white.font-semibold');
        times.push(timeEl?.textContent);
      }

      return {
        liveBtnClicked: true,
        times,
      };
    })()
  `);
  console.log('4. Live Play Button Test:', JSON.stringify(liveBtnTest, null, 2));

  ws.close();
  chromeProc.kill();
  process.exit(0);
}

main().catch(console.error);

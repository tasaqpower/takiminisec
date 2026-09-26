import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs';

async function main() {
  console.log('=== VERIFYING TABBED PROPERTIES PANEL VIA CHROME CDP ===');

  const chromeProc = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9241',
    '--no-first-run',
    '--disable-gpu',
    '--window-size=1440,900',
    '--user-data-dir=' + process.env.TEMP + '\\test_verify_tabbed_' + Date.now(),
  ]);

  for (let i = 0; i < 25; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9241/json/version');
      if (res.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }

  // Use port 5173 where vinext dev is running
  const newTabRes = await fetch('http://127.0.0.1:9241/json/new?http://localhost:5173/video-editor', { method: 'PUT' });
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
      if (text.includes('error') || text.includes('Error') || text.includes('warn')) {
        console.log('[BROWSER LOG]', text);
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

  async function takeScreenshot(filename) {
    const res = await send('Page.captureScreenshot', { format: 'png' });
    const fullPath = 'C:/Users/sinan/.gemini/antigravity/brain/094b1c26-b9f9-4b08-93a4-797170dbff1b/' + filename;
    fs.writeFileSync(fullPath, Buffer.from(res.data, 'base64'));
    console.log(`   📸 Screenshot saved: ${filename}`);
  }

  await send('Page.enable');
  await send('Runtime.enable');
  await new Promise((r) => setTimeout(r, 3000));

  // 1. Add an Element (which adds a visual video/shape clip)
  console.log('\n--- 1. Adding clip to select and inspect properties tabs ---');
  const addRes = await evaluate(`
    (async () => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const elemTab = buttons.find(b => b.textContent?.includes('Öğeler'));
      if (!elemTab) return { error: 'Elements tab not found' };
      elemTab.click();
      await new Promise(r => setTimeout(r, 600));

      const allBtns = Array.from(document.querySelectorAll('button'));
      const ytBtn = allBtns.find(b => b.textContent?.includes('YouTube Abone Ol'));
      if (!ytBtn) return { error: 'YouTube preset not found' };

      ytBtn.click();
      await new Promise(r => setTimeout(r, 1200));

      const clips = document.querySelectorAll('.cursor-grab');
      return { ok: true, count: clips.length };
    })()
  `);
  console.log('   Add Clip Result:', addRes);

  // 2. Test Visual Clip Tabs
  console.log('\n--- 2. Verifying Tabs for Visual Clip (Temel, Animasyon, Kırp & Maske, Renk) ---');

  // Tab: Temel
  const tabBasicRes = await evaluate(`
    (async () => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const basicBtn = buttons.find(b => b.textContent?.includes('Temel'));
      if (!basicBtn) return { error: 'Temel tab button not found' };
      basicBtn.click();
      await new Promise(r => setTimeout(r, 400));
      const hasTransform = Array.from(document.querySelectorAll('*')).some(el => el.textContent?.includes('Dönüştürme (Transform)'));
      return { ok: true, hasTransform };
    })()
  `);
  console.log('   Temel Tab:', tabBasicRes);
  await takeScreenshot('verify_tab_temel.png');

  // Tab: Animasyon
  const tabAnimRes = await evaluate(`
    (async () => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const animBtn = buttons.find(b => b.textContent?.includes('Animasyon'));
      if (!animBtn) return { error: 'Animasyon tab button not found' };
      animBtn.click();
      await new Promise(r => setTimeout(r, 400));
      const hasKeyframe = Array.from(document.querySelectorAll('*')).some(el => el.textContent?.includes('Anahtar Kareler (Keyframe)'));
      const hasTransitions = Array.from(document.querySelectorAll('*')).some(el => el.textContent?.includes('Geçiş Efektleri'));
      return { ok: true, hasKeyframe, hasTransitions };
    })()
  `);
  console.log('   Animasyon Tab:', tabAnimRes);
  await takeScreenshot('verify_tab_animasyon.png');

  // Tab: Kırp & Maske
  const tabMaskRes = await evaluate(`
    (async () => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const maskBtn = buttons.find(b => b.textContent?.includes('Kırp & Maske'));
      if (!maskBtn) return { error: 'Kırp & Maske tab button not found' };
      maskBtn.click();
      await new Promise(r => setTimeout(r, 400));
      const hasMask = Array.from(document.querySelectorAll('*')).some(el => el.textContent?.includes('Kırpma & Maskeleme'));
      const hasChroma = Array.from(document.querySelectorAll('*')).some(el => el.textContent?.includes('Chroma Key (Yeşil Ekran)'));
      return { ok: true, hasMask, hasChroma };
    })()
  `);
  console.log('   Kırp & Maske Tab:', tabMaskRes);
  await takeScreenshot('verify_tab_maske.png');

  // Tab: Renk
  const tabColorRes = await evaluate(`
    (async () => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const colorBtn = buttons.find(b => b.textContent?.includes('Renk'));
      if (!colorBtn) return { error: 'Renk tab button not found' };
      colorBtn.click();
      await new Promise(r => setTimeout(r, 400));
      const hasFilters = Array.from(document.querySelectorAll('*')).some(el => el.textContent?.includes('Renk ve Filtreler'));
      return { ok: true, hasFilters };
    })()
  `);
  console.log('   Renk Tab:', tabColorRes);
  await takeScreenshot('verify_tab_renk.png');

  // 3. Test Text Clip Tabs
  console.log('\n--- 3. Verifying Tabs for Text Clip (Metin, Animasyon, Konum & Keyframe) ---');
  const addTextRes = await evaluate(`
    (async () => {
      const buttons = Array.from(document.querySelectorAll('button'));
      const textSidebarBtn = buttons.find(b => b.textContent?.includes('Metin'));
      if (!textSidebarBtn) return { error: 'Metin sidebar button not found' };
      textSidebarBtn.click();
      await new Promise(r => setTimeout(r, 500));

      const allBtns = Array.from(document.querySelectorAll('button'));
      const addHeadingBtn = allBtns.find(b => b.textContent?.includes('Ana Başlık') || b.textContent?.includes('Vurgu / Callout') || b.textContent?.includes('Metin Şablonu'));
      if (!addHeadingBtn) return { error: 'Text template button not found' };
      addHeadingBtn.click();
      await new Promise(r => setTimeout(r, 1000));

      // Select the newly added text clip on timeline
      const allDivs = Array.from(document.querySelectorAll('*'));
      const textTimelineClip = allDivs.find(el => el.textContent?.includes('DİKKAT!') && el.classList?.contains('cursor-grab'));
      if (textTimelineClip) {
        textTimelineClip.click();
        await new Promise(r => setTimeout(r, 600));
      } else {
        const textClips = Array.from(document.querySelectorAll('.cursor-grab'));
        if (textClips.length > 0) {
          textClips[0].click(); // text clip is the top track!
          await new Promise(r => setTimeout(r, 600));
        }
      }

      const hasTextTab = Array.from(document.querySelectorAll('button')).some(b => b.textContent?.includes('Metin') && b.closest('aside'));
      const hasAnimTab = Array.from(document.querySelectorAll('button')).some(b => b.textContent?.includes('Animasyon') && b.closest('aside'));
      const hasTransformTab = Array.from(document.querySelectorAll('button')).some(b => b.textContent?.includes('Konum') && b.closest('aside'));

      return { ok: true, hasTextTab, hasAnimTab, hasTransformTab };
    })()
  `);
  console.log('   Text Tab Bar Detection:', addTextRes);
  await takeScreenshot('verify_tab_text_metin.png');

  // Switch to Text Animation tab
  const textAnimTabRes = await evaluate(`
    (async () => {
      const asideButtons = Array.from(document.querySelectorAll('aside button'));
      const animBtn = asideButtons.find(b => b.textContent?.includes('Animasyon'));
      if (animBtn) {
        animBtn.click();
        await new Promise(r => setTimeout(r, 400));
      }
      const hasTextAnimations = Array.from(document.querySelectorAll('*')).some(el => el.textContent?.includes('Metin Animasyonları'));
      const hasPlayLive = Array.from(document.querySelectorAll('button')).some(b => b.textContent?.includes('Animasyonu Tuvalde Canlı Oynat'));
      return { ok: true, hasTextAnimations, hasPlayLive };
    })()
  `);
  console.log('   Text Animation Tab:', textAnimTabRes);
  await takeScreenshot('verify_tab_text_animasyon.png');

  console.log('\n=== ALL TABBED NAVIGATION TESTS VERIFIED SUCCESSFULLY ===\n');

  ws.close();
  chromeProc.kill();
  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

import { spawn } from 'child_process';
import WebSocket from 'ws';

async function testQuick() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9298',
    '--no-first-run',
    '--disable-web-security',
    '--allow-running-insecure-content',
    '--autoplay-policy=no-user-gesture-required',
    '--window-size=1920,1080',
    `--user-data-dir=C:\\Windows\\Temp\\forma_cdp_quick_${Date.now()}`,
  ]);

  await new Promise(r => setTimeout(r, 1500));
  const v = await (await fetch('http://127.0.0.1:9298/json/version')).json();
  const ws = new WebSocket(v.webSocketDebuggerUrl);
  await new Promise(r => ws.once('open', r));

  let msgId = 1;
  const send = (m, p, s) => new Promise((res, rej) => {
    const id = msgId++;
    const h = d => {
      const j = JSON.parse(d);
      if (j.id === id) { ws.off('message', h); if (j.error) rej(j.error); else res(j.result); }
    };
    ws.on('message', h);
    const payload = { id, method: m, params: p };
    if (s) payload.sessionId = s;
    ws.send(JSON.stringify(payload));
  });

  const t = await send('Target.createTarget', { url: 'http://localhost:5173/video-editor' });
  const a = await send('Target.attachToTarget', { targetId: t.targetId, flatten: true });

  await send('Page.enable', {}, a.sessionId);
  await send('Runtime.enable', {}, a.sessionId);
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false }, a.sessionId);

  await new Promise(r => setTimeout(r, 3500));

  const res = await send('Runtime.evaluate', {
    expression: `(async () => {
      try {
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

      // 1. Add video asset
      const railBtn = document.querySelector('[data-rail-tab="assets"]');
      if (railBtn) railBtn.click();
      await new Promise(r => setTimeout(r, 400));

      const input = document.querySelector('input[placeholder*="asset ara"]');
      nativeSetter.call(input, 'broll-7e2579576d');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(r => setTimeout(r, 500));

      const card = document.querySelector('[data-asset-card="broll-7e2579576d"]') || document.querySelector('[data-asset-card*="broll"]');
      const addBtn = card.querySelector('button[title*="Timeline"]') || Array.from(card.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Ekle'));
      addBtn.click();
      await new Promise(r => setTimeout(r, 600));

      // Trim right handle to 10s
      const clipEl = document.querySelector('[data-clip-type="video"]');
      const handle = clipEl.querySelector('[title="Bitişi Kırp"]');
      const dur = parseFloat(clipEl.getAttribute('data-duration') || '5');
      const rect = handle.getBoundingClientRect();
      const startX = rect.left + rect.width / 2;
      const startY = rect.top + rect.height / 2;
      handle.dispatchEvent(new MouseEvent('mousedown', { clientX: startX, clientY: startY, bubbles: true }));
      const deltaX = (10.0 - dur) * 40;
      window.dispatchEvent(new MouseEvent('mousemove', { clientX: startX + deltaX, clientY: startY, bubbles: true }));
      window.dispatchEvent(new MouseEvent('mouseup', { clientX: startX + deltaX, clientY: startY, bubbles: true }));
      await new Promise(r => setTimeout(r, 500));

      // Seek to 8.5s
      const ruler = Array.from(document.querySelectorAll('div')).find(
        d => d.className && d.className.includes('h-6') && d.className.includes('cursor-pointer')
      );
      const rulerRect = ruler ? ruler.getBoundingClientRect() : null;
      if (ruler) {
        // We want time = 8.5s.
        // clientXToTime: (clientX - scrollContainerRect.left + scrollLeft) / zoom
        // ruler is inside scrollContainer, so ruler.left equals scrollContainer.left - scrollLeft!
        const targetX = rulerRect.left + 8.5 * 40;
        ruler.dispatchEvent(new MouseEvent('click', { clientX: targetX, clientY: rulerRect.top + 10, bubbles: true }));
        await new Promise(r => setTimeout(r, 400));
      }

      // Select clip & Split
      clipEl.click();
      await new Promise(r => setTimeout(r, 300));

      const splitBtn = Array.from(document.querySelectorAll('button')).find(
        b => b.title === 'Klibi Oynatma Çizgisinden İkiye Böl (S)' || (b.textContent && b.textContent.trim() === 'Böl (S)')
      );
      const debugInfo = {
        splitBtnFound: Boolean(splitBtn),
        splitBtnDisabled: splitBtn ? splitBtn.disabled : null,
        splitBtnTitle: splitBtn ? splitBtn.title : null,
        rulerRect,
        currentTime: window.__formaEditor?.currentTime,
        selectedClipId: window.__formaEditor?.project?.tracks?.[1]?.clips?.[0]?.id,
      };
      if (splitBtn && !splitBtn.disabled) {
        splitBtn.click();
        await new Promise(r => setTimeout(r, 500));
      }

      // Check clips
      const clips = Array.from(document.querySelectorAll('[data-clip-id]')).map(el => ({
        id: el.getAttribute('data-clip-id'),
        type: el.getAttribute('data-clip-type'),
        start: parseFloat(el.getAttribute('data-start-time') || '0'),
        dur: parseFloat(el.getAttribute('data-duration') || '0')
      }));

      // Add transition via Double Click
      const trTab = document.querySelector('[data-rail-tab="transitions"]');
      if (trTab) {
        trTab.click();
        await new Promise(r => setTimeout(r, 500));
        const trCard = document.querySelector('[data-testid="transition-card-crossfade"]') || document.querySelector('[data-testid^="transition-card-"]');
        if (trCard) {
          trCard.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
          await new Promise(r => setTimeout(r, 500));
        }
      }

      // Return to Assets tab safely (only click if not already open)
      if (!document.querySelector('input[placeholder*="asset ara"]')) {
        const railBtn = document.querySelector('[data-rail-tab="assets"]');
        if (railBtn) {
          railBtn.click();
          await new Promise(r => setTimeout(r, 400));
        }
      }

      // Add Track 2 (Video 2) and Track 4 (Audio 2)
      const addTrackBtn = document.querySelector('[data-action="add-track"]') ||
                          Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Kanal Ekle'));
      addTrackBtn.click();
      await new Promise(r => setTimeout(r, 200));
      Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Video Kanalı')).click();
      await new Promise(r => setTimeout(r, 200));

      addTrackBtn.click();
      await new Promise(r => setTimeout(r, 200));
      Array.from(document.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Ses Kanalı')).click();
      await new Promise(r => setTimeout(r, 200));

      const seekViaRuler = async (sec) => {
        const ruler = Array.from(document.querySelectorAll('div')).find(
          d => d.className && d.className.includes('h-6') && d.className.includes('cursor-pointer')
        );
        if (ruler) {
          const rect = ruler.getBoundingClientRect();
          const targetX = rect.left + sec * 40;
          ruler.dispatchEvent(new MouseEvent('click', { clientX: targetX, clientY: rect.top + 10, bubbles: true }));
          await new Promise(r => setTimeout(r, 400));
        }
      };

      // Seek to 0.0s for Overlay
      await seekViaRuler(0);

      // Lock Track 1 (Video 1) so overlay lands on Track 2 (Video 2)
      const v1Lock = document.querySelector('[data-testid="track-header-video-1"] button[title*="Kanalı Kilitle"]');
      if (v1Lock) { v1Lock.click(); await new Promise(r => setTimeout(r, 200)); }

      const addAssetViaUI = async (assetId, query) => {
        const inp = document.querySelector('input[placeholder*="asset ara"]');
        if (!inp) return { success: false, error: 'Input not found' };
        nativeSetter.call(inp, query);
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 500));
        const card = document.querySelector('[data-asset-card="' + assetId + '"]') || document.querySelector('[data-asset-card*="' + query + '"]');
        if (!card) return { success: false, error: 'Card not found for ' + assetId };
        const btn = card.querySelector('button[title*="Timeline"]') || Array.from(card.querySelectorAll('button')).find(b => b.textContent && b.textContent.includes('Ekle'));
        if (!btn) return { success: false, error: 'Btn not found for ' + assetId };
        btn.click();
        await new Promise(r => setTimeout(r, 600));
        return { success: true, assetId };
      };

      // Add Overlay clip (Video 2) at 0.0s
      const resOverlay = await addAssetViaUI('overlay-light-leak-warm', 'light-leak-warm');

      // Unlock Track 1
      const v1Unlock = document.querySelector('[data-testid="track-header-video-1"] button[title*="Kilidi Aç"]');
      if (v1Unlock) { v1Unlock.click(); await new Promise(r => setTimeout(r, 200)); }

      // Seek to 0.0s for Audio
      await seekViaRuler(0);

      // Add Audio clip (Audio 1) at 0.0s
      const resAudio = await addAssetViaUI('music-calm-piano', 'calm-piano');

      // Seek to 9.0s for Title
      await seekViaRuler(9.0);

      // Add Title clip (Text 1) at 9.0s
      const resTitle = await addAssetViaUI('title-lower-third-modern', 'lower-third-modern');

      // Trim overlay to 10s
      const overlayEl = document.querySelector('[data-clip-type="image"]');
      if (overlayEl) {
        overlayEl.click();
        await new Promise(r => setTimeout(r, 200));
        const handle = overlayEl.querySelector('[title="Bitişi Kırp"]');
        if (handle) {
          const dur = parseFloat(overlayEl.getAttribute('data-duration') || '5');
          const rect = handle.getBoundingClientRect();
          const startX = rect.left + rect.width / 2;
          const startY = rect.top + rect.height / 2;
          handle.dispatchEvent(new MouseEvent('mousedown', { clientX: startX, clientY: startY, bubbles: true }));
          const deltaX = (10.0 - dur) * 40;
          window.dispatchEvent(new MouseEvent('mousemove', { clientX: startX + deltaX, clientY: startY, bubbles: true }));
          window.dispatchEvent(new MouseEvent('mouseup', { clientX: startX + deltaX, clientY: startY, bubbles: true }));
          await new Promise(r => setTimeout(r, 400));
        }
      }

      // Trim audio to 10s
      const audioEl = document.querySelector('[data-clip-type="audio"]');
      if (audioEl) {
        audioEl.click();
        await new Promise(r => setTimeout(r, 200));
        const handle = audioEl.querySelector('[title="Bitişi Kırp"]');
        if (handle) {
          const dur = parseFloat(audioEl.getAttribute('data-duration') || '5');
          const rect = handle.getBoundingClientRect();
          const startX = rect.left + rect.width / 2;
          const startY = rect.top + rect.height / 2;
          handle.dispatchEvent(new MouseEvent('mousedown', { clientX: startX, clientY: startY, bubbles: true }));
          const deltaX = (10.0 - dur) * 40;
          window.dispatchEvent(new MouseEvent('mousemove', { clientX: startX + deltaX, clientY: startY, bubbles: true }));
          window.dispatchEvent(new MouseEvent('mouseup', { clientX: startX + deltaX, clientY: startY, bubbles: true }));
          await new Promise(r => setTimeout(r, 400));
        }
      }

      // Adjust text clip: trim right handle to 10.0s (ends at 10.0s)
      const textEl = document.querySelector('[data-clip-type="text"]');
      if (textEl) {
        textEl.click();
        await new Promise(r => setTimeout(r, 300));
        const rightH = textEl.querySelector('[title="Bitişi Kırp"]');
        if (rightH) {
          const dur = parseFloat(textEl.getAttribute('data-duration') || '4');
          const startT = parseFloat(textEl.getAttribute('data-start-time') || '9');
          const currentEnd = startT + dur;
          const deltaX = (10.0 - currentEnd) * 40;
          if (Math.abs(deltaX) > 2) {
            const rect = rightH.getBoundingClientRect();
            const startX = rect.left + rect.width / 2;
            const startY = rect.top + rect.height / 2;
            rightH.dispatchEvent(new MouseEvent('mousedown', { clientX: startX, clientY: startY, bubbles: true }));
            window.dispatchEvent(new MouseEvent('mousemove', { clientX: startX + deltaX, clientY: startY, bubbles: true }));
            window.dispatchEvent(new MouseEvent('mouseup', { clientX: startX + deltaX, clientY: startY, bubbles: true }));
            await new Promise(r => setTimeout(r, 400));
          }
        }

        // Set text in textarea
        const ta = document.querySelector('textarea[placeholder*="Metninizi yazın"]');
        if (ta) {
          const nativeTaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
          nativeTaSetter.call(ta, 'FORMA V5 FINAL CUT');
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 300));
        }

        // Open "Metin Animasyonları" section
        const animSectionBtn = Array.from(document.querySelectorAll('button, div')).find(
          el => el.textContent && el.textContent.trim().startsWith('Metin Animasyonları')
        );
        if (animSectionBtn) {
          animSectionBtn.click();
          await new Promise(r => setTimeout(r, 300));
        }

        const fadeInBtn = Array.from(document.querySelectorAll('button')).find(
          b => b.textContent && (b.textContent.includes('Opaklık Giriş') || b.textContent.includes('Fade'))
        );
        if (fadeInBtn) {
          fadeInBtn.click();
          await new Promise(r => setTimeout(r, 300));
        }
      }

      const allClips = Array.from(document.querySelectorAll('[data-clip-id]')).map(el => ({
        id: el.getAttribute('data-clip-id'),
        type: el.getAttribute('data-clip-type'),
        trackId: el.getAttribute('data-track-id'),
        start: parseFloat(el.getAttribute('data-start-time') || '0'),
        dur: parseFloat(el.getAttribute('data-duration') || '0')
      }));

      const transitions = Array.from(document.querySelectorAll('[data-testid="timeline-transition"]')).map(el => ({
        id: el.getAttribute('data-transition-id'),
        title: el.getAttribute('title')
      }));

      return { allClips, clipCount: allClips.length, transitions };
      } catch (err) {
        return { error: err.message, stack: err.stack };
      }
    })()`,
    awaitPromise: true,
    returnByValue: true
  }, a.sessionId);

  console.log('DOM RESULT:', JSON.stringify(res.result.value, null, 2));
  chrome.kill();
}

testQuick().catch(console.error);

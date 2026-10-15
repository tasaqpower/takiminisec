import WebSocket from 'ws';
import { spawn } from 'child_process';

async function test() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9260',
    '--no-first-run',
    '--disable-gpu',
    '--user-data-dir=C:\\Windows\\Temp\\cdp_debug_profile',
  ]);
  await new Promise(r => setTimeout(r, 1200));

  try {
    const newTabRes = await fetch('http://127.0.0.1:9260/json/new?http://localhost:5174/video-editor', { method: 'PUT' });
    const tab = await newTabRes.json();
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    await new Promise(r => ws.once('open', r));
    let msgId = 1;
    const send = (method, params = {}) => new Promise((resolve) => {
      const curId = msgId++;
      const handler = (data) => {
        const m = JSON.parse(data);
        if (m.id === curId) { ws.off('message', handler); resolve(m.result); }
      };
      ws.on('message', handler);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });
    await send('Page.enable');
    await send('Runtime.enable');
    await new Promise(r => setTimeout(r, 1000));

    // Click assets rail tab
    await send('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.querySelector('[data-rail-tab="assets"]');
        if (btn) btn.click();
      })()`
    });
    await new Promise(r => setTimeout(r, 2000));

    const addAllAssets = await send('Runtime.evaluate', {
      expression: `(async () => {
        const input = document.querySelector('input[placeholder*="asset ara"]');
        const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;

        const addAssetByQuery = async (query, assetId) => {
          nativeSetter.call(input, query);
          input.dispatchEvent(new Event('input', { bubbles: true }));
          await new Promise(r => setTimeout(r, 600));

          const card = document.querySelector('[data-asset-card="' + assetId + '"]') ||
                       document.querySelector('[data-asset-card*="' + query + '"]');
          if (card) {
            const btn = Array.from(card.querySelectorAll('button')).find(b => b.textContent.includes('Ekle'));
            if (btn) btn.click();
            await new Promise(r => setTimeout(r, 500));
            return { added: true, id: card.getAttribute('data-asset-card') };
          }
          return { added: false, query };
        };

        const results = [];
        // 1. Video
        results.push(await addAssetByQuery('broll-7e2579576d', 'broll-7e2579576d'));
        // 2. Overlay
        results.push(await addAssetByQuery('overlay-light-leak-warm', 'overlay-light-leak-warm'));
        // 3. Music
        results.push(await addAssetByQuery('music-calm-piano', 'music-calm-piano'));
        // 4. SFX
        results.push(await addAssetByQuery('sfx-whoosh-standard', 'sfx-whoosh-standard'));
        // 5. Title
        results.push(await addAssetByQuery('title-lower-third-modern', 'title-lower-third-modern'));
        // 6. LUT
        results.push(await addAssetByQuery('lut-teal-orange', 'lut-teal-orange'));

        // Clear search
        nativeSetter.call(input, '');
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 300));

        // Extend video duration to 10s and seek to 5.0
        if (window.__formaEditor?.setProject) {
          window.__formaEditor.setProject(prev => ({
            ...prev,
            duration: 10.0,
            tracks: prev.tracks.map(t => ({
              ...t,
              clips: t.clips.map(c => ({
                ...c,
                duration: 10.0,
                ...(c.type === 'video' ? { colorFilter: 'lut-teal-orange' } : {}),
                ...(c.type === 'text' ? { textData: { ...c.textData, text: 'FORMA V3 ADLİ BAŞLIK' } } : {})
              }))
            }))
          }));
        }

        if (window.__formaEditor?.seek) window.__formaEditor.seek(5.0);
        await new Promise(r => setTimeout(r, 1500));

        // Get timeline DOM clips
        const domClips = Array.from(document.querySelectorAll('[data-clip-id]')).map(el => {
          const rect = el.getBoundingClientRect();
          return {
            clipId: el.getAttribute('data-clip-id'),
            clipType: el.getAttribute('data-clip-type'),
            trackId: el.getAttribute('data-track-id'),
            startTime: parseFloat(el.getAttribute('data-start-time') || '0'),
            duration: parseFloat(el.getAttribute('data-duration') || '0'),
            widthPx: Math.round(rect.width * 10) / 10,
          };
        });

        // Get Canvas pixel stats
        const canvas = document.querySelector('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        let sumR = 0, sumG = 0, sumB = 0;
        const total = imgData.data.length / 4;
        for (let i = 0; i < imgData.data.length; i += 4) {
          sumR += imgData.data[i];
          sumG += imgData.data[i+1];
          sumB += imgData.data[i+2];
        }
        const r = Math.round(sumR / total);
        const g = Math.round(sumG / total);
        const b = Math.round(sumB / total);
        const lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);

        return {
          results,
          domClipsCount: domClips.length,
          domClips,
          canvasRgb: [r, g, b],
          canvasLuminance: lum,
          tracks: window.__formaEditor?.project?.tracks?.map(t => ({
            id: t.id,
            type: t.type,
            clips: t.clips.map(c => ({ id: c.id, assetId: c.assetId, type: c.type, dur: c.duration, filter: c.colorFilter }))
          }))
        };
      })()`,
      returnByValue: true,
      awaitPromise: true,
    });
    console.log(JSON.stringify(addAllAssets.result.value, null, 2));
    ws.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    try { chrome.kill(); } catch {}
  }
}

test();

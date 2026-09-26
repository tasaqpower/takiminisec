async function check() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('https://takiminisec.lol/video-editor?ts=' + Date.now(), {
        headers: { 'Cache-Control': 'no-cache, no-store' }
      });
      const html = await res.text();
      const matches = [
        ...html.matchAll(/src="([^"]+\.js)"/g),
        ...html.matchAll(/href="([^"]+\.js)"/g)
      ].map(m => m[1]);

      const uniqueUrls = [...new Set(matches)];
      for (const src of uniqueUrls) {
        if (!src.includes('VideoEditorWorkspace')) continue;
        const fullUrl = (src.startsWith('http') ? src : 'https://takiminisec.lol' + src) + '?ts=' + Date.now();
        const sRes = await fetch(fullUrl, { headers: { 'Cache-Control': 'no-cache' } });
        const sText = await sRes.text();
        if (sText.includes('leading-none')) {
          console.log(`[DEPLOYED] Latest commit 297056e is LIVE on Render! (${i * 5}s)`);
          return true;
        }
      }
      console.log(`[WAITING] Deploying commit 297056e on Render... (${(i + 1) * 5}s)`);
    } catch (e) {
      console.log('Poll error:', e.message);
    }
    await new Promise(r => setTimeout(r, 5000));
  }
  return false;
}

check();

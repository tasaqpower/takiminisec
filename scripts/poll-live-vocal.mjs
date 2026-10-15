async function check() {
  console.log('Polling https://takiminisec.lol/video-editor for new commit 19d0a6b (Split Smoothness Fix)...');
  for (let i = 0; i < 40; i++) {
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
        if (sText.includes('preloadProjectMedia') || sText.includes('catchUpMultiplier') || sText.includes('crossedBoundary')) {
          console.log(`[DEPLOYED] Latest commit 19d0a6b is LIVE on takiminisec.lol! (${i * 10}s)`);
          return true;
        }
      }
      console.log(`[BUILDING] Deploying commit 19d0a6b on Render... (${(i + 1) * 10}s elapsed)`);
    } catch (e) {
      console.log('Poll error:', e.message);
    }
    await new Promise(r => setTimeout(r, 10000));
  }
  console.log('[TIMEOUT] Deployment is still building in Render dashboard.');
  return false;
}

check();

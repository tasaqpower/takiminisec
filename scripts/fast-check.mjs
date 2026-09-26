const controller = new AbortController();
setTimeout(() => controller.abort(), 15000);
try {
  const r = await fetch('https://takiminisec.lol/video-editor', {
    signal: controller.signal,
    headers: { 'Cache-Control': 'no-cache' }
  });
  const html = await r.text();
  const m = html.match(/\/static\/chunks\/VideoEditorWorkspace-[^"'\s>]+/);
  console.log('Deployed workspace chunk:', m ? m[0] : 'not found');
  if (m) {
    const cRes = await fetch('https://takiminisec.lol/_next' + m[0], { signal: controller.signal });
    const js = await cRes.text();
    console.log('Has registerRedrawCallback?', js.includes('registerRedrawCallback'));
    console.log('Has isVideoFrameReady?', js.includes('isVideoFrameReady'));
  }
} catch (err) {
  console.log('Fetch error:', err.message);
}

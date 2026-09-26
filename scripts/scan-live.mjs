async function scan() {
  const r = await fetch('https://takiminisec.lol/video-editor', { headers: { 'Cache-Control': 'no-cache' } });
  const html = await r.text();
  const chunks = html.match(/\/static\/chunks\/[^"'\s>]+/g) || [];
  console.log('Total chunks:', chunks.length);
  for (const c of chunks) {
    const res = await fetch('https://takiminisec.lol/_next' + c);
    const text = await res.text();
    const hasReady = text.includes('isVideoFrameReady') || text.includes('video.readyState');
    const hasRedraw = text.includes('registerRedrawCallback') || text.includes('setRenderVersion');
    const hasGizmo = text.includes('FORMA Gizmo') || text.includes('calculateClipBounds');
    if (hasReady || hasRedraw || hasGizmo) {
      console.log('MATCH in chunk:', c);
      console.log(' - isVideoFrameReady/readyState:', hasReady);
      console.log(' - registerRedrawCallback/setRenderVersion:', hasRedraw);
      console.log(' - FORMA Gizmo/calculateClipBounds:', hasGizmo);
    }
  }
}
scan().catch(console.error);

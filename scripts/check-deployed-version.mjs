async function main() {
  const res = await fetch('https://takiminisec.lol/video-editor', { headers: { 'Cache-Control': 'no-cache' } });
  const html = await res.text();
  const chunks = html.match(/\/static\/chunks\/[^"'\s>]+/g) || [];
  console.log('Detected chunks on https://takiminisec.lol:');
  for (const c of chunks) {
    console.log(' - ' + c);
  }

  // Look for the workspace chunk
  const wsChunk = chunks.find(c => c.includes('VideoEditorWorkspace'));
  if (wsChunk) {
    console.log('Fetching VideoEditorWorkspace chunk:', wsChunk);
    const cRes = await fetch('https://takiminisec.lol/_next' + wsChunk, { headers: { 'Cache-Control': 'no-cache' } });
    const js = await cRes.text();
    console.log('Chunk length:', js.length);
    console.log('Contains registerRedrawCallback?', js.includes('registerRedrawCallback'));
    console.log('Contains isVideoFrameReady?', js.includes('isVideoFrameReady'));
  } else {
    console.log('No VideoEditorWorkspace chunk found in HTML!');
  }
}

main().catch(console.error);

async function check() {
  try {
    const res = await fetch('https://takiminisec.lol/video-editor', {
      headers: { 'Cache-Control': 'no-cache', 'Pragma': 'no-cache' }
    });
    const html = await res.text();
    console.log('HTML byte length:', html.length);

    // Look for script bundles and preloaded chunks
    const matches = [
      ...html.matchAll(/src="([^"]+\.js)"/g),
      ...html.matchAll(/href="([^"]+\.js)"/g)
    ].map(m => m[1]);

    const uniqueUrls = [...new Set(matches)];
    console.log('Found JS files:', uniqueUrls.length, uniqueUrls.slice(0, 5));

    let foundNewCode = false;
    for (const src of uniqueUrls) {
      const fullUrl = src.startsWith('http') ? src : 'https://takiminisec.lol' + src;
      const sRes = await fetch(fullUrl, { headers: { 'Cache-Control': 'no-cache' } });
      const sText = await sRes.text();
      if (sText.includes('Ekranı Kaydet') || sText.includes('360px') || sText.includes('countdown-intro')) {
        console.log('FOUND NEW CODE IN BUNDLE:', fullUrl);
        foundNewCode = true;
        break;
      }
    }

    if (!foundNewCode) {
      console.log('Render deploy in progress: New bundle not yet deployed on live site.');
    } else {
      console.log('SUCCESS: New deployment is LIVE on https://takiminisec.lol !');
    }
  } catch (err) {
    console.error('Check error:', err);
  }
}

check();

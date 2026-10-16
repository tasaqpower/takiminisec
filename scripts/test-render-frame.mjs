import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs';

async function testFrame() {
  const res = await fetch('http://127.0.0.1:9292/json/version').catch(() => null);
  if (!res || !res.ok) {
    console.log('Chrome 9292 not open');
    return;
  }
  const versionJson = await res.json();
  const ws = new WebSocket(versionJson.webSocketDebuggerUrl);
  await new Promise(r => ws.once('open', r));

  let id = 1;
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const curId = id++;
    const handler = (data) => {
      const msg = JSON.parse(data.toString());
      if (msg.id === curId) {
        ws.off('message', handler);
        resolve(msg.result);
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id: curId, method, params }));
  });

  const targets = await send('Target.getTargets');
  const pageTarget = targets.targetInfos.find(t => t.type === 'page');
  const attached = await send('Target.attachToTarget', { targetId: pageTarget.targetId, flatten: true });
  const sessionId = attached.sessionId;

  const evalRes = await send('Runtime.evaluate', {
    expression: `(async () => {
      try {
        const { renderFrameToCanvas } = await import('/features/video-editor/engine/previewRenderer.ts');
        const { renderTextLayer } = await import('/features/video-editor/engine/textRasterizer.ts');
        
        const canvas = document.createElement('canvas');
        canvas.width = 1920;
        canvas.height = 1080;
        const ctx = canvas.getContext('2d');

        // Test renderTextLayer directly
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, 1920, 1080);

        renderTextLayer(ctx, {
          layer: {
            text: 'FORMA 50+ VİRAL EFEKT MOTORU',
            fontSize: 52,
            fontFamily: 'Plus Jakarta Sans, sans-serif',
            fontWeight: 'bold',
            color: '#ffffff',
            fillColor: '#ffffff',
            inAnimation: 'typewriter',
            inDuration: 1.8,
            textAlign: 'center',
            background: {
              enabled: true,
              color: 'rgba(10, 10, 15, 0.80)',
              padding: 22,
              borderRadius: 14
            }
          },
          timeInClip: 1.3,
          clipDuration: 2.6,
          canvasWidth: 1920,
          canvasHeight: 1080,
          centerX: 960,
          centerY: 540,
          scale: 1,
          rotation: 0,
          opacity: 1
        });

        const b64 = canvas.toDataURL('image/png').split(',')[1];
        return { success: true, b64 };
      } catch (err) {
        return { error: err.message, stack: err.stack };
      }
    })()`,
    awaitPromise: true,
    returnByValue: true
  }, sessionId);

  console.log('Result:', evalRes.result?.value?.error || 'SUCCESS');
  if (evalRes.result?.value?.b64) {
    fs.writeFileSync('test_direct_text_layer.png', Buffer.from(evalRes.result.value.b64, 'base64'));
    console.log('Saved test_direct_text_layer.png');
  }
  ws.close();
}

testFrame();

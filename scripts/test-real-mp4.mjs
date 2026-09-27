import { spawn } from 'child_process';
import WebSocket from 'ws';
import fs from 'fs/promises';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

async function test() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9240',
    '--no-first-run',
    '--disable-gpu',
    '--user-data-dir=C:\\Windows\\Temp\\cdp_test_mp4',
  ]);
  await new Promise(r => setTimeout(r, 1200));
  const newTabRes = await fetch('http://127.0.0.1:9240/json/new?http://localhost:5173/video-editor', { method: 'PUT' });
  const tab = await newTabRes.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(r => ws.once('open', r));

  let id = 1;
  const send = (method, params = {}) => new Promise((resolve) => {
    const curId = id++;
    const handler = (data) => {
      const m = JSON.parse(data);
      if (m.id === curId) { ws.off('message', handler); resolve(m.result); }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify({ id: curId, method, params }));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await new Promise(r => setTimeout(r, 1500));

  const mp4DataUrl = await send('Runtime.evaluate', {
    expression: `(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      const ctx = canvas.getContext('2d');

      const stream = canvas.captureStream(30);

      // Audio tone
      const audioCtx = new AudioContext();
      const dest = audioCtx.createMediaStreamDestination();
      const osc = audioCtx.createOscillator();
      osc.frequency.value = 440;
      osc.connect(dest);
      osc.start();

      const combined = new MediaStream([
        ...stream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);

      const mimeType = 'video/mp4;codecs=avc1';
      const recorder = new MediaRecorder(combined, { mimeType });
      const chunks = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };

      recorder.start();

      // Render 30 frames (1 second)
      for (let f = 0; f < 30; f++) {
        ctx.fillStyle = f < 15 ? '#1e3a8a' : '#c2410c';
        ctx.fillRect(0, 0, 320, 180);
        ctx.fillStyle = '#ffffff';
        ctx.font = '30px sans-serif';
        ctx.fillText(f < 15 ? 'A' : 'B', 150, 100);
        await new Promise(r => setTimeout(r, 33));
      }

      await new Promise(resolve => {
        recorder.onstop = resolve;
        recorder.stop();
      });

      osc.stop();
      audioCtx.close();

      const blob = new Blob(chunks, { type: mimeType });
      const reader = new FileReader();
      return new Promise(resolve => {
        reader.onloadend = () => resolve(reader.result);
        reader.readAsDataURL(blob);
      });
    })()`,
    returnByValue: true,
    awaitPromise: true,
  });

  const base64Data = mp4DataUrl.result?.value?.replace(/^data:[^;]+;base64,/, '');
  const outPath = 'C:\\Windows\\Temp\\test_export_chrome.mp4';
  await fs.writeFile(outPath, Buffer.from(base64Data, 'base64'));
  console.log(`Saved MP4 to ${outPath} (${base64Data.length} chars)`);

  ws.close();
  chrome.kill();

  // Run ffprobe
  const ffprobePath = 'C:\\Users\\sinan\\AppData\\Local\\Microsoft\\WinGet\\Packages\\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\\ffmpeg-9.0-full_build\\bin\\ffprobe.exe';
  const { stdout } = await execFileAsync(ffprobePath, [
    '-v', 'error',
    '-show_entries', 'format=format_name,duration:stream=codec_name,codec_type,width,height',
    '-of', 'json',
    outPath,
  ]);
  console.log('FFPROBE OUTPUT:\n', stdout);
}
test().catch(console.error);

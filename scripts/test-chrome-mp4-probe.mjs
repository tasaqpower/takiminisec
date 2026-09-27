import { spawn, execFile } from 'child_process';
import { promisify } from 'util';
import WebSocket from 'ws';
import fs from 'fs/promises';

const execFileAsync = promisify(execFile);

async function test() {
  const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
    '--headless=new',
    '--remote-debugging-port=9243',
    '--no-first-run',
    '--disable-gpu',
    '--autoplay-policy=no-user-gesture-required',
    '--user-data-dir=C:\\Windows\\Temp\\cdp_test_mp4_3',
  ]);
  await new Promise(r => setTimeout(r, 1200));
  const newTabRes = await fetch('http://127.0.0.1:9243/json/new?http://localhost:5173/video-editor', { method: 'PUT' });
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

  const result = await send('Runtime.evaluate', {
    expression: `(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 320;
      canvas.height = 180;
      const ctx = canvas.getContext('2d');

      const stream = canvas.captureStream(30);

      // Audio tone
      const audioCtx = new AudioContext();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      const dest = audioCtx.createMediaStreamDestination();
      const osc = audioCtx.createOscillator();
      osc.frequency.value = 440;
      osc.connect(dest);
      osc.start();

      const combined = new MediaStream([
        ...stream.getVideoTracks(),
        ...dest.stream.getAudioTracks(),
      ]);

      const candidateMimes = [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4;codecs=avc1,opus',
        'video/mp4',
      ];
      let isMimeSupp = 'video/mp4';
      for (const m of candidateMimes) {
        if (MediaRecorder.isTypeSupported(m)) {
          isMimeSupp = m;
          break;
        }
      }
      const recorder = new MediaRecorder(combined, { mimeType: isMimeSupp, videoBitsPerSecond: 2000000 });
      const chunks = [];
      const logs = [];
      recorder.ondataavailable = e => {
        logs.push({ event: 'data', size: e.data.size });
        if (e.data.size > 0) chunks.push(e.data);
      };
      recorder.onerror = e => logs.push({ event: 'error', err: String(e) });

      recorder.start(100);

      for (let f = 0; f < 60; f++) {
        ctx.fillStyle = f < 30 ? '#1e3a8a' : '#c2410c';
        ctx.fillRect(0, 0, 320, 180);
        ctx.fillStyle = '#ffffff';
        ctx.font = '30px sans-serif';
        ctx.fillText(f < 30 ? 'A' : 'B', 150, 100);
        await new Promise(r => setTimeout(r, 33));
      }

      await new Promise(resolve => {
        recorder.onstop = () => {
          logs.push({ event: 'stop', totalChunks: chunks.length });
          resolve();
        };
        recorder.stop();
      });

      osc.stop();
      audioCtx.close();

      const blob = new Blob(chunks, { type: isMimeSupp });
      const reader = new FileReader();
      return new Promise(resolve => {
        reader.onloadend = () => resolve({
          mime: isMimeSupp,
          logs,
          dataUrl: reader.result,
        });
        reader.readAsDataURL(blob);
      });
    })()`,
    returnByValue: true,
    awaitPromise: true,
  });

  const val = result?.result?.value;
  console.log('USED MIME:', val?.mime);
  console.log('LOGS:', val?.logs);
  const dataUrl = val?.dataUrl || '';
  const commaIdx = dataUrl.indexOf(';base64,');
  const base64Data = commaIdx !== -1 ? dataUrl.slice(commaIdx + 8) : dataUrl;
  console.log('BASE64 LENGTH:', base64Data.length);
  const outPath = 'C:\\Windows\\Temp\\test_mp4_pure.mp4';
  const fileBuf = Buffer.from(base64Data, 'base64');
  console.log('ACTUAL FILE BUFFER SIZE (bytes):', fileBuf.length);
  await fs.writeFile(outPath, fileBuf);

  ws.close();
  chrome.kill();

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

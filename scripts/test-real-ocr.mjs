import { createWorker } from 'tesseract.js';
import path from 'node:path';
import fs from 'node:fs';
import http from 'node:http';
import { spawn } from 'node:child_process';

const targetText = 'İstanbul, Iğdır ve Şanlıurfa — Ç, Ğ, İ, Ö, Ş, Ü, ç, ğ, ı, ö, ş, ü';

const html = `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background: white; margin: 0; padding: 40px;">
  <div id="text" style="font-family: Arial, sans-serif; font-size: 30px; font-weight: bold; color: black; line-height: 1.6;">
    ${targetText}
  </div>
</body>
</html>`;

const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  res.end(html);
});

server.listen(5999, () => {
  console.log('Rendering target text with Google Chrome...');
  const screenshotPath = path.resolve('outputs/qa/test-ocr-raster.png');
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', [
    '--headless=new',
    '--disable-gpu',
    '--screenshot=' + screenshotPath,
    '--window-size=1200,300',
    'http://127.0.0.1:5999/'
  ]);

  chrome.on('exit', async (code) => {
    server.close();
    console.log('Screenshot exit code:', code, 'File exists:', fs.existsSync(screenshotPath));

    console.log('Starting real Tesseract OCR on raster image...');
    const worker = await createWorker(['tur', 'eng'], 1, {
      langPath: path.resolve('public/tesseract/lang-data'),
      cacheMethod: 'readOnly',
      gzip: true
    });

    const ret = await worker.recognize(screenshotPath);
    const recognized = ret.data.text.trim();
    console.log('\n--- TARGET TEXT ---');
    console.log(targetText);
    console.log('\n--- RECOGNIZED OCR TEXT ---');
    console.log(recognized);
    console.log('Confidence Score:', ret.data.confidence);

    await worker.terminate();
    process.exit(0);
  });
});

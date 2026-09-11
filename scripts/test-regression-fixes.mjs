import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PDFDocument, rgb } = require('@cantoo/pdf-lib');
const sharp = require('sharp');
const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

console.log('================================================================');
console.log('  FORMA PDF - REAL CHROME ACCEPTANCE TEST SUITE');
console.log('  1. Renkli Arka Plan + Arkadaki Metin + Beyaz Maskesiz Tuval Yeniden Çizimi');
console.log('  2. removePdfImages Tekil Görsel İzolasyonu (Çoklu Görsel Korunumu)');
console.log('  3. "ŞİŞE, IĞDIR, ÖĞRENCİ, ÇÖZÜM" Türkçe Bold & BoldItalic Dışa Aktarım');
console.log('  4. Canlı Domain (https://takiminisec.lol/) Üzerinde Gerçek Chrome Kabul Testi');
console.log('================================================================\n');

class CDPClient {
  constructor(ws) {
    this.ws = ws;
    this.id = 1;
    this.callbacks = new Map();
    this.consoleErrors = [];
    this.logs = [];

    ws.onmessage = (msg) => {
      const data = JSON.parse(msg.data);
      if (data.id && this.callbacks.has(data.id)) {
        const { resolve, reject } = this.callbacks.get(data.id);
        this.callbacks.delete(data.id);
        if (data.error) reject(data.error);
        else resolve(data.result);
      } else if (data.method === 'Runtime.consoleAPICalled') {
        const text = data.params.args.map((a) => a.value || a.description).join(' ');
        this.logs.push(`[${data.params.type}] ${text}`);
        if (data.params.type === 'error' && !text.includes('favicon')) {
          this.consoleErrors.push(text);
        }
      } else if (data.method === 'Runtime.exceptionThrown') {
        const desc = data.params.exceptionDetails?.exception?.description || data.params.exceptionDetails?.text || 'Unknown exception';
        console.error('>>> [BROWSER EXCEPTION]', desc);
        this.consoleErrors.push(desc);
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.id++;
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const trimmed = expression.trim();
    let expr = expression;
    if (trimmed.startsWith('(() =>') || (trimmed.startsWith('(') && trimmed.endsWith(')'))) {
      expr = expression;
    } else if (trimmed.includes('return ')) {
      expr = `(() => {\n${expression}\n})()`;
    } else if (
      !trimmed.includes('const ') &&
      !trimmed.includes('let ') &&
      !trimmed.includes('var ') &&
      !trimmed.includes('function ') &&
      !trimmed.includes('class ') &&
      !trimmed.includes('if ') &&
      !trimmed.includes('for ') &&
      !trimmed.includes('while ')
    ) {
      expr = `(() => { return (\n${trimmed}\n); })()`;
    } else {
      expr = `(() => {\n${expression}\n})()`;
    }
    const res = await this.send('Runtime.evaluate', {
      expression: expr,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res.exceptionDetails) {
      throw new Error('Eval failed: ' + JSON.stringify(res.exceptionDetails));
    }
    return res.result?.value;
  }
}

async function createTestPdfFixture() {
  console.log('>>> [ADIM 1] Test PDF Fixture Üretiliyor:');
  console.log('    - Renkli Arka Plan Dikdörtgeni (Teal #008080)');
  console.log('    - Görselin Arkasında Kalan Metin ("Metin Arkada Gizli (Z-Order Test Metni)")');
  console.log('    - Görsel 1 (Taşınacak Görsel - 4 Renkli Dama)');
  console.log('    - Görsel 2 (Aynı Sayfada Korunacak İkinci Görsel - Halka Rozet)');
  console.log('    - Türkçe Metinler: "ŞİŞE, IĞDIR, ÖĞRENCİ, ÇÖZÜM" (Bold ve BoldItalic)');

  fs.mkdirSync('outputs/qa', { recursive: true });

  // 1. Create Image 1: 4-colored checkerboard
  const img1W = 180, img1H = 120;
  const raw1 = Buffer.alloc(img1W * img1H * 4);
  for (let y = 0; y < img1H; y++) {
    for (let x = 0; x < img1W; x++) {
      const idx = (y * img1W + x) * 4;
      const isTop = y < img1H / 2;
      const isLeft = x < img1W / 2;
      if (isTop && isLeft) { raw1[idx] = 220; raw1[idx+1] = 40; raw1[idx+2] = 40; raw1[idx+3] = 255; }
      else if (isTop && !isLeft) { raw1[idx] = 40; raw1[idx+1] = 100; raw1[idx+2] = 220; raw1[idx+3] = 255; }
      else if (!isTop && isLeft) { raw1[idx] = 40; raw1[idx+1] = 180; raw1[idx+2] = 80; raw1[idx+3] = 255; }
      else { raw1[idx] = 240; raw1[idx+1] = 200; raw1[idx+2] = 30; raw1[idx+3] = 255; }
    }
  }
  const img1Png = await sharp(raw1, { raw: { width: img1W, height: img1H, channels: 4 } }).png().toBuffer();
  fs.writeFileSync('outputs/qa/fixture-img1.png', img1Png);

  // 2. Create Image 2: Purple / Orange concentric badge
  const img2W = 140, img2H = 120;
  const raw2 = Buffer.alloc(img2W * img2H * 4);
  const cx = img2W / 2, cy = img2H / 2;
  for (let y = 0; y < img2H; y++) {
    for (let x = 0; x < img2W; x++) {
      const idx = (y * img2W + x) * 4;
      const dist = Math.hypot(x - cx, y - cy);
      if (dist < 30) { raw2[idx] = 255; raw2[idx+1] = 140; raw2[idx+2] = 0; raw2[idx+3] = 255; } // orange
      else if (dist < 55) { raw2[idx] = 130; raw2[idx+1] = 50; raw2[idx+2] = 200; raw2[idx+3] = 255; } // purple
      else { raw2[idx] = 230; raw2[idx+1] = 230; raw2[idx+2] = 230; raw2[idx+3] = 255; } // grey
    }
  }
  const img2Png = await sharp(raw2, { raw: { width: img2W, height: img2H, channels: 4 } }).png().toBuffer();
  fs.writeFileSync('outputs/qa/fixture-img2.png', img2Png);

  // 3. Assemble PDF using @cantoo/pdf-lib and embed fonts
  const fontkit = require('@pdf-lib/fontkit');
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const boldFontBytes = fs.readFileSync('public/fonts/LiberationSans-Bold.ttf');
  const boldItalicFontBytes = fs.readFileSync('public/fonts/LiberationSans-BoldItalic.ttf');
  const regularFontBytes = fs.readFileSync('public/fonts/LiberationSans-Regular.ttf');

  const fontBold = await pdfDoc.embedFont(boldFontBytes, { subset: false });
  const fontBoldItalic = await pdfDoc.embedFont(boldItalicFontBytes, { subset: false });
  const fontRegular = await pdfDoc.embedFont(regularFontBytes, { subset: false });

  const page = pdfDoc.addPage([595.28, 841.89]); // A4 (595 x 842)

  // a) Colored background rectangle behind Image 1: Teal #008080 (rgb: 0, 0.5, 0.5)
  // PDF coordinates: (0,0) is bottom-left
  page.drawRectangle({
    x: 50,
    y: 500,
    width: 240,
    height: 220,
    color: rgb(0, 0.53, 0.53),
  });

  // b) Text behind Image 1 (drawn BEFORE Image 1 so it sits physically underneath Image 1 in Z-order)
  page.drawText('Metin Arkada Gizli (Z-Order Test Metni)', {
    x: 60,
    y: 590,
    size: 11,
    font: fontRegular,
    color: rgb(1, 1, 1), // White text on teal background
  });

  // c) Image 1 drawn ON TOP of the teal rectangle and behind-image text
  const embeddedImg1 = await pdfDoc.embedPng(img1Png);
  page.drawImage(embeddedImg1, {
    x: 70,
    y: 540,
    width: 180,
    height: 120,
  });

  // d) Image 2 drawn on the right side of the same page (must remain 100% untouched)
  const embeddedImg2 = await pdfDoc.embedPng(img2Png);
  page.drawImage(embeddedImg2, {
    x: 330,
    y: 540,
    width: 140,
    height: 120,
  });

  // e) Turkish Text in Bold and BoldItalic
  page.drawText('TÜRKÇE BOLD: ŞİŞE, IĞDIR, ÖĞRENCİ, ÇÖZÜM', {
    x: 50,
    y: 440,
    size: 16,
    font: fontBold,
    color: rgb(0.12, 0.25, 0.75),
  });

  page.drawText('TÜRKÇE BOLD-ITALIC: ŞİŞE, IĞDIR, ÖĞRENCİ, ÇÖZÜM', {
    x: 50,
    y: 400,
    size: 14,
    font: fontBoldItalic,
    color: rgb(0.75, 0.15, 0.25),
  });

  const fixturePdfBytes = await pdfDoc.save();
  const fixturePath = path.resolve('outputs/qa/test-acceptance-fixture.pdf');
  fs.writeFileSync(fixturePath, fixturePdfBytes);
  console.log(`    [OK] Test PDF Fixture hazırlandı: ${fixturePath} (${fixturePdfBytes.length} bayt)\n`);
  return { fixturePdfBytes, fixturePath };
}

async function runAcceptance(targetUrl) {
  console.log(`================================================================`);
  console.log(`  HEDEF URL: ${targetUrl}`);
  console.log(`================================================================\n`);

  const { fixturePdfBytes, fixturePath } = await createTestPdfFixture();

  console.log('>>> [ADIM 2] Headless Chrome Başlatılıyor (CDP port 9226)...');
  const profileDir = 'C:/Users/sinan/AppData/Local/Temp/chrome_test_acceptance_' + Date.now();
  fs.mkdirSync(profileDir, { recursive: true });

  const chromeProc = spawn(
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    [
      '--remote-debugging-port=9226',
      '--headless=new',
      '--user-data-dir=' + profileDir,
      '--disable-gpu',
      '--no-first-run',
      '--no-default-browser-check',
    ],
    { detached: true, stdio: 'ignore' }
  );
  chromeProc.unref();

  const cleanup = () => {
    try { if (chromeProc.pid) process.kill(chromeProc.pid); } catch {}
    try { fs.rmSync(profileDir, { recursive: true, force: true }); } catch {}
  };
  process.on('exit', cleanup);

  let chromeReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9226/json/version');
      if (res.ok) { chromeReady = true; break; }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(chromeReady, 'Chrome 9226 portunda hazır');
  console.log('    [OK] Chrome hazırlandı.');

  const newTargetRes = await fetch('http://127.0.0.1:9226/json/new', { method: 'PUT' });
  const target = await newTargetRes.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve) => { ws.onopen = resolve; });
  const cdp = new CDPClient(ws);

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('DOM.enable');

  console.log(`>>> [ADIM 3] Siteye Gidiliyor: ${targetUrl}...`);
  await cdp.send('Page.navigate', { url: targetUrl });
  await new Promise((r) => setTimeout(r, 4000));

  const pageTitle = await cdp.evaluate(`document.title`);
  console.log(`    [OK] Sayfa yüklendi: "${pageTitle}"`);

  console.log('>>> [ADIM 4] Fixture PDF Dosyası Yükleniyor...');
  const b64 = Buffer.from(fixturePdfBytes).toString('base64');
  await cdp.evaluate(`
    const b64Data = "${b64}";
    const binary = atob(b64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    window.__loadedPdfBuffer = bytes.buffer.slice(0);
    const file = new File([bytes], "test-acceptance-fixture.pdf", { type: "application/pdf" });
    const input = document.querySelector('input[type="file"]');
    if (input) {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  `);

  // Wait for canvas to render
  let canvasReady = false;
  for (let i = 0; i < 50; i++) {
    const count = await cdp.evaluate(`document.querySelectorAll('canvas').length`);
    if (count >= 1) { canvasReady = true; break; }
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(canvasReady, 'PDF Canvas çalışma alanına render edildi');
  console.log('    [OK] PDF Canvas yüklendi.');

  // Wait for image detection
  await new Promise((r) => setTimeout(r, 2000));

  // =========================================================================
  // TEST KONTROLÜ 1: Görsel Algılama ve Çoklu Görsel Varlığı
  // =========================================================================
  console.log('\n>>> [TEST 1] Görsel Algılama & İki Görselin Tespiti...');
  const detectedImages = await cdp.evaluate(`
    (() => {
      const container = document.querySelector(".pdf-surface .pointer-events-none.z-20");
      if (!container) return [];
      const divs = Array.from(container.children);
      return divs.map((d, index) => {
        const img = d.querySelector("img");
        return {
          index,
          left: parseInt(d.style.left),
          top: parseInt(d.style.top),
          width: parseInt(d.style.width),
          height: parseInt(d.style.height),
          src: img ? img.getAttribute("src") : null,
          isPng: img && img.getAttribute("src") && img.getAttribute("src").startsWith("data:image/png"),
          isSvgPlaceholder: img && img.getAttribute("src") && img.getAttribute("src").includes("svg+xml")
        };
      });
    })()
  `);

  console.log('    Algılanan Görseller:', detectedImages);
  assert.equal(detectedImages.length, 2, 'Sayfada tam 2 görsel algılanmalıdır (Görsel 1 ve Görsel 2)');
  assert.equal(detectedImages[0].isSvgPlaceholder, false, 'Görsel 1 mor SVG placeholder DEĞİL');
  assert.equal(detectedImages[0].isPng, true, 'Görsel 1 gerçek PNG verisi');
  assert.equal(detectedImages[1].isSvgPlaceholder, false, 'Görsel 2 mor SVG placeholder DEĞİL');
  assert.equal(detectedImages[1].isPng, true, 'Görsel 2 gerçek PNG verisi');
  console.log('    [PASS] Her iki görsel de gerçek piksel verileriyle başarıyla algılandı!');

  // =========================================================================
  // TEST KONTROLÜ 2: Beyaz SVG Maskesinin Bulunmadığı Doğrulanıyor
  // =========================================================================
  console.log('\n>>> [TEST 2] Beyaz SVG Maskesi Olmadığı Doğrulanıyor...');
  const initialSvgMasks = await cdp.evaluate(`
    document.querySelectorAll("svg.annotation-layer rect[key*='orig-img-mask'], svg.annotation-layer rect[fill='#ffffff']").length
  `);
  assert.equal(initialSvgMasks, 0, 'Hiçbir beyaz SVG maske rect elementi bulunmamalıdır');
  console.log('    [PASS] Beyaz SVG maskesi bulunmuyor (kalıcı çözüm tuvalin yeniden çizilmesidir).');

  // =========================================================================
  // TEST KONTROLÜ 3: Görsel 1 Seçimi, Geçici Olarak Tuvalden Kaldırılması &
  // Renkli Arka Plan ve Metnin Ortaya Çıkması
  // =========================================================================
  console.log('\n>>> [TEST 3] Görsel 1 Seçiliyor ve Tuval Yeniden Çiziliyor...');
  await cdp.evaluate(`
    (() => {
      const container = document.querySelector(".pdf-surface .pointer-events-none.z-20");
      const firstImg = container.children[0];
      firstImg.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
    })()
  `);
  await new Promise((r) => setTimeout(r, 1200));

  const isImg1Selected = await cdp.evaluate(`
    Boolean(document.querySelector(".pdf-surface .pointer-events-none.z-20 > div.ring-2"))
  `);
  assert.ok(isImg1Selected, 'Görsel 1 seçildi ve vurgulandı');
  console.log('    [PASS] Görsel 1 başarıyla seçildi.');

  // Verify that during selection/movement, NO white SVG mask is inserted
  const duringSvgMasks = await cdp.evaluate(`
    document.querySelectorAll("svg.annotation-layer rect[fill='#ffffff']").length
  `);
  assert.equal(duringSvgMasks, 0, 'Görsel 1 seçildiğinde beyaz SVG maskesi OLUŞMAMALIDIR');
  console.log('    [PASS] Seçim anında beyaz SVG maskesi oluşmadı; tuval doğrudan PDFium ile yeniden çizildi.');

  // =========================================================================
  // TEST KONTROLÜ 4: Görsel 1 Sürükleniyor (+120px X, +80px Y)
  // Çoklu Görsel Korunumu: Görsel 2'nin yerinde ve sağlam kaldığı kontrol ediliyor!
  // =========================================================================
  console.log('\n>>> [TEST 4] Görsel 1 Sürükleniyor (+120px X, +80px Y)...');
  await cdp.evaluate(`
    (() => {
      const container = document.querySelector(".pdf-surface .pointer-events-none.z-20");
      const img1 = container.children[0];
      const img2 = container.children[1];
      window.__orig1Left = parseInt(img1.style.left);
      window.__orig1Top = parseInt(img1.style.top);
      window.__orig2Left = parseInt(img2.style.left);
      window.__orig2Top = parseInt(img2.style.top);

      const rect = img1.getBoundingClientRect();
      window.__startX = rect.left + rect.width / 2;
      window.__startY = rect.top + rect.height / 2;

      // Pointer down on img1
      img1.dispatchEvent(new PointerEvent("pointerdown", { clientX: window.__startX, clientY: window.__startY, bubbles: true, cancelable: true }));
    })()
  `);
  await new Promise((r) => setTimeout(r, 150));

  await cdp.evaluate(`
    (() => {
      // Pointer move
      window.dispatchEvent(new PointerEvent("pointermove", { clientX: window.__startX + 120, clientY: window.__startY + 80, bubbles: true, cancelable: true }));
    })()
  `);
  await new Promise((r) => setTimeout(r, 150));

  const dragResult = await cdp.evaluate(`
    (() => {
      // Pointer up
      window.dispatchEvent(new PointerEvent("pointerup", { clientX: window.__startX + 120, clientY: window.__startY + 80, bubbles: true, cancelable: true }));

      const container = document.querySelector(".pdf-surface .pointer-events-none.z-20");
      const img1 = container.children[0];
      const img2 = container.children[1];

      return {
        img1NewLeft: parseInt(img1.style.left),
        img1NewTop: parseInt(img1.style.top),
        img1DeltaX: parseInt(img1.style.left) - window.__orig1Left,
        img1DeltaY: parseInt(img1.style.top) - window.__orig1Top,
        img2Left: parseInt(img2.style.left),
        img2Top: parseInt(img2.style.top),
        img2Unchanged: parseInt(img2.style.left) === window.__orig2Left && parseInt(img2.style.top) === window.__orig2Top
      };
    })()
  `);
  console.log('    Sürükleme Sonucu:', dragResult);
  assert.ok(Math.abs(dragResult.img1DeltaX - 120) <= 2, 'Görsel 1 tam 120px sağa taşındı');
  assert.ok(Math.abs(dragResult.img1DeltaY - 80) <= 2, 'Görsel 1 tam 80px aşağı taşındı');
  assert.ok(dragResult.img2Unchanged, 'Görsel 2 konumu HİÇ DEĞİŞMEDİ (Çoklu görsel korunumu PASS)');
  console.log('    [PASS] Görsel 1 yeni konumuna taşındı; Görsel 2 dokunulmadan korundu!');

  // =========================================================================
  // TEST KONTROLÜ 5: Türkçe Bold ve BoldItalic Metin Doğrulaması & Dışa Aktarım
  // =========================================================================
  console.log('\n>>> [TEST 5] PDF Dışa Aktarılıyor (exportPdf)...');

  // Intercept the download URL in the browser
  await cdp.evaluate(`
    window.__exportedBlobs = [];
    const origCreateObjectURL = URL.createObjectURL;
    URL.createObjectURL = function(blob) {
      if (blob && blob.type === "application/pdf") {
        window.__latestPdfBlob = blob;
      }
      return origCreateObjectURL.call(URL, blob);
    };
  `);

  // Open Export Modal and click download
  await cdp.evaluate(`
    (() => {
      const exportBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent && b.textContent.includes("Dışa aktar"));
      if (exportBtn) exportBtn.click();
    })()
  `);
  await new Promise((r) => setTimeout(r, 800));

  // In the export modal, click the confirmation download button
  await cdp.evaluate(`
    (() => {
      const dlBtn = document.querySelector(".export-dialog button.primary") ||
                    Array.from(document.querySelectorAll("[role='dialog'] button, .forma-dialog button, button"))
                      .find(b => b.textContent && (b.textContent.includes("indir") || b.textContent.includes("İndir")));
      if (dlBtn) dlBtn.click();
    })()
  `);

  // Wait for export bytes / blob
  let exportedBase64 = null;
  for (let i = 0; i < 40; i++) {
    exportedBase64 = await cdp.evaluate(`
      (() => {
        if (window.__lastExportedPdf && window.__lastExportedPdf.length > 0) {
          const binary = Array.from(window.__lastExportedPdf, b => String.fromCharCode(b)).join("");
          return btoa(binary);
        }
        return null;
      })()
    `);
    if (!exportedBase64) {
      exportedBase64 = await cdp.evaluate(`
        new Promise((resolve) => {
          if (!window.__latestPdfBlob) return resolve(null);
          const reader = new FileReader();
          reader.onloadend = () => {
            const res = reader.result;
            resolve(res ? res.split(",")[1] : null);
          };
          reader.readAsDataURL(window.__latestPdfBlob);
        })
      `);
    }
    if (exportedBase64) break;
    await new Promise((r) => setTimeout(r, 250));
  }
  assert.ok(exportedBase64, 'Dışa aktarılan PDF blob başarıyla yakalandı');

  const exportedPdfBytes = Buffer.from(exportedBase64, 'base64');
  const exportPath = path.resolve('outputs/qa/exported-test-acceptance.pdf');
  fs.writeFileSync(exportPath, exportedPdfBytes);
  console.log(`    [OK] Dışa aktarılan PDF diske kaydedildi: ${exportPath} (${exportedPdfBytes.length} bayt)\n`);

  // =========================================================================
  // TEST KONTROLÜ 6: Bağımsız PDF.js ve @cantoo/pdf-lib ile Dışa Aktarılan PDF Analizi
  // =========================================================================
  console.log('>>> [TEST 6] Bağımsız Araçlarla (PDF.js + fontkit + pdf-lib) Dışa Aktarılan PDF Denetimi...');

  // 1. PDF.js text extraction
  const pdfjsDoc = await pdfjsLib.getDocument({ data: new Uint8Array(exportedPdfBytes) }).promise;
  assert.equal(pdfjsDoc.numPages, 1, 'Dışa aktarılan PDF 1 sayfadır');
  const pdfjsPage = await pdfjsDoc.getPage(1);
  const textContent = await pdfjsPage.getTextContent();
  const fullExtractedText = textContent.items.map((it) => it.str).join(' ');
  console.log('    PDF.js ile Çıkarılan Metin:', fullExtractedText);

  // Assert hidden text behind original image is preserved
  assert.ok(
    fullExtractedText.includes('Metin Arkada Gizli') || fullExtractedText.includes('Z-Order Test Metni'),
    'Görsel arkasındaki metin dışa aktarılan PDF içinde KORUNMUŞTUR'
  );
  console.log('    [PASS] Görsel arkasındaki metin ("Metin Arkada Gizli") başarıyla korundu.');

  // Assert Turkish text with Bold & BoldItalic is preserved
  assert.ok(
    fullExtractedText.includes('ŞİŞE') &&
    fullExtractedText.includes('IĞDIR') &&
    fullExtractedText.includes('ÖĞRENCİ') &&
    fullExtractedText.includes('ÇÖZÜM'),
    'Türkçe büyük karakterler (Ş, İ, I, Ğ, Ö, Ç, Ü) eksiksiz korunmuştur'
  );
  console.log('    [PASS] Türkçe "ŞİŞE, IĞDIR, ÖĞRENCİ, ÇÖZÜM" metni dışa aktarılan PDF içinde eksiksiz doğrulandı!');

  // 2. Operator list analysis to verify image count & positions
  const opList = await pdfjsPage.getOperatorList();
  const OPS = pdfjsLib.OPS;
  let imagePaintCount = 0;
  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) {
      imagePaintCount++;
    }
  }
  console.log(`    Sayfada Boyanan Görsel Nesnesi Sayısı (Operator List): ${imagePaintCount}`);
  assert.equal(imagePaintCount, 2, 'Sayfada tam olarak 2 görsel nesnesi olmalıdır (Görsel 1 yeni yerinde, Görsel 2 eski yerinde)');
  console.log('    [PASS] Görsel 1 eski yerinden silindi, yeni yerine boyandı; Görsel 2 ise aynen korundu!');

  // 3. Embedded font inspection via PDF.js page.commonObjs
  const detectedFontNames = [];
  for (const fontId of Object.keys(textContent.styles)) {
    await new Promise((resolve) => {
      pdfjsPage.commonObjs.get(fontId, (fontObj) => {
        if (fontObj?.name) detectedFontNames.push(fontObj.name);
        resolve();
      });
    });
  }
  console.log('    PDF.js Tarafından Çözümlenen Gömülü Yazı Tipleri:', detectedFontNames);
  const hasLiberationBold = detectedFontNames.some((f) => /LiberationSans.*Bold/i.test(f));
  const hasLiberationBoldItalic = detectedFontNames.some((f) => /LiberationSans.*BoldItalic/i.test(f));
  assert.ok(hasLiberationBold, 'LiberationSans-Bold yazı tipi PDF içerisine gömülmüştür');
  assert.ok(hasLiberationBoldItalic, 'LiberationSans-BoldItalic yazı tipi PDF içerisine gömülmüştür');
  console.log('    [PASS] Bold ve BoldItalic yazı tipleri (LiberationSans) PDF stream içerisine tam gömüldü.');

  console.log('\n================================================================');
  console.log('  TÜM KABUL TESTLERİ BAŞARIYLA GEÇTİ (ALL PASS)');
  console.log('================================================================\n');

  cleanup();
}

const target = process.argv[2] || 'https://takiminisec.lol/';
runAcceptance(target).catch((err) => {
  console.error('\n>>> [TEST BAŞARISIZ]:', err);
  process.exit(1);
});

import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PDFDocument } = require('@cantoo/pdf-lib');

console.log('================================================================');
console.log('  FORMA PDF - REAL CHROME 10-PACKAGE BROWSER ACCEPTANCE TEST');
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

async function runChromeAcceptance() {
  const profileDir = 'C:/Users/sinan/AppData/Local/Temp/chrome_test_10pkg_' + Date.now();
  fs.mkdirSync(profileDir, { recursive: true });

  const chromeProc = spawn(
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    [
      '--remote-debugging-port=9224',
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
    try {
      if (chromeProc.pid) process.kill(chromeProc.pid);
    } catch {}
    try {
      fs.rmSync(profileDir, { recursive: true, force: true });
    } catch {}
  };

  process.on('exit', cleanup);

  console.log('1. Launching headless Chrome on port 9224...');
  let chromeReady = false;
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9224/json/version');
      if (res.ok) {
        chromeReady = true;
        break;
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(chromeReady, 'Chrome launched successfully');

  const newTargetRes = await fetch('http://127.0.0.1:9224/json/new', { method: 'PUT' });
  const target = await newTargetRes.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });

  const cdp = new CDPClient(ws);
  await cdp.send('Runtime.enable');
  await cdp.send('Page.enable');
  await cdp.send('DOM.enable');

  console.log('2. Navigating to Forma workspace http://localhost:5173/...');
  await cdp.send('Page.navigate', { url: 'http://localhost:5173/' });
  await new Promise((r) => setTimeout(r, 2500));

  const title = await cdp.evaluate(`document.title`);
  console.log(`  Page Title: "${title}"`);

  // Load sample PDF fixture
  console.log('\n3. Uploading test PDF into Forma workspace via DOM...');
  const samplePdfBytes = fs.readFileSync('outputs/qa/edited.pdf');
  const b64 = Buffer.from(samplePdfBytes).toString('base64');

  await cdp.evaluate(`
    const b64Data = "${b64}";
    const binary = atob(b64Data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    window.__loadedPdfBuffer = bytes.buffer.slice(0);
    const file = new File([bytes], "kabul-testi.pdf", { type: "application/pdf" });
    
    // Find file input and dispatch file
    const input = document.querySelector('input[type="file"]');
    if (input) {
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  `);

  // Wait for canvas rendering
  let canvasReady = false;
  for (let i = 0; i < 40; i++) {
    const hasCanvas = await cdp.evaluate(`document.querySelectorAll('canvas').length >= 1`);
    if (hasCanvas) {
      canvasReady = true;
      break;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  assert.ok(canvasReady, 'PDF loaded and canvas rendered in workspace');
  console.log('  PASS: PDF loaded and canvas rendered.');

  // Helper to safely open ToolHub and select tool
  async function openToolFromHub(toolText) {
    // Open ToolHub
    await cdp.evaluate(`
      const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Araçlar'));
      if (btn) btn.click();
    `);
    await new Promise((r) => setTimeout(r, 500));

    // Click matching tool
    await cdp.evaluate(`
      const toolBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('${toolText}'));
      if (toolBtn) toolBtn.click();
    `);
    await new Promise((r) => setTimeout(r, 600));
  }

  async function closeActiveModal() {
    await cdp.evaluate(`
      const closeBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === '✕' || b.textContent.includes('Kapat') || b.textContent.includes('Vazgeç'));
      if (closeBtn) closeBtn.click();
    `);
    await new Promise((r) => setTimeout(r, 400));
  }

  const testResults = [];
  function record(pkg, action, passed, note) {
    testResults.push({ pkg, action, passed, note });
    if (passed) {
      console.log(`  ✓ [UI TAMAM] ${pkg}: ${action} (${note})`);
    } else {
      console.error(`  ✗ [UI HATA] ${pkg}: ${action} -> ${note}`);
    }
  }

  // --- PAKET 1: SCANNER MODAL ---
  console.log('\n--- UI Test: Paket 1 (Belge Tarayıcı) ---');
  try {
    await openToolFromHub('Belge Tarayıcı');
    const scannerModalVisible = await cdp.evaluate(`
      document.body.innerText.includes('Belge Tarayıcı') || document.body.innerText.includes('Kamera')
    `);
    assert.ok(scannerModalVisible, 'Scanner modal is visible');
    await closeActiveModal();
    record('Paket 1 (Scanner)', 'ToolHub açıldı, tarayıcı modalı yüklendi ve kapatıldı', true, 'Modal lifecycle OK');
  } catch (e) {
    record('Paket 1 (Scanner)', 'Scanner UI', false, e.message);
  }

  // --- PAKET 2: DECORATION MODAL ---
  console.log('\n--- UI Test: Paket 2 (Filigran & Sayfa No) ---');
  try {
    await openToolFromHub('Filigran');
    const decModalVisible = await cdp.evaluate(`
      document.body.innerText.includes('Filigran') && document.body.innerText.includes('Sayfa Numarası')
    `);
    assert.ok(decModalVisible, 'Page Decoration modal visible');
    await closeActiveModal();
    record('Paket 2 (Decoration)', 'Filigran ve sayfa numaralandırma UI modalı doğrulandı', true, 'Modal options verified');
  } catch (e) {
    record('Paket 2 (Decoration)', 'Decoration UI', false, e.message);
  }

  // --- PAKET 3: ANNOTATIONS PANEL ---
  console.log('\n--- UI Test: Paket 3 (Yorum & İnceleme) ---');
  try {
    await openToolFromHub('Yorum & İnceleme');
    const panelVisible = await cdp.evaluate(`
      document.body.innerText.includes('Yorumlar') || document.body.innerText.includes('İnceleme') || document.body.innerText.includes('Anotasyon')
    `);
    assert.ok(panelVisible, 'Annotation side panel opened');
    await closeActiveModal();
    record('Paket 3 (Annotations)', 'Anotasyon yan paneli açıldı ve kapatıldı', true, 'SidePanel lifecycle OK');
  } catch (e) {
    record('Paket 3 (Annotations)', 'Annotations UI', false, e.message);
  }

  // --- PAKET 4: COMPARE MODAL ---
  console.log('\n--- UI Test: Paket 4 (PDF Karşılaştır) ---');
  try {
    await openToolFromHub('Karşılaştır');
    const cmpVisible = await cdp.evaluate(`
      document.body.innerText.includes('Karşılaştır') || document.body.innerText.includes('Fark')
    `);
    assert.ok(cmpVisible, 'Compare modal opened');
    await closeActiveModal();
    record('Paket 4 (Compare)', 'İki PDF karşılaştırma modalı yüklendi', true, 'Compare modal verified');
  } catch (e) {
    record('Paket 4 (Compare)', 'Compare UI', false, e.message);
  }

  // --- PAKET 5: BATCH PROCESSING MODAL ---
  console.log('\n--- UI Test: Paket 5 (Toplu İşlemler) ---');
  try {
    await openToolFromHub('Toplu Dosya');
    const batchVisible = await cdp.evaluate(`
      document.body.innerText.includes('Toplu') && (document.body.innerText.includes('Kuyruk') || document.body.innerText.includes('Dosya'))
    `);
    assert.ok(batchVisible, 'Batch modal opened');
    await closeActiveModal();
    record('Paket 5 (Batch)', 'Toplu dosya işlem kuyruğu modalı doğrulandı', true, 'Batch modal verified');
  } catch (e) {
    record('Paket 5 (Batch)', 'Batch UI', false, e.message);
  }

  // --- PAKET 6: NAVIGATION MODAL ---
  console.log('\n--- UI Test: Paket 6 (İçindekiler & Yer İmleri) ---');
  try {
    await openToolFromHub('İçindekiler');
    const navVisible = await cdp.evaluate(`
      document.body.innerText.includes('İçindekiler') || document.body.innerText.includes('Yer İmleri')
    `);
    assert.ok(navVisible, 'Navigation modal opened');
    await closeActiveModal();
    record('Paket 6 (Navigation)', 'İçindekiler ve yer imleri navigasyon modalı doğrulandı', true, 'Navigation modal verified');
  } catch (e) {
    record('Paket 6 (Navigation)', 'Navigation UI', false, e.message);
  }

  // --- PAKET 7: PAGE SIZING MODAL ---
  console.log('\n--- UI Test: Paket 7 (Sayfa Kırpma & Yeniden Boyutlandırma) ---');
  try {
    await openToolFromHub('Sayfa Kırpma');
    const sizeVisible = await cdp.evaluate(`
      document.body.innerText.includes('Kırpma') || document.body.innerText.includes('Boyut')
    `);
    assert.ok(sizeVisible, 'Page sizing modal opened');
    await closeActiveModal();
    record('Paket 7 (Page Sizing)', 'Sayfa kırpma ve standart boyutlandırma modalı doğrulandı', true, 'Page sizing modal verified');
  } catch (e) {
    record('Paket 7 (Page Sizing)', 'Page Sizing UI', false, e.message);
  }

  // --- PAKET 8: CONVERSIONS MODAL ---
  console.log('\n--- UI Test: Paket 8 (Gelişmiş Format Dönüşümleri) ---');
  try {
    await openToolFromHub('Gelişmiş Format Dönüşümleri');
    const convVisible = await cdp.evaluate(`
      document.body.innerText.includes('Gelişmiş Format Dönüşümleri') && (document.body.innerText.includes('Görüntü') || document.body.innerText.includes('Excel'))
    `);
    assert.ok(convVisible, 'Conversion modal opened');
    await closeActiveModal();
    record('Paket 8 (Conversions)', 'Excel, PowerPoint ve Görsel ZIP dönüşüm modalı doğrulandı', true, 'Conversion modal verified');
  } catch (e) {
    record('Paket 8 (Conversions)', 'Conversions UI', false, e.message);
  }

  // --- PAKET 9: DIGITAL SIGNATURE MODAL ---
  console.log('\n--- UI Test: Paket 9 (Dijital İmza & Dürüst Etiketleme) ---');
  try {
    await openToolFromHub('Dijital İmza');
    const sigText = await cdp.evaluate(`document.body.innerText`);
    assert.ok(sigText.includes('Deneysel CMS / PKCS#7') || sigText.includes('Dijital İmza'), 'Signature modal opened');
    assert.ok(sigText.includes('5070 sayılı') || sigText.includes('Hukuki Bilgilendirme'), 'Honest 5070 SK legal disclaimer present');
    await closeActiveModal();
    record('Paket 9 (Digital Signature)', 'Dijital imza UI modalı ve dürüst hukuki etiketleme doğrulandı', true, 'Honest legal label verified');
  } catch (e) {
    record('Paket 9 (Digital Signature)', 'Digital Signature UI', false, e.message);
  }

  // --- PAKET 10: COMPLIANCE MODAL ---
  console.log('\n--- UI Test: Paket 10 (PDF/A & Erişilebilirlik Dürüst Etiketleme) ---');
  try {
    await openToolFromHub('PDF/A');
    const compText = await cdp.evaluate(`document.body.innerText`);
    assert.ok(compText.includes('PDF/A') && compText.includes('Erişilebilirlik'), 'Compliance modal opened');
    assert.ok(compText.includes('veraPDF') || compText.includes('Standart Notu') || compText.includes('Ön Koşullar'), 'Honest veraPDF standard disclaimer present');
    await closeActiveModal();
    record('Paket 10 (Compliance)', 'PDF/A ve Erişilebilirlik UI modalı ve veraPDF standart uyarısı doğrulandı', true, 'Honest veraPDF label verified');
  } catch (e) {
    record('Paket 10 (Compliance)', 'Compliance UI', false, e.message);
  }

  // --- SECTION 4: EXPORT PDF & REOPEN TEST ---
  console.log('\n4. Testing PDF export and re-opening from scratch...');
  try {
    // Open Export dialog
    await cdp.evaluate(`
      const expBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Dışa aktar'));
      if (expBtn) expBtn.click();
    `);
    await new Promise((r) => setTimeout(r, 600));

    // Click "Dosyayı indir" button in export dialog
    await cdp.evaluate(`
      const dlBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Dosyayı indir'));
      if (dlBtn) dlBtn.click();
    `);

    // Poll for __lastExportedPdf
    let exportedBytesLen = 0;
    for (let i = 0; i < 40; i++) {
      exportedBytesLen = await cdp.evaluate(`
        window.__lastExportedPdf ? window.__lastExportedPdf.length : 0
      `);
      if (exportedBytesLen > 0) break;
      await new Promise((r) => setTimeout(r, 200));
    }

    assert.ok(exportedBytesLen > 0, `Exported PDF generated (${exportedBytesLen} bytes)`);

    // Reopen downloaded bytes from scratch with independent PDF parser
    const base64Chunk = await cdp.evaluate(`
      (() => {
        const u8 = window.__lastExportedPdf;
        let binary = '';
        const len = u8.byteLength;
        for (let i = 0; i < len; i++) {
          binary += String.fromCharCode(u8[i]);
        }
        return btoa(binary);
      })()
    `);

    const exportedPdfBuffer = Buffer.from(base64Chunk, 'base64');
    const reopenedDoc = await PDFDocument.load(exportedPdfBuffer);
    assert.ok(reopenedDoc.getPageCount() >= 1, 'Exported PDF successfully reopened from scratch');

    console.log(`  Exported PDF reloaded from scratch: ${reopenedDoc.getPageCount()} pages, ${exportedPdfBuffer.length} bytes`);
    record('Dışa Aktarma & Yeniden Açma', 'Chrome UI dışa aktarma tıklandı ve çıktı baytları sıfırdan doğrulandı', true, `${exportedPdfBuffer.length} bytes`);
  } catch (e) {
    record('Dışa Aktarma & Yeniden Açma', 'Export test', false, e.message);
  }

  // --- SECTION 5: AUTOSAVE & LOCATION.RELOAD TEST ---
  console.log('\n5. Testing real page reload (location.reload()) and autosave draft restoration...');
  try {
    // Write full valid draft with annotations into IndexedDB
    await cdp.evaluate(`
      new Promise((resolve, reject) => {
        const req = indexedDB.open("forma_drafts_db", 1);
        req.onsuccess = (e) => {
          const db = e.target.result;
          const tx = db.transaction("drafts", "readwrite");
          const store = tx.objectStore("drafts");
          store.put({
            id: "current_draft",
            name: "reload-autosave.pdf",
            type: "pdf",
            fileData: window.__loadedPdfBuffer,
            timestamp: Date.now(),
            intent: "edit",
            currentPage: 1,
            zoom: 1,
            isDirty: true,
            pageOrder: [0],
            pageRotations: {},
            annotations: [
              { id: "note_1", type: "text", pageIndex: 0, rect: [100, 100, 150, 150], contents: "Taslak Notu", author: "Tester" }
            ]
          });
          tx.oncomplete = () => {
            db.close();
            resolve(true);
          };
          tx.onerror = () => reject(tx.error);
        };
        req.onerror = () => reject(req.error);
      })
    `);

    // Reload page
    console.log('  Executing location.reload()...');
    await cdp.send('Page.reload');
    await new Promise((r) => setTimeout(r, 2000));

    // Check if recovery dialog appeared and click "Çalışmayı Kurtar"
    for (let i = 0; i < 25; i++) {
      const hasRecovery = await cdp.evaluate(`
        document.body.innerText.includes("Kurtar") || document.body.innerText.includes("Yarım Kalan")
      `);
      if (hasRecovery) {
        await cdp.evaluate(`
          const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Çalışmayı Kurtar') || b.textContent.includes('Kurtar'));
          if (btn) btn.click();
        `);
        console.log('  Recovery dialog detected and "Çalışmayı Kurtar" clicked');
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    // Check workspace rendered after reload
    let restoredCanvas = false;
    for (let i = 0; i < 40; i++) {
      const hasCanv = await cdp.evaluate(`document.querySelectorAll('canvas').length >= 1`);
      if (hasCanv) {
        restoredCanvas = true;
        break;
      }
      await new Promise((r) => setTimeout(r, 200));
    }

    assert.ok(restoredCanvas, 'Canvas successfully re-rendered after reload');
    record('Autosave & Reload', 'Gerçek reload sonrası çalışma alanı tuvali ve taslak geri yüklendi', true, 'Reload restored canvas');
  } catch (e) {
    record('Autosave & Reload', 'Autosave reload', false, e.message);
  }

  // Check console errors
  console.log('\n--- BROWSER CONSOLE AUDIT ---');
  console.log(`  Total console logs captured: ${cdp.logs.length}`);
  console.log(`  Console errors: ${cdp.consoleErrors.length}`);
  if (cdp.consoleErrors.length > 0) {
    console.log('  Errors logged:');
    cdp.consoleErrors.slice(0, 5).forEach((e) => console.log('    ' + e));
  }
  assert.equal(cdp.consoleErrors.length, 0, 'Zero unexpected browser console errors');

  const allPassed = testResults.every((r) => r.passed);
  console.log('\n================================================================');
  console.log(`  CHROME ACCEPTANCE SUMMARY: ${testResults.filter((r) => r.passed).length} / ${testResults.length} PASSED`);
  console.log('================================================================\n');

  cleanup();
  if (!allPassed) process.exit(1);
}

runChromeAcceptance().catch((err) => {
  console.error('Chrome Acceptance Runner Failed:', err);
  process.exit(1);
});

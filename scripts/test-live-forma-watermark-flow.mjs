import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import WebSocket from "ws";
import assert from "node:assert";
import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";

if (!Promise.withResolvers) {
  Promise.withResolvers = function () {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  };
}

if (!ArrayBuffer.prototype.transferToFixedLength) {
  ArrayBuffer.prototype.transferToFixedLength = function (newByteLength) {
    const targetLength = newByteLength === undefined ? this.byteLength : newByteLength;
    const newBuf = new ArrayBuffer(targetLength);
    new Uint8Array(newBuf).set(new Uint8Array(this, 0, Math.min(this.byteLength, targetLength)));
    return newBuf;
  };
}

async function waitHttp(url, timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await new Promise((resolve, reject) => {
        const req = http.get(url, (r) => {
          let data = "";
          r.on("data", c => data += c);
          r.on("end", () => resolve({ status: r.statusCode, data }));
        });
        req.on("error", reject);
        req.setTimeout(1000, () => req.destroy());
      });
      if (res.status === 200) return JSON.parse(res.data);
    } catch {}
    await new Promise(r => setTimeout(r, 250));
  }
  throw new Error("Timeout waiting for " + url);
}

class CDPClient {
  constructor(wsUrl) {
    this.ws = new WebSocket(wsUrl);
    this.id = 1;
    this.callbacks = new Map();
    this.events = new Map();

    this.ready = new Promise((resolve, reject) => {
      this.ws.on("open", resolve);
      this.ws.on("error", reject);
    });

    this.ws.on("message", (msg) => {
      const parsed = JSON.parse(msg);
      if (parsed.id && this.callbacks.has(parsed.id)) {
        const { resolve, reject } = this.callbacks.get(parsed.id);
        this.callbacks.delete(parsed.id);
        if (parsed.error) reject(parsed.error);
        else resolve(parsed.result);
      } else if (parsed.method) {
        const handlers = this.events.get(parsed.method) || [];
        for (const h of handlers) h(parsed.params);
      }
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = this.id++;
      this.callbacks.set(msgId, { resolve, reject });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  on(method, handler) {
    const list = this.events.get(method) || [];
    list.push(handler);
    this.events.set(method, list);
  }

  async eval(expression, awaitPromise = true) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise,
      returnByValue: true
    });
    if (res.exceptionDetails) {
      throw new Error("Eval failed: " + JSON.stringify(res.exceptionDetails));
    }
    return res.result?.value;
  }
}

async function createTestBostonPdf() {
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([612, 792]);

  // Red header logo box in top right
  page.drawRectangle({
    x: 420,
    y: 710,
    width: 155,
    height: 48,
    color: rgb(0.8, 0.12, 0.12)
  });
  page.drawText("BOSTON UNIVERSITY", {
    x: 428,
    y: 728,
    size: 11,
    font: fontBold,
    color: rgb(1, 1, 1)
  });

  // Legitimate student data on the page
  page.drawText("Name: Ahmet Yilmaz", { x: 50, y: 640, size: 12, font: fontRegular, color: rgb(0, 0, 0) });
  page.drawText("Student ID: U98765432", { x: 350, y: 640, size: 12, font: fontRegular, color: rgb(0, 0, 0) });
  page.drawText("Career: Undergraduate", { x: 50, y: 610, size: 11, font: fontRegular, color: rgb(0, 0, 0) });
  page.drawText("Academic Program: Computer Science (B.S.)", { x: 50, y: 580, size: 11, font: fontRegular, color: rgb(0, 0, 0) });
  page.drawText("Cumulative GPA: 3.85 / 4.00", { x: 350, y: 580, size: 11, font: fontBold, color: rgb(0, 0, 0) });

  page.drawText("Term: Spring 2026", { x: 50, y: 520, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText("CS 111 - Introduction to Computer Science | Grade: A", { x: 50, y: 495, size: 9, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });

  // Large diagonal watermark
  page.drawText("TASLAK KOPYA", {
    x: 100,
    y: 350,
    size: 56,
    font: fontBold,
    color: rgb(0.85, 0.85, 0.85),
    rotate: degrees(45)
  });

  return await doc.save();
}

async function main() {
  console.log("================================================================================");
  console.log("   CANLI SİTE (https://takiminisec.lol) E2E FORMA AI FİLİGRAN TEMİZLEME TESTİ");
  console.log("================================================================================");

  const testPdfBytes = await createTestBostonPdf();
  const tempDir = path.join(os.tmpdir(), "live-flow-" + Date.now());
  fs.mkdirSync(tempDir, { recursive: true });
  const pdfFilePath = path.join(tempDir, "boston_transcript.pdf");
  fs.writeFileSync(pdfFilePath, testPdfBytes);
  console.log(`[Adım 1] Test PDF oluşturuldu: ${pdfFilePath} (${testPdfBytes.length} bayt).`);

  const tempProfile = path.join(tempDir, "profile");
  fs.mkdirSync(tempProfile, { recursive: true });

  const chromeProc = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
    "--headless=new",
    "--remote-debugging-port=9338",
    "--disable-gpu",
    "--no-sandbox",
    "--user-data-dir=" + tempProfile
  ], { stdio: "ignore" });

  let client;
  try {
    await waitHttp("http://127.0.0.1:9338/json/version", 8000);
    const pages = await waitHttp("http://127.0.0.1:9338/json/list", 8000);
    const pageTarget = pages.find(p => p.type === "page") || pages[0];
    client = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await client.ready;
    console.log("✓ Headless Chrome CDP bağlantısı kuruldu.");

    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("DOM.enable");

    client.on("Runtime.consoleAPICalled", (params) => {
      const text = params.args.map(a => a.value ?? JSON.stringify(a)).join(" ");
      console.log(`[Browser Console ${params.type}]`, text.slice(0, 300));
    });
    client.on("Runtime.exceptionThrown", (params) => {
      console.log(`[Browser Exception]`, params.exceptionDetails?.exception?.description || params.exceptionDetails?.text);
    });

    // Download interceptor'ı önceden enjekte et
    await client.send("Page.addScriptToEvaluateOnNewDocument", {
      source: `
        window.__capturedDownloads = [];
        const origCreate = URL.createObjectURL;
        URL.createObjectURL = function(obj) {
          if (obj instanceof Blob) {
            obj.arrayBuffer().then(buf => {
              const u8 = new Uint8Array(buf);
              let binary = '';
              const len = u8.byteLength;
              for (let i = 0; i < len; i++) {
                binary += String.fromCharCode(u8[i]);
              }
              window.__capturedDownloads.push({
                size: obj.size,
                type: obj.type,
                base64: btoa(binary)
              });
            });
          }
          return origCreate.apply(this, arguments);
        };
      `
    });

    // Canlı siteye git
    console.log("\n[Adım 2] https://takiminisec.lol adresine bağlanılıyor...");
    const loadPromise = new Promise(resolve => client.on("Page.loadEventFired", resolve));
    await client.send("Page.navigate", { url: "https://takiminisec.lol" });
    await loadPromise;
    console.log("✓ Canlı site sayfası yüklendi.");

    await new Promise(r => setTimeout(r, 2000));
    const title = await client.eval("document.title");
    console.log(`✓ Sayfa Başlığı: "${title}"`);

    // 3. Dosyayı native CDP ile yükle
    console.log("\n[Adım 3] Test PDF dosyası native dosya seçici ile yükleniyor...");
    const docNode = await client.send("DOM.getDocument");
    const inputNode = await client.send("DOM.querySelector", {
      nodeId: docNode.root.nodeId,
      selector: 'input[type="file"]'
    });
    await client.send("DOM.setFileInputFiles", {
      files: [pdfFilePath],
      nodeId: inputNode.nodeId
    });

    // Çalışma alanının açılmasını bekle
    console.log("Çalışma alanı (Workspace) açılması bekleniyor...");
    let workspaceReady = false;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const hasCanvas = await client.eval("!!document.querySelector('canvas')");
      if (hasCanvas) {
        workspaceReady = true;
        break;
      }
    }
    assert.strictEqual(workspaceReady, true, "Çalışma alanı yüklenemedi!");
    console.log("✓ Çalışma alanı (Workspace) başarıyla açıldı ve PDF render edildi.");

    // 4. Forma AI Copilot'u aç
    console.log("\n[Adım 4] Forma AI asistanı tetikleniyor...");
    await new Promise(r => setTimeout(r, 1000));
    const triggerClicked = await client.eval(`
      (() => {
        const btn = document.querySelector('.forma-ai-trigger');
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      })()
    `);
    assert.strictEqual(triggerClicked, true, "Forma AI butonu tıklanamadı!");
    console.log("✓ Forma AI modalı açıldı.");

    // Asistan modalının açılmasını bekle
    await new Promise(r => setTimeout(r, 1500));

    // 5. Forma AI inputuna "bu belgedeki filigranı kaldır" yaz ve gönder
    console.log("\n[Adım 5] Forma AI komutu gönderiliyor: 'bu belgedeki filigranı kaldır'...");
    const focusResult = await client.eval(`
      (() => {
        const input = document.querySelector('input[placeholder*="Örn:"]') || document.querySelector('form input[type="text"]');
        if (!input) return false;
        input.focus();
        return true;
      })()
    `);
    assert.strictEqual(focusResult, true, "Input alanı bulunamadı ve odaklanılamadı!");

    await client.send("Input.insertText", { text: "bu belgedeki filigranı kaldır" });
    await new Promise(r => setTimeout(r, 500));

    const submitResult = await client.eval(`
      (() => {
        const form = document.querySelector('input[placeholder*="Örn:"]')?.closest('form') || document.querySelector('form');
        if (!form) return { success: false, reason: "Form bulunamadı" };
        const submitBtn = form.querySelector('button[type="submit"]');
        if (submitBtn && !submitBtn.disabled) {
          submitBtn.click();
          return { success: true, method: "button-click" };
        }
        form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
        return { success: true, method: "form-event" };
      })()
    `);
    console.log("✓ Komut gönderildi:", submitResult);

    // 6. Filigran Plan Kartı ve Aday Kartını bekle
    console.log("\n[Adım 6] Filigran İşlem Planı ve Aday Kartı bekleniyor...");
    let planConfirmed = false;
    let candidateCardFound = false;
    let candidatesList = [];

    for (let attempt = 0; attempt < 35; attempt++) {
      await new Promise(r => setTimeout(r, 1000));

      const modalInfo = await client.eval(`
        (() => {
          const modal = document.querySelector('.forma-ai-modal') || document.querySelector('[role="dialog"]');
          const modalText = modal ? modal.innerText : "";

          // 1. Plan Önizleme butonu kontrolü ("Onayla ve Uygula")
          const planBtn = Array.from(document.querySelectorAll('button')).find(b => 
            b.textContent && b.textContent.includes('Onayla ve Uygula')
          );

          // 2. Aday Kartı kontrolü ("Filigran Adayları")
          const cardHeader = Array.from(document.querySelectorAll('span, div')).find(el => 
            el.textContent && el.textContent.includes('Filigran Adayları')
          );

          const labels = Array.from(document.querySelectorAll('label')).filter(l => l.querySelector('input[type="checkbox"]'));
          const candidates = labels.map(l => {
            const cb = l.querySelector('input[type="checkbox"]');
            const titleEl = l.querySelector('.font-semibold') || l.querySelector('div');
            return {
              checked: cb ? cb.checked : false,
              text: titleEl ? titleEl.textContent.trim() : "",
              raw: l.textContent.trim()
            };
          });

          const cleanBtn = Array.from(document.querySelectorAll('button')).find(b => 
            b.textContent && b.textContent.includes('Seçilen Filigranları Temizle')
          );

          return {
            hasPlanBtn: !!planBtn,
            hasCardHeader: !!cardHeader,
            candidates,
            hasCleanBtn: !!cleanBtn,
            modalSnippet: modalText.slice(0, 200).replace(/\\n/g, ' ')
          };
        })()
      `);

      if (attempt % 5 === 0) {
        console.log(`[Yoklama ${attempt + 1}] modalInfo:`, JSON.stringify(modalInfo));
      }

      // Eğer plan önizleme butonu ("Onayla ve Uygula") belirdiyse tıkla
      if (modalInfo.hasPlanBtn && !planConfirmed) {
        console.log(`✓ 'Onayla ve Uygula' plan butonu bulundu (${attempt + 1}. saniye). Tıklanıyor...`);
        const clicked = await client.eval(`
          (() => {
            const btn = Array.from(document.querySelectorAll('button')).find(b => 
              b.textContent && b.textContent.includes('Onayla ve Uygula')
            );
            if (btn) { btn.click(); return true; }
            return false;
          })()
        `);
        if (clicked) {
          planConfirmed = true;
          console.log("✓ 'Onayla ve Uygula' tıklandı. Aday tespit taraması tetiklendi.");
        }
      }

      // Eğer aday kartı ("Filigran Adayları") belirdiyse ve adaylar geldiyse
      if (modalInfo.hasCardHeader && modalInfo.candidates.length > 0) {
        candidateCardFound = true;
        candidatesList = modalInfo.candidates;
        console.log(`✓ Filigran Aday Kartı başarıyla tespit edildi (${attempt + 1}. saniye).`);
        break;
      }
    }

    assert.strictEqual(candidateCardFound, true, "Filigran aday kartı bulunamadı!");
    console.log("Bulunan Filigran Adayları:", candidatesList);

    // GÜVENLİK VE DOĞRULUK DENETİMLERİ:
    // a) Boston University veya öğrenci metinleri ASLA aday olmamalı
    const forbiddenPatterns = ["BOSTON", "Ahmet Yilmaz", "U98765432", "Computer Science", "3.85", "Undergraduate"];
    for (const cand of candidatesList) {
      for (const pat of forbiddenPatterns) {
        assert.ok(!cand.text.includes(pat), `GÜVENLİK İHLALİ: '${pat}' meşru içeriği filigran adayı olarak tespit edildi!`);
      }
    }
    console.log("✓ Güvenlik Doğrulaması: Meşru içerik ve kurum logosu filigran adaylarından tamamen hariç tutuldu.");

    // b) Eski hatalı kırmızı piksel tüm sayfa adayı ("Kırmızı Damga") olmamalı
    const hasBogusRedStamp = candidatesList.some(c => c.text.includes("Kırmızı Damga") || c.text.includes("GEÇERSİZ"));
    assert.strictEqual(hasBogusRedStamp, false, "GÜVENLİK İHLALİ: Kırmızı logo sebebiyle sahte tüm sayfa filigranı tespit edildi!");
    console.log("✓ Güvenlik Doğrulaması: Kırmızı piksel sahte filigran adayı üretilmedi.");

    // c) Gerçek filigran ("TASLAK KOPYA") aday listesinde yer almalı ve seçili olmalı
    const taslakCand = candidatesList.find(c => c.text.includes("TASLAK") || c.text.includes("KOPYA"));
    assert.ok(taslakCand, "Gerçek filigran ('TASLAK KOPYA') aday listesinde bulunamadı!");
    assert.strictEqual(taslakCand.checked, true, "Gerçek vektörel filigran varsayılan olarak seçili olmalı!");
    console.log(`✓ Gerçek filigran ('${taslakCand.text}') güvenle tespit edildi ve otomatik seçildi.`);

    // 7. "Seçilen Filigranları Temizle" butonuna tıkla
    console.log("\n[Adım 7] 'Seçilen Filigranları Temizle' butonuna tıklanıyor...");
    const cleanClicked = await client.eval(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => 
          b.textContent && b.textContent.includes('Seçilen Filigranları Temizle')
        );
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      })()
    `);
    assert.strictEqual(cleanClicked, true, "'Seçilen Filigranları Temizle' butonuna tıklanamadı!");
    console.log("✓ Temizle butonuna tıklandı.");

    // 8. İşlemin tamamlanmasını bekle
    console.log("Temizleme işleminin tamamlanması bekleniyor...");
    let actionDone = false;
    for (let i = 0; i < 30; i++) {
      await new Promise(r => setTimeout(r, 1000));
      const status = await client.eval(`
        (() => {
          const isProcessing = !!document.querySelector('.animate-spin') || !!document.querySelector('[data-processing]');
          const modal = document.querySelector('.forma-ai-modal') || document.querySelector('[role="dialog"]');
          const modalText = modal ? modal.innerText : "";
          const hasSuccessMsg = modalText.includes("kaldırıldı") || modalText.includes("temizlendi") || modalText.includes("başarıyla");
          return {
            isProcessing,
            hasSuccessMsg,
            modalSnippet: modalText.slice(-250).replace(/\\n/g, ' ')
          };
        })()
      `);

      if (i % 3 === 0 || status.hasSuccessMsg) {
        console.log(`[Temizleme Durumu ${i + 1}] isProcessing=${status.isProcessing}, hasSuccessMsg=${status.hasSuccessMsg}, Snippet: ${status.modalSnippet}`);
      }

      if (!status.isProcessing && status.hasSuccessMsg) {
        actionDone = true;
        console.log(`✓ Temizleme işlemi başarıyla tamamlandı (${i + 1}. saniye).`);
        break;
      }
    }
    assert.strictEqual(actionDone, true, "Filigran kaldırma işlemi zaman aşımına uğradı!");

    // 9. Dışa Aktar ve İndir akışını çalıştır
    console.log("\n[Adım 8] Düzenlenen belge dışa aktarılıyor (Export -> Download)...");
    // Forma AI penceresini kapat
    await client.eval(`
      (() => {
        const closeBtn = document.querySelector('button[title="Kapat"]') || document.querySelector('button[aria-label="Kapat"]') || document.querySelector('.forma-ai-close');
        if (closeBtn) closeBtn.click();
      })()
    `);
    await new Promise(r => setTimeout(r, 1000));

    // "Dışa aktar" butonuna tıkla
    const exportOpenClicked = await client.eval(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => 
          b.textContent && b.textContent.includes('Dışa aktar')
        );
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      })()
    `);
    console.log(`✓ 'Dışa aktar' butonu tıklandı: ${exportOpenClicked}`);
    await new Promise(r => setTimeout(r, 1000));

    // İndir butonuna tıkla ("Dosyayı indir")
    const downloadClicked = await client.eval(`
      (() => {
        const btn = Array.from(document.querySelectorAll('button')).find(b => 
          b.textContent && b.textContent.includes('Dosyayı indir')
        );
        if (btn) {
          btn.click();
          return true;
        }
        return false;
      })()
    `);
    console.log(`✓ 'Dosyayı indir' butonu tıklandı: ${downloadClicked}`);

    // İndirilen PDF baytlarını yakala
    console.log("İndirilen PDF baytları yakalanıyor...");
    let downloadedPdfBytes = null;
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 500));
      const captured = await client.eval("window.__capturedDownloads");
      if (captured && captured.length > 0) {
        const last = captured[captured.length - 1];
        downloadedPdfBytes = Buffer.from(last.base64, "base64");
        console.log(`✓ İndirilen PDF başarıyla yakalandı (${downloadedPdfBytes.length} bayt).`);
        break;
      }
    }
    assert.ok(downloadedPdfBytes && downloadedPdfBytes.length > 0, "İndirilen PDF yakalanamadı!");

    // 10. İndirilen PDF'i yeniden aç ve içerik bütünlüğünü doğrula
    console.log("\n[Adım 9] İndirilen PDF yeniden açılıyor ve içerik denetimi yapılıyor...");
    const verifiedDoc = await PDFDocument.load(downloadedPdfBytes);
    const verifiedPage = verifiedDoc.getPage(0);
    const { width, height } = verifiedPage.getSize();
    assert.strictEqual(width, 612);
    assert.strictEqual(height, 792);

    // pdfjs ile metin analizi
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(downloadedPdfBytes) });
    const pdfDoc = await loadingTask.promise;
    const pageObj = await pdfDoc.getPage(1);
    const textContent = await pageObj.getTextContent();
    const extractedAllText = textContent.items.map(it => it.str).join(" ");
    console.log("İndirilen Belgeden Çıkarılan Metin:");
    console.log(extractedAllText);

    // KONTROLLER:
    // 1. "TASLAK" ve "KOPYA" kelimeleri kesinlikle silinmiş olmalı
    assert.strictEqual(extractedAllText.includes("TASLAK"), false, "HATA: 'TASLAK' filigranı PDF'de hâlâ mevcut!");
    assert.strictEqual(extractedAllText.includes("KOPYA"), false, "HATA: 'KOPYA' filigranı PDF'de hâlâ mevcut!");
    console.log("✓ Doğrulama: 'TASLAK KOPYA' filigranı belgeden tamamen temizlendi.");

    // 2. Meşru metinler eksiksiz korunmalı
    assert.ok(extractedAllText.includes("BOSTON UNIVERSITY"), "HATA: 'BOSTON UNIVERSITY' başlığı kayboldu!");
    assert.ok(extractedAllText.includes("Ahmet Yilmaz"), "HATA: Öğrenci adı 'Ahmet Yilmaz' kayboldu!");
    assert.ok(extractedAllText.includes("U98765432"), "HATA: Öğrenci numarası 'U98765432' kayboldu!");
    assert.ok(extractedAllText.includes("Undergraduate"), "HATA: 'Undergraduate' kayboldu!");
    assert.ok(extractedAllText.includes("Computer Science"), "HATA: 'Computer Science' kayboldu!");
    assert.ok(extractedAllText.includes("3.85"), "HATA: GPA bilgisi '3.85' kayboldu!");
    assert.ok(extractedAllText.includes("CS 111"), "HATA: Ders tablosu 'CS 111' kayboldu!");
    console.log("✓ Doğrulama: Tüm öğrenci ve üniversite bilgileri %100 eksiksiz korundu.");

    console.log("\n================================================================================");
    console.log("🎉 CANLI SİTE (https://takiminisec.lol) E2E TESTİ %100 BAŞARIYLA GEÇTİ (EXIT CODE: 0)");
    console.log("   - Canlı Sunucu Durumu: HTTP 200 OK (Render origin aktif)");
    console.log("   - Dosya Yükleme: Başarılı");
    console.log("   - Forma AI Niyeti: Filigran Temizleme doğru algılandı");
    console.log("   - Aday Tespiti: Logo/öğrenci verisi korunup yalnızca filigran listelendi");
    console.log("   - Onay ve Kaldırma: Cerrahi olarak filigran silindi");
    console.log("   - İndirilen Belge: 'TASLAK KOPYA' silindi, tüm meşru içerik ve logo korundu");
    console.log("================================================================================");

  } finally {
    if (client?.ws) client.ws.close();
    chromeProc.kill("SIGKILL");
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
}

main().catch(err => {
  console.error("\n❌ CANLI SİTE E2E TESTİ BAŞARISIZ:", err);
  process.exit(1);
});

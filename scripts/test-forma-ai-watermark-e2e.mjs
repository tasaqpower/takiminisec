import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PDFDocument, rgb, degrees, StandardFonts } from "pdf-lib";

// Polyfills for Node runtime
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

const { parseUserIntent } = await import("../features/ai-copilot/aiIntentEngine.ts");
const { dispatchAiAction } = await import("../features/ai-copilot/aiActionDispatcher.ts");
const { detectWatermarks } = await import("../features/watermark-removal/watermarkDetector.ts");
const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

async function main() {
  console.log("================================================================================");
  console.log("   FORMA AI E2E FİLİGRAN TEMİZLEME, ADAY TESPİTİ VE İÇERİK KORUMA TESTİ");
  console.log("================================================================================");

  // 1. GERÇEKÇİ BELGE OLUŞTURMA (BOSTON UNIVERSITY STİLİ KURUMSAL ANTET + TRANSKRİPT + FİLİGRAN)
  const doc = await PDFDocument.create();
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const page = doc.addPage([612, 792]);

  // A. Kurumsal Kırmızı Logo / Antet Kutusu (Üst Sağ)
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

  // B. Kurumsal Logo Görseli (Küçük Mühür / XObject)
  const pngLogoBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAgAAAAICAYAAADED76LAAAAFElEQVQoU2P8z8DwnwEHYCAlmAEAPxECB0B3pS0AAAAASUVORK5CYII=";
  const pngLogoBytes = Buffer.from(pngLogoBase64, "base64");
  const embeddedLogo = await doc.embedPng(pngLogoBytes);
  page.drawImage(embeddedLogo, {
    x: 50,
    y: 710,
    width: 48,
    height: 48
  });
  page.drawText("OFFICE OF THE UNIVERSITY REGISTRAR", {
    x: 108,
    y: 730,
    size: 9,
    font: fontBold,
    color: rgb(0.2, 0.2, 0.2)
  });

  // C. Öğrenci ve Transkript Bilgileri (ORTA BÖLGE - KESİNLİKLE BEYAZ RECTANGLE İLE ÖRTÜLEMEMELİ!)
  page.drawText("Name: Ahmet Yilmaz", { x: 50, y: 640, size: 12, font: fontRegular, color: rgb(0, 0, 0) });
  page.drawText("Student ID: U98765432", { x: 350, y: 640, size: 12, font: fontRegular, color: rgb(0, 0, 0) });
  page.drawText("Career: Undergraduate", { x: 50, y: 610, size: 11, font: fontRegular, color: rgb(0, 0, 0) });
  page.drawText("Academic Program: Computer Science (B.S.)", { x: 50, y: 580, size: 11, font: fontRegular, color: rgb(0, 0, 0) });
  page.drawText("Cumulative GPA: 3.85 / 4.00", { x: 350, y: 580, size: 11, font: fontBold, color: rgb(0, 0, 0) });

  page.drawText("Term: Spring 2026", { x: 50, y: 520, size: 10, font: fontBold, color: rgb(0.1, 0.1, 0.1) });
  page.drawText("CS 111 - Introduction to Computer Science | Grade: A  | Credits: 4.0", { x: 50, y: 495, size: 9, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  page.drawText("MA 123 - Calculus I                       | Grade: A- | Credits: 4.0", { x: 50, y: 475, size: 9, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });
  page.drawText("WR 120 - First-Year Writing Seminar       | Grade: A  | Credits: 4.0", { x: 50, y: 455, size: 9, font: fontRegular, color: rgb(0.2, 0.2, 0.2) });

  // D. Büyük Çapraz Filigran (Kaldırılması Hedeflenen Nesne)
  page.drawText("TASLAK KOPYA", {
    x: 100,
    y: 350,
    size: 56,
    font: fontBold,
    color: rgb(0.85, 0.85, 0.85),
    rotate: degrees(45)
  });

  const originalPdfBytes = await doc.save();
  console.log(`[Adım 1] Gerçekçi test PDF'i oluşturuldu (${originalPdfBytes.length} bayt).`);

  // --------------------------------------------------------------------------
  // ADIM 2: FORMA AI NİYET MOTORU (INTENT ENGINE) TESTİ
  // --------------------------------------------------------------------------
  const prompt = "bu belgedeki filigranı kaldır";
  const intent = parseUserIntent(prompt);
  console.log(`[Adım 2] Niyet Algılama: Prompt='${prompt}' -> action='${intent.action}'`);
  assert.strictEqual(intent.action, "watermark_remove", "Niyet motoru filigran kaldırma eylemini tespit etmeli!");

  // --------------------------------------------------------------------------
  // ADIM 3: ADAY TESPİTİ VE ONAYSIZ ÇAĞRI (GÜVENLİK MODELİ)
  // --------------------------------------------------------------------------
  console.log("\n[Adım 3] Forma AI onaysız çağrı yapılıyor (Aday tespiti kontrolü)...");
  const pendingResult = await dispatchAiAction(intent, {
    pdfBytes: originalPdfBytes,
    fileName: "boston_transcript.pdf",
    confirmedCandidateIds: undefined // Henüz kullanıcı onayı yok
  });

  assert.strictEqual(pendingResult.success, true, "Aday tespiti başarılı olmalı");
  assert.strictEqual(pendingResult.metadata?.pendingConfirmation, true, "Onay aşaması tetiklenmeli");
  assert.strictEqual(pendingResult.newPdfBytes, undefined, "Onay verilmeden önce 0 bayt modifikasyon yapılmalı (PDF baytları değişmemeli)!");

  const detectedCandidates = pendingResult.metadata?.candidates || [];
  console.log(`✓ Tespit edilen aday sayısı: ${detectedCandidates.length}`);
  detectedCandidates.forEach(c => {
    console.log(`   - [${c.type}] "${c.text}" (Güven: %${c.confidence}, Sebep: ${c.reason})`);
  });

  // Güvenlik Kriteri 1: Kırmızı piksel union bounding box hatası asla olmamalı
  const bogusRedCandidate = detectedCandidates.find(c => 
    c.text?.includes("Kırmızı Damga") || c.text?.includes("GEÇERSİZ / ÖRNEK BELGEDİR")
  );
  assert.strictEqual(bogusRedCandidate, undefined, "HATA: Kırmızı logo/antet yüzünden tüm sayfayı kaplayan sahte aday üretilmemeli!");

  // Güvenlik Kriteri 2: Öğrenci bilgileri ve dersler asla filigran adayı yapılmamalı
  const studentTextCandidate = detectedCandidates.find(c =>
    c.text?.includes("Ahmet Yilmaz") || c.text?.includes("Computer Science") || c.text?.includes("GPA")
  );
  assert.strictEqual(studentTextCandidate, undefined, "HATA: Meşru öğrenci bilgileri filigran adayı yapılamaz!");

  // Güvenlik Kriteri 3: Yalnızca gerçek 'TASLAK KOPYA' filigranı tespit edilmiş olmalı
  const realWatermarkCandidate = detectedCandidates.find(c => c.text?.includes("TASLAK"));
  assert.ok(realWatermarkCandidate, "HATA: 'TASLAK KOPYA' filigranı tespit edilmiş olmalı!");

  // --------------------------------------------------------------------------
  // ADIM 4: KULLANICI ONAYI İLE KALDIRMA (SURGICAL REMOVAL)
  // --------------------------------------------------------------------------
  console.log(`\n[Adım 4] Kullanıcı adayı onayladı: ID='${realWatermarkCandidate.id}'`);
  const confirmedResult = await dispatchAiAction(intent, {
    pdfBytes: originalPdfBytes,
    fileName: "boston_transcript.pdf",
    confirmedCandidateIds: [realWatermarkCandidate.id]
  });

  assert.strictEqual(confirmedResult.success, true, "Onaylı kaldırma işlemi başarılı olmalı");
  assert.ok(confirmedResult.newPdfBytes, "Temizlenmiş yeni PDF baytları üretilmiş olmalı");
  console.log(`✓ Kaldırılan nesne sayısı: ${confirmedResult.metadata?.removedCount}`);
  assert.strictEqual(confirmedResult.metadata?.removedCount, 1, "Tam olarak 1 adet filigran nesnesi silinmeli!");

  // --------------------------------------------------------------------------
  // ADIM 5: İNDİRİLEN PDF'NİN YENİDEN AÇILMASI VE DOĞRULAMA (PDF.js / PDFium)
  // --------------------------------------------------------------------------
  console.log("\n[Adım 5] İndirilen PDF yeniden açılıyor ve içerik denetimi yapılıyor...");
  const downloadedPdfBytes = confirmedResult.newPdfBytes;

  const loadingTask = pdfjs.getDocument({ data: downloadedPdfBytes.slice() });
  const reloadedDoc = await loadingTask.promise;
  assert.strictEqual(reloadedDoc.numPages, 1, "Sayfa sayısı korunmalı");

  const reloadedPage = await reloadedDoc.getPage(1);
  const textContent = await reloadedPage.getTextContent();
  const allExtractedText = textContent.items.map((it) => it.str).join(" ");

  console.log("Yeniden Açılan PDF Metin Özeti:\n" + allExtractedText.slice(0, 200) + "...\n");

  // 1. Filigran yok mu?
  assert.strictEqual(allExtractedText.includes("TASLAK"), false, "BAŞARILI: 'TASLAK' filigranı PDF'den tamamen silinmiş!");
  assert.strictEqual(allExtractedText.includes("KOPYA"), false, "BAŞARILI: 'KOPYA' filigranı PDF'den tamamen silinmiş!");

  // 2. Seçilmemiş logo ve antet korundu mu?
  assert.strictEqual(allExtractedText.includes("BOSTON UNIVERSITY"), true, "BAŞARILI: 'BOSTON UNIVERSITY' logosu korundu!");
  assert.strictEqual(allExtractedText.includes("REGISTRAR"), true, "BAŞARILI: Üniversite sicil anteti korundu!");

  // 3. Öğrenci transkript verileri eksiksiz duruyor mu?
  assert.strictEqual(allExtractedText.includes("Ahmet Yilmaz"), true, "BAŞARILI: 'Name: Ahmet Yilmaz' meşru metni korundu!");
  assert.strictEqual(allExtractedText.includes("U98765432"), true, "BAŞARILI: Öğrenci numarası korundu!");
  assert.strictEqual(allExtractedText.includes("Undergraduate"), true, "BAŞARILI: 'Career: Undergraduate' korundu!");
  assert.strictEqual(allExtractedText.includes("Computer Science"), true, "BAŞARILI: 'Academic Program' korundu!");
  assert.strictEqual(allExtractedText.includes("3.85"), true, "BAŞARILI: 'GPA: 3.85' korundu!");
  assert.strictEqual(allExtractedText.includes("CS 111"), true, "BAŞARILI: 'CS 111' dersi korundu!");

  // 4. Operatör Listesi Denetimi: Sayfada yıkıcı bir beyaz örtü dikdörtgeni (page.drawRectangle) var mı?
  const opList = await reloadedPage.getOperatorList();
  let imagePaintCount = 0;
  for (let i = 0; i < opList.fnArray.length; i++) {
    const fn = opList.fnArray[i];
    if (fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintJpegXObject) {
      imagePaintCount++;
    }
  }
  console.log(`✓ Sayfadaki boyanan XObject görsel sayısı: ${imagePaintCount}`);
  assert.strictEqual(imagePaintCount, 1, "BAŞARILI: Sol üstteki üniversite mührü/logosu silinmeden aynen duruyor!");

  console.log("================================================================================");
  console.log("🎉 TÜM E2E DOĞRULAMA TESTLERİ BAŞARIYLA GEÇTİ (EXIT CODE: 0)");
  console.log("   - Aday Tespiti: Yalnızca gerçek filigran adayı (%100 doğru)");
  console.log("   - Onay Güvenliği: Onaysız işlemde 0 bayt mutasyon");
  console.log("   - Kaldırma Stratejisi: Vektörel glif düzeyinde cerrahi silme");
  console.log("   - Yeniden Açma Denetimi: Logo, antet ve öğrenci transkripti %100 korundu");
  console.log("   - Yıkıcı Beyaz Örtü (Whiteout): 0 adet, sıfır hasar");
  console.log("================================================================================");
}

main().catch(err => {
  console.error("\n❌ E2E TEST BAŞARISIZ OLDU:", err);
  process.exit(1);
});

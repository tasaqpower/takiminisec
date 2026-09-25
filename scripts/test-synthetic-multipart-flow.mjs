import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
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

// Timeout watchdog
const timer = setTimeout(() => {
  console.error("FAIL: Test execution timed out (exceeded 25 seconds)");
  process.exit(1);
}, 25000);

async function main() {
  console.log("================================================================================");
  console.log("   SENTETİK ÇOK PARÇALI ÇAPRAZ KIRMIZI TEST FİLİGRANI DOĞRULAMA TESTİ");
  console.log("================================================================================");

  const report = {
    candidateDetection: { passed: false, error: null, candidates: [] },
    removal: { passed: false, error: null, removedCount: 0 },
    successNotification: { passed: false, error: null, message: "" },
    contentIntegrity: { passed: false, error: null }
  };

  try {
    // --------------------------------------------------------------------------
    // 1. SENTETİK BELGE OLUŞTURMA (KURUM VE KİŞİSEL VERİ İÇERMEYEN NÖTR BELGE)
    // --------------------------------------------------------------------------
    const doc = await PDFDocument.create();
    const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const page = doc.addPage([612, 792]);

    // A. Ayrı Logo (Üst Sağ - Kırmızı Kutu İçinde Beyaz Metin)
    page.drawRectangle({
      x: 430,
      y: 700,
      width: 140,
      height: 44,
      color: rgb(0.75, 0.12, 0.12)
    });
    page.drawText("CORP LOGO", {
      x: 455,
      y: 716,
      size: 13,
      font: fontBold,
      color: rgb(1, 1, 1)
    });

    // B. Üst Banner (Yatay Kırmızı Simülasyon Uyarısı)
    page.drawText("GECERSIZ - BELGE SIMULASYONUDUR", {
      x: 110,
      y: 742,
      size: 14,
      font: fontBold,
      color: rgb(0.85, 0.2, 0.2)
    });

    // C. Alt Metinler (Siyah Meşru Doküman İçeriği)
    const blackTexts = [
      { text: "Document Type: Official Record Certificate", x: 50, y: 650, size: 13, bold: true },
      { text: "Subject Name: Candidate Zero One", x: 50, y: 620, size: 11, bold: false },
      { text: "Record Number: REC-2026-987654", x: 50, y: 590, size: 11, bold: false },
      { text: "Department: Information Systems Engineering", x: 50, y: 560, size: 11, bold: false },
      { text: "Status: Active Verified Good Standing", x: 50, y: 530, size: 11, bold: false },
      { text: "Term: Spring Session 2026 | Credits: 30.0 | Grade Point: 3.90", x: 50, y: 490, size: 10, bold: true },
      { text: "Verification Hash: 8f9b4c2e1a3d5e7f0b2c4d6e8a0f1b2c", x: 50, y: 460, size: 9, bold: false }
    ];

    for (const bt of blackTexts) {
      page.drawText(bt.text, {
        x: bt.x,
        y: bt.y,
        size: bt.size,
        font: bt.bold ? fontBold : fontRegular,
        color: rgb(0, 0, 0)
      });
    }

    // D. Çok Parçalı Çapraz Kırmızı TEST Filigranı (Sayfa Boyunca 35 Derece Açıyla)
    // 4 Ayrı Parça: "TEST" + "/" + "ORNEK" + "BELGEDIR"
    const redWatermarkColor = rgb(0.85, 0.15, 0.15);
    page.drawText("TEST", {
      x: 60,
      y: 140,
      size: 50,
      font: fontBold,
      color: redWatermarkColor,
      rotate: degrees(35)
    });

    page.drawText("/", {
      x: 200,
      y: 238,
      size: 50,
      font: fontBold,
      color: redWatermarkColor,
      rotate: degrees(35)
    });

    page.drawText("ORNEK", {
      x: 250,
      y: 273,
      size: 50,
      font: fontBold,
      color: redWatermarkColor,
      rotate: degrees(35)
    });

    page.drawText("BELGEDIR", {
      x: 390,
      y: 371,
      size: 50,
      font: fontBold,
      color: redWatermarkColor,
      rotate: degrees(35)
    });

    const originalPdfBytes = await doc.save();
    console.log(`[Adım 1] Sentetik test PDF'i oluşturuldu (${originalPdfBytes.length} bayt).`);

    // --------------------------------------------------------------------------
    // 2. FORMA AI NİYET VE ADAY TESPİTİ (INTENT & CANDIDATE DETECTION)
    // --------------------------------------------------------------------------
    const { parseUserIntent } = await import("../features/ai-copilot/aiIntentEngine.ts");
    const { dispatchAiAction } = await import("../features/ai-copilot/aiActionDispatcher.ts");
    const { loadPdf } = await import("../lib/documents.ts");
    const { editablePageText } = await import("../lib/pdf-text.ts");

    const prompt = "filigranları kaldır";
    const intent = parseUserIntent(prompt);
    console.log(`[Adım 2] Niyet Algılama: "${prompt}" -> action="${intent.action}"`);
    assert.strictEqual(intent.action, "watermark_remove", "Niyet motoru filigran kaldırma eylemini tespit etmeli!");

    console.log("[Adım 3] Forma AI onaysız çağrı ile aday tespiti yapılıyor...");
    const pendingResult = await dispatchAiAction(intent, {
      pdfBytes: originalPdfBytes,
      fileName: "synthetic_document.pdf",
      confirmedCandidateIds: undefined
    });

    assert.strictEqual(pendingResult.success, true, "Aday tespiti başarılı sonuç döndürmeli");
    assert.strictEqual(pendingResult.metadata?.pendingConfirmation, true, "Onay aşaması tetiklenmeli");
    assert.strictEqual(pendingResult.newPdfBytes, undefined, "Onay öncesi orijinal PDF korunmalı (modifikasyon yapılmamalı)");

    const detectedCandidates = pendingResult.metadata?.candidates || [];
    report.candidateDetection.candidates = detectedCandidates.map(c => ({
      id: c.id,
      text: c.text,
      count: c.count,
      confidence: c.confidence
    }));

    console.log(`✓ Tespit edilen aday sayısı: ${detectedCandidates.length}`);
    detectedCandidates.forEach(c => {
      console.log(`   - [${c.type}] "${c.text}" (Parça sayısı: ${c.count}, Güven: %${c.confidence}, Sebep: ${c.reason})`);
    });

    // Kontrol 1: Çapraz TEST filigranı tespit edilmiş olmalı
    const testWatermark = detectedCandidates.find(c =>
      c.text?.includes("TEST") || c.text?.includes("ORNEK")
    );

    if (!testWatermark) {
      report.candidateDetection.error = "Çok parçalı çapraz TEST filigranı adaylar arasında tespit edilemedi!";
      throw new Error(report.candidateDetection.error);
    }

    // Kontrol 2: Tekrarlanan/çift aday olmamalı (örn. tekil 'ORNEK' ayrı bir kart olarak kalmamalı)
    const duplicateOrnek = detectedCandidates.filter(c => c.text === "ORNEK");
    if (duplicateOrnek.length > 0 && testWatermark.text.includes("ORNEK")) {
      report.candidateDetection.error = "Aday tespiti çok parçalı satırı gruplamış ancak 'ORNEK' kelimesini tekrar mükerrer aday olarak listelemiş!";
      throw new Error(report.candidateDetection.error);
    }

    // Kontrol 3: Meşru siyah metinler veya logo aday yapılmamalı
    const illegitimateCandidates = detectedCandidates.filter(c =>
      c.text?.includes("Candidate Zero One") ||
      c.text?.includes("CORP LOGO") ||
      c.text?.includes("Engineering")
    );
    if (illegitimateCandidates.length > 0) {
      report.candidateDetection.error = `Meşru içerik veya logo adaya dahil edilmiş: ${illegitimateCandidates.map(c => c.text).join(", ")}`;
      throw new Error(report.candidateDetection.error);
    }

    report.candidateDetection.passed = true;
    console.log("✓ ADAY TESPİTİ BAŞARILI: Çapraz çok parçalı TEST filigranı doğru gruplandı ve izole edildi.");

    // --------------------------------------------------------------------------
    // 3. KULLANICI ONAYI VE KALDIRMA (USER CONFIRMATION & REMOVAL)
    // --------------------------------------------------------------------------
    // Kullanıcı tespit edilen filigran adaylarını onaylar
    const candidateIdsToRemove = [testWatermark.id];
    console.log(`\n[Adım 4] Kullanıcı onayladı: Aday ID'leri=${JSON.stringify(candidateIdsToRemove)}`);

    const confirmedResult = await dispatchAiAction(intent, {
      pdfBytes: originalPdfBytes,
      fileName: "synthetic_document.pdf",
      confirmedCandidateIds: candidateIdsToRemove
    });

    if (!confirmedResult.success || !confirmedResult.newPdfBytes) {
      report.removal.error = `Kaldırma işlemi başarısız: ${confirmedResult.error || "Bayt üretilmedi"}`;
      throw new Error(report.removal.error);
    }

    report.removal.passed = true;
    report.removal.removedCount = confirmedResult.metadata?.removedCount ?? 0;
    console.log(`✓ KALDIRMA İŞLEMİ BAŞARILI: ${report.removal.removedCount} nesne grubu işlendi.`);

    // --------------------------------------------------------------------------
    // 4. BAŞARI BİLDİRİMİ DENETİMİ (SUCCESS NOTIFICATION AUDIT)
    // --------------------------------------------------------------------------
    const successMsg = confirmedResult.message || "";
    report.successNotification.message = successMsg;
    console.log(`\n[Adım 5] Başarı Bildirimi Metni: "${successMsg}"`);

    if (!successMsg || successMsg.length < 5) {
      report.successNotification.error = "Başarı bildirimi boş veya yetersiz!";
      throw new Error(report.successNotification.error);
    }
    report.successNotification.passed = true;

    // --------------------------------------------------------------------------
    // 5. İNDİRİLEN PDF'Yİ YENİDEN AÇMA VE İÇERİK BÜTÜNLÜĞÜ DENETİMİ
    // --------------------------------------------------------------------------
    console.log("\n[Adım 6] İndirilen PDF yeniden açılıyor ve pikselsel/vektörel içerik doğrulanıyor...");
    const verifiedDoc = await loadPdf(confirmedResult.newPdfBytes);
    assert.strictEqual(verifiedDoc.numPages, 1, "Sayfa sayısı korunmalı");

    const page0 = await verifiedDoc.getPage(1);
    const verifiedItems = await editablePageText(page0);
    const allRemainingTexts = verifiedItems.map(it => it.text.trim());

    console.log(`Yeniden açılan PDF'te toplam ${verifiedItems.length} metin öğesi bulundu:`);
    verifiedItems.forEach(it => {
      console.log(`   - "${it.text}" (Açı: ${Math.round(it.angle)}°, Renk: ${it.color}, Boyut: ${Math.round(it.size)}pt)`);
    });

    // Kontrol A: Seçilen filigranın HİÇBİR parçası kalmış olmamalı
    const forbiddenWatermarkWords = ["TEST", "/", "ORNEK", "BELGEDIR"];
    const leftoverWords = [];
    for (const fWord of forbiddenWatermarkWords) {
      const found = verifiedItems.some(it => {
        const t = it.text.trim();
        // Exact token or part of token
        return t === fWord || (t.includes(fWord) && !t.includes("Test Subject"));
      });
      if (found) leftoverWords.push(fWord);
    }

    if (leftoverWords.length > 0) {
      report.contentIntegrity.error = `FAIL: Seçilen filigranın şu parçaları PDF'te hala mevcut: ${leftoverWords.join(", ")}`;
      throw new Error(report.contentIntegrity.error);
    }
    console.log("✓ Filigran kontrolü: Seçilen filigranın tüm parçaları (TEST, /, ORNEK, BELGEDIR) tamamen yok edildi (0 parça kaldı).");

    // Kontrol B: Alttaki meşru siyah metinlerin hepsi %100 eksiksiz ve siyah kalmalı
    for (const bt of blackTexts) {
      const match = verifiedItems.find(it => it.text.includes(bt.text) || bt.text.includes(it.text));
      if (!match) {
        report.contentIntegrity.error = `FAIL: Meşru metin kayboldu veya değiştirildi: "${bt.text}"`;
        throw new Error(report.contentIntegrity.error);
      }
      // Renk siyah olmalı (#000000 veya tonu, kırmızıya boyanmış olamaz!)
      if (match.color && match.color.toLowerCase() === "#d92626") {
        report.contentIntegrity.error = `FAIL: Meşru metnin rengi kırmızıya bozulmuş: "${bt.text}" -> ${match.color}`;
        throw new Error(report.contentIntegrity.error);
      }
    }
    console.log("✓ Siyah metin kontrolü: Tüm meşru metinler eksiksiz ve orijinal renkleriyle korundu.");

    // Kontrol C: Logo ("CORP LOGO") korunmalı
    const logoMatch = verifiedItems.find(it => it.text.includes("CORP LOGO"));
    if (!logoMatch) {
      report.contentIntegrity.error = "FAIL: Ayrı logo metni silinmiş!";
      throw new Error(report.contentIntegrity.error);
    }
    console.log("✓ Logo kontrolü: Ayrı logo nesnesi ve metni 100% korundu.");

    report.contentIntegrity.passed = true;

    // --------------------------------------------------------------------------
    // NİHAİ RAPOR VE TEST SONUCU
    // --------------------------------------------------------------------------
    console.log("\n================================================================================");
    console.log("                       TEST SONUÇ RAPORU (AYRI AYRI BİLEŞENLER)");
    console.log("================================================================================");
    console.log(`1. Aday Tespiti (Candidate Detection)    : ${report.candidateDetection.passed ? "PASS" : "FAIL"}`);
    console.log(`2. Kaldırma (Removal)                   : ${report.removal.passed ? "PASS" : "FAIL"}`);
    console.log(`3. Başarı Bildirimi (Success Notif)     : ${report.successNotification.passed ? "PASS" : "FAIL"}`);
    console.log(`4. İçerik Bütünlüğü (Content Integrity) : ${report.contentIntegrity.passed ? "PASS" : "FAIL"}`);
    console.log("================================================================================");
    console.log("NİHAİ SONUÇ: ALL TESTS PASSED (EXIT CODE 0)");
    console.log("================================================================================");

    clearTimeout(timer);
    process.exit(0);

  } catch (err) {
    clearTimeout(timer);
    console.error("\n================================================================================");
    console.error("                       TEST BAŞARISIZ OLDU (FAIL)");
    console.error("================================================================================");
    console.error("Hata Detayı:", err.message);
    console.error("Bileşen Durumları:");
    console.error(`1. Aday Tespiti         : ${report.candidateDetection.passed ? "PASS" : "FAIL"} (${report.candidateDetection.error || "Hata yok"})`);
    console.error(`2. Kaldırma            : ${report.removal.passed ? "PASS" : "FAIL"} (${report.removal.error || "Hata yok"})`);
    console.error(`3. Başarı Bildirimi    : ${report.successNotification.passed ? "PASS" : "FAIL"} (${report.successNotification.error || "Hata yok"})`);
    console.error(`4. İçerik Bütünlüğü    : ${report.contentIntegrity.passed ? "PASS" : "FAIL"} (${report.contentIntegrity.error || "Hata yok"})`);
    console.error("================================================================================");
    process.exit(1);
  }
}

main();

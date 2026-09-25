import assert from "node:assert";
import crypto from "node:crypto";
import http from "node:http";
import https from "node:https";
import { PDFDocument, rgb, degrees, StandardFonts, PDFName, PDFDict, PDFStream } from "pdf-lib";
import { dispatchAiAction } from "../features/ai-copilot/aiActionDispatcher.ts";
import { parseUserIntent } from "../features/ai-copilot/aiIntentEngine.ts";
import { detectWatermarks } from "../features/watermark-removal/watermarkDetector.ts";
import { removeWatermarks } from "../features/watermark-removal/watermarkRemover.ts";
import { extractPdfImageBitmap } from "../lib/pdf-text.ts";

// Polyfill Promise.withResolvers for pdfjs-dist compatibility in older Node runtimes
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
if (!ArrayBuffer.prototype.transfer) {
  ArrayBuffer.prototype.transfer = ArrayBuffer.prototype.transferToFixedLength;
}

function extractPageImageStreams(doc, pageIdx = 0) {
  const pages = doc.getPages();
  if (pageIdx < 0 || pageIdx >= pages.length) return [];
  const page = pages[pageIdx];
  const res = page.node.Resources();
  const xObj = res ? res.lookup(PDFName.of("XObject")) : null;
  const list = [];
  if (xObj instanceof PDFDict) {
    for (const key of xObj.keys()) {
      const s = xObj.lookup(key);
      if (s instanceof PDFStream) {
        const subtype = s.dict.lookup(PDFName.of("Subtype"));
        if (subtype && subtype.toString() === "/Image") {
          const contents = s.getContents();
          const hash = crypto.createHash("sha256").update(contents).digest("hex");
          list.push({ key: key.toString(), hash, length: contents.length });
        }
      }
    }
  }
  return list;
}

async function countPdfjsPaintedImages(pdfjs, pdfBytes, pageNum = 1) {
  const loadingTask = pdfjs.getDocument({ data: pdfBytes.slice() });
  const doc = await loadingTask.promise;
  const page = await doc.getPage(pageNum);
  const ops = await page.getOperatorList();
  let count = 0;
  for (let i = 0; i < ops.fnArray.length; i++) {
    const fn = ops.fnArray[i];
    if (fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintJpegXObject || fn === pdfjs.OPS.paintImageMaskXObject) {
      count++;
    }
  }
  return count;
}

async function runSafetySuite() {
  console.log("================================================================================");
  console.log("   FORMA AI COPILOT GÜVENLİK, DOĞRULUK VE VERİ KAYBI KORUMA TESTLERİ");
  console.log("================================================================================\n");

  let passed = 0;
  let total = 0;

  function record(testName, cond, details = "") {
    total++;
    if (cond) {
      passed++;
      console.log(`  [PASS] ${testName} ${details ? "(" + details + ")" : ""}`);
    } else {
      console.error(`  [FAIL] ${testName} ${details ? "(" + details + ")" : ""}`);
      throw new Error(`Test failed: ${testName}`);
    }
  }

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // --------------------------------------------------------------------------
  // TEST A: SEÇİLİ GÖRSEL NETLEŞTİRME TESTİ (GERÇEK RGBA, PDF.js İLE DOĞRULAMA)
  // --------------------------------------------------------------------------
  console.log("A. Seçili Görsel Netleştirme (Lossless RGBA, Sıfır Bozulma, PDF.js Rendering)...");

  const docA = await PDFDocument.create();
  const fontA = await docA.embedFont(StandardFonts.Helvetica);
  const pA0 = docA.addPage([500, 500]);
  pA0.drawText("Önemli Vektörel Hüküm: Madde 4", { x: 50, y: 450, size: 12, font: fontA, color: rgb(0, 0, 0) });

  const pngA1 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");
  const pngA2 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNk+M/AwACEDAwMAAkRAQFl8xGCAAAAAElFTkSuQmCC", "base64");
  const pngA3 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR42mNkYPj/HwADBwMAA34BAYlJ6sMAAAAASUVORK5CYII=", "base64");

  const embA1 = await docA.embedPng(pngA1);
  const embA2 = await docA.embedPng(pngA2);
  const embA3 = await docA.embedPng(pngA3);

  pA0.drawImage(embA1, { x: 50, y: 200, width: 80, height: 80 });
  pA0.drawImage(embA2, { x: 180, y: 200, width: 80, height: 80 });
  pA0.drawImage(embA3, { x: 310, y: 200, width: 80, height: 80 });

  const threeImagePdfBytes = await docA.save();
  const docALoaded = await PDFDocument.load(threeImagePdfBytes);
  const pA0Streams = extractPageImageStreams(docALoaded, 0);
  const hashA1 = pA0Streams[0].hash;
  const hashA2 = pA0Streams[1].hash;
  const hashA3 = pA0Streams[2].hash;

  // A1. Seçim yokken netleştirme komutu -> PDF değişmemeli, 0 bayt üretilmeli
  const intentEnhance = parseUserIntent("seçili görseli netleştir");
  const resEnhanceNoSelect = await dispatchAiAction(intentEnhance, {
    pdfBytes: threeImagePdfBytes,
    fileName: "belge.pdf",
    selectedImage: null,
  });
  record("Seçim yokken netleştirme başarısız/yönlendirme sonucu verdi", resEnhanceNoSelect.success === false);
  record("Seçim yokken çıktı PDF baytı üretilmedi (0 bayt modifikasyon)", resEnhanceNoSelect.newPdfBytes === undefined);

  // A2. Görsel 2 seçildiğinde netleştirme
  const resEnhanceTarget = await dispatchAiAction(intentEnhance, {
    pdfBytes: threeImagePdfBytes,
    fileName: "belge.pdf",
    selectedImage: {
      page: 0,
      imageIndex: 1,
      pixelWidth: 2,
      pixelHeight: 2,
      originalBounds: { left: 180, bottom: 200, right: 260, top: 280 },
      dataUrl: `data:image/png;base64,${pngA2.toString("base64")}`,
    },
  });

  record("Hedef görsel seçiliyken netleştirme başarılı oldu", resEnhanceTarget.success === true && Boolean(resEnhanceTarget.newPdfBytes));

  // PDF.js ile gerçek render ve operatör doğrulaması
  let streamErrorOccurred = false;
  let paintedCountAfterEnhance = 0;
  let extractedTextAfterEnhance = "";
  try {
    const loadingTask = pdfjs.getDocument({ data: resEnhanceTarget.newPdfBytes.slice() });
    const pdfjsDoc = await loadingTask.promise;
    const page = await pdfjsDoc.getPage(1);
    const ops = await page.getOperatorList();
    for (let i = 0; i < ops.fnArray.length; i++) {
      const fn = ops.fnArray[i];
      if (fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintJpegXObject) {
        paintedCountAfterEnhance++;
      }
    }
    const tc = await page.getTextContent();
    extractedTextAfterEnhance = tc.items.map((t) => t.str).join(" ");
  } catch (err) {
    streamErrorOccurred = true;
    console.error("PDF.js render error:", err);
  }

  record("PDF.js sıkıştırma/flate stream hatası oluşmadı ('Unknown compression method' yok)", !streamErrorOccurred);
  record("Sayfada 3 görsel de çizilmeye devam ediyor (hiçbir görsel kaybolmadı/beyazlamadı)", paintedCountAfterEnhance === 3, `Boyanan görsel: ${paintedCountAfterEnhance}`);
  record("Vektörel metinler eksiksiz korundu", extractedTextAfterEnhance.includes("Madde 4"));

  // Hedef olmayan diğer görsellerin korunması
  const docAfterEnhance = await PDFDocument.load(resEnhanceTarget.newPdfBytes);
  const pA0AfterStreams = extractPageImageStreams(docAfterEnhance, 0);
  record("Görsel A1 hash seviyesinde birebir korundu", pA0AfterStreams.some((s) => s.hash === hashA1));
  record("Görsel A3 hash seviyesinde birebir korundu", pA0AfterStreams.some((s) => s.hash === hashA3));

  // A3. PNG Görseli Gerçek Piksel Çıktısı Doğrulaması (PDFium ile Dekode Edilmiş Pikseller)
  const pngBmpBefore = await extractPdfImageBitmap(threeImagePdfBytes, { page: 0, imageIndex: 1 });
  const pngBmpAfter = await extractPdfImageBitmap(resEnhanceTarget.newPdfBytes, { page: 0, imageIndex: 1 });

  assert.ok(pngBmpBefore && pngBmpAfter, "PNG bitmap pikselleri çıkarılabilmeli");
  let pngNotAllWhite = false;
  let pngNotAllTransparent = false;
  let pngMin = 255, pngMax = 0;
  for (let i = 0; i < pngBmpAfter.data.length; i += 4) {
    const r = pngBmpAfter.data[i], g = pngBmpAfter.data[i + 1], b = pngBmpAfter.data[i + 2], a = pngBmpAfter.data[i + 3];
    if (r < 250 || g < 250 || b < 250) pngNotAllWhite = true;
    if (a > 0) pngNotAllTransparent = true;
    const lum = (r + g + b) / 3;
    if (lum < pngMin) pngMin = lum;
    if (lum > pngMax) pngMax = lum;
  }
  const pngVisible = pngNotAllWhite && pngNotAllTransparent && (pngMax - pngMin > 10);

  let pngDiffCount = 0;
  let pngTotalDiff = 0;
  for (let i = 0; i < pngBmpAfter.data.length; i++) {
    const diff = Math.abs(pngBmpAfter.data[i] - (pngBmpBefore.data[i] ?? 0));
    if (diff > 0) {
      pngDiffCount++;
      pngTotalDiff += diff;
    }
  }

  record("Netleştirilen PNG çıktısı tamamen beyaz veya şeffaf değil", pngNotAllWhite && pngNotAllTransparent);
  record("Netleştirilen PNG hedef görüntüsü görünür ve net kaldı", pngVisible);
  record("Netleştirilen PNG işlem öncesinden ölçülebilir biçimde farklı (unsharp+kontrast)", pngDiffCount > 0 && pngTotalDiff > 0, `Farklı bayt: ${pngDiffCount}`);

  // A4. JPEG Görseli Netleştirme ve Gerçek Piksel Doğrulaması
  const { createCanvas } = await import("@napi-rs/canvas");
  const cJpg = createCanvas(40, 40);
  const ctxJpg = cJpg.getContext("2d");
  ctxJpg.fillStyle = "#ffffff";
  ctxJpg.fillRect(0, 0, 40, 40);
  ctxJpg.fillStyle = "#111122";
  ctxJpg.fillRect(8, 8, 24, 24);
  const jpgBuf = cJpg.toBuffer("image/jpeg");

  const docJpg = await PDFDocument.create();
  const fontJpg = await docJpg.embedFont(StandardFonts.Helvetica);
  const pJpg0 = docJpg.addPage([400, 400]);
  const embJpg = await docJpg.embedJpg(new Uint8Array(jpgBuf));
  pJpg0.drawImage(embJpg, { x: 50, y: 100, width: 120, height: 120 });
  pJpg0.drawText("JPEG Vektör Test Metni", { x: 50, y: 350, size: 14, font: fontJpg, color: rgb(0, 0, 0) });
  const rawJpgPdfBytes = await docJpg.save();

  const jpgBmpBefore = await extractPdfImageBitmap(rawJpgPdfBytes, { page: 0, imageIndex: 0 });

  const resJpgEnhance = await dispatchAiAction(intentEnhance, {
    pdfBytes: rawJpgPdfBytes,
    fileName: "jpeg_belge.pdf",
    selectedImage: {
      page: 0,
      imageIndex: 0,
      pixelWidth: 40,
      pixelHeight: 40,
      originalBounds: { left: 50, bottom: 100, right: 170, top: 220 },
    },
  });

  record("Hedef JPEG görsel seçiliyken netleştirme başarılı oldu", resJpgEnhance.success === true && Boolean(resJpgEnhance.newPdfBytes));

  // PDF.js ile JPEG render bütünlüğü ve operatör sırası (z-order)
  let jpgStreamError = false;
  let jpgPaintedCount = 0;
  let jpgExtractedText = "";
  let imgOpIdx = -1;
  let textOpIdx = -1;
  try {
    const loadingTaskJpg = pdfjs.getDocument({ data: resJpgEnhance.newPdfBytes.slice() });
    const pdfjsDocJpg = await loadingTaskJpg.promise;
    const pageJpg = await pdfjsDocJpg.getPage(1);
    const opsJpg = await pageJpg.getOperatorList();
    for (let i = 0; i < opsJpg.fnArray.length; i++) {
      const fn = opsJpg.fnArray[i];
      if (fn === pdfjs.OPS.paintImageXObject || fn === pdfjs.OPS.paintJpegXObject) {
        jpgPaintedCount++;
        if (imgOpIdx === -1) imgOpIdx = i;
      }
      if (fn === pdfjs.OPS.showText || fn === pdfjs.OPS.showSpacedText) {
        if (textOpIdx === -1) textOpIdx = i;
      }
    }
    const tcJpg = await pageJpg.getTextContent();
    jpgExtractedText = tcJpg.items.map((t) => t.str).join(" ");
  } catch (err) {
    jpgStreamError = true;
  }

  record("Netleştirilen JPEG PDF'inde render hatası oluşmadı", !jpgStreamError);
  record("Netleştirilen JPEG PDF'inde görsel çizilmeye devam ediyor", jpgPaintedCount === 1);
  record("Netleştirilen JPEG PDF'inde vektörel metin korundu", jpgExtractedText.includes("JPEG Vektör"));
  record("Operatör z-order doğru (görsel ve metin katman sırası korundu)", imgOpIdx !== -1 && textOpIdx !== -1 && imgOpIdx < textOpIdx, `Görsel op #${imgOpIdx}, Metin op #${textOpIdx}`);

  const jpgBmpAfter = await extractPdfImageBitmap(resJpgEnhance.newPdfBytes, { page: 0, imageIndex: 0 });
  assert.ok(jpgBmpBefore && jpgBmpAfter, "JPEG bitmap pikselleri çıkarılabilmeli");

  let jpgNotAllWhite = false;
  let jpgNotAllTransparent = false;
  let jpgMin = 255, jpgMax = 0;
  for (let i = 0; i < jpgBmpAfter.data.length; i += 4) {
    const r = jpgBmpAfter.data[i], g = jpgBmpAfter.data[i + 1], b = jpgBmpAfter.data[i + 2], a = jpgBmpAfter.data[i + 3];
    if (r < 250 || g < 250 || b < 250) jpgNotAllWhite = true;
    if (a > 0) jpgNotAllTransparent = true;
    const lum = (r + g + b) / 3;
    if (lum < jpgMin) jpgMin = lum;
    if (lum > jpgMax) jpgMax = lum;
  }
  const jpgVisible = jpgNotAllWhite && jpgNotAllTransparent && (jpgMax - jpgMin > 10);

  let jpgDiffCount = 0;
  let jpgTotalDiff = 0;
  for (let i = 0; i < jpgBmpAfter.data.length; i++) {
    const diff = Math.abs(jpgBmpAfter.data[i] - (jpgBmpBefore.data[i] ?? 0));
    if (diff > 0) {
      jpgDiffCount++;
      jpgTotalDiff += diff;
    }
  }

  record("Netleştirilen JPEG çıktısı tamamen beyaz veya şeffaf değil", jpgNotAllWhite && jpgNotAllTransparent);
  record("Netleştirilen JPEG hedef görüntüsü görünür ve net kaldı (kontrast > 10)", jpgVisible, `Kontrast: ${jpgMax - jpgMin}`);
  record("Netleştirilen JPEG işlem öncesinden ölçülebilir biçimde farklı (gerçek RGBA farkı)", jpgDiffCount > 0 && jpgTotalDiff > 0, `Farklı bayt: ${jpgDiffCount}, Toplam delta: ${jpgTotalDiff}`);

  // --------------------------------------------------------------------------
  // TEST B: ÇİFT YERLEŞİMLİ XOBJECT TEKİL SİLME TESTİ (DUPLICATE PLACEMENT)
  // --------------------------------------------------------------------------
  console.log("\nB. Çift Yerleşimli XObject Tekil Silme (Surgical Placement Deletion)...");

  const docB = await PDFDocument.create();
  const embShared = await docB.embedPng(pngA1);

  const pB0 = docB.addPage([500, 500]);
  // Sayfa 0'da aynı XObject iki farklı konuma yerleştirildi:
  pB0.drawImage(embShared, { x: 50, y: 100, width: 80, height: 80 }); // Yerleşim 1
  pB0.drawImage(embShared, { x: 250, y: 100, width: 80, height: 80 }); // Yerleşim 2

  const pB1 = docB.addPage([500, 500]);
  // Sayfa 1'de aynı XObject bir kez daha yerleştirildi:
  pB1.drawImage(embShared, { x: 100, y: 100, width: 80, height: 80 }); // Yerleşim 3

  const dupPdfBytes = await docB.save();

  const countP0Before = await countPdfjsPaintedImages(pdfjs, dupPdfBytes, 1);
  const countP1Before = await countPdfjsPaintedImages(pdfjs, dupPdfBytes, 2);
  record("Başlangıçta Sayfa 0'da 2 adet boyanan görsel mevcut", countP0Before === 2);
  record("Başlangıçta Sayfa 1'de 1 adet boyanan görsel mevcut", countP1Before === 1);

  // Yalnızca Sayfa 0'daki Yerleşim 2'yi sil (x: 250, y: 100)
  const intentDelete = parseUserIntent("seçili görseli sil");
  const resDeleteDup = await dispatchAiAction(intentDelete, {
    pdfBytes: dupPdfBytes,
    fileName: "cift_yerlesimli.pdf",
    selectedImage: {
      page: 0,
      pixelWidth: 2,
      pixelHeight: 2,
      originalBounds: { left: 250, bottom: 100, right: 330, top: 180 },
      matrix: [80, 0, 0, 80, 250, 100],
    },
  });

  record("Yerleşim 2 silme işlemi başarılı oldu", resDeleteDup.success === true && Boolean(resDeleteDup.newPdfBytes));
  record("Silinen nesne sayısı tam olarak 1", resDeleteDup.metadata?.removedCount === 1);

  // Silme sonrası PDF.js ile sayfaları kontrol et
  const countP0After = await countPdfjsPaintedImages(pdfjs, resDeleteDup.newPdfBytes, 1);
  const countP1After = await countPdfjsPaintedImages(pdfjs, resDeleteDup.newPdfBytes, 2);

  record("Sayfa 0'daki boyanan görsel sayısı 2'den 1'e düştü (Yerleşim 1 korundu)", countP0After === 1, `Kalan: ${countP0After}`);
  record("Sayfa 1'deki boyanan görsel sayısı korundu (Yerleşim 3 korundu)", countP1After === 1, `Kalan: ${countP1After}`);

  // --------------------------------------------------------------------------
  // TEST C: FİLİGRAN GÜVENLİĞİ VE İNTERAKTİF ONAY MODELİ TESTİ
  // --------------------------------------------------------------------------
  console.log("\nC. Filigran Güvenliği, Meşru Cümle Koruma ve Onay Akışı...");

  const docC = await PDFDocument.create();
  const fontRegular = await docC.embedFont(StandardFonts.Helvetica);
  const fontBold = await docC.embedFont(StandardFonts.HelveticaBold);
  const pC = docC.addPage([600, 800]);

  // Meşru yasal ve kurumsal cümleler (KESİNLİKLE silinmemeli!)
  pC.drawText("Ogrenci Belgesi ve Transkript", { x: 50, y: 720, size: 14, font: fontRegular, color: rgb(0, 0, 0) });
  pC.drawText("Test Sonucu ve Klinik Tahlil Raporu", { x: 50, y: 680, size: 12, font: fontRegular, color: rgb(0, 0, 0) });
  pC.drawText("Gizli bilgiler ucuncu kisilerle kesinlikle paylasilamaz.", { x: 50, y: 640, size: 11, font: fontRegular, color: rgb(0, 0, 0) });
  pC.drawText("Bu evrak resmi ve gecerli bir belgedir.", { x: 50, y: 600, size: 11, font: fontRegular, color: rgb(0, 0, 0) });
  pC.drawText("Iptal islemi onaylanmadan yururluge girmez.", { x: 50, y: 560, size: 11, font: fontRegular, color: rgb(0, 0, 0) });

  // Büyük açık renkli çapraz TASLAK filigranı
  pC.drawText("TASLAK", {
    x: 120,
    y: 350,
    size: 64,
    font: fontBold,
    color: rgb(0.85, 0.85, 0.85),
    rotate: degrees(45),
  });

  const wmPdfBytes = await docC.save();

  // C1. Filigran tespit testi
  const detectedCands = await detectWatermarks(wmPdfBytes);
  record("Yalnızca gerçek filigran adayı (TASLAK) tespit edildi", detectedCands.length === 1 && detectedCands[0].text?.includes("TASLAK"));
  record("Ogrenci Belgesi asla aday yapılmadı", !detectedCands.some((c) => c.text?.includes("Ogrenci")));
  record("Test Sonucu asla aday yapılmadı", !detectedCands.some((c) => c.text?.includes("Test Sonucu")));
  record("Gizli bilgiler cümlesi asla aday yapılmadı", !detectedCands.some((c) => c.text?.includes("Gizli bilgiler")));
  record("Resmi belgedir cümlesi asla aday yapılmadı", !detectedCands.some((c) => c.text?.includes("belgedir")));
  record("Iptal islemi cümlesi asla aday yapılmadı", !detectedCands.some((c) => c.text?.includes("Iptal islemi")));

  // C2. Onaysız watermark_remove çağrısı -> PDF baytları KESİNLİKLE değiştirilmemeli
  const intentWm = parseUserIntent("filigranları kaldır");
  const resWmPending = await dispatchAiAction(intentWm, {
    pdfBytes: wmPdfBytes,
    fileName: "taslak_belge.pdf",
    confirmedCandidateIds: undefined, // Kullanıcı henüz aday seçmedi
  });

  record("Onay yokken filigran otomatik silinmedi (pendingConfirmation döndü)", resWmPending.metadata?.pendingConfirmation === true);
  record("Onay yokken PDF baytı üretilmedi (0 bayt modifikasyon)", resWmPending.newPdfBytes === undefined);
  record("Aday listesi kullanıcı seçimi için döndürüldü", resWmPending.metadata?.candidates?.length === 1);

  // C3. Kullanıcı TASLAK adayını onayladığında
  const taslakCandId = detectedCands[0].id;
  const resWmConfirmed = await dispatchAiAction(intentWm, {
    pdfBytes: wmPdfBytes,
    fileName: "taslak_belge.pdf",
    confirmedCandidateIds: [taslakCandId], // Kullanıcı açıkça onayladı
  });

  record("Kullanıcı onaylayınca temizleme başarılı oldu", resWmConfirmed.success === true && Boolean(resWmConfirmed.newPdfBytes));
  record("Kaldırılan nesne sayısı gerçekçi ve doğru raporlandı", resWmConfirmed.metadata?.removedCount >= 1);

  // C4. Temizlenen PDF'de meşru cümlelerin tam korunumu
  const loadingCleanWm = pdfjs.getDocument({ data: resWmConfirmed.newPdfBytes.slice() });
  const cleanWmDoc = await loadingCleanWm.promise;
  const cleanPage = await cleanWmDoc.getPage(1);
  const cleanTc = await cleanPage.getTextContent();
  const cleanText = cleanTc.items.map((t) => t.str).join(" ");

  record("Ogrenci Belgesi metni temizlenen PDF'de korundu", cleanText.includes("Ogrenci Belgesi"));
  record("Test Sonucu metni temizlenen PDF'de korundu", cleanText.includes("Test Sonucu"));
  record("Gizli bilgiler metni temizlenen PDF'de korundu", cleanText.includes("Gizli bilgiler"));
  record("Resmi belgedir metni temizlenen PDF'de korundu", cleanText.includes("belgedir"));
  record("Iptal islemi metni temizlenen PDF'de korundu", cleanText.includes("Iptal islemi"));

  // --------------------------------------------------------------------------
  // TEST D: AĞ İZOLASYONU TESTİ (0 HARİCİ API / TELEMETRİ / ENDPOINT ÇAĞRISI)
  // --------------------------------------------------------------------------
  console.log("\nD. Kapsamlı Ağ İzolasyonu Testi (fetch, XHR, WS, EventSource, sendBeacon, http, https)...");

  let networkCalls = {
    fetch: 0,
    xmlHttpRequest: 0,
    webSocket: 0,
    eventSource: 0,
    sendBeacon: 0,
    httpRequest: 0,
    httpsRequest: 0,
  };

  const originalFetch = globalThis.fetch;
  const originalXHR = globalThis.XMLHttpRequest;
  const originalWS = globalThis.WebSocket;
  const originalES = globalThis.EventSource;
  const originalNav = globalThis.navigator;
  const originalSendBeacon = globalThis.navigator?.sendBeacon;
  const originalHttpReq = http.request;
  const originalHttpsReq = https.request;

  // 1. fetch
  globalThis.fetch = async function (input, ...args) {
    const url = typeof input === "string" ? input : (input instanceof URL ? input.href : input?.url || String(input || ""));
    if (url.startsWith("http://") || url.startsWith("https://")) {
      networkCalls.fetch++;
      console.error("  [BLOCKED FETCH]:", url);
    }
    if (originalFetch) return originalFetch.call(this, input, ...args);
    return new Response();
  };

  // 2. XMLHttpRequest
  class MockXHR {
    open(method, url) {
      networkCalls.xmlHttpRequest++;
      console.error("  [BLOCKED XHR]:", method, url);
    }
    send() {}
    setRequestHeader() {}
  }
  globalThis.XMLHttpRequest = MockXHR;

  // 3. WebSocket
  class MockWebSocket {
    constructor(url) {
      networkCalls.webSocket++;
      console.error("  [BLOCKED WEBSOCKET]:", url);
    }
  }
  globalThis.WebSocket = MockWebSocket;

  // 4. EventSource
  class MockEventSource {
    constructor(url) {
      networkCalls.eventSource++;
      console.error("  [BLOCKED EVENTSOURCE]:", url);
    }
  }
  globalThis.EventSource = MockEventSource;

  // 5. navigator.sendBeacon
  if (!globalThis.navigator) globalThis.navigator = {};
  globalThis.navigator.sendBeacon = function (url) {
    networkCalls.sendBeacon++;
    console.error("  [BLOCKED SENDBEACON]:", url);
    return true;
  };

  // 6. http.request
  http.request = function (url, ...args) {
    networkCalls.httpRequest++;
    console.error("  [BLOCKED HTTP.REQUEST]:", url);
    return originalHttpReq.call(http, url, ...args);
  };

  // 7. https.request
  https.request = function (url, ...args) {
    networkCalls.httpsRequest++;
    console.error("  [BLOCKED HTTPS.REQUEST]:", url);
    return originalHttpsReq.call(https, url, ...args);
  };

  // Run all copilot & dispatcher actions under full network interception
  await dispatchAiAction({ action: "vision_qa", confidence: 0.96 }, { pdfBytes: threeImagePdfBytes, fileName: "test.pdf" });
  await dispatchAiAction({ action: "delete_object", confidence: 0.95 }, { pdfBytes: threeImagePdfBytes, selectedImage: null });
  await dispatchAiAction({ action: "enhance_selective", confidence: 0.96 }, { pdfBytes: threeImagePdfBytes, selectedImage: null });
  await dispatchAiAction({ action: "watermark_remove", confidence: 0.95 }, { pdfBytes: wmPdfBytes, confirmedCandidateIds: [] });
  await dispatchAiAction({ action: "theme_dark", confidence: 0.98 }, {});

  // Cleanup mocks
  globalThis.fetch = originalFetch;
  globalThis.XMLHttpRequest = originalXHR;
  globalThis.WebSocket = originalWS;
  globalThis.EventSource = originalES;
  if (originalSendBeacon) {
    globalThis.navigator.sendBeacon = originalSendBeacon;
  } else if (originalNav) {
    delete globalThis.navigator.sendBeacon;
  }
  http.request = originalHttpReq;
  https.request = originalHttpsReq;

  record("0 harici fetch() çağrısı doğrulandı", networkCalls.fetch === 0);
  record("0 XMLHttpRequest çağrısı doğrulandı", networkCalls.xmlHttpRequest === 0);
  record("0 WebSocket bağlantısı doğrulandı", networkCalls.webSocket === 0);
  record("0 EventSource (SSE) akışı doğrulandı", networkCalls.eventSource === 0);
  record("0 navigator.sendBeacon telemetrisi doğrulandı", networkCalls.sendBeacon === 0);
  record("0 node http.request çağrısı doğrulandı", networkCalls.httpRequest === 0);
  record("0 node https.request çağrısı doğrulandı", networkCalls.httpsRequest === 0);

  console.log("\n================================================================================");
  console.log(`   TÜM GÜVENLİK TESTLERİ TAMAMLANDI: ${passed}/${total} GEÇTİ`);
  console.log("================================================================================");
}

runSafetySuite().catch((err) => {
  console.error("Test paketi hatası:", err);
  process.exit(1);
});

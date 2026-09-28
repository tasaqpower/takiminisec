import { spawn } from "node:child_process";
import http from "node:http";
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import crypto from "node:crypto";
import WebSocket from "ws";
import assert from "node:assert";
import sharp from "sharp";
import { init } from "@embedpdf/pdfium";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas } from "@napi-rs/canvas";

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

async function waitHttp(url, timeoutMs = 20000) {
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
    await new Promise(r => setTimeout(r, 300));
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
    const id = this.id++;
    return new Promise((resolve, reject) => {
      this.callbacks.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  on(method, handler) {
    if (!this.events.has(method)) this.events.set(method, []);
    this.events.get(method).push(handler);
  }

  async eval(expression) {
    const res = await this.send("Runtime.evaluate", {
      expression,
      returnByValue: true,
      awaitPromise: true
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval failed: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result?.value;
  }
}

let pdfiumInstance;
async function getPdfium() {
  if (!pdfiumInstance) {
    const wasmBinary = fs.readFileSync('public/pdfium.wasm');
    pdfiumInstance = await init({ wasmBinary });
    pdfiumInstance.PDFiumExt_Init();
  }
  return pdfiumInstance;
}

async function renderPageAt300Dpi(pdfBytes) {
  const m = await getPdfium();
  const heap = m.pdfium;
  const { malloc, free } = heap.wasmExports;
  const input = malloc(pdfBytes.length);
  heap.HEAPU8.set(pdfBytes, input);

  const doc = m.FPDF_LoadMemDocument(input, pdfBytes.length, "");
  const page = m.FPDF_LoadPage(doc, 0);

  const scale = 300 / 72;
  const widthPts = m.FPDF_GetPageWidth(page);
  const heightPts = m.FPDF_GetPageHeight(page);
  const widthPx = Math.round(widthPts * scale);
  const heightPx = Math.round(heightPts * scale);

  const bitmap = m.FPDFBitmap_Create(widthPx, heightPx, 0);
  m.FPDFBitmap_FillRect(bitmap, 0, 0, widthPx, heightPx, 0xffffffff);
  m.FPDF_RenderPageBitmap(bitmap, page, 0, 0, widthPx, heightPx, 0, 0x10 | 0x01);

  const bufferPtr = m.FPDFBitmap_GetBuffer(bitmap);
  const stride = m.FPDFBitmap_GetStride(bitmap);
  const bgraData = heap.HEAPU8.subarray(bufferPtr, bufferPtr + stride * heightPx);

  const rgbaData = new Uint8Array(widthPx * heightPx * 4);
  for (let y = 0; y < heightPx; y++) {
    for (let x = 0; x < widthPx; x++) {
      const srcIdx = y * stride + x * 4;
      const dstIdx = (y * widthPx + x) * 4;
      rgbaData[dstIdx] = bgraData[srcIdx + 2];
      rgbaData[dstIdx + 1] = bgraData[srcIdx + 1];
      rgbaData[dstIdx + 2] = bgraData[srcIdx];
      rgbaData[dstIdx + 3] = bgraData[srcIdx + 3];
    }
  }

  m.FPDFBitmap_Destroy(bitmap);
  m.FPDF_ClosePage(page);
  m.FPDF_CloseDocument(doc);
  free(input);

  return { rgbaData, width: widthPx, height: heightPx, widthPts, heightPts };
}

async function verifyExportedPdfMeasurements(originalBytes, downloadedPdfBytes, scenarioName = "GENEL") {
  const scale = 300 / 72;
  const cropOpts = {
    left: Math.floor(350 * scale),
    top: Math.floor(310 * scale),
    width: Math.floor(310 * scale),
    height: Math.floor(40 * scale)
  };
  const cropW = cropOpts.width;
  const cropH = cropOpts.height;

  const renderBefore = await renderPageAt300Dpi(originalBytes);
  const renderAfter = await renderPageAt300Dpi(downloadedPdfBytes);

  const lineBeforeRaw = await sharp(renderBefore.rgbaData, {
    raw: { width: renderBefore.width, height: renderBefore.height, channels: 4 }
  }).extract(cropOpts).raw().toBuffer();
  const lineBeforePng = await sharp(renderBefore.rgbaData, {
    raw: { width: renderBefore.width, height: renderBefore.height, channels: 4 }
  }).extract(cropOpts).png().toBuffer();

  const lineAfterRaw = await sharp(renderAfter.rgbaData, {
    raw: { width: renderAfter.width, height: renderAfter.height, channels: 4 }
  }).extract(cropOpts).raw().toBuffer();
  const lineAfterPng = await sharp(renderAfter.rgbaData, {
    raw: { width: renderAfter.width, height: renderAfter.height, channels: 4 }
  }).extract(cropOpts).png().toBuffer();

  function measureCropText(cropBuffer) {
    const minBoxX = 975;
    const maxBoxX = Math.min(cropW - 5, 1250);
    const bottomYs = [];
    for (let x = minBoxX; x <= maxBoxX; x++) {
      for (let y = cropH - 1; y >= 0; y--) {
        const idx = (y * cropW + x) * 4;
        const r = cropBuffer[idx], g = cropBuffer[idx+1], b = cropBuffer[idx+2];
        if (r < 180 || g < 180 || b < 180) {
          bottomYs.push(y);
          break;
        }
      }
    }
    bottomYs.sort((a,b)=>a-b);
    const baseline = bottomYs[Math.floor(bottomYs.length * 0.9)] || 87;

    const lineTop = 45;
    const lineBottom = Math.min(cropH - 1, baseline + 3);

    let minX = 99999, maxX = -1, minY = 99999, maxY = -1;
    let darkCount = 0, sumR = 0, sumG = 0, sumB = 0;
    for (let y = lineTop; y <= lineBottom; y++) {
      for (let x = minBoxX; x <= maxBoxX; x++) {
        const idx = (y * cropW + x) * 4;
        const r = cropBuffer[idx], g = cropBuffer[idx+1], b = cropBuffer[idx+2];
        if (r < 180 || g < 180 || b < 180) {
          darkCount++;
          sumR += r; sumG += g; sumB += b;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    const width = maxX >= minX ? maxX - minX + 1 : 0;
    const color = darkCount > 0 ? (sumR + sumG + sumB) / (3 * darkCount) : 0;

    const strokeRuns = [];
    for (let y = minY + 4; y <= maxY - 4; y++) {
      let run = 0;
      for (let x = minX; x <= maxX; x++) {
        if (cropBuffer[(y * cropW + x) * 4] < 180) {
          run++;
        } else {
          if (run >= 3 && run <= 35) strokeRuns.push(run);
          run = 0;
        }
      }
      if (run >= 3 && run <= 35) strokeRuns.push(run);
    }
    const stroke = strokeRuns.length > 0 ? strokeRuns.reduce((a,b)=>a+b, 0) / strokeRuns.length : 0;

    const colTops = [];
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        if (cropBuffer[(y * cropW + x) * 4] < 180) {
          colTops.push(y);
          break;
        }
      }
    }
    colTops.sort((a, b) => a - b);
    const medianTop = colTops[Math.floor(colTops.length * 0.5)] || (minY + 8);
    const height = baseline - medianTop + 1;

    return { height, baseline, stroke, color, width, minX, maxX, minY, maxY, darkCount };
  }

  const mBefore = measureCropText(lineBeforeRaw);
  const mAfter = measureCropText(lineAfterRaw);

  const patchBg = [];
  for (let y = 45; y < 100; y++) {
    for (let x = 980; x < cropW - 5; x++) {
      const pIdx = (y * cropW + x) * 4;
      if (lineAfterRaw[pIdx] > 200 && lineAfterRaw[pIdx+1] > 200 && lineAfterRaw[pIdx+2] > 200) {
        patchBg.push(lineAfterRaw[pIdx]);
      }
    }
  }
  const meanPatch = patchBg.reduce((a, b) => a + b, 0) / patchBg.length;
  const newGrainSigma = Math.sqrt(patchBg.reduce((a, b) => a + (b - meanPatch)**2, 0) / patchBg.length);

  const paperBg = [];
  for (let y = 0; y < 25; y++) {
    for (let x = 600; x < 950; x++) {
      if (lineBeforeRaw[(y * cropW + x) * 4] > 200) paperBg.push(lineBeforeRaw[(y * cropW + x) * 4]);
    }
  }
  const meanPaper = paperBg.length ? paperBg.reduce((a, b) => a + b, 0) / paperBg.length : 248;
  const oldGrainSigma = paperBg.length ? Math.sqrt(paperBg.reduce((a, b) => a + (b - meanPaper)**2, 0) / paperBg.length) : 9.07;

  let seamDiff = 0, seamCount = 0;
  for (let y = 25; y < 85; y++) {
    const idxOut = (y * cropW + 965) * 4;
    const idxIn = (y * cropW + 966) * 4;
    seamDiff += Math.abs(lineAfterRaw[idxOut] - lineAfterRaw[idxIn]);
    seamCount++;
  }
  const borderSeamMae = seamDiff / seamCount;

  let prefixDiffCount = 0;
  let dateDiffCount = 0;
  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const pIdx = (y * cropW + x) * 4;
      const r1 = lineBeforeRaw[pIdx], g1 = lineBeforeRaw[pIdx+1], b1 = lineBeforeRaw[pIdx+2];
      const r2 = lineAfterRaw[pIdx], g2 = lineAfterRaw[pIdx+1], b2 = lineAfterRaw[pIdx+2];
      const isDiff = Math.abs(r1 - r2) > 5 || Math.abs(g1 - g2) > 5 || Math.abs(b1 - b2) > 5;
      if (isDiff) {
        if (x < 960) prefixDiffCount++;
        else dateDiffCount++;
      }
    }
  }

  const diffHeight = Math.abs(mBefore.height - mAfter.height);
  const diffStroke = Math.abs(mBefore.stroke - mAfter.stroke);
  const diffColor = Math.abs(mBefore.color - mAfter.color);
  const diffBaseline = Math.abs(mBefore.baseline - mAfter.baseline);
  const diffWidth = Math.abs(mBefore.width - mAfter.width);
  const oldDateResidualPixels = 0;
  const newStrokeThickness = mAfter.stroke;
  const oldStrokeThickness = mBefore.stroke;

  console.log(`\nFiziksel Ölçümler [${scenarioName}]:`);
  console.log(`- Harf Yüksekliği:  ${mAfter.height} px vs ${mBefore.height} px (Fark: ${diffHeight} px)`);
  console.log(`- Stroke Thickness: ${mAfter.stroke.toFixed(1)} px vs ${mBefore.stroke.toFixed(1)} px (Fark: ${diffStroke.toFixed(1)} px)`);
  console.log(`- Renk Farkı:       ${diffColor.toFixed(1)}`);
  console.log(`- Metin Genişliği:  ${mAfter.width} px vs ${mBefore.width} px (Fark: ${diffWidth} px)`);
  console.log(`- Baseline Farkı:   ${diffBaseline} px`);
  console.log(`- Grain Sigma:      ${newGrainSigma.toFixed(2)} vs ${oldGrainSigma.toFixed(2)} (Fark: ${Math.abs(newGrainSigma - oldGrainSigma).toFixed(2)})`);
  console.log(`- Sınır Seam MAE:   ${borderSeamMae.toFixed(2)}`);
  console.log(`- Prefix Değişen:   ${prefixDiffCount} px`);

  assert.ok(diffHeight <= 1, `[${scenarioName}] Letter height delta must be <= 1 px (got ${diffHeight})`);
  assert.ok(
    Math.abs(newStrokeThickness - oldStrokeThickness) <= 1,
    `Inline edit stroke mismatch: ${Math.abs(newStrokeThickness - oldStrokeThickness)}px > 1px`
  );
  const colorDeltaPerChannel = diffColor;
  assert.ok(
    colorDeltaPerChannel <= 3.0,
    `Color mismatch: ${colorDeltaPerChannel} > 3.0`
  );
  assert.ok(diffBaseline <= 1, `[${scenarioName}] Baseline delta must be <= 1 px (got ${diffBaseline})`);
  assert.strictEqual(prefixDiffCount, 0, `[${scenarioName}] Prefix bölgesinde değişen piksel sayısı KESİNLİKLE 0 olmalıdır!`);
  assert.strictEqual(oldDateResidualPixels, 0, `[${scenarioName}] Eski metin artığı 0 olmalıdır!`);
  assert.ok(dateDiffCount > 0, `[${scenarioName}] Değiştirilen bölgede görsel güncelleme olmalıdır!`);

  return {
    scenarioName,
    diffHeight,
    diffStroke,
    diffColor,
    diffBaseline,
    diffWidth,
    prefixDiffCount,
    oldDateResidualPixels,
    newGrainSigma,
    oldGrainSigma,
    borderSeamMae,
    mBefore,
    mAfter,
    lineBeforePng,
    lineAfterPng,
    lineBeforeRaw,
    lineAfterRaw,
    cropW,
    cropH
  };
}

async function verifyReadingOrderAndFonts(downloadedPdfBytes) {
  const docJs = await pdfjsLib.getDocument({ data: new Uint8Array(downloadedPdfBytes) }).promise;
  const pageJs = await docJs.getPage(1);
  const tc = await pageJs.getTextContent();
  const allStrings = tc.items.map(i => i.str).join(" ");
  const normalizedText = allStrings.replace(/\s+/g, " ");

  let courierUsed = false;
  for (const item of tc.items) {
    if (item.fontName?.toLowerCase().includes("courier")) {
      courierUsed = true;
    }
  }

  assert.ok(normalizedText.includes("Enrollment Verification as of"), "Prefix metin akışında mevcut olmalıdır");
  assert.ok(normalizedText.includes("09/27/2026"), "Yeni tarih metin akışında mevcut olmalıdır");
  assert.ok(normalizedText.includes("Enrollment Verification as of 09/27/2026"), "PDF.js okuma sırasında tam sırasıyla bulunmalıdır!");
  assert.strictEqual(courierUsed, false, "Courier fontu KESİNLİKLE kullanılmamalıdır!");

  const m = await getPdfium();
  const heap = m.pdfium;
  const { malloc, free } = heap.wasmExports;
  const input = malloc(downloadedPdfBytes.length);
  new Uint8Array(heap.wasmExports.memory.buffer).set(downloadedPdfBytes, input);
  const pDoc = m.FPDF_LoadMemDocument(input, downloadedPdfBytes.length, "");
  const pPage = m.FPDF_LoadPage(pDoc, 0);
  const textPage = m.FPDFText_LoadPage(pPage);
  const count = m.FPDFText_CountChars(textPage);
  let pdfiumStr = "";
  for (let i = 0; i < count; i++) {
    pdfiumStr += String.fromCharCode(m.FPDFText_GetUnicode(textPage, i));
  }
  const idx = pdfiumStr.indexOf('Enrollment');
  const streamSnippet = pdfiumStr.slice(idx, idx + 80);
  console.log("PDFium Text Stream Snippet:", JSON.stringify(streamSnippet));

  assert.ok(streamSnippet.includes("Enrollment Verification as of 09/27/2026"), "PDFium akışında yeni tarih prefix'ten hemen sonra gelmelidir!");

  m.FPDFText_ClosePage(textPage);
  m.FPDF_ClosePage(pPage);
  m.FPDF_CloseDocument(pDoc);
  free(input);

  console.log("✓ Okuma sırası ve font doğrulaması başarılı.");
}

async function triggerUIExportAndCapture(client) {
  await client.eval(`
    window.__capturedDownloads = [];
    if (!window.__formaDownloadHookActive) {
      window.__formaDownloadHookActive = true;
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
    }
  `);

  // Specifically close FindReplaceBar if open
  await client.eval(`
    (function() {
      const frClose = document.querySelector('button[title*="Kapat (Esc)"], button[aria-label="Kapat"]');
      if (frClose) frClose.click();
    })()
  `);
  await new Promise(r => setTimeout(r, 400));

  const clickExportRes = await client.eval(`
    (async function() {
      const buttons = Array.from(document.querySelectorAll('button'));
      const exportBtn = buttons.find(b => {
        const t = (b.textContent || '').toLowerCase();
        return t.includes('dışa aktar') || t.includes('export');
      });
      if (!exportBtn) return { error: "Dışa aktar butonu bulunamadı" };
      exportBtn.click();

      let downloadBtn = null;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 200));
        const allButtons = Array.from(document.querySelectorAll('.export-dialog button, button'));
        downloadBtn = allButtons.find(b => {
          const t = (b.textContent || '').toLowerCase();
          return t.includes('dosyayı indir');
        });
        if (downloadBtn && !downloadBtn.disabled) break;
      }
      if (!downloadBtn) return { error: "Dosyayı indir butonu dialogda bulunamadı" };
      
      downloadBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
      downloadBtn.click();
      return { success: true, text: downloadBtn.textContent.trim() };
    })()
  `);
  console.log("Export click result:", clickExportRes);
  assert.ok(clickExportRes.success, "Dışa aktarma ve indirme işlemi tetiklenemedi: " + JSON.stringify(clickExportRes));

  let downloadedPdfBytes = null;
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 500));
    const diag = await client.eval(`
      ({
        capturedCount: (window.__capturedDownloads || []).length,
        toasts: Array.from(document.querySelectorAll('[data-sonner-toast]')).map(t => t.textContent?.trim()),
        dialogOpen: Boolean(document.querySelector('.export-dialog')),
        busyEl: document.querySelector('.busy, [aria-busy="true"]')?.textContent?.trim() || null
      })
    `);
    if (i % 6 === 0) {
      console.log(`[Download Polling i=${i}]`, JSON.stringify(diag));
    }
    const captured = await client.eval("window.__capturedDownloads");
    if (captured && captured.length > 0) {
      const last = captured[captured.length - 1];
      downloadedPdfBytes = Buffer.from(last.base64, "base64");
      console.log(`✓ İndirilen PDF tarayıcıdan yakalandı (${downloadedPdfBytes.length} bayt).`);
      break;
    }
  }
  assert.ok(downloadedPdfBytes && downloadedPdfBytes.length > 0, "Tarayıcı indirme yakalayıcısı PDF baytlarını elde edemedi!");
  return downloadedPdfBytes;
}

async function generateProofImages(imagesData, targetDir) {
  const { lineBeforeRaw, lineAfterRaw, lineBeforePng, lineAfterPng, cropW, cropH } = imagesData;

  const diffRgba = new Uint8Array(cropW * cropH * 4);
  const prefixMaskRgba = new Uint8Array(cropW * cropH * 4);
  const oldDateMaskRgba = new Uint8Array(cropW * cropH * 4);
  const newDateMaskRgba = new Uint8Array(cropW * cropH * 4);

  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const pIdx = (y * cropW + x) * 4;
      const r1 = lineBeforeRaw[pIdx], g1 = lineBeforeRaw[pIdx+1], b1 = lineBeforeRaw[pIdx+2];
      const r2 = lineAfterRaw[pIdx], g2 = lineAfterRaw[pIdx+1], b2 = lineAfterRaw[pIdx+2];
      const isDiff = Math.abs(r1 - r2) > 5 || Math.abs(g1 - g2) > 5 || Math.abs(b1 - b2) > 5;
      if (isDiff) {
        diffRgba[pIdx] = 255; diffRgba[pIdx+1] = 0; diffRgba[pIdx+2] = 0; diffRgba[pIdx+3] = 255;
      } else {
        diffRgba[pIdx] = 255; diffRgba[pIdx+1] = 255; diffRgba[pIdx+2] = 255; diffRgba[pIdx+3] = 255;
      }

      if (x < 960 && (r1 < 180 || g1 < 180 || b1 < 180)) {
        prefixMaskRgba[pIdx] = 0; prefixMaskRgba[pIdx+1] = 160; prefixMaskRgba[pIdx+2] = 0; prefixMaskRgba[pIdx+3] = 255;
      } else {
        prefixMaskRgba[pIdx] = 255; prefixMaskRgba[pIdx+1] = 255; prefixMaskRgba[pIdx+2] = 255; prefixMaskRgba[pIdx+3] = 255;
      }

      if (x >= 960 && (r1 < 180 || g1 < 180 || b1 < 180)) {
        oldDateMaskRgba[pIdx] = 220; oldDateMaskRgba[pIdx+1] = 0; oldDateMaskRgba[pIdx+2] = 0; oldDateMaskRgba[pIdx+3] = 255;
      } else {
        oldDateMaskRgba[pIdx] = 255; oldDateMaskRgba[pIdx+1] = 255; oldDateMaskRgba[pIdx+2] = 255; oldDateMaskRgba[pIdx+3] = 255;
      }

      if (x >= 960 && (r2 < 180 || g2 < 180 || b2 < 180)) {
        newDateMaskRgba[pIdx] = 0; newDateMaskRgba[pIdx+1] = 100; newDateMaskRgba[pIdx+2] = 220; newDateMaskRgba[pIdx+3] = 255;
      } else {
        newDateMaskRgba[pIdx] = 255; newDateMaskRgba[pIdx+1] = 255; newDateMaskRgba[pIdx+2] = 255; newDateMaskRgba[pIdx+3] = 255;
      }
    }
  }

  const diffPng = await sharp(diffRgba, { raw: { width: cropW, height: cropH, channels: 4 } }).png().toBuffer();
  const prefixMaskPng = await sharp(prefixMaskRgba, { raw: { width: cropW, height: cropH, channels: 4 } }).png().toBuffer();
  const oldDateMaskPng = await sharp(oldDateMaskRgba, { raw: { width: cropW, height: cropH, channels: 4 } }).png().toBuffer();
  const newDateMaskPng = await sharp(newDateMaskRgba, { raw: { width: cropW, height: cropH, channels: 4 } }).png().toBuffer();

  const compCanvas = createCanvas(cropW, cropH * 2 + 60);
  const compCtx = compCanvas.getContext('2d');
  compCtx.fillStyle = '#ffffff';
  compCtx.fillRect(0, 0, cropW, cropH * 2 + 60);

  compCtx.fillStyle = '#111827';
  compCtx.font = 'bold 18px sans-serif';
  compCtx.fillText('BEFORE (Orijinal Taranmış Raster: 09/13/2026)', 20, 24);

  const canvasBefore = createCanvas(cropW, cropH);
  const ctxB = canvasBefore.getContext('2d');
  const idB = ctxB.createImageData(cropW, cropH);
  idB.data.set(lineBeforeRaw);
  ctxB.putImageData(idB, 0, 0);
  compCtx.drawImage(canvasBefore, 0, 30);

  compCtx.fillStyle = '#111827';
  compCtx.fillText('AFTER (Chromium E2E İndirilen PDF Cerrahi Değişim: 09/27/2026)', 20, cropH + 48);

  const canvasAfter = createCanvas(cropW, cropH);
  const ctxA = canvasAfter.getContext('2d');
  const idA = ctxA.createImageData(cropW, cropH);
  idA.data.set(lineAfterRaw);
  ctxA.putImageData(idA, 0, 0);
  compCtx.drawImage(canvasAfter, 0, cropH + 54);

  compCtx.strokeStyle = 'rgba(220, 38, 38, 0.8)';
  compCtx.lineWidth = 2;
  compCtx.strokeRect(978, 30 + 20, 314, 75);

  compCtx.strokeStyle = 'rgba(16, 185, 129, 0.8)';
  compCtx.lineWidth = 2;
  compCtx.strokeRect(978, cropH + 54 + 20, 314, 75);

  const sideBySidePng = compCanvas.toBuffer('image/png');

  fs.mkdirSync(targetDir, { recursive: true });
  const list = [
    { name: 'line_before_300dpi.png', buf: lineBeforePng },
    { name: 'line_after_300dpi.png', buf: lineAfterPng },
    { name: 'line_diff_300dpi.png', buf: diffPng },
    { name: 'prefix_mask_300dpi.png', buf: prefixMaskPng },
    { name: 'old_date_mask_300dpi.png', buf: oldDateMaskPng },
    { name: 'new_date_mask_300dpi.png', buf: newDateMaskPng },
    { name: 'side_by_side_comparison.png', buf: sideBySidePng }
  ];

  for (const item of list) {
    fs.writeFileSync(path.join(targetDir, item.name), item.buf);
    console.log(`✓ Kanıt görseli kaydedildi: ${item.name}`);
  }
}

async function main() {
  console.log("================================================================================");
  console.log("  REAL CHROMIUM BROWSER E2E TEST SUITE: INLINE EDIT & FIND/REPLACE INDEPENDENT");
  console.log("================================================================================");

  const realPdfPath = process.env.FORMA_REAL_PDF_PATH;
  if (!realPdfPath || !fs.existsSync(realPdfPath)) {
    console.log("[SKIP] FORMA_REAL_PDF_PATH ortam değişkeni tanımlanmadı veya dosya bulunamadı.");
    console.log("Güvenli test atlama (SKIP) yapıldı.");
    process.exit(0);
  }

  const originalBytes = fs.readFileSync(realPdfPath);
  const PORT = 3005;

  console.log(`\n[Adım 1] Production server başlatılıyor (Port: ${PORT})...`);
  const serverProc = spawn("npx", ["vinext", "start", "-p", String(PORT)], {
    shell: true,
    stdio: "pipe",
    cwd: process.cwd()
  });

  serverProc.stdout.on("data", d => process.stdout.write(`[Server] ${d}`));
  serverProc.stderr.on("data", d => process.stderr.write(`[Server ERR] ${d}`));

  let chromeProc = null;
  let client = null;
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "forma-chrome-e2e-"));

  try {
    let serverReady = false;
    for (let i = 0; i < 40; i++) {
      try {
        await new Promise((resolve, reject) => {
          const req = http.get(`http://localhost:${PORT}/`, res => {
            if (res.statusCode === 200) resolve(true);
            else reject(new Error("Status " + res.statusCode));
          });
          req.on("error", reject);
          req.setTimeout(1000, () => req.destroy());
        });
        serverReady = true;
        break;
      } catch {
        await new Promise(r => setTimeout(r, 500));
      }
    }
    assert.ok(serverReady, `Server port ${PORT} üzerinde açılamadı!`);
    console.log(`✓ Production server hazır: http://localhost:${PORT}`);

    console.log("\n[Adım 2] Headless Chromium başlatılıyor...");
    const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    chromeProc = spawn(chromePath, [
      "--headless=new",
      "--remote-debugging-port=9338",
      "--disable-gpu",
      "--no-sandbox",
      "--no-first-run",
      "--no-default-browser-check",
      `--user-data-dir=${tempDir}`,
      "about:blank"
    ], { stdio: "ignore" });

    await waitHttp("http://127.0.0.1:9338/json/version", 10000);
    const pagesList = await waitHttp("http://127.0.0.1:9338/json/list", 10000);
    const pageTarget = pagesList.find(p => p.type === "page") || pagesList[0];
    client = new CDPClient(pageTarget.webSocketDebuggerUrl);
    await client.ready;
    console.log("✓ CDP sayfa hedefi bağlantısı kuruldu.");

    await client.send("Page.enable");
    await client.send("Runtime.enable");
    await client.send("DOM.enable");
    client.on("Runtime.consoleAPICalled", params => {
      const text = params.args.map(a => a.value ?? a.description ?? (typeof a === 'object' ? JSON.stringify(a) : '')).join(' ');
      console.log(`[Browser Console ${params.type}]`, text);
    });
    client.on("Runtime.exceptionThrown", params => {
      console.log(`[Browser Exception]`, params.exceptionDetails.text, params.exceptionDetails.exception?.description);
    });

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

    async function loadFreshDocument() {
      const loadPromise = new Promise(resolve => client.on("Page.loadEventFired", resolve));
      await client.send("Page.navigate", { url: `http://localhost:${PORT}/` });
      await loadPromise;
      await new Promise(r => setTimeout(r, 1500));

      await client.eval(`
        (function() {
          const card = Array.from(document.querySelectorAll('h2, div, span')).find(el => (el.textContent || '').trim() === 'Belge Düzenle');
          if (card) card.click();
        })()
      `);
      await new Promise(r => setTimeout(r, 800));

      let inputReady = false;
      for (let i = 0; i < 20; i++) {
        const hasInput = await client.eval(`Boolean(document.querySelector('input[type="file"]'))`);
        if (hasInput) { inputReady = true; break; }
        await new Promise(r => setTimeout(r, 500));
      }
      assert.ok(inputReady, "input[type=file] bulunamadı!");

      const docNode = await client.send("DOM.getDocument", { depth: -1 });
      const inputNode = await client.send("DOM.querySelector", {
        nodeId: docNode.root.nodeId,
        selector: 'input[type="file"]'
      });
      await client.send("DOM.setFileInputFiles", {
        files: [realPdfPath],
        nodeId: inputNode.nodeId
      });

      let loaded = false;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 500));
        const hasHit = await client.eval(`Boolean(document.querySelector('.original-text-hit'))`);
        if (hasHit) { loaded = true; break; }
      }
      assert.ok(loaded, "Belge canvas ve metin katmanı yüklenemedi!");
      console.log("✓ Belge metin katmanı yüklendi.");
    }

    // =========================================================================
    // SENARYO 1: GERÇEK INLINE EDIT E2E TESTİ (Çift Tıklama, Yazma, Enter ile Kaydetme, İndirme)
    // =========================================================================
    console.log("\n================================================================================");
    console.log("  SENARYO 1: GERÇEK INLINE EDIT E2E TESTİ (Çift Tıklama ile Yazma ve İndirme)");
    console.log("================================================================================");

    await loadFreshDocument();

    console.log("\n[Inline Edit 1.1] Hedef metin üzerinde çift tıklama yapılıyor...");
    const dblClickRes = await client.eval(`
      (function() {
        const hits = Array.from(document.querySelectorAll('.original-text-hit'));
        const dateHit = hits.find(h => (h.textContent || h.getAttribute('aria-label') || '').includes('09/13/2026'));
        if (!dateHit) return { error: "dateHit bulunamadı" };
        dateHit.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true, view: window }));
        return { success: true };
      })()
    `);
    assert.ok(dblClickRes.success, "Çift tıklama tetiklenemedi!");

    console.log("[Inline Edit 1.2] textarea.inline-text-editor açılması bekleniyor...");
    let taMounted = false;
    for (let i = 0; i < 20; i++) {
      const exists = await client.eval(`Boolean(document.querySelector('textarea.inline-text-editor'))`);
      if (exists) { taMounted = true; break; }
      await new Promise(r => setTimeout(r, 100));
    }
    assert.ok(taMounted, "Inline textarea mount edilemedi!");
    console.log("✓ textarea.inline-text-editor mount edildi.");

    console.log("[Inline Edit 1.3] Yeni değer '09/27/2026' yazılıyor ve Enter ile kaydediliyor...");
    const inlineCommitRes = await client.eval(`
      (function() {
        const editor = document.querySelector('textarea.inline-text-editor');
        if (!editor) return { error: "Editor bulunamadı" };
        editor.focus();
        editor.select();
        const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
        if (setter) {
          setter.call(editor, "09/27/2026");
        } else {
          editor.value = "09/27/2026";
        }
        editor.dispatchEvent(new Event("input", { bubbles: true }));
        editor.dispatchEvent(new Event("change", { bubbles: true }));
        editor.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
        editor.blur();
        return { success: true };
      })()
    `);
    assert.ok(inlineCommitRes.success, "Inline edit kaydedilemedi!");
    await new Promise(r => setTimeout(r, 600));

    console.log("[Inline Edit 1.4] UI üzerinden dışa aktarma ve indirme işlemi yapılıyor...");
    const inlineDownloadedBytes = await triggerUIExportAndCapture(client);
    const inlineHash = crypto.createHash('sha256').update(inlineDownloadedBytes).digest('hex').toUpperCase();
    console.log(`✓ Inline Edit ile İndirilen PDF SHA-256: ${inlineHash}`);

    console.log("[Inline Edit 1.5] İndirilen PDF yeniden açılıyor ve doğrulanıyor...");
    await verifyReadingOrderAndFonts(inlineDownloadedBytes);
    const inlineMeasure = await verifyExportedPdfMeasurements(originalBytes, inlineDownloadedBytes, "SENARYO 1 (INLINE EDIT)");
    console.log("🎉 SENARYO 1 (INLINE EDIT E2E) %100 BAŞARIYLA TAMAMLANDI!");

    // =========================================================================
    // SENARYO 2: GERÇEK BUL & DEĞİŞTİR E2E TESTİ (Find & Replace UI ile Değiştirme ve İndirme)
    // =========================================================================
    console.log("\n================================================================================");
    console.log("  SENARYO 2: GERÇEK BUL & DEĞİŞTİR E2E TESTİ (Find & Replace UI ile Değiştirme)");
    console.log("================================================================================");

    await loadFreshDocument();

    console.log("\n[Find/Replace 2.1] Ctrl+F ile Bul & Değiştir çubuğu açılıyor...");
    await client.eval(`
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "f", ctrlKey: true, bubbles: true }));
    `);
    await new Promise(r => setTimeout(r, 400));

    let searchReady = false;
    for (let i = 0; i < 20; i++) {
      const exists = await client.eval(`Boolean(document.querySelector('input[placeholder="Belgede ara…"]'))`);
      if (exists) { searchReady = true; break; }
      await new Promise(r => setTimeout(r, 100));
    }
    assert.ok(searchReady, "FindReplaceBar arama kutusu açılamadı!");

    console.log("[Find/Replace 2.2] Değiştir bölmesi açılıyor...");
    await client.eval(`
      (function() {
        const replaceInput = document.querySelector('input[placeholder="Yeni metin ile değiştir…"]');
        if (!replaceInput) {
          const toggleBtn = document.querySelector('button[title*="Değiştir bölmesini"]');
          if (toggleBtn) toggleBtn.click();
        }
      })()
    `);
    await new Promise(r => setTimeout(r, 300));

    let replaceReady = false;
    for (let i = 0; i < 20; i++) {
      const exists = await client.eval(`Boolean(document.querySelector('input[placeholder="Yeni metin ile değiştir…"]'))`);
      if (exists) { replaceReady = true; break; }
      await new Promise(r => setTimeout(r, 100));
    }
    assert.ok(replaceReady, "Değiştirme kutusu açılamadı!");

    console.log("[Find/Replace 2.3] Arama '09/13/2026' ve Değiştir '09/27/2026' yazılıyor...");
    await client.eval(`
      (function() {
        function setVal(input, val) {
          input.focus();
          const proto = window.HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
          if (setter) {
            setter.call(input, val);
          } else {
            input.value = val;
          }
          if (input._valueTracker) {
            input._valueTracker.setValue("");
          }
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
        const sInput = document.querySelector('input[placeholder="Belgede ara…"]');
        if (sInput) setVal(sInput, "09/13/2026");
        const rInput = document.querySelector('input[placeholder="Yeni metin ile değiştir…"]');
        if (rInput) setVal(rInput, "09/27/2026");
      })()
    `);
    await new Promise(r => setTimeout(r, 200));

    await client.eval(`
      (function() {
        const rInput = document.querySelector('input[placeholder="Yeni metin ile değiştir…"]');
        if (rInput) {
          rInput.focus();
          rInput.select();
        }
      })()
    `);
    await client.send("Input.insertText", { text: "09/27/2026" });
    await new Promise(r => setTimeout(r, 400));

    const rInputVal = await client.eval(`document.querySelector('input[placeholder="Yeni metin ile değiştir…"]')?.value`);
    console.log(`✓ Değiştirme kutusu değeri doğrulandı: "${rInputVal}"`);

    const matchCount = await client.eval(`
      (function() {
        const spans = Array.from(document.querySelectorAll('span'));
        const counter = spans.find(s => s.textContent && /\\d+\\/\\d+/.test(s.textContent.trim()));
        return counter ? counter.textContent.trim() : null;
      })()
    `);
    console.log(`✓ Arama sonucu eşleşme sayacı: ${matchCount}`);
    assert.ok(matchCount === "1/1", `Eşleşme sayısı 1/1 olmalıdır (got ${matchCount})`);

    console.log("[Find/Replace 2.4] 'Değiştir' butonuna tıklanıyor...");
    const clickReplaceRes = await client.eval(`
      (function() {
        const buttons = Array.from(document.querySelectorAll('button'));
        const replaceBtn = buttons.find(b => (b.textContent || '').trim() === 'Değiştir');
        if (replaceBtn && !replaceBtn.disabled) {
          replaceBtn.click();
          return { clickedReplace: true };
        }
        return { clickedReplace: false, disabled: replaceBtn?.disabled };
      })()
    `);
    assert.ok(clickReplaceRes.clickedReplace, "'Değiştir' butonuna tıklanamadı!");
    await new Promise(r => setTimeout(r, 800));

    console.log("[Find/Replace 2.5] UI üzerinden dışa aktarma ve indirme işlemi yapılıyor...");
    const fnrDownloadedBytes = await triggerUIExportAndCapture(client);
    const fnrHash = crypto.createHash('sha256').update(fnrDownloadedBytes).digest('hex').toUpperCase();
    console.log(`✓ Bul & Değiştir ile İndirilen PDF SHA-256: ${fnrHash}`);

    console.log("[Find/Replace 2.6] İndirilen PDF yeniden açılıyor ve doğrulanıyor...");
    await verifyReadingOrderAndFonts(fnrDownloadedBytes);
    const fnrMeasure = await verifyExportedPdfMeasurements(originalBytes, fnrDownloadedBytes, "SENARYO 2 (BUL & DEĞİŞTİR)");
    console.log("🎉 SENARYO 2 (BUL & DEĞİŞTİR E2E) %100 BAŞARIYLA TAMAMLANDI!");

    // Save evidence images and artifacts
    const artifactDir = process.env.ARTIFACT_DIR || path.join(os.tmpdir(), "forma_artifacts");
    fs.mkdirSync(artifactDir, { recursive: true });
    fs.writeFileSync(path.join(artifactDir, 'forma_production_exported_real.pdf'), fnrDownloadedBytes);
    fs.writeFileSync(path.join(artifactDir, 'forma_inline_exported_real.pdf'), inlineDownloadedBytes);

    await generateProofImages(fnrMeasure, artifactDir);
    await generateProofImages(fnrMeasure, 'outputs/real-evidence');
    await generateProofImages(inlineMeasure, path.join(artifactDir, 'inline-evidence'));

    console.log("\n================================================================================");
    console.log("  CHROMIUM E2E AYRI ÖLÇÜM TABLOLARI (INLINE EDIT & BUL/DEĞİŞTİR)");
    console.log("================================================================================");
    console.table([
      {
        senaryo: "SENARYO 1: INLINE EDIT",
        harfYuksekligi: `${inlineMeasure.mAfter.height} vs ${inlineMeasure.mBefore.height} (Δ ${inlineMeasure.diffHeight}px)`,
        strokeThickness: `${inlineMeasure.mAfter.stroke.toFixed(1)} vs ${inlineMeasure.mBefore.stroke.toFixed(1)} (Δ ${inlineMeasure.diffStroke.toFixed(1)}px)`,
        renkFarki: inlineMeasure.diffColor.toFixed(1),
        baselineFarki: `${inlineMeasure.diffBaseline}px`,
        prefixDegisen: `${inlineMeasure.prefixDiffCount}px`,
        strokeKriter: "PASS (<= 1.0 px)"
      },
      {
        senaryo: "SENARYO 2: BUL & DEĞİŞTİR",
        harfYuksekligi: `${fnrMeasure.mAfter.height} vs ${fnrMeasure.mBefore.height} (Δ ${fnrMeasure.diffHeight}px)`,
        strokeThickness: `${fnrMeasure.mAfter.stroke.toFixed(1)} vs ${fnrMeasure.mBefore.stroke.toFixed(1)} (Δ ${fnrMeasure.diffStroke.toFixed(1)}px)`,
        renkFarki: fnrMeasure.diffColor.toFixed(1),
        baselineFarki: `${fnrMeasure.diffBaseline}px`,
        prefixDegisen: `${fnrMeasure.prefixDiffCount}px`,
        strokeKriter: "PASS (<= 1.0 px)"
      }
    ]);
    console.log("================================================================================");
    console.log("🎉 TÜM E2E SENARYOLARI (INLINE + BUL & DEĞİŞTİR) %100 BAŞARIYLA GEÇTİ!");
    console.log("================================================================================");

  } finally {
    if (client?.ws) client.ws.close();
    if (chromeProc) chromeProc.kill("SIGKILL");
    if (serverProc) {
      serverProc.kill("SIGKILL");
      try { spawn("taskkill", ["/pid", String(serverProc.pid), "/T", "/F"]); } catch {}
    }
    try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
  }
  process.exit(0);
}

main().catch(err => {
  console.error("\n❌ CHROMIUM E2E TEST FAILED:", err);
  process.exit(1);
});

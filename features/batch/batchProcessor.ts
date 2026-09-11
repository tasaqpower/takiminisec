import JSZip from 'jszip';
import { PDFDocument } from '@cantoo/pdf-lib';
import type { BatchConfig, BatchFileItem, BatchProgressCallback } from './batchTypes';
import { compressPdfDocument } from '../compression/compressPdf';
import { applyPageDecorations } from '../page-decoration/applyDecoration';
import { encryptPdf } from '../security/pdfEncryption';
import { sanitizePdfMetadata } from '../security/metadataSanitizer';

/**
 * Process a single file item according to batch operation
 */
export async function processBatchItem(
  item: BatchFileItem,
  config: BatchConfig,
  onItemProgress?: (progress: number) => void
): Promise<{ resultBytes: Uint8Array; resultName: string }> {
  const ext = item.name.slice(item.name.lastIndexOf('.'));
  const baseName = item.name.replace(/\.[^/.]+$/, '');
  let resultBytes: Uint8Array;
  let resultName = `islenmis_${item.name}`;

  if (onItemProgress) onItemProgress(20);

  switch (config.operation) {
    case 'compress': {
      const res = await compressPdfDocument(item.bytes, {
        preset: config.compressPreset || 'balanced',
      });
      resultBytes = res.compressedBytes;
      resultName = `${baseName}_sikistirilmis.pdf`;
      break;
    }
    case 'watermark': {
      resultBytes = await applyPageDecorations(item.bytes, {
        watermark: {
          enabled: true,
          type: 'text',
          text: config.watermarkText || 'TASLAK',
          fontSize: 42,
          color: '#ef4444',
          opacity: config.watermarkOpacity ?? 0.25,
          rotation: 45,
          layer: 'foreground',
          tile: false,
          position: { xPercent: 50, yPercent: 50 },
          scope: 'all',
        },
        pageNumber: { enabled: false, format: '1', template: '', startNumber: 1, startFromPage: 1, excludeCover: false, position: 'bottom-center', fontSize: 10, color: '', margin: 0 },
        headerFooter: { enabled: false, headerLeft: '', headerCenter: '', headerRight: '', footerLeft: '', footerCenter: '', footerRight: '', fontSize: 0, color: '', margin: 0, excludeCover: false },
      });
      resultName = `${baseName}_filigranli.pdf`;
      break;
    }
    case 'page_number': {
      resultBytes = await applyPageDecorations(item.bytes, {
        watermark: { enabled: false, type: 'text', text: '', fontSize: 0, color: '', opacity: 0, rotation: 0, layer: 'foreground', tile: false, position: { xPercent: 50, yPercent: 50 }, scope: 'all' },
        pageNumber: {
          enabled: true,
          format: config.pageNumberFormat || '1',
          template: 'Sayfa {n} / {total}',
          startNumber: 1,
          startFromPage: 1,
          excludeCover: false,
          position: 'bottom-center',
          fontSize: 10,
          color: '#1e293b',
          margin: 24,
        },
        headerFooter: { enabled: false, headerLeft: '', headerCenter: '', headerRight: '', footerLeft: '', footerCenter: '', footerRight: '', fontSize: 0, color: '', margin: 0, excludeCover: false },
      });
      resultName = `${baseName}_numarali.pdf`;
      break;
    }
    case 'protect': {
      if (!config.password) throw new Error('Parola koruması için geçerli bir parola gereklidir.');
      const res = await encryptPdf(item.bytes, { userPassword: config.password });
      resultBytes = res.encryptedBytes;
      resultName = `${baseName}_korumali.pdf`;
      break;
    }
    case 'sanitize_metadata': {
      resultBytes = await sanitizePdfMetadata(item.bytes, { clearAll: true });
      resultName = `${baseName}_temiz.pdf`;
      break;
    }
    case 'images_to_pdf': {
      const pdfDoc = await PDFDocument.create();
      const isPng = item.name.toLowerCase().endsWith('.png');
      const img = isPng ? await pdfDoc.embedPng(item.bytes) : await pdfDoc.embedJpg(item.bytes);
      const page = pdfDoc.addPage([img.width, img.height]);
      page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
      resultBytes = await pdfDoc.save();
      resultName = `${baseName}.pdf`;
      break;
    }
    default: {
      resultBytes = item.bytes;
      resultName = `islenmis_${item.name}`;
      break;
    }
  }

  if (onItemProgress) onItemProgress(100);
  return { resultBytes, resultName };
}

/**
 * Merge multiple PDF items into single combined PDF
 */
export async function mergeBatchItems(items: BatchFileItem[]): Promise<Uint8Array> {
  const mergedDoc = await PDFDocument.create();
  for (const item of items) {
    if (!item.bytes || item.bytes.length === 0) continue;
    const doc = await PDFDocument.load(item.bytes);
    const indices = Array.from({ length: doc.getPageCount() }, (_, i) => i);
    const copiedPages = await mergedDoc.copyPages(doc, indices);
    copiedPages.forEach((p) => mergedDoc.addPage(p));
  }
  return await mergedDoc.save();
}

/**
 * Run entire queue with controlled concurrency (default max 1-2 concurrent jobs)
 */
export async function runBatchQueue(
  items: BatchFileItem[],
  config: BatchConfig,
  onProgress?: BatchProgressCallback,
  checkCancelled?: (id: string) => boolean
): Promise<BatchFileItem[]> {
  const maxConcurrency = Math.min(2, Math.max(1, config.maxConcurrent || 1));
  let completedCount = 0;
  const updatedItems = [...items];

  // If merge operation, execute single combined merge
  if (config.operation === 'merge') {
    try {
      const mergedBytes = await mergeBatchItems(items);
      const resItem: BatchFileItem = {
        id: 'merged_output',
        name: 'birlestirilmis_belge.pdf',
        size: mergedBytes.length,
        status: 'success',
        progress: 100,
        bytes: mergedBytes,
        resultBytes: mergedBytes,
        resultName: 'birlestirilmis_belge.pdf',
      };
      if (onProgress) onProgress('merged_output', 100, items.length, items.length, 'Birleştirme tamamlandı');
      return [resItem];
    } catch (e: any) {
      throw new Error(`Birleştirme başarısız: ${e.message}`);
    }
  }

  // Worker loop with concurrency pool
  let nextIdx = 0;
  async function worker() {
    while (nextIdx < updatedItems.length) {
      const currentIdx = nextIdx++;
      const item = updatedItems[currentIdx];

      if (checkCancelled && checkCancelled(item.id)) {
        item.status = 'cancelled';
        completedCount++;
        if (onProgress) onProgress(item.id, 0, completedCount, updatedItems.length, 'İptal edildi');
        continue;
      }

      item.status = 'processing';
      item.progress = 10;
      if (onProgress) onProgress(item.id, 10, completedCount, updatedItems.length, `${item.name} işleniyor...`);

      const startTime = Date.now();
      try {
        const { resultBytes, resultName } = await processBatchItem(item, config, (prog) => {
          item.progress = prog;
          if (onProgress) onProgress(item.id, prog, completedCount, updatedItems.length, `${item.name}: %${prog}`);
        });

        item.status = 'success';
        item.progress = 100;
        item.resultBytes = resultBytes;
        item.resultName = resultName;
        item.executionTimeMs = Date.now() - startTime;
      } catch (err: any) {
        // Isolate error so one failing file does NOT break the queue
        item.status = 'error';
        item.error = err?.message || 'Bilinmeyen hata';
        item.executionTimeMs = Date.now() - startTime;
      }

      completedCount++;
      if (onProgress) onProgress(item.id, item.progress, completedCount, updatedItems.length, `${item.name} bitti (${completedCount}/${updatedItems.length})`);
    }
  }

  const workers = Array.from({ length: maxConcurrency }, () => worker());
  await Promise.all(workers);

  return updatedItems;
}

/**
 * Package all successful outputs into a single ZIP file
 */
export async function createBatchZip(items: BatchFileItem[]): Promise<Uint8Array> {
  const zip = new JSZip();
  const usedNames = new Set<string>();

  for (const item of items) {
    if (item.status === 'success' && item.resultBytes) {
      let name = item.resultName || item.name;
      // Ensure unique filename inside zip
      let counter = 1;
      while (usedNames.has(name)) {
        const dot = name.lastIndexOf('.');
        if (dot !== -1) {
          name = `${name.slice(0, dot)}_${counter}${name.slice(dot)}`;
        } else {
          name = `${name}_${counter}`;
        }
        counter++;
      }
      usedNames.add(name);
      zip.file(name, item.resultBytes);
    }
  }

  return await zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

/**
 * Generate CSV Report
 */
export function generateBatchCsvReport(items: BatchFileItem[], opName: string): string {
  const rows = [
    ['Dosya Adi', 'Boyut (Bayt)', 'Islem', 'Durum', 'Sure (ms)', 'Cikti Adi', 'Hata'],
  ];

  for (const item of items) {
    rows.push([
      `"${item.name.replace(/"/g, '""')}"`,
      String(item.size),
      opName,
      item.status,
      String(item.executionTimeMs || 0),
      `"${(item.resultName || '').replace(/"/g, '""')}"`,
      `"${(item.error || '').replace(/"/g, '""')}"`,
    ]);
  }

  return rows.map((r) => r.join(',')).join('\n');
}

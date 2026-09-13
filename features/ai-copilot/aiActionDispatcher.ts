import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { type AiActionType, type AiIntentResult } from './aiIntentEngine.ts';
import { detectWatermarks } from '../watermark-removal/watermarkDetector.ts';
import { removeWatermarks } from '../watermark-removal/watermarkRemover.ts';
import { enhancePdfBytes } from '../enhancer/documentEnhancer.ts';
import { compressPdf } from '../compression/compressPdf.ts';
import { scanPdfForSensitiveEntities, redactDetectedEntities } from '../security/autoRedact.ts';
import { pdfToDocx } from '../conversion/docxConverter.ts';
import { pdfToExcel, pdfToImagesZip } from '../conversion/conversionEngine.ts';

export interface AiActionContext {
  pdfBytes?: Uint8Array | null;
  fileName?: string;
  currentPage?: number;
}

export interface AiActionResult {
  success: boolean;
  action: AiActionType;
  message: string;
  newPdfBytes?: Uint8Array;
  newFileName?: string;
  downloadData?: {
    bytes: Uint8Array;
    fileName: string;
    mimeType: string;
  };
  metadata?: Record<string, any>;
}

/**
 * Applies an authentic official corporate stamp (ASLI GİBİDİR, ONAYLANDI, GİZLİ)
 * directly into PDF pages using vector drawing with pdf-lib.
 */
async function stampPdfDirectly(
  pdfBytes: Uint8Array,
  stampType: 'asli_gibidir' | 'onaylandi' | 'gizli' = 'asli_gibidir'
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await doc.embedFont(StandardFonts.Helvetica);

  const pages = doc.getPages();
  const today = new Date().toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // Stamp attributes based on type
  const isRed = stampType === 'asli_gibidir' || stampType === 'gizli';
  const color = isRed ? rgb(0.86, 0.15, 0.15) : rgb(0.11, 0.31, 0.85);
  const title = stampType === 'asli_gibidir'
    ? 'ASLI GIBIDIR'
    : stampType === 'onaylandi'
    ? 'ONAYLANDI'
    : 'GIZLIDIR';

  // Apply to last page
  const targetPage = pages[pages.length - 1];
  const { width, height } = targetPage.getSize();

  // Stamp dimensions and coordinates (bottom right corner)
  const stampW = 180;
  const stampH = 76;
  const stampX = Math.max(20, width - stampW - 35);
  const stampY = Math.max(20, 45);

  targetPage.drawRectangle({
    x: stampX,
    y: stampY,
    width: stampW,
    height: stampH,
    borderColor: color,
    borderWidth: 2.5,
    rotate: degrees(-3),
    opacity: 0.92,
  });

  targetPage.drawRectangle({
    x: stampX + 4,
    y: stampY + 4,
    width: stampW - 8,
    height: stampH - 8,
    borderColor: color,
    borderWidth: 1,
    rotate: degrees(-3),
    opacity: 0.85,
  });

  // Stamp header
  targetPage.drawText('FORMA RESMI BELGE ATOLYESI', {
    x: stampX + 18,
    y: stampY + stampH - 18,
    size: 7.5,
    font: fontBold,
    color,
    rotate: degrees(-3),
  });

  // Stamp status text
  targetPage.drawText(title, {
    x: stampX + 22,
    y: stampY + stampH - 42,
    size: 16,
    font: fontBold,
    color,
    rotate: degrees(-3),
  });

  // Stamp footer
  targetPage.drawText(`Tarih: ${today}  |  Yetkili Imza`, {
    x: stampX + 16,
    y: stampY + 14,
    size: 7,
    font: fontRegular,
    color,
    rotate: degrees(-3),
  });

  return await doc.save();
}

/**
 * Rotates all or target pages in a PDF document by angle degrees
 */
async function rotatePdfPages(pdfBytes: Uint8Array, angle = 90): Promise<Uint8Array> {
  const doc = await PDFDocument.load(pdfBytes);
  const pages = doc.getPages();
  for (const page of pages) {
    const currentAngle = page.getRotation().angle;
    page.setRotation(degrees((currentAngle + angle) % 360));
  }
  return await doc.save();
}

/**
 * Dispatches an AI intent and executes the corresponding action.
 */
export async function dispatchAiAction(
  intent: AiIntentResult,
  context: AiActionContext,
  onProgress?: (message: string) => void
): Promise<AiActionResult> {
  const baseName = (context.fileName || 'belge').replace(/\.[^/.]+$/, '');

  switch (intent.action) {
    // 1. Theme Dark
    case 'theme_dark': {
      if (typeof window !== 'undefined') {
        document.documentElement.classList.add('dark');
        localStorage.setItem('forma_theme', 'dark');
        window.dispatchEvent(new CustomEvent('forma-theme-change', { detail: 'dark' }));
      }
      return {
        success: true,
        action: 'theme_dark',
        message: 'Karanlık (koyu) mod hemen aktifleştirildi! 🌙',
      };
    }

    // 2. Theme Light
    case 'theme_light': {
      if (typeof window !== 'undefined') {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('forma_theme', 'light');
        window.dispatchEvent(new CustomEvent('forma-theme-change', { detail: 'light' }));
      }
      return {
        success: true,
        action: 'theme_light',
        message: 'Aydınlık (açık) mod hemen aktifleştirildi! ☀️',
      };
    }

    // 3. Watermark Removal
    case 'watermark_remove': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'watermark_remove',
          message: 'Filigran temizlemek için lütfen önce bir PDF belgesi yükleyin veya çalışma alanında açın.',
        };
      }

      onProgress?.('Belgedeki filigran ve taslak damgaları taranıyor...');
      const candidates = await detectWatermarks(context.pdfBytes);

      if (candidates.length === 0) {
        return {
          success: true,
          action: 'watermark_remove',
          message: 'Belgede belirgin bir filigran veya taslak damgası bulunamadı. Belgeniz zaten temiz görünüyor! ✨',
        };
      }

      onProgress?.(`${candidates.length} adet filigran nesnesi temizleniyor...`);
      const removalResult = await removeWatermarks(context.pdfBytes, candidates, {
        candidateIds: candidates.map((c) => c.id),
        pageScope: 'all',
        currentPage: 0,
      });

      return {
        success: true,
        action: 'watermark_remove',
        message: `Başarıyla ${removalResult.totalRemoved} adet filigran ve taslak nesnesi temizlendi! Belge saf haline getirildi.`,
        newPdfBytes: removalResult.pdfBytes,
        newFileName: `${baseName}_filigransiz.pdf`,
        metadata: { removedCount: removalResult.totalRemoved },
      };
    }

    // 4. Enhance Document / Scan / Image
    case 'enhance_document': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'enhance_document',
          message: 'Netleştirme işlemi için lütfen önce bir PDF belgesi yükleyin veya çalışma alanında açın.',
        };
      }

      const mode = intent.parameters?.enhanceMode || 'document';
      onProgress?.(mode === 'photo' ? 'Görsel ve fotoğraflar netleştiriliyor...' : 'Taranmış belge netleştiriliyor...');

      const enhancedBytes = await enhancePdfBytes(context.pdfBytes, {
        mode,
        intensity: 'balanced',
        despeckle: true,
        onProgress: (p, total, msg) => onProgress?.(msg),
      });

      return {
        success: true,
        action: 'enhance_document',
        message: mode === 'photo'
          ? 'Görseller renk dengesi korunarak kristal netliğe kavuşturuldu! 🖼️✨'
          : 'Belge arka planı tertemiz beyazlatıldı, soluk yazılar koyulaştırıldı ve keskinleştirildi! 📄✨',
        newPdfBytes: enhancedBytes,
        newFileName: `${baseName}_netlestirildi.pdf`,
      };
    }

    // 5. Compress PDF
    case 'compress_pdf': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'compress_pdf',
          message: 'Sıkıştırma işlemi için lütfen önce bir PDF belgesi yükleyin veya açın.',
        };
      }

      onProgress?.('PDF nesneleri ve görseller optimize ediliyor...');
      const compResult = await compressPdf(context.pdfBytes, { preset: 'balanced' });

      const origKb = Math.round(compResult.originalSize / 1024);
      const compKb = Math.round(compResult.compressedSize / 1024);

      return {
        success: true,
        action: 'compress_pdf',
        message: `PDF başarıyla sıkıştırıldı! Boyut ${origKb} KB'den ${compKb} KB'ye düşürüldü (%${compResult.reductionPercentage} tasarruf). 🗜️`,
        newPdfBytes: compResult.compressedBytes,
        newFileName: `${baseName}_sikistirildi.pdf`,
        metadata: { reduction: compResult.reductionPercentage, origKb, compKb },
      };
    }

    // 6. KVKK / PII Redaction
    case 'redact_pii': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'redact_pii',
          message: 'KVKK sansürleme işlemi için lütfen bir PDF belgesi açın.',
        };
      }

      onProgress?.('Belgedeki TC Kimlik, IBAN ve kart numaraları taranıyor...');
      const entities = await scanPdfForSensitiveEntities(context.pdfBytes);

      if (entities.length === 0) {
        return {
          success: true,
          action: 'redact_pii',
          message: 'Belgede herhangi bir TC Kimlik No, TR IBAN veya kredi kartı bulunamadı. Belgeniz güvende! 🛡️',
        };
      }

      onProgress?.(`${entities.length} adet hassas veri kalıcı olarak maskeleniyor...`);
      const redactedBytes = await redactDetectedEntities(context.pdfBytes, entities);

      return {
        success: true,
        action: 'redact_pii',
        message: `Toplam ${entities.length} adet hassas veri (TCKN, IBAN, Kart No) kalıcı olarak maskelendi ve sansürlendi! 🔒`,
        newPdfBytes: redactedBytes,
        newFileName: `${baseName}_kvkk_sansurlu.pdf`,
        metadata: { redactedCount: entities.length },
      };
    }

    // 7. Convert to Word (.docx)
    case 'convert_word': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'convert_word',
          message: "Word'e dönüştürmek için lütfen bir PDF belgesi açın.",
        };
      }

      onProgress?.("PDF yapısı inceleniyor ve Microsoft Word (.docx) oluşturuluyor...");
      const docxBytes = await pdfToDocx(context.pdfBytes);

      return {
        success: true,
        action: 'convert_word',
        message: 'PDF belgeniz düzenlenebilir Microsoft Word (.docx) formatına dönüştürüldü! 📝',
        downloadData: {
          bytes: docxBytes,
          fileName: `${baseName}.docx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        },
      };
    }

    // 8. Convert to Excel (.xlsx)
    case 'convert_excel': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'convert_excel',
          message: "Excel'e dönüştürmek için lütfen bir PDF belgesi açın.",
        };
      }

      onProgress?.("Tablo ve hücre verileri taranıyor, Excel (.xlsx) oluşturuluyor...");
      const xlsxBytes = await pdfToExcel(context.pdfBytes);

      return {
        success: true,
        action: 'convert_excel',
        message: 'Belgedeki tablolar Excel (.xlsx) çalışma tablosuna aktarıldı! 📊',
        downloadData: {
          bytes: xlsxBytes,
          fileName: `${baseName}.xlsx`,
          mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      };
    }

    // 9. Convert to Images (PNG ZIP)
    case 'convert_img': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'convert_img',
          message: 'Görsele çevirmek için lütfen bir PDF belgesi açın.',
        };
      }

      onProgress?.('PDF sayfaları yüksek çözünürlüklü görsellere dönüştürülüyor...');
      const zipBytes = await pdfToImagesZip(context.pdfBytes, { format: 'png', dpi: 150 });

      return {
        success: true,
        action: 'convert_img',
        message: 'Tüm sayfalar yüksek çözünürlüklü PNG görselleri olarak ZIP arşivlendi! 🖼️',
        downloadData: {
          bytes: zipBytes,
          fileName: `${baseName}_sayfalar_png.zip`,
          mimeType: 'application/zip',
        },
      };
    }

    // 10. Stamp Document
    case 'stamp_document': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'stamp_document',
          message: 'Kaşe basmak için lütfen önce bir PDF belgesi açın.',
        };
      }

      const stampType = intent.parameters?.stampType || 'asli_gibidir';
      onProgress?.(`Belgeye '${stampType.toUpperCase()}' resmi kaşesi basılıyor...`);

      const stampedBytes = await stampPdfDirectly(context.pdfBytes, stampType);
      const stampLabel = stampType === 'asli_gibidir' ? 'ASLI GİBİDİR' : stampType.toUpperCase();

      return {
        success: true,
        action: 'stamp_document',
        message: `Belgeye resmi '${stampLabel}' kaşesi ve onay mührü basıldı! 🏷️`,
        newPdfBytes: stampedBytes,
        newFileName: `${baseName}_${stampType}.pdf`,
      };
    }

    // 11. Rotate Pages
    case 'rotate_pages': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'rotate_pages',
          message: 'Sayfaları döndürmek için lütfen bir PDF belgesi açın.',
        };
      }

      const angle = intent.parameters?.angle || 90;
      onProgress?.(`Sayfalar saat yönünde ${angle}° döndürülüyor...`);

      const rotatedBytes = await rotatePdfPages(context.pdfBytes, angle);

      return {
        success: true,
        action: 'rotate_pages',
        message: `Belge sayfaları ${angle}° saat yönünde başarıyla döndürüldü! 🔄`,
        newPdfBytes: rotatedBytes,
        newFileName: `${baseName}_donduruldu.pdf`,
      };
    }

    // 12. Document Info
    case 'document_info': {
      if (!context.pdfBytes) {
        return {
          success: false,
          action: 'document_info',
          message: 'Belge analizi için lütfen önce bir PDF belgesi yükleyin.',
        };
      }

      const doc = await PDFDocument.load(context.pdfBytes);
      const count = doc.getPageCount();
      const sizeKb = Math.round(context.pdfBytes.byteLength / 1024);
      const title = doc.getTitle() || 'Başlık Belirtilmemiş';

      return {
        success: true,
        action: 'document_info',
        message: `📄 **Belge Analiz Raporu**:\n• Dosya Adı: ${context.fileName || 'Belge.pdf'}\n• Sayfa Sayısı: ${count} sayfa\n• Dosya Boyutu: ${sizeKb} KB\n• Başlık: ${title}\n• Durum: İşleme hazır`,
      };
    }

    // 13. General Help
    default: {
      return {
        success: true,
        action: 'general_help',
        message: intent.suggestedReply,
      };
    }
  }
}

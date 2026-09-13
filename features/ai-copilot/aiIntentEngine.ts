/**
 * Forma AI Natural Language Intent Matching Engine
 * Fully offline, rule-based + semantic intent classifier tuned for Turkish & English document tasks.
 */

export type AiActionType =
  | 'theme_dark'
  | 'theme_light'
  | 'watermark_remove'
  | 'enhance_document'
  | 'compress_pdf'
  | 'convert_word'
  | 'convert_excel'
  | 'convert_img'
  | 'redact_pii'
  | 'stamp_document'
  | 'rotate_pages'
  | 'delete_pages'
  | 'find_replace'
  | 'document_info'
  | 'general_help';

export interface AiIntentResult {
  action: AiActionType;
  confidence: number;
  parameters?: {
    searchTerm?: string;
    replaceTerm?: string;
    stampType?: 'asli_gibidir' | 'onaylandi' | 'gizli';
    angle?: number;
    pages?: number[];
    enhanceMode?: 'document' | 'photo';
  };
  explanation: string;
  suggestedReply: string;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[iİıI]/g, 'i')
    .replace(/[şŞ]/g, 's')
    .replace(/[ğĞ]/g, 'g')
    .replace(/[üÜ]/g, 'u')
    .replace(/[öÖ]/g, 'o')
    .replace(/[çÇ]/g, 'c')
    .trim();
}

export function parseUserIntent(prompt: string): AiIntentResult {
  const raw = prompt.trim();
  const n = normalize(prompt);

  // 1. Theme Dark
  if (
    n.includes('koyu mod') ||
    n.includes('gece mod') ||
    n.includes('karanlik') ||
    n.includes('dark mode') ||
    n.includes('siyah yap') ||
    n.includes('koyu yap') ||
    n.includes('koyu tema')
  ) {
    return {
      action: 'theme_dark',
      confidence: 0.98,
      explanation: 'Koyu mod teması aktifleştiriliyor.',
      suggestedReply: 'Arayüzü hemen gece moduna (koyu moda) geçirdim! 🌙'
    };
  }

  // 2. Theme Light
  if (
    n.includes('acik mod') ||
    n.includes('gunduz mod') ||
    n.includes('aydinlik') ||
    n.includes('light mode') ||
    n.includes('beyaz yap') ||
    n.includes('acik yap') ||
    n.includes('acik tema')
  ) {
    return {
      action: 'theme_light',
      confidence: 0.98,
      explanation: 'Açık mod teması aktifleştiriliyor.',
      suggestedReply: 'Arayüzü gündüz moduna (açık moda) geçirdim! ☀️'
    };
  }

  // 3. Watermark Removal
  if (
    n.includes('filigran') ||
    n.includes('fligran') ||
    n.includes('watermark') ||
    n.includes('damga sil') ||
    n.includes('damga kaldir') ||
    (n.includes('taslak') && (n.includes('sil') || n.includes('kaldir') || n.includes('temizle') || n.includes('yok et'))) ||
    (n.includes('damga') && (n.includes('sil') || n.includes('kaldir') || n.includes('temizle'))) ||
    n.includes('gecersiz yazisi') ||
    n.includes('ornek damgasi')
  ) {
    return {
      action: 'watermark_remove',
      confidence: 0.95,
      explanation: 'Belgedeki tekrar eden filigranlar, taslak damgaları ve saydam yazılar silinecek.',
      suggestedReply: 'Belgedeki filigran ve taslak damgalarını vektörel düzeyde temizliyorum... 🧹'
    };
  }

  // 4. Document / Image Clarification & Enhancement
  if (
    n.includes('netlestir') ||
    n.includes('net yap') ||
    n.includes('yazilari koyulastir') ||
    n.includes('bulanik') ||
    n.includes('okunmuyor') ||
    n.includes('soluk') ||
    n.includes('arka plani beyazlat') ||
    n.includes('kristal netlik') ||
    n.includes('keskinlestir')
  ) {
    const isPhoto = n.includes('fotograf') || n.includes('resim') || n.includes('renkli');
    return {
      action: 'enhance_document',
      confidence: 0.95,
      parameters: {
        enhanceMode: isPhoto ? 'photo' : 'document'
      },
      explanation: isPhoto
        ? 'Fotoğraf ve renkli görsel keskinleştirme filtresi uygulanacak.'
        : 'Taranmış belge filtresi: Arka plan beyazlatılacak ve soluk yazılar koyulaştırılacak.',
      suggestedReply: isPhoto
        ? 'Görseli renk dengesini koruyarak kristal netliğe kavuşturuyorum... 🖼️✨'
        : 'Belgedeki soluk yazıları koyulaştırıp arka planı tertemiz beyaz yapıyorum... 📄✨'
    };
  }

  // 5. Compression
  if (
    n.includes('sikistir') ||
    n.includes('boyutunu kucult') ||
    n.includes('mb dusur') ||
    n.includes('kb yap') ||
    n.includes('compress') ||
    n.includes('hafiflet')
  ) {
    return {
      action: 'compress_pdf',
      confidence: 0.95,
      explanation: 'Belge görsel kalitesi korunarak maksimum oranda sıkıştırılacak.',
      suggestedReply: 'PDF dosyasını kalite kaybı olmadan sıkıştırıyorum... 🗜️'
    };
  }

  // 6. KVKK & PII Redaction
  if (
    n.includes('kvkk') ||
    n.includes('sansur') ||
    n.includes('maskele') ||
    n.includes('tc kimlik') ||
    n.includes('tckn') ||
    n.includes('iban') ||
    n.includes('kart no') ||
    n.includes('kisisel veri') ||
    n.includes('pii') ||
    n.includes('gizle')
  ) {
    return {
      action: 'redact_pii',
      confidence: 0.95,
      explanation: 'TC Kimlik, TR IBAN, kredi kartı ve telefon numaraları tespit edilip kalıcı olarak sansürlenecek.',
      suggestedReply: 'Belgedeki TC Kimlik No, IBAN ve hassas kişisel verileri tespit edip kalıcı olarak maskeliyorum... 🔒'
    };
  }

  // 7. Conversions: Word (.docx)
  if (
    n.includes('word') ||
    n.includes('docx') ||
    n.includes('duzenlenebilir yap') ||
    n.includes('yazilari aktar')
  ) {
    return {
      action: 'convert_word',
      confidence: 0.95,
      explanation: 'PDF içeriği düzenlenebilir Microsoft Word (.docx) belgesine dönüştürülecek.',
      suggestedReply: 'PDF belgesini düzenlenebilir Microsoft Word (.docx) formatına çeviriyorum... 📝'
    };
  }

  // 8. Conversions: Excel (.xlsx)
  if (
    n.includes('excel') ||
    n.includes('xlsx') ||
    n.includes('csv') ||
    n.includes('tablo') ||
    n.includes('hesap tablosu')
  ) {
    return {
      action: 'convert_excel',
      confidence: 0.95,
      explanation: 'PDF içindeki tablolar çekilip Excel (.xlsx) tablosuna dönüştürülecek.',
      suggestedReply: 'Belge içerisindeki tabloları Excel (.xlsx) formatına aktarıyorum... 📊'
    };
  }

  // 9. Conversions: Image (PNG/JPG)
  if (
    n.includes('gorsel yap') ||
    n.includes('resim yap') ||
    n.includes('png yap') ||
    n.includes('jpg yap') ||
    n.includes('resme cevir')
  ) {
    return {
      action: 'convert_img',
      confidence: 0.93,
      explanation: 'PDF sayfaları yüksek çözünürlüklü görsellere dönüştürülecek.',
      suggestedReply: 'PDF sayfalarını yüksek çözünürlüklü görsellere dönüştürüyorum... 🖼️'
    };
  }

  // 10. Stamp / Seal
  if (
    n.includes('kase') ||
    n.includes('muhur') ||
    n.includes('asli gibidir') ||
    n.includes('onaylandi') ||
    n.includes('damgala')
  ) {
    let stampType: 'asli_gibidir' | 'onaylandi' | 'gizli' = 'asli_gibidir';
    if (n.includes('onay')) stampType = 'onaylandi';
    if (n.includes('gizli')) stampType = 'gizli';

    return {
      action: 'stamp_document',
      confidence: 0.95,
      parameters: { stampType },
      explanation: `Belgeye resmi '${stampType.toUpperCase()}' kaşesi basılacak.`,
      suggestedReply: `Belgenize resmi '${stampType === 'asli_gibidir' ? 'ASLI GİBİDİR' : stampType.toUpperCase()}' kaşesi ekliyorum... 🏷️`
    };
  }

  // 11. Find & Replace Text
  const replaceRegex = /(?:['"]?)([^'"\n\r]+)(?:['"]?)\s+(?:kelimesini|yazisini|ifadesini|metnini)\s+(?:['"]?)([^'"\n\r]+)(?:['"]?)\s+(?:ile|olarak|diye)?\s*(?:degistir|yap|degistirelim|guncelle)/i;
  const match = raw.match(replaceRegex);
  if (match) {
    const searchTerm = match[1].trim();
    const replaceTerm = match[2].trim();
    return {
      action: 'find_replace',
      confidence: 0.96,
      parameters: { searchTerm, replaceTerm },
      explanation: `'${searchTerm}' ifadesi '${replaceTerm}' ile değiştirilecek.`,
      suggestedReply: `Belgede geçen '${searchTerm}' ifadelerini bulup '${replaceTerm}' ile değiştiriyorum... 🔍`
    };
  }

  // 12. Rotate Pages
  if (
    n.includes('dondur') ||
    n.includes('cevir') ||
    n.includes('90 derece') ||
    n.includes('180 derece') ||
    n.includes('yan cevir')
  ) {
    const angle = n.includes('180') ? 180 : n.includes('270') ? 270 : 90;
    return {
      action: 'rotate_pages',
      confidence: 0.92,
      parameters: { angle },
      explanation: `Sayfalar saat yönünde ${angle} derece döndürülecek.`,
      suggestedReply: `Belge sayfalarını saat yönünde ${angle}° döndürüyorum... 🔄`
    };
  }

  // 13. Document Info & Summary
  if (
    n.includes('kac sayfa') ||
    n.includes('sayfa sayisi') ||
    n.includes('boyut') ||
    n.includes('ozet') ||
    n.includes('analiz') ||
    n.includes('bilgi ver')
  ) {
    return {
      action: 'document_info',
      confidence: 0.90,
      explanation: 'Belge metaverileri ve sayfa analizi raporlanacak.',
      suggestedReply: 'Belge yapısını inceliyorum, sayfa ve boyut özetini hazırlıyorum... 📋'
    };
  }

  // Default: General help
  return {
    action: 'general_help',
    confidence: 0.5,
    explanation: 'Genel asistan yardımı ve özellik listesi.',
    suggestedReply: `Forma AI hizmetinizde! Yapabileceklerimden bazıları:\n\n• 🌙 *"Koyu mod yap"* / *"Açık moda geç"*\n• 🧹 *"Filigranı kaldır"*\n• ✨ *"Yazıları netleştir"* / *"Görseli netleştir"*\n• 🔒 *"TC ve IBAN'ları sansürle (KVKK)"*\n• 🗜️ *"PDF'i sıkıştır"*\n• 📝 *"Word'e dönüştür"*\n• 🏷️ *"Aslı gibidir kaşesi bas"*\n• 🔄 *"Sayfaları 90 derece döndür"*`
  };
}

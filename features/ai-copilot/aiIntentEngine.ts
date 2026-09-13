/**
 * Forma AI Natural Language Intent Matching Engine
 * Fully offline, rule-based + semantic intent classifier tuned for Turkish & English document tasks.
 * Covers all capabilities of Forma: themes, watermarks, enhancement, compression, conversions,
 * KVKK redaction, stamping, page rotation & deletion, page numbering, encryption, OCR, forms, find & replace.
 */

export type AiActionType =
  | 'theme_dark'
  | 'theme_light'
  | 'watermark_remove'
  | 'watermark_add'
  | 'enhance_document'
  | 'enhance_selective'
  | 'delete_object'
  | 'vision_qa'
  | 'voice_toggle'
  | 'compress_pdf'
  | 'convert_word'
  | 'convert_excel'
  | 'convert_img'
  | 'convert_pdfa'
  | 'redact_pii'
  | 'stamp_document'
  | 'rotate_pages'
  | 'delete_pages'
  | 'page_numbers'
  | 'protect_pdf'
  | 'ocr_document'
  | 'flatten_forms'
  | 'find_replace'
  | 'document_info'
  | 'general_help';

export interface AiIntentResult {
  action: AiActionType;
  confidence: number;
  parameters?: {
    searchTerm?: string;
    replaceTerm?: string;
    stampType?: 'asli_gibidir' | 'onaylandi' | 'gizli' | 'odendi' | 'kontrol_edildi';
    angle?: number;
    pages?: number[];
    enhanceMode?: 'document' | 'photo';
    watermarkText?: string;
    password?: string;
    targetPage?: 'first' | 'last' | number;
    targetObject?: string;
    voiceState?: 'on' | 'off';
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

  // 0a. Voice Control Toggle ("sesli yanıtı aç", "sesli konuş", "sesi kapat")
  if (
    n.includes('sesli yanit') ||
    n.includes('sesli konus') ||
    n.includes('sesli mod') ||
    n.includes('sesi ac') ||
    n.includes('sesi kapat') ||
    n.includes('konusarak anlat') ||
    n.includes('sesli oku') ||
    n.includes('sessiz ol') ||
    n.includes('konusma yetkisi')
  ) {
    const isOff = n.includes('kapat') || n.includes('sustur') || n.includes('sessiz');
    return {
      action: 'voice_toggle',
      confidence: 0.98,
      parameters: { voiceState: isOff ? 'off' : 'on' },
      explanation: isOff ? 'Sesli yanıt kapatılıyor.' : 'Sesli yanıt aktifleştiriliyor.',
      suggestedReply: isOff
        ? 'Sesli yanıtı kapattım. Yanıtlarımı artık sadece metin olarak göreceksiniz. 🔇'
        : 'Sesli yanıt sistemini açtım! Bundan sonra yanıtlarımı Türkçe seslendireceğim. 🔊🎙️',
    };
  }

  // 0b. Vision & Semantic Document QA ("görselde ne var", "resimde ne var", "belgede ne var", "ne görüyorsun")
  if (
    n.includes('gorselde ne var') ||
    n.includes('resimde ne var') ||
    n.includes('belgede ne var') ||
    n.includes('bu belgede ne var') ||
    n.includes('bu ne') ||
    n.includes('bu nedir') ||
    n.includes('ne goruyorsun') ||
    n.includes('resimde ne goruyorsun') ||
    n.includes('gorselde ne goruyorsun') ||
    n.includes('gorseli acikla') ||
    n.includes('resmi acikla') ||
    n.includes('gorseli analiz et') ||
    n.includes('resmi analiz et') ||
    n.includes('gorseli incele') ||
    n.includes('resmi incele') ||
    n.includes('fotografta ne var') ||
    n.includes('gorsel analizi') ||
    n.includes('resim analizi') ||
    n.includes('icerikte ne var') ||
    n.includes('belgede ne yaziyor') ||
    n.includes('burada ne var')
  ) {
    return {
      action: 'vision_qa',
      confidence: 0.96,
      explanation: 'Görsel ve belge içeriği, nesneler, görseller ve metinler analiz edilip açıklanacak.',
      suggestedReply: 'Görseli ve belgeyi inceliyorum; içerisindeki nesneleri, görselleri, metinleri ve yapıyı analiz ediyorum... 👁️🔍',
    };
  }

  // 0c. Selective Object / Image Deletion ("aslanı sil", "resmi sil", "logoyu kaldır", "görseli sil")
  const isDeleteIntent =
    (n.includes('sil') || n.includes('kaldir') || n.includes('yok et') || n.includes('temizle') || n.includes('cikar')) &&
    !n.includes('filigran') &&
    !n.includes('fligran') &&
    !n.includes('watermark') &&
    !n.includes('taslak') &&
    !n.includes('sayfa');

  if (isDeleteIntent) {
    let target = '';
    if (n.includes('aslan')) target = 'aslan';
    else if (n.includes('logo')) target = 'logo';
    else if (n.includes('foto')) target = 'fotoğraf';
    else if (n.includes('imza')) target = 'imza';
    else if (n.includes('kase')) target = 'kaşe';
    else if (n.includes('resim') || n.includes('resmi')) target = 'resim';
    else if (n.includes('gorsel') || n.includes('nesne')) target = 'görsel';
    else {
      const m = n.match(/([a-z0-9]+)(?:i|ı|u|ü|yi|yı|yu|yü)?\s*(?:sil|kaldir|yok et|temizle)/);
      if (m && m[1] && m[1].length >= 3 && !['sayfa', 'filigran', 'fligran', 'tum', 'hepsini'].includes(m[1])) {
        target = m[1];
      }
    }

    if (target) {
      return {
        action: 'delete_object',
        confidence: 0.95,
        parameters: { targetObject: target },
        explanation: `Belgedeki '${target}' görseli/nesnesi tespit edilip silinecek.`,
        suggestedReply: `Belgedeki '${target}' görselini/nesnesini tespit edip temizliyorum... 🗑️✨`,
      };
    }
  }

  // 0d. Selective Object Enhancement ("aslanı netleştir", "sadece görseli netleştir", "sadece fotoğrafı netleştir")
  const isSelectiveEnhance =
    (n.includes('netlestir') || n.includes('keskinlestir') || n.includes('iyilestir')) &&
    (n.includes('sadece') || n.includes('aslan') || n.includes('logo') || n.includes('bu gorseli') || n.includes('bu resmi')) &&
    !n.includes('ve resim');

  if (isSelectiveEnhance) {
    let target = 'görsel';
    if (n.includes('aslan')) target = 'aslan';
    else if (n.includes('foto')) target = 'fotoğraf';
    else if (n.includes('resim') || n.includes('resmi')) target = 'resim';

    return {
      action: 'enhance_selective',
      confidence: 0.96,
      parameters: { targetObject: target, enhanceMode: 'photo' },
      explanation: `Belgedeki '${target}' görsel nesnesi hedeflenerek sadece bu alan yüksek çözünürlükte netleştirilecek.`,
      suggestedReply: `Vektörel metinleri bozmadan sadece '${target}' görselini kristal netliğe kavuşturuyorum... 🖼️🔍✨`,
    };
  }

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
      suggestedReply: 'Arayüzü hemen gece moduna (koyu moda) geçirdim! 🌙',
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
      suggestedReply: 'Arayüzü gündüz moduna (açık moda) geçirdim! ☀️',
    };
  }

  // 3. Watermark Add ("filigran ekle", "filigran koy", "filigran bas")
  if (
    (n.includes('filigran') || n.includes('fligran') || n.includes('watermark')) &&
    (n.includes('ekle') || n.includes('koy') || n.includes('bas') || n.includes('yerlestir'))
  ) {
    let wmText = 'GİZLİ';
    if (n.includes('taslak')) wmText = 'TASLAK';
    if (n.includes('ornek')) wmText = 'ÖRNEK';
    if (n.includes('kopya')) wmText = 'KOPYA';
    if (n.includes('iptal')) wmText = 'İPTAL';

    return {
      action: 'watermark_add',
      confidence: 0.95,
      parameters: { watermarkText: wmText },
      explanation: `Belge sayfalarına yarı saydam '${wmText}' filigranı eklenecek.`,
      suggestedReply: `Belge sayfalarına '${wmText}' filigranı ekliyorum... 🔏`,
    };
  }

  // 4. Watermark Removal
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
      suggestedReply: 'Belgedeki filigran ve taslak damgalarını vektörel düzeyde temizliyorum... 🧹',
    };
  }

  // 5. Document / Image Clarification & Enhancement
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
        enhanceMode: isPhoto ? 'photo' : 'document',
      },
      explanation: isPhoto
        ? 'Fotoğraf ve renkli görsel keskinleştirme filtresi uygulanacak.'
        : 'Taranmış belge filtresi: Arka plan beyazlatılacak ve soluk yazılar koyulaştırılacak.',
      suggestedReply: isPhoto
        ? 'Görseli renk dengesini koruyarak kristal netliğe kavuşturuyorum... 🖼️✨'
        : 'Belgedeki soluk yazıları koyulaştırıp arka planı tertemiz beyaz yapıyorum... 📄✨',
    };
  }

  // 6. Compression
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
      suggestedReply: 'PDF dosyasını kalite kaybı olmadan sıkıştırıyorum... 🗜️',
    };
  }

  // 7. KVKK & PII Redaction
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
      suggestedReply: 'Belgedeki TC Kimlik No, IBAN ve hassas kişisel verileri tespit edip kalıcı olarak maskeliyorum... 🔒',
    };
  }

  // 8. PDF/A Archival Conversion
  if (
    n.includes('pdf/a') ||
    n.includes('pdfa') ||
    n.includes('arsiv standardi') ||
    n.includes('arsivlik') ||
    n.includes('iso 19005')
  ) {
    return {
      action: 'convert_pdfa',
      confidence: 0.96,
      explanation: 'PDF belgesi ISO 19005-2 (PDF/A-2b) uzun vadeli arşiv standardına dönüştürülecek.',
      suggestedReply: 'Belgeyi uluslararası PDF/A-2b arşiv formatına dönüştürüyorum... 🏛️',
    };
  }

  // 9. Conversions: Word (.docx)
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
      suggestedReply: 'PDF belgesini düzenlenebilir Microsoft Word (.docx) formatına çeviriyorum... 📝',
    };
  }

  // 10. Conversions: Excel (.xlsx)
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
      suggestedReply: 'Belge içerisindeki tabloları Excel (.xlsx) formatına aktarıyorum... 📊',
    };
  }

  // 11. Conversions: Image (PNG/JPG)
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
      suggestedReply: 'PDF sayfalarını yüksek çözünürlüklü görsellere dönüştürüyorum... 🖼️',
    };
  }

  // 12. Stamp / Seal
  if (
    n.includes('kase') ||
    n.includes('muhur') ||
    n.includes('asli gibidir') ||
    n.includes('onaylandi') ||
    n.includes('damgala') ||
    n.includes('odendi') ||
    n.includes('kontrol edildi')
  ) {
    let stampType: 'asli_gibidir' | 'onaylandi' | 'gizli' | 'odendi' | 'kontrol_edildi' = 'asli_gibidir';
    if (n.includes('onay')) stampType = 'onaylandi';
    if (n.includes('gizli')) stampType = 'gizli';
    if (n.includes('odendi') || n.includes('tahsil')) stampType = 'odendi';
    if (n.includes('kontrol')) stampType = 'kontrol_edildi';

    const stampName = stampType === 'asli_gibidir' ? 'ASLI GİBİDİR' : stampType.toUpperCase().replace('_', ' ');

    return {
      action: 'stamp_document',
      confidence: 0.95,
      parameters: { stampType },
      explanation: `Belgeye resmi '${stampName}' kaşesi basılacak.`,
      suggestedReply: `Belgenize resmi '${stampName}' kaşesi ve onay mührü basıyorum... 🏷️`,
    };
  }

  // 13. Page Numbers ("sayfa numarası ekle", "sayfaları numaralandır")
  if (
    n.includes('sayfa no') ||
    n.includes('sayfa numarasi') ||
    n.includes('numaralandir') ||
    n.includes('alt bilgi no')
  ) {
    return {
      action: 'page_numbers',
      confidence: 0.94,
      explanation: 'Tüm sayfalara sayfa numarası (Sayfa X / Y) eklenecek.',
      suggestedReply: 'Tüm sayfalara resmi sayfa numaralarını ekliyorum... 🔢',
    };
  }

  // 14. Delete Pages ("sayfa sil", "ilk sayfayı sil", "son sayfayı sil")
  if (
    (n.includes('sayfa') || n.includes('sayfayi')) &&
    (n.includes('sil') || n.includes('cikar') || n.includes('at'))
  ) {
    const isFirst = n.includes('ilk') || n.includes('1.') || n.includes('birinci');
    const isLast = n.includes('son');
    const targetPage = isFirst ? 'first' : isLast ? 'last' : 'last';

    return {
      action: 'delete_pages',
      confidence: 0.94,
      parameters: { targetPage },
      explanation: `${isFirst ? 'İlk sayfa' : isLast ? 'Son sayfa' : 'Belirtilen sayfa'} belgeden silinecek.`,
      suggestedReply: `${isFirst ? 'İlk sayfayı' : 'Son sayfayı'} belgeden siliyorum... 🗑️`,
    };
  }

  // 15. Password Protection / Encryption ("şifrele", "parola koy", "kilitle")
  if (
    n.includes('sifre') ||
    n.includes('parola') ||
    n.includes('kilitle') ||
    n.includes('guvenlik koy')
  ) {
    const pwMatch = raw.match(/(?:sifre|parola)[\s:]+([^\s]+)/i);
    const password = pwMatch ? pwMatch[1].trim() : 'Forma123!';

    return {
      action: 'protect_pdf',
      confidence: 0.92,
      parameters: { password },
      explanation: `Belge parola ile şifrelenecek (Parola: ${password}).`,
      suggestedReply: `Belgenizi standart AES koruması ile şifreliyorum (Parola: ${password})... 🔐`,
    };
  }

  // 16. OCR / Text Extraction
  if (
    n.includes('ocr') ||
    n.includes('metin tani') ||
    n.includes('metne dok') ||
    n.includes('yazilari oku') ||
    n.includes('metni cikar')
  ) {
    return {
      action: 'ocr_document',
      confidence: 0.93,
      explanation: 'Taranmış sayfalar taranarak tüm metinler metin olarak okunacak.',
      suggestedReply: 'Belgedeki metinleri optik karakter tanıma (OCR) ile okuyup çıkarıyorum... 🔍📄',
    };
  }

  // 17. Flatten Forms ("formları düzleştir", "salt okunur yap")
  if (
    n.includes('form') && (n.includes('duzlestir') || n.includes('flatten') || n.includes('salt okunur') || n.includes('sabit yap'))
  ) {
    return {
      action: 'flatten_forms',
      confidence: 0.95,
      explanation: 'Form alanları düzleştirilerek sabit metne dönüştürülecek.',
      suggestedReply: 'Belgedeki form alanlarını düzleştirip salt okunur yapıyorum... 📋',
    };
  }

  // 18. Find & Replace Text
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
      suggestedReply: `Belgede geçen '${searchTerm}' ifadelerini bulup '${replaceTerm}' ile değiştiriyorum... 🔍`,
    };
  }

  // 19. Rotate Pages
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
      suggestedReply: `Belge sayfalarını saat yönünde ${angle}° döndürüyorum... 🔄`,
    };
  }

  // 20. Document Info & Summary
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
      suggestedReply: 'Belge yapısını inceliyorum, sayfa ve boyut özetini hazırlıyorum... 📋',
    };
  }

  // Default: General help
  return {
    action: 'general_help',
    confidence: 0.5,
    explanation: 'Genel asistan yardımı ve özellik listesi.',
    suggestedReply: `Forma AI hizmetinizde! Ne isterseniz doğrudan söyleyin ya da sesli konuşun, hemen yapayım:\n\n• 👁️ *"Görselde / belgede ne var?"* (Görsel ve belge içeriği analizi)\n• 🗑️ *"Aslanı sil"* / *"Resmi sil"* / *"Logoyu kaldır"* (Hedef görseli silme)\n• ✨ *"Aslanı netleştir"* / *"Sadece fotoğrafı netleştir"*\n• 🎙️ *"Sesli yanıtı aç"* / *"Sesi kapat"* (Mikrofon & sesli Türkçe konuşma)\n• 🌙 *"Koyu mod yap"* / ☀️ *"Açık mod yap"*\n• 🧹 *"Filigranı kaldır"* / 🔏 *"Filigran ekle"*\n• 🔒 *"TC ve IBAN'ları sansürle (KVKK)"*\n• 🗜️ *"PDF'i sıkıştır"* (boyut düşür)\n• 📝 *"Word'e çevir"* / 📊 *"Excel'e aktar"* / 🖼️ *"Görsel yap"*\n• 🏛️ *"PDF/A arşiv formatına çevir"*\n• 🏷️ *"ASLI GİBİDİR kaşesi bas"* / *"ONAYLANDI kaşesi vur"*\n• 🔄 *"Sayfaları 90 derece döndür"* / 🗑️ *"İlk/son sayfayı sil"*\n• 🔢 *"Sayfa numarası ekle"*\n• 🔐 *"Belgeyi şifrele: parola 123456"*\n• 🔍 *"[Eski] kelimesini [Yeni] ile değiştir"*`,
  };
}

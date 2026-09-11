# Forma — Belge Atölyesi

Türkçe arayüzlü, belgeleri cihaz içinde işleyen PDF ve DOCX uygulaması.

## Araçlar

- PDF görüntüleme, metin ekleme, çizim, vurgu, çizerek veya yazarak görsel imza.
- Öğeleri seçme, taşıma, sayısal konum/boyut ayarı, geri alma ve yineleme.
- Sayfa döndürme, sıralama, silme, aralık seçerek ayırma ve birleştirme.
- DOCX/TXT açma; başlık, kalın, italik, alt çizgi ve liste düzenleme.
- Word → PDF/DOCX/TXT, PDF → metin tabanlı DOCX/TXT, JPG/PNG → PDF.
- Türkçe karakterler, mobil arayüz, dosya doğrulama ve indirilmemiş değişiklik uyarıları.

Dosyalar yalnızca tarayıcı belleğinde işlenir; uygulama dosya içeriğini sunucuya göndermez. Çıkmadan önce sonucu indirin. Dosya başına sınır 50 MB.

## Çalıştırma

Windows'ta **Forma-Baslat.cmd** dosyasına çift tıklayın. Uygulama tarayıcıda açılır; zaten çalışıyorsa aynı uygulamayı açar.

Node.js 22.13+ gerekir (24 LTS önerilir).

```sh
npm ci
npm run dev
```

Önizleme: http://localhost:5173. Üretim çıktısı için `npm run build`, üretim sunucusunu yerelde çalıştırmak için `npm start`.

PDF.js worker, karakter haritaları ve yerel fontlar dev/build başında otomatik hazırlanır. Proje React 19, Vinext/Vite, pdf-lib, PDF.js, Mammoth, docx ve pdfmake kullanır. Hosting kimliği `.openai/hosting.json` içindedir.

## Doğrulama

```sh
npx tsc --noEmit
node scripts/create-test-fixtures.mjs
node scripts/test-documents.mjs
```

Dosya motoru testleri gerçek PDF/DOCX üretir; Türkçe karakterleri, döndürülmüş/kırpılmış sayfaları, birleştirme/ayırmayı, metin+imza eklemeyi, zengin metin dönüşümünü ve bozuk girdileri doğrular. Geçici çıktılar `outputs/qa/` içine yazılır ve kaynak yayınına dahil edilmez.

## Bilinen sınırlar

- PDF araçları mevcut içeriğin üzerine ekleme yapar; kaynak PDF metni doğrudan değiştirilmez.
- PDF → Word/TXT seçilebilir metni çıkarır; sayfa yerleşimini veya görselleri korumaz. OCR yoktur.
- DOCX dönüşümleri temel biçimlendirmeyi destekler. Karmaşık düzenler, üst/alt bilgiler ve alanlar birebir korunmayabilir.
- İmza görseldir; sertifikalı elektronik imza değildir.
- Şifreli PDF dosyaları desteklenmez. Çok büyük veya çok sayfalı belgeler cihaz belleğine bağlıdır.

Desteklenen tarayıcılarda `read_document_status` ve `add_pdf_text` WebMCP araçları, görünür arayüzle aynı belge durumu üzerinde çalışır.

# FORMA ADOBE CORE MEDIA PACK (V1) — KULLANIM VE KURULUM KILAVUZU

Bu paket, **FORMA** kreatif kütüphanesinde yer alan ve bağımsız video/grafik kurgusunda doğrudan kullanılabilir **699 adet doğrulanmış medya varlığını** içermektedir.

Paket, Adobe Premiere Pro ve After Effects kullanıcı profillerine hiçbir zarar vermeden, üzerine yazma yapmadan ve registry kaydı gerektirmeden çalışacak şekilde tasarlanmıştır.

---

## 1. PAKET İÇERİĞİ VE SAYIM METRİKLERİ

| Kategori | Dosya Sayısı | Format ve Standart | Açıklama |
|---|---|---|---|
| **LUT (Renk Profili)** | **185** | `.cube` (3D LUT, 33x33x33 / 65x65x65) | Premiere Pro Lumetri Color Creative uyumlu renk profilleri |
| **Audio (Ses)** | **168** | `.wav` (PCM 16/24-bit, 44.1/48kHz Stereo) | 130 SFX (Foley, Whoosh, Impact) + 38 Sinematik Fon Parçası |
| **SVG (Vektör / İkon)** | **337** | `.svg` (Temizlenmiş XML, Şeffaf Arka Plan) | 252 Lucide + 25 Feather + 60 FORMA Geometrik Vektör |
| **Video (B-Roll)** | **9** | `.mp4` (H.264 AVC, yuv420p, Progressive) | Donanım hızlandırmalı 1080p/720p sinematik video varlıkları |
| **TOPLAM MEDYA** | **699** | **%100 Format Doğrulamalı** | **Sıfır WebM, Sıfır Sentetik Şablon, Sıfır Bozuk Dosya** |

---

## 2. DOSYA VE DİZİN YAPISI

```text
FORMA-ADOBE-CORE-MEDIA-PACK/
├── LUTs/                         # 185 adet .cube renk profili
├── Audio/
│   ├── SFX/                      # 130 adet ses efekti (.wav)
│   └── Music/                    # 38 adet fon müziği (.wav)
├── SVG/                          # 337 adet vektör/ikon (.svg)
├── Video/                        # 9 adet H.264 MP4 video (.mp4)
├── Licenses/                     # Eksiksiz lisans metinleri ve atıf belgesi
│   ├── FORMA-ORIGINAL-1.0.txt
│   ├── MIT.txt
│   ├── ISC.txt
│   ├── CC0-1.0.txt
│   ├── PUBLIC-DOMAIN-NOTICE.txt
│   └── CC-BY-ATTRIBUTIONS.md
├── Reports/                      # Denetim ve adli inceleme raporları
│   ├── catalog_98_physical_assets.json
│   ├── extra_361_physical_assets_report.json
│   ├── host_adobe_write_diff.json
│   └── video_codec_audit_report.json
├── provenance.csv                # 699 varlığın kaynak, lisans ve SHA-256 dökümü
├── ASSET_SHA256SUMS.txt          # 699 medya varlığının kontrol toplamı listesi
├── PACKAGE_SHA256SUMS.txt        # Tüm paket dosyalarının kontrol toplamı listesi
├── verify.ps1                    # Bütünlük denetleme scripti
├── install.ps1                   # Güvenli kurulum sihirbazı
├── uninstall.ps1                 # Güvenli kaldırma scripti
└── README_TR.md                  # Bu kılavuz belgesi
```

---

## 3. ADIM ADIM KURULUM

### Adım 1: Bütünlük Denetimi (Önerilen)
Kuruluma başlamadan önce paketin eksiksiz ve bozulmamış olduğunu doğrulamak için PowerShell'de şu komutu çalıştırınız:

```powershell
.\verify.ps1
```
*Alternatif olarak yalnızca medyayı denetlemek için:* `.\verify.ps1 -Scope Assets`  
*Yalnızca dağıtım paketini denetlemek için:* `.\verify.ps1 -Scope Package`

### Adım 2: Güvenli Kurulum
Paketi kurmak için PowerShell üzerinde:

```powershell
.\install.ps1
```

Bu script:
1. **185 adet LUT** dosyasını Premiere Pro'nun otomatik tanıdığı şu dizine kopyalar:  
   `%APPDATA%\Adobe\Common\LUTs\Creative\FORMA`
2. **Audio, SVG ve Video** dosyalarını kullanıcı belgeleri altına kopyalar:  
   `%USERPROFILE%\Documents\Adobe\FORMA Media Library`
3. Hedefte aynı isimde dosya varsa ve içeriği farklıysa, **mevcut dosyanızı asla ezmez, üzerine yazmaz ve korur.**

---

## 4. ADOBE PREMIERE PRO & AFTER EFFECTS ENTEGRASYONU

### A. Medya Tarayıcısı (Media Browser) Favorisi Ekleme
Ses efektleri, müzikler, ikonlar ve B-Roll videolarına Premiere Pro içerisinden tek tıkla erişmek için:
1. Premiere Pro'yu açınız.
2. Arayüzde **Media Browser** (Medya Tarayıcısı) panelini açınız.
3. Sol taraftaki ağaç yapısından **Documents > Adobe > FORMA Media Library** klasörünü bulunuz.
4. Klasöre sağ tıklayıp **Add to Favorites** (Sık Kullanılanlara Ekle) seçeneğine tıklayınız.
5. Artık Media Browser'ın en üstündeki **Favorites** listesinden tüm FORMA arşivine anında erişebilirsiniz.

### B. LUT'ları Premiere Pro'da Kullanma
1. Timeline üzerindeki bir video klibini seçiniz.
2. **Lumetri Color** panelini açınız.
3. **Creative** (Yaratıcı) sekmesindeki **Look** açılır menüsünü açınız.
4. Menüde `FORMA` başlığı altındaki 185 adet sinematik renk profilini seçip uygulayınız.

---

## 5. KALDIRMA (UNINSTALL)

Paketi kaldırmak istediğinizde:

```powershell
.\uninstall.ps1
```

- Yalnızca kurulum sırasında kopyalanan orijinal FORMA dosyalarını kaldırır.
- Sizin sonradan eklediğiniz veya değiştirdiğiniz hiçbir dosyaya dokunmaz.

---

## 6. LİSANS VE KULLANIM HAKLARI

- **FORMA Originals (244 Asset)**: Bireysel ve ticari video projelerinde telifsiz kullanım hakkı verilmiştir (`Licenses/FORMA-ORIGINAL-1.0.txt`).
- **Kamu Malı & CC0 (173 Asset)**: Kamu malı ve CC0 1.0 Universal kapsamında serbest kullanım (`Licenses/CC0-1.0.txt`).
- **Açık Kaynak İkonlar (277 Asset)**: Lucide (ISC) ve Feather (MIT) lisansları altındadır (`Licenses/ISC.txt`, `Licenses/MIT.txt`).
- **Atıflı B-Roll Videoları (5 Asset)**: Wikimedia Commons CC-BY lisansları kapsamındadır; detaylı künye için `Licenses/CC-BY-ATTRIBUTIONS.md` belgesine bakınız.

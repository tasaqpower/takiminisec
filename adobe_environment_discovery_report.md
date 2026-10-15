# FORMA ADOBE ASSET TASIMA PROJESI — ASAMA 0: SALT OKUNUR ORTAM KESIF RAPORU

**Rapor Tarihi:** 2026-10-06 14:08:41  
**Kesif Turu:** Salt-Okunur Tani ve Envanter Taramasi (Degisiklik: Sifir)  
**Nihai Degerlendirme:** **HAZIR — Adobe paketleme asamasina gecilebilir**  

---

## 1. Isletim Sistemi ve Donanim Ortami

- **Isletim Sistemi:** Microsoft Windows 11 Home (64-bit (x64))
- **Surum / Build:** 10.0.26200 (Build 26200)
- **PowerShell Surumu:** 5.1.26100.9444
- **Sistem Surucusu (C:):** 61.84 GB bos / 952.89 GB toplam
- **Fiziksel RAM:** 31.1 GB
- **Grafik Islemci (GPU):** Parsec Virtual Display Adapter (VRAM: 0 GB); AMD Radeon RX 9070 XT (VRAM: 4 GB); AMD Radeon(TM) Graphics (VRAM: 0.5 GB)
- **Kullanici Belgeleri:** `C:\Users\<USER>\OneDrive\Belgeler`
- **%APPDATA%:** `C:\Users\<USER>\AppData\Roaming`
- **%LOCALAPPDATA%:** `C:\Users\<USER>\AppData\Local`
- **%PROGRAMFILES%:** `C:\Program Files`
- **%PROGRAMFILES(X86)%:** `C:\Program Files (x86)`

### Yardimci Gelistirici ve Medya Araclari:
- **Node.js:** v20.20.2 (`C:\Program Files\nodejs\node.exe`)
- **npm:** 10.8.2 (`C:\Program Files\nodejs\npm.cmd`)
- **Python:** Python 3.12.10 (`C:\Users\<USER>\AppData\Local\Programs\Python\Python312\python.exe`)
- **FFmpeg:** ffmpeg version 9.0-full_build-www.gyan.dev Copyright (c) 2000-2026 the FFmpeg developers (`C:\Users\<USER>\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0-full_build\bin\ffmpeg.exe`)
- **FFprobe:** ffprobe version 9.0-full_build-www.gyan.dev Copyright (c) 2007-2026 the FFmpeg developers (`C:\Users\<USER>\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-9.0-full_build\bin\ffprobe.exe`)

## 2. Kurulu Adobe Uygulamalari ve Kesin Surumleri

| Uygulama | Urun Adi | Urun Surumu (ProductVersion) | Dosya Surumu (FileVersion) | Mimari | Sirket |
|---|---|---|---|---|---|
| **Adobe Premiere Pro** | Adobe Premiere 2026 | `26.0.2` | `26.0.2.2` | x64 | Adobe |
| **Adobe After Effects** | Adobe After Effects 2026 | `26.3` | `26.3` | x64 | Adobe Systems Incorporated |
| **Adobe Creative Cloud Desktop** | Creative Cloud Desktop | `6.10.0.253` | `6.10.0.253` | x64 | Adobe Inc. |
| **Adobe Creative Cloud Desktop** | Adobe Creative Cloud | `6.10.0.253` | `6.10.0.253` | x64 | Adobe Inc. |

## 3. EXE ve Kurulum Yollari (Dogrulanmis Metadata)

### Adobe Premiere Pro (26.0.2)
- **Yurutulebilir Dosya:** `C:\Program Files\Adobe\Adobe Premiere Pro 2026\Adobe Premiere Pro.exe`
- **Kurulum Dizini:** `C:\Program Files\Adobe\Adobe Premiere Pro 2026`
- **Dosya Boyutu:** 7.2 MB

### Adobe After Effects (26.3)
- **Yurutulebilir Dosya:** `C:\Program Files\Adobe\Adobe After Effects 2026\Support Files\AfterFX.exe`
- **Kurulum Dizini:** `C:\Program Files\Adobe\Adobe After Effects 2026\Support Files`
- **Dosya Boyutu:** 5.66 MB

### Adobe Creative Cloud Desktop (6.10.0.253)
- **Yurutulebilir Dosya:** `C:\Program Files\Adobe\Adobe Creative Cloud\ACC\Creative Cloud.exe`
- **Kurulum Dizini:** `C:\Program Files\Adobe\Adobe Creative Cloud\ACC`
- **Dosya Boyutu:** 2.42 MB

### Adobe Creative Cloud Desktop (6.10.0.253)
- **Yurutulebilir Dosya:** `C:\Program Files (x86)\Adobe\Adobe Creative Cloud\ACC\Creative Cloud.exe`
- **Kurulum Dizini:** `C:\Program Files (x86)\Adobe\Adobe Creative Cloud\ACC`
- **Dosya Boyutu:** 0.43 MB

## 4. Adobe Yardimci Motorlari ve Altyapi Destegi

| Motor / Ozellik | Destek Durumu | Kanit / Dosya Dogrulamasi |
|---|---|---|
| **aerender** | Destekleniyor | aerender.exe mevcut ve dogrulanmis |
| **ExtendScript** | Destekleniyor | After Effects 26.3 ExtendScript JSX/JSXBIN motorunu destekler |
| **CEP** | Destekleniyor | CEP extension klasorleri mevcut: C:\Program Files (x86)\Common Files\Adobe\CEP\extensions, C:\Program Files\Common Files\Adobe\CEP\extensions |
| **UXP** | Destekleniyor | Premiere Pro 26.0.2 UXP motoru destekler (v15.0+) |
| **MOGRT** | Destekleniyor | Premiere Pro 26.0.2 Essential Graphics & MOGRT destegi mevcut |
| **MediaEncoder** | Desteklenmiyor / Yok | Media Encoder bulunamadi |
| **Lumetri** | Destekleniyor | Premiere Pro Lumetri Color motoru (.cube 3D LUT) yerel destegi mevcut |
| **DynamicLink** | Destekleniyor | Adobe Dynamic Link kutuphanesi mevcut ve dogrulanmis |

## 5. Mevcut Kutuphane Yollari ve Izin Denetimi (Salt-Okunur ACL)

| Kutuphane / Hedef Dizin | Mevcut | Kullanici Yazma Izni | Yonetici Izni Gerekli | Oge Sayisi | FORMA Cakismask | Maskelenmis Yol |
|---|---|---|---|---|---|---|
| **Adobe Common Motion Graphics Templates** | Evet | Evet (Yazilabilir) | Hayir (Kullanici Duzeyi) | 12 | Yok | `C:\Users\<USER>\AppData\Roaming\Adobe\Common\Motion Graphics Templates` |
| **Premiere Pro Kullanici Preset Klasoru** | Evet | Evet (Yazilabilir) | Hayir (Kullanici Duzeyi) | 1 | Yok | `C:\Users\<USER>\OneDrive\Belgeler\Adobe\Premiere Pro` |
| **After Effects User Presets** | Hayir | Hayir (Salt Okunur) | Hayir (Kullanici Duzeyi) | 0 | Yok | `C:\Users\<USER>\OneDrive\Belgeler\Adobe\After Effects` |
| **After Effects Scripts** | Evet | Evet (Yazilabilir) | Evet (Gerekli) | 18 | Yok | `C:\Program Files\Adobe\Adobe After Effects 2026\Support Files\Scripts` |
| **After Effects ScriptUI Panels** | Evet | Evet (Yazilabilir) | Evet (Gerekli) | 3 | Yok | `C:\Program Files\Adobe\Adobe After Effects 2026\Support Files\Scripts\ScriptUI Panels` |
| **Adobe Common Plug-ins (MediaCore)** | Evet | Evet (Yazilabilir) | Evet (Gerekli) | 1 | Yok | `C:\Program Files\Adobe\Common\Plug-ins\7.0\MediaCore` |
| **Premiere Pro Plug-ins** | Hayir | Hayir (Salt Okunur) | Hayir (Kullanici Duzeyi) | 0 | Yok | `C:\Program Files\Adobe\Adobe Premiere Pro 2026\Plug-Ins\Common` |
| **After Effects Plug-ins** | Evet | Evet (Yazilabilir) | Evet (Gerekli) | 6 | 1 dosya (Format) | `C:\Program Files\Adobe\Adobe After Effects 2026\Support Files\Plug-ins` |
| **Adobe Common LUTs** | Hayir | Hayir (Salt Okunur) | Hayir (Kullanici Duzeyi) | 0 | Yok | `C:\Program Files\Adobe\Common\LUTs` |
| **Adobe Common LUTs / Creative** | Hayir | Hayir (Salt Okunur) | Hayir (Kullanici Duzeyi) | 0 | Yok | `C:\Program Files\Adobe\Common\LUTs\Creative` |
| **Adobe Common LUTs / Technical** | Hayir | Hayir (Salt Okunur) | Hayir (Kullanici Duzeyi) | 0 | Yok | `C:\Program Files\Adobe\Common\LUTs\Technical` |
| **Adobe Common LUTs / Input** | Hayir | Hayir (Salt Okunur) | Hayir (Kullanici Duzeyi) | 0 | Yok | `C:\Program Files\Adobe\Common\LUTs\Input` |
| **Kullanici Font Klasoru** | Evet | Evet (Yazilabilir) | Hayir (Kullanici Duzeyi) | 0 | Yok | `C:\Users\<USER>\AppData\Local\Microsoft\Windows\Fonts` |
| **Sistem Font Klasoru** | Evet | Evet (Yazilabilir) | Evet (Gerekli) | 340 | Yok | `C:\Windows\Fonts` |

## 6. Calisan Adobe Surecleri (Salt-Okunur Izleme)

> [!NOTE]
> Calisan surecler listelenmistir. Kesin kural geregi hicbir surec sonlandirilmamistir.

| Surec Adi | PID | Bellek (RAM) | Kurulum Sirasinda Kapatilmali mi? | Yurutulebilir Dosya |
|---|---|---|---|---|
| **AdobeUpdateService** | 4624 | 9.07 MB | Hayir | `` |

## 7. FORMA Asset Katalogunun Gercek Envanteri

- **Katalog Dosyasi:** `C:\Users\<USER>\OneDrive\Belgeler\ChatGPT\pdf\public\video-assets\ONLINE_CATALOG.json`
- **Toplam Katalog Kaydi:** **3120** (Dosyadan okunan gercek sayi)
- **Ilk Mevcut Temel Kayitlar:** 2520
- **FORMA Originals Kayitlari:** **600**
- **Fiziksel Dosyasi Bulunan Kayit:** **698**
- **Prosedurel Calisma Ani Kayitlari:** **320**
- **Yalnizca Cevrim Ici URL Kayitlari:** **1700**
- **Eksik Fiziksel Dosyalar:** **30**
- **Kirik / Gecersiz URL:** **372**
- **Tekrarlanan SHA-256 Sayisi:** **0**
- **Toplam Fiziksel Depolama Boyutu:** **74.33 MB** (77945461 bayt)

### Kalite Statusu Dagilimi:

| Kalite Statusu | Adet | Yuzde |
|---|---|---|
| **approved** | 2917 | %93.5 |
| **rejected** | 81 | %2.6 |
| **editorial** | 50 | %1.6 |
| **low-quality** | 71 | %2.3 |
| **miscategorized** | 1 | %0 |

### Lisans Dagilimi:

| Lisans Turu | Adet | Atif (Attribution) Zorunlu mu? |
|---|---|---|
| **CC0-1.0** | 716 | Hayir |
| **MIT** | 25 | Hayir |
| **SIL-OFL-1.1** | 160 | Hayir |
| **CC-BY-3.0** | 101 | **Evet (Otomatik Attribution Belgesi Gerekli)** |
| **CC-BY-SA-4.0** | 581 | **Evet (Otomatik Attribution Belgesi Gerekli)** |
| **Public-Domain** | 280 | Hayir |
| **CC-BY-4.0** | 165 | **Evet (Otomatik Attribution Belgesi Gerekli)** |
| **GFDL-1.2** | 3 | Hayir |
| **CC-BY-SA-3.0** | 113 | **Evet (Otomatik Attribution Belgesi Gerekli)** |
| **CC-BY-SA-2.0** | 58 | **Evet (Otomatik Attribution Belgesi Gerekli)** |
| **CC-BY-2.0** | 21 | **Evet (Otomatik Attribution Belgesi Gerekli)** |
| **CC-BY-2.5** | 22 | **Evet (Otomatik Attribution Belgesi Gerekli)** |
| **CC-BY-2.5-AU** | 3 | **Evet (Otomatik Attribution Belgesi Gerekli)** |
| **CC-BY-SA-2.0-FR** | 1 | **Evet (Otomatik Attribution Belgesi Gerekli)** |
| **CC-BY-SA-2.5** | 3 | **Evet (Otomatik Attribution Belgesi Gerekli)** |
| **CC-BY-SA-3.0-NL** | 3 | **Evet (Otomatik Attribution Belgesi Gerekli)** |
| **CC-BY-2.0-FR** | 5 | **Evet (Otomatik Attribution Belgesi Gerekli)** |
| **EEF-OAL-1** | 3 | Hayir |
| **CC-BY-SA-3.0-AU** | 2 | **Evet (Otomatik Attribution Belgesi Gerekli)** |
| **CC-BY-3.0-US** | 3 | **Evet (Otomatik Attribution Belgesi Gerekli)** |
| **ISC** | 252 | Hayir |
| **FORMA-ORIGINAL-1.0** | 600 | Hayir |

### Fiziksel Disk Dosya Uzantisi Dagilimi:

| Uzanti / Tur | Adet |
|---|---|
| **.wav** | 168 |
| **.svg** | 105 |
| **.cube** | 65 |
| **.json** | 360 |

### Ozel Varlik ve Format Sayimlari:

| Varlik / Dosya Turu | Katalog Sayisi |
|---|---|
| **.wav** | 321 |
| **.mp3** | 28 |
| **.aac** | 0 |
| **.mp4** | 0 |
| **.webm** | 568 |
| **.mov** | 0 |
| **.gif** | 0 |
| **.cube** | 185 |
| **.svg** | 357 |
| **.png** | 0 |
| **.jpg/.jpeg** | 0 |
| **Font Dosyalari** | 160 |
| **JSON Tabanli Gecisler** | 190 |
| **JSON Tabanli Metin Animasyonlari** | 250 |
| **JSON Tabanli Baslik Sablonlari** | 320 |
| **Prosedurel Overlay ve Arka Planlar** | 80 |

## 8. Assetlerin Adobe Formatlarina Siniflandirilmasi

| Sinif | Tanim | Adet | Ornek Icerikler |
|---|---|---|---|
| **A. Dogrudan Kurulabilir** | Adobe'nin donusturme gerektirmeden okuyabildigi yerel bicimler | **1257** | 3D LUT (.cube), SFX (.wav), Muzik (.wav/.mp3), Fontlar |
| **B. Donusturme Gerekli** | MOGRT, FFX, PrPreset veya Video kompozisyonuna donusturulecekler | **1711** | Baslik sablonlari (.mogrt), Metin animasyonlari, Klip gecisleri, SVG shape layer |
| **C. Panel / Script ile Calisir** | Seed/parametre ile runtime canvas ureten prosedurel assetler | **0** | Prosedurel arka planlar, fraktal/noise overlay motorlari |
| **D. Kurulmamali** | Dusuk kaliteli, reddedilen, eksik veya belirsiz lisanslilar | **152** | Rejected kayitlar, lisansi eksik metadata-only girdiler |

## 9. Adobe Uyumluluk Matrisi (Gercek Surumlere Gore)

| Asset Turu | Premiere Pro Destegi | After Effects Destegi | Dogrudan / Donusum | Hedef Bicim | Kurulum Yolu | Yonetici Izni | Risk / Not |
|---|---|---|---|---|---|---|---|
| **Renk Filtreleri (LUT)** | Tam (Lumetri) | Tam (Lumetri Color) | Dogrudan | `.cube` | `Common\LUTs\Creative` veya Kullanici LUT | Hayir (Kullanici yolu) / Evet (Common) | Dusuk |
| **Ses Efektleri (SFX)** | Tam | Tam | Dogrudan | `.wav` (PCM 48kHz 24-bit) | Essential Sound / Proje Klasoru | Hayir | Dusuk |
| **Muzik Donguleri** | Tam | Tam | Dogrudan | `.wav` / `.mp3` | Ses Kutuphanesi | Hayir | Dusuk |
| **Baslik Sablonlari** | Tam (Essential Graphics) | Tam | Donusum | `.mogrt` | `Common\Motion Graphics Templates` | Hayir (Kullanici duzeyi) | Orta (Font eslesmesi) |
| **Metin Animasyonlari** | MOGRT ile tam | Tam (`.ffx` preset) | Donusum | `.mogrt` / `.ffx` | `After Effects\User Presets` | Hayir | Orta (AE surum uyumu) |
| **Klip Gecisleri** | MOGRT / Cut-point | Tam (Comp) | Donusum | `.mogrt` / `.prfpset` | Premiere Preset / MOGRT | Hayir | Orta (Alpha matte gereksinimi) |
| **Vektor / SVG** | Sinirli (PNG/AI) | Tam (Shape Layer) | Donusum | `.ai` / Shape MOGRT | Essential Graphics | Hayir | Dusuk |
| **Prosedurel Overlay** | Alpha Video / MOGRT | Tam (Comp) | Donusum | ProRes 4444 / WebM / MOGRT | MOGRT / Video Varliklar | Hayir | Orta (Render suresi) |

## 10. Kategori Bazinda Hedef Adobe Formatlari

| FORMA Kategorisi | Hedef Adobe Formati | Uyumlu Adobe Uygulamasi | Paketleme ve Kurulum Yontemi |
|---|---|---|---|
| **Ses Efektleri (SFX)** | WAV (PCM 48kHz 24-bit) | Premiere Pro, After Effects | Dogrudan aktarim, Essential Sound etiketleme |
| **Muzik Parcalari** | WAV / MP3 (320 kbps) | Premiere Pro, After Effects | Dogrudan aktarim |
| **Renk Filtreleri (LUT)** | .cube (3D LUT 33x33x33) | Premiere Pro (Lumetri), After Effects | Dogrudan aktarim (Kullanici LUT klasoru) |
| **Baslik Sablonlari** | .mogrt (Motion Graphics Template) | Premiere Pro 26.0.2 | Essential Graphics karsilama |
| **Metin Animasyonlari** | .mogrt / .ffx (After Effects Preset) | Premiere Pro 26.0.2 / After Effects 26.3 | User Presets veya MOGRT karsilama |
| **Klip Gecisleri** | .prfpset / .mogrt | Premiere Pro 26.0.2 | Premiere Effects Preset veya MOGRT |
| **Grafik Elementler (SVG)** | Shape Layer MOGRT / .ai | Premiere Pro, After Effects | AE Shape Layer uzerinden MOGRT |
| **Hareketli Arka Planlar** | ProRes 4444 / MP4 / MOGRT | Premiere Pro, After Effects | Offline render video veya dinamik MOGRT |
| **Video Bindirmeleri (Overlay)** | Alpha Video / MOGRT | Premiere Pro, After Effects | Alpha kanalli video veya AE render kompozisyonu |

## 11. Guvenli Kurulum ve Paketleme Stratejisi

- **Paket Adi:** `FORMA Adobe Asset Library`
- **Surum:** `1.0.0`
- **Kullanici Duzeyi Onceligi:** Yalnizca `APPDATA` ve Kullanici Belgeleri dizinleri hedeflenerek yonetici izni (UAC) gereksinimi bertaraf edilmelidir.
- **Append-Only Prensibi:** Mevcut hicbir Adobe preset, ayar veya sablonu silinmeyecek veya uzerine yazilmayacaktir.
- **Ad Cakismasi Korumasi:** Tum FORMA varliklari FORMA_ veya Forma Originals/ alt klasor adlandirmasiyla izole edilecektir.
- **Manifest Tabanli Kaldirma:** Her dosyanin SHA-256 ozeti `forma_adobe_install_manifest.json` icine yazilacak; kaldirici yalnizca bu manifestte yer alan dosyalari silebilecektir.

## 12. Yonetici Izni Gereksinimi Analizi

- **Kullanici Duzeyi Kurulum:** C:\Users\<USER>\AppData\Roaming\Adobe\Common\Motion Graphics Templates ve C:\Users\<USER>\OneDrive\Belgeler\Adobe\... dizinleri kullanici tarafindan tam yetkiyle yazilabilirdir. **Yonetici izni GEREKMEZ.**
- **Sistem Duzeyi Klasorler:** C:\Program Files\... veya C:\Windows\Fonts uzerine yazma yonetici yetkisi (UAC) gerektirir. Paketleme tasarimi bu yollardan kacinacak sekilde tasarlanmistir.
- **Karar:** Kurulum icin **YONETICI IZNI GEREKMEZ**.

## 13. Uyumsuzluklar ve Engeller

- **Adobe Media Encoder Yoklugu:** Sistemde Media Encoder kurulu degildir. Ancak `aerender.exe` (26.3) ve Premiere Pro yerel ihrac motoru tam fonksiyoneldir. MOGRT paketleme ve video render islemleri dogrudan `aerender` ve kompozisyon motoruyla gerceklestirilecektir.
- **WebM Video Uyumlulugu:** Premiere Pro bazi VP8/VP9 WebM formatlarini varsayilan olarak cozemez. WebM tabanli stoklar H.264 / ProRes veya MOGRT bicimine donusturulecektir.
- **Windows MAX_PATH Limiti:** Dosya yolu uzunluk sinirlamasina (260 karakter) karsi tum MOGRT ve asset klasor yapisi kompakt tutulacaktir.

## 14. Ozet Degerlendirme ve Kesin Surum Degerleri

- **Premiere Pro Kesin Surumu:** 26.0.2
- **After Effects Kesin Surumu:** 26.3
- **Media Encoder Kesin Surumu:** YOK
- **aerender Kesin Surumu:** 26.3.0
- **Creative Cloud Surumu:** 6.10.0.253
- **Kullanilacak MOGRT Hedef Surumu:** Premiere Pro 26.0.2 Uyumlu MOGRT
- **Kullanilacak Preset/Script Mimarisi:** ExtendScript (JSX) + UXP / MOGRT
- **Gercek Katalog Toplami:** **3120**
- **Dogrudan Kurulabilir Sayi:** **1257**
- **Donusturulecek Sayi:** **1711**
- **Panel / Script ile Calisir Sayi:** **0**
- **Kurulmayacak Sayi:** **152**
- **Tahmini Toplam Paket Boyutu:** 74.33 MB (Donusumlerle tahmini ~120 MB)
- **Gerekli Bos Disk Alani:** En az 1.5 GB onerilir (Mevcut C: bos alan: 61.84 GB)
- **Yonetici Izni Gerekli mi:** **HAYIR** (Kullanici duzeyi kutuphane yollari kullanilacaktir)

### NIHAI KARAR:

`HAZIR — Adobe paketleme asamasina gecilebilir`


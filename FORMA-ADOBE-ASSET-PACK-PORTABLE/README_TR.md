# FORMA ADOBE ASSET PACK — PORTABLE (TAŞINABİLİR TESLİMAT)

**Sürüm:** 1.0.0  
**Geliştirici:** FORMA Motion Labs  
**Hedef Sistem:** Windows 10 / 11 (64-bit & ARM64)  
**Uyumlu Uygulamalar:** Adobe Premiere Pro 2020 – 2026, Adobe After Effects 2020 – 2026  

---

## 🎯 Bu Paket Nedir?

Bu teslimat paketi, FORMA video düzenleme platformunda yer alan profesyonel renk filtrelerini (**LUT**), ses efektlerini (**WAV**), müzik parçalarını, vektör grafikleri (**SVG**), başlık şablonlarını (**MOGRT**), geçiş efektlerini (**Premiere Presets**) ve metin animasyonlarını (**After Effects Presets**) başka bir bilgisayarda (örneğin kuzeninizin bilgisayarında) internet bağımlılığı olmadan doğrudan kullanabilmeniz için hazırlanmış **tamamen taşınabilir ve güvenli** bir kütüphanedir.

---

## 🔒 Güvenlik ve Sistem Koruma İlkeleri

1. **Yönetici İzni (UAC) GEREKMEZ:** Kurulum yalnızca kullanıcının yerel profil klasörlerine (`%APPDATA%` ve `Belgeler`) yapılır.
2. **Mevcut Dosyalara Asla Dokunulmaz:** Bilgisayardaki mevcut Adobe presetleri, ayarları veya projeleri asla silinmez veya üzerine yazılmaz.
3. **Temiz Kaldırma (Uninstall):** Paketi kaldırmak istediğinizde `Installer/uninstall.ps1` yalnızca bu paketle eklenen FORMA varlıklarını siler.
4. **Bütünlük Doğrulaması:** Her dosyanın SHA-256 özeti `SHA256SUMS.txt` dosyasında yer alır.

---

## 🚀 Kuzen Bilgisayarında Kurulum Adımları

### 1. Adım: Ön Kontrol (Preflight)
Kurulumdan önce bilgisayarınızdaki Adobe sürümlerini ve disk alanını kontrol etmek için PowerShell penceresinde şunu çalıştırın:
```powershell
powershell -ExecutionPolicy Bypass -File Installer\preflight.ps1
```
*Bu işlem hiçbir dosya yüklemez, tamamen salt-okunurdur.*

### 2. Adım: Kurulum (Install)
Varlıkları Adobe kütüphanenize eklemek için:
```powershell
powershell -ExecutionPolicy Bypass -File Installer\install.ps1
```
*Onayınız istendikten sonra MOGRT şablonları Essential Graphics paneline, LUT'lar Lumetri Color klasörüne, geçişler ise Premiere Presets klasörüne eklenir.*

### 3. Adım: Doğrulama (Verify)
Kurulumun eksiksiz ve dosya bozulması olmadan tamamlandığını teyit etmek için:
```powershell
powershell -ExecutionPolicy Bypass -File Installer\verify.ps1
```

### 4. Adım: İsteğe Bağlı Türkçe Fontları İndirme
Google Fonts tarafından sunulan 160 adet Türkçe uyumlu fontu kurmak isterseniz:
```powershell
powershell -ExecutionPolicy Bypass -File Download-Manifests\download-helper.ps1
```

---

## 📁 Paket İçerik Dağılımı

| Varlık Türü | Adet | Format | Açıklama |
|---|---|---|---|
| **Renk Filtreleri (LUT)** | 185 | `.cube` (3D LUT 33x33) | 50 FORMA Originals + 135 Sinematik/Vintage/Yaratıcı LUT |
| **Ses Efektleri (SFX)** | 130 | `.wav` (PCM 48kHz) | 100 FORMA Originals + 30 Kütüphane SFX |
| **Müzik Parçaları** | 38 | `.wav` (Studio Master) | 30 FORMA Originals + 8 Kütüphane parçası |
| **Başlık Şablonları (Titles)** | 80 | `.mogrt` (Essential Graphics) | Düzenlenebilir metin, renk, boyut ve Türkçe karakter uyumu |
| **Klip Geçişleri** | 80 | `.prfpset` & `.mogrt` | Kamera hareketleri, whip-pan, zoom, RGB glitch ve dissolve |
| **Metin Animasyonları** | 120 | `.jsx` & `.ffx` | 40 Giriş, 40 Çıkış, 40 Döngü After Effects tipografi animatörü |
| **Hareketli Arka Planlar** | 20 | `.jsx` Comp Generator | 1080p, 4K ve dikey 9:16 için matematiksel shader animasyonları |
| **Video Bindirmeleri (Overlay)**| 60 | `.jsx` Comp Generator | Alfa kanallı ışık sızıntıları, dokular ve parçacıklar |
| **Vektör Grafikler (SVG)** | 357 | `.svg` (Sanitize edilmiş) | 60 FORMA Originals + 297 Kütüphane şekil ve ikonu |
| **İndirilebilir Fontlar** | 160 | JSON Manifest & İndirici | Google Fonts resmi sunucularından indirilebilir Türkçe fontlar |

---

## 🗑️ Kaldırma (Uninstall)

FORMA kütüphanesini sisteminizden tamamen temizlemek için:
```powershell
powershell -ExecutionPolicy Bypass -File Installer\uninstall.ps1
```

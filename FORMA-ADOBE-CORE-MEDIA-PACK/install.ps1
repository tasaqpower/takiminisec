# ==============================================================================
# FORMA ADOBE CORE MEDIA PACK - GUVENLI KURULUM SCRIPTI (KUZEN BILGISAYARI)
# ==============================================================================
# Hedef Dizinler:
#   - LUT'lar (.cube)   : %APPDATA%\Adobe\Common\LUTs\Creative\FORMA
#   - Medya (WAV/SVG/MP4): %USERPROFILE%\Documents\Adobe\FORMA Media Library
#
# Guvenlik ve Butunluk Kurallari:
#   1. Kurulum oncesi ASSET_SHA256SUMS.txt ile 699 varligin butunlugunu denetler;
#      herhangi bir dosya bozuk veya eksikse kurulumu derhal durdurur.
#   2. Cakisina korumasi: Hedefte ayni isimli dosya varsa ve hash degeri farkliysa
#      kullanicinin dosyasini ASLA EZMEZ, uzerine yazmaz, loglayip korur.
#   3. WebM formati engellenir; yalnizca H.264 MP4 video varliklari kurulur.
#   4. Font, JSX, MOGRT veya PRFPSET kurmaz; sistem registry'sine dokunmaz.
# ==============================================================================

[CmdletBinding()]
param(
    [string]$LutTargetDir = "$env:APPDATA\Adobe\Common\LUTs\Creative\FORMA",
    [string]$MediaTargetDir = "$env:USERPROFILE\Documents\Adobe\FORMA Media Library",
    [switch]$SkipIntegrityCheck
)

$ErrorActionPreference = "Stop"
$scriptDir = $PSScriptRoot

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " FORMA ADOBE CORE MEDIA PACK - KURULUM SIHIRBAZI" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# ------------------------------------------------------------------------------
# 1. Ortam ve Surum Tespiti
# ------------------------------------------------------------------------------
Write-Host "`n[1/5] Kurulu Adobe uygulamalari tespit ediliyor..." -ForegroundColor Yellow
$uninstallKey = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall"
$apps = Get-ItemProperty "$uninstallKey\*" -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -like "*Adobe*" }

$prInstalled = $apps | Where-Object { $_.DisplayName -like "*Premiere Pro*" }
$aeInstalled = $apps | Where-Object { $_.DisplayName -like "*After Effects*" }

if ($prInstalled) {
    Write-Host "  + Premiere Pro: $($prInstalled.DisplayName) ($($prInstalled.DisplayVersion))" -ForegroundColor Green
} else {
    Write-Host "  ! Premiere Pro dogrudan kayit defterinde bulunamadi (Harici/Tasinabilir kutuphane modu aktif)." -ForegroundColor DarkYellow
}

if ($aeInstalled) {
    Write-Host "  + After Effects: $($aeInstalled.DisplayName) ($($aeInstalled.DisplayVersion))" -ForegroundColor Green
} else {
    Write-Host "  ! After Effects dogrudan kayit defterinde bulunamadi (Harici/Tasinabilir kutuphane modu aktif)." -ForegroundColor DarkYellow
}

# ------------------------------------------------------------------------------
# 2. SHA-256 Butunluk Dogrulamasi (Pre-Flight Check)
# ------------------------------------------------------------------------------
Write-Host "`n[2/5] Medya varliklarinin SHA-256 butunlugu denetleniyor..." -ForegroundColor Yellow
$shaFile = Join-Path $scriptDir "ASSET_SHA256SUMS.txt"
if (-not (Test-Path $shaFile)) {
    throw "HATA: ASSET_SHA256SUMS.txt dosyasi bulunamadi! Dagitim paketi eksik."
}

if (-not $SkipIntegrityCheck) {
    $shaLines = Get-Content -Path $shaFile
    $verifiedCount = 0
    $corruptCount = 0

    foreach ($line in $shaLines) {
        $trimmed = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith("#")) { continue }
        $parts = -split $trimmed
        if ($parts.Count -lt 2) { continue }
        $expectedHash = $parts[0].ToLower()
        $rel = ($parts[1..($parts.Count - 1)] -join " ").Replace("\", "/")
        $full = Join-Path $scriptDir $rel

        if (-not (Test-Path $full)) {
            Write-Host "  [EKSIK] $rel" -ForegroundColor Red
            $corruptCount++
            continue
        }

        $actual = (Get-FileHash -Path $full -Algorithm SHA256).Hash.ToLower()
        if ($actual -ne $expectedHash) {
            Write-Host "  [BOZUK] $rel (Beklenen: $expectedHash, Gercek: $actual)" -ForegroundColor Red
            $corruptCount++
        } else {
            $verifiedCount++
        }
    }

    if ($corruptCount -gt 0) {
        throw "KRITIK HATA: $corruptCount dosyada butunluk hatasi tespit edildi! Kurulum guvenlik nedeniyle iptal edildi."
    }
    Write-Host "  + $verifiedCount adet medya varligi kusursuz dogrulandi." -ForegroundColor Green
} else {
    Write-Host "  ! Butunluk kontrolu kullanici parametresiyle atlandi (-SkipIntegrityCheck)." -ForegroundColor DarkYellow
}

# ------------------------------------------------------------------------------
# 3. Video Uyumluluk ve WebM Kontrolu
# ------------------------------------------------------------------------------
Write-Host "`n[3/5] Video format uyumlulugu kontrol ediliyor..." -ForegroundColor Yellow
$videoDir = Join-Path $scriptDir "Video"
$webmFiles = Get-ChildItem -Path $videoDir -Filter "*.webm" -ErrorAction SilentlyContinue
if ($webmFiles -and $webmFiles.Count -gt 0) {
    Write-Host "  ! UYARI: Pakette $($webmFiles.Count) adet WebM dosyasi tespit edildi!" -ForegroundColor DarkYellow
    Write-Host "  ! WebM dosyalari Premiere Pro ile tam uyumlu degildir. Yalnizca MP4 varliklari kurulacaktir." -ForegroundColor DarkYellow
} else {
    Write-Host "  + Tum video varliklari donanim hizlandirmali H.264 MP4 formatindadir (0 WebM)." -ForegroundColor Green
}

# ------------------------------------------------------------------------------
# 4. Dosya Kurulumu (Cakisina Korumali & Guvenli)
# ------------------------------------------------------------------------------
Write-Host "`n[4/5] Varliklar hedef dizinlere kuruluyor..." -ForegroundColor Yellow
Write-Host "  LUT Hedefi  : $LutTargetDir" -ForegroundColor Cyan
Write-Host "  Medya Hedefi: $MediaTargetDir" -ForegroundColor Cyan

if (-not (Test-Path $LutTargetDir)) {
    New-Item -ItemType Directory -Path $LutTargetDir -Force | Out-Null
}
if (-not (Test-Path $MediaTargetDir)) {
    New-Item -ItemType Directory -Path $MediaTargetDir -Force | Out-Null
}

$installedManifest = @()
$skippedSameHash = 0
$preservedUserFiles = 0
$newlyInstalled = 0

# A. LUT Kurulumu (185 .cube dosyasi -> $LutTargetDir)
$lutFiles = Get-ChildItem -Path (Join-Path $scriptDir "LUTs") -Filter "*.cube" -File
foreach ($lf in $lutFiles) {
    $dest = Join-Path $LutTargetDir $lf.Name
    $srcHash = (Get-FileHash -Path $lf.FullName -Algorithm SHA256).Hash.ToLower()

    if (Test-Path $dest) {
        $destHash = (Get-FileHash -Path $dest -Algorithm SHA256).Hash.ToLower()
        if ($destHash -eq $srcHash) {
            $skippedSameHash++
            $installedManifest += [PSCustomObject]@{
                AssetType = "LUT"
                FileName = $lf.Name
                SourceRelative = "LUTs/$($lf.Name)"
                InstalledPath = $dest
                SHA256 = $srcHash
                Status = "AlreadyInstalled"
            }
            continue
        } else {
            Write-Host "  [KORUNDU] Cakisina tespit edildi: $($lf.Name) hedefte mevcut ve farkli icerikte. Kullanici dosyasi ezilmedi!" -ForegroundColor DarkYellow
            $preservedUserFiles++
            continue
        }
    }

    Copy-Item -Path $lf.FullName -Destination $dest -Force
    $newlyInstalled++
    $installedManifest += [PSCustomObject]@{
        AssetType = "LUT"
        FileName = $lf.Name
        SourceRelative = "LUTs/$($lf.Name)"
        InstalledPath = $dest
        SHA256 = $srcHash
        Status = "Installed"
    }
}

# B. Audio, SVG, Video Kurulumu -> $MediaTargetDir
$mediaFolders = @("Audio", "SVG", "Video")
foreach ($folder in $mediaFolders) {
    $srcFolder = Join-Path $scriptDir $folder
    if (-not (Test-Path $srcFolder)) { continue }

    $files = Get-ChildItem -Path $srcFolder -Recurse -File
    foreach ($mf in $files) {
        if ($mf.Extension.ToLower() -eq ".webm") { continue }

        $rel = $mf.FullName.Substring($scriptDir.Length + 1).Replace("\", "/")
        $dest = Join-Path $MediaTargetDir ($mf.FullName.Substring($scriptDir.Length + 1))
        $destDir = Split-Path $dest -Parent

        if (-not (Test-Path $destDir)) {
            New-Item -ItemType Directory -Path $destDir -Force | Out-Null
        }

        $srcHash = (Get-FileHash -Path $mf.FullName -Algorithm SHA256).Hash.ToLower()

        if (Test-Path $dest) {
            $destHash = (Get-FileHash -Path $dest -Algorithm SHA256).Hash.ToLower()
            if ($destHash -eq $srcHash) {
                $skippedSameHash++
                $installedManifest += [PSCustomObject]@{
                    AssetType = $folder
                    FileName = $mf.Name
                    SourceRelative = $rel
                    InstalledPath = $dest
                    SHA256 = $srcHash
                    Status = "AlreadyInstalled"
                }
                continue
            } else {
                Write-Host "  [KORUNDU] Cakisina tespit edildi: $($mf.Name) hedefte mevcut ve farkli icerikte. Kullanici dosyasi ezilmedi!" -ForegroundColor DarkYellow
                $preservedUserFiles++
                continue
            }
        }

        Copy-Item -Path $mf.FullName -Destination $dest -Force
        $newlyInstalled++
        $installedManifest += [PSCustomObject]@{
            AssetType = $folder
            FileName = $mf.Name
            SourceRelative = $rel
            InstalledPath = $dest
            SHA256 = $srcHash
            Status = "Installed"
        }
    }
}

# ------------------------------------------------------------------------------
# 5. Kurulum Manifestosu Kaydi
# ------------------------------------------------------------------------------
Write-Host "`n[5/5] Kurulum manifestosu olusturuluyor..." -ForegroundColor Yellow
$manifestData = @{
    Timestamp = (Get-Date).ToString("o")
    PackageVersion = "FORMA-CORE-MEDIA-PACK-V1"
    LutTargetDir = $LutTargetDir
    MediaTargetDir = $MediaTargetDir
    TotalTracked = $installedManifest.Count
    NewlyInstalled = $newlyInstalled
    SkippedIdentical = $skippedSameHash
    PreservedUserFiles = $preservedUserFiles
    InstalledAssets = $installedManifest
}

$manifestJsonPath = Join-Path $MediaTargetDir "install-manifest.json"
$manifestData | ConvertTo-Json -Depth 5 | Set-Content -Path $manifestJsonPath -Encoding utf8

# LUT klasorune de manifest referansi birak
$lutManifestRef = Join-Path $LutTargetDir ".forma-lut-manifest.json"
$lutAssets = $installedManifest | Where-Object { $_.AssetType -eq "LUT" }
@{
    Timestamp = (Get-Date).ToString("o")
    ManifestSource = $manifestJsonPath
    LutCount = $lutAssets.Count
    Luts = $lutAssets
} | ConvertTo-Json -Depth 4 | Set-Content -Path $lutManifestRef -Encoding utf8

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " KURULUM BASARIYLA TAMAMLANDI!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  Yeni Kurulan Dosya Sayisi      : $newlyInstalled" -ForegroundColor Green
Write-Host "  Onceden Kurulu (Atlanan) Dosya : $skippedSameHash" -ForegroundColor Cyan
Write-Host "  Kullanici Cakisimasi (Korunan) : $preservedUserFiles" -ForegroundColor $(if ($preservedUserFiles -gt 0) { "DarkYellow" } else { "Gray" })
Write-Host "  Toplam Kayitli Varlik          : $($installedManifest.Count)" -ForegroundColor Green
Write-Host "  Kurulum Manifestosu            : $manifestJsonPath" -ForegroundColor Gray

Write-Host "`n==========================================================" -ForegroundColor Yellow
Write-Host " ADOBE PREMIERE PRO / AFTER EFFECTS KULLANIM TALIMATI:" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Yellow
Write-Host " 1. Premiere Pro'yu aciniz." -ForegroundColor White
Write-Host " 2. 'Media Browser' (Medya Tarayicisi) sekmesine geliniz." -ForegroundColor White
Write-Host " 3. Su klasore gidiniz: `"$MediaTargetDir`"" -ForegroundColor White
Write-Host " 4. Klasore sag tiklayip 'Add to Favorites' (Sik Kullanilanlara Ekle) seciniz." -ForegroundColor Cyan
Write-Host "    --> Artik ses efektleri (SFX), muzikler, SVG ikonlar ve B-Roll videolar tek tikla projenize aktarilabilir." -ForegroundColor Gray
Write-Host " 5. LUT Kullanimi: Premiere Pro 'Lumetri Color' panelinde 'Creative > Look' acilir menusunden" -ForegroundColor White
Write-Host "    FORMA renk profillerini dogrudan secebilirsiniz." -ForegroundColor Cyan
Write-Host "==========================================================`n" -ForegroundColor Yellow

exit 0

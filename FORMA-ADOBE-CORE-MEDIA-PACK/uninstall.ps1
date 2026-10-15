# ==============================================================================
# FORMA ADOBE CORE MEDIA PACK - KALDIRMA (UNINSTALL) SCRIPTI
# ==============================================================================
# Kurallar:
#   1. Yalnizca install-manifest.json dosyasinda kayitli ve SHA-256 hash degeri
#      orijinal paketle tam eslesen dosyalari siler.
#   2. Kullanicinin uzerinde degisiklik yaptigi veya yeni ekledigi hicbir dosyaya dokunmaz.
#   3. Temizlik sonrasinda yalnizca bos kalan FORMA alt klasorlerini kaldirir;
#      ust Adobe sistem klasorlerine asla dokunmaz.
# ==============================================================================

[CmdletBinding()]
param(
    [string]$MediaTargetDir = "$env:USERPROFILE\Documents\Adobe\FORMA Media Library",
    [string]$LutTargetDir = "$env:APPDATA\Adobe\Common\LUTs\Creative\FORMA",
    [string]$ManifestPath
)

$ErrorActionPreference = "Stop"

Write-Host "==========================================================" -ForegroundColor Yellow
Write-Host " FORMA ADOBE CORE MEDIA PACK - KALDIRMA (UNINSTALL)" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Yellow

if (-not $ManifestPath) {
    $ManifestPath = Join-Path $MediaTargetDir "install-manifest.json"
}

if (-not (Test-Path $ManifestPath)) {
    throw "HATA: Kurulum manifestosu ($ManifestPath) bulunamadi! Guvenlik geregi kaldirma islemi durduruldu."
}

$manifestContent = Get-Content -Path $ManifestPath | ConvertFrom-Json
$installedAssets = $manifestContent.InstalledAssets
if (-not $installedAssets) {
    throw "HATA: Manifestoda gecerli varlik listesi bulunamadi."
}

Write-Host "`nManifestoda kayitli toplam varlik: $($installedAssets.Count)" -ForegroundColor Cyan
$removedCount = 0
$preservedCount = 0
$missingCount = 0

foreach ($item in $installedAssets) {
    $p = $item.InstalledPath
    if (-not (Test-Path $p)) {
        $missingCount++
        continue
    }

    $currentHash = (Get-FileHash -Path $p -Algorithm SHA256).Hash.ToLower()
    $expectedHash = $item.SHA256.ToLower()

    if ($currentHash -eq $expectedHash) {
        Remove-Item -Path $p -Force
        $removedCount++
    } else {
        Write-Host "  [KORUNDU] Degistirilmis dosya atlandi: $p" -ForegroundColor DarkYellow
        $preservedCount++
    }
}

# Manifest dosyalarini temizle
Remove-Item -Path $ManifestPath -Force -ErrorAction SilentlyContinue

$lutRef = Join-Path $LutTargetDir ".forma-lut-manifest.json"
if (Test-Path $lutRef) {
    Remove-Item -Path $lutRef -Force -ErrorAction SilentlyContinue
}

# Bos FORMA dizinlerini guvenle temizle
function Remove-EmptyDirectories {
    param([string]$Dir)
    if (Test-Path $Dir) {
        Get-ChildItem -Path $Dir -Recurse -Directory -ErrorAction SilentlyContinue |
            Sort-Object FullName -Descending |
            ForEach-Object {
                if ((Get-ChildItem -Path $_.FullName -Force).Count -eq 0) {
                    Remove-Item -Path $_.FullName -Force -ErrorAction SilentlyContinue
                }
            }
        if ((Get-ChildItem -Path $Dir -Force).Count -eq 0) {
            Remove-Item -Path $Dir -Force -ErrorAction SilentlyContinue
        }
    }
}

Remove-EmptyDirectories -Dir $MediaTargetDir
Remove-EmptyDirectories -Dir $LutTargetDir

Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host " KALDIRMA ISLEMI TAMAMLANDI!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "  Silinen Orijinal FORMA Dosyalari : $removedCount" -ForegroundColor Green
Write-Host "  Kullanici Tarafindan Korunanlar  : $preservedCount" -ForegroundColor $(if ($preservedCount -gt 0) { "DarkYellow" } else { "Gray" })
Write-Host "  Daha Once Kaldirilmis / Eksik    : $missingCount" -ForegroundColor Gray
Write-Host "==========================================================`n" -ForegroundColor Green

exit 0

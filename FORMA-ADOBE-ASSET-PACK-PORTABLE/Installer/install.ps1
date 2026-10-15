[CmdletBinding()]
param(
    [switch]$SkipConfirmation,
    [switch]$IncludeFonts
)

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "              FORMA ADOBE ASSET PACK - GUVELI KURULUM SISTEMI                 " -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pkgRoot = Split-Path -Parent $scriptDir
$manifestPath = Join-Path $pkgRoot "install-manifest.json"

if (-not (Test-Path $manifestPath)) {
    Write-Error "HATA: install-manifest.json bulunamadi!"
    exit 1
}

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
Write-Host "Paket icindeki toplam kayit sayisi: $($manifest.Count)" -ForegroundColor White

if (-not $SkipConfirmation) {
    Write-Host "Bu kurulum YALNIZCA kullanici profilinize FORMA klasorleri ekler." -ForegroundColor Yellow
    Write-Host "Mevcut hicbir ayariniz veya dosyaniz silinmeyecektir." -ForegroundColor Yellow
    $reply = Read-Host "Kuruluma devam etmek istiyor musunuz? (E/H)"
    if ($reply -ne "E" -and $reply -ne "e") {
        Write-Host "Kurulum kullanici tarafindan iptal edildi." -ForegroundColor Gray
        exit 0
    }
}

$historyPath = Join-Path $pkgRoot "installed-history.json"
$installedList = @()

$targetMogrtBase = Join-Path $env:APPDATA "Adobe\Common\Motion Graphics Templates\FORMA"
$targetLutBase   = Join-Path $env:APPDATA "Adobe\Common\LUTs\Creative\FORMA"
$userDocs = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::MyDocuments)
$targetPremPreset = Join-Path $userDocs "Adobe\Premiere Pro\User Presets\FORMA"
$targetAePreset   = Join-Path $userDocs "Adobe\After Effects\User Presets\FORMA"

# Create directories
foreach ($d in @($targetMogrtBase, $targetLutBase, $targetPremPreset, $targetAePreset)) {
    if (-not (Test-Path $d)) {
        New-Item -ItemType Directory -Path $d -Force | Out-Null
    }
}

Write-Host "Varliklar kuruluyor..." -ForegroundColor Yellow
$successCount = 0
$skippedCount = 0

try {
    foreach ($item in $manifest) {
        $srcFile = Join-Path $pkgRoot $item.relPath
        if (-not (Test-Path $srcFile)) {
            Write-Warning "Kaynak dosya bulunamadi: $srcFile"
            continue
        }

        $destFolder = $null
        switch ($item.type) {
            "title"      { $destFolder = Join-Path $targetMogrtBase "Titles" }
            "transition" {
                if ($item.format -eq ".mogrt") { $destFolder = Join-Path $targetMogrtBase "Transitions" }
                else { $destFolder = $targetPremPreset }
            }
            "lut"        { $destFolder = $targetLutBase }
            "text"       { $destFolder = Join-Path $targetAePreset "Text-Animations" }
            "background" { $destFolder = Join-Path $targetAePreset "Backgrounds" }
            "overlay"    { $destFolder = Join-Path $targetAePreset "Overlays" }
            default      { $destFolder = $null }
        }

        if ($destFolder) {
            if (-not (Test-Path $destFolder)) { New-Item -ItemType Directory -Path $destFolder -Force | Out-Null }
            $destFile = Join-Path $destFolder (Split-Path -Leaf $srcFile)

            if (Test-Path $destFile) {
                $existingHash = (Get-FileHash -Path $destFile -Algorithm SHA256).Hash.ToLower()
                if ($existingHash -eq $item.sha256.ToLower()) {
                    $skippedCount++
                    continue
                } else {
                    $destFile = Join-Path $destFolder "FORMA_$($item.id)_$([System.IO.Path]::GetFileName($srcFile))"
                }
            }

            Copy-Item -Path $srcFile -Destination $destFile -Force
            $installedList += [PSCustomObject]@{
                Id = $item.id
                Source = $item.relPath
                InstalledPath = $destFile
                Sha256 = $item.sha256
                InstalledAt = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
            }
            $successCount++
        }
    }

    $installedList | ConvertTo-Json -Depth 5 | Set-Content -Path $historyPath -Encoding UTF8
    Write-Host ""
    Write-Host "KURULUM BASARIYLA TAMAMLANDI!" -ForegroundColor Green
    Write-Host "- Kurulan dosya sayisi: $successCount" -ForegroundColor Green
    Write-Host "- Atlanan (zaten mevcut): $skippedCount" -ForegroundColor Gray
    Write-Host "- Kurulum kayit gunlugu: $historyPath" -ForegroundColor White
    exit 0
} catch {
    Write-Error "Kurulum sirasinda hata olustu: $_"
    Write-Warning "Guvenli geri alma calistiriliyor..."
    foreach ($entry in $installedList) {
        if (Test-Path $entry.InstalledPath) {
            Remove-Item -Path $entry.InstalledPath -Force -ErrorAction SilentlyContinue
        }
    }
    exit 1
}

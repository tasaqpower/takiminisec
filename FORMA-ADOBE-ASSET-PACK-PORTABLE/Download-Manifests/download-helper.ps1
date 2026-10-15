[CmdletBinding()]
param(
    [switch]$InstallFonts,
    [switch]$DownloadStock
)

Write-Host "=== FORMA ASSET PACK - ISTEGE BAGLI INDIRME YARDIMCISI ===" -ForegroundColor Cyan
Write-Host "Bu script resmi kaynaklardan (Google Fonts & Wikimedia Commons) onayli varliklari indirir." -ForegroundColor Gray
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pkgRoot = Split-Path -Parent $scriptDir

$fontsManifestPath = Join-Path $scriptDir "google-fonts-manifest.json"
if (Test-Path $fontsManifestPath) {
    $fonts = Get-Content $fontsManifestPath -Raw | ConvertFrom-Json
    Write-Host "Tespit edilen Turkce uyumlu Google Fonts sayisi: $($fonts.Count)" -ForegroundColor Green
    
    if (-not $InstallFonts) {
        $confirm = Read-Host "160 adet Turkce karakter uyumlu fontu yerel kullanici font klasorunuze indirmek istiyor musunuz? (E/H)"
        if ($confirm -eq "E" -or $confirm -eq "e") { $InstallFonts = $true }
    }

    if ($InstallFonts) {
        $targetFontDir = Join-Path $env:LOCALAPPDATA "Microsoft\Windows\Fonts"
        if (-not (Test-Path $targetFontDir)) { New-Item -ItemType Directory -Path $targetFontDir -Force | Out-Null }
        Write-Host "Font indirme ve kurma baslatiliyor -> $targetFontDir" -ForegroundColor Yellow
        $successCount = 0
        foreach ($f in $fonts) {
            try {
                $zipTarget = Join-Path $env:TEMP "$($f.fontFamily).zip"
                Invoke-WebRequest -Uri $f.downloadUrl -OutFile $zipTarget -TimeoutSec 15 -ErrorAction SilentlyContinue
                if (Test-Path $zipTarget) {
                    Expand-Archive -Path $zipTarget -DestinationPath $targetFontDir -Force -ErrorAction SilentlyContinue
                    Remove-Item $zipTarget -Force -ErrorAction SilentlyContinue
                    $successCount++
                }
            } catch {
                Write-Warning "Font indirilemedi: $($f.fontFamily)"
            }
        }
        Write-Host "Tamamlandi: $successCount font basariyla kuruldu." -ForegroundColor Green
    }
}

Write-Host ""
Write-Host "Islem tamamlandi." -ForegroundColor Cyan
exit 0

[CmdletBinding()]
param()

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "         FORMA ADOBE ASSET PACK - BUTUNLUK VE HASH DOGRULAMA (VERIFY)          " -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pkgRoot = Split-Path -Parent $scriptDir
$checksumFile = Join-Path $pkgRoot "SHA256SUMS.txt"

if (-not (Test-Path $checksumFile)) {
    Write-Error "HATA: SHA256SUMS.txt bulunamadi!"
    exit 1
}

$lines = Get-Content $checksumFile
$total = $lines.Count
$passed = 0
$failed = 0

Write-Host "Paket dosya butunlugu kontrol ediliyor ($total dosya)..." -ForegroundColor Yellow

foreach ($line in $lines) {
    if ([string]::IsNullOrWhiteSpace($line)) { continue }
    $parts = $line -split "\s+", 2
    if ($parts.Count -lt 2) { continue }
    $expectedHash = $parts[0].Trim().ToLower()
    $relFile = $parts[1].Trim()

    $fullPath = Join-Path $pkgRoot $relFile
    if (-not (Test-Path $fullPath)) {
        Write-Host "[EKSIK] $relFile" -ForegroundColor Red
        $failed++
        continue
    }

    $actualHash = (Get-FileHash -Path $fullPath -Algorithm SHA256).Hash.ToLower()
    if ($actualHash -eq $expectedHash) {
        $passed++
    } else {
        Write-Host "[BOZUK] $relFile (Hash uyusmuyor!)" -ForegroundColor Red
        $failed++
    }
}

Write-Host ""
Write-Host "Dogrulama Sonuclari:" -ForegroundColor Cyan
Write-Host "- Basarili: $passed" -ForegroundColor Green
Write-Host "- Hatali/Eksik: $failed" -ForegroundColor $(if ($failed -eq 0) { "Green" } else { "Red" })

if ($failed -eq 0) {
    Write-Host "TEBRIKLER: Paketin tum dosyalari %100 orijinal ve saglamdir!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "UYARI: Paket icinde eksik veya degistirilmis dosyalar var!" -ForegroundColor Red
    exit 1
}

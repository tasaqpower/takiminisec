[CmdletBinding()]
param(
    [switch]$Force
)

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "             FORMA ADOBE ASSET PACK - GUVELI KALDIRMA SISTEMI                 " -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$pkgRoot = Split-Path -Parent $scriptDir
$historyPath = Join-Path $pkgRoot "installed-history.json"

if (-not (Test-Path $historyPath)) {
    Write-Host "Bu bilgisayarda FORMA kurulum kaydi (installed-history.json) bulunamadi." -ForegroundColor Yellow
    exit 0
}

$history = Get-Content $historyPath -Raw | ConvertFrom-Json
Write-Host "Kaldirilacak FORMA dosya sayisi: $($history.Count)" -ForegroundColor White

if (-not $Force) {
    $confirm = Read-Host "YALNIZCA FORMA tarafindan kurulan dosyalari kaldirmak istiyor musunuz? (E/H)"
    if ($confirm -ne "E" -and $confirm -ne "e") {
        Write-Host "Kaldirma islemi iptal edildi." -ForegroundColor Gray
        exit 0
    }
}

$removedCount = 0
foreach ($entry in $history) {
    if (Test-Path $entry.InstalledPath) {
        if ($entry.InstalledPath -like "*FORMA*" -and ($entry.InstalledPath.StartsWith($env:USERPROFILE) -or $entry.InstalledPath.StartsWith($env:APPDATA))) {
            Remove-Item -Path $entry.InstalledPath -Force -ErrorAction SilentlyContinue
            $removedCount++
        }
    }
}

Remove-Item -Path $historyPath -Force -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "KALDIRMA TAMAMLANDI!" -ForegroundColor Green
Write-Host "- Silinen FORMA dosya sayisi: $removedCount" -ForegroundColor Green
Write-Host "- Kullaniciya ait diger Adobe dosyalari kesinlikle korunmustur." -ForegroundColor White
exit 0

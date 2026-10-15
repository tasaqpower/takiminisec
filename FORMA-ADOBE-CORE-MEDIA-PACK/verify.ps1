# ==============================================================================
# FORMA ADOBE CORE MEDIA PACK - BUTUNLUK DOGRULAMA (VERIFY) SCRIPTI
# ==============================================================================
# Desteklenen Kapsamlar:
#   -Scope Assets  : Yalnizca 699 Medya Varligini (LUT, Audio, SVG, Video) dogrular
#   -Scope Package : Paketteki tum dosyalari (medya, lisanslar, raporlar, scriptler) dogrular
#   (Varsayilan / Parametresiz) : Hem Assets hem Package butunlugunu dogrular
# ==============================================================================

[CmdletBinding()]
param(
    [ValidateSet("All", "Assets", "Package")]
    [string]$Scope = "All"
)

$ErrorActionPreference = "Stop"
$scriptDir = $PSScriptRoot

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " FORMA CORE MEDIA PACK - SHA-256 BUTUNLUK DOGRULAMA" -ForegroundColor Cyan
Write-Host " Calisma Dizini: $scriptDir" -ForegroundColor Gray
Write-Host " Kapsam        : $Scope" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

function Test-ChecksumFile {
    param(
        [string]$ChecksumFileName,
        [string]$Description
    )

    $fullChecksumPath = Join-Path $scriptDir $ChecksumFileName
    if (-not (Test-Path $fullChecksumPath)) {
        Write-Host "`n[HATA] $ChecksumFileName dosyasi bulunamadi!" -ForegroundColor Red
        return @{ Success = $false; Total = 0; Valid = 0; Failed = 0; Missing = 0 }
    }

    Write-Host "`n--> [$Description] Dogrulaniyor ($ChecksumFileName)..." -ForegroundColor Yellow
    $lines = Get-Content -Path $fullChecksumPath
    $validCount = 0
    $failedCount = 0
    $missingCount = 0
    $totalCount = 0

    foreach ($line in $lines) {
        $trimmed = $line.Trim()
        if ([string]::IsNullOrWhiteSpace($trimmed) -or $trimmed.StartsWith("#")) { continue }

        $parts = -split $trimmed
        if ($parts.Count -lt 2) { continue }

        $expectedHash = $parts[0].ToLower()
        $relPath = ($parts[1..($parts.Count - 1)] -join " ").Replace("\", "/")
        $targetFile = Join-Path $scriptDir $relPath

        $totalCount++

        if (-not (Test-Path $targetFile)) {
            Write-Host "  [EKSIK DOSYA] $relPath" -ForegroundColor Red
            $missingCount++
            $failedCount++
            continue
        }

        $actualHash = (Get-FileHash -Path $targetFile -Algorithm SHA256).Hash.ToLower()
        if ($actualHash -eq $expectedHash) {
            $validCount++
        } else {
            Write-Host "  [BOZUK HASH] $relPath" -ForegroundColor Red
            Write-Host "    Beklenen: $expectedHash" -ForegroundColor DarkRed
            Write-Host "    Gercek  : $actualHash" -ForegroundColor DarkRed
            $failedCount++
        }
    }

    $isSuccess = ($failedCount -eq 0 -and $totalCount -gt 0)
    if ($isSuccess) {
        Write-Host "  [BASARILI] $validCount / $totalCount dosya kusursuz dogrulandi." -ForegroundColor Green
    } else {
        Write-Host "  [BASARISIZ] $failedCount dosya hatali (Eksik: $missingCount, Bozuk: $($failedCount - $missingCount))" -ForegroundColor Red
    }

    return @{
        Success = $isSuccess
        Total = $totalCount
        Valid = $validCount
        Failed = $failedCount
        Missing = $missingCount
    }
}

$overallSuccess = $true

if ($Scope -eq "Assets" -or $Scope -eq "All") {
    $resAssets = Test-ChecksumFile -ChecksumFileName "ASSET_SHA256SUMS.txt" -Description "699 Medya Varligi"
    if (-not $resAssets.Success) { $overallSuccess = $false }
}

if ($Scope -eq "Package" -or $Scope -eq "All") {
    $resPkg = Test-ChecksumFile -ChecksumFileName "PACKAGE_SHA256SUMS.txt" -Description "Paket Dagitim Dosyalari"
    if (-not $resPkg.Success) { $overallSuccess = $false }
}

Write-Host "`n----------------------------------------------------------" -ForegroundColor Cyan
if ($overallSuccess) {
    Write-Host "GENEL SONUC: %100 BUTUNLUK DOGRULANDI (0 Hata)" -ForegroundColor Green
    exit 0
} else {
    Write-Host "GENEL SONUC: BUTUNLUK TESTI BASARISIZ OLDU!" -ForegroundColor Red
    exit 1
}

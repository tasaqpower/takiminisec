# Forensic audit of host Adobe folders for any file creation or modification
$adobeLocations = @(
    "$env:APPDATA\Adobe",
    "$env:LOCALAPPDATA\Adobe",
    "C:\Users\sinan\Documents\Adobe",
    "C:\Users\sinan\OneDrive\Belgeler\Adobe",
    "$env:ProgramFiles\Common Files\Adobe",
    "$env:ProgramFiles(x86)\Common Files\Adobe",
    "$env:TEMP\Adobe"
)

Write-Host "Scanning host Adobe locations..."

$allFiles = @()
$today = (Get-Date).Date

foreach ($loc in $adobeLocations) {
    if (Test-Path $loc) {
        Write-Host "Scanning: $loc"
        Get-ChildItem -Path $loc -Recurse -File -ErrorAction SilentlyContinue | ForEach-Object {
            $isToday = $_.LastWriteTime -ge $today -or $_.CreationTime -ge $today
            if ($isToday) {
                $hash = (Get-FileHash -Path $_.FullName -Algorithm SHA256).Hash.ToLower()
                $allFiles += [PSCustomObject]@{
                    FullPath = $_.FullName
                    MaskedPath = ($_.FullName -replace "C:\\Users\\sinan", "C:\Users\<USER>")
                    Size = $_.Length
                    SHA256 = $hash
                    CreationTime = $_.CreationTime.ToString("o")
                    LastWriteTime = $_.LastWriteTime.ToString("o")
                    IsFormaAsset = ($_.FullName -like "*FORMA*" -or $_.FullName -like "*forma*")
                }
            }
        }
    }
}

Write-Host "Total files modified or created today in host Adobe locations: $($allFiles.Count)"

$formaWrites = $allFiles | Where-Object { $_.IsFormaAsset }
$internalAdobeWrites = $allFiles | Where-Object { -not $_.IsFormaAsset }

Write-Host "FORMA asset files written to host Adobe folders: $($formaWrites.Count)"
Write-Host "Adobe internal log/telemetry/cache files touched today: $($internalAdobeWrites.Count)"

$diffReport = [PSCustomObject]@{
    timestamp = (Get-Date).ToString("o")
    scannedLocations = $adobeLocations
    formaAssetWritesToHost = @{
        count = $formaWrites.Count
        status = if ($formaWrites.Count -eq 0) { "CLEAN_ZERO_FORMA_WRITES" } else { "FORMA_FILES_DETECTED" }
        files = $formaWrites
    }
    internalAdobeActivityDetected = @{
        count = $internalAdobeWrites.Count
        explanation = "Adobe After Effects başlatıldığında Windows tarafından güncellenen dahili loglar, Plugin Loading.log, Trace Database veya CC telemetry dosyaları."
        files = $internalAdobeWrites
    }
}

$jsonPath = Join-Path (Get-Location) "host_adobe_write_diff.json"
$diffReport | ConvertTo-Json -Depth 5 | Set-Content -Path $jsonPath -Encoding utf8
Write-Host "Saved host_adobe_write_diff.json"

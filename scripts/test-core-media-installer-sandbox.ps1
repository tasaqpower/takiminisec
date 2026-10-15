# ==============================================================================
# FORMA ADOBE CORE MEDIA PACK - SANDBOX TEST SUITE
# ==============================================================================

$ErrorActionPreference = "Stop"
$scriptRoot = $PSScriptRoot
$repoRoot = Split-Path $scriptRoot -Parent
$packDir = Join-Path $repoRoot "FORMA-ADOBE-CORE-MEDIA-PACK"

$sandboxRoot = Join-Path $env:TEMP ("forma_sbx_" + [System.Guid]::NewGuid().ToString("N").Substring(0, 8))
if (Test-Path $sandboxRoot) { Remove-Item -Path $sandboxRoot -Recurse -Force }
New-Item -ItemType Directory -Path $sandboxRoot -Force | Out-Null

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host " FORMA ADOBE CORE MEDIA PACK - SANDBOX TEST SUITE" -ForegroundColor Cyan
Write-Host " Sandbox Root: $sandboxRoot" -ForegroundColor Gray
Write-Host " Pack Dir    : $packDir" -ForegroundColor Gray
Write-Host "==========================================================" -ForegroundColor Cyan

$results = [ordered]@{
    Timestamp = (Get-Date).ToString("o")
    SandboxDirectory = $sandboxRoot
    PackDirectory = $packDir
    Scenarios = @()
    OverallSuccess = $false
}

try {
    # --------------------------------------------------------------------------
    # SCENARIO 1: FRESH INSTALLATION
    # --------------------------------------------------------------------------
    Write-Host "`n>>> [SCENARIO 1] Fresh Installation Testing..." -ForegroundColor Yellow
    $lutTarget1 = Join-Path $sandboxRoot "AppData_LUTs\Creative\FORMA"
    $mediaTarget1 = Join-Path $sandboxRoot "User_Docs\Adobe\FORMA Media Library"

    $s1Out = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $packDir "install.ps1") -LutTargetDir $lutTarget1 -MediaTargetDir $mediaTarget1 2>&1

    $lutCount1 = (Get-ChildItem -Path $lutTarget1 -Filter "*.cube" -File -ErrorAction SilentlyContinue).Count
    $wavCount1 = (Get-ChildItem -Path (Join-Path $mediaTarget1 "Audio") -Filter "*.wav" -Recurse -File -ErrorAction SilentlyContinue).Count
    $svgCount1 = (Get-ChildItem -Path (Join-Path $mediaTarget1 "SVG") -Filter "*.svg" -Recurse -File -ErrorAction SilentlyContinue).Count
    $mp4Count1 = (Get-ChildItem -Path (Join-Path $mediaTarget1 "Video") -Filter "*.mp4" -Recurse -File -ErrorAction SilentlyContinue).Count
    $manifestPath1 = Join-Path $mediaTarget1 "install-manifest.json"
    $hasManifest1 = Test-Path $manifestPath1

    $s1Success = ($lutCount1 -eq 185 -and $wavCount1 -eq 168 -and $svgCount1 -eq 337 -and $mp4Count1 -eq 9 -and $hasManifest1)

    $results.Scenarios += [ordered]@{
        Scenario = "Scenario 1: Fresh Installation"
        Description = "Install 699 assets to isolated sandbox destinations"
        Passed = $s1Success
        Details = @{
            LUTsInstalled = $lutCount1
            ExpectedLUTs = 185
            WAVsInstalled = $wavCount1
            ExpectedWAVs = 168
            SVGsInstalled = $svgCount1
            ExpectedSVGs = 337
            MP4sInstalled = $mp4Count1
            ExpectedMP4s = 9
            TotalMedia = ($lutCount1 + $wavCount1 + $svgCount1 + $mp4Count1)
            ManifestCreated = $hasManifest1
        }
    }
    Write-Host "  -> Scenario 1 Result: $(if ($s1Success) { 'PASSED (699/699 Installed)' } else { 'FAILED' })" -ForegroundColor $(if ($s1Success) { 'Green' } else { 'Red' })

    # --------------------------------------------------------------------------
    # SCENARIO 2: IDEMPOTENCY (SECOND RUN)
    # --------------------------------------------------------------------------
    Write-Host "`n>>> [SCENARIO 2] Idempotency Testing..." -ForegroundColor Yellow
    $s2Out = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $packDir "install.ps1") -LutTargetDir $lutTarget1 -MediaTargetDir $mediaTarget1 2>&1

    $manifestContent2 = Get-Content -Path $manifestPath1 -Raw | ConvertFrom-Json
    $newlyInstalled2 = $manifestContent2.NewlyInstalled
    $skippedIdentical2 = $manifestContent2.SkippedIdentical

    $s2Success = ($newlyInstalled2 -eq 0 -and $skippedIdentical2 -eq 699)

    $results.Scenarios += [ordered]@{
        Scenario = "Scenario 2: Idempotency (Second Run)"
        Description = "Re-running installer skips all 699 files with zero redundant writes"
        Passed = $s2Success
        Details = @{
            NewlyInstalled = $newlyInstalled2
            SkippedIdentical = $skippedIdentical2
            PreservedUserFiles = $manifestContent2.PreservedUserFiles
        }
    }
    Write-Host "  -> Scenario 2 Result: $(if ($s2Success) { 'PASSED (699 Skipped, 0 Overwrites)' } else { 'FAILED' })" -ForegroundColor $(if ($s2Success) { 'Green' } else { 'Red' })

    # --------------------------------------------------------------------------
    # SCENARIO 3: CONFLICT PRESERVATION
    # --------------------------------------------------------------------------
    Write-Host "`n>>> [SCENARIO 3] Conflict Preservation Testing..." -ForegroundColor Yellow
    # Hedefteki gercek bir varligi (artistic-001.cube) kullanici degistirmis gibi modifiye et
    $testConflictFile = Join-Path $lutTarget1 "artistic-001.cube"
    $customUserText = "# USER CUSTOM LUT DATA - DO NOT OVERWRITE #"
    Set-Content -Path $testConflictFile -Value $customUserText

    $s3Out = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $packDir "install.ps1") -LutTargetDir $lutTarget1 -MediaTargetDir $mediaTarget1 2>&1

    $fileAfterInstall = Get-Content -Path $testConflictFile -Raw
    $filePreserved = ($fileAfterInstall.Trim() -eq $customUserText)

    $manifestContent3 = Get-Content -Path $manifestPath1 -Raw | ConvertFrom-Json
    $preservedCount3 = $manifestContent3.PreservedUserFiles

    $s3Success = ($filePreserved -and $preservedCount3 -ge 1)

    $results.Scenarios += [ordered]@{
        Scenario = "Scenario 3: Conflict Preservation"
        Description = "Pre-existing file with different hash is preserved and never overwritten"
        Passed = $s3Success
        Details = @{
            UserFilePreserved = $filePreserved
            ReportedPreservedCount = $preservedCount3
        }
    }
    Write-Host "  -> Scenario 3 Result: $(if ($s3Success) { 'PASSED (User file preserved)' } else { 'FAILED' })" -ForegroundColor $(if ($s3Success) { 'Green' } else { 'Red' })

    # --------------------------------------------------------------------------
    # SCENARIO 4: SAFE UNINSTALLATION
    # --------------------------------------------------------------------------
    Write-Host "`n>>> [SCENARIO 4] Safe Uninstallation Testing..." -ForegroundColor Yellow
    $s4Out = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $packDir "uninstall.ps1") -LutTargetDir $lutTarget1 -MediaTargetDir $mediaTarget1 2>&1

    $remLutCount = (Get-ChildItem -Path $lutTarget1 -Filter "*.cube" -File -ErrorAction SilentlyContinue).Count
    $remWavCount = (Get-ChildItem -Path (Join-Path $mediaTarget1 "Audio") -Filter "*.wav" -Recurse -File -ErrorAction SilentlyContinue).Count
    $userFileStillExists = Test-Path $testConflictFile

    $s4Success = ($remLutCount -eq 1 -and $userFileStillExists -and $remWavCount -eq 0 -and (-not (Test-Path $manifestPath1)))

    $results.Scenarios += [ordered]@{
        Scenario = "Scenario 4: Safe Uninstallation"
        Description = "Uninstall removes matched FORMA files and preserves modified user files"
        Passed = $s4Success
        Details = @{
            RemainingLUTs = $remLutCount
            UserModifiedFilePreserved = $userFileStillExists
            RemainingAudio = $remWavCount
            ManifestRemoved = (-not (Test-Path $manifestPath1))
        }
    }
    Write-Host "  -> Scenario 4 Result: $(if ($s4Success) { 'PASSED (Clean uninstall, user file kept)' } else { 'FAILED' })" -ForegroundColor $(if ($s4Success) { 'Green' } else { 'Red' })

    # --------------------------------------------------------------------------
    # SCENARIO 5: CORRUPT ASSET PRE-FLIGHT HALT
    # --------------------------------------------------------------------------
    Write-Host "`n>>> [SCENARIO 5] Corrupt Asset Pre-Flight Halt Testing..." -ForegroundColor Yellow
    $corruptPackDir = Join-Path $sandboxRoot "corrupt_pack_test"
    Copy-Item -Path $packDir -Destination $corruptPackDir -Recurse

    $fileToCorrupt = Join-Path $corruptPackDir "LUTs\artistic-001.cube"
    Add-Content -Path $fileToCorrupt -Value "`n# CORRUPTION INJECTED #"

    $lutTarget5 = Join-Path $sandboxRoot "Target5_LUTs"
    $mediaTarget5 = Join-Path $sandboxRoot "Target5_Media"

    $s5FailedAsExpected = $false
    try {
        $s5Out = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $corruptPackDir "install.ps1") -LutTargetDir $lutTarget5 -MediaTargetDir $mediaTarget5 2>&1
        if ($LASTEXITCODE -ne 0) {
            $s5FailedAsExpected = $true
        }
    } catch {
        $s5FailedAsExpected = $true
    }

    $installedInT5 = (Get-ChildItem -Path $lutTarget5 -Recurse -File -ErrorAction SilentlyContinue).Count
    $s5Success = ($s5FailedAsExpected -and $installedInT5 -eq 0)

    $results.Scenarios += [ordered]@{
        Scenario = "Scenario 5: Corrupt Asset Pre-Flight Halt"
        Description = "Pre-flight integrity failure halts execution and installs 0 files"
        Passed = $s5Success
        Details = @{
            InstallationHalted = $s5FailedAsExpected
            ZeroFilesInstalled = ($installedInT5 -eq 0)
        }
    }
    Write-Host "  -> Scenario 5 Result: $(if ($s5Success) { 'PASSED (Halted on hash mismatch, 0 files installed)' } else { 'FAILED' })" -ForegroundColor $(if ($s5Success) { 'Green' } else { 'Red' })

    $allPassed = ($results.Scenarios | Where-Object { -not $_.Passed }).Count -eq 0
    $results.OverallSuccess = $allPassed

} finally {
    Remove-Item -Path $sandboxRoot -Recurse -Force -ErrorAction SilentlyContinue
}

$reportPath = Join-Path $repoRoot "installer_sandbox_test_report.json"
$results | ConvertTo-Json -Depth 5 | Set-Content -Path $reportPath -Encoding utf8
Write-Host "`nTest report saved: $reportPath" -ForegroundColor Cyan

$packReportsDir = Join-Path $packDir "Reports"
if (Test-Path $packReportsDir) {
    $results | ConvertTo-Json -Depth 5 | Set-Content -Path (Join-Path $packReportsDir "installer_sandbox_test_report.json") -Encoding utf8
}

Write-Host "==========================================================" -ForegroundColor Cyan
if ($results.OverallSuccess) {
    Write-Host " ALL 5 SANDBOX SCENARIOS PASSED! (100% VERIFIED)" -ForegroundColor Green
    exit 0
} else {
    Write-Host " SOME SANDBOX SCENARIOS FAILED!" -ForegroundColor Red
    exit 1
}

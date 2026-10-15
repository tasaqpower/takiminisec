# Test script: Isolated APPDATA profile execution of After Effects
$testDir = Join-Path $env:TEMP "ae_isolated_profile_test"
if (Test-Path $testDir) { Remove-Item -Path $testDir -Recurse -Force }
New-Item -ItemType Directory -Path $testDir | Out-Null

$tempAppData = Join-Path $testDir "AppData_Roaming"
$tempAePrefDir = Join-Path $tempAppData "Adobe\After Effects\26.3"
New-Item -ItemType Directory -Path $tempAePrefDir -Force | Out-Null

$srcPref = Join-Path $env:APPDATA "Adobe\After Effects\26.3\Adobe After Effects 26.3 Prefs.txt"
$dstPref = Join-Path $tempAePrefDir "Adobe After Effects 26.3 Prefs.txt"

if (Test-Path $srcPref) {
    $prefContent = Get-Content -Path $srcPref -Raw
    # Disable Welcome Screen
    $prefContent = $prefContent -replace '"Show Welcome Screen" = 01', '"Show Welcome Screen" = 00'
    # Enable Scripting File and Network Security
    $prefContent = $prefContent -replace '"Pref_SCRIPTING_FILE_NETWORK_SECURITY" = "0"', '"Pref_SCRIPTING_FILE_NETWORK_SECURITY" = "1"'
    Set-Content -Path $dstPref -Value $prefContent -Encoding utf8
    Write-Host "Isolated preferences created: Welcome Screen=00, Scripting Security=1"
}

# Also create sentinel output paths
$sentinelStart = Join-Path $testDir "start.sentinel"
$sentinelEnd = Join-Path $testDir "done.sentinel"
$testAep = Join-Path $testDir "isolated_test.aep"

$sentinelStartJs = ($sentinelStart -replace '\\', '/')
$sentinelEndJs = ($sentinelEnd -replace '\\', '/')
$testAepJs = ($testAep -replace '\\', '/')

$jsxCode = @"
(function() {
    try {
        var f1 = new File("$sentinelStartJs");
        f1.open("w");
        f1.writeln("STARTED");
        f1.close();
        
        var comp = app.project.items.addComp("IsolatedComp", 1280, 720, 1.0, 3.0, 30.0);
        var layer = comp.layers.addText("FORMA Sentinel Test: çÇ ğĞ ıİ öÖ şŞ üÜ");
        
        var aepFile = new File("$testAepJs");
        app.project.save(aepFile);
        
        var f2 = new File("$sentinelEndJs");
        f2.open("w");
        f2.writeln("DONE|COMP=" + comp.name + "|LAYERS=" + comp.numLayers);
        f2.close();
    } catch(err) {
        var errFile = new File("$testDir/error.txt");
        errFile.open("w");
        errFile.writeln(err.toString());
        errFile.close();
    } finally {
        app.quit();
    }
})();
"@

$jsxPath = Join-Path $testDir "test_runner.jsx"
Set-Content -Path $jsxPath -Value $jsxCode -Encoding utf8

$aeCom = "C:\Program Files\Adobe\Adobe After Effects 2026\Support Files\AfterFX.com"
$aeExe = "C:\Program Files\Adobe\Adobe After Effects 2026\Support Files\AfterFX.exe"

$targetBinary = if (Test-Path $aeCom) { $aeCom } else { $aeExe }
Write-Host "Target executable: $targetBinary"

# Execute with isolated APPDATA
$pinfo = New-Object System.Diagnostics.ProcessStartInfo
$pinfo.FileName = $targetBinary
$pinfo.Arguments = "-r `"$jsxPath`""
$pinfo.EnvironmentVariables["APPDATA"] = $tempAppData
$pinfo.UseShellExecute = $false
$pinfo.RedirectStandardOutput = $true
$pinfo.RedirectStandardError = $true

$proc = [System.Diagnostics.Process]::Start($pinfo)
Write-Host "Process started with PID: $($proc.Id)"

$sw = [System.Diagnostics.Stopwatch]::StartNew()
while (-not $proc.HasExited -and $sw.ElapsedMilliseconds -lt 60000) {
    if (Test-Path $sentinelEnd) {
        Write-Host "Sentinel DONE detected at $($sw.ElapsedMilliseconds) ms!"
        break
    }
    Start-Sleep -Seconds 1
}

Start-Sleep -Seconds 2

if (Test-Path $sentinelStart) {
    Write-Host "Sentinel START verified: $(Get-Content $sentinelStart)"
}
if (Test-Path $sentinelEnd) {
    Write-Host "Sentinel END verified: $(Get-Content $sentinelEnd)"
}
if (Test-Path $testAep) {
    Write-Host "AEP generated: $((Get-Item $testAep).Length) bytes"
}

if (-not $proc.HasExited) {
    Write-Host "Terminating process after timeout..."
    Stop-Process -Id $proc.Id -Force
}

# Clean any remaining AfterFX processes
Get-Process -Name "*AfterFX*" -ErrorAction SilentlyContinue | Stop-Process -Force

# Test aerender if AEP exists!
if (Test-Path $testAep) {
    $aerenderExe = "C:\Program Files\Adobe\Adobe After Effects 2026\Support Files\aerender.exe"
    $outPng = Join-Path $testDir "render_frame_[####].png"
    Write-Host "Testing aerender on created AEP..."
    & $aerenderExe -project $testAep -comp "IsolatedComp" -output $outPng -s 1 -e 2 -v ERRORS_AND_PROGRESS
    
    $pngFiles = Get-ChildItem -Path $testDir -Filter "*.png"
    if ($pngFiles) {
        Write-Host "Rendered frames successfully:"
        $pngFiles | ForEach-Object { Write-Host " - $($_.Name): $($_.Length) bytes" }
    } else {
        Write-Host "aerender did not output PNGs"
    }
}

Remove-Item -Path $testDir -Recurse -Force
Write-Host "Isolated test completed and cleaned up."

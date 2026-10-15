$testDir = Join-Path $env:TEMP "ae_clean_test"
if (Test-Path $testDir) { Remove-Item -Path $testDir -Recurse -Force }
New-Item -ItemType Directory -Path $testDir | Out-Null

$testAep = Join-Path $testDir "result.aep"
$testAepJs = ($testAep -replace '\\', '/')

$jsxCode = @"
(function() {
    try {
        var comp = app.project.items.addComp("TestComp", 1280, 720, 1.0, 3.0, 30.0);
        var textLayer = comp.layers.addText("FORMA Acceptance Test");
        var aepFile = new File("$testAepJs");
        app.project.save(aepFile);
    } catch(e) {
    } finally {
        app.quit();
    }
})();
"@

$jsxPath = Join-Path $testDir "create_proj.jsx"
Set-Content -Path $jsxPath -Value $jsxCode -Encoding utf8

$aeExe = "C:\Program Files\Adobe\Adobe After Effects 2026\Support Files\AfterFX.exe"
Write-Host "Running AfterFX with -r $jsxPath (allowing up to 90 seconds for cold start)..."
$proc = Start-Process -FilePath $aeExe -ArgumentList @("-r", $jsxPath) -PassThru

$sw = [System.Diagnostics.Stopwatch]::StartNew()
while (-not $proc.HasExited -and $sw.ElapsedMilliseconds -lt 90000) {
    if (Test-Path $testAep) {
        Write-Host "SUCCESS! AEP created at $($sw.ElapsedMilliseconds) ms!"
        break
    }
    Start-Sleep -Seconds 2
}

Start-Sleep -Seconds 3

if (Test-Path $testAep) {
    Write-Host "Verified AEP: $((Get-Item $testAep).Length) bytes"
} else {
    Write-Host "AEP was not created after $($sw.ElapsedMilliseconds) ms."
}

if (-not $proc.HasExited) {
    Write-Host "Terminating process..."
    Stop-Process -Id $proc.Id -Force
}

Remove-Item -Path $testDir -Recurse -Force
Write-Host "Test completed."

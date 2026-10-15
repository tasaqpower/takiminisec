$testDir = Join-Path $env:TEMP "adobe_sandbox_probe"
if (Test-Path $testDir) { Remove-Item -Path $testDir -Recurse -Force }
New-Item -ItemType Directory -Path $testDir | Out-Null

$probeJsx = Join-Path $testDir "probe.jsx"
$outputTxt = Join-Path $testDir "probe_out.txt"
$outputTxtJs = ($outputTxt -replace '\\', '/')

$jsxCode = @"
var f = new File("$outputTxtJs");
f.open("w");
f.write("AE_SUCCESS|Version=" + app.version + "|Build=" + app.buildNumber + "|IsInstalled=true");
f.close();
app.quit();
"@

Set-Content -Path $probeJsx -Value $jsxCode -Encoding utf8

$aeExe = "C:\Program Files\Adobe\Adobe After Effects 2026\Support Files\AfterFX.exe"
Write-Host "Launching AfterFX with -r..."
$proc = Start-Process -FilePath $aeExe -ArgumentList "-r", "`"$probeJsx`"" -PassThru

$sw = [System.Diagnostics.Stopwatch]::StartNew()
while (-not $proc.HasExited -and $sw.ElapsedMilliseconds -lt 60000) {
    if (Test-Path $outputTxt) {
        Write-Host "Output file detected at $($sw.ElapsedMilliseconds) ms!"
        break
    }
    Start-Sleep -Seconds 1
}

Start-Sleep -Seconds 2

if (Test-Path $outputTxt) {
    Write-Host "Output file content:"
    Get-Content $outputTxt
} else {
    Write-Host "Output file not found after $($sw.ElapsedMilliseconds) ms."
}

if (-not $proc.HasExited) {
    Write-Host "Terminating process..."
    Stop-Process -Id $proc.Id -Force
}

Remove-Item -Path $testDir -Recurse -Force
Write-Host "Probe completed."

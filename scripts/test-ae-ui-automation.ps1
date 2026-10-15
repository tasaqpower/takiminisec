# Test After Effects with UI automation (detecting window, dismissing Home screen via Esc)
Add-Type -AssemblyName System.Windows.Forms

$testDir = Join-Path $env:TEMP "ae_ui_auto_test"
if (Test-Path $testDir) { Remove-Item -Path $testDir -Recurse -Force }
New-Item -ItemType Directory -Path $testDir | Out-Null

$sentinelStart = Join-Path $testDir "start.sentinel"
$sentinelEnd = Join-Path $testDir "done.sentinel"
$testAep = Join-Path $testDir "ui_test.aep"

$sentinelStartJs = ($sentinelStart -replace '\\', '/')
$sentinelEndJs = ($sentinelEnd -replace '\\', '/')
$testAepJs = ($testAep -replace '\\', '/')

$jsxCode = @"
(function() {
    try {
        var comp = app.project.items.addComp("UIComp", 1280, 720, 1.0, 2.0, 30.0);
        var layer = comp.layers.addText("FORMA UI Automation Test");
        var aepFile = new File("$testAepJs");
        app.project.save(aepFile);
    } catch(err) {
    } finally {
        app.quit();
    }
})();
"@

$jsxPath = Join-Path $testDir "ui_test.jsx"
Set-Content -Path $jsxPath -Value $jsxCode -Encoding utf8

$aeExe = "C:\Program Files\Adobe\Adobe After Effects 2026\Support Files\AfterFX.exe"

Write-Host "Launching AfterFX.exe -r $jsxPath..."
$proc = Start-Process -FilePath $aeExe -ArgumentList "-r", "`"$jsxPath`"" -PassThru

# Monitor process and windows
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class User32 {
    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);
    [DllImport("user32.dll")]
    public static extern IntPtr GetForegroundWindow();
}
"@

$sw = [System.Diagnostics.Stopwatch]::StartNew()
$dismissed = $false

while (-not $proc.HasExited -and $sw.ElapsedMilliseconds -lt 60000) {
    if (Test-Path $testAep) {
        Write-Host "SUCCESS! AEP generated at $($sw.ElapsedMilliseconds) ms!"
        break
    }
    
    # Check if window appeared
    $aeProc = Get-Process -Id $proc.Id -ErrorAction SilentlyContinue
    if ($aeProc -and $aeProc.MainWindowHandle -ne 0 -and -not $dismissed) {
        Write-Host "AfterFX window detected! Title: '$($aeProc.MainWindowTitle)', Handle: $($aeProc.MainWindowHandle)"
        # Try bringing to foreground and sending ESC
        [User32]::SetForegroundWindow($aeProc.MainWindowHandle)
        Start-Sleep -Milliseconds 500
        [System.Windows.Forms.SendKeys]::SendWait("{ESC}")
        Write-Host "Sent ESC key to dismiss Home screen."
        $dismissed = $true
    }
    
    Start-Sleep -Seconds 2
}

Start-Sleep -Seconds 2

if (Test-Path $testAep) {
    Write-Host "AEP verified: $((Get-Item $testAep).Length) bytes"
} else {
    Write-Host "AEP was not generated after $($sw.ElapsedMilliseconds) ms."
}

if (-not $proc.HasExited) {
    Write-Host "Terminating process..."
    Stop-Process -Id $proc.Id -Force
}

Get-Process -Name "*AfterFX*" -ErrorAction SilentlyContinue | Stop-Process -Force
Remove-Item -Path $testDir -Recurse -Force
Write-Host "UI Automation test finished."

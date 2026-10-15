# Test script to run After Effects headless execution safely
$testDir = Join-Path $env:TEMP "ae_isolated_test"
if (Test-Path $testDir) { Remove-Item -Path $testDir -Recurse -Force }
New-Item -ItemType Directory -Path $testDir | Out-Null

$testAep = Join-Path $testDir "generated_test.aep"
$testAepJs = ($testAep -replace '\\', '/')
$testLog = Join-Path $testDir "execution_log.txt"
$testLogJs = ($testLog -replace '\\', '/')

$jsxCode = @"
(function() {
    try {
        var comp = app.project.items.addComp("TestComp", 1920, 1080, 1.0, 5.0, 30.0);
        var textLayer = comp.layers.addText("FORMA Türkçe Test: ÇÖĞİŞÜ çöğişü");
        
        var anim = textLayer.text.animators.addProperty("ADBE Text Animator");
        anim.name = "FORMA Fade In";
        var props = anim.property("ADBE Text Animator Properties");
        var opacity = props.addProperty("ADBE Text Opacity");
        opacity.setValue(0);
        
        var selector = anim.property("ADBE Text Selectors").addProperty("ADBE Text Selector");
        var startProp = selector.property("ADBE Text Percent Start");
        startProp.setValueAtTime(0, 0);
        startProp.setValueAtTime(1.0, 100);
        
        var aepFile = new File("$testAepJs");
        app.project.save(aepFile);
        
        app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
    } catch(e) {
        // error handling
    } finally {
        app.quit();
    }
})();
"@

$jsxPath = Join-Path $testDir "test_script.jsx"
Set-Content -Path $jsxPath -Value $jsxCode -Encoding utf8

$aeExe = "C:\Program Files\Adobe\Adobe After Effects 2026\Support Files\AfterFX.exe"
Write-Host "Starting AfterFX.exe -r..."
$proc = Start-Process -FilePath $aeExe -ArgumentList "-r", "`"$jsxPath`"" -PassThru

# Monitor up to 35 seconds
$sw = [System.Diagnostics.Stopwatch]::StartNew()
while (-not $proc.HasExited -and $sw.ElapsedMilliseconds -lt 35000) {
    if (Test-Path $testAep) {
        Write-Host "AEP generated successfully at $($sw.ElapsedMilliseconds) ms!"
        break
    }
    Start-Sleep -Seconds 1
}

Start-Sleep -Seconds 3

if (Test-Path $testAep) {
    Write-Host "Success! AEP size: $((Get-Item $testAep).Length) bytes"
} else {
    Write-Host "AEP file was not generated."
}

if (-not $proc.HasExited) {
    Write-Host "Stopping process..."
    Stop-Process -Id $proc.Id -Force
}

# Now test aerender if AEP exists
if (Test-Path $testAep) {
    $outPng = Join-Path $testDir "render_frame_[####].png"
    $aerenderExe = "C:\Program Files\Adobe\Adobe After Effects 2026\Support Files\aerender.exe"
    Write-Host "Rendering frame with aerender..."
    & $aerenderExe -project $testAep -comp "TestComp" -output $outPng -s 1 -e 1 -v ERRORS_AND_PROGRESS
    
    $renderedPng = Get-ChildItem -Path $testDir -Filter "*.png"
    if ($renderedPng) {
        Write-Host "Rendered PNG successfully: $($renderedPng.FullName) (Size: $($renderedPng.Length) bytes)"
    } else {
        Write-Host "aerender failed to create PNG"
    }
}

Remove-Item -Path $testDir -Recurse -Force
Write-Host "Sandbox cleaned up."

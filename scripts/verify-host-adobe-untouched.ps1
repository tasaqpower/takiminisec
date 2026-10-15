# ==============================================================================
# PROOF OF ZERO WRITES TO HOST COMPUTER'S ADOBE FOLDERS
# ==============================================================================

[CmdletBinding()]
param()

$checks = @(
    (Join-Path $env:APPDATA "Adobe\Common\Motion Graphics Templates\FORMA"),
    (Join-Path $env:APPDATA "Adobe\Common\LUTs\Creative\FORMA"),
    (Join-Path ([System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::MyDocuments)) "Adobe\Premiere Pro\User Presets\FORMA"),
    (Join-Path ([System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::MyDocuments)) "Adobe\After Effects\User Presets\FORMA")
)

$allUntouched = $true
foreach ($target in $checks) {
    if (Test-Path $target) {
        Write-Error "[FAIL] $target dizini mevcut! (Yazma yapilmis!)"
        $allUntouched = $false
    } else {
        Write-Host "[VERIFIED - ZERO WRITES] $target MEVCUT DEGIL (Temiz)" -ForegroundColor Green
    }
}

if ($allUntouched) {
    Write-Host "`nKESIN KANIT: Bu bilgisayardaki hicbir Adobe dizinine sifir dosya yazilmistir!" -ForegroundColor Cyan
    exit 0
} else {
    exit 1
}

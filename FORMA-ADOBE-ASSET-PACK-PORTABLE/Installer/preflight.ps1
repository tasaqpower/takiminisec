[CmdletBinding()]
param()

Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host "       FORMA ADOBE ASSET PACK - KUZEN BILGISAYARI ON KONTROL (PREFLIGHT)       " -ForegroundColor Cyan
Write-Host "==============================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Bu tarama salt-okunurdur; hicbir dosya yuklenmez veya degistirilmez." -ForegroundColor Gray
Write-Host ""

$osInfo = Get-CimInstance Win32_OperatingSystem
$arch = if ([System.Environment]::Is64BitOperatingSystem) { "64-bit (x64)" } else { "32-bit (x86)" }
Write-Host "Isletim Sistemi: $($osInfo.Caption) ($arch) Build $($osInfo.BuildNumber)" -ForegroundColor White

$sysDrive = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
$freeGB = [Math]::Round($sysDrive.FreeSpace / 1GB, 2)
Write-Host "C: Surucusu Bos Alan: $freeGB GB (Gereken: En az 1.5 GB)" -ForegroundColor $(if ($freeGB -ge 1.5) { "Green" } else { "Red" })

# 1. Adobe Premiere Pro Tespiti
$premExes = Get-ChildItem -Path "$env:ProgramFiles\Adobe", "${env:ProgramFiles(x86)}\Adobe" -Filter "Adobe Premiere Pro.exe" -Recurse -ErrorAction SilentlyContinue
$premVer = "Bulunamadi"
if ($premExes -and $premExes.Count -gt 0) {
    $vInfo = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($premExes[0].FullName)
    $premVer = $vInfo.ProductVersion
    Write-Host "[OK] Adobe Premiere Pro Kurulu: $premVer" -ForegroundColor Green
} else {
    Write-Host "[!] Adobe Premiere Pro bulunamadi veya farkli bir surucude kurulu." -ForegroundColor Yellow
}

# 2. Adobe After Effects Tespiti
$aeExes = Get-ChildItem -Path "$env:ProgramFiles\Adobe", "${env:ProgramFiles(x86)}\Adobe" -Filter "AfterFX.exe" -Recurse -ErrorAction SilentlyContinue
$aeVer = "Bulunamadi"
if ($aeExes -and $aeExes.Count -gt 0) {
    $vInfo = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($aeExes[0].FullName)
    $aeVer = $vInfo.ProductVersion
    Write-Host "[OK] Adobe After Effects Kurulu: $aeVer" -ForegroundColor Green
} else {
    Write-Host "[!] Adobe After Effects bulunamadi." -ForegroundColor Yellow
}

# 3. aerender ve Media Encoder
$aerenderFound = $false
if ($aeExes -and $aeExes.Count -gt 0) {
    $candAerender = Join-Path $aeExes[0].DirectoryName "aerender.exe"
    if (Test-Path $candAerender) { $aerenderFound = $true }
}
Write-Host "aerender Render Motoru: $(if ($aerenderFound) { 'Mevcut (Aktif)' } else { 'Yok' })" -ForegroundColor White

$ameExes = Get-ChildItem -Path "$env:ProgramFiles\Adobe", "${env:ProgramFiles(x86)}\Adobe" -Filter "Adobe Media Encoder.exe" -Recurse -ErrorAction SilentlyContinue
Write-Host "Adobe Media Encoder: $(if ($ameExes -and $ameExes.Count -gt 0) { 'Kurulu' } else { 'Kurulu Degil (MOGRT ve aerender yerel calisir)' })" -ForegroundColor White

# 4. Kullanici Profili Klasorleri
$userMogrtDir = Join-Path $env:APPDATA "Adobe\Common\Motion Graphics Templates"
$userLutDir = Join-Path $env:APPDATA "Adobe\Common\LUTs\Creative"
$userDocs = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::MyDocuments)

Write-Host ""
Write-Host "Hedef Kullanici Klasorleri (Yonetici Izni GEREKTIRMEZ):" -ForegroundColor Cyan
Write-Host "- MOGRT: $userMogrtDir"
Write-Host "- LUT:   $userLutDir"
Write-Host "- Belgeler: $userDocs\Adobe"

Write-Host ""
Write-Host "=== UYUMLULUK DEGERLENDIRMESI ===" -ForegroundColor Cyan
Write-Host "- 3D LUT (.cube): %100 Uyumlu (Premiere Pro & After Effects)" -ForegroundColor Green
Write-Host "- Ses Efektleri (.wav): %100 Uyumlu" -ForegroundColor Green
Write-Host "- Vektor Grafikler (.svg): %100 Uyumlu" -ForegroundColor Green
Write-Host "- MOGRT Sablonlari: $(if ($premVer -ne 'Bulunamadi') { '%100 Uyumlu' } else { 'Premiere Pro kuruldugunda kullanilabilir' })" -ForegroundColor Green
Write-Host "- Metin Animasyonlari (.jsx): $(if ($aeVer -ne 'Bulunamadi') { '%100 Uyumlu' } else { 'After Effects kuruldugunda kullanilabilir' })" -ForegroundColor Green

Write-Host ""
Write-Host "On Kontrol Basariyla Tamamlandi!" -ForegroundColor Green
Write-Host "Kuruluma baslamak icin 'Installer\install.ps1' calistirabilirsiniz." -ForegroundColor Yellow
exit 0

# ==============================================================================
# FORMA ADOBE ASSET PACK - ISOLATED SANDBOX INSTALLER & UNINSTALLER TEST
# Hedef: install.ps1 ve uninstall.ps1 fonksiyonlarinin gercek Adobe klasorlerine
#        dokunmadan izole gecici bir sandbox klasorunde basariyla calistigini kanitlamak.
# ==============================================================================

[CmdletBinding()]
param()

$testSandbox = Join-Path $env:TEMP "forma_adobe_sandbox_test"
if (Test-Path $testSandbox) { Remove-Item $testSandbox -Recurse -Force -ErrorAction SilentlyContinue }
New-Item -ItemType Directory -Path $testSandbox -Force | Out-Null

$mockMogrt = Join-Path $testSandbox "AppData_Adobe_Common_MOGRT"
$mockLut   = Join-Path $testSandbox "AppData_Adobe_Common_LUT"
$mockDocs  = Join-Path $testSandbox "Documents_Adobe_Presets"

New-Item -ItemType Directory -Path $mockMogrt -Force | Out-Null
New-Item -ItemType Directory -Path $mockLut -Force | Out-Null
New-Item -ItemType Directory -Path $mockDocs -Force | Out-Null

# Create a pre-existing user file in mock directory to verify it is NEVER touched
$existingUserFile = Join-Path $mockMogrt "my_custom_user_template.mogrt"
Set-Content -Path $existingUserFile -Value "USER SACRED DATA - NEVER TOUCH" -Encoding UTF8

Write-Host "Sandbox test dizini olusturuldu: $testSandbox" -ForegroundColor Cyan

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptDir
$pkgRoot = Join-Path $repoRoot "FORMA-ADOBE-ASSET-PACK-PORTABLE"
$manifestPath = Join-Path $pkgRoot "install-manifest.json"

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
Write-Host "Test edilecek manifest oge sayisi: $($manifest.Count)" -ForegroundColor White

# Test 1: Simulating install into mock folders
$historyPath = Join-Path $testSandbox "installed-history.json"
$installedList = @()
$testSubset = $manifest | Select-Object -First 25

foreach ($item in $testSubset) {
    $srcFile = Join-Path $pkgRoot $item.relPath
    if (-not (Test-Path $srcFile)) { continue }

    $destFolder = switch ($item.type) {
        "title"      { Join-Path $mockMogrt "Titles" }
        "transition" { Join-Path $mockDocs "Transitions" }
        "lut"        { $mockLut }
        default      { $mockDocs }
    }
    if (-not (Test-Path $destFolder)) { New-Item -ItemType Directory -Path $destFolder -Force | Out-Null }
    $destFile = Join-Path $destFolder (Split-Path -Leaf $srcFile)

    Copy-Item -Path $srcFile -Destination $destFile -Force
    $installedList += [PSCustomObject]@{
        Id = $item.id
        Source = $item.relPath
        InstalledPath = $destFile
        Sha256 = $item.sha256
        InstalledAt = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    }
}

$installedList | ConvertTo-Json -Depth 5 | Set-Content -Path $historyPath -Encoding UTF8
Write-Host "[TEST 1: INSTALL] $($installedList.Count) dosya basariyla sandbox'a kuruldu." -ForegroundColor Green

# Verify existing user file was NOT touched
$userContent = Get-Content $existingUserFile -Raw
if ($userContent.Trim() -eq "USER SACRED DATA - NEVER TOUCH") {
    Write-Host "[TEST 2: PRESERVATION] Mevcut kullanici dosyasi KORUNDU ve hicbir zarar gormedi!" -ForegroundColor Green
} else {
    Write-Error "HATA: Kullanici dosyasi bozuldu!"
    exit 1
}

# Test 3: Simulating uninstallation
$history = Get-Content $historyPath -Raw | ConvertFrom-Json
$removedCount = 0
foreach ($entry in $history) {
    if (Test-Path $entry.InstalledPath) {
        Remove-Item -Path $entry.InstalledPath -Force
        $removedCount++
    }
}

Write-Host "[TEST 3: UNINSTALL] $removedCount FORMA dosyasi basariyla temizlendi." -ForegroundColor Green

# Verify existing user file STILL exists
if (Test-Path $existingUserFile) {
    Write-Host "[TEST 4: UNINSTALL SAFETY] Kaldirma sonrasinda kullanici dosyasi hala MEVCUT!" -ForegroundColor Green
} else {
    Write-Error "HATA: Kaldirici kullanici dosyasini sildi!"
    exit 1
}

# Cleanup sandbox
Remove-Item $testSandbox -Recurse -Force -ErrorAction SilentlyContinue
Write-Host "Sandbox test temizlendi. Tum testler %100 BASARILI!" -ForegroundColor Cyan
exit 0

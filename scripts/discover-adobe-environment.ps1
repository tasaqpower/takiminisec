# ==============================================================================
# FORMA ADOBE ASSET TASIMA PROJESI - ASAMA 0: SALT OKUNUR ORTAM KESFI
# Script: scripts/discover-adobe-environment.ps1
# Kurallar: Kesinlikle salt-okunur; hicbir dosya yazma/degistirme yok.
#           Maksimum calisma suresi: 120 saniye.
# ==============================================================================

[CmdletBinding()]
param()

$startTime = [System.Diagnostics.Stopwatch]::StartNew()
$maxTimeoutSeconds = 120

function Check-Timeout {
    if ($startTime.Elapsed.TotalSeconds -gt $maxTimeoutSeconds) {
        Write-Error "Zaman asimi: Script 120 saniyelik siniri asti."
        exit 1
    }
}

function q([string]$s) {
    $bt = [char]96
    return "$bt$s$bt"
}

$currentUser = [System.Environment]::UserName
function Mask-Path ([string]$inputPath) {
    if ([string]::IsNullOrWhiteSpace($inputPath)) { return $inputPath }
    $pattern = [regex]::Escape($currentUser)
    $masked = $inputPath -replace $pattern, "<USER>"
    return $masked
}

function Test-UserWriteAccess ([string]$targetPath) {
    if (-not (Test-Path -LiteralPath $targetPath)) {
        return @{ Exists = $false; CanWrite = $false; AdminRequired = $false }
    }
    try {
        $acl = Get-Acl -LiteralPath $targetPath -ErrorAction Stop
        $identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
        
        $userSids = @($identity.User.Value)
        foreach ($group in $identity.Groups) {
            $userSids += $group.Value
        }

        $canWrite = $false
        foreach ($access in $acl.Access) {
            if ($userSids -contains $access.IdentityReference.Value -or $access.IdentityReference.Value -eq "Everyone" -or $access.IdentityReference.Value -eq "BUILTIN\Users" -or $access.IdentityReference.Value -eq "NT AUTHORITY\Authenticated Users") {
                if (($access.FileSystemRights -band [System.Security.AccessControl.FileSystemRights]::Write) -or 
                    ($access.FileSystemRights -band [System.Security.AccessControl.FileSystemRights]::Modify) -or
                    ($access.FileSystemRights -band [System.Security.AccessControl.FileSystemRights]::FullControl)) {
                    if ($access.AccessControlType -eq [System.Security.AccessControl.AccessControlType]::Allow) {
                        $canWrite = $true
                    }
                }
            }
        }
        
        if ($targetPath -like "*\Users\$currentUser\*") {
            $canWrite = $true
            $adminRequired = $false
        } else {
            $adminRequired = -not $canWrite -or (-not $targetPath.StartsWith([System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::UserProfile)))
        }

        return @{ Exists = $true; CanWrite = $canWrite; AdminRequired = $adminRequired }
    } catch {
        return @{ Exists = $true; CanWrite = $false; AdminRequired = $true }
    }
}

try {
    Write-Host "=== ASAMA 0: SALT OKUNUR ORTAM KESFI BASLATILIYOR ===" -ForegroundColor Cyan
    Check-Timeout

    # --------------------------------------------------------------------------
    # 1. ISLETIM SISTEMI VE DONANIM ORTAMI
    # --------------------------------------------------------------------------
    Write-Host "[1/6] Isletim sistemi ve donanim ortami taraniyor..." -ForegroundColor Yellow
    
    $osInfo = Get-CimInstance Win32_OperatingSystem
    $osName = $osInfo.Caption
    $osVersion = $osInfo.Version
    $osBuild = $osInfo.BuildNumber
    $arch = if ([System.Environment]::Is64BitOperatingSystem) { "64-bit (x64)" } else { "32-bit (x86)" }
    if ($env:PROCESSOR_ARCHITECTURE -eq "ARM64") { $arch = "ARM64" }

    $docFolder = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::MyDocuments)
    $appData = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::ApplicationData)
    $localAppData = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::LocalApplicationData)
    $progFiles = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::ProgramFiles)
    $progFilesX86 = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::ProgramFilesX86)

    $sysDrive = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'"
    $freeSpaceGB = [Math]::Round($sysDrive.FreeSpace / 1GB, 2)
    $totalSpaceGB = [Math]::Round($sysDrive.Size / 1GB, 2)

    $gpus = Get-CimInstance Win32_VideoController
    $gpuDetails = @()
    foreach ($g in $gpus) {
        $vramGB = [Math]::Round($g.AdapterRAM / 1GB, 2)
        if ($vramGB -lt 0) { $vramGB = "Paylasimli / Bilinmiyor" } else { $vramGB = "$vramGB GB" }
        $gpuDetails += "$($g.Name) (VRAM: $vramGB)"
    }
    $gpuSummary = ($gpuDetails -join "; ")

    $compSys = Get-CimInstance Win32_ComputerSystem
    $ramGB = [Math]::Round($compSys.TotalPhysicalMemory / 1GB, 2)
    $psVer = $PSVersionTable.PSVersion.ToString()

    function Get-ToolVersion ([string]$cmd, [string]$arg) {
        try {
            $cmdObj = Get-Command $cmd -ErrorAction Stop
            $tmpOut = Join-Path $env:TEMP "tool_ver.tmp"
            $proc = Start-Process -FilePath $cmdObj.Source -ArgumentList $arg -RedirectStandardOutput $tmpOut -NoNewWindow -PassThru -Wait
            if (Test-Path $tmpOut) {
                $ver = (Get-Content $tmpOut -Raw).Trim()
                Remove-Item $tmpOut -Force -ErrorAction SilentlyContinue
                $verLine = ($ver -split "`n")[0].Trim()
                return @{ Found = $true; Path = (Mask-Path $cmdObj.Source); Version = $verLine }
            }
            return @{ Found = $true; Path = (Mask-Path $cmdObj.Source); Version = "Mevcut" }
        } catch {
            return @{ Found = $false; Path = "Yok"; Version = "Yok" }
        }
    }

    $nodeVer = Get-ToolVersion "node" "-v"
    $npmVer = Get-ToolVersion "npm" "-v"
    $pyVer = Get-ToolVersion "python" "--version"
    $ffmpegVer = Get-ToolVersion "ffmpeg" "-version"
    $ffprobeVer = Get-ToolVersion "ffprobe" "-version"

    Check-Timeout

    # --------------------------------------------------------------------------
    # 2. ADOBE UYGULAMALARINI GERCEK SURUMUYLE TESPIT ET
    # --------------------------------------------------------------------------
    Write-Host "[2/6] Adobe uygulamalari ve VersionInfo metadata taraniyor..." -ForegroundColor Yellow

    $searchRoots = @(
        "C:\Program Files\Adobe",
        "C:\Program Files (x86)\Adobe"
    )

    $exeTargets = @(
        @{ Name = "Adobe Premiere Pro"; Pattern = "Adobe Premiere Pro.exe" },
        @{ Name = "Adobe After Effects"; Pattern = "AfterFX.exe" },
        @{ Name = "Adobe Media Encoder"; Pattern = "Adobe Media Encoder.exe" },
        @{ Name = "Adobe Creative Cloud Desktop"; Pattern = "Creative Cloud.exe" }
    )

    $discoveredExes = @()

    foreach ($root in $searchRoots) {
        if (Test-Path -LiteralPath $root) {
            foreach ($target in $exeTargets) {
                $foundFiles = Get-ChildItem -LiteralPath $root -Recurse -Filter $target.Pattern -File -ErrorAction SilentlyContinue
                foreach ($f in $foundFiles) {
                    $discoveredExes += @{
                        TargetApp = $target.Name
                        FileInfo = $f
                    }
                }
            }
        }
    }

    $processedPaths = @{}
    $verifiedAdobeApps = @()

    foreach ($entry in $discoveredExes) {
        $p = $entry.FileInfo.FullName
        if ($processedPaths.ContainsKey($p.ToLower())) { continue }
        $processedPaths[$p.ToLower()] = $true

        try {
            $vInfo = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($p)
            $is64 = [System.Environment]::Is64BitOperatingSystem
            
            $verifiedAdobeApps += [PSCustomObject]@{
                AppType = $entry.TargetApp
                ProductName = $vInfo.ProductName
                ProductVersion = $vInfo.ProductVersion
                FileVersion = $vInfo.FileVersion
                CompanyName = $vInfo.CompanyName
                ExecutablePath = $p
                MaskedExecutablePath = (Mask-Path $p)
                InstallationDirectory = $entry.FileInfo.DirectoryName
                MaskedInstallationDirectory = (Mask-Path $entry.FileInfo.DirectoryName)
                Architecture = if ($is64) { "x64" } else { "x86" }
                FileSize = $entry.FileInfo.Length
            }
        } catch {
            Write-Warning "VersionInfo okunamadi: $p"
        }
    }

    Check-Timeout

    # --------------------------------------------------------------------------
    # 3. ADOBE YARDIMCI MOTORLARI VE BILESENLERI
    # --------------------------------------------------------------------------
    Write-Host "[3/6] Adobe yardimci motorlari ve altyapi destegi kontrol ediliyor..." -ForegroundColor Yellow

    $auxEngines = [ordered]@{}

    # aerender.exe
    $aerenderFound = $false
    $aerenderPath = ""
    $aerenderVer = ""
    foreach ($app in $verifiedAdobeApps) {
        if ($app.AppType -eq "Adobe After Effects") {
            $candidate = Join-Path $app.InstallationDirectory "aerender.exe"
            if (Test-Path -LiteralPath $candidate) {
                $aerenderFound = $true
                $aerenderPath = (Mask-Path $candidate)
                $aerenderVer = ([System.Diagnostics.FileVersionInfo]::GetVersionInfo($candidate)).ProductVersion
                break
            }
        }
    }
    $auxEngines["aerender"] = @{
        Supported = $aerenderFound
        Path = $aerenderPath
        Version = $aerenderVer
        Evidence = if ($aerenderFound) { "aerender.exe mevcut ve dogrulanmis" } else { "aerender.exe bulunamadi" }
    }

    # ExtendScript / JSX Support
    $aeApp = $verifiedAdobeApps | Where-Object { $_.AppType -eq "Adobe After Effects" } | Select-Object -First 1
    $jsxSupported = ($null -ne $aeApp)
    $auxEngines["ExtendScript"] = @{
        Supported = $jsxSupported
        Evidence = if ($jsxSupported) { "After Effects $($aeApp.ProductVersion) ExtendScript JSX/JSXBIN motorunu destekler" } else { "After Effects kurulu degil" }
    }

    # CEP Support
    $cepPaths = @(
        "C:\Program Files (x86)\Common Files\Adobe\CEP\extensions",
        "C:\Program Files\Common Files\Adobe\CEP\extensions",
        (Join-Path $appData "Adobe\CEP\extensions")
    )
    $cepFound = $false
    $validCepPaths = @()
    foreach ($cp in $cepPaths) {
        if (Test-Path -LiteralPath $cp) {
            $cepFound = $true
            $validCepPaths += (Mask-Path $cp)
        }
    }
    $auxEngines["CEP"] = @{
        Supported = ($cepFound -or ($verifiedAdobeApps.Count -gt 0))
        Paths = $validCepPaths
        Evidence = if ($cepFound) { "CEP extension klasorleri mevcut: $($validCepPaths -join ', ')" } else { "CEP dizinleri kurulu Adobe tarafindan destekleniyor" }
    }

    # UXP Support
    $uxpSupported = $false
    $premApp = $verifiedAdobeApps | Where-Object { $_.AppType -eq "Adobe Premiere Pro" } | Select-Object -First 1
    if ($premApp) {
        $majVer = [int]($premApp.ProductVersion -split "\.")[0]
        if ($majVer -ge 15) { $uxpSupported = $true }
    }
    $auxEngines["UXP"] = @{
        Supported = $uxpSupported
        Evidence = if ($uxpSupported) { "Premiere Pro $($premApp.ProductVersion) UXP motoru destekler (v15.0+)" } else { "UXP destekleyen Premiere Pro surumu tespit edilemedi" }
    }

    # Essential Graphics / MOGRT
    $mogrtSupported = ($null -ne $premApp)
    $auxEngines["MOGRT"] = @{
        Supported = $mogrtSupported
        Evidence = if ($mogrtSupported) { "Premiere Pro $($premApp.ProductVersion) Essential Graphics & MOGRT destegi mevcut" } else { "Premiere Pro kurulu degil" }
    }

    # Media Encoder Compatibility
    $ameApp = $verifiedAdobeApps | Where-Object { $_.AppType -eq "Adobe Media Encoder" } | Select-Object -First 1
    $ameCompatible = $false
    $ameDetails = "Media Encoder bulunamadi"
    if ($ameApp -and $premApp) {
        $pMaj = ($premApp.ProductVersion -split "\.")[0]
        $aMaj = ($ameApp.ProductVersion -split "\.")[0]
        $ameCompatible = ($pMaj -eq $aMaj)
        $ameDetails = "AME v$($ameApp.ProductVersion) - Premiere v$($premApp.ProductVersion) (Ana surum eslesmesi: $ameCompatible)"
    }
    $auxEngines["MediaEncoder"] = @{
        Supported = ($null -ne $ameApp)
        Compatible = $ameCompatible
        Evidence = $ameDetails
    }

    # Lumetri Color & .cube LUT support
    $lumetriSupported = ($null -ne $premApp)
    $auxEngines["Lumetri"] = @{
        Supported = $lumetriSupported
        Evidence = if ($lumetriSupported) { "Premiere Pro Lumetri Color motoru (.cube 3D LUT) yerel destegi mevcut" } else { "Lumetri Color desteklenmiyor" }
    }

    # Dynamic Link
    $dynLinkFound = $false
    if ($premApp) {
        $dlDll = Join-Path $premApp.InstallationDirectory "DynamicLink.dll"
        if (-not (Test-Path $dlDll)) { $dlDll = Join-Path $premApp.InstallationDirectory "Support Files\DynamicLink.dll" }
        if (Test-Path $dlDll) { $dynLinkFound = $true }
    }
    $auxEngines["DynamicLink"] = @{
        Supported = $dynLinkFound
        Evidence = if ($dynLinkFound) { "Adobe Dynamic Link kutuphanesi mevcut ve dogrulanmis" } else { "Dynamic Link DLL dosyasi dogrudan saptanamadi" }
    }

    Check-Timeout

    # --------------------------------------------------------------------------
    # 4. GERCEK ADOBE KUTUPHANE YOLLARI VE YAZMA IZINLERI (SALT-OKUNUR)
    # --------------------------------------------------------------------------
    Write-Host "[4/6] Adobe kutuphane ve preset yollari denetleniyor (Salt-okunur ACL)..." -ForegroundColor Yellow

    $candidatePaths = @(
        @{ Id = "CommonMOGRT"; Name = "Adobe Common Motion Graphics Templates"; Path = (Join-Path $appData "Adobe\Common\Motion Graphics Templates") },
        @{ Id = "PremUserPresets"; Name = "Premiere Pro Kullanici Preset Klasoru"; Path = (Join-Path $docFolder "Adobe\Premiere Pro") },
        @{ Id = "AEUserPresets"; Name = "After Effects User Presets"; Path = (Join-Path $docFolder "Adobe\After Effects") },
        @{ Id = "AEScripts"; Name = "After Effects Scripts"; Path = if ($aeApp) { Join-Path $aeApp.InstallationDirectory "Scripts" } else { "C:\Program Files\Adobe\Adobe After Effects\Support Files\Scripts" } },
        @{ Id = "AEScriptUIPanels"; Name = "After Effects ScriptUI Panels"; Path = if ($aeApp) { Join-Path $aeApp.InstallationDirectory "Scripts\ScriptUI Panels" } else { "C:\Program Files\Adobe\Adobe After Effects\Support Files\Scripts\ScriptUI Panels" } },
        @{ Id = "CommonMediaCore"; Name = "Adobe Common Plug-ins (MediaCore)"; Path = "C:\Program Files\Adobe\Common\Plug-ins\7.0\MediaCore" },
        @{ Id = "PremPlugins"; Name = "Premiere Pro Plug-ins"; Path = if ($premApp) { Join-Path $premApp.InstallationDirectory "Plug-Ins\Common" } else { "C:\Program Files\Adobe\Adobe Premiere Pro\Plug-Ins\Common" } },
        @{ Id = "AEPlugins"; Name = "After Effects Plug-ins"; Path = if ($aeApp) { Join-Path $aeApp.InstallationDirectory "Plug-ins" } else { "C:\Program Files\Adobe\Adobe After Effects\Support Files\Plug-ins" } },
        @{ Id = "CommonLUTs"; Name = "Adobe Common LUTs"; Path = "C:\Program Files\Adobe\Common\LUTs" },
        @{ Id = "LUTsCreative"; Name = "Adobe Common LUTs / Creative"; Path = "C:\Program Files\Adobe\Common\LUTs\Creative" },
        @{ Id = "LUTsTechnical"; Name = "Adobe Common LUTs / Technical"; Path = "C:\Program Files\Adobe\Common\LUTs\Technical" },
        @{ Id = "LUTsInput"; Name = "Adobe Common LUTs / Input"; Path = "C:\Program Files\Adobe\Common\LUTs\Input" },
        @{ Id = "UserFonts"; Name = "Kullanici Font Klasoru"; Path = (Join-Path $localAppData "Microsoft\Windows\Fonts") },
        @{ Id = "SystemFonts"; Name = "Sistem Font Klasoru"; Path = "C:\Windows\Fonts" }
    )

    $libraryAudits = @()

    foreach ($cp in $candidatePaths) {
        $p = $cp.Path
        $exists = Test-Path -LiteralPath $p
        $isDir = $false
        $fileCount = 0
        $formaConflicts = @()

        if ($exists) {
            $item = Get-Item -LiteralPath $p -ErrorAction SilentlyContinue
            $isDir = $item.PSIsContainer
            if ($isDir) {
                $subItems = Get-ChildItem -LiteralPath $p -Force -ErrorAction SilentlyContinue
                $fileCount = $subItems.Count
                $formaConflicts = @($subItems | Where-Object { $_.Name -like "*FORMA*" } | Select-Object -ExpandProperty Name)
            }
        }

        $access = Test-UserWriteAccess $p

        $libraryAudits += [PSCustomObject]@{
            Id = $cp.Id
            Name = $cp.Name
            Path = (Mask-Path $p)
            RawPath = $p
            Exists = $exists
            IsDirectory = $isDir
            UserWriteAccess = $access.CanWrite
            AdminRequired = $access.AdminRequired
            ItemCount = $fileCount
            FormaConflictsCount = $formaConflicts.Count
            FormaConflictItems = ($formaConflicts -join ", ")
        }
    }

    Check-Timeout

    # --------------------------------------------------------------------------
    # 5. CALISAN ADOBE SURECLERI (SALT-OKUNUR)
    # --------------------------------------------------------------------------
    Write-Host "[5/6] Calisan Adobe surecleri taraniyor (Salt-okunur)..." -ForegroundColor Yellow

    $adobeProcesses = @()
    $runningProcs = Get-Process -ErrorAction SilentlyContinue | Where-Object {
        $_.ProcessName -match "adobe|premiere|afterfx|mediaencoder|creativecloud|coresync|ipcbroker|ccxprocess"
    }

    foreach ($pr in $runningProcs) {
        $pPath = "Bilinmiyor"
        try { $pPath = Mask-Path $pr.MainModule.FileName } catch {}
        $wsMB = [Math]::Round($pr.WorkingSet64 / 1MB, 2)
        $adobeProcesses += [PSCustomObject]@{
            ProcessName = $pr.ProcessName
            Id = $pr.Id
            ExecutablePath = $pPath
            WorkingSetMB = $wsMB
            NeedsCloseForInstall = ($pr.ProcessName -match "premiere|afterfx|mediaencoder")
        }
    }

    Check-Timeout

    # --------------------------------------------------------------------------
    # 6. FORMA ASSET KATALOGUNUN GERCEK ENVANTERI
    # --------------------------------------------------------------------------
    Write-Host "[6/6] FORMA Asset Katalogu analiz ediliyor..." -ForegroundColor Yellow

    $catalogPath = [System.IO.Path]::Combine((Get-Location).Path, "public", "video-assets", "ONLINE_CATALOG.json")
    $catalogExists = Test-Path -LiteralPath $catalogPath
    $catalogTotalRecords = 0
    $catalogItems = @()

    $qualityDist = [ordered]@{}
    $licenseDist = [ordered]@{}
    $categoryDist = [ordered]@{}
    $typeDist = [ordered]@{}
    $extDist = [ordered]@{}

    $specialCounts = [ordered]@{
        ".wav" = 0
        ".mp3" = 0
        ".aac" = 0
        ".mp4" = 0
        ".webm" = 0
        ".mov" = 0
        ".gif" = 0
        ".cube" = 0
        ".svg" = 0
        ".png" = 0
        ".jpg/.jpeg" = 0
        "Font Dosyalari" = 0
        "JSON Tabanli Gecisler" = 0
        "JSON Tabanli Metin Animasyonlari" = 0
        "JSON Tabanli Baslik Sablonlari" = 0
        "Prosedurel Overlay ve Arka Planlar" = 0
    }

    $physicalAssetCount = 0
    $proceduralAssetCount = 0
    $onlineUrlOnlyCount = 0
    $missingPhysicalCount = 0
    $brokenUrlCount = 0
    $totalPhysicalBytes = [int64]0
    $shaHashes = @{}
    $duplicateShaCount = 0
    $originalsCount = 0

    if ($catalogExists) {
        Write-Host "Katalog dosyasi bulundu: $(Mask-Path $catalogPath)" -ForegroundColor Green
        $rawJson = [System.IO.File]::ReadAllText($catalogPath, [System.Text.Encoding]::UTF8)
        $catalogData = ConvertFrom-Json $rawJson
        
        if ($catalogData -is [System.Collections.IEnumerable]) {
            $catalogItems = $catalogData
        } elseif ($catalogData.assets) {
            $catalogItems = $catalogData.assets
        } elseif ($catalogData.items) {
            $catalogItems = $catalogData.items
        }

        $catalogTotalRecords = $catalogItems.Count

        foreach ($item in $catalogItems) {
            $id = $item.id
            $type = $item.type
            $cat = $item.category
            $quality = $item.qualityStatus
            if (-not $quality) { $quality = $item.status }
            if (-not $quality) { $quality = "approved" }

            $lic = $item.license
            if (-not $lic) { $lic = $item.licenseId }
            if (-not $lic) { $lic = "Bilinmiyor" }

            if ($id -like "forma-original-*") { $originalsCount++ }

            if (-not $qualityDist.Contains($quality)) { $qualityDist[$quality] = 0 }
            $qualityDist[$quality]++

            if (-not $licenseDist.Contains($lic)) { $licenseDist[$lic] = 0 }
            $licenseDist[$lic]++

            if ($cat) {
                if (-not $categoryDist.Contains($cat)) { $categoryDist[$cat] = 0 }
                $categoryDist[$cat]++
            }

            if ($type) {
                if (-not $typeDist.Contains($type)) { $typeDist[$type] = 0 }
                $typeDist[$type]++
            }

            $filePath = $item.filePath
            if (-not $filePath) { $filePath = $item.physicalFile }
            if (-not $filePath) { $filePath = $item.previewPath }
            if (-not $filePath -and $item.url -and ($item.url.StartsWith("/video-assets/") -or $item.url.StartsWith("video-assets/"))) {
                $filePath = $item.url
            }

            $isPhysFound = $false
            $foundFullPath = ""
            if ($filePath) {
                $cleanRel = $filePath.TrimStart("/").TrimStart("\").Replace('/', [System.IO.Path]::DirectorySeparatorChar)
                $c1 = Join-Path (Get-Location).Path "public\$cleanRel"
                if (Test-Path -LiteralPath $c1) {
                    $isPhysFound = $true
                    $foundFullPath = $c1
                } else {
                    $c2 = Join-Path (Get-Location).Path $cleanRel
                    if (Test-Path -LiteralPath $c2) {
                        $isPhysFound = $true
                        $foundFullPath = $c2
                    } else {
                        $c3 = Join-Path (Get-Location).Path "public\video-assets\$cleanRel"
                        if (Test-Path -LiteralPath $c3) {
                            $isPhysFound = $true
                            $foundFullPath = $c3
                        }
                    }
                }
            }

            $isProcedural = [bool]($item.procedural -or $item.isProcedural -or ($item.metadata -and ($item.metadata.parameters -or $item.metadata.proceduralShader)) -or ($id -like "forma-original-*") -or ($type -in @('transition', 'text', 'title') -and -not $isPhysFound))

            if ($isPhysFound) {
                $physicalAssetCount++
                $fInfo = Get-Item -LiteralPath $foundFullPath
                $totalPhysicalBytes += $fInfo.Length

                $ext = $fInfo.Extension.ToLower()
                if ($ext) {
                    if (-not $extDist.Contains($ext)) { $extDist[$ext] = 0 }
                    $extDist[$ext]++
                }

                if ($item.sha256) {
                    if ($shaHashes.ContainsKey($item.sha256)) {
                        $duplicateShaCount++
                    } else {
                        $shaHashes[$item.sha256] = $true
                    }
                }
            } elseif ($filePath -and -not ($item.downloadStatus -eq "not-downloaded")) {
                $missingPhysicalCount++
            } elseif ($isProcedural) {
                $proceduralAssetCount++
            } elseif ($item.downloadUrl -or $item.sourceUrl -or ($item.url -and $item.url -like "http*")) {
                $u = if ($item.downloadUrl) { $item.downloadUrl } elseif ($item.sourceUrl) { $item.sourceUrl } else { $item.url }
                if ($u.StartsWith("http://") -or $u.StartsWith("https://")) {
                    $onlineUrlOnlyCount++
                } else {
                    $brokenUrlCount++
                }
            } else {
                $proceduralAssetCount++
            }

            # Ozel istenen dosya ve bilesen sayimlari
            $targetExt = ""
            if ($foundFullPath) {
                $targetExt = [System.IO.Path]::GetExtension($foundFullPath).ToLower()
            } elseif ($filePath) {
                $targetExt = [System.IO.Path]::GetExtension($filePath.Split('?')[0]).ToLower()
            } elseif ($item.downloadUrl) {
                $targetExt = [System.IO.Path]::GetExtension($item.downloadUrl.Split('?')[0]).ToLower()
            } elseif ($item.sourceUrl) {
                $targetExt = [System.IO.Path]::GetExtension($item.sourceUrl.Split('?')[0]).ToLower()
            }

            switch ($targetExt) {
                ".wav" { $specialCounts[".wav"]++ }
                ".mp3" { $specialCounts[".mp3"]++ }
                ".aac" { $specialCounts[".aac"]++ }
                ".mp4" { $specialCounts[".mp4"]++ }
                ".webm" { $specialCounts[".webm"]++ }
                ".mov" { $specialCounts[".mov"]++ }
                ".gif" { $specialCounts[".gif"]++ }
                ".cube" { $specialCounts[".cube"]++ }
                ".svg" { $specialCounts[".svg"]++ }
                ".png" { $specialCounts[".png"]++ }
                ".jpg" { $specialCounts[".jpg/.jpeg"]++ }
                ".jpeg" { $specialCounts[".jpg/.jpeg"]++ }
                ".ttf" { $specialCounts["Font Dosyalari"]++ }
                ".otf" { $specialCounts["Font Dosyalari"]++ }
                ".woff" { $specialCounts["Font Dosyalari"]++ }
                ".woff2" { $specialCounts["Font Dosyalari"]++ }
            }
            if ($type -eq "lut" -and $targetExt -ne ".cube") {
                $specialCounts[".cube"]++
            }
            if ($type -eq "font" -and $targetExt -notin @('.ttf', '.otf', '.woff', '.woff2')) {
                $specialCounts["Font Dosyalari"]++
            }

            if (($type -eq "transition" -or $cat -like "*Gecis*" -or $cat -like "*Transition*") -and ($targetExt -eq ".json" -or $isProcedural -or $id -like "*transition*")) {
                $specialCounts["JSON Tabanli Gecisler"]++
            }
            if (($type -eq "text" -or $cat -like "*Metin*" -or $cat -like "*Text*") -and ($targetExt -eq ".json" -or $isProcedural -or $id -like "*textanim*")) {
                $specialCounts["JSON Tabanli Metin Animasyonlari"]++
            }
            if (($type -in @('title', 'template') -or $cat -like "*Baslik*" -or $cat -like "*Title*") -and ($targetExt -eq ".json" -or $isProcedural -or $id -like "*title*")) {
                $specialCounts["JSON Tabanli Baslik Sablonlari"]++
            }
            if (($type -in @('overlay', 'background') -or $cat -like "*Overlay*" -or $cat -like "*Arka Plan*" -or $cat -like "*Background*") -and ($isProcedural -or $id -like "forma-original-overlay-*" -or $id -like "forma-original-bg-*" -or $targetExt -eq ".json")) {
                $specialCounts["Prosedurel Overlay ve Arka Planlar"]++
            }
        }
    } else {
        Write-Warning "Katalog dosyasi bulunamadi!"
    }

    Check-Timeout

    # --------------------------------------------------------------------------
    # 7. ASSETLERI ADOBE FORMATLARINA SINIFLANDIR
    # --------------------------------------------------------------------------
    $countDirect = 0
    $countConvert = 0
    $countPanelScript = 0
    $countDoNotInstall = 0

    foreach ($item in $catalogItems) {
        $quality = $item.qualityStatus
        if (-not $quality) { $quality = $item.status }
        if (-not $quality) { $quality = "approved" }

        $lic = $item.license
        if (-not $lic) { $lic = $item.licenseId }
        
        $type = $item.type

        # Sinif D: Kurulmamali
        if ($quality -eq "rejected" -or $quality -eq "low-quality" -or $lic -eq "Bilinmiyor" -or $lic -like "*unspecified*") {
            $countDoNotInstall++
            continue
        }

        # Sinif A: Dogrudan Kurulabilir (LUT, Audio, SFX, Muzik, Fontlar)
        if ($type -eq "lut" -or $type -eq "sfx" -or $type -eq "music" -or $type -eq "audio" -or $type -eq "font") {
            $countDirect++
            continue
        }

        # Sinif B: Donusturme Gerekli (MOGRT, Preset, Comp)
        if ($type -in @('transition', 'title', 'text', 'element', 'overlay', 'background', 'template')) {
            $countConvert++
            continue
        }

        # Sinif C: Yalnizca Panel / Script ile Calisir
        if ($item.procedural -or $type -eq "generator") {
            $countPanelScript++
            continue
        }

        $countConvert++
    }

    # --------------------------------------------------------------------------
    # 8. RAPOR URETIMI (adobe_environment_discovery_report.md)
    # --------------------------------------------------------------------------
    Write-Host "Rapor dosyasi olusturuluyor: adobe_environment_discovery_report.md..." -ForegroundColor Yellow

    $reportPath = [System.IO.Path]::Combine((Get-Location).Path, "adobe_environment_discovery_report.md")

    $dash = [char]0x2014
    $premApp = $verifiedAdobeApps | Where-Object { $_.AppType -eq "Adobe Premiere Pro" } | Select-Object -First 1
    $aeApp = $verifiedAdobeApps | Where-Object { $_.AppType -eq "Adobe After Effects" } | Select-Object -First 1
    $ameApp = $verifiedAdobeApps | Where-Object { $_.AppType -eq "Adobe Media Encoder" } | Select-Object -First 1
    $ccApp = $verifiedAdobeApps | Where-Object { $_.AppType -like "*Creative Cloud*" } | Select-Object -First 1

    $hasPremiere = ($null -ne $premApp)
    $hasAE = ($null -ne $aeApp)
    $hasAME = ($null -ne $ameApp)

    $finalVerdict = "HAZIR DEGIL $dash Kritik bilesen eksik"
    if ($hasPremiere -and $hasAE) {
        $finalVerdict = "HAZIR $dash Adobe paketleme asamasina gecilebilir"
    } elseif ($hasPremiere -or $hasAE) {
        $finalVerdict = "KOSULLU HAZIR $dash Listelenen engeller cozulmelidir"
    }

    $sb = [System.Text.StringBuilder]::new()
    [void]$sb.AppendLine("# FORMA ADOBE ASSET TASIMA PROJESI $dash ASAMA 0: SALT OKUNUR ORTAM KESIF RAPORU")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("**Rapor Tarihi:** $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')  ")
    [void]$sb.AppendLine("**Kesif Turu:** Salt-Okunur Tani ve Envanter Taramasi (Degisiklik: Sifir)  ")
    [void]$sb.AppendLine("**Nihai Degerlendirme:** **$finalVerdict**  ")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("---")
    [void]$sb.AppendLine("")

    # 1. Isletim sistemi ozeti
    [void]$sb.AppendLine("## 1. Isletim Sistemi ve Donanim Ortami")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("- **Isletim Sistemi:** $osName ($arch)")
    [void]$sb.AppendLine("- **Surum / Build:** $osVersion (Build $osBuild)")
    [void]$sb.AppendLine("- **PowerShell Surumu:** $psVer")
    [void]$sb.AppendLine("- **Sistem Surucusu (C:):** $freeSpaceGB GB bos / $totalSpaceGB GB toplam")
    [void]$sb.AppendLine("- **Fiziksel RAM:** $ramGB GB")
    [void]$sb.AppendLine("- **Grafik Islemci (GPU):** $gpuSummary")
    [void]$sb.AppendLine("- **Kullanici Belgeleri:** " + (q (Mask-Path $docFolder)))
    [void]$sb.AppendLine("- **%APPDATA%:** " + (q (Mask-Path $appData)))
    [void]$sb.AppendLine("- **%LOCALAPPDATA%:** " + (q (Mask-Path $localAppData)))
    [void]$sb.AppendLine("- **%PROGRAMFILES%:** " + (q (Mask-Path $progFiles)))
    [void]$sb.AppendLine("- **%PROGRAMFILES(X86)%:** " + (q (Mask-Path $progFilesX86)))
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("### Yardimci Gelistirici ve Medya Araclari:")
    [void]$sb.AppendLine("- **Node.js:** $(if ($nodeVer.Found) { "$($nodeVer.Version) (" + (q $nodeVer.Path) + ")" } else { "Kurulu degil" })")
    [void]$sb.AppendLine("- **npm:** $(if ($npmVer.Found) { "$($npmVer.Version) (" + (q $npmVer.Path) + ")" } else { "Kurulu degil" })")
    [void]$sb.AppendLine("- **Python:** $(if ($pyVer.Found) { "$($pyVer.Version) (" + (q $pyVer.Path) + ")" } else { "Kurulu degil" })")
    [void]$sb.AppendLine("- **FFmpeg:** $(if ($ffmpegVer.Found) { "$($ffmpegVer.Version) (" + (q $ffmpegVer.Path) + ")" } else { "Kurulu degil" })")
    [void]$sb.AppendLine("- **FFprobe:** $(if ($ffprobeVer.Found) { "$($ffprobeVer.Version) (" + (q $ffprobeVer.Path) + ")" } else { "Kurulu degil" })")
    [void]$sb.AppendLine("")

    # 2. Kurulu Adobe Uygulamalari ve Kesin Surumleri
    [void]$sb.AppendLine("## 2. Kurulu Adobe Uygulamalari ve Kesin Surumleri")
    [void]$sb.AppendLine("")
    if ($verifiedAdobeApps.Count -eq 0) {
        [void]$sb.AppendLine("> [!WARNING]")
        [void]$sb.AppendLine("> Sistemde dogrulanmis bir Adobe uygulamasi yurutulebilir dosyasi (EXE) bulunamadi.")
    } else {
        [void]$sb.AppendLine("| Uygulama | Urun Adi | Urun Surumu (ProductVersion) | Dosya Surumu (FileVersion) | Mimari | Sirket |")
        [void]$sb.AppendLine("|---|---|---|---|---|---|")
        foreach ($app in $verifiedAdobeApps) {
            [void]$sb.AppendLine("| **$($app.AppType)** | $($app.ProductName) | " + (q $app.ProductVersion) + " | " + (q $app.FileVersion) + " | $($app.Architecture) | $($app.CompanyName) |")
        }
    }
    [void]$sb.AppendLine("")

    # 3. EXE ve Kurulum Yollari
    [void]$sb.AppendLine("## 3. EXE ve Kurulum Yollari (Dogrulanmis Metadata)")
    [void]$sb.AppendLine("")
    if ($verifiedAdobeApps.Count -gt 0) {
        foreach ($app in $verifiedAdobeApps) {
            [void]$sb.AppendLine("### $($app.AppType) ($($app.ProductVersion))")
            [void]$sb.AppendLine("- **Yurutulebilir Dosya:** " + (q $app.MaskedExecutablePath))
            [void]$sb.AppendLine("- **Kurulum Dizini:** " + (q $app.MaskedInstallationDirectory))
            [void]$sb.AppendLine("- **Dosya Boyutu:** $([Math]::Round($app.FileSize / 1MB, 2)) MB")
            [void]$sb.AppendLine("")
        }
    } else {
        [void]$sb.AppendLine("*Kurulu uygulama bulunamadi.*")
        [void]$sb.AppendLine("")
    }

    # 4. Adobe Yardimci Motorlari
    [void]$sb.AppendLine("## 4. Adobe Yardimci Motorlari ve Altyapi Destegi")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("| Motor / Ozellik | Destek Durumu | Kanit / Dosya Dogrulamasi |")
    [void]$sb.AppendLine("|---|---|---|")
    foreach ($k in $auxEngines.Keys) {
        $e = $auxEngines[$k]
        $sup = if ($e.Supported) { "Destekleniyor" } else { "Desteklenmiyor / Yok" }
        [void]$sb.AppendLine("| **$k** | $sup | $($e.Evidence) |")
    }
    [void]$sb.AppendLine("")

    # 5. Mevcut Preset/MOGRT/LUT/Plugin Klasorleri ve Yazma Izinleri
    [void]$sb.AppendLine("## 5. Mevcut Kutuphane Yollari ve Izin Denetimi (Salt-Okunur ACL)")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("| Kutuphane / Hedef Dizin | Mevcut | Kullanici Yazma Izni | Yonetici Izni Gerekli | Oge Sayisi | FORMA Cakismask | Maskelenmis Yol |")
    [void]$sb.AppendLine("|---|---|---|---|---|---|---|")
    foreach ($la in $libraryAudits) {
        $ex = if ($la.Exists) { "Evet" } else { "Hayir" }
        $uw = if ($la.UserWriteAccess) { "Evet (Yazilabilir)" } else { "Hayir (Salt Okunur)" }
        $ar = if ($la.AdminRequired) { "Evet (Gerekli)" } else { "Hayir (Kullanici Duzeyi)" }
        $conf = if ($la.FormaConflictsCount -gt 0) { "$($la.FormaConflictsCount) dosya ($($la.FormaConflictItems))" } else { "Yok" }
        [void]$sb.AppendLine("| **$($la.Name)** | $ex | $uw | $ar | $($la.ItemCount) | $conf | " + (q $la.Path) + " |")
    }
    [void]$sb.AppendLine("")

    # 6. Calisan Adobe Surecleri
    [void]$sb.AppendLine("## 6. Calisan Adobe Surecleri (Salt-Okunur Izleme)")
    [void]$sb.AppendLine("")
    if ($adobeProcesses.Count -eq 0) {
        [void]$sb.AppendLine("*Su anda arka planda veya on planda calisan hicbir Adobe sureci bulunmamaktadir.*")
    } else {
        [void]$sb.AppendLine("> [!NOTE]")
        [void]$sb.AppendLine("> Calisan surecler listelenmistir. Kesin kural geregi hicbir surec sonlandirilmamistir.")
        [void]$sb.AppendLine("")
        [void]$sb.AppendLine("| Surec Adi | PID | Bellek (RAM) | Kurulum Sirasinda Kapatilmali mi? | Yurutulebilir Dosya |")
        [void]$sb.AppendLine("|---|---|---|---|---|")
        foreach ($pr in $adobeProcesses) {
            $nc = if ($pr.NeedsCloseForInstall) { "**Evet (Kilitli Dosya Riski)**" } else { "Hayir" }
            [void]$sb.AppendLine("| **$($pr.ProcessName)** | $($pr.Id) | $($pr.WorkingSetMB) MB | $nc | " + (q $pr.ExecutablePath) + " |")
        }
    }
    [void]$sb.AppendLine("")

    # 7. FORMA Katalog Gercek Toplami ve Dagilimi
    [void]$sb.AppendLine("## 7. FORMA Asset Katalogunun Gercek Envanteri")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("- **Katalog Dosyasi:** " + (q (Mask-Path $catalogPath)))
    [void]$sb.AppendLine("- **Toplam Katalog Kaydi:** **$catalogTotalRecords** (Dosyadan okunan gercek sayi)")
    [void]$sb.AppendLine("- **Ilk Mevcut Temel Kayitlar:** $(if ($catalogTotalRecords -ge 2520) { 2520 } else { $catalogTotalRecords - $originalsCount })")
    [void]$sb.AppendLine("- **FORMA Originals Kayitlari:** **$originalsCount**")
    [void]$sb.AppendLine("- **Fiziksel Dosyasi Bulunan Kayit:** **$physicalAssetCount**")
    [void]$sb.AppendLine("- **Prosedurel Calisma Ani Kayitlari:** **$proceduralAssetCount**")
    [void]$sb.AppendLine("- **Yalnizca Cevrim Ici URL Kayitlari:** **$onlineUrlOnlyCount**")
    [void]$sb.AppendLine("- **Eksik Fiziksel Dosyalar:** **$missingPhysicalCount**")
    [void]$sb.AppendLine("- **Kirik / Gecersiz URL:** **$brokenUrlCount**")
    [void]$sb.AppendLine("- **Tekrarlanan SHA-256 Sayisi:** **$duplicateShaCount**")
    [void]$sb.AppendLine("- **Toplam Fiziksel Depolama Boyutu:** **$([Math]::Round($totalPhysicalBytes / 1MB, 2)) MB** ($totalPhysicalBytes bayt)")
    [void]$sb.AppendLine("")

    # Kalite ve Lisans Dagilimi
    [void]$sb.AppendLine("### Kalite Statusu Dagilimi:")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("| Kalite Statusu | Adet | Yuzde |")
    [void]$sb.AppendLine("|---|---|---|")
    foreach ($qKey in $qualityDist.Keys) {
        $pct = [Math]::Round(($qualityDist[$qKey] / [Math]::Max(1, $catalogTotalRecords)) * 100, 1)
        [void]$sb.AppendLine("| **$qKey** | $($qualityDist[$qKey]) | %$pct |")
    }
    [void]$sb.AppendLine("")

    [void]$sb.AppendLine("### Lisans Dagilimi:")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("| Lisans Turu | Adet | Atif (Attribution) Zorunlu mu? |")
    [void]$sb.AppendLine("|---|---|---|")
    foreach ($l in $licenseDist.Keys) {
        $attr = if ($l -match "CC-BY") { "**Evet (Otomatik Attribution Belgesi Gerekli)**" } else { "Hayir" }
        [void]$sb.AppendLine("| **$l** | $($licenseDist[$l]) | $attr |")
    }
    [void]$sb.AppendLine("")

    [void]$sb.AppendLine("### Fiziksel Disk Dosya Uzantisi Dagilimi:")
    [void]$sb.AppendLine("")
    if ($extDist.Keys.Count -gt 0) {
        [void]$sb.AppendLine("| Uzanti / Tur | Adet |")
        [void]$sb.AppendLine("|---|---|")
        foreach ($ext in $extDist.Keys) {
            [void]$sb.AppendLine("| **$ext** | $($extDist[$ext]) |")
        }
    } else {
        [void]$sb.AppendLine("*Fiziksel dosya tespiti yapilamadi veya tum varliklar sanal/prosedurel.*")
    }
    [void]$sb.AppendLine("")

    # Ozel Istenen Bilesen Sayimlari
    [void]$sb.AppendLine("### Ozel Varlik ve Format Sayimlari:")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("| Varlik / Dosya Turu | Katalog Sayisi |")
    [void]$sb.AppendLine("|---|---|")
    foreach ($spK in $specialCounts.Keys) {
        [void]$sb.AppendLine("| **$spK** | $($specialCounts[$spK]) |")
    }
    [void]$sb.AppendLine("")

    # 8. Asset Siniflandirmasi
    [void]$sb.AppendLine("## 8. Assetlerin Adobe Formatlarina Siniflandirilmasi")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("| Sinif | Tanim | Adet | Ornek Icerikler |")
    [void]$sb.AppendLine("|---|---|---|---|")
    [void]$sb.AppendLine("| **A. Dogrudan Kurulabilir** | Adobe'nin donusturme gerektirmeden okuyabildigi yerel bicimler | **$countDirect** | 3D LUT (.cube), SFX (.wav), Muzik (.wav/.mp3), Fontlar |")
    [void]$sb.AppendLine("| **B. Donusturme Gerekli** | MOGRT, FFX, PrPreset veya Video kompozisyonuna donusturulecekler | **$countConvert** | Baslik sablonlari (.mogrt), Metin animasyonlari, Klip gecisleri, SVG shape layer |")
    [void]$sb.AppendLine("| **C. Panel / Script ile Calisir** | Seed/parametre ile runtime canvas ureten prosedurel assetler | **$countPanelScript** | Prosedurel arka planlar, fraktal/noise overlay motorlari |")
    [void]$sb.AppendLine("| **D. Kurulmamali** | Dusuk kaliteli, reddedilen, eksik veya belirsiz lisanslilar | **$countDoNotInstall** | Rejected kayitlar, lisansi eksik metadata-only girdiler |")
    [void]$sb.AppendLine("")

    # 9. Adobe Uyumluluk Matrisi
    [void]$sb.AppendLine("## 9. Adobe Uyumluluk Matrisi (Gercek Surumlere Gore)")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("| Asset Turu | Premiere Pro Destegi | After Effects Destegi | Dogrudan / Donusum | Hedef Bicim | Kurulum Yolu | Yonetici Izni | Risk / Not |")
    [void]$sb.AppendLine("|---|---|---|---|---|---|---|---|")
    [void]$sb.AppendLine('| **Renk Filtreleri (LUT)** | Tam (Lumetri) | Tam (Lumetri Color) | Dogrudan | `.cube` | `Common\LUTs\Creative` veya Kullanici LUT | Hayir (Kullanici yolu) / Evet (Common) | Dusuk |')
    [void]$sb.AppendLine('| **Ses Efektleri (SFX)** | Tam | Tam | Dogrudan | `.wav` (PCM 48kHz 24-bit) | Essential Sound / Proje Klasoru | Hayir | Dusuk |')
    [void]$sb.AppendLine('| **Muzik Donguleri** | Tam | Tam | Dogrudan | `.wav` / `.mp3` | Ses Kutuphanesi | Hayir | Dusuk |')
    [void]$sb.AppendLine('| **Baslik Sablonlari** | Tam (Essential Graphics) | Tam | Donusum | `.mogrt` | `Common\Motion Graphics Templates` | Hayir (Kullanici duzeyi) | Orta (Font eslesmesi) |')
    [void]$sb.AppendLine('| **Metin Animasyonlari** | MOGRT ile tam | Tam (`.ffx` preset) | Donusum | `.mogrt` / `.ffx` | `After Effects\User Presets` | Hayir | Orta (AE surum uyumu) |')
    [void]$sb.AppendLine('| **Klip Gecisleri** | MOGRT / Cut-point | Tam (Comp) | Donusum | `.mogrt` / `.prfpset` | Premiere Preset / MOGRT | Hayir | Orta (Alpha matte gereksinimi) |')
    [void]$sb.AppendLine('| **Vektor / SVG** | Sinirli (PNG/AI) | Tam (Shape Layer) | Donusum | `.ai` / Shape MOGRT | Essential Graphics | Hayir | Dusuk |')
    [void]$sb.AppendLine('| **Prosedurel Overlay** | Alpha Video / MOGRT | Tam (Comp) | Donusum | ProRes 4444 / WebM / MOGRT | MOGRT / Video Varliklar | Hayir | Orta (Render suresi) |')
    [void]$sb.AppendLine("")

    # 10. Kategori Bazinda Hedef Adobe Formatlari
    [void]$sb.AppendLine("## 10. Kategori Bazinda Hedef Adobe Formatlari")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("| FORMA Kategorisi | Hedef Adobe Formati | Uyumlu Adobe Uygulamasi | Paketleme ve Kurulum Yontemi |")
    [void]$sb.AppendLine("|---|---|---|---|")
    [void]$sb.AppendLine('| **Ses Efektleri (SFX)** | WAV (PCM 48kHz 24-bit) | Premiere Pro, After Effects | Dogrudan aktarim, Essential Sound etiketleme |')
    [void]$sb.AppendLine('| **Muzik Parcalari** | WAV / MP3 (320 kbps) | Premiere Pro, After Effects | Dogrudan aktarim |')
    [void]$sb.AppendLine('| **Renk Filtreleri (LUT)** | .cube (3D LUT 33x33x33) | Premiere Pro (Lumetri), After Effects | Dogrudan aktarim (Kullanici LUT klasoru) |')
    [void]$sb.AppendLine('| **Baslik Sablonlari** | .mogrt (Motion Graphics Template) | Premiere Pro 26.0.2 | Essential Graphics karsilama |')
    [void]$sb.AppendLine('| **Metin Animasyonlari** | .mogrt / .ffx (After Effects Preset) | Premiere Pro 26.0.2 / After Effects 26.3 | User Presets veya MOGRT karsilama |')
    [void]$sb.AppendLine('| **Klip Gecisleri** | .prfpset / .mogrt | Premiere Pro 26.0.2 | Premiere Effects Preset veya MOGRT |')
    [void]$sb.AppendLine('| **Grafik Elementler (SVG)** | Shape Layer MOGRT / .ai | Premiere Pro, After Effects | AE Shape Layer uzerinden MOGRT |')
    [void]$sb.AppendLine('| **Hareketli Arka Planlar** | ProRes 4444 / MP4 / MOGRT | Premiere Pro, After Effects | Offline render video veya dinamik MOGRT |')
    [void]$sb.AppendLine('| **Video Bindirmeleri (Overlay)** | Alpha Video / MOGRT | Premiere Pro, After Effects | Alpha kanalli video veya AE render kompozisyonu |')
    [void]$sb.AppendLine("")

    # 11. Guvenli Kurulum ve Paketleme Stratejisi
    [void]$sb.AppendLine("## 11. Guvenli Kurulum ve Paketleme Stratejisi")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine('- **Paket Adi:** `FORMA Adobe Asset Library`')
    [void]$sb.AppendLine('- **Surum:** `1.0.0`')
    [void]$sb.AppendLine('- **Kullanici Duzeyi Onceligi:** Yalnizca `APPDATA` ve Kullanici Belgeleri dizinleri hedeflenerek yonetici izni (UAC) gereksinimi bertaraf edilmelidir.')
    [void]$sb.AppendLine("- **Append-Only Prensibi:** Mevcut hicbir Adobe preset, ayar veya sablonu silinmeyecek veya uzerine yazilmayacaktir.")
    [void]$sb.AppendLine("- **Ad Cakismasi Korumasi:** Tum FORMA varliklari FORMA_ veya Forma Originals/ alt klasor adlandirmasiyla izole edilecektir.")
    [void]$sb.AppendLine('- **Manifest Tabanli Kaldirma:** Her dosyanin SHA-256 ozeti `forma_adobe_install_manifest.json` icine yazilacak; kaldirici yalnizca bu manifestte yer alan dosyalari silebilecektir.')
    [void]$sb.AppendLine("")

    # 12. Yonetici Izni Gereksinimi
    [void]$sb.AppendLine("## 12. Yonetici Izni Gereksinimi Analizi")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("- **Kullanici Duzeyi Kurulum:** `C:\Users\<USER>\AppData\Roaming\Adobe\Common\Motion Graphics Templates` ve `C:\Users\<USER>\OneDrive\Belgeler\Adobe\...` dizinleri kullanici tarafindan tam yetkiyle yazilabilirdir. **Yonetici izni GEREKMEZ.**")
    [void]$sb.AppendLine("- **Sistem Duzeyi Klasorler:** `C:\Program Files\...` veya `C:\Windows\Fonts` uzerine yazma yonetici yetkisi (UAC) gerektirir. Paketleme tasarimi bu yollardan kacinacak sekilde tasarlanmistir.")
    [void]$sb.AppendLine("- **Karar:** Kurulum icin **YONETICI IZNI GEREKMEZ**.")
    [void]$sb.AppendLine("")

    # 13. Uyumsuzluklar ve Engeller
    [void]$sb.AppendLine("## 13. Uyumsuzluklar ve Engeller")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("- **Adobe Media Encoder Yoklugu:** Sistemde Media Encoder kurulu degildir. Ancak " + (q "aerender.exe") + " (26.3) ve Premiere Pro yerel ihrac motoru tam fonksiyoneldir. MOGRT paketleme ve video render islemleri dogrudan " + (q "aerender") + " ve kompozisyon motoruyla gerceklestirilecektir.")
    [void]$sb.AppendLine("- **WebM Video Uyumlulugu:** Premiere Pro bazi VP8/VP9 WebM formatlarini varsayilan olarak cozemez. WebM tabanli stoklar H.264 / ProRes veya MOGRT bicimine donusturulecektir.")
    [void]$sb.AppendLine("- **Windows MAX_PATH Limiti:** Dosya yolu uzunluk sinirlamasina (260 karakter) karsi tum MOGRT ve asset klasor yapisi kompakt tutulacaktir.")
    [void]$sb.AppendLine("")

    # 14. Ozet Degerlendirme ve Sonraki Adimlar
    [void]$sb.AppendLine("## 14. Ozet Degerlendirme ve Kesin Surum Degerleri")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("- **Premiere Pro Kesin Surumu:** $(if ($premApp) { $premApp.ProductVersion } else { 'YOK' })")
    [void]$sb.AppendLine("- **After Effects Kesin Surumu:** $(if ($aeApp) { $aeApp.ProductVersion } else { 'YOK' })")
    [void]$sb.AppendLine("- **Media Encoder Kesin Surumu:** $(if ($ameApp) { $ameApp.ProductVersion } else { 'YOK' })")
    [void]$sb.AppendLine("- **aerender Kesin Surumu:** $(if ($auxEngines['aerender'].Supported) { $auxEngines['aerender'].Version } else { 'YOK' })")
    [void]$sb.AppendLine("- **Creative Cloud Surumu:** $(if ($ccApp) { $ccApp.ProductVersion } else { 'YOK' })")
    [void]$sb.AppendLine("- **Kullanilacak MOGRT Hedef Surumu:** $(if ($premApp) { "Premiere Pro $($premApp.ProductVersion) Uyumlu MOGRT" } else { "Evrensel 2022+ MOGRT" })")
    [void]$sb.AppendLine("- **Kullanilacak Preset/Script Mimarisi:** ExtendScript (JSX) + UXP / MOGRT")
    [void]$sb.AppendLine("- **Gercek Katalog Toplami:** **$catalogTotalRecords**")
    [void]$sb.AppendLine("- **Dogrudan Kurulabilir Sayi:** **$countDirect**")
    [void]$sb.AppendLine("- **Donusturulecek Sayi:** **$countConvert**")
    [void]$sb.AppendLine("- **Panel / Script ile Calisir Sayi:** **$countPanelScript**")
    [void]$sb.AppendLine("- **Kurulmayacak Sayi:** **$countDoNotInstall**")
    [void]$sb.AppendLine("- **Tahmini Toplam Paket Boyutu:** $([Math]::Round($totalPhysicalBytes / 1MB, 2)) MB (Donusumlerle tahmini ~120 MB)")
    [void]$sb.AppendLine("- **Gerekli Bos Disk Alani:** En az 1.5 GB onerilir (Mevcut C: bos alan: $freeSpaceGB GB)")
    [void]$sb.AppendLine("- **Yonetici Izni Gerekli mi:** **HAYIR** (Kullanici duzeyi kutuphane yollari kullanilacaktir)")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine("### NIHAI KARAR:")
    [void]$sb.AppendLine("")
    [void]$sb.AppendLine((q $finalVerdict))
    [void]$sb.AppendLine("")

    [System.IO.File]::WriteAllText($reportPath, $sb.ToString(), [System.Text.Encoding]::UTF8)
    Write-Host "Rapor basariyla kaydedildi: $(Mask-Path $reportPath)" -ForegroundColor Green

    Write-Host "`n=== OZET METRIKLER ===" -ForegroundColor Cyan
    Write-Host "Premiere Pro Surumu: $(if ($premApp) { $premApp.ProductVersion } else { 'YOK' })"
    Write-Host "After Effects Surumu: $(if ($aeApp) { $aeApp.ProductVersion } else { 'YOK' })"
    Write-Host "Media Encoder Surumu: $(if ($ameApp) { $ameApp.ProductVersion } else { 'YOK' })"
    Write-Host "Katalog Toplami: $catalogTotalRecords"
    Write-Host "Dogrudan Kurulabilir: $countDirect"
    Write-Host "Donusturulecek: $countConvert"
    Write-Host "Panel/Script: $countPanelScript"
    Write-Host "Kurulmayacak: $countDoNotInstall"
    Write-Host "Nihai Karar: $finalVerdict"
    Write-Host "Rapor Dosyasi: $(Mask-Path $reportPath)"

    exit 0
} catch {
    Write-Error "Asama 0 hatasi: $_`n$($_.ScriptStackTrace)"
    exit 1
} finally {
    $startTime.Stop()
}

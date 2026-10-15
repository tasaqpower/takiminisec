$com = $null
try {
    $com = New-Object -ComObject "AfterEffects.Application"
    Write-Host "COM Object created: $($com.GetType().FullName)"
    Write-Host "AE Version via COM: $($com.Version)"
} catch {
    Write-Host "COM creation failed: $($_.Exception.Message)"
} finally {
    if ($com) {
        [System.Runtime.Interopservices.Marshal]::ReleaseComObject($com) | Out-Null
    }
}

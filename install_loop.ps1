Set-Location -Path "c:/Users/Benjamin/shimaya rutas/app"
npm.cmd config set fetch-retries 10
npm.cmd config set maxsockets 1
npm.cmd config set strict-ssl false
$retryCount = 0
$success = $false
while (-not $success -and $retryCount -lt 15) {
    Write-Host "--- Attempt $($retryCount + 1) ---"
    npm.cmd install --legacy-peer-deps --no-audit --no-fund
    if ($LASTEXITCODE -eq 0) {
        $success = $true
    } else {
        $retryCount++
        Start-Sleep -Seconds 2
    }
}
if ($success) {
    Write-Host "DONE_SUCCESS"
} else {
    Write-Host "DONE_FAILED"
}

# airgap_rehearsal.ps1
# This script must be run as Administrator. It will automatically prompt for elevation if needed.

if (-not ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    Write-Warning "Elevation required. Requesting Administrator privileges..."
    Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    exit
}

cd $PSScriptRoot\..

Write-Host "=======================================================" -ForegroundColor Cyan
Write-Host " DRAVEXIS - AIR-GAP REHEARSAL (ELEVATED)" -ForegroundColor Cyan
Write-Host "=======================================================" -ForegroundColor Cyan

Write-Host "`n1. Discovering Network Adapters..." -ForegroundColor Yellow
Get-NetAdapter | Format-Table Name, InterfaceDescription, Status -AutoSize

$wifiAdapter = Get-NetAdapter -Name "Wi-Fi" -ErrorAction SilentlyContinue
if (-not $wifiAdapter) {
    Write-Host "ERROR: 'Wi-Fi' adapter not found. Cannot proceed." -ForegroundColor Red
    pause
    exit
}

if ($wifiAdapter.Status -ne "Up") {
    Write-Host "WARNING: 'Wi-Fi' is not currently 'Up'. Proceeding anyway for demonstration." -ForegroundColor Yellow
}

Write-Host "`n2. Safety Check:" -ForegroundColor Yellow
Write-Host "- Backend must be running at http://127.0.0.1:8000"
Write-Host "- No active downloads or git pushes in progress"

$confirmation = Read-Host "Type 'yes' to disable Wi-Fi and run the air-gap query"
if ($confirmation -ne 'yes') {
    Write-Host "Aborted." -ForegroundColor Red
    pause
    exit
}

Write-Host "`n3. Disabling Wi-Fi adapter..." -ForegroundColor Yellow
Disable-NetAdapter -Name "Wi-Fi" -Confirm:$false
Start-Sleep -Seconds 3

$status = (Get-NetAdapter -Name "Wi-Fi").Status
Write-Host "Wi-Fi Status is now: $status" -ForegroundColor Cyan

if ($status -eq "Disabled") {
    Write-Host "`n4. Running Local Air-Gap Query (Demo 3)..." -ForegroundColor Yellow
    $body = '{"query": "Calculate remaining corrosion life for a vessel at 0.45 mm/yr corrosion rate with 8.0 mm measured wall and 6.0 mm minimum wall thickness", "session_id": "airgap-rehearsal-002"}'
    
    $t0 = Get-Date
    try {
        $resp = Invoke-RestMethod -Uri "http://127.0.0.1:8000/agent/run" -Method POST -ContentType "application/json" -Body $body -TimeoutSec 120
        $elapsed = [int]((Get-Date) - $t0).TotalMilliseconds
        Write-Host "Query SUCCESS! Elapsed: ${elapsed}ms | Status: $($resp.status) | Intent: $($resp.intent)" -ForegroundColor Green
        
        $evidence = @{
            timestamp = (Get-Date).ToString("o")
            adapter_status = "Disabled"
            query_latency_ms = $elapsed
            status = $resp.status
            intent = $resp.intent
            evidence_count = $resp.retrieved_evidence.Count
        }
        $evidence | ConvertTo-Json | Set-Content -Path "data\airgap_rehearsal_result.json"
        Write-Host "Result saved to data\airgap_rehearsal_result.json" -ForegroundColor Green
    } catch {
        Write-Host "Query FAILED: $_" -ForegroundColor Red
    }
} else {
    Write-Host "Failed to disable Wi-Fi adapter." -ForegroundColor Red
}

Write-Host "`n5. Re-enabling Wi-Fi adapter..." -ForegroundColor Yellow
Enable-NetAdapter -Name "Wi-Fi" -Confirm:$false
Start-Sleep -Seconds 3
Write-Host "Wi-Fi Status is now: $((Get-NetAdapter -Name 'Wi-Fi').Status)" -ForegroundColor Cyan

Write-Host "`nAir-gap rehearsal sequence complete." -ForegroundColor Green
pause

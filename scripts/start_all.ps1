<#
.SYNOPSIS
    One-shot Phase 1 startup: checks prerequisites, starts llama-server,
    starts FastAPI gateway, and displays status.

.NOTES
    Prerequisites must be met:
    - bin\llama-server.exe must exist (run download_llama_server.ps1)
    - models\*.gguf must exist (run download_model.ps1)
    - pip install -r requirements.txt must have been run

    Run from project root:
        .\scripts\start_all.ps1
#>

$ErrorActionPreference = "Continue"
$ProjectRoot = Split-Path $PSScriptRoot -Parent

Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " MRPL Sovereign AI Workbench -- Phase 1 Startup" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""

# --- Check prerequisites ---
$ok = $true

$serverExe = Join-Path $ProjectRoot "bin\llama-server.exe"
if (-not (Test-Path $serverExe)) {
    Write-Host "[MISSING] bin\llama-server.exe -- run: .\scripts\download_llama_server.ps1" -ForegroundColor Red
    $ok = $false
} else { Write-Host "[OK] bin\llama-server.exe" -ForegroundColor Green }

$models = Get-ChildItem -Path (Join-Path $ProjectRoot "models") -Filter "*.gguf" -ErrorAction SilentlyContinue
if (-not $models) {
    Write-Host "[MISSING] models\*.gguf -- run: .\scripts\download_model.ps1" -ForegroundColor Red
    $ok = $false
} else { Write-Host "[OK] Model: $($models[0].Name)" -ForegroundColor Green }

if (-not $ok) {
    Write-Host ""
    Write-Host "Prerequisites missing. Resolve above issues first." -ForegroundColor Red
    exit 1
}

# --- Start llama-server in background ---
Write-Host ""
Write-Host "[1/2] Starting llama-server (CUDA 12, port 8080)..." -ForegroundColor Yellow
$modelFile = $models[0].FullName
$llama = Start-Process -FilePath $serverExe `
    -ArgumentList "--model `"$modelFile`" --host 127.0.0.1 --port 8080 --ctx-size 4096 --n-gpu-layers 99 --threads 8 --log-disable" `
    -PassThru -WindowStyle Minimized

Write-Host "   PID: $($llama.Id) | Model: $($models[0].Name)" -ForegroundColor Gray
Write-Host "   Waiting for model to load..." -ForegroundColor Gray

# Poll /health until ready (max 120s)
$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Seconds 2
    try {
        $r = Invoke-WebRequest -Uri "http://127.0.0.1:8080/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
        if ($r.StatusCode -eq 200) { $ready = $true; break }
    } catch {}
    Write-Host "   ." -NoNewline -ForegroundColor DarkGray
}

if ($ready) {
    Write-Host ""
    Write-Host "[OK] llama-server ready at http://127.0.0.1:8080" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "[WARN] llama-server did not respond within 120s. Check VRAM." -ForegroundColor Yellow
    Write-Host "       nvidia-smi to check VRAM usage" -ForegroundColor Gray
}

# --- Start FastAPI gateway ---
Write-Host ""
Write-Host "[2/2] Starting FastAPI gateway (port 8000)..." -ForegroundColor Yellow
$pyEnv = @{ "PYTHONUTF8" = "1" }
$gateway = Start-Process -FilePath "python" `
    -ArgumentList "-m uvicorn src.main:app --host 127.0.0.1 --port 8000" `
    -WorkingDirectory $ProjectRoot `
    -PassThru -WindowStyle Minimized `
    -Environment $pyEnv

Start-Sleep -Seconds 3
try {
    $r = Invoke-WebRequest -Uri "http://127.0.0.1:8000/" -UseBasicParsing -TimeoutSec 5
    Write-Host "[OK] FastAPI gateway ready at http://127.0.0.1:8000" -ForegroundColor Green
    Write-Host "     Docs: http://127.0.0.1:8000/docs" -ForegroundColor Gray
} catch {
    Write-Host "[WARN] FastAPI gateway may still be starting..." -ForegroundColor Yellow
}

# --- Final status ---
Write-Host ""
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " SYSTEM READY" -ForegroundColor Green
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  llama-server : http://127.0.0.1:8080/health" -ForegroundColor White
Write-Host "  FastAPI      : http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "  Status check : http://127.0.0.1:8000/network-status" -ForegroundColor White
Write-Host ""
Write-Host "Test the RAG pipeline:" -ForegroundColor Yellow
Write-Host "  python scripts\ingest_seed.py   # (if not already done)" -ForegroundColor Gray
Write-Host "  python scripts\test_rag.py" -ForegroundColor Gray
Write-Host ""
Write-Host "Press Ctrl+C to stop (will NOT stop background processes)." -ForegroundColor DarkGray
Write-Host "To kill: Stop-Process -Id $($llama.Id) (llama); Stop-Process -Id $($gateway.Id) (gateway)" -ForegroundColor DarkGray
Write-Host ""

# Keep script alive
Wait-Process -Id $llama.Id

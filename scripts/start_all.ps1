<#
.SYNOPSIS
    Dravexis backend startup — starts ONLY FastAPI gateway.
    llama-server is managed on-demand by src/model_manager.py (hot-swap
    architecture). Starting a persistent llama-server here would:
      (a) block this script synchronously while the model loads (~3-15s),
      (b) waste 1-2 GB VRAM on idle, and
      (c) conflict with model_manager's process-restart hot-swap logic.

.NOTES
    Prerequisites:
    - pip install -r requirements.txt must have been run.
    - models\*.gguf must exist for agent queries.
    - bin\llama-server.exe must exist (used by model_manager on-demand).

    Run from project root:
        .\scripts\start_all.ps1
#>

$ErrorActionPreference = "Continue"
$ProjectRoot = Split-Path $PSScriptRoot -Parent

Write-Host "" 
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host " Dravexis -- On-Prem Agentic Control Layer" -ForegroundColor Cyan
Write-Host " Backend Gateway Startup" -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host " Architecture: llama-server is loaded ON-DEMAND per query" -ForegroundColor DarkYellow
Write-Host "   by src/model_manager.py. This script starts FastAPI only." -ForegroundColor DarkYellow
Write-Host ""

# --- Check prerequisites ---
$ok = $true

$serverExe = Join-Path $ProjectRoot "bin\llama-server.exe"
if (-not (Test-Path $serverExe)) {
    Write-Host "[MISSING] bin\llama-server.exe -- run: .\scripts\download_llama_server.ps1" -ForegroundColor Red
    $ok = $false
} else { Write-Host "[OK] bin\llama-server.exe (used on-demand by model_manager)" -ForegroundColor Green }

$models = Get-ChildItem -Path (Join-Path $ProjectRoot "models") -Filter "*.gguf" -ErrorAction SilentlyContinue
if (-not $models) {
    Write-Host "[WARN] models\*.gguf not found -- agent queries requiring inference will fail" -ForegroundColor Yellow
    Write-Host "       Run: .\scripts\download_model.ps1" -ForegroundColor Gray
} else {
    Write-Host "[OK] $($models.Count) GGUF model(s) found in models\" -ForegroundColor Green
    foreach ($m in $models) {
        Write-Host "     - $($m.Name)" -ForegroundColor Gray
    }
}

# --- Check if FastAPI is already running ---
try {
    $check = Invoke-WebRequest -Uri "http://127.0.0.1:8000/" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    Write-Host "[OK] FastAPI already running at http://127.0.0.1:8000 -- nothing to do." -ForegroundColor Green
    Write-Host "     Docs: http://127.0.0.1:8000/docs" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Press Ctrl+C to exit this status window." -ForegroundColor DarkGray
    while ($true) { Start-Sleep -Seconds 60 }
    exit 0
} catch { }

# --- Start FastAPI gateway directly (not hidden) ---
Write-Host ""
Write-Host "[1/1] Starting FastAPI gateway on port 8000..." -ForegroundColor Yellow
Write-Host "      llama-server will be started automatically by model_manager" -ForegroundColor Gray
Write-Host "      when the first agent query arrives." -ForegroundColor Gray
Write-Host ""

# Set UTF-8 to prevent charmap errors on Windows
$env:PYTHONUTF8 = "1"

Set-Location $ProjectRoot

# Run uvicorn in the FOREGROUND so this terminal shows live logs
# (The launcher already spawned this in a separate titled cmd window)
python -m uvicorn src.main:app --host 127.0.0.1 --port 8000

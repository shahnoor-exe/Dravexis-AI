<#
.SYNOPSIS
    Launches llama-server.exe with the GGUF model from the models/ directory.
    Bound to 127.0.0.1:8080 (localhost only - air-gapped deployment).

.DESCRIPTION
    Architecture Decision (logged in PROJECT_BRAIN.md):
        Port: 8080 (localhost only)
        GPU layers: 99 (load as many layers as fit into VRAM; llama-server auto-limits)
        Context: 4096 tokens
        Model: DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M (~1.1 GB VRAM)

.NOTES
    Run from the project root:
        .\scripts\start_llama_server.ps1

    Keep this window open - the gateway (src/main.py) calls this server.
    To check health: curl http://127.0.0.1:8080/health
#>

param(
    [string]$BindHost = "127.0.0.1",
    [int]$Port = 8080,
    [int]$ContextSize = 4096,
    [int]$GpuLayers = 99,       # 99 = try to fit all layers on GPU; auto-limits to what fits
    [int]$Threads = 8,
    [string]$ModelFile = ""     # If empty, auto-detect from models/ directory
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$BinDir = Join-Path $ProjectRoot "bin"
$ModelsDir = Join-Path $ProjectRoot "models"
$LogFile = Join-Path $ProjectRoot "data\llama_server.log"

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host " MRPL Sovereign AI - llama-server Start" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# --- Locate llama-server.exe ---
$serverExe = Join-Path $BinDir "llama-server.exe"
if (-not (Test-Path $serverExe)) {
    # Try PATH
    $cmd = Get-Command "llama-server" -ErrorAction SilentlyContinue
    if ($cmd) { $serverExe = $cmd.Source }
}
if (-not $serverExe -or -not (Test-Path $serverExe)) {
    Write-Host "[X] llama-server.exe not found." -ForegroundColor Red
    Write-Host "   Run: .\scripts\download_llama_server.ps1" -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] llama-server binary: $serverExe" -ForegroundColor Green

# --- Locate GGUF model ---
if (-not $ModelFile) {
    $ggufFiles = Get-ChildItem -Path $ModelsDir -Filter "*.gguf" -ErrorAction SilentlyContinue
    if (-not $ggufFiles) {
        Write-Host ""
        Write-Host "[X] No .gguf model files found in: $ModelsDir" -ForegroundColor Red
        Write-Host ""
        Write-Host "Download the model (DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf):" -ForegroundColor Yellow
        Write-Host "  Option 1 (huggingface-cli):" -ForegroundColor Gray
        Write-Host "    pip install huggingface_hub" -ForegroundColor Gray
        Write-Host "    huggingface-cli download bartowski/DeepSeek-R1-Distill-Qwen-1.5B-GGUF DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf --local-dir .\models" -ForegroundColor Gray
        Write-Host "  Option 2 (browser):" -ForegroundColor Gray
        Write-Host "    https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-1.5B-GGUF" -ForegroundColor Gray
        Write-Host "    Save to: $ModelsDir" -ForegroundColor Gray
        exit 1
    }
    # Prefer Q4_K_M variant if multiple GGUFs present
    $preferred = $ggufFiles | Where-Object { $_.Name -match "Q4_K_M" } | Select-Object -First 1
    $ModelFile = if ($preferred) { $preferred.FullName } else { $ggufFiles[0].FullName }
}

if (-not (Test-Path $ModelFile)) {
    Write-Host "[X] Model file not found: $ModelFile" -ForegroundColor Red
    exit 1
}

$modelName = Split-Path $ModelFile -Leaf
Write-Host "[OK] Model: $modelName" -ForegroundColor Green
Write-Host "   Context: $ContextSize tokens | GPU layers: $GpuLayers | Threads: $Threads"
Write-Host "   Binding: http://${BindHost}:${Port}"
Write-Host "   Log: $LogFile"
Write-Host ""
Write-Host "[!] VRAM NOTE: RTX 3050 Laptop = 4 GB. Q4_K_M 1.5B ~ 1.1 GB -> should fit easily." -ForegroundColor Yellow
Write-Host "   Monitor VRAM with: nvidia-smi (in another terminal)" -ForegroundColor Gray
Write-Host ""

# --- Launch llama-server ---
$args = @(
    "--model", $ModelFile,
    "--host", $BindHost,
    "--port", $Port,
    "--ctx-size", $ContextSize,
    "--n-gpu-layers", $GpuLayers,
    "--threads", $Threads,
    "--log-disable"    # cleaner stdout; remove if you want verbose model logs
)

Write-Host "Launching..." -ForegroundColor Cyan
$joinedArgs = $args -join " "
Write-Host "Command: $serverExe $joinedArgs" -ForegroundColor Gray
Write-Host ""
Write-Host "-----------------------------------------------" -ForegroundColor DarkGray
Write-Host "Press Ctrl+C to stop llama-server" -ForegroundColor DarkGray
Write-Host "-----------------------------------------------" -ForegroundColor DarkGray
Write-Host ""

# Tee output to log file
& $serverExe @args 2>&1 | Tee-Object -FilePath $LogFile

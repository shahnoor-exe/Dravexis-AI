<#
.SYNOPSIS
    Downloads DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf from HuggingFace.

.NOTES
    Prerequisites:
    1. Must run `hf auth login` first in this terminal.
    2. Requires a free HuggingFace account.

    Run from project root:
        .\scripts\download_model.ps1
#>

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$ModelsDir = Join-Path $ProjectRoot "models"

# Add Python Scripts to PATH (where hf / huggingface-cli live)
$pyScripts = "$env:LOCALAPPDATA\Packages\PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0\LocalCache\local-packages\Python313\Scripts"
if (Test-Path $pyScripts) {
    $env:PATH = "$env:PATH;$pyScripts"
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host " DeepSeek-R1-Distill-Qwen-1.5B GGUF Downloader" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Step 1: Logging in to HuggingFace..." -ForegroundColor Yellow
Write-Host "(If already logged in, this will show your username)" -ForegroundColor Gray
Write-Host ""

hf auth whoami 2>&1 | ForEach-Object {
    if ($_ -match "logged in") { Write-Host "Already logged in: $_" -ForegroundColor Green }
    elseif ($_ -match "not logged") {
        Write-Host "Not logged in. Running hf auth login..." -ForegroundColor Yellow
        hf auth login
    } else { Write-Host $_ }
}

Write-Host ""
Write-Host "Step 2: Downloading model (~2.1 GB)..." -ForegroundColor Yellow
Write-Host "Model: DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf" -ForegroundColor Gray
Write-Host "Destination: $ModelsDir" -ForegroundColor Gray
Write-Host ""

python -c @"
from huggingface_hub import hf_hub_download
import os

path = hf_hub_download(
    repo_id='bartowski/DeepSeek-R1-Distill-Qwen-1.5B-GGUF',
    filename='DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf',
    local_dir=r'$ModelsDir',
)
print('[OK] Downloaded to:', path)
size_gb = os.path.getsize(path) / (1024**3)
print(f'[OK] File size: {size_gb:.2f} GB')
"@

Write-Host ""
Write-Host "Next step: Launch llama-server" -ForegroundColor Cyan
Write-Host "  .\scripts\start_llama_server.ps1" -ForegroundColor Gray

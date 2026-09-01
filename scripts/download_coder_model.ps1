<#
.SYNOPSIS
    Downloads Qwen2.5-Coder-1.5B-Instruct Q4_K_M GGUF for code generation.

.NOTES
    Prerequisites:
    1. Must run `hf auth login` first.
    2. Estimated size: ~0.9 GB.
    3. VRAM at load: ~0.9 GB - fits easily within 4 GB budget.

    Run from project root:
        .\scripts\download_coder_model.ps1
#>

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$ModelsDir = Join-Path $ProjectRoot "models"

$pyScripts = "$env:LOCALAPPDATA\Packages\PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0\LocalCache\local-packages\Python313\Scripts"
if (Test-Path $pyScripts) { $env:PATH = "$env:PATH;$pyScripts" }

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host " Qwen2.5-Coder-1.5B-Instruct Q4_K_M Download" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

hf auth whoami 2>&1 | ForEach-Object {
    if ($_ -match "not logged") {
        Write-Host "Not logged in. Run: hf auth login" -ForegroundColor Red
        exit 1
    }
}

$target = Join-Path $ModelsDir "Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf"

if (Test-Path $target) {
    $sz = (Get-Item $target).Length / 1GB
    Write-Host "Already exists - skipping download." -ForegroundColor Green
} else {
    Write-Host "Downloading Qwen2.5-Coder-1.5B-Instruct Q4_K_M (~0.9 GB)..." -ForegroundColor Yellow
    $pyScript = "from huggingface_hub import hf_hub_download`nimport os`npath = hf_hub_download(repo_id='bartowski/Qwen2.5-Coder-1.5B-Instruct-GGUF', filename='Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf', local_dir=r'$ModelsDir')`nprint('[OK] Downloaded to:', path)"
    python -c $pyScript
}

Write-Host ""
Write-Host "Coder model download complete." -ForegroundColor Green
Write-Host "Run measure_model_swap.py after all models are downloaded." -ForegroundColor Cyan

<#
.SYNOPSIS
    Downloads Qwen2.5-VL-3B-Instruct Q4_K_M GGUF + mmproj-Q8_0 for vision capability.

.NOTES
    Repository: ggml-org/Qwen2.5-VL-3B-Instruct-GGUF (corrected from invalid bartowski path)
    Main GGUF : Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf  (~1.93 GB)
    mmproj    : mmproj-Qwen2.5-VL-3B-Instruct-Q8_0.gguf (~0.84 GB)
    Combined  : ~2.77 GB -- fits RTX 3050 4 GB VRAM with ~1.2 GB headroom.
    Fallback  : mmproj-Qwen2.5-VL-3B-Instruct-f16.gguf (~1.34 GB) if Q8_0 mmproj has issues.

    Run from project root:
        .\scripts\download_vision_model.ps1
#>

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$ModelsDir = Join-Path $ProjectRoot "models"

$pyScripts = "$env:LOCALAPPDATA\Packages\PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0\LocalCache\local-packages\Python313\Scripts"
if (Test-Path $pyScripts) { $env:PATH = "$env:PATH;$pyScripts" }

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host " Qwen2.5-VL-3B-Instruct Vision GGUF Download" -ForegroundColor Cyan
Write-Host " Repo: ggml-org/Qwen2.5-VL-3B-Instruct-GGUF" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# Check HF auth
$authOut = hf auth whoami 2>&1
if ($authOut -match "error|not logged in|Login") {
    Write-Host "[X] HF auth failed. Run: hf auth login" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] HF auth: $authOut" -ForegroundColor Green

Write-Host ""
Write-Host "Step 1: Downloading main GGUF (Q4_K_M, ~1.93 GB)..." -ForegroundColor Yellow

$ggufTarget = Join-Path $ModelsDir "Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf"
if (Test-Path $ggufTarget) {
    $sz = [math]::Round((Get-Item $ggufTarget).Length / 1GB, 2)
    Write-Host "[SKIP] Already exists ($sz GB): $ggufTarget" -ForegroundColor Green
} else {
    Write-Host "Downloading to: $ggufTarget" -ForegroundColor Gray
    $pyScript1 = "from huggingface_hub import hf_hub_download`nimport os`npath = hf_hub_download(repo_id='ggml-org/Qwen2.5-VL-3B-Instruct-GGUF', filename='Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf', local_dir=r'$ModelsDir')`nprint('[OK] Downloaded to:', path)`nprint('[OK] Size:', round(os.path.getsize(path)/1e9,2), 'GB')"
    python -c $pyScript1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[X] Main GGUF download failed. Check HF auth and repo availability." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Step 2: Downloading mmproj-Q8_0 (~0.84 GB)..." -ForegroundColor Yellow

$mmprojTarget = Join-Path $ModelsDir "mmproj-Qwen2.5-VL-3B-Instruct-Q8_0.gguf"
if (Test-Path $mmprojTarget) {
    $sz = [math]::Round((Get-Item $mmprojTarget).Length / 1GB, 2)
    Write-Host "[SKIP] Already exists ($sz GB): $mmprojTarget" -ForegroundColor Green
} else {
    Write-Host "Downloading to: $mmprojTarget" -ForegroundColor Gray
    $pyScript2 = "from huggingface_hub import hf_hub_download`nimport os`npath = hf_hub_download(repo_id='ggml-org/Qwen2.5-VL-3B-Instruct-GGUF', filename='mmproj-Qwen2.5-VL-3B-Instruct-Q8_0.gguf', local_dir=r'$ModelsDir')`nprint('[OK] mmproj downloaded to:', path)`nprint('[OK] Size:', round(os.path.getsize(path)/1e9,2), 'GB')"
    python -c $pyScript2
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[X] mmproj download failed. Check HF auth and repo availability." -ForegroundColor Red
        exit 1
    }
}

Write-Host ""
Write-Host "Step 3: Verifying both files..." -ForegroundColor Yellow
$mainOk = (Test-Path $ggufTarget) -and ((Get-Item $ggufTarget).Length -gt 0)
$mmprojOk = (Test-Path $mmprojTarget) -and ((Get-Item $mmprojTarget).Length -gt 0)
if (-not $mainOk -or -not $mmprojOk) {
    Write-Host "[X] One or both files missing or zero-byte after download!" -ForegroundColor Red
    exit 1
}
Write-Host "[OK] Main GGUF : $ggufTarget ($([math]::Round((Get-Item $ggufTarget).Length/1GB,2)) GB)" -ForegroundColor Green
Write-Host "[OK] mmproj    : $mmprojTarget ($([math]::Round((Get-Item $mmprojTarget).Length/1GB,2)) GB)" -ForegroundColor Green

Write-Host ""
Write-Host "Step 4: Running vision probe..." -ForegroundColor Yellow
python scripts\probe_vision.py

Write-Host ""
Write-Host "Vision model download complete." -ForegroundColor Green
Write-Host "Check data\vision_probe_result.json for VISION_AVAILABLE or VISION_UNAVAILABLE." -ForegroundColor Yellow

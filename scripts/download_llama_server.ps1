<#
.SYNOPSIS
    Downloads the pre-built llama-server.exe (CUDA 12) binary from llama.cpp GitHub releases
    and places it in the bin/ directory.

.DESCRIPTION
    This script downloads the llama.cpp Windows CUDA 12 release binary.
    No CUDA Toolkit installation required — the binary is self-contained.

.NOTES
    Run from the project root:
        .\scripts\download_llama_server.ps1

    After download, run:
        .\scripts\start_llama_server.ps1
#>

param(
    [string]$ReleaseTag = "latest"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path $PSScriptRoot -Parent
$BinDir = Join-Path $ProjectRoot "bin"

if (-not (Test-Path $BinDir)) {
    New-Item -ItemType Directory -Path $BinDir | Out-Null
}

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host " llama.cpp Binary Downloader (Windows CUDA 12)" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# --- Determine latest release tag ---
Write-Host "Fetching latest llama.cpp release info from GitHub..." -ForegroundColor Yellow
try {
    $apiUrl = "https://api.github.com/repos/ggml-org/llama.cpp/releases/latest"
    $headers = @{ "User-Agent" = "MRPL-SIH-2026" }
    $release = Invoke-RestMethod -Uri $apiUrl -Headers $headers
    $tag = $release.tag_name
    Write-Host "Latest release: $tag" -ForegroundColor Green
} catch {
    Write-Host "WARNING: Could not fetch release info. Using fallback tag b5480." -ForegroundColor Yellow
    $tag = "b5480"
}

# --- Construct download URL ---
# Pattern: llama-{tag}-bin-win-cuda12-cu12.x.x-x64.zip
# We search the release assets for the CUDA 12 Windows x64 zip
Write-Host "Looking for CUDA 12 Windows x64 asset..." -ForegroundColor Yellow

$cudaAsset = $null
try {
    foreach ($asset in $release.assets) {
        # Current naming: llama-b10734-bin-win-cuda-12.4-x64.zip
        if ($asset.name -match "bin-win-cuda-12" -and $asset.name -match "x64.*\.zip") {
            $cudaAsset = $asset
            break
        }
    }
} catch {}

if (-not $cudaAsset) {
    # Known good release with CUDA 12.4 support
    $fallbackUrl = "https://github.com/ggml-org/llama.cpp/releases/download/b10734/llama-b10734-bin-win-cuda-12.4-x64.zip"
    Write-Host ""
    Write-Host "Warning: Could not auto-detect asset URL. Using fallback:" -ForegroundColor Yellow
    Write-Host "   $fallbackUrl" -ForegroundColor Gray
    Write-Host ""
    Write-Host "If this URL is outdated, manually download from:" -ForegroundColor Yellow
    Write-Host "   https://github.com/ggml-org/llama.cpp/releases" -ForegroundColor Cyan
    Write-Host "   Look for: llama-*-bin-win-cuda-12.*-x64.zip" -ForegroundColor Cyan
    $downloadUrl = $fallbackUrl
    $zipName = "llama-b10734-win-cuda12.zip"
} else {
    $downloadUrl = $cudaAsset.browser_download_url
    $zipName = $cudaAsset.name
    Write-Host "Found asset: $zipName" -ForegroundColor Green
}

$zipPath = Join-Path $BinDir $zipName

# --- Download ---
Write-Host ""
Write-Host "Downloading to: $zipPath" -ForegroundColor Yellow
Write-Host "This may take a few minutes (~150 MB)..." -ForegroundColor Gray
$ProgressPreference = "SilentlyContinue"
Invoke-WebRequest -Uri $downloadUrl -OutFile $zipPath -UseBasicParsing
Write-Host "Download complete." -ForegroundColor Green

# --- Extract ---
Write-Host "Extracting..." -ForegroundColor Yellow
$extractDir = Join-Path $BinDir "llama_extracted"
if (Test-Path $extractDir) { Remove-Item $extractDir -Recurse -Force }
Expand-Archive -Path $zipPath -DestinationPath $extractDir -Force

# --- Locate llama-server.exe ---
$serverExe = Get-ChildItem -Path $extractDir -Recurse -Filter "llama-server.exe" | Select-Object -First 1
if (-not $serverExe) {
    # Older releases used "server.exe"
    $serverExe = Get-ChildItem -Path $extractDir -Recurse -Filter "server.exe" | Select-Object -First 1
}

if (-not $serverExe) {
    Write-Host ""
    Write-Host "❌ ERROR: Could not find llama-server.exe in the extracted archive." -ForegroundColor Red
    Write-Host "   Contents:" -ForegroundColor Red
    Get-ChildItem -Path $extractDir -Recurse | Select-Object Name | Format-Table
    exit 1
}

# Copy to bin/ root for convenience
$destExe = Join-Path $BinDir "llama-server.exe"
Copy-Item $serverExe.FullName $destExe -Force

# Copy CUDA DLLs alongside
$dllFiles = Get-ChildItem -Path $serverExe.DirectoryName -Filter "*.dll"
foreach ($dll in $dllFiles) {
    Copy-Item $dll.FullName $BinDir -Force
}

Write-Host ""
Write-Host "✅ llama-server.exe installed at: $destExe" -ForegroundColor Green
Write-Host ""
Write-Host "Next step: Download a GGUF model and run start_llama_server.ps1" -ForegroundColor Cyan
Write-Host ""
Write-Host "Recommended model (3B Q4_K_M, ~2.5 GB VRAM):" -ForegroundColor Cyan
Write-Host "  https://huggingface.co/bartowski/DeepSeek-R1-Distill-Qwen-3B-GGUF" -ForegroundColor Gray
Write-Host "  File: DeepSeek-R1-Distill-Qwen-3B-Q4_K_M.gguf" -ForegroundColor Gray
Write-Host "  Place in: $(Join-Path $ProjectRoot 'models\')" -ForegroundColor Gray

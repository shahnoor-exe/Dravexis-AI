<#
.SYNOPSIS
    Phase 4 automated preflight checks.
    Run from project root AFTER all 3 GGUFs are downloaded.
    Records results and writes to data/preflight_results.json.

.NOTES
    Run order:
    1. .\scripts\download_model.ps1
    2. .\scripts\download_vision_model.ps1
    3. .\scripts\download_coder_model.ps1
    4. .\scripts\run_preflight.ps1   <-- this script
    5. .\scripts\start_all.ps1
#>

$ErrorActionPreference = "Stop"
$Root = Split-Path $PSScriptRoot -Parent
$Models = Join-Path $Root "models"
$Results = @{}

Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " MRPL Workbench - Phase 4 Live-Model Preflight Check" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host ""

# -- STEP 1: Model file checks --
Write-Host "STEP 1: Checking GGUF files on disk..." -ForegroundColor Yellow

$expectedModels = @{
    "DeepSeek-R1-Distill-Qwen-1.5B-Q4_K_M.gguf" = 1.0
    "Qwen2.5-VL-3B-Instruct-Q4_K_M.gguf"        = 1.5
    "mmproj-Qwen2.5-VL-3B-Instruct-Q8_0.gguf"   = 0.3
    "Qwen2.5-Coder-1.5B-Instruct-Q4_K_M.gguf"   = 0.7
}

$allModelsPresent = $true
$modelStatus = @{}

foreach ($fname in $expectedModels.Keys) {
    $fpath = Join-Path $Models $fname
    if (Test-Path $fpath) {
        $sizeGb = [math]::Round((Get-Item $fpath).Length / 1GB, 2)
        $minGb = $expectedModels[$fname]
        if ($sizeGb -ge $minGb) {
            Write-Host "  [OK] $fname ($sizeGb GB)" -ForegroundColor Green
            $modelStatus[$fname] = "OK ($sizeGb GB)"
        } else {
            Write-Host "  [WARN] $fname ($sizeGb GB) - smaller than expected ($minGb GB min)" -ForegroundColor Yellow
            $modelStatus[$fname] = "SMALL ($sizeGb GB)"
            $allModelsPresent = $false
        }
    } else {
        Write-Host "  [MISSING] $fname" -ForegroundColor Red
        $modelStatus[$fname] = "MISSING"
        $allModelsPresent = $false
    }
}

$Results["step1_models"] = $modelStatus
$Results["all_models_present"] = $allModelsPresent

if (-not $allModelsPresent) {
    Write-Host ""
    Write-Host "BLOCKER: One or more GGUF files missing. Download before continuing." -ForegroundColor Red
    Write-Host "  .\scripts\download_model.ps1" -ForegroundColor Gray
    Write-Host "  .\scripts\download_vision_model.ps1" -ForegroundColor Gray
    Write-Host "  .\scripts\download_coder_model.ps1" -ForegroundColor Gray
}

# -- STEP 2: HF token --
Write-Host ""
Write-Host "STEP 2: Checking HuggingFace auth..." -ForegroundColor Yellow
$pyScripts = "$env:LOCALAPPDATA\Packages\PythonSoftwareFoundation.Python.3.13_qbz5n2kfra8p0\LocalCache\local-packages\Python313\Scripts"
if (Test-Path $pyScripts) { $env:PATH = "$env:PATH;$pyScripts" }

try {
    $hfOut = (hf auth whoami 2>&1) -join " "
    if ($hfOut -match "user=") {
        Write-Host "  [OK] HuggingFace auth: $hfOut" -ForegroundColor Green
        $Results["hf_auth"] = "OK"
    } else {
        Write-Host "  [WARN] HF not logged in - run: hf auth login" -ForegroundColor Yellow
        $Results["hf_auth"] = "NOT_LOGGED_IN"
    }
} catch {
    Write-Host "  [WARN] hf CLI not found" -ForegroundColor Yellow
    $Results["hf_auth"] = "CLI_MISSING"
}

# -- STEP 3: Vision probe --
Write-Host ""
Write-Host "STEP 3: Running vision probe..." -ForegroundColor Yellow
try {
    python (Join-Path $Root "scripts\probe_vision.py") 2>&1 | Write-Host
    $probeFile = Join-Path $Root "data\vision_probe_result.json"
    if (Test-Path $probeFile) {
        $probe = Get-Content $probeFile | ConvertFrom-Json
        $vStatus = $probe.status
        $loadOk = $probe.load_success
        Write-Host "  Vision status: $vStatus | load_success: $loadOk" -ForegroundColor $(if ($vStatus -eq "ok") {"Green"} else {"Red"})
        $Results["vision_status"] = $vStatus
        $Results["vision_load_success"] = $loadOk
        $Results["vision_load_time_ms"] = $probe.load_time_ms
        $Results["vision_inference_ms"] = $probe.inference_latency_ms
    }
} catch {
    Write-Host "  Vision probe failed: $_" -ForegroundColor Red
    $Results["vision_status"] = "PROBE_ERROR"
}

# -- STEP 4: Model swap latency --
Write-Host ""
Write-Host "STEP 4: Measuring model swap latency..." -ForegroundColor Yellow
if ($allModelsPresent) {
    try {
        python (Join-Path $Root "scripts\measure_model_swap.py") 2>&1 | Write-Host
        $swapFile = Join-Path $Root "data\model_swap_latency.json"
        if (Test-Path $swapFile) {
            $swap = Get-Content $swapFile | ConvertFrom-Json
            $Results["model_swap"] = $swap
        }
    } catch {
        Write-Host "  Swap measurement failed: $_" -ForegroundColor Red
        $Results["model_swap"] = "MEASUREMENT_FAILED"
    }
} else {
    Write-Host "  SKIPPED - models not present" -ForegroundColor Yellow
    $Results["model_swap"] = "SKIPPED_MODELS_MISSING"
}

# -- STEP 5: FastAPI health --
Write-Host ""
Write-Host "STEP 5: Checking FastAPI health (requires start_all.ps1)..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "http://127.0.0.1:8000/" -TimeoutSec 5
    Write-Host "  [OK] FastAPI running: phase $($response.phase)" -ForegroundColor Green
    $Results["fastapi"] = "OK phase=$($response.phase)"
} catch {
    Write-Host "  [WARN] FastAPI not responding. Start with: .\scripts\start_all.ps1" -ForegroundColor Yellow
    $Results["fastapi"] = "NOT_RUNNING"
}

# -- STEP 6: Agent /agent/run round-trip --
Write-Host ""
Write-Host "STEP 6: Agent /agent/run round-trip (requires running stack)..." -ForegroundColor Yellow
if ($Results["fastapi"] -like "OK*") {
    try {
        $body = '{"query": "What is the OISD 116 inspection interval for H2S pressure vessels?", "session_id": "preflight-001"}'
        $t0 = Get-Date
        $resp = Invoke-RestMethod -Uri "http://127.0.0.1:8000/agent/run" -Method POST `
            -ContentType "application/json" -Body $body -TimeoutSec 120
        $elapsed = [int]((Get-Date) - $t0).TotalMilliseconds
        Write-Host "  [OK] /agent/run responded in ${elapsed}ms" -ForegroundColor Green
        Write-Host "  intent: $($resp.intent), status: $($resp.status)" -ForegroundColor Gray
        Write-Host "  evidence: $($resp.retrieved_evidence.Count) chunks" -ForegroundColor Gray
        $Results["agent_run"] = @{
            status = $resp.status
            latency_ms = $elapsed
            intent = $resp.intent
            evidence_count = $resp.retrieved_evidence.Count
            vision_status = $resp.vision_status
            sandbox_mode = $resp.sandbox_mode
        }
    } catch {
        Write-Host "  [FAIL] /agent/run failed: $_" -ForegroundColor Red
        $Results["agent_run"] = "FAILED: $_"
    }
} else {
    Write-Host "  SKIPPED - FastAPI not running" -ForegroundColor Yellow
    $Results["agent_run"] = "SKIPPED_FASTAPI_DOWN"
}

# -- SAVE RESULTS --
Write-Host ""
Write-Host "Saving preflight results..." -ForegroundColor Yellow
$Results["timestamp"] = (Get-Date -Format "o")
$Results["preflight_complete"] = ($allModelsPresent -and ($Results["fastapi"] -like "OK*"))
$out = Join-Path $Root "data\preflight_results.json"
$Results | ConvertTo-Json -Depth 10 | Out-File $out -Encoding UTF8
Write-Host "Saved: $out" -ForegroundColor Green

# -- SUMMARY --
Write-Host ""
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host " PREFLIGHT SUMMARY" -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan
Write-Host "Models on disk:  $(if ($allModelsPresent) {'ALL PRESENT'} else {'MISSING - download first'})" -ForegroundColor $(if ($allModelsPresent) {"Green"} else {"Red"})
Write-Host "HF auth:         $($Results['hf_auth'])"
Write-Host "Vision status:   $($Results['vision_status'])"
Write-Host "FastAPI:         $($Results['fastapi'])"
if ($Results["agent_run"] -is [hashtable]) {
    Write-Host "Agent run:       $($Results['agent_run']['status']) in $($Results['agent_run']['latency_ms'])ms" -ForegroundColor Green
} else {
    Write-Host "Agent run:       $($Results['agent_run'])" -ForegroundColor Yellow
}
Write-Host ""
if ($Results["preflight_complete"]) {
    Write-Host "PREFLIGHT PASS - proceed to demo scripting and GSAP." -ForegroundColor Green
} else {
    Write-Host "PREFLIGHT INCOMPLETE - resolve blockers above before demo." -ForegroundColor Red
}

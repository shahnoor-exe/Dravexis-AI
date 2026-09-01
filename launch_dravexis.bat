@echo off
:: launch_dravexis.bat — Dravexis On-Prem Agentic Control Layer launcher
:: Resolves project root relative to this file. Works from double-click and CMD/PS.
:: Does NOT download files, install packages, or change firewall rules.
::
:: CAPABILITY REMINDER (printed at launch):
::   GPU:      CPU_FALLBACK_OR_NO_GPU_OFFLOAD (VRAM delta 0 MiB across all models)
::   Sandbox:  DEGRADED_SANDBOX (AST allowlist; Docker not installed)
::   Network:  MONITOR_UNAVAILABLE (psutil process-level; no NPCAP packet capture)
::   Vision:   VISION_AVAILABLE (Qwen2.5-VL-3B + mmproj-Q8_0, CPU-based, ~9.5s cold)
::   Models:   Sequential hot-swap only; never co-resident.

setlocal EnableDelayedExpansion

:: --- Resolve project root ---
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
cd /d "%ROOT%"

echo.
echo =====================================================================
echo  Dravexis -- On-Prem Agentic Control Layer
echo  Project root: %ROOT%
echo =====================================================================
echo.
echo  CAPABILITY SUMMARY (truthful as of 2026-09-02):
echo    GPU     : CPU_FALLBACK_OR_NO_GPU_OFFLOAD
echo    Sandbox : DEGRADED_SANDBOX (AST allowlist, no Docker)
echo    Monitor : MONITOR_UNAVAILABLE (process-level psutil, no NPCAP)
echo    Vision  : VISION_AVAILABLE (CPU-based, ~9-14s cold-start)
echo    Timing  : Reasoning ~2.7s  Coder ~2.7s  Full query ~10s
echo =====================================================================
echo.

:: --- Check Python ---
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found on PATH. Install Python 3.11+ and retry.
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PYVER=%%i
echo [OK] Python: %PYVER%

:: --- Check Node/npm ---
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] npm not found. UI (Tauri) cannot start. Backend will still launch.
    set "NO_UI=1"
) else (
    for /f "tokens=*" %%i in ('npm --version 2^>^&1') do set NPMVER=%%i
    echo [OK] npm: %NPMVER%
    set "NO_UI=0"
)

:: --- Check llama-server binary ---
if not exist "%ROOT%\bin\llama-server.exe" (
    echo [ERROR] bin\llama-server.exe missing. Run scripts\download_llama_server.ps1 first.
    pause
    exit /b 1
)
echo [OK] llama-server.exe present

:: --- Check at least one GGUF model ---
set "FOUND_GGUF=0"
for %%f in ("%ROOT%\models\*.gguf") do set "FOUND_GGUF=1"
if "%FOUND_GGUF%"=="0" (
    echo [ERROR] No *.gguf models found in models\. Run download scripts first.
    pause
    exit /b 1
)
echo [OK] GGUF model(s) found in models\

:: --- Check if FastAPI is already running (duplicate protection) ---
echo.
echo [Check] Testing whether backend is already running...
powershell -NoProfile -Command ^
    "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/' -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop; Write-Host 'ALREADY_RUNNING' } catch { Write-Host 'NOT_RUNNING' }" > "%TEMP%\dravexis_check.tmp" 2>&1
set /p BKSTATUS=<"%TEMP%\dravexis_check.tmp"
del "%TEMP%\dravexis_check.tmp" 2>nul

if "!BKSTATUS!"=="ALREADY_RUNNING" (
    echo [OK] FastAPI backend already running at http://127.0.0.1:8000 -- skipping duplicate launch.
    goto :LAUNCH_UI
)

:: --- Start backend in a new titled terminal ---
echo [1/2] Starting backend (llama-server + FastAPI)...
start "Dravexis Backend" powershell -NoProfile -ExecutionPolicy Bypass -File "%ROOT%\scripts\start_all.ps1"

:: --- Poll FastAPI health (bounded: max 60s) ---
echo     Waiting for FastAPI to become ready (max 60s)...
set "READY=0"
for /L %%i in (1,1,30) do (
    if "!READY!"=="0" (
        powershell -NoProfile -Command ^
            "try { $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/' -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop; Write-Host 'OK' } catch { Write-Host 'WAIT' }" > "%TEMP%\dravexis_health.tmp" 2>&1
        set /p HSTATUS=<"%TEMP%\dravexis_health.tmp"
        del "%TEMP%\dravexis_health.tmp" 2>nul
        if "!HSTATUS!"=="OK" set "READY=1"
        if "!READY!"=="0" (
            timeout /t 2 /nobreak >nul
            echo      .
        )
    )
)

if "!READY!"=="0" (
    echo [WARN] FastAPI did not respond within 60s. Check the Backend terminal for errors.
    echo        Common causes: port 8000 in use, missing requirements, llama-server crash.
) else (
    echo [OK] FastAPI ready at http://127.0.0.1:8000
)

:LAUNCH_UI
:: --- Launch UI (Tauri dev) if npm available ---
if "!NO_UI!"=="1" (
    echo [SKIP] UI launch skipped -- npm not found.
    goto :DONE
)

if not exist "%ROOT%\ui\mrpl-workbench\package.json" (
    echo [WARN] ui\mrpl-workbench\package.json not found. Skipping UI launch.
    goto :DONE
)

echo.
echo [2/2] Starting Tauri UI (npm run tauri dev)...
start "Dravexis UI" cmd /k "cd /d %ROOT%\ui\mrpl-workbench && npm run tauri dev"

:DONE
echo.
echo =====================================================================
echo  Launch sequence complete. Check terminal windows for status.
echo  FastAPI docs : http://127.0.0.1:8000/docs
echo  llama-server : http://127.0.0.1:8080/health (when model is loaded)
echo.
echo  To stop: close the Backend and UI terminal windows.
echo  Logs   : See backend terminal output (non-sensitive).
echo =====================================================================
echo.

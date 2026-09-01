@echo off
:: launch_dravexis.bat — Dravexis On-Prem Agentic Control Layer launcher
:: Resolves project root relative to this file. Works from double-click and CMD/PS.
:: Hardened against path spaces and silent exits.

setlocal EnableDelayedExpansion

:: --- 1. Path Safety ---
:: Securely resolve project root and ensure it is quoted when used
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
cd /d "%ROOT%"

echo.
echo =====================================================================
echo  Dravexis -- On-Prem Agentic Control Layer
echo  Project root: "%ROOT%"
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

:: --- 2. Check Python ---
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found on PATH. Install Python 3.11+ and retry.
    goto :FAIL
)
for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PYVER=%%i
echo [OK] Python: %PYVER%

:: --- 3. Check Node/npm ---
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] npm not found. UI cannot start. Backend will still launch.
    set "NO_UI=1"
) else (
    for /f "tokens=*" %%i in ('npm --version 2^>^&1') do set NPMVER=%%i
    echo [OK] npm: %NPMVER%
    set "NO_UI=0"
)

:: --- 4. Check llama-server binary ---
if not exist "%ROOT%\bin\llama-server.exe" (
    echo [ERROR] bin\llama-server.exe missing. Run scripts\download_llama_server.ps1 first.
    goto :FAIL
)
echo [OK] llama-server.exe present

:: --- 5. Check at least one GGUF model ---
set "FOUND_GGUF=0"
for %%f in ("%ROOT%\models\*.gguf") do set "FOUND_GGUF=1"
if "!FOUND_GGUF!"=="0" (
    echo [ERROR] No *.gguf models found in models\. Run download scripts first.
    goto :FAIL
)
echo [OK] GGUF model(s) found in models\

:: --- 6. Check if FastAPI is already running (duplicate protection) ---
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

:: --- 7. Start backend in a new titled terminal ---
echo [1/2] Starting backend (llama-server + FastAPI)...
start "Dravexis Backend" cmd /k "cd /d ""%ROOT%"" && powershell -NoProfile -ExecutionPolicy Bypass -File "".\scripts\start_all.ps1"""

:: --- 8. Poll FastAPI health (bounded: max 60s) ---
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
    echo [ERROR] FastAPI did not respond within 60s. Check the Backend terminal for errors.
    echo        Common causes: port 8000 in use, missing requirements, llama-server crash.
    goto :FAIL
) else (
    echo [OK] FastAPI ready at http://127.0.0.1:8000
)

:LAUNCH_UI
:: --- 9. Launch UI (Vite dev server) and Browser if npm available ---
if "!NO_UI!"=="1" (
    echo [SKIP] UI launch skipped -- npm not found.
    goto :DONE
)

if not exist "%ROOT%\ui\mrpl-workbench\package.json" (
    echo [WARN] ui\mrpl-workbench\package.json not found. Skipping UI launch.
    goto :DONE
)

echo.
echo [2/2] Starting Vite Web Server (npm run dev)...
start "Dravexis Web Server" cmd /k "cd /d ""%ROOT%\ui\mrpl-workbench"" && npm run dev"

echo     Waiting for Vite server to start (3s)...
timeout /t 3 /nobreak >nul

echo     Opening default browser...
start http://localhost:1420/

:DONE
echo.
echo =====================================================================
echo  Launch sequence complete. Check terminal windows for status.
echo  FastAPI Backend Docs  : http://127.0.0.1:8000/docs
echo  Web App (Browser)     : http://localhost:1420/
echo.
echo  [Optional] To run the native Tauri desktop shell instead of the browser:
echo  cd ui\mrpl-workbench ^&^& npm run tauri dev
echo.
echo  To stop: close the Backend and Web Server terminal windows.
echo  Logs   : See backend terminal output (non-sensitive).
echo =====================================================================
echo.
:: Explicit pause so the window doesn't immediately close on success
pause
exit /b 0

:FAIL
echo.
echo [!] Launch aborted due to errors. Review the messages above.
pause
exit /b 1

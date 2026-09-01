@echo off
:: launch_dravexis.bat — Dravexis On-Prem Agentic Control Layer launcher
:: Hardened against path spaces (SIH 2026 PS 117), silent exits, and llama-server deadlock.
::
:: Architecture note: llama-server is managed on-demand by model_manager.py.
:: This launcher starts ONLY FastAPI + Vite. llama-server spawns per query.

setlocal EnableDelayedExpansion

:: --- 1. Resolve project root safely (quotes handle spaces in path) ---
set "ROOT=%~dp0"
if "%ROOT:~-1%"=="\" set "ROOT=%ROOT:~0,-1%"
cd /d "%ROOT%"

echo.
echo =====================================================================
echo  Dravexis -- On-Prem Agentic Control Layer
echo  Project root: "%ROOT%"
echo =====================================================================
echo.
echo  CAPABILITY SUMMARY:
echo    GPU     : CPU_FALLBACK_OR_NO_GPU_OFFLOAD
echo    Sandbox : DEGRADED_SANDBOX (AST allowlist, no Docker)
echo    Monitor : MONITOR_UNAVAILABLE (psutil socket-level, no NPCAP)
echo    Vision  : VISION_AVAILABLE  (~9-14s cold-start, CPU)
echo    LLM     : On-demand hot-swap  (Reasoning ~2.7s / Coder ~2.7s)
echo =====================================================================
echo.

:: --- 2. Preflight: Python ---
where python >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERROR] Python not found on PATH. Install Python 3.11+ and retry.
    goto :FAIL
)
for /f "tokens=*" %%i in ('python --version 2^>^&1') do set PYVER=%%i
echo [OK] %PYVER%

:: --- 3. Preflight: Node/npm ---
where npm >nul 2>&1
if %errorlevel% neq 0 (
    echo [WARN] npm not found. Web UI will not be started.
    set "NO_UI=1"
) else (
    for /f "tokens=*" %%i in ('npm --version 2^>^&1') do set NPMVER=%%i
    echo [OK] npm %NPMVER%
    set "NO_UI=0"
)

:: --- 4. Preflight: llama-server binary ---
if not exist "%ROOT%\bin\llama-server.exe" (
    echo [ERROR] bin\llama-server.exe missing. Run: .\scripts\download_llama_server.ps1
    goto :FAIL
)
echo [OK] llama-server.exe present (used on-demand by model_manager)

:: --- 5. Preflight: At least one GGUF model ---
set "FOUND_GGUF=0"
for %%f in ("%ROOT%\models\*.gguf") do set "FOUND_GGUF=1"
if "!FOUND_GGUF!"=="0" (
    echo [ERROR] No *.gguf models in models\. Run download scripts first.
    goto :FAIL
)
echo [OK] GGUF model(s) found in models\

:: --- 6. Aggressively clean up zombie processes on Port 8000 ---
echo.
echo [Check] Checking for zombie processes on Port 8000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr "0.0.0.0:8000"') do (
    if not "%%a"=="0" (
        echo [WARN] Port 8000 is occupied by PID %%a. Killing zombie process...
        taskkill /F /PID %%a >nul 2>&1
        timeout /t 1 /nobreak >nul
    )
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr "127.0.0.1:8000"') do (
    if not "%%a"=="0" (
        echo [WARN] Port 8000 is occupied by PID %%a. Killing zombie process...
        taskkill /F /PID %%a >nul 2>&1
        timeout /t 1 /nobreak >nul
    )
)
echo [OK] Port 8000 is clean.

:: --- 7. Start FastAPI backend in its own titled window ---
echo [1/2] Launching FastAPI Backend Gateway...
echo       (llama-server will spawn automatically on first agent query)
start "Dravexis Backend Gateway" cmd /k "cd /d ""%ROOT%"" && set ""PYTHONUTF8=1"" && python -m uvicorn src.main:app --host 127.0.0.1 --port 8000"

:: --- 8. Poll FastAPI health (max 15s — should be ready in ~2-3s) ---
echo       Waiting for FastAPI to be ready (max 15s)...
set "READY=0"
for /L %%i in (1,1,15) do (
    if "!READY!"=="0" (
        powershell -NoProfile -Command "try { $null = Invoke-WebRequest -Uri 'http://127.0.0.1:8000/' -UseBasicParsing -TimeoutSec 1 -EA Stop; Write-Host 'OK' } catch { Write-Host 'WAIT' }" > "%TEMP%\drav_h.tmp" 2>&1
        set /p HS=<"%TEMP%\drav_h.tmp"
        del "%TEMP%\drav_h.tmp" 2>nul
        if "!HS!"=="OK" set "READY=1"
        if "!READY!"=="0" (
            timeout /t 1 /nobreak >nul
        )
    )
)

if "!READY!"=="0" (
    echo [ERROR] FastAPI did not respond within 15s.
    echo         Check the "Dravexis Backend Gateway" terminal window for errors.
    goto :FAIL
)
echo [OK] FastAPI ready at http://127.0.0.1:8000

:LAUNCH_UI
if "!NO_UI!"=="1" (
    echo [SKIP] UI launch skipped -- npm not found.
    goto :DONE
)
if not exist "%ROOT%\ui\mrpl-workbench\package.json" (
    echo [WARN] ui\mrpl-workbench\package.json not found. Skipping UI.
    goto :DONE
)

:: --- 9. Start Vite dev server in its own window ---
echo.
echo [2/2] Launching Vite Web Server (npm run dev, port 1420)...
start "Dravexis Web Server" cmd /k "cd /d ""%ROOT%\ui\mrpl-workbench"" && npm run dev"

echo       Waiting 3s for Vite to bind...
timeout /t 3 /nobreak >nul

:: --- 10. Auto-open default browser ---
echo       Opening default browser...
start http://localhost:1420/

:DONE
echo.
echo =====================================================================
echo  Dravexis is running!
echo.
echo   FastAPI Backend  : http://127.0.0.1:8000
echo   API Docs         : http://127.0.0.1:8000/docs
echo   Web App (Browser): http://localhost:1420/
echo.
echo  [Note] First query will trigger on-demand model load (~2-3s).
echo  [Info] For native Tauri desktop shell (needs Rust/cargo):
echo         cd ui\mrpl-workbench ^&^& npm run tauri dev
echo.
echo  To stop: close the Backend Gateway and Web Server terminal windows.
echo =====================================================================
echo.
pause
exit /b 0

:FAIL
echo.
echo [!!!] Launch failed. Read errors above.
echo       Press any key to close this window.
pause
exit /b 1

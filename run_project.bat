@echo off
title AI Legal Document Assistant Launcher
echo ===================================================
echo   AI LEGAL DOCUMENT ASSISTANT AUTOMATED LAUNCHER
echo ===================================================
echo.

:: 1. Check if Ollama is running, start if offline
echo [1/3] Verifying Ollama local LLM service...
tasklist /FI "IMAGENAME eq ollama.exe" 2>NUL | find /I /N "ollama.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo    - Ollama is already running.
) else (
    echo    - Ollama is offline. Launching Ollama app...
    start "" "%LOCALAPPDATA%\Programs\Ollama\ollama.exe"
    timeout /t 5 >nul
)

:: 2. Launch FastAPI Backend in a new terminal
echo [2/3] Starting Python FastAPI Backend Server (Port 8000)...
start "FastAPI Backend Server" cmd /k "cd backend && .\.venv\Scripts\activate && uvicorn main:app --reload --port 8000"

:: 3. Launch React Frontend in a new terminal
echo [3/3] Starting Vite React Frontend Server (Port 3000)...
start "Vite React Frontend" cmd /k "cd frontend && npm run dev"

:: 4. Wait for servers to spin up and open web application in browser
timeout /t 4 >nul
echo.
echo Launching browser to http://localhost:3000/ ...
start http://localhost:3000/

echo.
echo ===================================================
echo   System launched! Keep these terminal windows open.
echo   You can minimize them. Press any key to close this launcher.
echo ===================================================
pause >nul

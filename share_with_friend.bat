@echo off
title Share AI Legal Assistant with Friend
echo ===================================================
echo   SHARE AI LEGAL ASSISTANT PUBLIC LINK GENERATOR
echo ===================================================
echo.
echo NOTE: Ensure uvicorn and npm run dev are running in the background!
echo.

:: 1. Fetch public IP address (used as the safety password for the link)
echo Fetching your tunnel password (your public IP)...
for /f "delims=" %%i in ('curl -s https://ipinfo.io/ip') do set PUBLIC_IP=%%i
echo.
echo 🔑 YOUR TUNNEL PASSWORD IS: %PUBLIC_IP%
echo Copy this password! Your friend will need to enter this when opening the link.
echo.

:: 2. Launch localtunnel
echo Exposing local port 3000 to the public internet...
echo (It will generate a URL ending with .loca.lt shortly. Copy that URL and send it to your friend)
echo.
npx localtunnel --port 3000

pause

@echo off
title ZHA launcher
cd /d "%~dp0frontend"

echo ============================================================
echo   ZHA home resolver + Cloudflare tunnel
echo.
echo   Keep this window (and the two it opens) running.
echo   While running, anyone can use the deployed app and audio
echo   will play. Closing the windows takes audio offline.
echo ============================================================
echo.

echo [1/2] Starting the audio resolver (build + serve on :3000)...
start "ZHA Resolver" cmd /k "npm run build && npm start"

echo [2/2] Starting the Cloudflare named tunnel "zha-resolver"...
start "ZHA Tunnel" cmd /k "cloudflared tunnel run zha-resolver"

echo.
echo Both started in separate windows. The tunnel will connect once
echo the resolver finishes building (first launch takes ~30s).
echo.
echo Stop everything by closing the "ZHA Resolver" and "ZHA Tunnel" windows.
pause

@echo off
cls
echo ====================================
echo STARTING GLAS POLITICS SERVER
echo ====================================
echo.

REM Check for existing Node processes and clean up
echo Checking for existing processes...
tasklist | findstr /I "node.exe tsx.exe" >nul 2>&1
if %errorlevel% equ 0 (
    echo Found existing Node processes - cleaning up...
    taskkill /F /IM node.exe >nul 2>&1
    taskkill /F /IM tsx.exe >nul 2>&1
    timeout /t 2 /nobreak >nul
    echo Cleanup complete.
    echo.
)

echo Setting environment...
set NODE_ENV=development
echo NODE_ENV=%NODE_ENV%
echo.
echo Starting server with AUTO-RELOAD enabled...
echo If successful, you'll see: "Server successfully started on http://localhost:5000"
echo.
echo ✅ Auto-reload: ENABLED (server will restart on file changes)
echo Press Ctrl+C to stop the server gracefully
echo ====================================
echo.

npm run dev

echo.
echo ====================================
echo Server stopped or failed to start
echo Check the output above for errors
echo ====================================
pause


@echo off
echo ========================================
echo   Glas Politics - Safe Server Start
echo ========================================
echo.

REM Check if Node is already running on port 5000
echo Checking for existing processes on port 5000...
netstat -ano | findstr :5000 >nul 2>&1
if %errorlevel% equ 0 (
    echo WARNING: Port 5000 is already in use!
    echo.
    echo Killing existing Node.js processes...
    taskkill /F /IM node.exe >nul 2>&1
    taskkill /F /IM tsx.exe >nul 2>&1
    echo Waiting for cleanup...
    timeout /t 3 /nobreak >nul
    echo.
)

echo Starting development server with AUTO-RELOAD enabled...
echo.
echo ✅ Auto-reload: ENABLED
echo    - Server code changes: Auto-restart
echo    - Client code changes: Hot Module Replacement (HMR)
echo.
echo Press Ctrl+C to stop the server gracefully
echo ========================================
echo.

REM Start the development server with watch mode
npm run dev




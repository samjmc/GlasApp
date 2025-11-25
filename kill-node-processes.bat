@echo off
echo Killing all Node.js and tsx processes...
taskkill /F /IM node.exe 2>nul
taskkill /F /IM tsx.exe 2>nul
timeout /t 2 /nobreak >nul
echo.
echo All Node processes terminated.
echo You can now start the server again with: npm run dev
echo.
pause




@echo off
REM Run TD Scoring Service
REM This processes news articles and updates TD ELO scores

echo ========================================
echo   TD Scoring Service
echo ========================================
echo.

cd /d "%~dp0\.."

echo Running TD scoring job...
echo.

npx tsx server/jobs/hourlyTDScoring.ts

echo.
echo ========================================
echo   Complete!
echo ========================================
echo.

pause
























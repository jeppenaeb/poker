@echo off
cd /d "%~dp0"

echo Stopping old poker server if it is already running...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
  taskkill /F /PID %%a >nul 2>nul
)

echo.
echo Updating poker app from GitHub...
git pull
if errorlevel 1 (
  echo.
  echo Could not update from GitHub.
  pause
  exit /b 1
)

echo.
echo Installing backend packages...
cd backend
call npm.cmd install
if errorlevel 1 (
  echo.
  echo Could not install backend packages.
  pause
  exit /b 1
)

echo.
echo Starting poker app...
call npm.cmd run dev

pause

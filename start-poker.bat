@echo off
cd /d "%~dp0"

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

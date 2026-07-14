@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Install Node.js 20 or newer first.
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm was not found. Reinstall Node.js with npm included.
  exit /b 1
)

echo [1/2] Installing dependencies...
call npm install
if errorlevel 1 exit /b 1

echo [2/2] Building the application...
call npm run build
if errorlevel 1 exit /b 1

echo.
echo Initialization complete. Run start.cmd to launch the reader.

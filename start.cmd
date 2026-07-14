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

if not exist "node_modules\" (
  echo Dependencies are missing. Running initialization first...
  call "%~dp0init.cmd"
  if errorlevel 1 exit /b 1
)

echo Building the latest application...
call npm run build
if errorlevel 1 exit /b 1

if not defined PORT set "PORT=4173"

echo Starting FGO Chronicle Reader at http://127.0.0.1:%PORT%
call npm start

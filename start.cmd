@echo off
setlocal

cd /d "%~dp0"

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js was not found. Install Node.js 20 or newer first.
  echo.
  echo Press any key to close this window...
  pause >nul
  exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
  echo [ERROR] npm was not found. Reinstall Node.js with npm included.
  echo.
  echo Press any key to close this window...
  pause >nul
  exit /b 1
)

if not exist "node_modules\" (
  echo Dependencies are missing. Running initialization first...
  call "%~dp0init.cmd"
  if errorlevel 1 (
    echo.
    echo [ERROR] Initialization failed.
    echo Press any key to close this window...
    pause >nul
    exit /b 1
  )
)

echo Building the latest application...
call npm run build
if errorlevel 1 (
  echo.
  echo [ERROR] The application build failed.
  echo Press any key to close this window...
  pause >nul
  exit /b 1
)

if not defined PORT set "PORT=4173"

echo Starting FGO Chronicle Reader at http://127.0.0.1:%PORT%
echo Keep this window open while using the reader.
echo Closing this window will stop the local service.
echo.

rem Run Node in the foreground so the service shares this window's lifetime.
node "%~dp0server.mjs"
set "SERVER_EXIT_CODE=%ERRORLEVEL%"

if not "%SERVER_EXIT_CODE%"=="0" (
  echo.
  echo [ERROR] The local service stopped with exit code %SERVER_EXIT_CODE%.
  pause
)

exit /b %SERVER_EXIT_CODE%

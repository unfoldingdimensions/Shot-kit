@echo off
setlocal
title Shotkit Launcher

echo ===================================================
echo                  Launching Shotkit
echo ===================================================
echo.

:: Check Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [ERROR] Node.js is not installed or not found in PATH.
    echo Please install Node.js from https://nodejs.org/ to run Shotkit.
    echo.
    pause
    exit /b 1
)

:: Check if build exists, if not build it
if not exist "out\index.html" (
    echo [INFO] First run detected: Building static distribution...
    call npm run build
    if %errorlevel% neq 0 (
        echo [ERROR] Build failed. Please check errors above.
        pause
        exit /b 1
    )
)

echo [INFO] Starting Shotkit in standalone app mode...
echo (You can minimize this window. Close it to stop Shotkit.)
echo.

node scripts/serve.mjs --app

endlocal

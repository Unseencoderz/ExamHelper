@echo off
setlocal
title ExamHelper Backend

pushd "%~dp0"

echo.
echo ==========================================
echo   ExamHelper Backend Server
echo ==========================================
echo.

node --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js 18+ was not found on this machine.
    pause
    exit /b 1
)

echo [INFO] Installing backend dependencies...
call npm install --silent
if errorlevel 1 (
    echo [ERROR] npm install failed.
    pause
    exit /b 1
)

echo [INFO] Backend starting on http://localhost:3000
echo [INFO] Web frontend will be available at the same address.
echo.

node server.js

popd
pause

@echo off
setlocal
title Microphone

pushd "%~dp0"

echo.
echo ==========================================
echo   Microphone
echo ==========================================
echo.

python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python 3.10+ was not found on this machine.
    pause
    exit /b 1
)

echo [INFO] Installing desktop client dependencies...
python -m pip install --quiet --upgrade pip
python -m pip install --quiet -r requirements.txt
if errorlevel 1 (
    echo [ERROR] Failed to install Python dependencies.
    pause
    exit /b 1
)

echo [INFO] Starting screenshot client in the background...
start "" /B pythonw "%~dp0screenshot_client.py"

echo [INFO] Client started.
echo [INFO] Config file: %%LOCALAPPDATA%%\ScreenshotSync\config.ini
echo [INFO] Log file:   %%LOCALAPPDATA%%\ScreenshotSync\client.log
echo.

popd
pause

@echo off
setlocal
title Build ExamHelper Client EXE

pushd "%~dp0"

python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python 3.10+ was not found.
    exit /b 1
)

echo [INFO] Installing build dependencies...
python -m pip install --upgrade pip
python -m pip install -r requirements.txt pyinstaller
if errorlevel 1 (
    echo [ERROR] Failed to install build dependencies.
    exit /b 1
)

echo [INFO] Building windowless desktop client executable...
python -m PyInstaller ^
  --noconfirm ^
  --clean ^
  --windowed ^
  --onedir ^
  --name ExamHelperClient ^
  screenshot_client.py

if errorlevel 1 (
    echo [ERROR] PyInstaller build failed.
    exit /b 1
)

echo [INFO] Build complete: %~dp0dist\ExamHelperClient\

popd
exit /b 0

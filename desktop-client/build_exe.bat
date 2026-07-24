@echo off
setlocal
title Build Microphone EXE

pushd "%~dp0"

python --version >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Python 3.10+ was not found.
    exit /b 1
)

set "VENV_PY=%~dp0.venv\Scripts\python.exe"
if not exist "%VENV_PY%" (
    echo [INFO] Creating isolated build environment...
    python -m venv "%~dp0.venv"
    if errorlevel 1 (
        echo [ERROR] Failed to create build environment.
        exit /b 1
    )
)

echo [INFO] Installing build dependencies...
"%VENV_PY%" -m pip install --upgrade pip
"%VENV_PY%" -m pip install -r requirements.txt pyinstaller
if errorlevel 1 (
    echo [ERROR] Failed to install build dependencies.
    exit /b 1
)

echo [INFO] Building standalone Microphone executable...
"%VENV_PY%" -m PyInstaller ^
  --noconfirm ^
  --clean ^
  --windowed ^
  --onefile ^
  --icon microphone.ico ^
  --exclude-module tkinter ^
  --exclude-module numpy ^
  --exclude-module pygame ^
  --exclude-module cryptography ^
  --exclude-module setuptools ^
  --exclude-module pkg_resources ^
  --name Microphone ^
  screenshot_client.py

if errorlevel 1 (
    echo [ERROR] PyInstaller build failed.
    exit /b 1
)

echo [INFO] Build complete: %~dp0dist\Microphone.exe

popd
exit /b 0

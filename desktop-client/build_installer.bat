@echo off
setlocal
title Build ExamHelper Installer

pushd "%~dp0"

call "%~dp0build_exe.bat"
if errorlevel 1 exit /b 1

set "ISCC_PATH=%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
if not exist "%ISCC_PATH%" set "ISCC_PATH=%ProgramFiles%\Inno Setup 6\ISCC.exe"

if not exist "%ISCC_PATH%" (
    echo [ERROR] Inno Setup 6 was not found.
    echo [INFO] Install it from https://jrsoftware.org/isinfo.php and rerun this script.
    exit /b 1
)

echo [INFO] Building installer...
"%ISCC_PATH%" "%~dp0installer\ExamHelperClient.iss"
if errorlevel 1 (
    echo [ERROR] Installer build failed.
    exit /b 1
)

echo [INFO] Installer ready: %~dp0installer\ExamHelperClientSetup.exe

popd
exit /b 0

@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8

if not "%~1"=="" goto cli
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\run-sarathi.ps1"
goto finished

:cli
where py >nul 2>nul
if not errorlevel 1 (
  py -3 python_backend\main.py %*
) else (
  python python_backend\main.py %*
)

:finished

set EXIT_CODE=%ERRORLEVEL%
echo.
if %EXIT_CODE% NEQ 0 echo Saarthi exited with code %EXIT_CODE%.
pause
exit /b %EXIT_CODE%

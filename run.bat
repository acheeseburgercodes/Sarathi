@echo off
setlocal
cd /d "%~dp0"
chcp 65001 >nul
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8

where py >nul 2>nul
if not errorlevel 1 goto use_py

where python >nul 2>nul
if errorlevel 1 (
  echo Python 3 was not found. Install Python 3.10 or newer and try again.
  pause
  exit /b 1
)
python python_backend\main.py %*
goto finished

:use_py
py -3 python_backend\main.py %*

:finished

set EXIT_CODE=%ERRORLEVEL%
echo.
if %EXIT_CODE% NEQ 0 echo Saarthi exited with code %EXIT_CODE%.
pause
exit /b %EXIT_CODE%

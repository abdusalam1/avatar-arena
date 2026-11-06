@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title Avatar Arena - Portrait (OBS)
rem 竖屏窗口，方便 OBS 窗口采集 / 第二块屏
where python >nul 2>nul
if not errorlevel 1 (
    python launch.py --portrait
    if errorlevel 1 pause
    exit /b
)
where py >nul 2>nul
if not errorlevel 1 (
    py -3 launch.py --portrait
    if errorlevel 1 pause
    exit /b
)
echo Python 3 is required.
pause

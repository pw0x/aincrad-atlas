@echo off
cd /d "%~dp0"
python preview.py --open
if errorlevel 1 pause

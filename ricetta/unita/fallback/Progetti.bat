@echo off
setlocal
call "%~dp0comune.bat"
start "" "%SystemRoot%\explorer.exe" "%BASE%\progetti"

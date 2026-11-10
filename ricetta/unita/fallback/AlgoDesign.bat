@echo off
setlocal
call "%~dp0comune.bat"
set "HOME="
set "XDG_CONFIG_HOME="
set "XDG_DATA_HOME="
cd /d "%BASE%\algodesign"
start "" "%BASE%\algodesign\AlgoDesign.exe"

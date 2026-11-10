@echo off
setlocal
call "%~dp0comune.bat"
rem HOME serve solo ai programmi di MSYS.
set "HOME="
set "XDG_CONFIG_HOME="
set "XDG_DATA_HOME="
cd /d "%BASE%\progetti"
start "" "%BASE%\vscodium\VSCodium.exe"

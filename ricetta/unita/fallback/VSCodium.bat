@echo off
setlocal
call "%~dp0comune.bat"
rem HOME serve solo ai programmi di MSYS.
set "HOME="
set "XDG_CONFIG_HOME="
set "XDG_DATA_HOME="
rem La lingua dell'editor per questa cartella, come fa VSCodium.exe alla radice: se non riesce, l'editor parte lo stesso.
"%BASE%\python\python.exe" -I -B "%BASE%\vscodium\lingua.py" >nul 2>nul
cd /d "%BASE%\progetti"
start "" "%BASE%\vscodium\VSCodium.exe"

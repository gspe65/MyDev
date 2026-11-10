@echo off
setlocal
call "%~dp0comune.bat"
if not exist "%BASE%\home" mkdir "%BASE%\home"
cd /d "%BASE%\progetti"
start "" "%BASE%\msys64\usr\bin\mintty.exe" -t "Terminale" --geometry=96x32 "%BASE%\msys64\usr\bin\bash.exe" --login -i -c "export PATH=\"%PATH_TERM%\" && cd \"$MYDEV/progetti\" && exec bash"

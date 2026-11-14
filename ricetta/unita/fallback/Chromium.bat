@echo off
setlocal
call "%~dp0comune.bat"
rem HOME serve solo ai programmi di MSYS.
set "HOME="
set "XDG_CONFIG_HOME="
set "XDG_DATA_HOME="
rem Le stesse opzioni di Chromium.exe alla radice: il profilo nell'unita', le estensioni spente; niente --no-first-run,
rem che impedirebbe di leggere chromium\initial_preferences al primo avvio.
cd /d "%BASE%\chromium"
start "" "%BASE%\chromium\chrome.exe" --user-data-dir="%BASE%\home\chromium" --disable-extensions --no-default-browser-check

@echo off
rem Esegue uno script bash nell'ambiente del terminale dell'unita', senza aprire una finestra.
rem   terminale.bat "<radice dell'unita'>" "<script.sh in formato Windows>"
setlocal
set "BASE=%~1"
if "%BASE:~-1%"=="\" set "BASE=%BASE:~0,-1%"
set "DRIVE=%BASE:~0,1%"
set "UBASE=/%DRIVE%%BASE:~2%"
set "UBASE=%UBASE:\=/%"
set "MYDEV=%UBASE%"
set "HOME=%UBASE%/home"
set "XDG_CONFIG_HOME=%UBASE%/home/.config"
set "XDG_DATA_HOME=%UBASE%/home/.local/share"
set "XDG_STATE_HOME=%BASE%\home\.local\state"
set "XDG_CACHE_HOME=%BASE%\home\.cache"
set "PIP_CACHE_DIR=%BASE%\home\.cache\pip"
set "VIRTUALENV_OVERRIDE_APP_DATA=%BASE%\home\.cache\virtualenv"
set "PYTHON_HISTORY=%BASE%\home\.python_history"
set "PATH_TERM=$MYDEV/bin:$MYDEV/python:$MYDEV/python/Scripts:$PATH:$MYDEV/llvm/bin:$MYDEV/nvim/bin:."
rem Lo stesso ambiente dell'unita' estesa che danno il lanciatore e i collegamenti di riserva.
if not exist "%BASE%\programmi\Git\cmd\git.exe" goto :fine_estesa
set "PATH_TERM=$MYDEV/bin:$MYDEV/gh/bin:$MYDEV/python:$MYDEV/python/Scripts:$PATH:$MYDEV/llvm/bin:$MYDEV/nvim/bin:."
set "CARGO_HOME=%UBASE%/home/.cargo"
set "GH_CONFIG_DIR=%BASE%\home\.config\gh"
set "GH_TELEMETRY=false"
set "GH_NO_UPDATE_NOTIFIER=1"
:fine_estesa
set "SONDA=%~2"
"%BASE%\msys64\usr\bin\bash.exe" --login -c "export PATH=\"%PATH_TERM%\" && cd \"$MYDEV/progetti\" && . \"$(cygpath -u \"$SONDA\")\""
exit /b %errorlevel%

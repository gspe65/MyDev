@echo off
rem L'ambiente dei collegamenti di ripiego: lo stesso degli eseguibili alla radice.
rem NIENTE EnableDelayedExpansion: un punto esclamativo nel percorso verrebbe mangiato.
for %%I in ("%~dp0..") do set "BASE=%%~fI"
if "%BASE:~-1%"=="\" set "BASE=%BASE:~0,-1%"
set "DRIVE=%BASE:~0,1%"
rem Si compone prima la stringa intera: alla radice di un disco %BASE:~2% e' vuota.
set "UBASE=/%DRIVE%%BASE:~2%"
set "UBASE=%UBASE:\=/%"
for /f "delims==" %%V in ('set VSCODE_ 2^>nul') do set "%%V="
set "ELECTRON_RUN_AS_NODE="
set "MYDEV=%UBASE%"
set "MYDEV_RADICE=%BASE%"
set "MYDEV_RADICE_POSIX=%UBASE%"
set "MYDEV_MSYS=%BASE%\msys64"
rem Stato, cache e cronologie dei programmi dell'unita', che altrimenti finiscono nel profilo dell'utente.
set "XDG_STATE_HOME=%BASE%\home\.local\state"
set "XDG_CACHE_HOME=%BASE%\home\.cache"
set "PIP_CACHE_DIR=%BASE%\home\.cache\pip"
set "VIRTUALENV_OVERRIDE_APP_DATA=%BASE%\home\.cache\virtualenv"
set "PYTHON_HISTORY=%BASE%\home\.python_history"
set "PATH=%BASE%\bin;%BASE%\msys64\usr\bin;%BASE%\llvm\bin;%BASE%\python;%BASE%\python\Scripts;%SystemRoot%\System32;%SystemRoot%"
rem Il login di MSYS riscrive il PATH: le aggiunte stanno nella riga -c. llvm\bin dopo /usr/bin.
set "PATH_TERM=$MYDEV/bin:$MYDEV/python:$MYDEV/python/Scripts:$PATH:$MYDEV/llvm/bin:$MYDEV/nvim/bin:."
set "HOME=%UBASE%/home"
set "XDG_CONFIG_HOME=%UBASE%/home/.config"
set "XDG_DATA_HOME=%UBASE%/home/.local/share"
rem L'unita' estesa si riconosce dall'eseguibile del pannello git. Un salto e non un blocco: una parentesi nel percorso chiuderebbe il blocco.
if not exist "%BASE%\programmi\Git\cmd\git.exe" goto :fine_estesa
set "ProgramW6432=%BASE%\programmi"
set "PATH=%BASE%\bin;%BASE%\programmi\Git\cmd;%BASE%\gh\bin;%BASE%\msys64\usr\bin;%BASE%\llvm\bin;%BASE%\python;%BASE%\python\Scripts;%SystemRoot%\System32;%SystemRoot%"
set "PATH_TERM=$MYDEV/bin:$MYDEV/gh/bin:$MYDEV/python:$MYDEV/python/Scripts:$PATH:$MYDEV/llvm/bin:$MYDEV/nvim/bin:."
set "CARGO_HOME=%UBASE%/home/.cargo"
set "GH_CONFIG_DIR=%BASE%\home\.config\gh"
set "GH_TELEMETRY=false"
set "GH_NO_UPDATE_NOTIFIER=1"
:fine_estesa

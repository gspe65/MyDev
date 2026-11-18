@echo off
setlocal
call "%~dp0comune.bat"
rem HOME serve solo ai programmi di MSYS.
set "HOME="
set "XDG_CONFIG_HOME="
set "XDG_DATA_HOME="
rem La lingua dell'editor per questa cartella, come fa VSCodium.exe alla radice: se non riesce, l'editor parte lo stesso.
"%BASE%\python\python.exe" -I -B "%BASE%\vscodium\lingua.py" >nul 2>nul
rem L'editor si apre sulla cartella dei progetti, come fa VSCodium.exe alla radice: la cartella e' anche l'argomento,
rem perche' la cartella di lavoro da sola non basta all'editor (si aprirebbe vuoto, e Apri file partirebbe dalla cartella personale).
cd /d "%BASE%\progetti"
start "" "%BASE%\vscodium\VSCodium.exe" "%BASE%\progetti"
rem L'insieme garantito delle estensioni, come fa VSCodium.exe alla radice: un avviso se non torna, nulla se l'unita' e' intatta.
start "" "%BASE%\python\pythonw.exe" -I -B "%BASE%\vscodium\insieme.py"

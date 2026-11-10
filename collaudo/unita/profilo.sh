# I programmi del terminale dell'unita' col profilo dell'utente in una cartella vuota: nulla deve finirci.
# Lo lancia il gate con terminale.bat, che da' l'ambiente del terminale, e con LOCALAPPDATA, APPDATA e USERPROFILE
# spostati in PROFILO_FINTO, e con le variabili WIN_PD_OVERRIDE_* che spostano anche le cartelle note che le librerie
# Python (platformdirs) chiedono a Windows ignorando le variabili. Esegue Neovim (modifica e salva un file), virtualenv
# (crea un ambiente, che semina pip dai suoi dati), pip e Python, poi conta i file nel profilo finto: atteso zero.
# Controlli positivi, dai difetti veri, ciascuno in un altro profilo vuoto (PROFILO_POSITIVO): Neovim senza
# XDG_STATE_HOME e virtualenv senza VIRTUALENV_OVERRIDE_APP_DATA devono scriverci.
#
# Uscite: 0 verde, 1 rosso (nomina i file), 2 fermo (il controllo positivo spento, o un programma che non parte).
#
# Che cosa NON guarda: il Python interattivo (la cronologia si scrive solo con un terminale vero); pip mentre scarica
# (serve la rete: si guarda dove mette la cache); i programmi Windows lanciati dall'editor, che fotografa il gate.

F="$(cygpath -u "$PROFILO_FINTO")"
P="$(cygpath -u "$PROFILO_POSITIVO")"
L="$(cygpath -u "$PROFILO_LAVORO")"
fermo=0
cd "$HOME" || exit 2

nvim --headless -c 'edit profilo-prova.txt' -c 'normal iuna riga' -c 'write' -c 'qa!' >/dev/null 2>&1 || { echo "FERMO: nvim non parte"; fermo=1; }
rm -f profilo-prova.txt
rm -rf "$L"
virtualenv --no-periodic-update "$(cygpath -w "$L")" >/dev/null 2>&1 || { echo "FERMO: virtualenv non crea l'ambiente"; fermo=1; }
python -c "print(1)" >/dev/null 2>&1 || { echo "FERMO: python non parte"; fermo=1; }
cache="$(pip cache dir 2>/dev/null | tr -d '\r')"
radice="$(cygpath -m "$MYDEV" | tr 'A-Z' 'a-z')"
echo "PIP: cache in $cache"
if [ -z "$cache" ]; then
    echo "FERMO: pip cache dir non risponde"; fermo=1
else
    case "$(echo "$cache" | tr '\\A-Z' '/a-z')" in
        "$radice"/*) ;;
        *) echo "FUORI: la cache di pip non sta nell'unita'"; fuori_pip=1 ;;
    esac
fi

n=$(find "$F" -type f 2>/dev/null | wc -l)
echo "PROFILO: file nel profilo finto $n"
find "$F" -type f 2>/dev/null | sed "s|^|FUORI: |"

mkdir -p "$P/nvim" "$P/venv"
env -u XDG_STATE_HOME LOCALAPPDATA="$(cygpath -w "$P/nvim")" nvim --headless -c 'edit positivo.txt' -c 'normal iuna riga' -c 'write' -c 'qa!' >/dev/null 2>&1
rm -f positivo.txt
p=$(find "$P/nvim" -type f 2>/dev/null | wc -l)
echo "POSITIVO: file del Neovim senza XDG_STATE_HOME $p"
rm -rf "$L-positivo"
env -u VIRTUALENV_OVERRIDE_APP_DATA WIN_PD_OVERRIDE_LOCAL_APPDATA="$(cygpath -w "$P/venv")" WIN_PD_OVERRIDE_APPDATA="$(cygpath -w "$P/venv")" \
    virtualenv --no-periodic-update "$(cygpath -w "$L-positivo")" >/dev/null 2>&1
q=$(find "$P/venv" -type f 2>/dev/null | wc -l)
echo "POSITIVO: file del virtualenv senza VIRTUALENV_OVERRIDE_APP_DATA $q"

if [ "$n" -gt 0 ] || [ -n "$fuori_pip" ]; then echo "ESITO: ROSSO"; exit 1; fi
if [ "$fermo" -ne 0 ] || [ "$p" -eq 0 ] || [ "$q" -eq 0 ]; then echo "ESITO: FERMO"; exit 2; fi
echo "ESITO: VERDE"
exit 0

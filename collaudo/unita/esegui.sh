#!/bin/bash
# Compila ogni progetto C con i compilatori previsti e lo esegue come dice il suo LEGGIMI.md,
# salvando le uscite per il confronto. Si lancia con terminale.bat <radice> <questo script>.
P="$MYDEV/progetti"
OUT="$(cygpath -u "$ESEGUI_OUT")/uscite"
rm -rf "$OUT"; mkdir -p "$OUT"
echo "INIZIO esegui  MYDEV=$MYDEV"

echo "=== confronta.sh --esegui"
bash "$P/confronta.sh" --esegui
# residui lasciati da confronta.sh: si contano PRIMA di ogni pulizia di questo script
residui() { find "$P/c-comuni" "$P/c-processi" -type f ! -name main.c ! -name Makefile ! -name LEGGIMI.md ! -name compile_flags.txt; }
residui | sed 's/^/  residuo di confronta.sh: /'
echo "  residui di confronta.sh: $(residui | wc -l)"

# comandi come nei LEGGIMI.md (15-segnali e' interattivo: non eseguito)
esegui() {
    case "$1" in
        02-argomenti) ./argomenti.exe uno due tre ;;
        06-redirezione) ./redirezione.exe; echo; echo '$ cat uscita_dirottata.txt'; cat uscita_dirottata.txt ;;
        15-segnali) echo "(interattivo)" ;;
        *) ./"$(ls *.exe | head -1)" ;;
    esac
}

pulisci() {   # lascia solo i tre file generati
    find "$1" -maxdepth 1 -type f ! -name main.c ! -name Makefile ! -name LEGGIMI.md -delete
}

echo "=== uscite dei programmi in $OUT"
for dir in "$P"/c-comuni/*/ "$P"/c-processi/*/; do
    nome="$(basename "$dir")"
    compilatori="gcc"
    case "$dir" in */c-comuni/*) compilatori="gcc clang" ;; esac
    for cc in $compilatori; do
        ( cd "$dir" && make clean > /dev/null 2>&1 && make CC=$cc > /dev/null 2>&1 ) || { echo "  $nome $cc: NON COMPILA"; continue; }
        ( cd "$dir" && esegui "$nome" ) > "$OUT/$nome.$cc.txt" 2>&1
        echo "  $nome $cc: rc=$?  righe=$(wc -l < "$OUT/$nome.$cc.txt")"
        ( cd "$dir" && make clean > /dev/null 2>&1 )
        pulisci "$dir"
    done
done

echo "=== residui in progetti (file non generati nelle due famiglie)"
residui | sed 's/^/  /'
echo "  totale residui: $(residui | wc -l)"
echo "FINE esegui"

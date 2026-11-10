#!/bin/bash
# Compila ed esegue la versione Rust di ogni progetto C, salvando le uscite per il confronto.
# Si lancia con terminale.bat <radice> <questo script>, con ESEGUI_OUT in forma Windows.
# Lavora su una copia: nell'unita' non resta nulla. Non giudica: il verdetto e' in verifica_rust.py.
export CARGO_NET_OFFLINE=true
P="$MYDEV/progetti"
O="$(cygpath -u "$ESEGUI_OUT")"
OUT="$O/uscite-rust"
L="$O/copia  rust"
rm -rf "$OUT" "$L"; mkdir -p "$OUT" "$L"
echo "INIZIO esegui_rust  MYDEV=$MYDEV"
cp -r "$P"/rust-simple "$P"/rust-multifile "$P"/rust-comuni "$P"/rust-processi "$L"/

# 15 aspetta tre Ctrl+C: gli si mandano davvero, dopo aver visto che il programma li sta aspettando.
guida_segnali() {
    local u="$OUT/15-segnali.rust.txt" k i pid
    ./target/debug/segnali.exe > "$u" 2>&1 &
    pid=$!
    for k in 0 1 2; do
        for i in $(seq 1 100); do grep -q "ricevuti: $k)" "$u" && break; sleep 0.1; done
        kill -INT "$pid"
    done
    wait "$pid"
}

esegui() {
    case "$1" in
        02-argomenti) cargo run -q --offline -- uno due tre ;;
        06-redirezione) cargo run -q --offline; echo; echo '$ cat uscita_dirottata.txt'; cat uscita_dirottata.txt ;;
        *) cargo run -q --offline ;;
    esac
}

for dir in "$L"/rust-simple/ "$L"/rust-multifile/ "$L"/rust-comuni/*/ "$L"/rust-processi/*/; do
    nome="$(basename "$dir")"
    nome="${nome#rust-}"   # rust-simple e rust-multifile si chiamano come i progetti C
    cd "$dir" || { echo "COMPILA $nome: cartella assente"; continue; }
    cargo build --offline > "$O/build-$nome.log" 2>&1
    rc_b=$?
    echo "COMPILA $nome: uscita $rc_b avvisi $(grep -c '^warning' "$O/build-$nome.log")"
    if [ "$rc_b" -ne 0 ]; then cat "$O/build-$nome.log"; continue; fi
    if [ "$nome" = 15-segnali ]; then
        guida_segnali
        echo "ESEGUE $nome: uscita $?"
    else
        esegui "$nome" > "$OUT/$nome.rust.txt" 2>&1
        echo "ESEGUE $nome: uscita $?"
    fi
done

# simple e multifile non hanno un LEGGIMI con l'atteso: si confrontano col programma C vero.
for nome in simple multifile; do
    cp -r "$P/$nome" "$L/c-$nome"
    ( cd "$L/c-$nome" && make > /dev/null 2>&1 && ./"$(ls *.exe | head -1)" ) > "$OUT/$nome.c.txt" 2>&1
    echo "C $nome: uscita $?"
done

# Il figlio orfano di 11 stampa la sua ultima riga due secondi dopo l'uscita del padre.
sleep 3
echo "FINE esegui_rust"

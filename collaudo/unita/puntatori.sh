#!/bin/bash
# I verificatori del corso sui puntatori, con gli strumenti dell'unita', su copie della sua cartella.
# Si lancia con terminale.bat <radice> <questo script>, con PUNTATORI_OUT in forma Windows.
# Lavora su copie, con la cartella temporanea dentro la cartella di lavoro: nell'unita' non resta nulla.
# Non giudica: il verdetto e' in estesa.ps1. La sonda: un atteso alterato in una copia deve far dire ROTTO.
export CARGO_NET_OFFLINE=true
O="$(cygpath -u "$PUNTATORI_OUT")"
L="$O/copia  puntatori"
S="$O/copia  sonda"
T="$O/temporanei"
rm -rf "$L" "$S" "$T"
mkdir -p "$T"
cp -r "$MYDEV/progetti/puntatori" "$L"
cp -r "$MYDEV/progetti/puntatori" "$S"
# Python dell'unita' e' un programma Windows: MSYS gli passa TEMP e TMP in forma Windows.
export TEMP="$T" TMP="$T"
export CLANG="$(cygpath -w "$MYDEV/llvm/bin/clang.exe")"
echo "INIZIO puntatori  MYDEV=$MYDEV"
cd "$L" || exit 1
python -B strumenti/verifica.py > "$O/puntatori-verifica.log" 2>&1
echo "PASSO verifica: uscita $?"
python -B strumenti/verifica_esempi.py > "$O/puntatori-esempi.log" 2>&1
echo "PASSO verifica_esempi: uscita $?"
cd "$S" || exit 1
sed -i '1s/^/SONDA /' test/v0/attese.txt
python -B strumenti/verifica.py > "$O/puntatori-sonda.log" 2>&1
echo "PASSO sonda: uscita $?"
echo "temporanei rimasti: $(find "$T" -mindepth 1 | wc -l)"
echo "FINE puntatori"

#!/bin/bash
# AddressSanitizer: compila ed esegue lo stesso programma con e senza. Si lancia con terminale.bat <radice> <questo script>.
# Non giudica: scrive uscite e rapporti, il verdetto e' in prova.ps1. La terza compilazione e' la sonda: senza sanitizer.
OUT="$(cygpath -u "$ESEGUI_OUT")/asan  lavoro"
rm -rf "$OUT"; mkdir -p "$OUT"; cd "$OUT" || return 2
cp "$(cygpath -u "$ASAN_SORGENTE")" sconfina.c
clang -g sconfina.c -o senza.exe; echo "compila senza: uscita $?"
clang -g -fsanitize=address sconfina.c -o con.exe; echo "compila con: uscita $?"
clang -g sconfina.c -o finta.exe; echo "compila la sonda: uscita $?"
./senza.exe > senza.out 2>&1; echo $? > senza.rc
# log_path solo relativo: ASAN_OPTIONS si spezza su spazi e due punti.
ASAN_OPTIONS=log_path=rapporto ./con.exe > con.out 2>&1; echo $? > con.rc
ASAN_OPTIONS=log_path=sonda ./finta.exe > finta.out 2>&1; echo $? > finta.rc
for f in rapporto.[0-9]*; do [ -f "$f" ] && cat "$f"; done > rapporto.txt
for f in sonda.[0-9]*; do [ -f "$f" ] && cat "$f"; done > sonda.txt
echo "FINE asan"

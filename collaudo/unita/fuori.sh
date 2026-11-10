#!/bin/bash
# Compila nell'unita' alcuni eseguibili e li mette FUORI (variabile FUORI, formato Windows):
# il lancio lo fa prova.ps1, col solo PATH di sistema.
OUT="$(cygpath -u "$FUORI")"
mkdir -p "$OUT" && rm -f "$OUT"/*.exe
P="$MYDEV/progetti/c-comuni"
clang -std=c11 -Wall -o "$OUT/ciao-clang.exe"                  "$P/01-ciao/main.c"
clang -std=c11 -Wall -pthread -o "$OUT/thread-clang.exe"        "$P/07-thread/main.c"
clang -std=c11 -Wall -pthread -static -o "$OUT/thread-clang-static.exe" "$P/07-thread/main.c"
gcc   -std=c11 -Wall -o "$OUT/ciao-gcc-msys.exe"                "$P/01-ciao/main.c"

#!/bin/bash
# ============================================================================
#  confronta.sh - prova a compilare TUTTI i progetti C con i DUE compilatori
#  del terminale, gcc e clang, e stampa una tabella di cosa ha funzionato.
#
#      gcc   (msys, programmi Cygwin)   ->  c-comuni si', c-processi si'
#      clang (llvm, programmi Windows)  ->  c-comuni si', c-processi no
#
#  Uso:
#      cd "$MYDEV/progetti"
#      bash confronta.sh              compila e basta
#      bash confronta.sh --esegui     compila ED ESEGUE quelli non interattivi
# ============================================================================

QUI="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ESEGUI=0
[ "$1" = "--esegui" ] && ESEGUI=1
CORSA="$(mktemp -d)"
trap 'rm -rf "$CORSA"' EXIT

echo "=================================================================="
echo " gcc   : $(command -v gcc)   ($(gcc -dumpmachine 2>/dev/null || echo assente))"
echo " clang : $(command -v clang)   ($(clang -dumpmachine 2>/dev/null || echo assente))"
echo "=================================================================="
echo

ok_gcc=0
ok_clang=0
totale=0

# Programmi che restano in attesa di qualcosa: si compilano ma non si lanciano
# dentro uno script, o lo bloccherebbero.
#   segnali.exe  aspetta tre Ctrl+C dall'utente
interattivi="segnali.exe"

# Programmi che escono APPOSTA con un valore diverso da zero: non e' un errore.
#   allarme.exe  esce con 1 perche' il tempo e' scaduto: e' il suo scopo
uscita_non_zero="allarme.exe"

# prova <cartella> <compilatore>
#   scrive in CELLA l'esito da stampare e in MOTIVO il primo errore;
#   torna 0 se il progetto compila
prova() {
    dir="$1"
    cc="$2"
    MOTIVO=""

    ( cd "$dir" && make clean > /dev/null 2>&1 )
    uscita="$( cd "$dir" && make CC="$cc" 2>&1 )"
    if [ $? -ne 0 ]; then
        MOTIVO="$(echo "$uscita" | grep -m1 -E 'fatal error|error:' | sed 's/^.*error: //' | cut -c1-50)"
        CELLA="NO"
        ( cd "$dir" && make clean > /dev/null 2>&1 )
        return 1
    fi

    CELLA="compila"
    if [ $ESEGUI -eq 1 ]; then
        bin="$( cd "$dir" && ls ./*.exe 2>/dev/null | head -1 )"
        base="$(basename "$bin" 2>/dev/null)"

        case " $interattivi " in
            *" $base "*)
                CELLA="interattivo" ;;
            *)
                # si esegue in una cartella temporanea: i file che i
                # programmi creano (elenco.txt, studenti.dat, ...) non
                # restano nei progetti
                ( cd "$CORSA" && "${dir%/}/$base" uno due > /dev/null 2>&1 )
                rc=$?
                case " $uscita_non_zero " in
                    *" $base "*)
                        if [ $rc -ne 0 ]; then CELLA="OK (esce $rc, voluto)"
                        else                   CELLA="INATTESO (esce 0)"; fi ;;
                    *)
                        if [ $rc -eq 0 ]; then CELLA="OK"
                        else                   CELLA="ERRORE (esce $rc)"; fi ;;
                esac ;;
        esac
    fi

    ( cd "$dir" && make clean > /dev/null 2>&1 )
    return 0
}

prova_famiglia() {
    famiglia="$1"
    attesa="$2"

    echo "--- $famiglia   (atteso: $attesa) ---"
    printf "  %-26s  %-22s  %s\n" "progetto" "gcc" "clang"

    for dir in "$QUI/$famiglia"/*/; do
        [ -d "$dir" ] || continue
        nome="$(basename "$dir")"
        totale=$((totale+1))

        prova "$dir" gcc   && ok_gcc=$((ok_gcc+1))
        cella_gcc="$CELLA"; motivo_gcc="$MOTIVO"
        prova "$dir" clang && ok_clang=$((ok_clang+1))
        cella_clang="$CELLA"; motivo_clang="$MOTIVO"

        printf "  %-26s  %-22s  %s" "$nome" "$cella_gcc" "$cella_clang"
        [ -n "$motivo_clang" ] && printf "  %s" "$motivo_clang"
        echo
        [ -n "$motivo_gcc" ] && echo "      gcc: $motivo_gcc"
    done
    echo
}

prova_famiglia c-comuni   "tutti e 9 con gcc e con clang"
prova_famiglia c-processi "tutti e 12 con gcc, NESSUNO con clang"

echo "=================================================================="
echo " compilati con gcc   : $ok_gcc su $totale"
echo " compilati con clang : $ok_clang su $totale"
echo "=================================================================="
echo
echo " I 'NO' di clang NON sono un errore tuo: fork, exec, pipe, segnali e"
echo " socket esistono solo per i programmi di gcc. Per c-processi si usa gcc"
echo " (basta 'make'); clang serve quando il .exe deve girare fuori di qui."

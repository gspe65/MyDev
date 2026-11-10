#!/bin/bash
# Avvia il server locale dell'unita'. L'uscita va in un file: nginx resta acceso e tiene aperto cio' che eredita.
nginxstart > "$(cygpath -u "$SERVER_LOG")" 2>&1 < /dev/null
sleep 2

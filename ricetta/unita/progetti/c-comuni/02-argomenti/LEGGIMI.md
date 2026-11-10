# 02 — Argomenti e valore di uscita

**Compilatore:** **tutti e due**

Mostra come un programma riceve dati dalla riga di comando e come comunica alla shell se e' andato tutto bene.

## Comandi

```bash
make
./argomenti.exe uno due tre
echo $?      # -> 0
./argomenti.exe
echo $?      # -> 1
```

## Cosa devi vedere

```
mi chiamo          : ./argomenti
argomenti ricevuti : 3
  argv[1] = uno
  argv[2] = due
  argv[3] = tre
```

## Prova tu

Fai in modo che il programma sommi due numeri passati come argomenti.
Ti servira' `atoi(argv[1])` (in `<stdlib.h>`).

> Compilato con `gcc`, `argv[0]` esce senza `.exe`; con `clang` esce come percorso Windows completo (`C:\...\argomenti.exe`). E' il primo posto in cui i due mondi si vedono, e non e' un errore.

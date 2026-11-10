# 15 — Segnali

**Compilatore:** **solo `gcc`**

Il programma si manda un `SIGUSR1` da solo, poi cattura il `Ctrl+C` (`SIGINT`) invece di morire: lo conta, e al terzo esce ordinatamente.

## Comandi

```bash
make
./segnali.exe
# poi premi Ctrl+C tre volte
```

## Cosa devi vedere

```
mi mando un SIGUSR1...
SIGUSR1 ricevuto: si

sono il processo 1140. Ora premi Ctrl+C. Al terzo esco.
  ...sto lavorando (Ctrl+C ricevuti: 0)
  ...sto lavorando (Ctrl+C ricevuti: 1)
  ...sto lavorando (Ctrl+C ricevuti: 2)

tre interruzioni, esco con calma.
```

## Prova tu

Da un **secondo** terminale, mentre il programma gira, mandagli i segnali da fuori (il PID lo stampa lui):

```bash
kill -INT 1140     # come un Ctrl+C
kill -USR1 1140
```

Poi prova `kill -KILL 1140`: quello **non** e' catturabile, e il programma muore all'istante. E' il motivo per cui `kill -9` funziona sempre — e per cui non lascia al programma il tempo di salvare niente.

# 15 — Segnali

**Compilatore:** `cargo`

Il programma si manda un `SIGUSR1` da solo, poi cattura il `Ctrl+C` (`SIGINT`) invece di morire: lo conta, e al terzo esce ordinatamente.

## Comandi

```bash
cargo run
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

## Dove sta l'`unsafe`

Nel blocco `unsafe extern "C"` in cima e in ogni chiamata. La parte piu' pericolosa non e' una chiamata: e' la struct `Sigaction`. Il compilatore non conosce quella del sistema, e la dichiarazione scritta qui deve avere gli stessi campi agli stessi posti, o il gestore non parte, senza messaggi. E' stata misurata su questa piattaforma, con `offsetof` del C. Anche il numero di `SIGUSR1` cambia da un sistema all'altro.

Il gestore gira nel mezzo di qualunque altra istruzione: dentro non si puo' usare quasi niente, nemmeno `println!`, che potrebbe trovare chiuso il lucchetto dello schermo.

## Prova tu

Da un **secondo** terminale, mentre il programma gira, mandagli i segnali da fuori (il PID lo stampa lui):

```bash
kill -INT 1140     # come un Ctrl+C
kill -USR1 1140
```

Poi prova `kill -KILL 1140`: quello **non** e' catturabile, e il programma muore all'istante.

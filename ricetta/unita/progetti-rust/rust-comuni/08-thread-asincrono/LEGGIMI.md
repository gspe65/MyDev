# 08 — Asincronia con i thread

**Compilatore:** `cargo`

Un thread fa un lavoro lungo, il thread principale intanto disegna la barra di avanzamento. Nessuno dei due sta fermo ad aspettare l'altro.

## Comandi

```bash
cargo run
```

## Cosa devi vedere

```
faccio partire il lavoro e NON mi blocco

  avanzamento: [########............]  40%

lavoro finito.
```

## Dove sta l'`unsafe`

Nessuno: la libreria standard ha thread, pause e lucchetti.

## Prova tu

Sposta `lavoro.join().unwrap();` subito dopo `thread::spawn`. Ricompila.
La barra non si muove piu': il programma e' tornato **sincrono**, si blocca ad aspettare e riprende solo alla fine.

Il progetto 19 fa la stessa cosa con i **processi**.

> `\r` riporta il cursore a inizio riga senza andare a capo: e' cosi' che si riscrive la stessa riga. Se mandi l'output in un file vedrai tutte le righe intermedie, perche' nei file `\r` non cancella niente.

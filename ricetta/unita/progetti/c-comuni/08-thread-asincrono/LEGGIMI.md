# 08 — Asincronia con i thread

**Compilatore:** **tutti e due**

Un thread fa un lavoro lungo, il thread principale intanto disegna la barra di avanzamento. Nessuno dei due sta fermo ad aspettare l'altro.

## Comandi

Dal terminale, nella cartella del progetto: `cd c-comuni/08-thread-asincrono`

```bash
make
./asincrono.exe
```

## Cosa devi vedere

```
faccio partire il lavoro e NON mi blocco

  avanzamento: [########............]  40%

lavoro finito.
```

## Prova tu

Sposta `pthread_join` subito dopo `pthread_create`. Ricompila.
La barra non si muove più: il programma è tornato **sincrono**, si blocca ad aspettare e riprende solo alla fine.

Il progetto 19 fa la stessa cosa con i **processi**.

> `\r` riporta il cursore a inizio riga senza andare a capo: è così che si riscrive la stessa riga. Se mandi l'output in un file vedrai tutte le righe intermedie, perché nei file `\r` non cancella niente.

# 19 — Processi asincroni

**Compilatore:** `cargo`

Tre figli con durate diverse. Il padre non si blocca ad aspettarli: continua a lavorare e li raccoglie man mano che finiscono. E' il gemello del progetto 08, con i processi al posto dei thread.

## Comandi

```bash
cargo run
```

## Cosa devi vedere

```
[padre] avviato figlio 0 (pid 1008, durera' 3 s)
[padre] avviato figlio 1 (pid 1009, durera' 1 s)
[padre] avviato figlio 2 (pid 1010, durera' 2 s)

[padre] tutti avviati. Intanto lavoro io.

  [padre] giro 1, ancora 3 figli al lavoro
  [padre] giro 2, ancora 3 figli al lavoro
  -> il figlio 1009 ha finito (valore 11)
  [padre] giro 3, ancora 2 figli al lavoro
  -> il figlio 1010 ha finito (valore 12)
  [padre] giro 4, ancora 1 figli al lavoro
  -> il figlio 1008 ha finito (valore 10)

[padre] tutti finiti dopo 4 giri di lavoro mio.
```

## Dove sta l'`unsafe`

Nel blocco `unsafe extern "C"` in cima e nelle chiamate a `fork`, `waitpid`, `sleep` e `_exit`. Per la pausa di mezzo secondo basta invece `thread::sleep` della libreria standard.

## Prova tu

Guarda l'ordine: finisce prima il figlio **1**, che dorme un secondo, anche se e' stato creato per secondo.

Ora togli `WNOHANG` (metti `0` al suo posto) e rilancia: il padre si blocca sul primo figlio e le righe "giro N" spariscono. Il programma e' tornato **sincrono**.

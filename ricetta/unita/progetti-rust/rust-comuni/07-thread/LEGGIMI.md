# 07 — Thread e mutex

**Compilatore:** `cargo`

Quattro thread aumentano lo stesso contatore 100 000 volte ciascuno. Il totale deve fare 400 000.

## Comandi

```bash
cargo run
```

## Cosa devi vedere

```
avvio 4 thread, 100000 incrementi ciascuno
  thread 0 ha finito
  thread 1 ha finito
  thread 2 ha finito
  thread 3 ha finito
contatore = 400000 (atteso 400000)
```

## Dove sta l'`unsafe`

Nessuno: `std::thread` e `Mutex` fanno il lavoro che in C fanno `pthread_create` e `pthread_mutex_lock`.

## Prova tu

**L'esperimento del C qui non si riesce nemmeno a scrivere.** Togli il `Mutex`: dichiara `static CONTATORE: i64 = 0;` e scrivi `CONTATORE += 1;`. Non compila. Rust non ti lascia modificare una variabile condivisa senza un lucchetto: la *race condition* del progetto C viene fermata prima di partire.

Per vederla davvero serve `unsafe`, e il progetto 18 la fa accadere con i processi: mettili a confronto.

> L'ordine in cui i thread finiscono cambia a ogni esecuzione, ed e' normale: nessuno garantisce chi arriva prima.

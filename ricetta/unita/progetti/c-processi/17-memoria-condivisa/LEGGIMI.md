# 17 — Memoria condivisa

**Compilatore:** **solo `gcc`**

Dimostra la differenza fra memoria normale e memoria condivisa dopo una `fork`. E' il contraltare del progetto 07: i thread condividono tutto, i processi niente — a meno che tu non lo chieda esplicitamente.

## Comandi

```bash
make
./memoria.exe
```

## Cosa devi vedere

```
  [figlio] normale = 999   condiviso = 999
[padre]  normale   = 100  <- il figlio l'aveva messo a 999!
[padre]  condiviso = 999  <- questo si': e' la STESSA memoria
[padre]  messaggio = scritto dal figlio
```

## Prova tu

Cambia `MAP_SHARED` in `MAP_PRIVATE` e ricompila.
Ora anche `condiviso` resta 100: con `MAP_PRIVATE` ogni processo ha la sua copia, e le modifiche non escono da li'.

> L'IPC System V (`shmget`, `msgget`, `semget`) che trovi sui libri **non funziona** in questo ambiente: gli header ci sono ma le funzioni rispondono `Function not implemented`. Gli equivalenti POSIX usati qui (`mmap`, `sem_init`, `mkfifo`) funzionano tutti, e sono anche quelli consigliati oggi.

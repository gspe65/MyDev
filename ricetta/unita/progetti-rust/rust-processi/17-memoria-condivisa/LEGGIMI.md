# 17 — Memoria condivisa

**Compilatore:** `cargo`

Dimostra la differenza fra memoria normale e memoria condivisa dopo una `fork`. E' il contraltare del progetto 07: i thread condividono tutto, i processi niente — a meno che tu non lo chieda esplicitamente.

## Comandi

```bash
cargo run
```

## Cosa devi vedere

```
  [figlio] normale = 999   condiviso = 999
[padre]  normale   = 100  <- il figlio l'aveva messo a 999!
[padre]  condiviso = 999  <- questo si': e' la STESSA memoria
[padre]  messaggio = scritto dal figlio
```

## Dove sta l'`unsafe`

Nel blocco `unsafe extern "C"` in cima, in ogni chiamata, e in ogni accesso a `*c`. Un puntatore grezzo non porta nessuna garanzia: che punti a una pagina valida e che nessun altro la stia toccando lo prometti tu, ed e' scritto nel commento `SICUREZZA`. La promessa regge perche' il padre aspetta il figlio: nel progetto 18 i due lavorano insieme, e infatti serve un semaforo.

## Prova tu

Cambia `MAP_SHARED` in `MAP_PRIVATE`, che vale 2, e ricompila.
Ora anche `condiviso` resta 100: con `MAP_PRIVATE` ogni processo ha la sua copia, e le modifiche non escono da li'.

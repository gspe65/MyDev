# 18 — Semafori fra processi

**Compilatore:** `cargo`

Due processi aumentano lo stesso contatore in memoria condivisa, prima senza protezione e poi con un semaforo. E' il gemello del progetto 07: stesso problema, stessa soluzione, ma con i processi.

## Comandi

```bash
cargo run
```

## Cosa devi vedere

```
=== SENZA semaforo ===
  [figlio] ha finito i suoi 50000 incrementi
  [padre]  ha finito i suoi 50000 incrementi
  contatore = 63417   (atteso 100000)  <- MANCANO INCREMENTI

=== CON semaforo ===
  [figlio] ha finito i suoi 50000 incrementi
  [padre]  ha finito i suoi 50000 incrementi
  contatore = 100000   (atteso 100000)  corretto
```

## Dove sta l'`unsafe`

Dappertutto, ed e' giusto che si veda. Nel progetto 07 il compilatore rifiutava l'errore: qui non puo', perche' la memoria condivisa fra processi e' un puntatore grezzo che arriva dal sistema. La gara senza semaforo e' scritta **apposta** dentro un blocco `unsafe`: il commento `SICUREZZA` lo dice, e la promessa e' falsa di proposito, per vederla cadere.

`read_volatile` e `write_volatile` impediscono al compilatore di fondere i giri in una somma sola. La struct `Condiviso` deve avere lo stesso `sem_t` del sistema: qui occupa 8 byte, misurati col compilatore C.

## Prova tu

Il numero della prima prova e' **diverso ogni volta**: lancia il programma cinque volte di fila e guardalo cambiare.

Apri affiancati questo `main.rs` e quello del progetto 07: `sem_wait` sta esattamente dove sta `lock()`, ma qui nessuno ti obbliga a metterlo.

> Puo' capitare che anche la prova senza semaforo dia il numero giusto: vuol dire solo che stavolta i due processi non si sono pestati i piedi. Rilancia: un programma che funziona *a volte* e' rotto.

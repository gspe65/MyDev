# 18 — Semafori fra processi

**Compilatore:** **solo `gcc`**

Due processi aumentano lo stesso contatore in memoria condivisa, prima senza protezione e poi con un semaforo. E' il gemello del progetto 07: stesso problema, stessa soluzione, ma con i processi.

## Comandi

```bash
make
./semafori.exe
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

## Prova tu

Il numero della prima prova e' **diverso ogni volta**: lancia il programma cinque volte di fila e guardalo cambiare. Non e' un errore casuale del computer: e' il momento esatto in cui i due processi si sovrappongono, che dipende da mille cose.

Apri affiancati questo `main.c` e quello del progetto 07: `sem_wait` sta esattamente dove sta `pthread_mutex_lock`.

> Puo' capitare che anche la prova senza semaforo dia il numero giusto: vuol dire solo che stavolta i due processi non si sono pestati i piedi. Rilancia: un programma che funziona *a volte* e' rotto.

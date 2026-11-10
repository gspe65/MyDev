# 11 — Zombie e orfani

**Compilatore:** **solo `gcc`**

Mostra dal vivo le due situazioni che si citano sempre a lezione: un figlio morto e non ancora aspettato (zombie) e un figlio che sopravvive al padre (orfano, che viene adottato).

## Comandi

```bash
make
./zombie.exe
```

## Cosa devi vedere

```
=== ZOMBIE ===
  [figlio 1234] finisco subito
  [padre] il figlio 1234 e' morto un secondo fa e io non l'ho
          ancora aspettato: adesso e' uno ZOMBIE.
          Da un altro terminale lo vedresti con:  ps
  [padre] ho chiamato wait(): lo zombie e' sparito

=== ORFANO ===
  [figlio 1236] mio padre adesso e' 1230
  [padre 1230] esco subito, senza aspettare il figlio
[main] il programma principale termina.
  [figlio 1236] mio padre adesso e' 1  <- sono stato adottato
```

## Prova tu

L'ultima riga arriva **dopo** che il terminale e' gia' tornato ad aspettarti: il figlio orfano continua a girare anche se chi lo ha creato ha finito.

Per vedere lo zombie con i tuoi occhi apri un **secondo** terminale da `Terminale.exe` e, mentre il programma e' fermo nel `sleep(1)`, scrivi `ps`. Il figlio compare ancora nell'elenco, pur essendo gia' morto.

> Il numero del "nuovo padre" dell'orfano dipende dal sistema: puo' essere `1` o un altro processo di servizio. Quello che conta e' che **cambia**.

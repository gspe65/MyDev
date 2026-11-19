# 11 — Zombie e orfani

**Compilatore:** `cargo`

Mostra dal vivo le due situazioni che si citano sempre a lezione: un figlio morto e non ancora aspettato (zombie) e un figlio che sopravvive al padre (orfano, che viene adottato).

## Comandi

```bash
cargo run
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

## Dove sta l'`unsafe`

Nel blocco `unsafe extern "C"` in cima e in ogni chiamata a `fork`, `getpid`, `getppid`, `sleep`, `wait` e `_exit`. Il compilatore non vede zombie e orfani: per lui `fork` è una funzione come un'altra, e non aspettare un figlio non è un errore.

## Prova tu

L'ultima riga arriva **dopo** che il terminale è già tornato ad aspettarti: il figlio orfano continua a girare anche se chi lo ha creato ha finito.

Per vedere lo zombie con i tuoi occhi apri un **secondo** terminale e, mentre il programma è fermo nel `sleep(1)`, scrivi `ps`. Il figlio compare ancora nell'elenco, pur essendo già morto.

> Il numero del "nuovo padre" dell'orfano dipende dal sistema: può essere `1` o un altro processo di servizio. Quello che conta è che **cambia**.

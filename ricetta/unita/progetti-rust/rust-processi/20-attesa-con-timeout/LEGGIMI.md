# 20 — Aspettare con un timeout

**Compilatore:** `cargo`

Il figlio manda un messaggio ogni due secondi; il padre aspetta al massimo un secondo per volta, cosi' non resta mai bloccato a lungo. E' l'altra faccia dell'asincronia: non "lancio e continuo", ma "aspetto, pero' con una scadenza".

## Comandi

```bash
cargo run
```

## Cosa devi vedere

```
  ...un secondo senza notizie, intanto faccio altro (1)
-> ricevuto: messaggio numero 1
  ...un secondo senza notizie, intanto faccio altro (2)
-> ricevuto: messaggio numero 2
  ...un secondo senza notizie, intanto faccio altro (3)
  ...un secondo senza notizie, intanto faccio altro (4)
-> ricevuto: messaggio numero 3

messaggi ricevuti: 3, attese a vuoto: 4
```

## Dove sta l'`unsafe`

Nel blocco `unsafe extern "C"` in cima e in ogni chiamata, e nella struct `PollFd`, che deve avere la forma di `struct pollfd` del sistema: un intero e due `short`, 8 byte. Il secondo argomento di `poll` qui e' grande 4 byte: su Linux sono 8, e un programma copiato da li' sbaglierebbe senza dirlo.

## Prova tu

Metti `-1` come terzo argomento di `poll`: vuol dire "aspetta per sempre". Le righe "un secondo senza notizie" spariscono, perche' il padre resta bloccato fino all'arrivo del messaggio.

Poi rimetti `1000` e cambia il `sleep(2)` del figlio in `sleep(5)`: le attese a vuoto diventano molte di piu'.

> Il numero di attese a vuoto puo' variare di uno fra un'esecuzione e l'altra: dipende da come cadono i tempi.

# 20 — Aspettare con un timeout

**Compilatore:** **solo `gcc`**

Il figlio manda un messaggio ogni due secondi; il padre aspetta al massimo un secondo per volta, così non resta mai bloccato a lungo. È l'altra faccia dell'asincronia: non "lancio e continuo", ma "aspetto, però con una scadenza".

## Comandi

Dal terminale, nella cartella del progetto: `cd c-processi/20-attesa-con-timeout`

```bash
make
./timeout.exe
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

## Prova tu

Metti `-1` come terzo argomento di `poll`: vuol dire "aspetta per sempre". Le righe "un secondo senza notizie" spariscono, perché il padre resta bloccato fino all'arrivo del messaggio.

Poi rimetti `1000` e cambia il `sleep(2)` del figlio in `sleep(5)`: le attese a vuoto diventano molte di più.

> Il numero di attese a vuoto può variare di uno fra un'esecuzione e l'altra: dipende da come cadono i tempi.

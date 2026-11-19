# 21 — Socket TCP

**Compilatore:** **solo `gcc`**

Un servitore e un cliente si scambiano due righe su `127.0.0.1`. È lo stesso codice che useresti fra due computer diversi: cambia solo l'indirizzo.

## Comandi

Dal terminale, nella cartella del progetto: `cd c-processi/21-socket`

```bash
make
./socket.exe
```

## Cosa devi vedere

```
[servitore] in ascolto su 127.0.0.1 porta 51234
[servitore] ho ricevuto: ciao, sono il cliente
  [cliente] il servitore mi ha risposto: ricevuto forte e chiaro
[servitore] conversazione chiusa.
```

## Prova tu

Metti una porta fissa al posto dello 0, per esempio `indirizzo.sin_port = htons(9000);`. Ricompila e lancia il programma **due volte insieme** (il secondo da un altro terminale): il secondo fallisce con `bind: Address already in use`. Una porta può essere occupata da un solo programma per volta: è il motivo per cui i servizi devono mettersi d'accordo sulle porte.

> `htons` e `htonl` convertono i numeri nell'ordine dei byte usato in rete, che può essere diverso da quello del processore. Vanno usate sempre, anche in locale.

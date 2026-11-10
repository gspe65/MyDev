# 21 — Socket TCP

**Compilatore:** `cargo`

Un servitore e un cliente si scambiano due righe su `127.0.0.1`. E' lo stesso codice che useresti fra due computer diversi: cambia solo l'indirizzo.

## Comandi

```bash
cargo run
```

## Cosa devi vedere

```
[servitore] in ascolto su 127.0.0.1 porta 51234
[servitore] ho ricevuto: ciao, sono il cliente
  [cliente] il servitore mi ha risposto: ricevuto forte e chiaro
[servitore] conversazione chiusa.
```

## Dove sta l'`unsafe`

Nel blocco `unsafe extern "C"` in cima e in ogni chiamata, e nella struct `SockaddrIn`, che deve avere la forma di quella del sistema. La libreria standard ha `std::net::TcpListener`, senza `unsafe`: qui le mosse si chiamano una per una proprio per vederle, e in un programma vero si userebbe quella.

## Prova tu

Metti una porta fissa al posto dello 0, per esempio `sin_port: 9000u16.to_be()`. Ricompila e lancia il programma **due volte insieme** (il secondo da un altro terminale): il secondo fallisce con `bind: Address already in use`. Una porta puo' essere occupata da un solo programma per volta: e' il motivo per cui i servizi devono mettersi d'accordo sulle porte.

> `to_be` e `from_be` convertono i numeri nell'ordine dei byte usato in rete, che puo' essere diverso da quello del processore. Vanno usate sempre, anche in locale.

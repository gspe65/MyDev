# 04 — Memoria dinamica

**Compilatore:** `cargo`

Un array la cui dimensione si decide durante l'esecuzione. In C sono `malloc`, `realloc` e `free`; qui un `Vec`, con le stesse tre mosse scritte una per una.

## Comandi

```bash
cargo run
```

## Cosa devi vedere

```
dopo malloc:           [10 20 30 40 50]  (5 elementi)
dopo realloc:          [10 20 30 40 50 60 70 80 90 100]  (10 elementi)
memoria restituita.
```

## Dove sta l'`unsafe`

Nessuno, ed e' il punto: dentro il `Vec` ci sono proprio una `malloc` e una `realloc`, ma chi lo usa non puo' sbagliarle.

## Prova tu

Aggiungi una riga sbagliata apposta, `v[50] = 1;` prima della `drop`, e rilancia: il programma si ferma e dice a quale riga hai scritto fuori dall'array, senza bisogno di AddressSanitizer.

Poi usa `v` dopo la `drop`: in C la stessa svista compila e fa danni, qui il programma non si compila.

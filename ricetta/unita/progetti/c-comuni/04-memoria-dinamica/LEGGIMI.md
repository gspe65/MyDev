# 04 — Memoria dinamica

**Compilatore:** **tutti e due**

Un array la cui dimensione si decide durante l'esecuzione: `malloc` per chiederla, `realloc` per cambiarla, `free` per restituirla.

## Comandi

```bash
make
./memoria.exe
```

## Cosa devi vedere

```
dopo malloc:           [10 20 30 40 50]  (5 elementi)
dopo realloc:          [10 20 30 40 50 60 70 80 90 100]  (10 elementi)
memoria restituita.
```

## Prova tu

Aggiungi una riga sbagliata apposta, per esempio `v[50] = 1;` prima della `free`, e compila con clang invece che con gcc:

```bash
clang -g -fsanitize=address -o memoria.exe main.c
./memoria.exe
```

Ti dice esattamente che hai scritto fuori dall'array e a quale riga. E' il modo piu' rapido per capire un errore di memoria.

> Le **perdite** di memoria (dimenticare la `free`) non sono invece rilevabili su Windows: per quelle serve un vero Linux.

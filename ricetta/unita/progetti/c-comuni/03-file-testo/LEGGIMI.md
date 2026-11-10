# 03 — Leggere e scrivere un file di testo

**Compilatore:** **tutti e due**

Crea `elenco.txt`, lo rilegge e conta le righe. Le stesse funzioni (`fopen`, `fprintf`, `fgets`) si usano identiche su Linux e su Windows.

## Comandi

```bash
make
./file.exe
cat elenco.txt
make clean
```

## Cosa devi vedere

```
ho scritto elenco.txt, ora lo rileggo:
  riga 1: mela
  riga 2: pera
  riga 3: arancia
righe totali: 3
```

## Prova tu

Aggiungi un quarto frutto. Poi apri il file con `"a"` (append) invece di `"w"` e rilancia due volte: cosa cambia?

> `make clean` non cancella `elenco.txt`: l'ha creato il programma, non il compilatore. Se vuoi, aggiungilo tu alla regola `clean`.

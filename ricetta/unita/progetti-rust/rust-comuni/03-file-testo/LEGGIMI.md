# 03 — Leggere e scrivere un file di testo

**Compilatore:** `cargo`

Crea `elenco.txt`, lo rilegge e conta le righe.

## Comandi

```bash
cargo run
cat elenco.txt
```

## Cosa devi vedere

```
ho scritto elenco.txt, ora lo rileggo:
  riga 1: mela
  riga 2: pera
  riga 3: arancia
righe totali: 3
```

## Dove sta l'`unsafe`

Nessuno: la libreria standard copre tutto.

## Prova tu

Aggiungi un quarto frutto. Poi apri il file in aggiunta invece di azzerarlo, con `std::fs::OpenOptions::new().append(true).create(true).open(NOMEFILE)`, e rilancia due volte: cosa cambia?

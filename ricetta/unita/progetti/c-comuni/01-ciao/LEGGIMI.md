# 01 — Ciao mondo

**Compilatore:** **tutti e due** (`gcc` e `clang`)

Stampa una riga ed esce. Se questo funziona, l'ambiente è a posto.

## Comandi

Dal terminale, nella cartella del progetto: `cd c-comuni/01-ciao`

```bash
make
./ciao.exe
make clean
make CC=clang
./ciao.exe
make clean
```

## Cosa devi vedere

```
Ciao, mondo!
```

## Prova tu

Fai stampare anche il tuo nome, su una seconda riga.
Poi togli il `\n` dalla prima `printf` e guarda cosa cambia.

# Progetti C (e C++)

Ambiente portabile con **GCC 15** (MSYS2), **clang 23** (llvm-mingw) e **GNU Make**, eseguiti dentro bash (mintty).

---

## Struttura

```
progetti/
├── simple/          # progetto a singolo file: si parte da qui
├── multifile/       # progetto multi-file con header
├── c-comuni/        # nove progetti per tutti e due i compilatori
├── c-processi/      # dodici progetti sui processi, solo con gcc
├── flask-hello/     # un server Python con Flask
├── fastapi-hello/   # un server Python con FastAPI
├── confronta.sh     # compila i progetti C con i due compilatori e li confronta
├── GUIDA-C.md       # la guida completa
└── Avvio-C.md       # questo file
```

---

## Comandi essenziali

| Comando       | Effetto                              |
|---------------|--------------------------------------|
| `make`        | compila il progetto                  |
| `make clean`  | rimuove gli eseguibili e i `.o`      |
| `./main.exe`  | esegue il programma compilato        |

---

## Progetto `simple`

Struttura minima, un solo sorgente.

```
simple/
├── main.c
└── Makefile
```

---

## Progetto `multifile`

Sorgenti separati con header condiviso.

```
multifile/
├── main.c
├── utils.c
├── utils.h
└── Makefile
```

Il Makefile gestisce la compilazione per unità (`-c`) e il linking separato. Aggiungere nuovi file richiede una nuova regola `.o` e di includerla nella lista dei prerequisiti di `multifile.exe`.

---

## Note GCC

- `-Wall` — abilita i warning principali, sempre consigliato
- `-O2` — ottimizzazione bilanciata per il rilascio
- `-g` — include i simboli di debug (per usare `gdb`)
- `-o nome.exe` — specifica il nome dell'eseguibile

Esempio compilazione manuale:
```bash
gcc -Wall -O2 -o programma.exe main.c
```

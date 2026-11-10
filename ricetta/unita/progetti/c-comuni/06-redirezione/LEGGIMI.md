# 06 — Redirezione con dup2

**Compilatore:** **tutti e due**

Il programma dirotta il proprio `stdout` dentro un file, ci scrive, e poi lo rimette a posto. E' il meccanismo con cui la shell realizza il `>`.

## Comandi

```bash
make
./redirezione.exe
cat uscita_dirottata.txt
```

## Cosa devi vedere

```
questa riga va sullo schermo
e siamo tornati sullo schermo
guarda il file con:  cat uscita_dirottata.txt

$ cat uscita_dirottata.txt
questa riga finisce nel file
e anche questa
```

## Prova tu

Togli il `fflush(stdout)` del punto 4 e rilancia: le due righe potrebbero finire **sullo schermo** invece che nel file. Erano ancora nel buffer quando hai rimesso a posto il canale.

Poi prova a redirigere il canale 2 (`STDERR_FILENO`) usando `fprintf(stderr, ...)`.

> Questo progetto sta fra i comuni proprio perche' dimostra il confine: i canali e la redirezione sono di Windows quanto di Unix. Il muro comincia con `fork`.

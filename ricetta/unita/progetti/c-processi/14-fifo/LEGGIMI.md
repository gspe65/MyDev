# 14 — FIFO: la pipe con un nome

**Compilatore:** **solo `gcc`**

Crea una FIFO sul disco e la usa per far parlare due processi. A differenza della pipe del progetto 13, una FIFO ha un nome: possono usarla anche programmi che non sono parenti fra loro.

## Comandi

```bash
make
./fifo.exe
```

## Cosa devi vedere

```
ho creato la FIFO 'mio_tubo'. Guardala con:  ls -l mio_tubo
(la 'p' come primo carattere dei permessi vuol dire pipe)

[padre] ricevuto: primo messaggio
[padre] ricevuto: secondo messaggio
[padre] ricevuto: terzo messaggio
[padre] il figlio ha chiuso, tubo rimosso.
```

## Prova tu

**La prova che vale la pena fare** e' con due terminali. In uno:

```bash
mkfifo tubo
cat tubo
```

`cat` resta li' fermo. Nell'altro terminale:

```bash
echo "ciao dall'altro terminale" > tubo
```

La riga compare nel primo. Due programmi che non si conoscono si sono parlati attraverso un nome sul disco. Poi `rm tubo`.

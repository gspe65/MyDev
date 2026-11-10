# 10 — fork(): un processo diventa due

**Compilatore:** **solo `gcc`**

Il programma si duplica. Il figlio si presenta ed esce con il valore 7, il padre lo aspetta e legge quel valore.

## Comandi

```bash
make
./fork.exe
```

## Cosa devi vedere

```
prima della fork: sono il processo 964
[padre] ho creato il figlio 966, ora lo aspetto
  [figlio] sono 966, mio padre e' 964
  [figlio] esco con il valore 7
[padre] il figlio 966 e' uscito con 7
```

## Prova tu

Togli il primo `fflush(stdout)` e rilancia mandando l'output in un file:

```bash
./fork.exe > uscita.txt
cat uscita.txt
```

Vedrai la prima riga **due volte**: il figlio ha ereditato il buffer ancora pieno e lo ha stampato anche lui. Sullo schermo non succede, perche' li' il buffer si svuota a ogni a-capo.

> Se provi a compilarlo con `make CC=clang` ottieni `fatal error: 'sys/wait.h' file not found`. Non e' un errore tuo: quella funzione su Windows non c'e'.

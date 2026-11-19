# 12 — exec(): diventare un altro programma

**Compilatore:** **solo `gcc`**

Il figlio si trasforma nel comando `date`. È la seconda metà del meccanismo con cui una shell esegue i comandi: prima `fork`, poi `exec`.

## Comandi

Dal terminale, nella cartella del progetto: `cd c-processi/12-exec`

```bash
make
./exec.exe
```

## Cosa devi vedere

```
[padre] sono 1230, ora creo un figlio
  [figlio] sono 1231, sto per diventare il comando 'date'
oggi e' il 06/09/1999
[padre] il figlio 1231 e' uscito con 0
[padre] nota: il figlio aveva lo stesso PID prima e dopo exec
```

## Prova tu

Aggiungi una `printf` **subito dopo** la `execlp`, prima della `perror`. Ricompila e rilancia: quella riga non compare mai, perché se exec riesce il codice che la contiene non esiste più.

Poi cambia `"date"` in `"comando_inventato"`: ora exec fallisce, la `perror` viene eseguita e il figlio esce con 127.

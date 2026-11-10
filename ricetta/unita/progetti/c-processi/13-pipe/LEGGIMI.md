# 13 — pipe(): due processi che si parlano

**Compilatore:** **solo `gcc`**

Il figlio esegue `ls -l` scrivendo nella pipe; il padre legge e conta le righe. E' il meccanismo con cui la shell realizza il carattere `|`.

## Comandi

```bash
make
./pipe.exe
```

## Cosa devi vedere

```
[padre] ecco cosa mi manda il figlio:
total 77
-rw-r--r-- 1 ... LEGGIMI.md
-rw-r--r-- 1 ... main.c
-rw-r--r-- 1 ... Makefile
-rwxr-xr-x 1 ... pipe.exe
[padre] righe ricevute: 5
```

## Prova tu

Commenta la riga `close(fd[1]);` del padre e rilancia.
Il programma si **pianta**: la `read` aspetta per sempre, perche' c'e' ancora un'estremita' di scrittura aperta — la sua. Premi Ctrl+C.

Poi sostituisci `ls -l` con `date` oppure con `ps`.

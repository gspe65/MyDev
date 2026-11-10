# 13 — pipe(): due processi che si parlano

**Compilatore:** `cargo`

Il figlio esegue `ls -l` scrivendo nella pipe; il padre legge e conta le righe. E' il meccanismo con cui la shell realizza il carattere `|`.

## Comandi

```bash
cargo run
```

## Cosa devi vedere

```
[padre] ecco cosa mi manda il figlio:
total 77
-rw-r--r-- 1 ... Cargo.lock
-rw-r--r-- 1 ... Cargo.toml
-rw-r--r-- 1 ... LEGGIMI.md
drwxr-xr-x 1 ... src
drwxr-xr-x 1 ... target
[padre] righe ricevute: 6
```

Una riga in piu' del progetto C: la cartella di un progetto `cargo` ha un file in piu' di quella con il `Makefile`.

## Dove sta l'`unsafe`

Nel blocco `unsafe extern "C"` in cima e in ogni chiamata. Il punto piu' interessante e' la `read`: il compilatore controlla ogni accesso a un array, ma qui gli passi un puntatore e un numero, e che il numero sia giusto lo garantisci tu. E' scritto nel commento `SICUREZZA`.

Il C mette `buffer[letti] = '\0'` per poter usare `fputs`: qui non serve, una fetta di byte conosce la propria lunghezza.

## Prova tu

Commenta la riga `unsafe { close(fd[1]) };` del padre e rilancia.
Il programma si **pianta**: la `read` aspetta per sempre, perche' c'e' ancora un'estremita' di scrittura aperta — la sua. Premi Ctrl+C.

Poi sostituisci `ls -l` con `date` oppure con `ps`.

# 12 — exec(): diventare un altro programma

**Compilatore:** `cargo`

Il figlio si trasforma nel comando `date`. E' la seconda meta' del meccanismo con cui una shell esegue i comandi: prima `fork`, poi `exec`.

## Comandi

```bash
cargo run
```

## Cosa devi vedere

```
[padre] sono 1230, ora creo un figlio
  [figlio] sono 1231, sto per diventare il comando 'date'
oggi e' il 06/09/1999
[padre] il figlio 1231 e' uscito con 0
[padre] nota: il figlio aveva lo stesso PID prima e dopo exec
```

## Dove sta l'`unsafe`

Nel blocco `unsafe extern "C"` in cima e in ogni chiamata. `execlp` e' la piu' delicata: prende un numero variabile di argomenti, e nessuno controlla il NULL finale. Se lo togli il programma compila lo stesso, e `execlp` continua a leggere memoria a caso.

## Prova tu

Aggiungi una `println!` **subito dopo** il blocco della `execlp`, prima della `eprintln!`. Ricompila e rilancia: quella riga non compare mai, perche' se exec riesce il codice che la contiene non esiste piu'.

Poi cambia `c"date"` in `c"comando_inventato"`, tutte e due le volte: ora exec fallisce, la `eprintln!` viene eseguita e il figlio esce con 127.

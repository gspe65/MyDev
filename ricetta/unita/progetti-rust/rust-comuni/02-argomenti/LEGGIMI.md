# 02 — Argomenti e valore di uscita

**Compilatore:** `cargo`

Mostra come un programma riceve dati dalla riga di comando e come comunica alla shell se e' andato tutto bene.

## Comandi

```bash
cargo run -- uno due tre
echo $?      # -> 0
cargo run
echo $?      # -> 1
```

I due trattini separano gli argomenti di `cargo` da quelli del programma.

## Cosa devi vedere

```
mi chiamo          : target/debug/argomenti
argomenti ricevuti : 3
  argv[1] = uno
  argv[2] = due
  argv[3] = tre
```

La prima riga e' diversa da quella del C perche' il programma lo lancia `cargo`, dalla sua cartella `target/debug`.

## Dove sta l'`unsafe`

Nessuno: qui non serve.

## Prova tu

Fai in modo che il programma sommi due numeri passati come argomenti.
Ti servira' `argv[1].parse::<i32>()`, che a differenza di `atoi` ti dice se la stringa non era un numero.

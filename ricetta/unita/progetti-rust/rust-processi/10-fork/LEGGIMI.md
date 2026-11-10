# 10 — fork(): un processo diventa due

**Compilatore:** `cargo`

Il programma si duplica. Il figlio si presenta ed esce con il valore 7, il padre lo aspetta e legge quel valore.

## Comandi

```bash
cargo run
```

## Cosa devi vedere

```
prima della fork: sono il processo 964
[padre] ho creato il figlio 966, ora lo aspetto
  [figlio] sono 966, mio padre e' 964
  [figlio] esco con il valore 7
[padre] il figlio 966 e' uscito con 7
```

## Dove sta l'`unsafe`

Nel blocco `unsafe extern "C"` in cima e in ogni chiamata a `fork`, `getpid`, `getppid`, `sleep`, `wait` e `_exit`.

Il blocco e' una promessa: dice al compilatore come sono fatte quelle funzioni, e lui ti crede. Se sbagli un tipo non te lo dice nessuno. E `fork` e' pericolosa davvero: duplica il programma mentre la libreria standard non lo sa. Qui c'e' un solo thread e va bene; con altri thread accesi il figlio potrebbe trovare un lucchetto chiuso per sempre.

`e_uscito` e `valore_di_uscita` sostituiscono le macro `WIFEXITED` e `WEXITSTATUS`, che dal C non si possono chiamare: erano solo testo per il preprocessore.

## Prova tu

Cambia la prima `println!` in `print!`, cosi' la riga resta senza a-capo e quindi nel buffer, poi rilancia mandando l'output in un file:

```bash
cargo run > uscita.txt
cat uscita.txt
```

Vedrai la prima riga **due volte**: il figlio ha ereditato il buffer ancora pieno e lo ha stampato anche lui. E' la stessa trappola del `fflush` in C, solo meno facile da incontrare.

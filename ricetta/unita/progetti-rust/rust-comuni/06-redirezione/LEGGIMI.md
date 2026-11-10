# 06 — Redirezione con dup2

**Compilatore:** `cargo`

Il programma dirotta il proprio `stdout` dentro un file, ci scrive, e poi lo rimette a posto. E' il meccanismo con cui la shell realizza il `>`.

## Comandi

```bash
cargo run
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

## Dove sta l'`unsafe`

Nel blocco `unsafe extern "C"` in cima, che dichiara `open`, `dup`, `dup2` e `close`, e in ogni chiamata a una di loro. La libreria standard non ha niente di equivalente a `dup2`: per lei il canale 1 e' una cosa sua, che non cambia sotto i piedi.

I valori di `O_WRONLY`, `O_CREAT` e `O_TRUNC` valgono su questa piattaforma e sono scritti a mano: il C li prende dagli header, qui nessuno li controlla.

## Prova tu

Cambia il secondo `println!` del punto 4 in `print!`, cosi' la riga resta senza a-capo, e rilancia: `e anche questa` non finisce nel file ma **sullo schermo**, attaccata alla riga dopo. Era ancora nel buffer quando hai rimesso a posto il canale. E' la stessa trappola del `fflush` in C, che con `println!` non si vede.

Poi prova a redirigere il canale 2 usando `eprintln!`.

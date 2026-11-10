# 05 — struct e file binario

**Compilatore:** `cargo`

Salva tre record in un file binario e li rilegge. Mostra la dimensione di una struct e la differenza fra file di testo e file binario.

## Comandi

```bash
cargo run
cat studenti.dat         # illeggibile: e' binario
xxd studenti.dat | head  # cosi' invece si vede
```

## Cosa devi vedere

```
una struct occupa 36 byte
scritti 3 record in studenti.dat
riletti 3 record:
  Anna       voto 8
  Bruno      voto 6
  Carla      voto 9
```

## Dove sta l'`unsafe`

In due blocchi, in `main`: `slice::from_raw_parts` e `slice::from_raw_parts_mut` guardano la memoria dell'array come una fila di byte. E' quello che `fwrite` e `fread` fanno senza dirlo. Il compilatore non puo' sapere che la struct non ha buchi e che ogni sequenza di byte e' un valore valido: lo garantisci tu, ed e' scritto nei due commenti `SICUREZZA`.

Una strada senza `unsafe` esiste: scrivere ogni campo con `to_le_bytes`. Il file diventerebbe anche portabile fra macchine diverse.

## Prova tu

Guarda il file con `xxd studenti.dat`: riconosci i nomi in chiaro e i voti come numeri.

Poi cambia `nome: [u8; 32]` in `nome: [u8; 16]` (e lo zero iniziale in `studente`), ricompila e rilancia: la struct diventa piu' piccola. Se ora provi a rileggere un file scritto con la versione vecchia, esce spazzatura. E' il motivo per cui i formati binari vanno versionati.

Togli `#[repr(C)]` e guarda se la dimensione cambia: quello che resta garantito e' solo cio' che chiedi.

# 05 — struct e file binario

**Compilatore:** **tutti e due**

Salva tre record in un file binario e li rilegge. Mostra `sizeof` e la differenza fra file di testo e file binario.

## Comandi

Dal terminale, nella cartella del progetto: `cd c-comuni/05-struct-file-binario`

```bash
make
./studenti.exe
cat studenti.dat        # illeggibile: e' binario
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

## Prova tu

Guarda il file con `xxd studenti.dat`: riconosci i nomi in chiaro e i voti come numeri.

Poi cambia `char nome[32]` in `char nome[16]`, ricompila e rilancia: la struct diventa più piccola. Se ora provi a rileggere un file scritto con la versione vecchia, esce spazzatura. È il motivo per cui i formati binari vanno versionati.

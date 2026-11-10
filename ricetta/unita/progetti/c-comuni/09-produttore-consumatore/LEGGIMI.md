# 09 — Produttore e consumatore

**Compilatore:** **tutti e due**

Il problema di sincronizzazione piu' classico. Due thread si passano dieci pezzi attraverso un magazzino da quattro posti, senza mai controllare a vuoto: chi non puo' procedere dorme.

## Comandi

```bash
make
./magazzino.exe
```

## Cosa devi vedere

```
magazzino da 4 posti, 10 pezzi da produrre

  [produttore]  ho messo  1   (in magazzino: 1)
  [consumatore] ho preso  1  (in magazzino: 0)
  [consumatore] magazzino vuoto, aspetto
  ...

finito. Pezzi rimasti in magazzino: 0
```

## Prova tu

Cambia `POSTI` da 4 a 1 e rilancia: vedrai molte piu' attese, perche' i due thread devono alternarsi a ogni pezzo.

Poi cambia il `while (quanti == 0)` del consumatore in `if`: sembra funzionare lo stesso, ed e' proprio questo il problema. Con piu' consumatori quel programma sbaglia, e sbaglia di rado: sono i bug peggiori.

> L'ordine esatto delle righe cambia a ogni esecuzione: dipende da come il sistema operativo alterna i due thread.

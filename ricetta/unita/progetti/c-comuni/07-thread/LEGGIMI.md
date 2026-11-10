# 07 — Thread e mutex

**Compilatore:** **tutti e due**

Quattro thread aumentano lo stesso contatore 100 000 volte ciascuno. Il totale deve fare 400 000.

## Comandi

```bash
make
./thread.exe
```

## Cosa devi vedere

```
avvio 4 thread, 100000 incrementi ciascuno
  thread 0 ha finito
  thread 1 ha finito
  thread 2 ha finito
  thread 3 ha finito
contatore = 400000 (atteso 400000)
```

## Prova tu

**L'esperimento vero:** commenta le due righe `pthread_mutex_lock` e `pthread_mutex_unlock`, ricompila e lancia il programma **cinque volte**.
Il totale sara' quasi sempre minore di 400 000, e ogni volta diverso. Quella e' una *race condition*: due thread leggono lo stesso valore e riscrivono lo stesso risultato, e un incremento va perso.

Il progetto 18 fa esattamente la stessa cosa con i **processi** e i semafori: mettili a confronto.

> L'ordine in cui i thread finiscono cambia a ogni esecuzione, ed e' normale: nessuno garantisce chi arriva prima.

# 16 — alarm(): una scadenza sul lavoro

**Compilatore:** **solo `gcc`**

Un lavoro che durerebbe 10 secondi viene interrotto dopo 3 da un `SIGALRM`. E' il modo piu' semplice di mettere un timeout su qualcosa che potrebbe non finire mai.

## Comandi

```bash
make
./allarme.exe
echo $?      # -> 1, perche' il tempo e' scaduto
```

## Cosa devi vedere

```
il lavoro durerebbe 10 secondi, ma mi do' 3 secondi di tempo

TEMPO SCADUTO dopo 3 secondi.
Al lavoro mancavano ancora 7 secondi.
```

## Prova tu

Cambia `LAVORO_LUNGO` a 1: ora il lavoro finisce prima, `alarm(0)` disdice la sveglia e il programma esce con 0.

Poi rimetti 10 e aggiungi `sa.sa_flags = SA_RESTART;`. Il programma si ferma lo stesso a 3 secondi: `SA_RESTART` riprende una `read` o una `write` interrotte, ma non una `sleep`.

> Un timeout piu' fine (millisecondi, e su un canale specifico) si fa con `poll`: e' il progetto 20.

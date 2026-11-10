# 16 — alarm(): una scadenza sul lavoro

**Compilatore:** `cargo`

Un lavoro che durerebbe 10 secondi viene interrotto dopo 3 da un `SIGALRM`. E' il modo piu' semplice di mettere un timeout su qualcosa che potrebbe non finire mai.

## Comandi

```bash
cargo run
echo $?      # -> 1, perche' il tempo e' scaduto
```

## Cosa devi vedere

```
il lavoro durerebbe 10 secondi, ma mi do' 3 secondi di tempo

TEMPO SCADUTO dopo 3 secondi.
Al lavoro mancavano ancora 7 secondi.
```

## Dove sta l'`unsafe`

Nel blocco `unsafe extern "C"` in cima e in ogni chiamata, e nella struct `Sigaction`, che il compilatore non puo' confrontare con quella del sistema: vedi il progetto 15.

## Prova tu

Cambia `LAVORO_LUNGO` a 1: ora il lavoro finisce prima, `alarm(0)` disdice la sveglia e il programma esce con 0.

Poi rimetti 10 e metti `sa_flags: 0x1000_0000`, il valore di `SA_RESTART`: su questa piattaforma il programma si ferma lo stesso a 3 secondi, perche' la `sleep` interrotta non viene ripresa. `SA_RESTART` riguarda chiamate come la `read` di un tubo.

> Un timeout piu' fine (millisecondi, e su un canale specifico) si fa con `poll`: e' il progetto 20.

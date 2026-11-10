# Guida al C su MyDev

Da zero al primo programma, e poi ai processi e ai thread.
Non serve sapere niente in anticipo: si comincia dal doppio clic.

---

## 1. Partire

Doppio clic su **`Terminale.exe`**, nella cartella `MyDev`. Si apre il
terminale, già nella cartella dei progetti.

Lì dentro ci sono **due compilatori**, e sono due mondi diversi:

| | |
|---|---|
| **`gcc`** | il compilatore che capisce `fork`, i segnali, le pipe |
| **`clang`** | il compilatore che produce programmi **Windows** |

Comincia con **`gcc`**: è quello che usa `make`. A `clang` arriverai quando
vorrai dare un programma a un compagno, o cercare un errore di memoria.

---

## 2. I quattro comandi che userai sempre

Nel terminale:

```bash
ls                    elenca i file
cd nomecartella       entra in una cartella
cd ..                 torna indietro
pwd                   dimmi dove sono
```

Il terminale si apre già nella cartella dei progetti, `progetti/`. Da lì:

```bash
cd c-comuni/01-ciao
ls
```

---

## 3. Il primo programma

```bash
cd c-comuni/01-ciao
make          # compila
./ciao.exe    # esegui
```

Devi vedere `Ciao, mondo!`.

Se preferisci fare a mano quello che fa `make`:

```bash
gcc -std=c11 -Wall -Wextra -g -O0 -o ciao.exe main.c
```

Cosa vuol dire ognuno:

| flag | a cosa serve |
|---|---|
| `-std=c11` | usa il C dello standard 2011, e nient'altro |
| `-Wall -Wextra` | dimmi tutto quello che ti sembra sospetto |
| `-g` | metti dentro le informazioni per il debugger |
| `-O0` | non ottimizzare: così il debugger mostra le righe giuste |
| `-o ciao.exe` | come si deve chiamare il programma prodotto |

**I warning si leggono.** Non sono errori, ma quasi sempre segnalano un bug
vero che si manifesterà più tardi e sarà più difficile da trovare.

### I tre comandi di `make`

```bash
make          compila (solo se serve: se non hai toccato niente, non fa nulla)
make run      compila ed esegue
make clean    cancella il programma e i file intermedi
```

`make` compila con `gcc`. Per compilare lo stesso progetto con `clang`:

```bash
make clean
make CC=clang
```

Il `make clean` prima serve: se il programma c'è già, `make` non ricompila.

---

## 4. Quando qualcosa non va

### Il compilatore si lamenta

Leggi **il primo** errore, non l'ultimo: gli altri spesso sono conseguenze.
Il formato è sempre `file:riga:colonna: messaggio`.

```
main.c:7:5: error: 'printf' undeclared
```

Riga 7, colonna 5, manca `#include <stdio.h>`.

### Il programma parte e si comporta male

```bash
gdb ./ciao.exe
```

Dentro gdb:

```
break main       fermati all'inizio di main
run              parti
next             esegui una riga
step             entra dentro la funzione
print nome       stampami quanto vale una variabile
backtrace        chi ha chiamato chi
continue         riparti
quit             esci
```

### Il programma "esplode" o dà risultati assurdi

`clang` sa metterti dei controlli dentro il programma (`gcc` qui non può:
gli manca la libreria che serve):

```bash
clang -g -fsanitize=address -o ciao.exe main.c
./ciao.exe
```

Se scrivi fuori da un array o usi memoria già liberata, te lo dice sul momento
e ti indica la riga. È il modo più rapido di trovare un errore di memoria.

> Le **perdite** di memoria (dimenticare una `free`) su Windows non sono
> rilevabili: per quelle serve un vero Linux.

---

## 5. La mappa dei progetti

Ventuno progetti numerati, in ordine, più `simple` e `multifile`, i due da cui
si parte. Ognuno dei ventuno ha il suo `LEGGIMI.md` con i comandi, l'output
atteso e un esercizio.

### `c-comuni/` — funzionano con **tutti e due** i compilatori

| | | |
|---|---|---|
| 01 | `01-ciao` | il primo programma |
| 02 | `02-argomenti` | `argc`/`argv` e il valore di uscita |
| 03 | `03-file-testo` | `fopen`, `fprintf`, `fgets` |
| 04 | `04-memoria-dinamica` | `malloc`, `realloc`, `free` |
| 05 | `05-struct-file-binario` | `struct`, `fwrite`, `fread` |
| 06 | `06-redirezione` | `dup2`: come la shell fa `programma > file` |
| 07 | `07-thread` | `pthread`, mutex, *race condition* |
| 08 | `08-thread-asincrono` | far partire un lavoro senza bloccarsi |
| 09 | `09-produttore-consumatore` | variabili di condizione |

### `c-processi/` — funzionano **solo con `gcc`**

| | | |
|---|---|---|
| 10 | `10-fork` | un processo diventa due |
| 11 | `11-zombie-e-orfani` | cosa succede se non aspetti i figli |
| 12 | `12-exec` | il processo diventa un altro programma |
| 13 | `13-pipe` | due processi che si parlano |
| 14 | `14-fifo` | la pipe con un nome sul disco |
| 15 | `15-segnali` | `sigaction`, `Ctrl+C`, `kill` |
| 16 | `16-allarme` | `alarm`: una scadenza sul lavoro |
| 17 | `17-memoria-condivisa` | `mmap`: memoria in comune fra processi |
| 18 | `18-semafori` | mutua esclusione fra processi |
| 19 | `19-processi-asincroni` | `waitpid` con `WNOHANG` |
| 20 | `20-attesa-con-timeout` | `poll`: aspettare, ma non per sempre |
| 21 | `21-socket` | due processi che si parlano via rete |

### Un percorso possibile

1. **Il linguaggio**: 01 → 02 → 03 → 04 → 05
2. **Il sistema, la parte che c'è ovunque**: 06
3. **Concorrenza dentro un programma**: 07 → 08 → 09
4. **Processi**: 10 → 11 → 12 → 13 → 14
5. **Segnali e tempo**: 15 → 16
6. **Comunicazione e sincronizzazione**: 17 → 18
7. **Asincronia**: 19 → 20
8. **Rete**: 21

Le coppie da guardare affiancate, perché risolvono lo stesso problema in due
modi diversi:

| thread | processi |
|---|---|
| 07 — mutex | 18 — semafori |
| 08 — lancio e continuo | 19 — `waitpid` con `WNOHANG` |
| memoria condivisa per costruzione | 17 — memoria condivisa da chiedere |

---

## 6. La prova che spiega tutto: `confronta.sh`

Nel terminale:

```bash
cd "$MYDEV/progetti"
bash confronta.sh
```

Lo script compila ogni progetto **due volte**, con `gcc` e con `clang`, e
mette i risultati in due colonne. Con `gcc` compilano tutti e ventuno; con
`clang` nove sì e dodici no. Gli errori di `clang` sono sempre della stessa
famiglia:

```
main.c:22:10: fatal error: 'sys/wait.h' file not found
```

Non è un errore tuo, e non si aggiusta scrivendo meglio il codice: quella
funzione su Windows non esiste.

---

## 7. Perché due compilatori

| | `clang` | `gcc` |
|---|---|---|
| Da dove viene | llvm-mingw | GCC del sottosistema MSYS2 |
| Bersaglio | `x86_64-w64-windows-gnu` | `x86_64-pc-cygwin` |
| Produce | un `.exe` **Windows** vero | un `.exe` che ha bisogno di `msys-2.0.dll` |
| Lo puoi mandare a un compagno? | **sì**, gira su qualunque Windows | **no**, gira solo qui |
| Velocità | nativa | passa per un livello di traduzione |
| `fork`, `exec`, `pipe`, segnali | **no** | **sì** |
| Thread (`pthread`) | sì | sì |
| Socket | no (su Windows si usa un'altra libreria) | sì |
| Sanitizer (`-fsanitize=address`) | sì | no |

**In pratica:** usa **`clang`** per tutto ciò che deve *girare* fuori di
qui; usa **`gcc`** quando il programma parla di **processi**.

### Il mio programma gira sul PC di un compagno?

Dipende, ed è stato misurato:

| Cosa hai compilato | Gira su un PC senza MyDev? |
|---|---|
| `clang`, programma normale | **sì** |
| `clang`, programma **con thread** | **no**: cerca `libwinpthread-1.dll` |
| `clang`, con thread e `-static` | **sì** |
| `gcc`, qualunque programma | **no**: cerca `msys-2.0.dll`, e `-static` non aiuta |

Se un programma con i thread deve girare altrove, compilalo così:

```bash
clang -std=c11 -Wall -pthread -static -o programma.exe main.c
```

Diventa più grosso (231 KB invece di 67 KB) perché si porta dentro tutto
quello che gli serve, e proprio per questo parte ovunque.

Per i programmi di `gcc` non c'è rimedio: il runtime che fornisce `fork` e i
segnali è per forza una DLL a parte. Se devi consegnare un eseguibile di
`c-processi`, consegna il **sorgente**.

---

## 8. Il manuale

Nel terminale c'è `man`. Le pagine POSIX stanno nella sezione `3p`:

```bash
man 3p fork
man 3p wait
man 3p sigaction
man 3p pthread_create
man 3p mmap
```

`man 2 fork` non funziona: la sezione 2 è quella delle pagine di Linux, qui
non ci sono. La `3p` è il testo dello standard POSIX, che per studiare va
anche meglio.

Per uscire da `man`: `q`. Per cercare dentro una pagina: `/parola`, poi `n`
per il risultato successivo.

---

## 9. Le regole che si imparano una volta e valgono sempre

1. **Controlla sempre il valore che una funzione restituisce.** `malloc` può
   tornare `NULL`, `fork` può tornare `-1`, `open` può fallire. In C nessuno
   te lo dice al posto tuo.
2. **`perror("dove")` dice cosa è andato storto**, con parole. Usalo.
3. **Ogni `malloc` vuole la sua `free`**; ogni `fork` vuole il suo `wait`;
   ogni `open` vuole il suo `close`.
4. **Il buffer di `printf` non si svuota da solo** quando l'output non va a
   schermo. Prima di una `fork` o di `_exit`, `fflush(stdout)`.
5. **Un programma che funziona *a volte* è rotto.** Se il risultato cambia da
   un'esecuzione all'altra, c'è un problema di sincronizzazione, non sfortuna.
6. **I warning del compilatore si leggono.**

---

## Appendice — Domande che vengono a tutti

### Compilazione

**`'sys/wait.h' file not found`**
Stai compilando con `clang` un progetto della cartella `c-processi`. Usa
`gcc`: `make clean`, poi `make`. Non è un errore del tuo codice.

**`use of undeclared identifier 'SIGUSR1'`** oppure **`variable has incomplete type 'struct sigaction'`**
Stessa cosa: segnali POSIX compilati con `clang`.

**`undefined reference to 'pthread_create'`**
Manca `-pthread` sulla riga di compilazione. Il Makefile dei progetti ce l'ha
già; se compili a mano devi metterlo tu.

**`implicit declaration of function 'usleep'`**
`usleep` è stato tolto dallo standard POSIX del 2008. Usa `nanosleep`, come
fanno i progetti 08 e 19.

**`main.c:1:1: error: expected identifier` su una riga che sembra giusta**
Guarda la riga **precedente**: quasi sempre manca un `;` o una `}`.

**Il compilatore dà decine di errori tutti insieme**
Correggi **il primo** e ricompila. Gli altri spesso sparivano da soli.

### Make

**`make: Nothing to be done for 'all'.`**
Non è un errore: `make` ha visto che il sorgente non è cambiato e non
ricompila. Se vuoi forzarlo: `make clean` poi `make`.

**`Makefile:5: *** missing separator. Stop.`**
Nel Makefile le righe dei comandi cominciano con un **TAB**, non con degli
spazi. Alcuni editor li convertono: in Notepad++ attiva *Visualizza → Simboli
speciali* per vederli.

### Esecuzione

**`bash: ciao.exe: command not found`**
Devi scrivere `./ciao.exe` con il `./` davanti. Nel terminale, il punto
significa "in questa cartella", e per sicurezza non viene cercato da solo.

**`Permission denied` mentre compili con `clang`**
(`failed to write output 'ciao.exe': Permission denied`)
Il programma che stai ricompilando è **ancora in esecuzione**: in un altro
terminale, o fermo ad aspettare un input. Windows non lascia sovrascrivere un
`.exe` che sta girando. Chiudilo (`Ctrl+C`) e ricompila. Con `gcc` non
succede: riesce a sostituire il file anche mentre gira.
`chmod +x` qui non serve: in questo terminale i permessi Linux dei file non
esistono, e non cambia niente. Se invece `Permission denied` arriva scrivendo
un file, stai scrivendo in una cartella di sistema di Windows (per esempio
`C:\Windows`): lavora dentro `progetti`.

**Il programma non stampa niente e resta fermo**
Sta aspettando qualcosa: una lettura da tastiera, oppure un dato che non
arriverà mai (vedi il progetto 13 e la `close` mancante). Premi `Ctrl+C`.

**Il programma stampa tutto insieme alla fine invece che man mano**
È il buffer. Quando l'output non va a schermo, si svuota solo quando è pieno.
Metti `fflush(stdout);` dopo le `printf` che vuoi vedere subito.

**Ho aggiunto una `printf` ma non compare**
Se è dopo una `exec` non verrà mai eseguita (progetto 12). Se è in un figlio
che chiama `_exit`, serve `fflush(stdout)` prima.

**Errore di segmentazione / il programma si chiude di colpo**
Quasi sempre un puntatore. Con `clang`:
```bash
clang -g -fsanitize=address -o programma.exe main.c
./programma.exe
```
Ti dice la riga esatta.

**Il risultato cambia a ogni esecuzione**
Non è il computer che sbaglia: è un problema di sincronizzazione. Guarda i
progetti 07 e 18.

### Processi e thread

**Come vedo i processi in esecuzione?**
Nel terminale: `ps`. Per fermarne uno: `kill <numero>`, e se non basta
`kill -9 <numero>`.

**Ho lanciato un programma che non finisce più**
`Ctrl+C`. Se non risponde, da un secondo terminale: `ps`, poi `kill -9 <pid>`.

**Perché `fork()` stampa la riga di prima due volte?**
Il buffer di `printf` viene duplicato insieme al processo. `fflush(stdout)`
prima della `fork`. È l'esperimento del progetto 10.

**Che differenza c'è fra `exit` e `_exit`?**
`exit` fa le pulizie di fine programma (fra cui svuotare i buffer), `_exit`
no. Nel figlio di una `fork` si usa `_exit`, per non rifare le pulizie che
farà anche il padre — e per questo serve un `fflush` esplicito.

**Meglio thread o processi?**
I thread sono più leggeri e condividono la memoria, quindi comunicano senza
sforzo ma si pestano i piedi facilmente. I processi sono isolati: più sicuri,
ma per parlarsi serve un meccanismo esplicito. Progetti 07 e 18 sono lo stesso
problema risolto nei due modi.

### Ambiente

**Dove sono i miei file?**
`pwd` te lo dice. La cartella dei progetti è `$MYDEV/progetti`, e ci arrivi
sempre con `cd "$MYDEV/progetti"`.

**Posso usare un editor per scrivere il codice?**
Sì, con **`VSCodium.exe`**, che compila, esegue e fa il debug coi suoi comandi
(Ctrl+Maiusc+B, F5): lo spiega il `README.md` alla radice dell'unità. Dal
terminale si compila con `make`. Attenzione ai TAB nel Makefile.

**Ho chiuso il terminale e ho perso tutto?**
No: i file sono sul disco. Si perde solo la cronologia dei comandi della
sessione — e nemmeno quella, perché la *home* sta dentro l'unità.

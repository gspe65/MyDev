# MyDev

Un ambiente di sviluppo per Windows che non si installa: questa cartella contiene l'editor, i compilatori e gli altri strumenti, e funziona da dove si trova. La puoi copiare sul disco, sul Desktop o su una chiavetta, e non servono i diritti di amministratore. Il percorso della cartella non deve superare i 65 caratteri (per esempio `D:\Scuola\MyDev` va bene): alcuni file stanno 193 caratteri più in fondo, e molti programmi di Windows non aprono i percorsi oltre i 259.

I tuoi file e i dati degli strumenti restano in questa cartella. Fuori restano solo le tracce che Windows lascia per ogni programma che si avvia (alcune voci del registro e la cartella dei file temporanei, che i compilatori usano mentre lavorano) e, nell'unità estesa, la voce del portachiavi di Windows che `gh` tocca quando sul PC c'è già un altro `gh` collegato (lo spiega la guida dell'estesa). Quando si apre, l'editor chiede alla rete il dizionario per il controllo ortografico: non è un aggiornamento, e senza rete l'editor funziona lo stesso.

## Che cosa avviare

Alla radice ci sono i collegamenti. Ognuno avvia gli strumenti **di questa copia**, anche se sul PC ce n'è un'altra.

| Collegamento | Che cosa apre |
|---|---|
| `VSCodium.exe` | L'editor. Un progetto si apre con **File → Open Folder**, dalla cartella `progetti` |
| `Terminale.exe` | Il terminale `bash`, nella cartella `progetti` |
| `AlgoDesign.exe` | AlgoDesign, per i flowchart |
| `Neovim.exe` | L'editor Neovim nel terminale |
| `Progetti.exe` | La cartella `progetti` in Esplora file |

Se il PC non lascia partire i collegamenti (per esempio un antivirus che blocca gli eseguibili che non conosce), nella cartella `fallback` ci sono gli stessi avvii come file `.bat`.

L'editor va aperto da qui, non da `vscodium\VSCodium.exe`: il collegamento gli dà i compilatori e le cartelle dell'unità. Aperto direttamente, non trova `clangd` e propone di scaricarne uno dalla rete: non accettare.

## Compilare, eseguire e fare il debug da VSCodium

I menu dell'editor sono in inglese. I comandi valgono per la cartella **del file aperto**: prima apri un sorgente del progetto, per esempio `main.c`, poi lancia il comando.

- **Ctrl+Maiusc+B** compila con `gcc`. Gli errori compaiono nel pannello **Problems**, sulla riga giusta.
- Dal menu **Terminal → Run Task…** trovi gli altri comandi: «Compila con clang», «Esegui il programma gcc», «Esegui il programma clang» e i quattro comandi «ASan», che compilano ed eseguono con e senza il controllo degli errori di memoria. Ogni «Esegui» compila prima. I comandi «ASan» compilano il solo file aperto, non tutti i sorgenti del progetto.
- **F5** avvia il debug. Nella vista **Run and Debug** scegli «Debug con gcc» o «Debug con clang»: il programma si compila e si ferma ai punti di interruzione che hai messo cliccando a sinistra dei numeri di riga. F5 usa poi l'ultima scelta.

`clang` compila i progetti di `c-comuni`, non quelli di `c-processi`, che usano le chiamate dei processi di POSIX: per quelli serve `gcc`.

I programmi si chiamano `programma-gcc.exe` e `programma-clang.exe` e nascono accanto ai sorgenti; nei progetti a più file nascono lì anche i file `.o`. `make clean` toglie i file di `make`, non questi due.

Si può lavorare anche solo dal terminale, con `make`: lo spiega la guida al C.

## Le guide

- `progetti/GUIDA-C.md`: il C da zero, i due compilatori, i processi e i thread, e la mappa dei progetti.
- `progetti/Avvio-C.md`: i comandi essenziali, in breve.
- Nell'unità estesa, `progetti/GUIDA-ESTESA.md`: Rust, `git` e `gh`. Per Rust i comandi dell'editor sono «Cargo: compila», «Cargo: esegui», «Cargo: clippy» e «Cargo: formatta», e il debug è «Debug Rust», con un sorgente del progetto aperto.

## I file `.algo`

VSCodium riconosce i file di AlgoDesign dall'icona. Con un file `.algo` aperto, il comando «Mostra il codice generato» (Ctrl+Maiusc+P, poi il nome del comando) mostra in sola lettura il codice del flowchart. Il linguaggio e la lingua si scelgono nelle impostazioni `algo.linguaggio` e `algo.lingua`.

## Dove restano i tuoi file

Il tuo lavoro sta in `progetti`, le impostazioni e la cronologia dei comandi in `home`, i dati dell'editor in `vscodium\data`. Copiando la cartella intera porti con te anche quelli.

Una copia data ad altri porta anche i tuoi dati: la cronologia dei comandi, il nome e l'indirizzo che hai dato a `git`, nell'estesa il token di `gh` (in chiaro, in `home\.config\gh`), il certificato del server locale col tuo nome utente e il nome del PC, accanto alla chiave dell'autorità che lo firma (in `nginx\ssl`). Prima di darla, dai una copia di un'unità che non hai mai usato, oppure togli dalla copia le cartelle `home` e `nginx\ssl`: l'unità le ricrea, vuote, al primo uso.

## Le versioni

L'editor, le sue estensioni e gli strumenti non si aggiornano da soli, e non si aggiornano dal menu: le versioni sono quelle provate. Il file `unita.json` dice la versione dell'unità e se è la base o l'estesa; `unita-file.txt` elenca ogni file con la sua impronta.

## Le licenze, e se dai una copia ad altri

`LICENZE.txt` elenca la licenza di ogni componente, col percorso del testo intero; i testi che i componenti non portano stanno in `licenze`. L'unità estesa aggiunge `LICENZE-ESTESA.txt` per i suoi strumenti.

**Se dai una copia dell'unità ad altri**, per esempio su una chiavetta, leggi prima la nota in testa a `LICENZE.txt`: alcune licenze chiedono che con la copia tu dia anche i sorgenti, o un'offerta scritta di darli.

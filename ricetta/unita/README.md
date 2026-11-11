# MyDev

Un ambiente di sviluppo per Windows che non si installa: questa cartella contiene l'editor, i compilatori e gli altri strumenti, e funziona da dove si trova. La puoi copiare sul disco, sul Desktop o su una chiavetta, e non servono i diritti di amministratore. Il percorso della cartella non deve superare i 65 caratteri (per esempio `D:\Scuola\MyDev` va bene): alcuni file stanno 193 caratteri più in fondo, e molti programmi di Windows non aprono i percorsi oltre i 259.

I tuoi file e i dati degli strumenti restano in questa cartella. Fuori restano solo le tracce che Windows lascia per ogni programma che si avvia (alcune voci del registro e la cartella dei file temporanei, che i compilatori usano mentre lavorano) e, nell'unità estesa, la voce del portachiavi di Windows che `gh` tocca quando sul PC c'è già un altro `gh` collegato (lo spiega la guida dell'estesa). Quando si apre, l'editor chiede alla rete il dizionario per il controllo ortografico: non è un aggiornamento, e senza rete l'editor funziona lo stesso.

## Che cosa avviare

Alla radice ci sono i collegamenti. Ognuno avvia gli strumenti **di questa copia**, anche se sul PC ce n'è un'altra.

| Collegamento | Che cosa apre |
|---|---|
| `VSCodium.exe` | L'editor. Un progetto si apre con **File → Apri cartella…**, dalla cartella `progetti` |
| `Terminale.exe` | Il terminale `bash`, nella cartella `progetti` |
| `AlgoDesign.exe` | AlgoDesign, per i flowchart |
| `Neovim.exe` | L'editor Neovim nel terminale |
| `Progetti.exe` | La cartella `progetti` in Esplora file |

Se il PC non lascia partire i collegamenti (per esempio un antivirus che blocca gli eseguibili che non conosce), nella cartella `fallback` ci sono gli stessi avvii come file `.bat`.

L'editor va aperto da qui, non da `vscodium\VSCodium.exe`: il collegamento gli dà i compilatori e le cartelle dell'unità. Aperto direttamente, non trova `clangd` e propone di scaricarne uno dalla rete: non accettare. E dopo che hai spostato o copiato la cartella, aperto direttamente resta in inglese, del tutto o in parte, finché non lo riapri dal collegamento.

## Compilare, eseguire e fare il debug da VSCodium

I menu dell'editor sono in italiano; qualche voce recente, soprattutto della chat, resta in inglese, perché l'ultimo pacchetto della lingua italiana è di qualche versione prima dell'editor. I comandi valgono per la cartella **del file aperto**: prima apri un sorgente del progetto, per esempio `main.c`, poi lancia il comando.

- **Ctrl+Maiusc+B** compila con `gcc`. Gli errori compaiono nel pannello **Problemi**, sulla riga giusta.
- Dal menu **Terminale → Esegui attività…** (se la finestra è stretta, **Terminale** sta sotto **···**) trovi gli altri comandi: «Compila con clang», «Esegui il programma gcc», «Esegui il programma clang» e i quattro comandi «ASan», che compilano ed eseguono con e senza il controllo degli errori di memoria. Ogni «Esegui» compila prima. I comandi «ASan» compilano il solo file aperto, non tutti i sorgenti del progetto.
- **F5** avvia il debug. Nella vista **Esegui con debug** scegli «Debug con gcc» o «Debug con clang»: il programma si compila e si ferma ai punti di interruzione che hai messo cliccando a sinistra dei numeri di riga. F5 usa poi l'ultima scelta.

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

## Che cosa manca nell'editor, e perché

- **Video H.264 e H.265 e audio AAC non si riproducono** nell'editor (per esempio un video MP4 in un'anteprima Markdown o nella pagina di un'estensione). Sono formati coperti da brevetti, e MyDev non ne distribuisce i decodificatori: al posto dello `ffmpeg.dll` di VSCodium c'è quello di Electron coi soli formati liberi. WebM con VP9 o AV1 e l'audio Opus si riproducono.
- **L'editor disegna senza la scheda video** (`"disable-hardware-acceleration": true` in `vscodium\data\argv.json`): senza questa riga H.264 e H.265 si decodificherebbero comunque, attraverso la scheda video del PC. Su un PC lento lo scorrimento di un file molto grande può essere meno fluido. Il comando «Configura argomenti del runtime» (Ctrl+Maiusc+P) apre quel file: chi toglie la riga riaccende la scheda video, e con lei H.264 e H.265; la verifica dell'unità segnala il file cambiato.
- **Non c'è l'accesso con un account Microsoft**: l'estensione che lo fa porta una libreria di Microsoft senza termini che ne permettano la distribuzione, ed è stata tolta. L'estensione di accesso con GitHub resta.
- **Il terminale PowerShell aperto dal menu del terminale** usa la PSReadLine di Windows: l'editor porta una sua copia per la modalità di lettura dello schermo, da cui è stato tolto un file di Microsoft senza termini (`Microsoft.PowerShell.Pager.dll`).

## Le licenze, e se dai una copia ad altri

`LICENZE.txt` elenca la licenza di ogni componente, col percorso del testo intero; i testi che i componenti non portano stanno in `licenze`. L'unità estesa aggiunge `LICENZE-ESTESA.txt` per i suoi strumenti.

**Se dai una copia dell'unità ad altri**, per esempio su una chiavetta, leggi prima la nota in testa a `LICENZE.txt`: alcune licenze chiedono che con la copia tu dia anche i sorgenti, o un'offerta scritta di darli.

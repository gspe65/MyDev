# MyDev

Un ambiente di sviluppo portabile per Windows, pensato per i laboratori scolastici e per i PC di casa: si copia su disco o su una chiavetta e non richiede diritti di amministratore. Contiene VSCodium, i compilatori C `gcc` e `clang` con il debugger, Python, l'ambiente POSIX di MSYS2, Neovim, Nginx, AlgoDesign e il browser Chromium, costruito senza i codec coperti da brevetti. La variante **estesa** aggiunge Rust, `git`, `gh` e il codice di un corso sui puntatori.

Il repository versiona la **ricetta** con cui si costruisce l'ambiente, non l'ambiente stesso: il costruttore scarica ogni componente dalla sua fonte originale, alla versione fissata, e ne confronta l'impronta. La versione pubblicata è la `0.2.0`: è l'etichetta `v0.2.0` di questo repository, con la sua pagina fra le release. La release contiene un solo file compilato, il pacchetto dell'estensione per i file `.algo`, che il costruttore scarica con la sua impronta come ogni altro componente; il resto dell'unità si costruisce con la ricetta, come spiegato qui sotto.

## Che cosa c'è

| Cartella | Contenuto |
|---|---|
| `ricetta/` | Il costruttore e la verifica dell'unità, l'elenco dei componenti con versione, fonte e impronta (`componenti.json`, e `componenti-estesa.json` per l'aggiunta dell'estesa), l'indice delle licenze e il comando dei sorgenti |
| `ricetta/unita/` | I file nostri che entrano nell'unità: il lanciatore, i comandi di `bin`, le impostazioni dell'editor e di Chromium, i progetti di esempio, le guide e, per l'estesa, la copia del codice del corso sui puntatori |
| `ricetta/puntatori/` | L'inventario di quella copia e la prova che la confronta con il commit da cui viene |
| `ricetta/nucleo/` | Estrae il nucleo di AlgoDesign da un'etichetta fissata (o, fino alla release che lo porta, da un commit fissato), lo verifica per impronta e dichiara la versione del contratto |
| `extensions/libreria/` | La libreria sopra il nucleo, con sette funzioni: apri, controlla, genera, disegna, segnalazioni, leggi Accademico, aggiungi alla libreria |
| `collaudo/` | Le prove: della libreria, della conformità al nucleo, del pacchetto dell'estensione che l'unità installa, del codice generato che si esegue nell'unità, e il kit dell'unità col suo gate |

L'estensione per i file `.algo`, che nell'unità è già installata, ha il suo repository: [`gspe65/AlgoDesign-VSCode`](https://github.com/gspe65/AlgoDesign-VSCode).

## Prerequisiti

Per costruire l'unità:

- Windows 10 o 11 x64, con Windows PowerShell 5.1 e `tar.exe` in `System32` (ci sono già).
- Git.
- La rete, la prima volta: il deposito dei componenti pesa circa 1,1 GB per la base e 1,2 GB per l'estesa. L'unità costruita occupa circa 2,7 GB, l'estesa 3,3 GB.

Per le prove:

- [Bun](https://bun.sh) 1.4.2 e [Node.js](https://nodejs.org) 24.
- [GitHub CLI](https://cli.github.com) (`gh`, con un account qualunque), per verificare l'attestazione del pacchetto dell'estensione.
- Il repository di AlgoDesign, col commit che `ricetta/nucleo/inventario.json` nomina (di norma quello di un'etichetta; fino alla release `1.0.1` di AlgoDesign, il commit del contratto 1.1, che deve esserci nella copia locale), nella cartella `AlgoDesign` accanto a questa oppure indicato con la variabile d'ambiente `ALGODESIGN_REPO`. Lo usa anche il gate dell'unità, per il corpus di esecuzione.
- Python 3, per i comandi `python` di questa pagina (il confronto del corso sui puntatori, l'indice delle licenze): va bene anche quello di un'unità costruita, `<unità>\python\python.exe`.

## Come si costruisce l'unità

I comandi sono per PowerShell, dalla cartella del repository. L'unità base o l'estesa:

```
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ricetta\costruisci.ps1 -Destinazione C:\MyDev
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ricetta\costruisci.ps1 -Destinazione C:\MyDev-estesa -Variante estesa
```

La destinazione deve essere vuota o non esistere. I componenti scaricati restano in un deposito accanto alla destinazione (`C:\MyDev-deposito`, `C:\MyDev-estesa-deposito`; si cambia con `-Deposito`), e la volta dopo si costruisce anche senza rete con `-SenzaRete`. Ogni variante vuole il proprio deposito.

Dal deposito pieno la costruzione dura circa 10 minuti per la base e 16 per l'estesa. Gran parte del tempo la prende l'antivirus, che esamina decine di migliaia di file piccoli: con la cartella esclusa dall'analisi in tempo reale si scende a circa 4 minuti.

La destinazione non può essere la radice di un disco, e i file nostri si leggono dall'albero di lavoro: con un file modificato o nuovo sotto `ricetta\` o `extensions\` la costruzione si ferma, perché l'unità dichiarerebbe un commit che non è il suo (con `-AlberoModificato` procede, e `unita.json` lo dice).

L'unità finita si sposta e si copia come una cartella qualsiasi, anche in un percorso con spazi o su una chiavetta, purché il percorso della cartella non superi i 65 caratteri: alcuni file stanno 193 caratteri più in fondo, e molti programmi di Windows non aprono i percorsi oltre i 259. Come si usa lo dice il suo `README.md`, alla radice.

### Il pacchetto dell'estensione

Il costruttore installa nell'unità il pacchetto dell'estensione per i file `.algo` dalla release del suo repository, [`gspe65/AlgoDesign-VSCode`](https://github.com/gspe65/AlgoDesign-VSCode) (`AlgoDesign-Code-0.0.2.vsix`), con byte e impronta scritti nella ricetta. Il pacchetto lo costruiscono le GitHub Actions di quel repository, che lo provano con l'editor su Windows, Ubuntu e macOS e ne attestano la provenienza; lì si trova anche come costruirlo dai sorgenti. `bun collaudo/algo/prova.ts` lo lega alla ricetta (qui sotto, «Come si provano il nucleo e le estensioni»).

## Se una fonte sparisce

Ogni componente si scarica dalla sua fonte originale (l'archivio dei pacchetti di MSYS2, PyPI, Open VSX, le release dei progetti su GitHub, compresi questo repository e quello di Chromium, i siti dei progetti), e una fonte può sparire: un pacchetto vecchio esce dall'archivio, un progetto toglie una release, cambia indirizzo o chiude. Questo repository non tiene una copia dei componenti. Se una fonte non risponde, il costruttore si ferma prima di scrivere la destinazione e nomina il componente, con la versione, l'indirizzo, il file atteso nel deposito e la sua impronta:

```
FERMO: scaricamento non riuscito: editor/vscodium 1.143.17232, da https://github.com/VSCodium/...: ... (404) ... -- se la fonte non c'e' piu', il file editor/VSCodium-win32-x64-1.143.17232.zip (sha256 a1090868...) si copia nel deposito da una sua copia, poi si costruisce con -SenzaRete
```

Per ricostruire una versione la cui fonte è sparita serve quindi il **deposito**. Chi costruisce l'unità lo conserva e ne tiene una seconda copia su un altro disco, insieme alla cartella dei sorgenti se dà copie dell'unità ad altri (vedi più sotto). Per esempio, con il disco `E:`:

```
robocopy C:\MyDev-deposito E:\MyDev-copia\MyDev-deposito /E /R:2 /W:5 /NFL /NDL /NJH /NJS
robocopy C:\MyDev-estesa-deposito E:\MyDev-copia\MyDev-estesa-deposito /E /R:2 /W:5 /NFL /NDL /NJH /NJS
robocopy D:\sorgenti E:\MyDev-copia\sorgenti /E /R:2 /W:5 /NFL /NDL /NJH /NJS
```

Come per la copia dell'unità, `robocopy` esce con 1 quando ha copiato dei file; da 8 in su qualcosa non è stato copiato. La copia si verifica per impronte. Per i sorgenti:

```
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ricetta\sorgenti.ps1 -Destinazione E:\MyDev-copia\sorgenti -Variante estesa -SenzaRete
```

Per i depositi, una costruzione senza rete da ciascuna copia: il costruttore confronta dimensione e impronta di ogni file del deposito, e i file estranei, prima di scrivere la destinazione. L'unità di prova poi si cancella.

```
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ricetta\costruisci.ps1 -Destinazione C:\Temp\MyDev-dalla-copia -Deposito E:\MyDev-copia\MyDev-deposito -SenzaRete
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ricetta\costruisci.ps1 -Destinazione C:\Temp\MyDev-estesa-dalla-copia -Deposito E:\MyDev-copia\MyDev-estesa-deposito -Variante estesa -SenzaRete
```

Due sorgenti non hanno impronta, gli archivi della FFmpeg di Chromium presi da googlesource, perché quel server li genera al volo a ogni richiesta: sono ammessi solo per nome, e per loro la verifica controlla che l'archivio sia intero, e lo dice. Gli archivi di GitHub a un commit fissato hanno byte e impronta come gli altri: misurati stabili nel novembre 2026, ma GitHub non lo garantisce; se uno cambia impronta, la verifica lo dice in rosso e il commento in testa a `ricetta/sorgenti.ps1` spiega come rimisurarlo.

## Come si verifica

```
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ricetta\verifica.ps1 -Unita C:\MyDev
C:\MyDev\python\python.exe -I -B ricetta\licenze_unita.py C:\MyDev
C:\MyDev\python\python.exe -I -B C:\MyDev\vscodium\insieme.py --verifica
```

La verifica confronta ogni file dell'unità con l'elenco che la costruzione ha scritto in `unita-file.txt`, e dice quali sono diversi, mancanti o estranei. La seconda riga controlla l'indice delle licenze, `LICENZE.txt`, contro i componenti e i testi che l'unità contiene. La terza confronta le estensioni dell'editor, `product.json` e l'impostazione `extensions.allowed` con l'insieme che `unita.json` dichiara (campo `estensioni`). È lo stesso confronto che `VSCodium.exe` fa a ogni apertura: se qualcosa non torna, mostra una finestra di avviso e apre l'editor lo stesso. L'editor dell'unità non installa estensioni fuori da quell'insieme, né dal menu né da riga di comando.

Il gate di portabilità fa girare le prove dell'unità da una cartella con **due spazi consecutivi** nel nome, il caso più difficile per i percorsi. Prima si copia l'unità lì:

```
robocopy C:\MyDev "C:\Temp\MyDev  prova" /E /R:1 /W:1 /NFL /NDL /NJH /NJS
powershell.exe -NoProfile -ExecutionPolicy Bypass -File collaudo\unita\gate.ps1 -Unita "C:\Temp\MyDev  prova"
```

`robocopy` esce con 1 quando ha copiato dei file: non è un errore; da 8 in su sì (un file non copiato, per esempio perché l'editor dell'unità era aperto). Il gate cerca i percorsi assoluti anche della cartella in cui l'unità è stata costruita, che legge dalla copia; altre cartelle si aggiungono con `-Altro "<cartella>;<cartella>"`. Con `-Finestre` apre anche l'editor, due volte, tre nell'estesa, e Chromium due volte, dal lanciatore e senza; la finestra può prendere la tastiera mentre scrivi. Con `-Finestre` l'unità non deve essere mai stata aperta: se Chromium vi ha già creato il suo profilo (`home\chromium`), il passo di Chromium si ferma, perché non potrebbe dire se le preferenze iniziali funzionano; si copia un'unità appena costruita o scaricata, in una destinazione vuota. Su un PC di sviluppo, con le finestre, il gate ha richiesto fra 16 e 29 minuti per la base e fra 20 e 37 per l'estesa, secondo quanto altro lavorava sul PC; senza finestre si risparmiano le aperture.

Il gate prova anche il **corpus di esecuzione**: il codice C e Python che l'estensione dell'unità genera dai 192 file `.algo` di prova di AlgoDesign si compila coi due compilatori dell'unità (il Python con il controllo di sintassi del suo Python), si esegue e si confronta con gli attesi dei casi d'uso: 1506 esiti, di cui 1392 da un programma eseguito e 114 decisi dall'errore statico del caso, senza eseguire nulla; le differenze ammesse sono dichiarate una per una, col motivo, in `collaudo/esecuzione/prova.ts`. Quel passo vuole Bun e il repository di AlgoDesign, come le prove (vedi i prerequisiti): senza Bun il gate si ferma, con l'uscita 2.

Ogni comando finisce con una riga `ESITO:`. Le uscite sono 0 verde, 1 rosso, 2 fermo (non si è potuto misurare). Un parametro sbagliato lo rifiuta PowerShell prima che il comando parta: esce con 1 e senza la riga `ESITO:`.

## Che cosa manca e perché

Dai pacchetti ufficiali il costruttore toglie i file che non si possono ridistribuire o che portano codec proprietari, e `unita.json` li elenca uno per uno (`tolti`, `sostituiti`):

- da VSCodium: `d3dcompiler_47.dll`, `dxcompiler.dll`, `dxil.dll` (Microsoft), `bin/codium-tunnel.exe`, l'estensione di accesso con un account Microsoft (con `msalruntime.dll`), `Microsoft.PowerShell.Pager.dll`, e `ffmpeg.dll`, sostituito da quello di Electron 43.7.7 coi soli formati liberi (senza un `ffmpeg.dll` la finestra dell'editor non parte);
- da Neovim: `bin/DbgHelp.dll` (Microsoft): Neovim usa quella di Windows;
- da Chromium: `d3dcompiler_47.dll` e `dxcompiler.dll` (Microsoft): Chromium usa quello di Windows.

Che cosa vuol dire per chi usa l'editor:

- **H.264, H.265 e AAC non si riproducono**. Lo `ffmpeg.dll` libero da solo non basta: Electron è compilato coi codec proprietari e passa H.264 e H.265 alla scheda video del PC. Per questo `vscodium\data\argv.json` spegne l'accelerazione della scheda video (`"disable-hardware-acceleration": true`), e l'editor disegna senza. Chi toglie quella riga riaccende H.264 e H.265 attraverso la scheda video; `ricetta/verifica.ps1` lo segnala come file cambiato, ma nell'unità nessuna finestra lo avvisa (il controllo all'apertura guarda le estensioni).
- **Alle domande sui formati** (`canPlayType`, `MediaSource.isTypeSupported`, `MediaCapabilities`) l'editor risponde ancora «sì» per H.264 e AAC, anche se poi non li decodifica: le risposte sono fissate in Electron alla compilazione, e per cambiarle servirebbe ricostruire l'editor. VP9, AV1 e Opus si riproducono.
- **Non c'è l'accesso con un account Microsoft.**

`collaudo/unita/editor.ps1` controlla i file (quelli tolti, l'impronta di `ffmpeg.dll`, la riga di `argv.json`), non che cosa l'editor decodifica: quello si misura con l'editor aperto, a ogni versione nuova di VSCodium.

## Chromium

Il browser dell'unità è ungoogled-chromium 157.0.8103.38-1.1, cioè Chromium senza i servizi di Google, costruito **senza i codec coperti da brevetti** nel repository [`gspe65/chromium-senza-codec`](https://github.com/gspe65/chromium-senza-codec) con le GitHub Actions: la procedura di ungoogled-chromium per Windows, con le opzioni che tolgono H.264, H.265, AAC e il modulo che decifra i contenuti protetti. Lo zip sta fra le release di quel repository, con un'attestazione di provenienza che lo lega alla corsa che l'ha costruito; il costruttore ne confronta l'impronta, e l'attestazione si controlla con:

```
gh attestation verify ungoogled-chromium_157.0.8103.38-1.1_windows_x64.zip -R gspe65/chromium-senza-codec
```

Che cosa vuol dire per chi lo usa:

- **H.264, H.265 e AAC non si riproducono**, nemmeno attraverso la scheda video; VP9, AV1 e Opus sì. Un sito che offre solo quei formati mostra un errore al posto del video.
- **I contenuti protetti non si riproducono** (Netflix, Spotify e simili), e **non c'è l'accesso con un account Google**.
- **Le estensioni sono spente**, e Chromium non si aggiorna: la versione è quella della ricetta.
- Il lanciatore gli dà un profilo dentro l'unità e apre a ogni avvio la pagina «Chromium in MyDev», che spiega queste cose; la barra degli indirizzi cerca con DuckDuckGo, dalle preferenze iniziali (`ricetta/unita/chromium/`).

Il gate dell'unità apre Chromium dal lanciatore e controlla il profilo, la pagina e le scritture fuori dall'unità, non che cosa Chromium decodifica: quello si misura con una pagina di prova dei codec, a ogni versione nuova di Chromium.

**Una scrittura fuori dall'unità, dichiarata.** Ogni Chromium su Windows scrive nel registro, sotto `HKCU\Software\Chromium`, i codici di controllo delle sue impostazioni e lo stato dell'ultima chiusura, e nessuna opzione lo spegne: il gate ammette quelle sole chiavi, misurate, e dà rosso su ogni altra scrittura.

**La FFmpeg**, la libreria che decodifica audio e video (licenza LGPL), in questa versione è collegata dentro `chrome.dll`; un `chrome.dll` con la FFmpeg in un file a parte, `ffmpeg.dll`, è previsto per la `0.3.0`. I sorgenti della FFmpeg e della procedura di costruzione stanno fra quelli che `ricetta/sorgenti.ps1` scarica; per il sorgente completo di Chromium, circa 2 GB, l'indice delle licenze rimanda a quello di Google, alla stessa versione.

## Il corso sui puntatori, nell'estesa

L'unità estesa porta in `progetti/puntatori` il codice di un corso sui puntatori, in C e in Rust, con i due programmi che lo verificano. Nella ricetta è una copia fissata a un commit del repository del corso, in `ricetta/unita/progetti-puntatori/`: `ricetta/puntatori/inventario.json` dice il commit, i file lasciati fuori col motivo e l'impronta di ogni file.

```
python -B ricetta/puntatori/uguaglianza.py --solo-copia
```

confronta la copia con l'inventario, nei due versi; con `--repo <repository del corso>` al posto di `--solo-copia` confronta anche l'inventario con il commit. Il kit dell'estesa fa lo stesso confronto sulla cartella dell'unità e lancia i due verificatori del corso. La copia non si corregge qui: un difetto si corregge nel repository del corso, e la copia si rifissa al commit nuovo con `--repo <repository del corso> --scrivi --commit <commit>`.

## Se dai l'unità ad altri

Alcuni componenti hanno licenze che chiedono di dare anche i sorgenti a chi riceve una copia. La nota in testa a `LICENZE.txt`, nell'unità, spiega le due strade: i sorgenti accanto alla copia, oppure un'offerta scritta. Questo comando li scarica tutti, alla versione esatta e con l'impronta confrontata:

```
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ricetta\sorgenti.ps1 -Destinazione D:\sorgenti -Variante estesa
```

Per l'estesa sono 77 archivi, circa 785 MB; con `-Variante base` solo quelli della base, 75, circa 765 MB. Un file già presente non si riscarica, si verifica.

## L'estensione per i file `.algo`

Nell'unità è già installata. Altrove si installa dal pacchetto della release del suo repository:

```
code --install-extension AlgoDesign-Code-0.0.2.vsix
```

Apri un file `.algo` e dalla riga di comando dell'editor scegli «Mostra il codice generato». Il linguaggio e la lingua si scelgono nelle impostazioni `algo.linguaggio` e `algo.lingua`. I file `.algo` hanno l'icona di AlgoDesign.

Il documento è in sola lettura e si aggiorna rilanciando il comando, non da solo. Viene dal file salvato: se ci sono modifiche non salvate, il comando lo dice. Se il codice non si può generare, il documento dice perché. L'estensione non compila e non esegue. Il pacchetto porta i testi delle sue licenze ed è ancora un prototipo.

L'estensione usa il nucleo di AlgoDesign attraverso le funzioni della libreria. Il pacchetto `0.0.2` porta il **contratto 1.0**: cinque funzioni, il file della release `v1.0.0` di AlgoDesign. La ricetta è già al **contratto 1.1**: sette funzioni, cioè `disegna` (il flowchart di una funzione in SVG) e `segnalazioni` (gli errori e gli avvisi con le frasi di AlgoDesign) in più. Fino alla release `1.0.1` di AlgoDesign il contratto 1.1 viene da un commit fissato: il pacchetto si costruisce dai sorgenti di quel commit e deve avere i byte e l'impronta scritti in `ricetta/nucleo/pacchetto.json`. Lo zip della release `v1.0.0` resta verificato nel deposito, perché è quello che il pacchetto dell'estensione porta. In `pacchetto.json` il contratto ha una voce per riferimento (un'etichetta o un commit), col numero accanto all'impronta del punto d'ingresso, e `bun ricetta/nucleo/pacchetto.ts` dà rosso se il punto d'ingresso cambia e il numero no.

## Come si provano il nucleo e le estensioni

```
bun ricetta/nucleo/chiusura.ts
bun ricetta/nucleo/prove.ts
bun collaudo/libreria/prova.ts
bun collaudo/conformita/prova.ts
bun collaudo/algo/prova.ts
bun ricetta/licenze.ts --verifica
```

Come sopra, ognuna finisce con una riga `ESITO:` oppure `FERMO:`.

La prova di conformità confronta il pacchetto sotto Node con i sorgenti del nucleo sotto Bun, su tutti i file di prova di AlgoDesign, in ogni linguaggio e nelle due lingue. Per il contratto 1.1 confronta anche il disegno di ogni funzione, senza e coi bollini sui blocchi segnalati (l'SVG byte per byte, con una misura del testo fissa), e le segnalazioni, appaiate ai codici del controllo nei due versi. Lo stesso pacchetto lo prova anche in un contesto senza Node, come in una pagina. Prova infine il file della release `v1.0.0`, quello che il pacchetto dell'estensione porta.

`bun collaudo/algo/prova.ts` riscarica il pacchetto dell'estensione dalla release e lo lega alla ricetta: byte e impronta della voce, l'etichetta che punta al commit della voce, l'attestazione della corsa che l'ha costruito, le voci dello zip nei due versi coi file del repository a quell'etichetta, il file del nucleo che la prova di conformità prova. Serve la rete. Con `--unita <cartella>` controlla anche che l'estensione installata nell'unità sia il pacchetto, file per file:

```
bun collaudo/algo/prova.ts --unita C:\MyDev
```

## Licenza

© 2026 Giuseppe Lancellotti. Due licenze, secondo il tipo di contenuto:

| Contenuto | Licenza | Testo |
|---|---|---|
| **Codice**: sorgenti, script, configurazioni di costruzione e di prova | [MIT](https://opensource.org/license/mit) | [`LICENSE`](LICENSE) |
| **Documentazione**: i file Markdown (`*.md`) del repository | [Creative Commons Attribuzione 4.0 Internazionale (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/) | [`LICENSE-DOCS`](LICENSE-DOCS) |

Fa eccezione `ricetta/unita/progetti-puntatori/terzi/sds/`, codice di terzi incluso nel corso sui puntatori, con la sua licenza BSD (il `LICENSE` e la `PROVENIENZA.md` nella sua cartella).

MyDev incorpora il nucleo di AlgoDesign, che ha la sua licenza MIT, e usa strumenti di sviluppo di terze parti, ciascuno con la propria licenza: l'elenco e i testi sono in [`LICENZE-DI-TERZE-PARTI.txt`](LICENZE-DI-TERZE-PARTI.txt), generato da `bun ricetta/licenze.ts`. I componenti dell'unità hanno il loro indice, `LICENZE.txt` alla radice dell'unità, generato da `ricetta/licenze_unita.py`.

## Autore

Giuseppe Lancellotti, docente di informatica: https://www.lancellotti.info

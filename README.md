# MyDev

Un ambiente di sviluppo portabile per Windows, pensato per i laboratori scolastici e per i PC di casa: si copia su disco o su una chiavetta e non richiede diritti di amministratore. Contiene VSCodium, i compilatori C `gcc` e `clang` con il debugger, Python, l'ambiente POSIX di MSYS2, Neovim, Nginx e AlgoDesign. La variante **estesa** aggiunge Rust, `git` e `gh`.

Il repository versiona la **ricetta** con cui si costruisce l'ambiente, non l'ambiente stesso: il costruttore scarica ogni componente dalla sua fonte originale, alla versione fissata, e ne confronta l'impronta. La versione pubblicata è la `0.1.0`: è l'etichetta `v0.1.0` di questo repository, con la sua pagina fra le release. La release non contiene file compilati: l'unità si costruisce con la ricetta, come spiegato qui sotto.

## Che cosa c'è

| Cartella | Contenuto |
|---|---|
| `ricetta/` | Il costruttore e la verifica dell'unità, l'elenco dei componenti con versione, fonte e impronta (`componenti.json`, e `componenti-estesa.json` per l'aggiunta dell'estesa), l'indice delle licenze e il comando dei sorgenti |
| `ricetta/unita/` | I file nostri che entrano nell'unità: il lanciatore, i comandi di `bin`, le impostazioni dell'editor, i progetti di esempio e le guide |
| `ricetta/nucleo/` | Estrae il nucleo di AlgoDesign da un'etichetta fissata e lo verifica per impronta |
| `extensions/libreria/` | La libreria sopra il nucleo, con cinque funzioni: apri, controlla, genera, leggi Accademico, aggiungi alla libreria |
| `extensions/algo/` | Il prototipo dell'estensione per i file `.algo`, che nell'unità è già installata |
| `collaudo/` | Le prove: della libreria, della conformità al nucleo, dell'estensione, e il kit dell'unità col suo gate |

## Prerequisiti

- Windows 10 o 11 x64, con Windows PowerShell 5.1 e `tar.exe` in `System32` (ci sono già).
- Git.
- [Bun](https://bun.sh) 1.4.2 e [Node.js](https://nodejs.org) 24, per il pacchetto dell'estensione e per le prove.
- VS Code, solo per installarvi il pacchetto dell'estensione e per la sua prova con `--finestra`.
- Il repository di AlgoDesign, con l'etichetta `v1.0.0`, nella cartella `AlgoDesign` accanto a questa oppure indicato con la variabile d'ambiente `ALGODESIGN_REPO`.
- La rete, la prima volta: il deposito dei componenti pesa circa 1,0 GB per la base e 1,1 GB per l'estesa. L'unità costruita occupa circa 2,4 GB, l'estesa 3,1 GB.

## Come si costruisce l'unità

I comandi sono per PowerShell, dalla cartella del repository. Prima il pacchetto dell'estensione, che il costruttore copia nell'unità:

```
bun install --frozen-lockfile
bun ricetta/nucleo/estrai.ts
bun run algo:costruisci
```

La costruzione dell'estensione prende il pacchetto del nucleo dalla release di AlgoDesign e ne confronta l'impronta: la prima volta serve la rete, poi resta in `ricetta/nucleo/scaricato/`.

Poi l'unità, base o estesa:

```
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ricetta\costruisci.ps1 -Destinazione C:\MyDev
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ricetta\costruisci.ps1 -Destinazione C:\MyDev-estesa -Variante estesa
```

La destinazione deve essere vuota o non esistere. I componenti scaricati restano in un deposito accanto alla destinazione (`C:\MyDev-deposito`, `C:\MyDev-estesa-deposito`; si cambia con `-Deposito`), e la volta dopo si costruisce anche senza rete con `-SenzaRete`. Ogni variante vuole il proprio deposito.

Dal deposito pieno la costruzione dura circa 15 minuti, per la base come per l'estesa. Gran parte del tempo la prende l'antivirus, che esamina decine di migliaia di file piccoli: con la cartella esclusa dall'analisi in tempo reale si scende a circa 4 minuti.

La destinazione non può essere la radice di un disco, e i file dei componenti si leggono dall'albero di lavoro: con un file modificato o nuovo sotto `ricetta\` o `extensions\` la costruzione si ferma, perché l'unità dichiarerebbe un commit che non è il suo (con `-AlberoModificato` procede, e `unita.json` lo dice).

L'unità finita si sposta e si copia come una cartella qualsiasi, anche in un percorso con spazi o su una chiavetta, purché il percorso della cartella non superi i 65 caratteri: alcuni file stanno 193 caratteri più in fondo, e molti programmi di Windows non aprono i percorsi oltre i 259. Come si usa lo dice il suo `README.md`, alla radice.

## Se una fonte sparisce

Ogni componente si scarica dalla sua fonte originale (l'archivio dei pacchetti di MSYS2, PyPI, Open VSX, le release dei progetti su GitHub, i siti dei progetti), e una fonte può sparire: un pacchetto vecchio esce dall'archivio, un progetto toglie una release, cambia indirizzo o chiude. Questo repository non tiene una copia dei componenti. Se una fonte non risponde, il costruttore si ferma prima di scrivere la destinazione e nomina il componente, con la versione, l'indirizzo, il file atteso nel deposito e la sua impronta:

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

Un sorgente non ha impronta, perché il server lo genera al volo a ogni richiesta: per quello la verifica controlla che l'archivio sia intero, e lo dice.

## Come si verifica

```
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ricetta\verifica.ps1 -Unita C:\MyDev
C:\MyDev\python\python.exe -I -B ricetta\licenze_unita.py C:\MyDev
```

La verifica confronta ogni file dell'unità con l'elenco che la costruzione ha scritto in `unita-file.txt`, e dice quali sono diversi, mancanti o estranei. La seconda riga controlla l'indice delle licenze, `LICENZE.txt`, contro i componenti e i testi che l'unità contiene.

Il gate di portabilità fa girare le prove dell'unità da una cartella con **due spazi consecutivi** nel nome, il caso più difficile per i percorsi. Prima si copia l'unità lì:

```
robocopy C:\MyDev "C:\Temp\MyDev  prova" /E /R:1 /W:1 /NFL /NDL /NJH /NJS
powershell.exe -NoProfile -ExecutionPolicy Bypass -File collaudo\unita\gate.ps1 -Unita "C:\Temp\MyDev  prova"
```

`robocopy` esce con 1 quando ha copiato dei file: non è un errore; da 8 in su sì (un file non copiato, per esempio perché l'editor dell'unità era aperto). Il gate cerca i percorsi assoluti anche della cartella in cui l'unità è stata costruita, che legge dalla copia; altre cartelle si aggiungono con `-Altro "<cartella>;<cartella>"`. Con `-Finestre` apre anche l'editor, due volte, tre nell'estesa; la finestra può prendere la tastiera mentre scrivi. Su un PC di sviluppo, con le finestre, il gate ha richiesto circa 18 minuti per la base e 16 per l'estesa; senza finestre si risparmiano le aperture dell'editor.

Ogni comando finisce con una riga `ESITO:`. Le uscite sono 0 verde, 1 rosso, 2 fermo (non si è potuto misurare). Un parametro sbagliato lo rifiuta PowerShell prima che il comando parta: esce con 1 e senza la riga `ESITO:`.

## Se dai l'unità ad altri

Alcuni componenti hanno licenze che chiedono di dare anche i sorgenti a chi riceve una copia. La nota in testa a `LICENZE.txt`, nell'unità, spiega le due strade: i sorgenti accanto alla copia, oppure un'offerta scritta. Questo comando li scarica tutti, alla versione esatta e con l'impronta confrontata:

```
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ricetta\sorgenti.ps1 -Destinazione D:\sorgenti -Variante estesa
```

Per l'estesa sono 74 archivi, circa 765 MB; con `-Variante base` solo quelli della base, 72, circa 745 MB. Un file già presente non si riscarica, si verifica.

## L'estensione per i file `.algo`

Nell'unità è già installata. In VS Code si installa dal pacchetto:

```
code --install-extension extensions/algo/dist/algo-codice.vsix
```

Apri un file `.algo` e dalla riga di comando dell'editor scegli «Mostra il codice generato». Il linguaggio e la lingua si scelgono nelle impostazioni `algo.linguaggio` e `algo.lingua`. I file `.algo` hanno l'icona di AlgoDesign.

Il documento è in sola lettura e si aggiorna rilanciando il comando, non da solo. Viene dal file salvato: se ci sono modifiche non salvate, il comando lo dice. Se il codice non si può generare, il documento dice perché. L'estensione non compila e non esegue. Il pacchetto porta i testi delle sue licenze ed è ancora un prototipo.

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

La prova di conformità confronta il pacchetto sotto Node con i sorgenti del nucleo sotto Bun, su tutti i file di prova di AlgoDesign, in ogni linguaggio e nelle due lingue.

```
bun collaudo/algo/prova.ts --finestra
bun collaudo/algo/prova.ts --unita C:\MyDev
```

La prima apre VS Code per pochi secondi, con un profilo temporaneo; la seconda apre l'editor dell'unità, con l'estensione installata lì e coi dati dell'unità: le impostazioni che la prova cambia si rimettono come erano alla fine, anche se la si interrompe. In tutte e due la finestra può prendere la tastiera mentre scrivi. Senza `--finestra` né `--unita` l'esito dice che il documento nell'editor non è stato provato.

## Licenza

© 2026 Giuseppe Lancellotti. Due licenze, secondo il tipo di contenuto:

| Contenuto | Licenza | Testo |
|---|---|---|
| **Codice**: sorgenti, script, configurazioni di costruzione e di prova | [MIT](https://opensource.org/license/mit) | [`LICENSE`](LICENSE) |
| **Documentazione**: i file Markdown (`*.md`) del repository | [Creative Commons Attribuzione 4.0 Internazionale (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/) | [`LICENSE-DOCS`](LICENSE-DOCS) |

L'icona dell'estensione (`extensions/algo/icona.png`) è quella di AlgoDesign, dello stesso autore, e ne segue la licenza MIT (`extensions/algo/LICENZA-ALGODESIGN.txt`); la licenza copre il file, non il nome.

MyDev incorpora il nucleo di AlgoDesign, che ha la sua licenza MIT, e usa strumenti di sviluppo di terze parti, ciascuno con la propria licenza: l'elenco e i testi sono in [`LICENZE-DI-TERZE-PARTI.txt`](LICENZE-DI-TERZE-PARTI.txt), generato da `bun ricetta/licenze.ts`. I componenti dell'unità hanno il loro indice, `LICENZE.txt` alla radice dell'unità, generato da `ricetta/licenze_unita.py`.

## Autore

Giuseppe Lancellotti, docente di informatica: https://www.lancellotti.info

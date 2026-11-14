# Archivio chiave-valore: specifica dei comandi

Il programma conserva coppie chiave e valore. Legge i comandi dallo standard input, una riga alla volta, e per ogni comando scrive
una riga sullo standard output. Finisce quando l'ingresso finisce: da tastiera si chiude con Ctrl+Z e Invio su Windows, con Ctrl+D su
Linux.

La specifica non dipende dal linguaggio: lo stesso file di prova vale per il programma in C e per quello in Rust.

## Regole generali

- Le parole di una riga sono separate da uno o più spazi o tabulazioni. Chiavi e valori non contengono spazi.
- I nomi dei comandi si scrivono in maiuscolo: `get` è un comando sconosciuto.
- Ogni riga non vuota produce esattamente una riga di risposta. Le righe vuote non producono niente.
- Le chiavi distinguono maiuscole e minuscole.

## Comandi

| Comando | Da quale versione | Che cosa fa |
|---|---|---|
| `SET chiave valore` | 0 | memorizza il valore; se la chiave esiste, lo sostituisce |
| `GET chiave` | 0 | restituisce il valore della chiave |
| `DEL chiave` | 4 | cancella la chiave; dice se c'era |
| `EXISTS chiave` | 4 | dice se la chiave c'è |
| `INCR chiave` | 4 | aggiunge 1 al valore intero della chiave e restituisce il risultato; una chiave assente vale 0 |

## Risposte

| Risposta | Da quale versione | Quando |
|---|---|---|
| `OK` | 0 | `SET` riuscito |
| il valore | 0 | `GET` di una chiave presente |
| `(nil)` | 0 | `GET` di una chiave assente |
| `ERR comando sconosciuto` | 0 | la prima parola non è un comando |
| `ERR pieno` | 0 | `SET` o `INCR` di una chiave nuova con l'archivio pieno; una chiave già presente si può sempre modificare. Non esiste più dalla versione 5 |
| `ERR numero di argomenti` | 2 | troppe o troppo poche parole per quel comando |
| `ERR troppo lungo` | 2 | oltre i limiti della tabella qui sotto. Non esiste più dalla versione 5 |
| `1` | 4 | `DEL` ha cancellato; `EXISTS` ha trovato |
| `0` | 4 | `DEL` non ha cancellato; `EXISTS` non ha trovato |
| un numero intero | 4 | il risultato di `INCR` |
| `ERR intero non valido` | 4 | `INCR` su un valore che non è un intero, o il cui risultato non sta in 64 bit con segno |

## Le versioni e i loro limiti

| Versione | Nome | Voci al massimo | Chiave e valore | Riga |
|---|---|---|---|---|
| 0 | Il primo archivio | 8 | 31 caratteri, non controllati | non controllata |
| 1 | L'archivio con i puntatori | 8 | 31 caratteri, non controllati | non controllata |
| 2 | L'archivio che capisce le righe | 8 | 31 caratteri, controllati | 127 caratteri, controllati |
| 3 | L'archivio con le strutture | 8 | 31 caratteri, controllati | 127 caratteri, controllati |
| 4 | L'archivio nell'heap | 8 | senza un proprio limite | 127 caratteri, controllati |
| 5 | L'archivio che cresce | nessun limite | nessun limite | nessun limite |
| 6 | L'archivio con la lista | nessun limite | nessun limite | nessun limite |
| 7 | L'archivio con la tabella hash | nessun limite | nessun limite | nessun limite |

Le versioni 0 e 1 si fidano di chi scrive: i comandi devono essere ben formati e le parole non più lunghe del limite. Con una riga
malformata o una parola troppo lunga il comportamento non è definito. È uno dei limiti che le lezioni fanno scoprire e che le versioni
successive superano.

## Come si prova una versione

Ogni versione ha una cartella con due file: `comandi.txt`, i comandi da dare al programma, e `attese.txt`, le risposte giuste, nello
stesso ordine.

Da un terminale `cmd` su Windows, o da una shell su Linux, nella cartella del programma:

```
clang -Wall -Wextra -g -o archivio archivio.c
.\archivio < comandi.txt > uscita.txt
```

Su Linux il programma si lancia con `./archivio`. In PowerShell il simbolo `<` non esiste: si scrive
`cmd /c ".\archivio < comandi.txt > uscita.txt"`.

Poi si confronta l'uscita con le risposte attese:

| Sistema | Comando | Se è tutto giusto |
|---|---|---|
| Windows | `fc uscita.txt attese.txt` | `FC: nessuna differenza riscontrata` |
| Linux | `diff uscita.txt attese.txt` | non stampa niente |

Per cercare gli errori di memoria si compila con `-fsanitize=address` e si ripete la prova.

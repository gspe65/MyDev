# Guida agli strumenti dell'estesa

Questa unita' ha, oltre a quanto descrive `GUIDA-C.md`, Rust, `git` e `gh`. Qui trovi una voce per ogni strumento in piu' e per ogni programma che abbiamo aggiunto noi.

Tutto funziona dal **terminale** dell'unita', e da **VSCodium**, senza installare niente sul PC. Rust e' quello dell'ambiente POSIX dell'unita', lo stesso di `gcc`: per questo `fork`, i segnali e i thread ci sono anche da Rust.

---

## Da dove cominciare

```bash
cd "$MYDEV/progetti"
cargo new prova
cd prova
cargo run
```

Devi vedere `Hello, world!`. I progetti del corso, in Rust, sono in `rust-comuni/` e `rust-processi/`: stessi numeri e stessi nomi dei progetti C, e ognuno ha il suo `LEGGIMI.md`.

> **Senza rete funziona tutto, tranne una cosa**: una libreria esterna aggiunta con `cargo add` va scaricata. I progetti del corso non ne usano: solo la libreria standard.

---

## Gli strumenti

### rustc
**Nell'elenco:** `msys/rust`

Il compilatore di Rust. Di solito non lo chiami da solo: lo chiama `cargo`.

```bash
rustc --version
```

### cargo
**Nell'elenco:** `msys/rust`

Crea i progetti, li compila, li esegue. Un progetto ha un `Cargo.toml` e i sorgenti in `src/`; il programma compilato finisce in `target/debug/`.

```bash
cargo build       # compila
cargo run         # compila ed esegue
cargo run -- a b  # gli argomenti del programma, dopo i due trattini
cargo clean       # cancella target/
```

### clippy
**Nell'elenco:** `msys/rust`

Legge il codice e ti dice dove si potrebbe scrivere meglio.

```bash
cargo clippy
```

### rustfmt
**Nell'elenco:** `msys/rust`

Mette in ordine il codice, sempre allo stesso modo.

```bash
cargo fmt
```

### rust-analyzer
**Nell'elenco:** `estensioni/rust-lang.rust-analyzer`, `rust/rust-src`

L'estensione di VSCodium che completa il codice e va alla definizione, anche dentro la libreria standard, di cui ci sono i sorgenti. Funziona se apri in VSCodium la **cartella del progetto**, quella col `Cargo.toml`. La prima volta impiega qualche secondo, e scrive in `target/` come fa `cargo`.

### I manuali
**Nell'elenco:** `rust/rust-docs`

Quattro manuali, da leggere senza rete. Apri con un doppio clic, nella cartella dell'unita':

| | |
|---|---|
| `rust-docs/book/index.html` | il libro, per imparare il linguaggio |
| `rust-docs/rust-by-example/index.html` | esempi da provare |
| `rust-docs/cargo/index.html` | il manuale di `cargo` |
| `rust-docs/reference/index.html` | la definizione precisa del linguaggio |

> I collegamenti alla libreria standard (`std`, `core`) e agli altri manuali non funzionano: quelle pagine non ci sono. Per la libreria standard usa «vai alla definizione» di `rust-analyzer`.

### git
**Nell'elenco:** `msys/git`

Tiene la storia di un progetto. E' il `git` dell'ambiente POSIX dell'unita', e lo usa anche il pannello di VSCodium.

```bash
git config --global user.name "Il tuo nome"
git config --global user.email "tu@example.com"
git init
git add .
git commit -m "primo commit"
git log --oneline
```

Il nome e l'indirizzo restano nell'unita', in `home/.gitconfig`: nulla finisce sul PC.

### gh
**Nell'elenco:** `strumenti/gh`

Il programma di GitHub dal terminale: serve la rete e un account.

```bash
gh auth login --hostname github.com --git-protocol https --web
gh auth status
gh repo list
gh auth logout
```

> ⚠️ **Il token di accesso sta in chiaro nell'unita'**, in `home/.config/gh/hosts.yml`. Chi copia la tua unita' o la tua chiavetta copia anche il token, e puo' agire su GitHub al posto tuo. Su un PC che non e' il tuo, a fine lavoro fai `gh auth logout`: toglie il file, e il login di un `gh` installato su quel PC resta dov'e'.

> Una sola cosa esce dall'unita'. Se sul PC c'e' un `gh` collegato a un **altro** account, `gh auth login` toglie dal portachiavi di Windows la sua voce «attiva». Quel `gh` continua a funzionare, perche' ne ha una seconda col nome dell'account.

---

## I programmi nostri

Non li chiami mai direttamente: sono qui perche', se qualcosa non va, tu sappia che cosa sono.

### cargo-ponte
**Nell'elenco:** `cargo-ponte`

In `bin/`. `rust-analyzer` e' un programma Windows e parla con percorsi `C:\...`, `cargo` e' dell'ambiente POSIX e parla con `/c/...`: questo programma traduce fra i due.

### rustc-ponte
**Nell'elenco:** `rustc-ponte`

In `bin/`. La stessa cosa per `rustc`.

### programmi/Git/cmd/git.exe
**Nell'elenco:** `git-pannello`

Il pannello git di VSCodium cerca il `git` in `Program Files` prima che nel `PATH`, e sul tuo PC potrebbe trovarne un altro. Questo programma lo fa arrivare al `git` dell'unita'. Dalla sua presenza il lanciatore capisce che l'unita' e' quella estesa.

### bin/gh
**Nell'elenco:** `gh-comando`

Quando scrivi `gh` nel terminale parte questo comando. Passa tutto al programma vero e aggiunge tre cose: `gh auth login` tiene il token nell'unita', il percorso assoluto di `gh` non finisce in `.gitconfig`, e `gh auth logout` toglie solo il login dell'unita'.

### Le impostazioni
**Nell'elenco:** `impostazioni-estesa`

In VSCodium, dal menu dei compiti: `Cargo: compila`, `Cargo: esegui`, `Cargo: clippy`, `Cargo: formatta`. Con un file di `src/` attivo, **F5** compila e parte nel debugger con la configurazione `Debug Rust`.

### I progetti in Rust
**Nell'elenco:** `progetti-rust`

`rust-simple`, `rust-multifile`, `rust-comuni/`, `rust-processi/`: la versione Rust di ogni progetto C. Le uscite sono quelle del C. Ogni `LEGGIMI.md` ha una sezione «Dove sta l'`unsafe`».

### Le licenze
**Nell'elenco:** `licenze-estesa`

Alla radice dell'unità, `LICENZE-ESTESA.txt` elenca la licenza di ogni strumento di questa guida, coi percorsi dei testi; quelli che i pacchetti non portano stanno in `licenze/`. Gli altri componenti stanno in `LICENZE.txt`, che dice anche che cosa fare se dai una copia dell'unità ad altri.

---

## Le dipendenze

I pacchetti che servono a `git` e a Rust e che non si usano direttamente:

```
msys/heimdal
msys/heimdal-libs
msys/libcbor
msys/libedit
msys/libfido2
msys/libgit2
msys/llvm-libs
msys/openssh
msys/perl-authen-sasl
msys/perl-clone
msys/perl-convert-binhex
msys/perl-encode-locale
msys/perl-error
msys/perl-file-listing
msys/perl-html-parser
msys/perl-html-tagset
msys/perl-http-cookiejar
msys/perl-http-cookies
msys/perl-http-daemon
msys/perl-http-date
msys/perl-http-message
msys/perl-http-negotiate
msys/perl-io-html
msys/perl-io-socket-ssl
msys/perl-io-stringy
msys/perl-libwww
msys/perl-lwp-mediatypes
msys/perl-mailtools
msys/perl-mime-tools
msys/perl-net-http
msys/perl-net-smtp-ssl
msys/perl-net-ssleay
msys/perl-termreadkey
msys/perl-timedate
msys/perl-try-tiny
msys/perl-uri
msys/perl-www-robotrules
```

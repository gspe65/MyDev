"""Verifica la specifica, i file di prova e il codice C dell'archivio.

Uso, dalla radice del repository:
    python -B progetti/puntatori/codice/strumenti/verifica.py

Che cosa controlla:
  A. Specifica contro file di prova, nei due versi: ogni comando e ogni risposta
     fissa della specifica compaiono nelle prove delle versioni in cui valgono;
     ogni prima parola e ogni risposta fissa delle prove sono nella specifica.
  B. Ogni versione con un archivio.c: compilazione senza avvisi, con e senza
     AddressSanitizer; uscita uguale alle risposte attese, caso per caso.
  C. Controlli positivi: una risposta attesa alterata deve risultare DIVERSA;
     una parola troppo lunga, dove i limiti non sono controllati, deve far
     parlare AddressSanitizer.
  D. Dalla versione 4, compilando con -DCONTATORE: a fine corsa malloc uguale a
     free. Controllo positivo: tolta una chiamata a libera per volta, i due
     conteggi devono risultare diversi. Dove c'e' la tabella hash, il numero
     di bucket finale deve superare quello iniziale.
  E. Ogni versione con un progetto Rust: uscita uguale alle stesse risposte
     attese, cargo test, cargo clippy senza avvisi, senza rete. Controllo
     positivo: una sonda aggiunta al sorgente deve far parlare clippy.

Che cosa NON guarda (uno zero qui vale solo per cio' che sta sopra):
  - se le risposte attese sono GIUSTE rispetto al significato dei comandi: le
    confronta con il programma, non con un modello indipendente;
  - se il codice usa solo cio' che gli alunni hanno gia' visto: si rilegge a mano;
  - le perdite che il contatore non conta: una free tolta dentro libera lascia i
    conteggi uguali, e su Windows ASan non vede le perdite. Le vede
    verifica-linux.sh, nella macchina del corso;
  - il comportamento su Linux, che controlla lo stesso verifica-linux.sh.
"""

import os
import re
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent
SPECIFICA = RADICE / "test" / "SPECIFICA.md"

# Versioni in cui lunghezze e righe non sono controllate (specifica, «limiti»).
VERSIONI_SENZA_CONTROLLO = {0, 1}
SONDA_TROPPO_LUNGA = ("SET " + "k" * 100 + " v\nGET a\n").encode()

PRIMA_CON_CONTATORE = 4
CONTEGGI = re.compile(r"malloc (\d+), free (\d+)(?:, bucket (\d+))?")
UNA_LIBERAZIONE = re.compile(r"^[ \t]*libera\((?:s|&archivio), .+\);[ \t]*$", re.M)
BUCKET_INIZIALI = re.compile(r"#define BUCKET_INIZIALI (\d+)")


def trova_clang():
    if os.environ.get("CLANG"):
        return Path(os.environ["CLANG"])
    if shutil.which("clang"):
        return Path(shutil.which("clang"))
    sys.exit("ROTTO: clang non trovato (imposta la variabile CLANG)")


def celle_della_tabella(testo, titolo):
    """Le righe della tabella sotto «## titolo», senza intestazione."""
    if f"## {titolo}\n" not in testo:
        sys.exit(f"ROTTO: nella specifica manca la sezione «{titolo}»")
    blocco = testo.split(f"## {titolo}\n", 1)[1].split("\n## ", 1)[0]
    righe = [
        [c.strip() for c in riga.strip().strip("|").split("|")]
        for riga in blocco.splitlines()
        if riga.startswith("|") and not re.fullmatch(r"\|[-| ]+\|", riga.strip())
    ]
    return righe[1:]


def leggi_specifica():
    testo = SPECIFICA.read_text(encoding="utf-8")
    comandi, risposte = {}, {}
    for celle in celle_della_tabella(testo, "Comandi"):
        comandi[celle[0].strip("`").split()[0]] = int(celle[1])
    for celle in celle_della_tabella(testo, "Risposte"):
        if celle[0].startswith("`"):
            risposte[celle[0].strip("`")] = int(celle[1])
    return comandi, risposte


def righe(contenuto):
    """Le righe di un'uscita, ignorando la differenza fra CRLF e LF."""
    testo = contenuto.replace(b"\r\n", b"\n").decode("utf-8")
    return testo.split("\n")[:-1] if testo.endswith("\n") else testo.split("\n")


def differenze(uscita, attese):
    diverse = [
        (i + 1, u, a)
        for i, (u, a) in enumerate(zip(uscita, attese))
        if u != a
    ]
    if len(uscita) != len(attese):
        diverse.append(("righe", len(uscita), len(attese)))
    return diverse


def versioni_di_prova():
    trovate = []
    for cartella in sorted((RADICE / "test").iterdir()):
        if cartella.is_dir() and re.fullmatch(r"v\d+", cartella.name):
            trovate.append(int(cartella.name[1:]))
    return sorted(trovate)


def controlla_specifica(comandi, risposte, versioni):
    """Parte A. Restituisce il numero di problemi."""
    problemi = 0
    usati, viste = {}, {}
    for v in versioni:
        cartella = RADICE / "test" / f"v{v}"
        lista = [
            r for r in (cartella / "comandi.txt").read_text(encoding="utf-8").splitlines()
            if r.strip()
        ]
        attese = (cartella / "attese.txt").read_text(encoding="utf-8").splitlines()
        if len(lista) != len(attese):
            print(f"  ROTTO v{v}: {len(lista)} comandi, {len(attese)} risposte")
            problemi += 1
        for comando, attesa in zip(lista, attese):
            parola = comando.split()[0]
            usati.setdefault(parola, set()).add(v)
            # Una riga troppo lunga non arriva a essere divisa in parole.
            if parola not in comandi and attesa not in ("ERR comando sconosciuto", "ERR troppo lungo"):
                print(f"  ROTTO v{v}: «{parola[:40]}» non e' nella specifica e la risposta e' «{attesa}»")
                problemi += 1
            if attesa.startswith(("ERR", "(")) and attesa not in risposte:
                print(f"  ROTTO v{v}: risposta «{attesa}» non e' nella specifica")
                problemi += 1
            if attesa in risposte:
                viste.setdefault(attesa, set()).add(v)

    for nome, gruppo, elenco in (("comando", usati, comandi), ("risposta", viste, risposte)):
        for voce, entra in elenco.items():
            dovute = [v for v in versioni if v >= entra]
            if not dovute:
                print(f"  da coprire: {nome} «{voce}» (entra nella versione {entra}, prove non ancora scritte)")
            elif not set(dovute) & gruppo.get(voce, set()):
                print(f"  ROTTO: {nome} «{voce}» non compare nelle prove delle versioni {dovute}")
                problemi += 1
    print(
        f"  specifica: {len(comandi)} comandi, {len(risposte)} risposte fisse; "
        f"prove: {len(versioni)} versioni, {len(usati)} prime parole, {len(viste)} risposte fisse viste"
    )
    return problemi


def compila(clang, sorgente, eseguibile, asan, altre=()):
    opzioni = ["-Wall", "-Wextra", "-Werror", "-g", *altre]
    if asan:
        opzioni.append("-fsanitize=address")
    esito = subprocess.run(
        [str(clang), *opzioni, "-o", str(eseguibile), str(sorgente)],
        capture_output=True,
    )
    if esito.returncode != 0:
        print(esito.stderr.decode("utf-8", "replace"))
        return False
    return True


def esegui(eseguibile, ingresso, ambiente):
    return subprocess.run(
        [str(eseguibile)], input=ingresso, capture_output=True, timeout=30, env=ambiente
    )


def prova_versione(v, clang, ambiente, cartella_prove):
    """Parte B e C per una versione. Restituisce il numero di problemi."""
    sorgente = RADICE / "c" / f"v{v}" / "archivio.c"
    ingresso = (RADICE / "test" / f"v{v}" / "comandi.txt").read_bytes()
    attese = righe((RADICE / "test" / f"v{v}" / "attese.txt").read_bytes())
    problemi = 0

    for asan in (False, True):
        etichetta = "con ASan" if asan else "senza ASan"
        eseguibile = cartella_prove / f"v{v}{'_asan' if asan else ''}.exe"
        if not compila(clang, sorgente, eseguibile, asan):
            print(f"  ROTTO v{v} {etichetta}: non compila")
            problemi += 1
            continue
        esito = esegui(eseguibile, ingresso, ambiente)
        uscita = righe(esito.stdout)
        diverse = differenze(uscita, attese)
        errore = esito.stderr.decode("utf-8", "replace").strip()
        if diverse or esito.returncode != 0 or errore:
            print(f"  ROTTO v{v} {etichetta}: uscita {esito.returncode}, differenze {diverse[:5]}")
            if errore:
                print("  " + errore[:600])
            problemi += 1
        else:
            print(f"  v{v} {etichetta}: {len(attese)} casi su {len(attese)} giusti")

        if asan:
            # Controllo positivo del confronto: la stessa uscita, attese alterate.
            alterate = ["risposta alterata"] + attese[1:]
            if not differenze(uscita, alterate):
                print(f"  ROTTO v{v}: il confronto non vede una risposta alterata")
                problemi += 1
            else:
                print(f"  v{v} controllo positivo del confronto: differenza vista")

            if v in VERSIONI_SENZA_CONTROLLO:
                sonda = esegui(eseguibile, SONDA_TROPPO_LUNGA, ambiente)
                messaggio = sonda.stderr.decode("utf-8", "replace")
                if "AddressSanitizer" in messaggio and sonda.returncode != 0:
                    tipo = re.search(r"AddressSanitizer: ([\w-]+)", messaggio)
                    print(f"  v{v} controllo positivo di ASan: {tipo.group(1) if tipo else 'errore'} rilevato")
                else:
                    print(f"  ROTTO v{v}: ASan non vede la parola troppo lunga (uscita {sonda.returncode})")
                    problemi += 1

    if v >= PRIMA_CON_CONTATORE:
        problemi += prova_contatore(v, sorgente, clang, ambiente, cartella_prove, ingresso, attese)
    return problemi


def prova_contatore(v, sorgente, clang, ambiente, cartella_prove, ingresso, attese):
    """Parte D per una versione. Restituisce il numero di problemi."""
    eseguibile = cartella_prove / f"v{v}_contatore.exe"
    if not compila(clang, sorgente, eseguibile, False, ["-DCONTATORE"]):
        print(f"  ROTTO v{v} contatore: non compila")
        return 1
    esito = esegui(eseguibile, ingresso, ambiente)
    messaggio = esito.stderr.decode("utf-8", "replace").strip()
    misura = CONTEGGI.fullmatch(messaggio)
    diverse = differenze(righe(esito.stdout), attese)
    if diverse or esito.returncode != 0 or misura is None:
        print(f"  ROTTO v{v} contatore: uscita {esito.returncode}, differenze {diverse[:5]}, stderr «{messaggio[:200]}»")
        return 1

    problemi = 0
    malloc, free = int(misura.group(1)), int(misura.group(2))
    if malloc == 0 or malloc != free:
        print(f"  ROTTO v{v} contatore: malloc {malloc}, free {free}")
        problemi += 1
    else:
        print(f"  v{v} contatore: malloc {malloc}, free {free}")

    testo = sorgente.read_text(encoding="utf-8")
    iniziali = BUCKET_INIZIALI.search(testo)
    if iniziali:
        finali = int(misura.group(3) or 0)
        if finali > int(iniziali.group(1)):
            print(f"  v{v} ridimensionamento: bucket da {iniziali.group(1)} a {finali}")
        else:
            print(f"  ROTTO v{v}: bucket iniziali {iniziali.group(1)}, finali {finali}")
            problemi += 1

    # Controllo positivo: tolta una chiamata a libera, i conteggi devono differire.
    occorrenze = list(UNA_LIBERAZIONE.finditer(testo))
    viste = 0
    for indice, occorrenza in enumerate(occorrenze):
        mutato = cartella_prove / f"v{v}_senza_free_{indice}.c"
        mutato.write_text(testo[: occorrenza.start()] + testo[occorrenza.end() :], encoding="utf-8")
        eseguibile_mutato = cartella_prove / f"v{v}_senza_free_{indice}.exe"
        if not compila(clang, mutato, eseguibile_mutato, False, ["-DCONTATORE"]):
            print(f"  ROTTO v{v}: tolta «{occorrenza.group().strip()}» non compila")
            problemi += 1
            continue
        risultato = CONTEGGI.fullmatch(esegui(eseguibile_mutato, ingresso, ambiente).stderr.decode("utf-8", "replace").strip())
        if risultato and int(risultato.group(1)) != int(risultato.group(2)):
            viste += 1
        else:
            print(f"  ROTTO v{v}: tolta «{occorrenza.group().strip()}» il contatore non cambia")
            problemi += 1
    if not occorrenze:
        print(f"  ROTTO v{v}: nessuna chiamata a libera da togliere")
        problemi += 1
    else:
        print(f"  v{v} controllo positivo del contatore: {len(occorrenze)} chiamate a libera tolte una alla volta, {viste} viste diverse")
    return problemi


def cargo(argomenti, progetto, cartella_compilazione, ambiente):
    env = dict(ambiente)
    env["CARGO_TARGET_DIR"] = os.path.relpath(cartella_compilazione, progetto)
    return subprocess.run(
        ["cargo", argomenti[0], "--offline", "--quiet", *argomenti[1:]],
        cwd=progetto, capture_output=True, env=env,
    )


def prova_rust(v, ambiente, cartella_prove):
    """Parte E per una versione. Restituisce il numero di problemi."""
    progetto = RADICE / "rust" / f"v{v}"
    compilazione = cartella_prove / f"rust_v{v}"
    ingresso = (RADICE / "test" / f"v{v}" / "comandi.txt").read_bytes()
    attese = righe((RADICE / "test" / f"v{v}" / "attese.txt").read_bytes())
    problemi = 0

    esito = cargo(["build"], progetto, compilazione, ambiente)
    if esito.returncode != 0:
        print(f"  ROTTO Rust v{v}: non compila\n" + esito.stderr.decode("utf-8", "replace")[:800])
        return 1
    eseguibile = compilazione / "debug" / ("archivio.exe" if os.name == "nt" else "archivio")
    risultato = esegui(eseguibile, ingresso, ambiente)
    uscita = righe(risultato.stdout)
    diverse = differenze(uscita, attese)
    errore = risultato.stderr.decode("utf-8", "replace").strip()
    if diverse or risultato.returncode != 0 or errore:
        print(f"  ROTTO Rust v{v}: uscita {risultato.returncode}, differenze {diverse[:5]}, stderr «{errore[:200]}»")
        problemi += 1
    else:
        print(f"  Rust v{v}: {len(attese)} casi su {len(attese)} giusti")

    if differenze(uscita, ["risposta alterata"] + attese[1:]):
        print(f"  Rust v{v} controllo positivo del confronto: differenza vista")
    else:
        print(f"  ROTTO Rust v{v}: il confronto non vede una risposta alterata")
        problemi += 1

    prove = cargo(["test"], progetto, compilazione, ambiente)
    if prove.returncode != 0:
        print(f"  ROTTO Rust v{v}: cargo test\n" + prove.stdout.decode("utf-8", "replace")[-800:])
        problemi += 1
    else:
        print(f"  Rust v{v} cargo test: verde")

    avvisi = cargo(["clippy", "--all-targets", "--", "-D", "warnings"], progetto, compilazione, ambiente)
    if avvisi.returncode != 0:
        print(f"  ROTTO Rust v{v}: clippy\n" + avvisi.stderr.decode("utf-8", "replace")[:1200])
        problemi += 1
    else:
        print(f"  Rust v{v} clippy: nessun avviso")

    # Controllo positivo: la stessa chiamata a clippy deve saper dire di no.
    copia = cartella_prove / f"rust_sonda_v{v}"
    shutil.copytree(progetto, copia)
    sorgente = copia / "src" / "main.rs"
    sorgente.write_text(
        sorgente.read_text(encoding="utf-8") + "\n#[allow(dead_code)]\nfn sonda() -> i32 {\n    return 1;\n}\n",
        encoding="utf-8",
    )
    sonda = cargo(["clippy", "--all-targets", "--", "-D", "warnings"], copia, cartella_prove / f"rust_sonda_c{v}", ambiente)
    if sonda.returncode != 0 and "needless_return" in sonda.stderr.decode("utf-8", "replace"):
        print(f"  Rust v{v} controllo positivo di clippy: la sonda e' stata vista")
    else:
        print(f"  ROTTO Rust v{v}: clippy non vede la sonda (uscita {sonda.returncode})")
        problemi += 1
    return problemi


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    comandi, risposte = leggi_specifica()
    versioni = versioni_di_prova()
    if not versioni:
        sys.exit("ROTTO: nessuna cartella di prova")

    print("A. Specifica contro prove")
    problemi = controlla_specifica(comandi, risposte, versioni)

    clang = trova_clang()
    ambiente = dict(os.environ)
    ambiente["PATH"] = str(clang.parent) + os.pathsep + ambiente.get("PATH", "")

    con_codice = [v for v in versioni if (RADICE / "c" / f"v{v}" / "archivio.c").exists()]
    print(f"B-C. Codice C: versioni con sorgente {con_codice}; compilatore {clang}")
    with tempfile.TemporaryDirectory() as cartella:
        for v in con_codice:
            problemi += prova_versione(v, clang, ambiente, Path(cartella))

        con_rust = [v for v in versioni if (RADICE / "rust" / f"v{v}" / "Cargo.toml").exists()]
        print(f"E. Rust: versioni con progetto {con_rust}")
        for v in con_rust:
            problemi += prova_rust(v, ambiente, Path(cartella))

    print(f"totale: {len(con_codice)} versioni in C e {len(con_rust)} in Rust provate, {problemi} problemi")
    print("VERDE" if problemi == 0 else "ROTTO")
    sys.exit(0 if problemi == 0 else 1)


if __name__ == "__main__":
    main()

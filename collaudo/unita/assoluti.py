"""Cerca in tutta l'unita' i percorsi assoluti rimasti dopo l'uso.

    python -X utf8 -B assoluti.py <radice> [--usata] [--altro <percorso>]...

Legge i byte di ogni file, per blocchi, senza distinguere maiuscole. Cerca:
- la radice dell'unita', dal componente con gli spazi doppi in poi: vale anche su un'altra lettera;
- ogni percorso --altro e il profilo dell'utente, interi.
Ogni forma e' cercata con le barre delle due specie, raddoppiate e codificate per URL; in UTF-16 tutte tranne quelle
codificate per URL (un indirizzo codificato e' testo in UTF-8).

Un file con un colpo deve stare in una specie di SPECIE, col suo motivo; uno senza specie e' un rosso.
Una specie di NOMINATE vale per un solo file e per una sola occorrenza scritta per intero: il file vi sta solo se,
tolta quell'occorrenza, non resta nessun colpo; lo stesso testo in un altro file, o un altro colpo nello stesso file,
e' un rosso.
Con --usata l'editor deve essere stato aperto: i file di VERI devono avere il colpo, o il rilevatore non ha visto nulla.
Le sonde sono file veri, scritti nell'unita' e tolti alla fine.

Che cosa NON guarda: i file compressi; i percorsi ricostruiti a run-time; i percorsi assoluti di
altre cartelle, che non sono fra quelli dati; se una specie dichiarata regga a uno spostamento: lo dice la corsa da un'altra radice.

Uscite: 0 verde, 1 rosso, 2 fermo (non si e' potuto misurare).
"""
import argparse
import os
import pathlib
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
BLOCCO = 16 * 1024 * 1024

# Le specie attese: l'editor le riscrive, e spostando l'unita' non le legge piu' o le rifa'. Relative alla radice.
ED = r"vscodium/data/"
SPECIE = [
    ("extensions.json, location", ED + r"extensions/extensions\.json$", "vale relativeLocation"),
    ("stato dell'editor", ED + r"user-data/User/globalStorage/(storage\.json|state\.vscdb(\.backup)?)$", "ultime cartelle aperte"),
    ("stato per cartella", ED + r"user-data/User/workspaceStorage/[^/]+/(workspace\.json|state\.vscdb(\.backup)?)$", "una cartella per percorso aperto"),
    ("stato condiviso", ED + r"shared-data/sharedStorage/state\.vscdb(\.backup)?$", "riscritto all'apertura"),
    ("cronologia dei file", ED + r"user-data/User/History/", "cronologia locale dei file modificati"),
    ("registro di Chromium", ED + r"user-data/(Session Storage|Local Storage/leveldb|WebStorage/[^/]+/[^/]+|shared_proto_db|Network)/", "contenitori e registri di Chromium"),
    ("cache di Chromium", ED + r"user-data/(CachedProfilesData|CachedData|Code Cache|GPUCache|Cache|DawnGraphiteCache|DawnWebGPUCache|Crashpad)/", "rigenerata"),
    ("log dell'editor", ED + r"user-data/logs/", "testo dei log"),
    # Misurati su una copia spostata: l'editor riscrive il primo dopo un'apertura in inglese, la seconda mai; li
    # prepara vscodium/lingua.py, dal costruttore e dai lanciatori, per la radice in cui l'unita' si trova.
    ("pacchetti di lingua", ED + r"user-data/languagepacks\.json$", "riscritto per la radice corrente prima di ogni avvio dal lanciatore"),
    ("cache delle traduzioni", ED + r"user-data/clp/", "tolta prima dell'avvio dal lanciatore se nomina un'altra radice, e rifatta"),
    ("configurazione del server", r"nginx/conf/nginx\.conf$", "nginxstart la rigenera a ogni avvio"),
    ("byte-code di Python", r"(.*/)?__pycache__/[^/]+\.pyc$", "il percorso serve solo ai messaggi d'errore"),
    ("cache di compilazione dell'editor", r"vscodium/resources/app/node-compile-cache/", "chiave col percorso: da un'altra radice non si usa"),
    ("compilazione di cargo", r"progetti/(.+/)?target/", "cargo la rifa' se il percorso cambia"),
    # Lo stato degli strumenti del terminale, che ora resta nell'unita': ricorda dove si e' lavorato, non serve a partire.
    # Su Windows Neovim aggiunge -data al nome: home/.local/state/nvim-data/shada/main.shada (misurato dal gate).
    ("stato di Neovim", r"home/\.local/state/nvim(-data)?/", "file aperti di recente e registro: un percorso vecchio si ignora"),
    ("interpreti di virtualenv", r"home/\.cache/virtualenv/py_info/", "virtualenv rivalida il percorso dell'interprete e la rifa'"),
    # Misurato su una copia spostata e su due copie aperte alternate: la ricerca impostata resta, i registri si riscrivono.
    ("profilo di Chromium", r"home/chromium/", "registri di LevelDB e preferenze col percorso del profilo: Chromium li riscrive dove gira"),
]
# Occorrenze vere che con --usata devono esserci: la sonda non si inventa. Solo quelle che l'editor scrive alla radice
# in cui gira: extensions.json porta la cartella in cui le estensioni sono state installate, e su una copia e' quella
# della costruzione, che questo rilevatore non cerca. languagepacks.json lo riscrive il lanciatore per la radice in cui parte.
VERI = [ED + "user-data/User/globalStorage/storage.json", ED + "user-data/languagepacks.json"]

# Le specie di un solo file e di una sola occorrenza, scritta per intero e in minuscolo come la legge esamina.
# Non sono file che l'unita' riscrive: sono dati copiati con un percorso assoluto dentro, ammessi finche' la fonte non
# si corregge. Relative alla radice.
# Per ciascuna anche la radice che l'occorrenza porta: le sonde la aggiungono alle forme, e si accendono anche quando
# la corsa non la passa con --altro.
NOMINATE = [
    ("misura registrata del corso", "progetti/puntatori/esempi/lez00/misure.mydev.txt",
     b"linker_clang c:/mydev-estesa/llvm/bin/ld.lld", "C:\\MyDev-estesa",
     "misura registrata del corso, porta la radice di costruzione dell'autore: si corregge nel repository del corso"),
]


def forme_di(testo, intero):
    """Le forme di un percorso. intero=False: dal componente con gli spazi doppi in poi."""
    parti = [p for p in testo.replace("/", "\\").split("\\") if p]
    if intero:
        posix = "/" + parti[0][0] + "/" + "/".join(parti[1:])
    else:
        i = next((n for n, p in enumerate(parti) if "  " in p), None)
        if i is None:
            print("FERMO: nessun componente con gli spazi doppi: " + testo + "\nESITO: FERMO")
            raise SystemExit(2)
        parti = parti[i:]
        posix = None
    fuori = {}
    for sep in ("\\", "\\\\", "/", "%5c", "%2f"):
        base = sep.join(parti)
        for spazio in (" ", "%20"):
            t = base.replace(" ", spazio).lower()
            if intero and sep in ("%5c", "%2f"):
                t = t.replace(":", "%3a")
            fuori[t] = 1
    if posix:
        fuori[posix.lower()] = 1
        fuori[posix.lower().replace(" ", "%20")] = 1
    uscita = []
    for t in fuori:
        uscita.append(t.encode("utf-8"))
        if "%" not in t:
            uscita.append(t.encode("utf-16-le"))
    return uscita


def esamina(percorso, forme, togli=None):
    """Quali gruppi di forme compaiono nel file. Le letture lunghe si sovrappongono di quanto basta.
    togli: un'occorrenza che non conta (le specie di NOMINATE), tolta dai byte prima di cercare; il file si legge
    allora in una volta, perche' l'occorrenza non resti a meta' fra due letture."""
    massimo = max(len(p) for _, pp in forme for p in pp)
    trovati = set()
    coda = b""
    with open(percorso, "rb") as h:
        while True:
            blocco = h.read(-1 if togli else BLOCCO)
            if not blocco:
                break
            dati = (coda + blocco).lower()
            if togli:
                dati = dati.replace(togli, b"")
            for nome, pp in forme:
                if nome not in trovati and any(p in dati for p in pp):
                    trovati.add(nome)
            coda = blocco[-massimo:]
    return trovati


def specie_di(rel, resto=None):
    """La specie di un file con un colpo. resto: per un file di NOMINATE, i gruppi che restano tolta la sua occorrenza."""
    for nome, schema, _ in SPECIE:
        if re.match(schema, rel):
            return nome
    for nome, percorso, _, _, _ in NOMINATE:
        if rel == percorso and resto is not None and not resto:
            return nome
    return None


def giudica(colpi, resti=None):
    """Il verdetto, uguale per il dato vero e per le sonde: i file con un colpo e senza specie.
    resti: {file di NOMINATE: gruppi che restano tolta la sua occorrenza}."""
    resti = resti or {}
    return sorted(rel for rel in colpi if specie_di(rel, resti.get(rel)) is None)


def occorrenza_di(rel):
    """L'occorrenza dichiarata per questo file in NOMINATE, o None."""
    return next((occ for _, percorso, occ, _, _ in NOMINATE if percorso == rel), None)


def scandisci(radice, forme):
    colpi, resti, illeggibili = {}, {}, []
    file_visti, byte_visti, salti = 0, 0, 0
    for cartella, _, nomi in os.walk(radice):
        for n in nomi:
            f = os.path.join(cartella, n)
            if os.path.islink(f):
                salti += 1
                continue
            rel = os.path.relpath(f, radice).replace("\\", "/")
            occ = occorrenza_di(rel)
            try:
                trovati = esamina(f, forme)
                if trovati and occ:
                    resti[rel] = esamina(f, forme, togli=occ)
                byte_visti += os.path.getsize(f)
            except OSError as e:
                illeggibili.append(f"{rel}: {e.__class__.__name__}")
                continue
            file_visti += 1
            if trovati:
                colpi[rel] = sorted(trovati)
    return colpi, resti, illeggibili, file_visti, byte_visti, salti


def sonde(radice, forme):
    """Un file vero per ogni forma, fuori dalle specie, e uno dentro una specie: la prima specie deve dare rosso, la seconda no.
    Per ogni specie di NOMINATE quattro file veri: l'occorrenza ammessa nel suo file, rossa in un altro, rossa con un
    altro colpo accanto (della stessa radice o della radice dell'unita')."""
    cartella = pathlib.Path(radice) / "progetti" / "sonda-u12"
    cartella.mkdir(parents=True, exist_ok=False)
    dentro = pathlib.Path(radice) / "vscodium" / "data" / "user-data" / "logs" / "sonda-u12.log"
    dentro.parent.mkdir(parents=True, exist_ok=True)
    tot, accese = 0, 0
    try:
        for nome, pp in forme:
            for i, p in enumerate(pp):
                f = cartella / f"f{tot}.bin"
                f.write_bytes(b"prima " + p + b" dopo")
                rel = f"progetti/sonda-u12/{f.name}"
                t = esamina(f, forme)
                tot += 1
                if nome in t and giudica({rel: sorted(t)}) == [rel]:
                    accese += 1
                else:
                    print(f"  SONDA SPENTA: gruppo {nome}, forma {i}")
        dentro.write_bytes(forme[0][1][0])
        rel = "vscodium/data/user-data/logs/sonda-u12.log"
        ammessa = giudica({rel: sorted(esamina(dentro, forme))}) == [] and bool(esamina(dentro, forme))
        # Le specie di NOMINATE: l'occorrenza in un file di prova, giudicata col percorso dichiarato e con un altro.
        for nome, percorso, occ, portata, _ in NOMINATE:
            fs = forme + [("portata", forme_di(portata, True))]
            altro_rel = "progetti/sonda-u12/" + percorso.rsplit("/", 1)[-1]
            prove = [
                ("ammessa nel suo file", b"prima\n" + occ + b"\ndopo", percorso, []),
                ("rossa in un altro file", b"prima\n" + occ + b"\ndopo", altro_rel, [altro_rel]),
                ("rossa con un'altra occorrenza della stessa radice", occ + b"\n" + fs[-1][1][0], percorso, [percorso]),
                ("rossa con la radice dell'unita' accanto", occ + b"\n" + forme[0][1][0], percorso, [percorso]),
            ]
            for titolo, dati, r, atteso in prove:
                f = cartella / f"f{tot}.bin"
                f.write_bytes(dati)
                t = esamina(f, fs)
                tot += 1
                if t and giudica({r: sorted(t)}, {r: esamina(f, fs, togli=occ)}) == atteso:
                    accese += 1
                else:
                    print(f"  SONDA SPENTA: specie {nome}, {titolo}")
    finally:
        for f in cartella.glob("*"):
            f.unlink()
        cartella.rmdir()
        dentro.unlink(missing_ok=True)
    return tot, accese, ammessa


def principale():
    a = argparse.ArgumentParser()
    a.add_argument("radice")
    a.add_argument("--usata", action="store_true")
    a.add_argument("--altro", action="append", default=[])
    o = a.parse_args()
    radice = str(pathlib.Path(o.radice).resolve())
    if not os.path.isdir(radice):
        print(f"FERMO: manca {radice}\nESITO: FERMO")
        return 2
    forme = [("radice", forme_di(radice, False))]
    profilo = os.environ.get("USERPROFILE", "")
    for nome, testo in [("profilo", profilo)] + [(f"altro{i}", t) for i, t in enumerate(o.altro)]:
        if testo:
            forme.append((nome, forme_di(testo, True)))
    print(f"gruppi di forme: {len(forme)}, forme: {sum(len(pp) for _, pp in forme)}")
    print(f"specie attese: {len(SPECIE)}")
    colpi, resti, illeggibili, file_visti, byte_visti, salti = scandisci(radice, forme)
    print(f"file letti: {file_visti}, byte: {byte_visti}, collegamenti saltati: {salti}, illeggibili: {len(illeggibili)}")
    for r in illeggibili[:20]:
        print("  ILLEGGIBILE", r)
    per_specie = {}
    for rel in colpi:
        per_specie.setdefault(specie_di(rel, resti.get(rel)) or "SENZA SPECIE", []).append(rel)
    for nome, _, motivo in SPECIE:
        print(f"  specie {nome}: {len(per_specie.get(nome, []))} file ({motivo})")
    print(f"specie di un solo file: {len(NOMINATE)}")
    for nome, percorso, _, _, motivo in NOMINATE:
        print(f"  specie {nome}: {len(per_specie.get(nome, []))} file, {percorso} ({motivo})")
    fuori = giudica(colpi, resti)
    print(f"file con un colpo: {len(colpi)}, senza specie: {len(fuori)}")
    for rel in fuori:
        print(f"  SENZA SPECIE {rel} [{','.join(colpi[rel])}]")
    mancati = [v for v in VERI if v not in colpi] if o.usata else []
    if o.usata:
        print(f"occorrenze vere attese: {len(VERI)}, mancate: {len(mancati)}")
        for v in mancati:
            print("  MANCATA", v)
    tot, accese, ammessa = sonde(radice, forme)
    print(f"sonde: {accese} accese su {tot}; sonda dentro una specie ammessa: {ammessa}")
    if file_visti == 0 or illeggibili or tot == 0 or accese != tot or not ammessa or mancati:
        print("ESITO: FERMO")
        return 2
    if fuori:
        print("ESITO: ROSSO")
        return 1
    print("ESITO: VERDE")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(principale())
    except SystemExit:
        raise
    except BaseException as e:  # 2 anche sull'eccezione: un 1 si leggerebbe come un rosso
        print(f"FERMO: eccezione {e.__class__.__name__}: {e}\nESITO: FERMO")
        sys.exit(2)

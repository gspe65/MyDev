"""Cerca in tutta l'unita' i percorsi assoluti rimasti dopo l'uso.

    python -X utf8 -B assoluti.py <radice> [--usata] [--altro <percorso>]...

Legge i byte di ogni file, per blocchi, senza distinguere maiuscole. Cerca:
- la radice dell'unita', dal componente con gli spazi doppi in poi: vale anche su un'altra lettera;
- ogni percorso --altro e il profilo dell'utente, interi.
Ogni forma e' cercata con le barre delle due specie, raddoppiate, codificate per URL, e in UTF-16.

Un file con un colpo deve stare in una specie di SPECIE, col suo motivo; uno senza specie e' un rosso.
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
    ("configurazione del server", r"nginx/conf/nginx\.conf$", "nginxstart la rigenera a ogni avvio"),
    ("byte-code di Python", r"(.*/)?__pycache__/[^/]+\.pyc$", "il percorso serve solo ai messaggi d'errore"),
    ("cache di compilazione dell'editor", r"vscodium/resources/app/node-compile-cache/", "chiave col percorso: da un'altra radice non si usa"),
    ("compilazione di cargo", r"progetti/(.+/)?target/", "cargo la rifa' se il percorso cambia"),
    # Lo stato degli strumenti del terminale, che ora resta nell'unita': ricorda dove si e' lavorato, non serve a partire.
    # Su Windows Neovim aggiunge -data al nome: home/.local/state/nvim-data/shada/main.shada (misurato dal gate).
    ("stato di Neovim", r"home/\.local/state/nvim(-data)?/", "file aperti di recente e registro: un percorso vecchio si ignora"),
    ("interpreti di virtualenv", r"home/\.cache/virtualenv/py_info/", "virtualenv rivalida il percorso dell'interprete e la rifa'"),
]
# Occorrenze vere che con --usata devono esserci: la sonda non si inventa. Solo quelle che l'editor scrive alla radice
# in cui gira: extensions.json porta la cartella in cui le estensioni sono state installate, e su una copia e' quella
# della costruzione, che questo rilevatore non cerca.
VERI = [ED + "user-data/User/globalStorage/storage.json"]


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


def esamina(percorso, forme):
    """Quali gruppi di forme compaiono nel file. Le letture lunghe si sovrappongono di quanto basta."""
    massimo = max(len(p) for _, pp in forme for p in pp)
    trovati = set()
    coda = b""
    with open(percorso, "rb") as h:
        while True:
            blocco = h.read(BLOCCO)
            if not blocco:
                break
            dati = (coda + blocco).lower()
            for nome, pp in forme:
                if nome not in trovati and any(p in dati for p in pp):
                    trovati.add(nome)
            coda = blocco[-massimo:]
    return trovati


def specie_di(rel):
    for nome, schema, _ in SPECIE:
        if re.match(schema, rel):
            return nome
    return None


def giudica(colpi):
    """Il verdetto, uguale per il dato vero e per le sonde: i file con un colpo e senza specie."""
    return sorted(rel for rel in colpi if specie_di(rel) is None)


def scandisci(radice, forme):
    colpi, illeggibili = {}, []
    file_visti, byte_visti, salti = 0, 0, 0
    for cartella, _, nomi in os.walk(radice):
        for n in nomi:
            f = os.path.join(cartella, n)
            if os.path.islink(f):
                salti += 1
                continue
            rel = os.path.relpath(f, radice).replace("\\", "/")
            try:
                trovati = esamina(f, forme)
                byte_visti += os.path.getsize(f)
            except OSError as e:
                illeggibili.append(f"{rel}: {e.__class__.__name__}")
                continue
            file_visti += 1
            if trovati:
                colpi[rel] = sorted(trovati)
    return colpi, illeggibili, file_visti, byte_visti, salti


def sonde(radice, forme):
    """Un file vero per ogni forma, fuori dalle specie, e uno dentro una specie: la prima specie deve dare rosso, la seconda no."""
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
    colpi, illeggibili, file_visti, byte_visti, salti = scandisci(radice, forme)
    print(f"file letti: {file_visti}, byte: {byte_visti}, collegamenti saltati: {salti}, illeggibili: {len(illeggibili)}")
    for r in illeggibili[:20]:
        print("  ILLEGGIBILE", r)
    per_specie = {}
    for rel in colpi:
        per_specie.setdefault(specie_di(rel) or "SENZA SPECIE", []).append(rel)
    for nome, _, motivo in SPECIE:
        print(f"  specie {nome}: {len(per_specie.get(nome, []))} file ({motivo})")
    fuori = giudica(colpi)
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

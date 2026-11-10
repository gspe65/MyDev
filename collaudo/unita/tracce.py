"""Le tracce fuori dall'unita': due fotografie, cartelle e registro, e il confronto.

    python -X utf8 -B tracce.py foto <cartella di lavoro> <nome>
    python -X utf8 -B tracce.py confronta <cartella di lavoro> <prima> <dopo> [--sonde] [--radice <radice dell'unita'>]
    python -X utf8 -B tracce.py pulisci <cartella di lavoro>

Tre rilevatori:
- R1, per nome: una voce al primo livello delle quattro radici, nuova o cambiata, che porta un nome degli strumenti;
- R2, voci nuove al primo livello delle quattro radici, ammesse solo per nome (AMMESSE);
- R3, registro dell'utente: una chiave o un valore nuovi o cambiati che portano un nome degli strumenti o la radice dell'unita'.
  Le chiavi di RUMORE sono di Explorer e portano il nome di ogni finestra: lì il nome e' ammesso.
  Le altre chiavi cambiate si stampano, non decidono: sul PC in uso cambiano per conto di altri programmi.

Che cosa NON guarda: le scritture dentro cartelle condivise gia' esistenti (un file riscritto sul posto, senza figli
nuovi, non cambia la data della cartella al primo livello: su un PC dove nvim-data o .cargo ci sono gia', lo zero non
dice nulla; Neovim, virtualenv, pip e Python li misura il profilo finto del gate, gh le sentinelle dell'estesa), HKLM, i file fuori dalle quattro radici,
la rete, gli oggetti COM, i servizi, una chiave del registro che non nomini ne' uno strumento ne' la radice.
I valori del registro non si stampano: solo chiave e nome. Le esportazioni si cancellano con pulisci.
Le sonde, con --sonde (che vuole --radice), passano dal verdetto e anche da differenze e leggi_reg, su fotografie finte.

Uscite: 0 verde, 1 rosso, 2 fermo.
"""
import codecs
import json
import os
import pathlib
import re
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")
RADICI = {k: os.environ.get(k, "") for k in ("APPDATA", "LOCALAPPDATA", "TEMP", "USERPROFILE")}
NOMI = ["vscodium", "codium", "vscode-oss", "nvim", "nginx", "clangd", "mkcert", "algodesign", "msys", "mingw", "pyright",
        "cargo", "rustc", "rust-analyzer", "github cli", "virtualenv", "python_history"]
# Nomi corti che stanno dentro parole comuni («pip» in «pipe»): valgono solo come nome intero di una voce del profilo.
NOMI_ESATTI = ["pip", "pypa"]
ROT13 = [codecs.encode(n, "rot13") for n in NOMI]
RADICE = []
SPECIALI = [".vscode", ".vscode-oss"]

# Voci nuove ammesse, per nome. Ogni riga e' rumore misurato con due intervalli a vuoto.
AMMESSE = [
    r"TEMP\\[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.tmp$",
    r"TEMP\\__PSScriptPolicyTest_.*$",
]
# Chiavi del registro che cambiano a ogni uso del PC, per nome.
RUMORE = [
    r"\\Explorer\\UserAssist\\",
    r"\\Explorer\\FeatureUsage\\(AppSwitched|ShowJumpView|AppBadgeUpdated)$",
    r"\\Shell\\MuiCache$",
    r"\\HAM\\AUI\\[^\\]+\\V1\\LU$",
]


def foto(lavoro, nome):
    lavoro.mkdir(parents=True, exist_ok=True)
    dati = {}
    for chiave, radice in RADICI.items():
        voci = {}
        with os.scandir(radice) as it:
            for v in it:
                try:
                    voci[v.name] = v.stat(follow_symlinks=False).st_mtime
                except OSError:
                    voci[v.name] = None
        dati[chiave] = voci
    for s in SPECIALI:
        p = pathlib.Path(RADICI["USERPROFILE"]) / s
        dati[f"esiste:{s}"] = p.exists()
    (lavoro / f"{nome}.json").write_text(json.dumps(dati), encoding="utf-8")
    reg = lavoro / f"{nome}.reg"
    r = subprocess.run(["reg", "export", "HKCU", str(reg), "/y"], capture_output=True)
    print(f"foto {nome}: reg export uscita {r.returncode}, {reg.stat().st_size if reg.exists() else 0} byte; " + ", ".join(f"{k}={len(dati[k])}" for k in RADICI))
    return 0 if r.returncode == 0 and reg.exists() else 2


def leggi_reg(percorso):
    testo = percorso.read_text(encoding="utf-16").replace("\\\r\n  ", "").replace("\\\n  ", "")
    chiavi = {}
    corrente = None
    for riga in testo.splitlines():
        if riga.startswith("[") and riga.endswith("]"):
            corrente = riga[1:-1]
            chiavi[corrente] = {}
        elif corrente is not None and "=" in riga:
            m = re.match(r'^("(?:[^"\\]|\\.)*"|@)=(.*)$', riga)
            if m:
                chiavi[corrente][m.group(1)] = m.group(2)
    return chiavi


def porta_nome(testo):
    """Solo per il registro: la radice dell'unita' non vale per R1, che vedrebbe la cartella della prova stessa."""
    basso = testo.lower()
    if any(n in basso for n in NOMI + RADICE) or any(n in basso for n in ROT13):
        return True
    if "hex" in basso:
        cifre = re.sub(r"[^0-9a-f]", "", re.sub(r"hex(\([0-9a-f]+\))?:", "", basso))
        try:
            b = bytes.fromhex(cifre if len(cifre) % 2 == 0 else cifre[:-1])
        except ValueError:
            return False
        for cod in ("utf-16-le", "latin-1"):
            d = b.decode(cod, "ignore").lower()
            if any(n in d for n in NOMI + RADICE):
                return True
    return False


def differenze(A, B, ra, rb):
    """I fatti grezzi delle due fotografie."""
    r1, r2 = [], []
    for k in RADICI:
        for nome in sorted(set(B[k]) - set(A[k])):
            r2.append(f"{k}\\{nome}")
        for nome in B[k]:
            if (any(n in nome.lower() for n in NOMI) or nome.lower() in NOMI_ESATTI) and (nome not in A[k] or A[k][nome] != B[k][nome]):
                r1.append(f"{k}\\{nome}")
    nuove = sorted(set(rb) - set(ra))
    cambiate = []
    for k in set(ra) & set(rb):
        for v in set(ra[k]) | set(rb[k]):
            if ra[k].get(v) != rb[k].get(v):
                cambiate.append((k, v, rb[k].get(v, "")))
    return r1, r2, nuove, sorted(cambiate)


def giudica(r1, r2, nuove, cambiate, valori_nuove):
    """Il verdetto, uguale per il dato vero e per le sonde."""
    r2_fuori = [x for x in r2 if not any(re.match(a, x) for a in AMMESSE)]
    r3_colpi, r3_altre = [], []
    for k in nuove:
        rumore = any(re.search(p, k) for p in RUMORE)
        if not rumore and (porta_nome(k) or any(porta_nome(n + "=" + w) for n, w in valori_nuove.get(k, {}).items())):
            r3_colpi.append(k)
        elif not rumore:
            r3_altre.append(k)
    for k, v, w in cambiate:
        rumore = any(re.search(p, k) for p in RUMORE)
        if not rumore and (porta_nome(k) or porta_nome(v) or porta_nome(w)):
            r3_colpi.append(f"{k} :: {v}")
        elif not rumore:
            r3_altre.append(f"{k} :: {v}")
    return r1, r2_fuori, r3_colpi, r3_altre


def stampa(verdetto):
    r1, r2_fuori, r3_colpi, r3_altre = verdetto
    for titolo, xs in (("R1 col nome di uno strumento", r1), ("R2 nuova, non ammessa", r2_fuori), ("R3 col nome di uno strumento o la radice", r3_colpi), ("registro, altre chiavi cambiate (non decidono)", r3_altre)):
        print(f"{titolo}: {len(xs)}")
        for x in xs:
            print("   ", x)


def rosso(verdetto):
    r1, r2_fuori, r3_colpi, _ = verdetto
    return bool(r1 or r2_fuori or r3_colpi)


def speciali_nate(A, B):
    return ["cartella speciale nata nel profilo: " + s for s in SPECIALI if not A[f"esiste:{s}"] and B[f"esiste:{s}"]]


def sonde_della_catena(lavoro):
    """Le sonde che passano dalle fotografie: differenze, leggi_reg e le cartelle speciali, su dati finti."""
    A = {k: {"gia-qui": 1.0, "nvim-data": 1.0} for k in RADICI}
    B = {k: dict(v) for k, v in A.items()}
    B["APPDATA"]["VSCodium"] = 2.0          # nuova col nome: R1 e R2
    B["LOCALAPPDATA"]["nvim-data"] = 2.0     # cambiata col nome: R1
    B["TEMP"]["sconosciuta"] = 2.0           # nuova senza nome: R2
    for s in SPECIALI:
        A[f"esiste:{s}"] = False
        B[f"esiste:{s}"] = s == ".vscode"
    reg = lavoro / "sonda-catena.reg"
    reg.write_text('Windows Registry Editor Version 5.00\r\n\r\n[HKEY_CURRENT_USER\\Software\\SondaCatena]\r\n'
                   '"x"="C:\\\\VSCodium.exe"\r\n', encoding="utf-16")
    try:
        rb = leggi_reg(reg)
    finally:
        reg.unlink()
    r1, r2_fuori, r3, _ = giudica(*differenze(A, B, {}, rb), rb)
    r1 = r1 + speciali_nate(A, B)
    casi = {
        "differenze R1 nuova": "APPDATA\\VSCodium" in r1,
        "differenze R1 cambiata": "LOCALAPPDATA\\nvim-data" in r1,
        "differenze R2": "TEMP\\sconosciuta" in r2_fuori,
        "leggi_reg e R3": "HKEY_CURRENT_USER\\Software\\SondaCatena" in r3,
        "cartella speciale": any(x.endswith(".vscode") for x in r1),
    }
    for nome, acceso in casi.items():
        if not acceso:
            print("  SONDA SPENTA:", nome)
    return sum(casi.values()), len(casi)


def confronta(lavoro, a, b, con_sonde):
    A = json.loads((lavoro / f"{a}.json").read_text(encoding="utf-8"))
    B = json.loads((lavoro / f"{b}.json").read_text(encoding="utf-8"))
    ra = leggi_reg(lavoro / f"{a}.reg")
    rb = leggi_reg(lavoro / f"{b}.reg")
    print(f"denominatore: voci prima {sum(len(A[k]) for k in RADICI)}, dopo {sum(len(B[k]) for k in RADICI)}; chiavi del registro prima {len(ra)}, dopo {len(rb)}")
    if not ra or not rb or not any(A[k] for k in RADICI):
        print("FERMO: fotografia vuota\nESITO: FERMO")
        return 2
    for s in SPECIALI:
        print(f"{s}: esiste {A[f'esiste:{s}']} -> {B[f'esiste:{s}']}")
    r1, r2, nuove, cambiate = differenze(A, B, ra, rb)
    print(f"grezzi: R1 {len(r1)}, R2 {len(r2)}, registro nuove {len(nuove)}, cambiate {len(cambiate)}")
    v = giudica(r1, r2, nuove, cambiate, rb)
    v[0].extend(speciali_nate(A, B))
    stampa(v)
    if con_sonde:
        accese = 0
        casi = [
            ("R1", (["APPDATA\\VSCodium"], [], [], []), {}),
            ("R2", ([], ["LOCALAPPDATA\\sconosciuta"], [], []), {}),
            ("R3 nome", ([], [], ["HKEY_CURRENT_USER\\Software\\SondaFalsa\\VSCodium"], []), {}),
            ("R3 ROT13", ([], [], ["HKEY_CURRENT_USER\\Software\\Sonda"], []), {"HKEY_CURRENT_USER\\Software\\Sonda": {'"HRZR_RKRPHGR:P:\\ivfpbqvhz.rkr"': "hex:01"}}),
            ("R3 hex", ([], [], ["HKEY_CURRENT_USER\\Software\\Sonda2"], []), {"HKEY_CURRENT_USER\\Software\\Sonda2": {'"y"': "hex:" + ",".join(f"{c:02x}" for c in "VSCodium.exe".encode("utf-16-le"))}}),
            ("R3 valore cambiato col nome", ([], [], [], [("HKEY_CURRENT_USER\\Software\\Sonda3", "x", "VSCodium.exe")]), {}),
        ]
        if RADICE:
            casi.append(("R3 valore con la radice", ([], [], [], [("HKEY_CURRENT_USER\\Software\\Sonda4", "x", "C:\\" + RADICE[0] + "\\x")]), {}))
        for nome, (a1, a2, a3, a4), val in casi:
            if rosso(giudica(a1, a2, a3, a4, val)):
                accese += 1
            else:
                print("  SONDA SPENTA:", nome)
        ammessa = not rosso(giudica([], ["TEMP\\01234567-89ab-cdef-0123-456789abcdef.tmp"], [], [("HKEY_CURRENT_USER\\X\\Explorer\\UserAssist\\Y", '"IFPbqvhz.rkr"', "1"), ("HKEY_CURRENT_USER\\Software\\Sconosciuta", "z", "1")], {}))
        catena, di = sonde_della_catena(lavoro)
        print(f"sonde: {accese} accese su {len(casi)}, attese 7; della catena {catena} su {di}; sonda ammessa per nome: {ammessa}")
        if accese != len(casi) or len(casi) != 7 or catena != di or not ammessa:
            print("ESITO: FERMO")
            return 2
    if rosso(v):
        print("ESITO: ROSSO")
        return 1
    print("ESITO: VERDE")
    return 0


def pulisci(lavoro):
    n = 0
    for f in lavoro.glob("*.reg"):
        f.unlink()
        n += 1
    print("esportazioni del registro cancellate:", n)
    return 0


if __name__ == "__main__":
    try:
        az = sys.argv[1]
        lav = pathlib.Path(sys.argv[2])
        mancano = [k for k, v in RADICI.items() if not v]
        if mancano:
            print(f"FERMO: variabili d'ambiente mancanti: {' '.join(mancano)}\nESITO: FERMO")
            sys.exit(2)
        if "--sonde" in sys.argv and "--radice" not in sys.argv:
            print("FERMO: --sonde vuole --radice: senza, la sonda del valore con la radice non c'e'\nESITO: FERMO")
            sys.exit(2)
        if "--radice" in sys.argv:
            componenti = [p for p in re.split(r"[\\/]", sys.argv[sys.argv.index("--radice") + 1]) if "  " in p]
            RADICE.extend(c.lower() for c in componenti)
        if az == "foto":
            esito = foto(lav, sys.argv[3])
        elif az == "confronta":
            esito = confronta(lav, sys.argv[3], sys.argv[4], "--sonde" in sys.argv)
        elif az == "pulisci":
            esito = pulisci(lav)
        else:
            print(f"FERMO: azione {az}\nESITO: FERMO")
            esito = 2
        sys.exit(esito)
    except SystemExit:
        raise
    except BaseException as e:
        print(f"FERMO: eccezione {e.__class__.__name__}: {e}\nESITO: FERMO")
        sys.exit(2)

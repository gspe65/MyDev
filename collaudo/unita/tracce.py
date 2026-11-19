"""Le tracce fuori dall'unita': due fotografie, cartelle e registro, e il confronto.

    python -X utf8 -B tracce.py foto <cartella di lavoro> <nome>
    python -X utf8 -B tracce.py confronta <cartella di lavoro> <prima> <dopo> [--sonde] [--radice <radice dell'unita'>]
    python -X utf8 -B tracce.py pulisci <cartella di lavoro>

Tre rilevatori:
- R1, per nome: una voce al primo livello delle quattro radici, nuova o cambiata, che porta un nome degli strumenti;
- R2, voci nuove al primo livello delle quattro radici, ammesse solo per nome (AMMESSE);
- R3, registro dell'utente: una chiave o un valore nuovi o cambiati che portano un nome degli strumenti o la radice dell'unita'.
  Le chiavi di RUMORE sono di Explorer e portano il nome di ogni finestra: lì il nome e' ammesso; fra queste, quella in cui
  la finestra «Salva con nome» di Windows ricorda la cartella mostrata (Shell\\BagMRU, la sola misurata con la radice),
  anche con la radice. Bags e ComDlg32 non sono ammesse: con un nome o la radice sono un colpo, da leggere e, se rumore,
  da ammettere con la sua misura.
  Le scritture di Chromium in Software\\Chromium sono dichiarate (CHROMIUM_CHIAVI, CHROMIUM_VALORI): si stampano e non
  decidono, salvo un valore che nomini la radice (cercata con lo stesso riconoscitore dei colpi: in chiaro, ROT13, hex:);
  ogni altra chiave o valore sotto Software\\Chromium e' un colpo.
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
        "cargo", "rustc", "rust-analyzer", "github cli", "virtualenv", "python_history", "chromium"]
# Nomi corti che stanno dentro parole comuni («pip» in «pipe»): valgono solo come nome intero di una voce del profilo.
NOMI_ESATTI = ["pip", "pypa"]
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
    # Windows annota ogni programma avviato col suo identificativo (Chromium: «Chromium.<impronta>.chromium.Default»).
    r"\\CurrentVersion\\Search\\JumplistData$",
    # La finestra «Salva con nome» di Windows (quella che l'estensione dei flowchart apre, nello scenario dello studente)
    # ricorda la cartella mostrata come ogni finestra di Explorer: le voci di BagMRU portano i nomi delle cartelle, quindi
    # la radice (misurato nel gate con le finestre su una base mai aperta: BagMRU\2\0\5 :: "9", R3 con la radice). Solo
    # BagMRU: Bags (la vista) e ComDlg32 (OpenSavePidlMRU, LastVisitedPidlMRU, CIDSizeMRU) cambiano nei gate (misurato fra
    # le altre chiavi, senza nomi ne' radice) ma non sono mai state misurate con un nome o la radice: ammetterle a priori
    # spegnerebbe R3 su di loro senza una misura.
    r"\\Windows\\Shell\\BagMRU(\\|$)",
]
# Le scritture di Chromium nel registro, fisse nel suo codice e senza un'opzione che le spenga: dichiarate, ammesse
# per chiave e, alla radice, per nome del valore; un valore che nomina la radice dell'unita' resta un colpo. Ogni altra
# chiave sotto Software\Chromium resta un colpo (R3, il nome «chromium»).
CHROMIUM = r"^HKEY_CURRENT_USER\\Software\\Chromium"
CHROMIUM_CHIAVI = [CHROMIUM + r"\\PreferenceMACs(\\.*)?$", CHROMIUM + r"\\BLBeacon$", CHROMIUM + r"\\StabilityMetrics$",
                   CHROMIUM + r"\\ThirdParty$"]
CHROMIUM_VALORI = {'"UsageStatsInSample"', '"usagestats"', '"metricsid"', '"metricsid_installdate"',
                   '"metricsid_enableddate"', '"FirstNotDefault"'}


def dichiarata(k, v=None, w=""):
    """Una scrittura di Chromium dichiarata: la chiave dell'elenco, o un valore dell'elenco alla radice della sua chiave.
    Un valore che porti la radice non e' dichiarato, cercata con lo stesso riconoscitore dei colpi (in chiaro, in ROT13,
    nei byte di un valore hex: in UTF-16 e latin-1): un riconoscitore piu' debole ammetterebbe cio' che R3 vede."""
    if porta(f"{v or ''}={w or ''}", RADICE):
        return False
    if any(re.match(p, k) for p in CHROMIUM_CHIAVI):
        return True
    return re.match(CHROMIUM + "$", k) is not None and v in CHROMIUM_VALORI


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


def porta(testo, nomi):
    """Il riconoscitore del registro: uno dei nomi in chiaro, in ROT13 (come li scrive Explorer) o nei byte di un valore
    hex: letti in UTF-16 e in latin-1. Lo stesso per i colpi (porta_nome) e per le scritture dichiarate (dichiarata)."""
    basso = testo.lower()
    if any(n in basso for n in nomi) or any(codecs.encode(n, "rot13") in basso for n in nomi):
        return True
    # Le cifre solo dai dati dopo «hex:» o «hex(<tipo>):»: le lettere a-f del nome del valore («homepage») sposterebbero
    # l'allineamento dei byte, e l'UTF-16 non si leggerebbe piu'.
    for m in re.finditer(r"hex(?:\([0-9a-f]+\))?:([0-9a-f,\s\\]*)", basso):
        cifre = re.sub(r"[^0-9a-f]", "", m.group(1))
        b = bytes.fromhex(cifre[:len(cifre) // 2 * 2])
        for cod in ("utf-16-le", "latin-1"):
            d = b.decode(cod, "ignore").lower()
            if any(n in d for n in nomi):
                return True
    return False


def porta_nome(testo):
    """Solo per il registro: la radice dell'unita' non vale per R1, che vedrebbe la cartella della prova stessa."""
    return porta(testo, NOMI + RADICE)


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
    r3_colpi, r3_altre, r3_dichiarate = [], [], []
    for k in nuove:
        rumore = any(re.search(p, k) for p in RUMORE)
        valori = valori_nuove.get(k, {})
        if not rumore and valori and all(dichiarata(k, n, w) for n, w in valori.items()) or not valori and (
                dichiarata(k) or re.match(CHROMIUM + "$", k)):
            r3_dichiarate.append(k)
        elif not rumore and (porta_nome(k) or any(porta_nome(n + "=" + w) for n, w in valori.items())):
            r3_colpi.append(k)
        elif not rumore:
            r3_altre.append(k)
    for k, v, w in cambiate:
        rumore = any(re.search(p, k) for p in RUMORE)
        if not rumore and dichiarata(k, v, w):
            r3_dichiarate.append(f"{k} :: {v}")
        elif not rumore and (porta_nome(k) or porta_nome(v) or porta_nome(w)):
            r3_colpi.append(f"{k} :: {v}")
        elif not rumore:
            r3_altre.append(f"{k} :: {v}")
    return r1, r2_fuori, r3_colpi, r3_altre, r3_dichiarate


def stampa(verdetto):
    r1, r2_fuori, r3_colpi, r3_altre, r3_dichiarate = verdetto
    for titolo, xs in (("R1 col nome di uno strumento", r1), ("R2 nuova, non ammessa", r2_fuori), ("R3 col nome di uno strumento o la radice", r3_colpi), ("registro, scritture dichiarate di Chromium (non decidono)", r3_dichiarate), ("registro, altre chiavi cambiate (non decidono)", r3_altre)):
        print(f"{titolo}: {len(xs)}")
        for x in xs:
            print("   ", x)


def rosso(verdetto):
    r1, r2_fuori, r3_colpi = verdetto[:3]
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
    r1, r2_fuori, r3 = giudica(*differenze(A, B, {}, rb), rb)[:3]
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
            ("R3 Chromium non dichiarata", ([], [], ["HKEY_CURRENT_USER\\Software\\Chromium\\SondaNuova"], []), {}),
        ]
        if RADICE:
            casi.append(("R3 valore con la radice", ([], [], [], [("HKEY_CURRENT_USER\\Software\\Sonda4", "x", "C:\\" + RADICE[0] + "\\x")]), {}))
            casi.append(("R3 Chromium dichiarata con la radice", ([], [], [], [("HKEY_CURRENT_USER\\Software\\Chromium\\PreferenceMACs\\Default", '"homepage"', "C:\\" + RADICE[0] + "\\x")]), {}))
            # La stessa radice nei byte di un valore hex: (UTF-16), come la scrive il registro: il riconoscitore dei colpi.
            casi.append(("R3 Chromium dichiarata con la radice in hex", ([], [], [], [("HKEY_CURRENT_USER\\Software\\Chromium\\PreferenceMACs\\Default", '"homepage"',
                         "hex(1):" + ",".join(f"{c:02x}" for c in ("C:\\" + RADICE[0] + "\\x").encode("utf-16-le")))]), {}))
            # Le chiavi della finestra di dialogo non ammesse (solo BagMRU e' rumore misurato): con la radice sono un colpo.
            casi.append(("R3 ComDlg32 con la radice", ([], [], [], [("HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\ComDlg32\\OpenSavePidlMRU\\c", '"0"', "C:\\" + RADICE[0] + "\\progetti")]), {}))
            casi.append(("R3 Shell\\Bags con la radice", ([], [], [], [("HKEY_CURRENT_USER\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\Shell\\Bags\\1\\Shell", '"x"', "C:\\" + RADICE[0] + "\\progetti")]), {}))
        for nome, (a1, a2, a3, a4), val in casi:
            if rosso(giudica(a1, a2, a3, a4, val)):
                accese += 1
            else:
                print("  SONDA SPENTA:", nome)
        nuove_ch = ["HKEY_CURRENT_USER\\Software\\Chromium", "HKEY_CURRENT_USER\\Software\\Chromium\\BLBeacon"]
        valori_ch = {nuove_ch[0]: {'"usagestats"': "dword:00000000"}, nuove_ch[1]: {'"state"': "dword:00000001"}}
        # La finestra «Salva con nome» che ricorda la cartella dell'unita': rumore di Explorer, anche con la radice.
        bag = ("HKEY_CURRENT_USER\\Software\\Classes\\Local Settings\\Software\\Microsoft\\Windows\\Shell\\BagMRU\\2\\0\\5", '"9"', "C:\\" + (RADICE[0] if RADICE else "x") + "\\progetti")
        ammessa = not rosso(giudica([], ["TEMP\\01234567-89ab-cdef-0123-456789abcdef.tmp"], nuove_ch, [("HKEY_CURRENT_USER\\X\\Explorer\\UserAssist\\Y", '"IFPbqvhz.rkr"', "1"), bag, ("HKEY_CURRENT_USER\\Software\\Sconosciuta", "z", "1"), ("HKEY_CURRENT_USER\\Software\\Chromium\\PreferenceMACs\\Default", '"homepage"', '"ABC"')], valori_ch))
        catena, di = sonde_della_catena(lavoro)
        print(f"sonde: {accese} accese su {len(casi)}, attese 12; della catena {catena} su {di}; sonda ammessa per nome e dichiarata: {ammessa}")
        if accese != len(casi) or len(casi) != 12 or catena != di or not ammessa:
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

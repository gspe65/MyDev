"""S-E1, dalla radice al punto d'arresto: lo scenario dello studente nell'editor dell'unità (dal flowchart aperto nella pagina,
al codice in C salvato accanto, al programma eseguito, al punto d'arresto), come passo del gate con le finestre.

    python -X utf8 -B se1.py --unita <radice> --lavoro <cartella> --kit <cartella del kit> --repo <repository MyDev> --git <git.exe> [--controllo]
    python -X utf8 -B se1.py --unita <radice> --repo <repository MyDev> --rileggi <se1.json> [--controllo]
    python -X utf8 -B se1.py --unita <radice> --repo <repository MyDev> --sonde

L'ambiente è quello che il gate dà all'editor (lo stesso del lanciatore, appaiato da ambienti.py): questo script lo eredita e
aggiunge solo ALGO_PROVA=1 (i comandi che leggono la pagina) e le variabili della sonda. Il flowchart è `lettura-intero.algo` del
corpus di AlgoDesign al commit dell'inventario del nucleo, copiato in `progetti/flowchart`; l'editor parte con la cartella
`progetti` e dentro `se1-dentro.cjs` fa i passi 3–12 (la finestra «Salva con nome» è quella vera di Windows, premuta da
dialogo.ps1). Alla fine la cartella `progetti/flowchart` si toglie: il programma compilato col passo passo porta il percorso
assoluto del sorgente, e il gate cerca i percorsi assoluti nell'unità dopo l'uso.

Con --controllo: la stessa corsa col pacchetto della 0.2.0 (`algo-codice-0.0.1.vsix` della release `v0.2.0`, byte e impronta
dalla voce della ricetta all'etichetta) al posto dell'estensione dell'unità, spenta: deve essere rossa al passo 3 (nessuna pagina).
Il verde del controllo è quel rosso, e nessun altro.

La regola «un solo triangolo di esecuzione visibile in ogni momento» (dalla prova con l'utente): la sonda legge all'inizio le
impostazioni EFFETTIVE delle cinque chiavi `debug.*` che la servono (CHIAVI_DEBUG: valore, valore dell'utente e da dove viene), e
il giudice le confronta con la ricetta (`ricetta/unita/vscodium/data/user-data/User/settings.json`): il valore effettivo e quello
delle impostazioni dell'utente uguali alla ricetta, e le chiavi `debug.*` della ricetta appaiate nei due versi a CHIAVI_DEBUG. Poi
la barra di stato dell'estensione per il C, col comando `c-run.statoDellaBarra` (dalla 0.0.5): col `.c` salvato e aperto due voci
e un solo triangolo (le icone di TRIANGOLI contate in tutte le voci), col programma fermo al punto d'arresto nessuna voce. Senza
il comando (un'estensione più vecchia) quel punto è un fermo: né verde né rosso.

Il verdetto è una funzione sola (`giudica`), attraversata dal dato vero e dalle sonde del giudice in coda, una per ramo, su un
esito finto verde alterato in un punto: ogni sonda deve dare il suo rosso o il suo fermo, e solo quello. Con --sonde solo le
sonde, con --rileggi il verdetto su un esito già scritto: nessuna finestra in tutti e due.

Uscite: 0 verde, 1 rosso, 2 fermo (non si è potuto misurare: l'editor non ha scritto gli esiti, la finestra di dialogo non si è
chiusa con «Salva» o dialogo.ps1 si è fermato su un'eccezione o non ha scritto il suo esito, la cartella del flowchart c'era già,
il pacchetto della 0.2.0 non si scarica, le impostazioni o la barra di stato non lette, il comando della barra che non c'è, un
esito illeggibile o un'altra eccezione, una sonda del giudice che non si accende).

Che cosa NON guarda: i passi 1–2 (il doppio clic sul lanciatore, la cartella `flowchart`): l'editor parte con la cartella
`progetti` dagli argomenti, come lo apre il lanciatore; che il lanciatore lo apra lì lo prova E1 nell'apertura 1 del gate, e il
lanciatore lo provano anche A7 e A9. Il clic sul margine come gesto del
puntatore (il punto d'arresto si mette con l'interfaccia delle estensioni sulla stessa riga). I pixel: la foto della finestra di
dialogo resta nella cartella di lavoro, si guarda a occhio.
"""
import argparse
import hashlib
import io
import json
import os
import shutil
import subprocess
import sys
import urllib.request
import zipfile
from pathlib import Path

a = argparse.ArgumentParser()
a.add_argument("--unita", required=True)
a.add_argument("--repo", required=True)
# La corsa: --lavoro, --kit e --git. Senza editor: --rileggi o --sonde.
a.add_argument("--lavoro")
a.add_argument("--kit")
a.add_argument("--controllo", action="store_true")
# Il git del PC: la base dell'unità non ne ha uno, e l'ambiente del lanciatore non vede quello del PC.
a.add_argument("--git")
a.add_argument("--rileggi", help="un esito .json già scritto dalla sonda: solo il verdetto, nessuna finestra")
a.add_argument("--sonde", action="store_true", help="solo le sonde del giudice, nessuna finestra")
o = a.parse_args()
UNITA, REPO = Path(o.unita), Path(o.repo)

# I passi dello scenario come li fa la sonda, e le parole che lo studente vede (le etichette dello scenario, in italiano).
PASSI = ["1-2", 3, "4-5", 6, 7, "8-9", 10, "11-12"]
TETTO = 18
TITOLO_DELLA_FINESTRA = "Salva il codice come"
NOME_PROPOSTO = "lettura-intero.c"
RIGA_SALVATO = f"Salvato accanto al flowchart: {NOME_PROPOSTO}"
# La regola del solo triangolo: le chiavi del debug che la servono (la ricetta le porta, il collaudo le legge effettive),
# le icone che sono un triangolo di esecuzione, e i due momenti della barra di stato dell'estensione per il C.
IMPOSTAZIONI = Path("ricetta") / "unita" / "vscodium" / "data" / "user-data" / "User" / "settings.json"
CHIAVI_DEBUG = ["debug.internalConsoleOptions", "debug.openDebug", "debug.showInStatusBar", "debug.inlineValues",
                "debug.terminal.clearBeforeReusing"]
TRIANGOLI = ["$(play)", "$(run)", "$(debug-start)", "$(debug-continue)", "$(triangle-right)"]
MOMENTI = {"conIlFile": "col file .c aperto", "alPuntoDArresto": "al punto d'arresto"}


def fermo(m):
    print(f"FERMO: {m}")
    print("ESITO: FERMO")
    sys.exit(2)


def git(*argomenti, repo):
    p = subprocess.run([o.git, "-C", str(repo), *argomenti], capture_output=True)
    if p.returncode != 0:
        fermo(f"git {' '.join(argomenti)}: {p.stderr.decode(errors='replace').strip()}")
    return p.stdout


def corsa():
    """Il flowchart e la sonda, l'editor dell'unità con lo scenario, il flowchart tolto: torna il file degli esiti."""
    if not (o.lavoro and o.kit and o.git):
        fermo("la corsa vuole --lavoro, --kit e --git (senza editor: --rileggi o --sonde)")
    LAVORO, KIT = Path(o.lavoro), Path(o.kit)
    LAVORO.mkdir(parents=True, exist_ok=True)
    nome = "flowchart  controllo" if o.controllo else "flowchart"
    CARTELLA = UNITA / "progetti" / nome
    if CARTELLA.exists():
        fermo(f"{CARTELLA} c'è già: lo scenario parte da un'unità in cui il flowchart non è mai stato aperto")

    # Il flowchart dal corpus di AlgoDesign al commit dell'inventario del nucleo.
    inventario = json.loads((REPO / "ricetta" / "nucleo" / "inventario.json").read_text(encoding="utf-8"))
    ALGODESIGN = Path(os.environ.get("ALGODESIGN_REPO") or REPO.parent / "AlgoDesign")
    algo = git("show", f"{inventario['commit']}:app/casi/tappa-1/lettura-intero.algo", repo=ALGODESIGN)
    print(f"flowchart: lettura-intero.algo al commit {inventario['commit'][:7]}, {len(algo)} byte")

    # La sonda: un'estensione vuota di sviluppo, con lo scenario come «prove».
    sonda = LAVORO / ("sonda  controllo" if o.controllo else "sonda")
    shutil.rmtree(sonda, ignore_errors=True)
    sonda.mkdir()
    (sonda / "package.json").write_text(json.dumps({"name": "se1", "publisher": "collaudo", "version": "0.0.1", "engines": {"vscode": "^1.90.0"}}), encoding="utf-8")

    argomenti = [f"--extensionDevelopmentPath={sonda}", f"--extensionTestsPath={KIT / 'se1-dentro.cjs'}"]
    if o.controllo:
        # Il pacchetto della 0.2.0, verificato con la voce della ricetta all'etichetta.
        voci = json.loads(git("show", "v0.2.0:ricetta/componenti.json", repo=REPO))
        voce = next((v for v in voci.get("scaricati", []) + voci.get("nostri", []) if v.get("nome") == "estensione-algo"), None)
        if voce is None:
            fermo("la voce estensione-algo non c'è nella ricetta della 0.2.0")
        try:
            with urllib.request.urlopen(voce["fonte"], timeout=60) as r:
                dati = r.read()
        except OSError as e:
            fermo(f"il pacchetto della 0.2.0 non si scarica: {e}")
        if len(dati) != voce["byte"] or hashlib.sha256(dati).hexdigest() != voce["sha256"]:
            fermo(f"il pacchetto della 0.2.0 non è quello della voce: {len(dati)} byte")
        pacchetto = LAVORO / "pacchetto 0.2.0"
        shutil.rmtree(pacchetto, ignore_errors=True)
        with zipfile.ZipFile(io.BytesIO(dati)) as z:
            for n in z.namelist():
                if n.startswith("extension/") and not n.endswith("/"):
                    d = pacchetto / n[len("extension/"):]
                    d.parent.mkdir(parents=True, exist_ok=True)
                    d.write_bytes(z.read(n))
        print(f"controllo positivo: {voce['file']} {voce['byte']} byte {voce['sha256'][:12]}, al posto dell'estensione dell'unità")
        argomenti += [f"--extensionDevelopmentPath={pacchetto}", "--disable-extension", "gilan65.algodesign-code"]

    CARTELLA.mkdir(parents=True)
    (CARTELLA / "lettura-intero.algo").write_bytes(algo)
    uscita = LAVORO / ("se1-controllo.json" if o.controllo else "se1.json")
    uscita.unlink(missing_ok=True)
    ambiente = {k: v for k, v in os.environ.items() if not k.upper().startswith(("VSCODE_", "ELECTRON_"))}
    ambiente.update({"ALGO_PROVA": "1", "SE1_ALGO": str(CARTELLA / "lettura-intero.algo"), "SE1_USCITA": str(uscita), "SE1_UNITA": str(UNITA), "SE1_KIT": str(KIT), "SE1_LAVORO": str(LAVORO), "SE1_DEBUG": json.dumps(CHIAVI_DEBUG)})
    print("APRO L'EDITOR DELL'UNITÀ: lo scenario S-E1, qualche minuto")
    try:
        p = subprocess.run([str(UNITA / "vscodium" / "VSCodium.exe"), *argomenti, str(UNITA / "progetti")], env=ambiente, capture_output=True, timeout=900)
        print(f"editor uscito: {p.returncode}")
        (LAVORO / ("editor-controllo.log" if o.controllo else "editor.log")).write_bytes(p.stdout + p.stderr)
    except subprocess.TimeoutExpired:
        print("editor: oltre 900 s")
    finally:
        # I file nati dallo scenario (il .c, il programma, il .algo) escono dall'unità; gli esiti e la foto restano nel lavoro.
        shutil.rmtree(CARTELLA, ignore_errors=True)
    print(f"cartella del flowchart tolta: {not CARTELLA.exists()}")
    return uscita

def attese_del_debug():
    """Le chiavi debug.* della ricetta, coi loro valori: ciò che l'editor dell'unità deve avere come impostazione effettiva."""
    ricetta = json.loads((REPO / IMPOSTAZIONI).read_text(encoding="utf-8"))
    return {k: v for k, v in ricetta.items() if k.startswith("debug.")}


def algo_intatto(e):
    return e.get("algoPrima") is not None and e.get("algoPrima") == e.get("algoDopo")


def dialogo_di(fatti):
    return next((x["visto"].get("dialogo") for x in fatti if x["n"] == 7), None) or {}


def numeri_dei_passi(fatti):
    """I numeri dello scenario coperti dai passi fatti («4-5» ne copre due)."""
    numeri = set()
    for x in fatti:
        pezzi = str(x["n"]).split("-")
        numeri.update(range(int(pezzi[0]), int(pezzi[-1]) + 1))
    return numeri


def triangoli(voci):
    return sum(str(v).count(t) for v in voci for t in TRIANGOLI)


def controllo_giusto(fatti):
    """Il verde del controllo: i passi 1-2 riusciti, il 3 no (nessuna pagina), nient'altro."""
    return [x["n"] for x in fatti] == ["1-2", 3] and fatti[0]["riuscito"] and not fatti[1]["riuscito"] and fatti[1]["visto"].get("vista", {}).get("tipo") != "pagina"


def giudica(e, attese):
    """Il verdetto, uguale per il dato vero e per le sonde: (rossi, fermi), ciascuno con la sua frase."""
    rossi, fermi = [], []
    fatti = e.get("passi", [])
    ultimo = fatti[-1] if fatti else None
    dialogo = dialogo_di(fatti)
    # Al passo 7 la finestra di Windows: se dialogo.ps1 non ha potuto misurare, l'esito del passo non dice nulla.
    if ultimo is not None and ultimo["n"] == 7 and not ultimo["riuscito"]:
        scritto = ultimo["visto"].get("dialogo")
        if scritto is None:
            return [], [f"dialogo.ps1 non ha scritto il suo esito (uscita {ultimo['visto'].get('uscitaDialogo')})"]
        if scritto.get("eccezione"):
            return [], [f"dialogo.ps1 si è fermato su un'eccezione: {scritto['eccezione']}"]
        if scritto.get("trovato") and not scritto.get("premuto"):
            return [], [f"la finestra di dialogo non si è chiusa con «Salva»: {scritto.get('motivo')}"]
    passi_completi = [x["n"] for x in fatti] == PASSI and all(x["riuscito"] for x in fatti)
    if not passi_completi:
        rossi.append("non tutti i passi sono riusciti, nell'ordine dello scenario")
    cartella_attesa = str(UNITA / "progetti" / "flowchart")
    if dialogo.get("titolo") != TITOLO_DELLA_FINESTRA or dialogo.get("nome") != NOME_PROPOSTO or (dialogo.get("cartella") or "").lower() != cartella_attesa.lower():
        rossi.append("la finestra «Salva con nome» non propone la cartella del flowchart col nome atteso")
    riga = next((x["visto"].get("riga") for x in fatti if x["n"] == 7), None)
    if riga != RIGA_SALVATO:
        rossi.append(f"la pagina non dice dove ha salvato: {riga!r}")
    if not algo_intatto(e):
        rossi.append("errore critico: il .algo è stato modificato")
    # I passi dello scenario: i numeri coperti dai passi fatti, contro il tetto (RU-08).
    numeri = numeri_dei_passi(fatti)
    if len(numeri) > TETTO or len(numeri) != 12:
        rossi.append(f"passi {len(numeri)}: attesi i 12 dello scenario, entro {TETTO}")

    # Le impostazioni del debug: le chiavi della ricetta e quelle del collaudo nei due versi, poi ogni valore letto.
    for k in sorted(set(attese) - set(CHIAVI_DEBUG)):
        rossi.append(f"chiave del debug nella ricetta che il collaudo non legge: {k}")
    for k in CHIAVI_DEBUG:
        if k not in attese:
            rossi.append(f"chiave del debug che la ricetta non ha più: {k}")
    lette = e.get("impostazioni")
    if not isinstance(lette, dict):
        fermi.append(f"la sonda non ha letto le impostazioni del debug: {e.get('erroreImpostazioni')}")
    else:
        for k in sorted(set(lette) - set(CHIAVI_DEBUG)):
            rossi.append(f"impostazione letta che il collaudo non chiede: {k}")
        for k in CHIAVI_DEBUG:
            letta = lette.get(k)
            if not isinstance(letta, dict):
                rossi.append(f"impostazione non letta: {k}")
            elif k not in attese:
                continue
            elif letta.get("valore") != attese[k]:
                rossi.append(f"impostazione effettiva diversa dalla ricetta: {k} = {letta.get('valore')!r} (da {letta.get('origine')}), nella ricetta {attese[k]!r}")
            elif letta.get("utente") != attese[k]:
                rossi.append(f"impostazione che non viene dall'utente dell'unità: {k}, dell'utente {letta.get('utente')!r}, nella ricetta {attese[k]!r}")

    # La barra di stato dell'estensione per il C nei due momenti. Senza lettura a passi tutti riusciti la sonda non ha
    # fatto il suo lavoro (fermo); a passi non riusciti il rosso c'è già.
    barra = e.get("barra") or {}
    for momento, nome in MOMENTI.items():
        b = barra.get(momento)
        if not isinstance(b, dict):
            if passi_completi:
                fermi.append(f"la sonda non ha letto la barra di stato {nome}")
            continue
        if not b.get("disponibile"):
            versione = (e.get("estensioni") or {}).get("gilan65.c-run")
            fermi.append(f"la barra di stato dell'estensione per il C non si legge {nome}: il comando c-run.statoDellaBarra non c'è (estensione {versione}, serve la 0.0.5)")
            continue
        voci = b.get("voci")
        if not isinstance(voci, list):
            rossi.append(f"barra di stato {nome}: il comando non ha dato le voci ({b.get('errore')})")
        elif momento == "conIlFile" and (len(voci) != 2 or triangoli(voci) != 1):
            rossi.append(f"barra di stato {nome}: {len(voci)} voci e {triangoli(voci)} triangoli, attese 2 voci e un solo triangolo: {voci}")
        elif momento == "alPuntoDArresto" and voci:
            rossi.append(f"barra di stato {nome}: {len(voci)} voci, attesa nessuna: {voci}")
    return rossi, fermi


def uscita_di(rossi, fermi):
    return 1 if rossi else 2 if fermi else 0


def esito_finto_verde(attese):
    """Un esito come lo scrive la sonda, che il giudice deve dire verde: la base delle sonde del giudice."""
    passi = [{"n": n, "gesto": "finto", "visto": {}, "riuscito": True} for n in PASSI]
    passi[PASSI.index(7)]["visto"] = {"dialogo": {"trovato": True, "premuto": True, "titolo": TITOLO_DELLA_FINESTRA, "nome": NOME_PROPOSTO,
                                                  "cartella": str(UNITA / "progetti" / "flowchart")}, "uscitaDialogo": 0, "riga": RIGA_SALVATO}
    return {"passi": passi, "algoPrima": "QQ==", "algoDopo": "QQ==", "estensioni": {"gilan65.c-run": "0.0.5"},
            "impostazioni": {k: {"valore": attese.get(k), "origine": "utente", "utente": attese.get(k)} for k in CHIAVI_DEBUG},
            "barra": {"conIlFile": {"disponibile": True, "voci": [f"$(play) Compila ed esegui {NOME_PROPOSTO}", f"$(bug) Passo passo {NOME_PROPOSTO}"]},
                      "alPuntoDArresto": {"disponibile": True, "voci": []}}}


def sonde_del_giudice(attese):
    """Lo stesso verdetto su un esito finto verde alterato in un punto: ogni sonda deve far nascere il suo rosso o il suo
    fermo (per inizio di frase) e nessun altro, con l'uscita attesa. Torna i nomi delle sonde spente."""
    def muta(cambia, attese_sonda=None):
        e = esito_finto_verde(attese)
        cambia(e)
        return e, (attese if attese_sonda is None else attese_sonda)

    def ultimo_fallito(e):
        e["passi"][-1]["riuscito"] = False

    def passo_in_piu(e):
        e["passi"].append({"n": 13, "gesto": "finto", "visto": {}, "riuscito": True})

    def fino_al_7(e, dialogo):
        e["passi"] = e["passi"][:PASSI.index(7) + 1]
        e["passi"][-1]["riuscito"] = False
        e["passi"][-1]["visto"]["dialogo"] = dialogo
        e["passi"][-1]["visto"]["uscitaDialogo"] = 2

    def imposta(e, k, campo, valore):
        e["impostazioni"][k][campo] = valore

    def voci(e, momento, v):
        e["barra"][momento]["voci"] = v

    sette = PASSI.index(7)
    con_altra_chiave = dict(attese, **{"debug.sonda": 1})
    senza_open = {k: v for k, v in attese.items() if k != "debug.openDebug"}
    sonde = {
        "un passo non riuscito": (muta(ultimo_fallito), [("rosso", "non tutti i passi sono riusciti")]),
        "un passo in più": (muta(passo_in_piu), [("rosso", "non tutti i passi sono riusciti"), ("rosso", "passi 13: attesi i 12")]),
        "la finestra col nome sbagliato": (muta(lambda e: e["passi"][sette]["visto"]["dialogo"].update(nome="x.c")),
                                           [("rosso", "la finestra «Salva con nome» non propone")]),
        "la pagina senza la riga del salvataggio": (muta(lambda e: e["passi"][sette]["visto"].update(riga=None)),
                                                    [("rosso", "la pagina non dice dove ha salvato")]),
        "il .algo modificato": (muta(lambda e: e.update(algoDopo="Qg==")), [("rosso", "errore critico: il .algo")]),
        "la finestra non premuta": (muta(lambda e: fino_al_7(e, {"trovato": True, "premuto": False, "motivo": "sonda"})),
                                    [("fermo", "la finestra di dialogo non si è chiusa")]),
        "dialogo.ps1 su un'eccezione": (muta(lambda e: fino_al_7(e, {"trovato": True, "premuto": False, "eccezione": "sonda"})),
                                        [("fermo", "dialogo.ps1 si è fermato su un'eccezione")]),
        "dialogo.ps1 senza esito": (muta(lambda e: fino_al_7(e, None)), [("fermo", "dialogo.ps1 non ha scritto il suo esito")]),
        "impostazione effettiva diversa": (muta(lambda e: imposta(e, "debug.openDebug", "valore", "openOnSessionStart")),
                                           [("rosso", "impostazione effettiva diversa dalla ricetta: debug.openDebug")]),
        "impostazione non dell'utente": (muta(lambda e: imposta(e, "debug.inlineValues", "utente", None)),
                                         [("rosso", "impostazione che non viene dall'utente dell'unità: debug.inlineValues")]),
        "impostazione non letta": (muta(lambda e: e["impostazioni"].pop("debug.showInStatusBar")),
                                   [("rosso", "impostazione non letta: debug.showInStatusBar")]),
        "impostazione letta in più": (muta(lambda e: e["impostazioni"].update({"debug.sonda": {"valore": 1, "utente": 1}})),
                                      [("rosso", "impostazione letta che il collaudo non chiede: debug.sonda")]),
        "ricetta con una chiave in più": (muta(lambda e: None, con_altra_chiave),
                                          [("rosso", "chiave del debug nella ricetta che il collaudo non legge: debug.sonda")]),
        "ricetta senza una chiave": (muta(lambda e: None, senza_open), [("rosso", "chiave del debug che la ricetta non ha più: debug.openDebug")]),
        "impostazioni non lette": (muta(lambda e: e.update(impostazioni=None)), [("fermo", "la sonda non ha letto le impostazioni del debug")]),
        "due triangoli col file": (muta(lambda e: voci(e, "conIlFile", ["$(play) Compila ed esegui x.c", "$(run) Passo passo x.c"])),
                                   [("rosso", "barra di stato col file .c aperto: 2 voci e 2 triangoli")]),
        "una voce sola col file": (muta(lambda e: voci(e, "conIlFile", ["$(play) Compila ed esegui x.c"])),
                                   [("rosso", "barra di stato col file .c aperto: 1 voci e 1 triangoli")]),
        "voci al punto d'arresto": (muta(lambda e: voci(e, "alPuntoDArresto", ["$(debug-start) Passo passo x.c"])),
                                    [("rosso", "barra di stato al punto d'arresto: 1 voci")]),
        "il comando senza voci": (muta(lambda e: voci(e, "conIlFile", None)), [("rosso", "barra di stato col file .c aperto: il comando non ha dato")]),
        "il comando della barra che non c'è": (muta(lambda e: [b.update(disponibile=False, voci=None) for b in e["barra"].values()]),
                                               [("fermo", "la barra di stato dell'estensione per il C non si legge col file"),
                                                ("fermo", "la barra di stato dell'estensione per il C non si legge al punto")]),
        "la barra non letta": (muta(lambda e: e.update(barra={})), [("fermo", "la sonda non ha letto la barra di stato col file"),
                                                                  ("fermo", "la sonda non ha letto la barra di stato al punto")]),
    }
    base_r, base_f = giudica(esito_finto_verde(attese), attese)
    for x in base_r + base_f:
        print(f"sonde del giudice: l'esito finto verde non è verde: {x}")
    spente = []
    for nome, ((e, att), attesi) in sonde.items():
        rossi, fermi = giudica(e, att)
        nuovi = [("rosso", x) for x in rossi if x not in base_r] + [("fermo", x) for x in fermi if x not in base_f]
        if all(any(t == s and x.startswith(p) for s, x in [("rosso", y) for y in base_r] + [("fermo", y) for y in base_f]) for t, p in attesi):
            print(f"sonde del giudice: «{nome}» NON MISURABILE, l'esito finto ha già il suo difetto")
            continue
        uscita_attesa = 1 if any(t == "rosso" for t, _ in attesi) else 2
        acceso = (all(any(t == s and x.startswith(p) for s, x in nuovi) for t, p in attesi)
                  and all(any(t == s and x.startswith(p) for t, p in attesi) for s, x in nuovi)
                  and uscita_di(rossi, fermi) == uscita_attesa)
        if not acceso:
            spente.append(nome)
            print(f"sonde del giudice: «{nome}» SPENTA: {nuovi or 'nessun difetto nuovo'}, uscita {uscita_di(rossi, fermi)}")
    print(f"sonde del giudice: {len(sonde) - len(spente)} accese su {len(sonde)}")
    return spente


def racconta(e, attese):
    """Ciò che la sonda ha visto, per chi legge il registro del gate."""
    fatti = e.get("passi", [])
    dialogo = dialogo_di(fatti)
    print(f"la finestra di Windows: titolo «{dialogo.get('titolo')}», nome «{dialogo.get('nome')}», cartella «{dialogo.get('cartella')}», pulsante «{dialogo.get('pulsante')}»")
    print(f"passi dello scenario: {len(numeri_dei_passi(fatti))}, tetto {TETTO}")
    lette = e.get("impostazioni")
    lette = lette if isinstance(lette, dict) else {}
    print(f"impostazioni del debug: lette {len(lette)}, chieste dal collaudo {len(CHIAVI_DEBUG)}, nella ricetta {len(attese)}")
    for k in CHIAVI_DEBUG:
        letta = lette.get(k) if isinstance(lette.get(k), dict) else {}
        print(f"impostazioni del debug: {k} = {letta.get('valore')!r} (da {letta.get('origine')}; dell'utente {letta.get('utente')!r}), nella ricetta {attese.get(k)!r}")
    for momento, nome in MOMENTI.items():
        b = (e.get("barra") or {}).get(momento)
        if not isinstance(b, dict):
            print(f"barra di stato {nome}: non letta")
        elif not b.get("disponibile"):
            print(f"barra di stato {nome}: il comando c-run.statoDellaBarra non c'è")
        else:
            v = b.get("voci")
            print(f"barra di stato {nome}: voci {json.dumps(v, ensure_ascii=False)}, triangoli {triangoli(v) if isinstance(v, list) else None}")


def main():
    attese = attese_del_debug()
    if o.sonde:
        spente = sonde_del_giudice(attese)
        print("ESITO: FERMO (sonde del giudice spente)" if spente else "ESITO: VERDE (sonde del giudice)")
        sys.exit(2 if spente else 0)
    if o.rileggi:
        uscita = Path(o.rileggi)
        print(f"rilettura: {uscita}")
    else:
        uscita = corsa()
    if not uscita.exists():
        fermo(f"l'editor non ha scritto gli esiti: manca {uscita}")
    e = json.loads(uscita.read_text(encoding="utf-8"))
    print(f"lingua dell'editor {e.get('lingua')}; estensioni {json.dumps(e.get('estensioni'))}")
    fatti = e.get("passi", [])
    for x in fatti:
        print(f"{'PASS' if x['riuscito'] else 'FAIL'}  passo {x['n']}: {x['gesto']} — {json.dumps(x['visto'], ensure_ascii=False)[:500]}")
    if e.get("fermo"):
        print(f"la sonda si è fermata: {e['fermo']}")
    print(f"il .algo dopo lo scenario identico byte per byte: {algo_intatto(e)}")

    if o.controllo:
        giusto = controllo_giusto(fatti)
        print(f"controllo positivo: rosso al passo 3, senza la pagina: {giusto}")
        print("ESITO: VERDE (il controllo positivo è rosso dove deve)" if giusto else "ESITO: ROSSO (il controllo positivo non è rosso al passo 3: la prova non discrimina)")
        sys.exit(0 if giusto else 1)

    racconta(e, attese)
    rossi, fermi = giudica(e, attese)
    spente = sonde_del_giudice(attese)
    for r in rossi:
        print(f"ROSSO: {r}")
    for f in fermi:
        print(f"FERMO: {f}")
    if spente:
        fermo(f"sonde del giudice che non si accendono: {', '.join(spente)}")
    print({0: "ESITO: VERDE", 1: "ESITO: ROSSO", 2: "ESITO: FERMO"}[uscita_di(rossi, fermi)])
    sys.exit(uscita_di(rossi, fermi))


if __name__ == "__main__":
    # Un esito troncato (il tempo massimo durante la scrittura), un pacchetto che non si apre, l'editor che non c'è: non si è
    # potuto misurare, come in guide.py; mai il rosso di un traceback.
    try:
        main()
    except SystemExit:
        raise
    except Exception as x:  # noqa: BLE001
        fermo(f"eccezione: {x!r}")

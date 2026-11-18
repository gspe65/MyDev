"""S-E1, dalla radice al punto d'arresto: lo scenario dello studente nell'editor dell'unità (dal flowchart aperto nella pagina,
al codice in C salvato accanto, al programma eseguito, al punto d'arresto), come passo del gate con le finestre.

    python -X utf8 -B se1.py --unita <radice> --lavoro <cartella> --kit <cartella del kit> --repo <repository MyDev> --git <git.exe> [--controllo]

L'ambiente è quello che il gate dà all'editor (lo stesso del lanciatore, appaiato da ambienti.py): questo script lo eredita e
aggiunge solo ALGO_PROVA=1 (i comandi che leggono la pagina) e le variabili della sonda. Il flowchart è `lettura-intero.algo` del
corpus di AlgoDesign al commit dell'inventario del nucleo, copiato in `progetti/flowchart`; l'editor parte con la cartella
`progetti` e dentro `se1-dentro.cjs` fa i passi 3–12 (la finestra «Salva con nome» è quella vera di Windows, premuta da
dialogo.ps1). Alla fine la cartella `progetti/flowchart` si toglie: il programma compilato col passo passo porta il percorso
assoluto del sorgente, e il gate cerca i percorsi assoluti nell'unità dopo l'uso.

Con --controllo: la stessa corsa col pacchetto della 0.2.0 (`algo-codice-0.0.1.vsix` della release `v0.2.0`, byte e impronta
dalla voce della ricetta all'etichetta) al posto dell'estensione dell'unità, spenta: deve essere rossa al passo 3 (nessuna pagina).
Il verde del controllo è quel rosso, e nessun altro.

Uscite: 0 verde, 1 rosso, 2 fermo (non si è potuto misurare: l'editor non ha scritto gli esiti, la finestra di dialogo non si è
chiusa con «Salva», la cartella del flowchart c'era già, il pacchetto della 0.2.0 non si scarica).

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
a.add_argument("--lavoro", required=True)
a.add_argument("--kit", required=True)
a.add_argument("--repo", required=True)
a.add_argument("--controllo", action="store_true")
# Il git del PC: la base dell'unità non ne ha uno, e l'ambiente del lanciatore non vede quello del PC.
a.add_argument("--git", required=True)
o = a.parse_args()
UNITA, LAVORO, KIT, REPO = Path(o.unita), Path(o.lavoro), Path(o.kit), Path(o.repo)

# I passi dello scenario come li fa la sonda, e le parole che lo studente vede (le etichette dello scenario, in italiano).
PASSI = ["1-2", 3, "4-5", 6, 7, "8-9", 10, "11-12"]
TETTO = 18
TITOLO_DELLA_FINESTRA = "Salva il codice come"
NOME_PROPOSTO = "lettura-intero.c"
RIGA_SALVATO = f"Salvato accanto al flowchart: {NOME_PROPOSTO}"


def fermo(m):
    print(f"FERMO: {m}")
    print("ESITO: FERMO")
    sys.exit(2)


def git(*argomenti, repo):
    p = subprocess.run([o.git, "-C", str(repo), *argomenti], capture_output=True)
    if p.returncode != 0:
        fermo(f"git {' '.join(argomenti)}: {p.stderr.decode(errors='replace').strip()}")
    return p.stdout


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
ambiente.update({"ALGO_PROVA": "1", "SE1_ALGO": str(CARTELLA / "lettura-intero.algo"), "SE1_USCITA": str(uscita), "SE1_UNITA": str(UNITA), "SE1_KIT": str(KIT), "SE1_LAVORO": str(LAVORO)})
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

if not uscita.exists():
    fermo("l'editor non ha scritto gli esiti")
e = json.loads(uscita.read_text(encoding="utf-8"))
print(f"lingua dell'editor {e.get('lingua')}; estensioni {json.dumps(e.get('estensioni'))}")
fatti = e.get("passi", [])
for x in fatti:
    print(f"{'PASS' if x['riuscito'] else 'FAIL'}  passo {x['n']}: {x['gesto']} — {json.dumps(x['visto'], ensure_ascii=False)[:500]}")
if e.get("fermo"):
    print(f"la sonda si è fermata: {e['fermo']}")
algo_intatto = e.get("algoPrima") is not None and e.get("algoPrima") == e.get("algoDopo")
print(f"il .algo dopo lo scenario identico byte per byte: {algo_intatto}")

if o.controllo:
    # Il verde del controllo: i passi 1–6 riusciti, il 7 no (nessuna pagina), nient'altro.
    giusto = [x["n"] for x in fatti] == ["1-2", 3] and fatti[0]["riuscito"] and not fatti[1]["riuscito"] and fatti[1]["visto"].get("vista", {}).get("tipo") != "pagina"
    print(f"controllo positivo: rosso al passo 3, senza la pagina: {giusto}")
    print("ESITO: VERDE (il controllo positivo è rosso dove deve)" if giusto else "ESITO: ROSSO (il controllo positivo non è rosso al passo 3: la prova non discrimina)")
    sys.exit(0 if giusto else 1)

ultimo = fatti[-1] if fatti else None
dialogo = next((x["visto"].get("dialogo") for x in fatti if x["n"] == 7), None) or {}
if ultimo is not None and ultimo["n"] == 7 and not ultimo["riuscito"] and dialogo.get("trovato") and not dialogo.get("premuto"):
    fermo(f"la finestra di dialogo non si è chiusa con «Salva»: {dialogo.get('motivo')}")
rossi = []
if [x["n"] for x in fatti] != PASSI or not all(x["riuscito"] for x in fatti):
    rossi.append("non tutti i passi sono riusciti, nell'ordine dello scenario")
cartella_attesa = str(UNITA / "progetti" / "flowchart")
print(f"la finestra di Windows: titolo «{dialogo.get('titolo')}», nome «{dialogo.get('nome')}», cartella «{dialogo.get('cartella')}», pulsante «{dialogo.get('pulsante')}»")
if dialogo.get("titolo") != TITOLO_DELLA_FINESTRA or dialogo.get("nome") != NOME_PROPOSTO or (dialogo.get("cartella") or "").lower() != cartella_attesa.lower():
    rossi.append("la finestra «Salva con nome» non propone la cartella del flowchart col nome atteso")
riga = next((x["visto"].get("riga") for x in fatti if x["n"] == 7), None)
if riga != RIGA_SALVATO:
    rossi.append(f"la pagina non dice dove ha salvato: {riga!r}")
if not algo_intatto:
    rossi.append("errore critico: il .algo è stato modificato")
# I passi dello scenario: i numeri coperti dai passi fatti, contro il tetto (RU-08).
numeri = set()
for x in fatti:
    pezzi = str(x["n"]).split("-")
    numeri.update(range(int(pezzi[0]), int(pezzi[-1]) + 1))
print(f"passi dello scenario: {len(numeri)}, tetto {TETTO}")
if len(numeri) > TETTO or len(numeri) != 12:
    rossi.append(f"passi {len(numeri)}: attesi i 12 dello scenario, entro {TETTO}")
for r in rossi:
    print(f"ROSSO: {r}")
print("ESITO: ROSSO" if rossi else "ESITO: VERDE")
sys.exit(1 if rossi else 0)

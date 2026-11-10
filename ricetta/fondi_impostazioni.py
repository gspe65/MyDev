"""Fonde su settings.json e tasks.json di una unita' la differenza di una variante.
Uso: python -I -B fondi_impostazioni.py <differenza.json> <cartella User dell'unita'>
La differenza dichiara: chiavi nuove delle impostazioni, l'aggiunta al PATH del terminale, debug e compiti nuovi.
Una chiave, un debug o un compito gia' presenti sono un rosso: la variante aggiunge, non cambia la base.
Uscite: 0 verde, 1 rosso.
Che cosa NON guarda: che i compiti funzionino."""
import json
import pathlib
import sys


def rosso(messaggio):
    print("ROSSO:", messaggio)
    sys.exit(1)


def leggi(p):
    return json.loads(p.read_text(encoding="utf-8"))


def scrivi(p, dati):
    p.write_text(json.dumps(dati, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")


diff = leggi(pathlib.Path(sys.argv[1]))
cartella = pathlib.Path(sys.argv[2])
f_imp, f_com = cartella / "settings.json", cartella / "tasks.json"
imp, com = leggi(f_imp), leggi(f_com)

for k, v in diff["impostazioni"].items():
    if k in imp:
        rosso(f"chiave gia' presente: {k}")
    imp[k] = v

args = imp["terminal.integrated.profiles.windows"]["MSYS"]["args"]
inizio = 'export PATH="$MYDEV/bin:'
if len(args) != 4 or args[3].count(inizio) != 1:
    rosso("la riga del terminale non e' quella attesa")
args[3] = args[3].replace(inizio, inizio + diff["path_terminale"])

debug = imp["launch"]["configurations"]
for d in diff["debug"]:
    if any(x["name"] == d["name"] for x in debug):
        rosso(f"debug gia' presente: {d['name']}")
    debug.append(d)

compiti = com["tasks"]
for c in diff["compiti"]:
    if any(x["label"] == c["label"] for x in compiti):
        rosso(f"compito gia' presente: {c['label']}")
    compiti.append(c)

scrivi(f_imp, imp)
scrivi(f_com, com)
print(f"impostazioni fuse: chiavi {len(diff['impostazioni'])}, debug {len(diff['debug'])}, compiti {len(diff['compiti'])}")

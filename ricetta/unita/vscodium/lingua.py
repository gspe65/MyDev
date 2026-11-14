"""La lingua dell'editor dell'unita': languagepacks.json per la cartella in cui l'unita' si trova, e la cache delle
traduzioni tolta se nomina un'altra cartella.

    <unita>\\python\\python.exe -I -B <unita>\\vscodium\\lingua.py            prepara la lingua: lo fanno il costruttore e i lanciatori dell'editor
    <unita>\\python\\python.exe -I -B <unita>\\vscodium\\lingua.py --sonde    il verdetto su dati veri e sbagliati, senza scrivere nulla

L'editor legge all'avvio data\\user-data\\languagepacks.json, che porta i percorsi assoluti dei file di traduzione dei
pacchetti di lingua installati: se manca, o nomina un'altra cartella, quell'apertura e' in inglese, e il file lo
riscrive dopo. In data\\user-data\\clp\\<impronta>.<lingua>\\tcf.json scrive gli stessi percorsi e non li riscrive
finche' l'impronta non cambia: dopo uno spostamento i testi delle estensioni incorporate resterebbero in inglese.
Qui il primo si scrive com'e' scritto dall'editor (l'impronta e' l'MD5 di identificativo e versione, il testo e' quello
di JSON.stringify), e la seconda si toglie se non nomina questa cartella: l'editor la rifa' all'avvio.
La radice si ricava dalla posizione di questo file, mai dalla cartella di lavoro.

Uscite: 0 fatto (anche senza pacchetti di lingua), 1 rosso (le sonde), 2 fermo (non si e' potuto fare).
Che cosa NON guarda: che l'editor usi davvero la lingua (lo dice il gate con le finestre); argv.json, che sceglie la
lingua ed e' un file dell'unita'; i pacchetti di lingua con piu' estensioni per la stessa lingua (fermo).
"""
import hashlib
import json
import os
import pathlib
import shutil
import sys


def fermo(m):
    print(f"FERMO: {m}")
    print("ESITO: FERMO")
    sys.exit(2)


def forma_editor(percorso):
    """Il percorso come lo scrive l'editor: barre rovesce, lettera del disco minuscola, senza barra finale (alla radice
    di un disco E:\\ diventa e:, e i percorsi composti hanno una barra sola: e:\\vscodium\\...)."""
    p = str(percorso).replace("/", "\\").rstrip("\\")
    return p[0].lower() + p[1:] if len(p) > 1 and p[1] == ":" else p


def pacchetti(estensioni):
    """{cartella: package.json} dei pacchetti di lingua installati, in ordine di nome."""
    trovati = {}
    if not estensioni.is_dir():
        return trovati
    for d in sorted(estensioni.iterdir()):
        m = d / "package.json"
        if d.is_dir() and m.is_file():
            p = json.loads(m.read_text(encoding="utf-8"))
            if any(loc.get("translations") for loc in p.get("contributes", {}).get("localizations", [])):
                trovati[d.name] = p
    return trovati


def componi(radice_editor, trovati):
    """Il testo di languagepacks.json per una radice (forma dell'editor) e i pacchetti dati."""
    uscita = {}
    for cartella, p in trovati.items():
        ident = f"{p['publisher']}.{p['name']}".lower()
        for loc in p["contributes"]["localizations"]:
            lingua = loc["languageId"].lower()
            if lingua in uscita:
                fermo(f"due pacchetti per la lingua {lingua}")
            traduzioni = {}
            for t in loc.get("translations", []):
                rel = t["path"].replace("/", "\\").lstrip(".").lstrip("\\")
                traduzioni[t["id"]] = radice_editor + "\\vscodium\\data\\extensions\\" + cartella + "\\" + rel
            uscita[lingua] = {
                "hash": hashlib.md5((ident + p["version"]).encode("utf-8")).hexdigest(),
                "extensions": [{"extensionIdentifier": {"id": ident}, "version": p["version"]}],
                "translations": traduzioni,
                "label": loc.get("localizedLanguageName") or loc.get("languageName") or lingua,
            }
    return json.dumps(uscita, ensure_ascii=False, separators=(",", ":")) if uscita else None


def da_togliere(radice_editor, tcf):
    """Il verdetto sulla cache di una lingua: va tolta se tcf.json manca o non nomina i file di questa radice.
    L'ago e' la radice seguita da vscodium\\data\\, dove stanno i file di traduzione: la sola radice si troverebbe anche
    dentro i percorsi di una radice piu' profonda (unita' aperta in MyDev\\MyDev, poi spostata un livello piu' su)."""
    if tcf is None:
        return True
    return json.dumps(radice_editor + "\\vscodium\\data\\", ensure_ascii=False)[1:-1].lower() not in tcf.lower()


def prepara(radice):
    dati = radice / "vscodium" / "data"
    if not dati.is_dir():
        fermo(f"manca {dati}")
    re_ = forma_editor(radice)
    testo = componi(re_, pacchetti(dati / "extensions"))
    lp = dati / "user-data" / "languagepacks.json"
    if testo is None:
        print("pacchetti di lingua: 0")
    else:
        vecchio = lp.read_text(encoding="utf-8") if lp.is_file() else None
        if vecchio == testo:
            print(f"languagepacks.json: uguale ({len(testo.encode())} byte)")
        else:
            lp.parent.mkdir(parents=True, exist_ok=True)
            lp.write_text(testo, encoding="utf-8", newline="")
            print(f"languagepacks.json: scritto ({len(testo.encode())} byte, {'nuovo' if vecchio is None else 'riscritto'})")
    clp = dati / "user-data" / "clp"
    tolte = 0
    if clp.is_dir():
        for d in sorted(clp.iterdir()):
            if d.is_dir():
                f = d / "tcf.json"
                if da_togliere(re_, f.read_text(encoding="utf-8") if f.is_file() else None):
                    shutil.rmtree(d)
                    tolte += 1
    print(f"cache delle traduzioni tolte: {tolte}")
    print("ESITO: FATTO")
    return 0


def sonde():
    """Lo stesso verdetto e lo stesso compositore del dato vero, su dati scritti qui. La radice di prova si compone qui,
    a pezzi: scritta intera, il rilevatore dei percorsi assoluti la troverebbe in questo file su un'unita' che si trovi
    proprio li'."""
    r = forma_editor(pathlib.PureWindowsPath("C:\\", "Temp", "una" + "  " + "copia", "MyDev"))
    p = {"publisher": "MS-CEINTL", "name": "vscode-language-pack-it", "version": "1.131.0",
         "contributes": {"localizations": [{"languageId": "it", "localizedLanguageName": "italiano",
                                            "translations": [{"id": "vscode", "path": "./translations/main.i18n.json"}]}]}}
    t = componi(r, {"ms-ceintl.vscode-language-pack-it-1.131.0": p})
    # Il testo misurato dell'editor; la radice vi entra con le barre raddoppiate a mano, non dal compositore.
    atteso = ('{"it":{"hash":"8bb7ca527193098d6cf50c300425bd92","extensions":[{"extensionIdentifier":{"id":"ms-ceintl.vscode-language-pack-it"},"version":"1.131.0"}],'
              '"translations":{"vscode":"@R@\\\\vscodium\\\\data\\\\extensions\\\\ms-ceintl.vscode-language-pack-it-1.131.0\\\\translations\\\\main.i18n.json"},"label":"italiano"}}')
    disco = forma_editor(pathlib.PureWindowsPath("E:\\"))
    t_disco = componi(disco, {"ms-ceintl.vscode-language-pack-it-1.131.0": p})

    def cache(radice):
        return json.dumps({"vscode": radice + "\\vscodium\\data\\extensions\\x\\main.i18n.json"})
    altra = forma_editor(pathlib.PureWindowsPath("C:\\", "Temp", "altra" + "  " + "copia", "MyDev"))
    casi = [
        ("il file dell'editor, con l'impronta misurata", t == atteso.replace("@R@", r.replace("\\", "\\\\"))),
        ("nessun pacchetto: nessun file", componi(r, {}) is None),
        ("cache della stessa radice: resta", not da_togliere(r, cache(r))),
        ("cache della stessa radice, maiuscole diverse: resta", not da_togliere(r, cache(r.upper()))),
        ("cache di un'altra radice: tolta", da_togliere(r, cache(altra))),
        ("cache di una radice che comincia con questa: tolta", da_togliere(r, cache(r + "2"))),
        ("cache di una radice piu' profonda (questa ne e' antenata): tolta", da_togliere(r, cache(r + "\\MyDev"))),
        ("cache senza tcf.json: tolta", da_togliere(r, None)),
        ("radice di un disco: senza barra finale", disco == "e:"),
        ("radice di un disco: il file dell'editor con una barra sola", t_disco == atteso.replace("@R@", "e:")),
        ("radice di un disco: la sua cache resta", not da_togliere(disco, cache(disco))),
        ("radice di un disco: la cache di una cartella del disco e' tolta", da_togliere(disco, cache(disco + "\\MyDev"))),
    ]
    for nome, ok in casi:
        print(f"  sonda {'OK' if ok else 'ROTTA'}: {nome}")
    rotte = sum(1 for _, ok in casi if not ok)
    print(f"sonde: {len(casi) - rotte} su {len(casi)}")
    print("ESITO: " + ("VERDE" if rotte == 0 else "ROSSO"))
    return 0 if rotte == 0 else 1


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    try:
        if "--sonde" in sys.argv[1:]:
            sys.exit(sonde())
        sys.exit(prepara(pathlib.Path(os.path.abspath(__file__)).parent.parent))
    except SystemExit:
        raise
    except BaseException as e:  # 2 anche sull'eccezione: un 1 si leggerebbe come un rosso
        print(f"FERMO: eccezione {e.__class__.__name__}: {e}")
        print("ESITO: FERMO")
        sys.exit(2)

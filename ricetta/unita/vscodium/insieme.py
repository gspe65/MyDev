"""L'insieme garantito delle estensioni dell'editor dell'unita': che cosa c'e' davanti a che cosa unita.json dichiara.

    <unita>\\python\\pythonw.exe -I -B <unita>\\vscodium\\insieme.py              a ogni avvio: lo fanno VSCodium.exe e il .bat
    <unita>\\python\\python.exe -I -B <unita>\\vscodium\\insieme.py --verifica    lo stesso confronto, solo stampato
    <unita>\\python\\python.exe -I -B <unita>\\vscodium\\insieme.py --scrivi <id=versione>...
                                                  il costruttore: scrive extensions.allowed e stampa il campo estensioni
    <unita>\\python\\python.exe -I -B <unita>\\vscodium\\insieme.py --sonde       il verdetto su dati sbagliati, senza scrivere

Si confrontano, col campo "estensioni" di unita.json:
- le cartelle di vscodium\\data\\extensions (nome e versione dal loro package.json), tolte quelle che l'editor ha
  segnato in .obsolete (una disinstallazione lascia la cartella fino all'avvio dopo);
- l'impronta sha256 di vscodium\\resources\\app\\product.json;
- extensions.allowed nelle impostazioni dell'utente dell'editor, che deve dire le stesse estensioni alle stesse versioni.
Se qualcosa non torna, all'avvio una finestra dice che cosa e' cambiato, che MyDev non garantisce piu' l'unita' e come
tornare a quella garantita; l'editor parte lo stesso. Sull'unita' intatta, nessuna finestra.
La radice si ricava dalla posizione di questo file, mai dalla cartella di lavoro. Nulla si scrive fuori dall'unita'.

Uscite: 0 uguale (o scritto), 1 diverso (o rosso del costruttore, o sonde rotte), 2 fermo (non si e' potuto leggere).

Che cosa NON guarda: le estensioni disattivate (lo stato sta nel database dell'editor, non nelle cartelle); i file
dentro una cartella di estensione con nome e versione giusti (lo dice ricetta\\verifica.ps1); extensions.json; il resto
delle impostazioni.
"""
import ctypes
import hashlib
import json
import os
import pathlib
import sys

TITOLO = "MyDev - l'editor non e' piu' quello garantito"


def fermo(m):
    print(f"FERMO: {m}")
    print("ESITO: FERMO")
    sys.exit(2)


def leggi_json(p):
    return json.loads(p.read_text(encoding="utf-8-sig"))


def installate(radice):
    """{id minuscolo: versione} delle cartelle di estensione, tolte quelle segnate in .obsolete."""
    est = radice / "vscodium" / "data" / "extensions"
    obsolete = set()
    f = est / ".obsolete"
    if f.is_file():
        try:
            obsolete = {k for k, v in leggi_json(f).items() if v}
        except ValueError:
            obsolete = set()
    trovate = {}
    if est.is_dir():
        for d in sorted(est.iterdir()):
            m = d / "package.json"
            if not d.is_dir() or d.name in obsolete:
                continue
            if not m.is_file():
                trovate[f"(cartella senza package.json) {d.name}"] = "?"
                continue
            try:
                p = leggi_json(m)
                trovate[f"{p['publisher']}.{p['name']}".lower()] = str(p["version"])
            except (ValueError, KeyError):
                trovate[f"(package.json illeggibile) {d.name}"] = "?"
    return trovate


def impronta(p):
    return hashlib.sha256(p.read_bytes()).hexdigest() if p.is_file() else None


def consentite(radice):
    """extensions.allowed delle impostazioni, None se manca o non si legge."""
    f = radice / "vscodium" / "data" / "user-data" / "User" / "settings.json"
    try:
        v = leggi_json(f).get("extensions.allowed")
    except (OSError, ValueError, AttributeError):
        return None
    return v if isinstance(v, dict) else None


def giudica(dichiarato, viste, prodotto, ammesse):
    """Il verdetto, uguale per il dato vero e per le sonde: l'elenco delle differenze, in parole."""
    if not isinstance(dichiarato, dict) or not isinstance(dichiarato.get("insieme"), dict) or "prodotto" not in dichiarato:
        return ["unita.json manca, o non dichiara l'insieme delle estensioni"]
    att = dichiarato["insieme"]
    d = []
    for k in sorted(set(att) | set(viste)):
        if k not in viste:
            d.append(f"manca l'estensione {k} {att[k]}")
        elif k not in att:
            d.append(f"estensione in piu': {k} {viste[k]}")
        elif viste[k] != att[k]:
            d.append(f"estensione {k}: versione {viste[k]} invece di {att[k]}")
    if prodotto != dichiarato["prodotto"]:
        d.append("vscodium\\resources\\app\\product.json e' cambiato" if prodotto else "manca vscodium\\resources\\app\\product.json")
    if ammesse != {k: [v] for k, v in att.items()}:
        d.append("l'impostazione extensions.allowed, che blocca le installazioni fuori dall'insieme, e' stata tolta o cambiata "
                 "(o settings.json non si legge piu' come JSON)")
    return d


def confronta(radice):
    try:
        dichiarato = leggi_json(radice / "unita.json").get("estensioni")
    except (OSError, ValueError, AttributeError):
        dichiarato = None
    return giudica(dichiarato, installate(radice), impronta(radice / "vscodium" / "resources" / "app" / "product.json"), consentite(radice))


def testo_avviso(diff):
    return ("L'editor di questa unita' non e' piu' quello che MyDev ha provato.\n\n"
            "Che cosa e' cambiato:\n" + "\n".join(f"- {x}" for x in diff) + "\n\n"
            "L'editor parte lo stesso, ma MyDev non garantisce piu' che l'unita' funzioni come e' stata provata.\n\n"
            "Per tornare all'unita' garantita: disinstalla dal pannello Estensioni quelle aggiunte e rimetti i file cambiati, "
            "oppure usa una copia nuova dell'unita' (scaricata di nuovo, o costruita dalla ricetta). "
            "La guida, README.md nella cartella dell'unita', lo spiega nella sezione \"Le versioni\".")


def avvio(radice):
    diff = confronta(radice)
    if diff:
        # MB_OK | MB_ICONWARNING | MB_SETFOREGROUND | MB_TOPMOST: davanti all'editor che si sta aprendo.
        ctypes.windll.user32.MessageBoxW(None, testo_avviso(diff), TITOLO, 0x0 | 0x30 | 0x10000 | 0x40000)
        return 1
    return 0


def verifica(radice):
    diff = confronta(radice)
    viste = installate(radice)
    print(f"estensioni nelle cartelle: {len(viste)} ({', '.join(f'{k}@{v}' for k, v in viste.items())})")
    print(f"product.json: {impronta(radice / 'vscodium' / 'resources' / 'app' / 'product.json')}")
    a = consentite(radice)
    print(f"extensions.allowed: {'assente' if a is None else f'{len(a)} voci'}")
    for x in diff:
        print(f"DIVERSO: {x}")
    print(f"differenze: {len(diff)}")
    if not viste:
        fermo("nessuna estensione nelle cartelle: il confronto non dice nulla")
    print("ESITO: " + ("ROSSO" if diff else "VERDE"))
    return 1 if diff else 0


def scrivi(radice, attese):
    """Il costruttore: le cartelle installate devono essere quelle dell'elenco dei componenti, alle stesse versioni."""
    att = {}
    for a in attese:
        k, _, v = a.partition("=")
        if not k or not v:
            fermo(f"voce attesa senza versione: {a}")
        att[k.lower()] = v
    viste = installate(radice)
    if viste != att:
        for k in sorted(set(att) | set(viste)):
            if att.get(k) != viste.get(k):
                print(f"DIVERSO: {k}: installata {viste.get(k)}, nell'elenco {att.get(k)}")
        print("ESITO: ROSSO")
        return 1
    f = radice / "vscodium" / "data" / "user-data" / "User" / "settings.json"
    imp = leggi_json(f)
    if "extensions.allowed" in imp:
        print("ROSSO: extensions.allowed e' gia' nelle impostazioni: la scrive solo il costruttore")
        print("ESITO: ROSSO")
        return 1
    imp["extensions.allowed"] = {k: [v] for k, v in viste.items()}
    f.write_text(json.dumps(imp, ensure_ascii=False, indent=2) + "\n", encoding="utf-8", newline="\n")
    campo = {"insieme": viste, "prodotto": impronta(radice / "vscodium" / "resources" / "app" / "product.json")}
    if campo["prodotto"] is None:
        fermo("manca product.json")
    print(f"extensions.allowed: {len(viste)} voci scritte")
    print("ESTENSIONI: " + json.dumps(campo, separators=(",", ":")))
    print("ESITO: FATTO")
    return 0


def sonde():
    """Una sonda per ogni ramo del verdetto, con giudica: quella del dato vero."""
    att = {"a.uno": "1.0.0", "b.due": "2.0.0"}
    dich = {"insieme": att, "prodotto": "abc"}
    amm = {k: [v] for k, v in att.items()}
    casi = [
        ("intatta: nessuna differenza", giudica(dich, dict(att), "abc", amm) == []),
        ("estensione in piu'", any("in piu': c.tre" in x for x in giudica(dich, {**att, "c.tre": "1"}, "abc", amm))),
        ("estensione mancante", any("manca l'estensione b.due" in x for x in giudica(dich, {"a.uno": "1.0.0"}, "abc", amm))),
        ("versione cambiata", any("b.due: versione 2.0.1" in x for x in giudica(dich, {"a.uno": "1.0.0", "b.due": "2.0.1"}, "abc", amm))),
        ("product.json cambiato", any("product.json e' cambiato" in x for x in giudica(dich, dict(att), "abd", amm))),
        ("product.json mancante", any("manca vscodium" in x for x in giudica(dich, dict(att), None, amm))),
        ("extensions.allowed tolta", any("extensions.allowed" in x for x in giudica(dich, dict(att), "abc", None))),
        ("extensions.allowed allargata", any("extensions.allowed" in x for x in giudica(dich, dict(att), "abc", {**amm, "c.tre": ["1"]}))),
        ("unita.json senza il campo", any("unita.json" in x for x in giudica(None, dict(att), "abc", amm))),
    ]
    for nome, ok in casi:
        print(f"  sonda {'OK' if ok else 'ROTTA'}: {nome}")
    rotte = sum(1 for _, ok in casi if not ok)
    print(f"sonde: {len(casi) - rotte} su {len(casi)}")
    print("ESITO: " + ("VERDE" if rotte == 0 else "ROSSO"))
    return 0 if rotte == 0 else 1


if __name__ == "__main__":
    if sys.stdout is None:  # pythonw: nessuna console
        sys.stdout = open(os.devnull, "w", encoding="utf-8")
    else:
        sys.stdout.reconfigure(encoding="utf-8")
    radice = pathlib.Path(os.path.abspath(__file__)).parent.parent
    argomenti = sys.argv[1:]
    try:
        if "--sonde" in argomenti:
            sys.exit(sonde())
        if "--verifica" in argomenti:
            sys.exit(verifica(radice))
        if argomenti[:1] == ["--scrivi"]:
            sys.exit(scrivi(radice, argomenti[1:]))
        if argomenti:
            fermo(f"argomento sconosciuto: {argomenti[0]}")
        sys.exit(avvio(radice))
    except SystemExit:
        raise
    except BaseException as e:  # 2 anche sull'eccezione: un 1 si leggerebbe come un rosso
        print(f"FERMO: eccezione {e.__class__.__name__}: {e}")
        print("ESITO: FERMO")
        if not argomenti:  # all'avvio un controllo che non riesce non deve tacere
            ctypes.windll.user32.MessageBoxW(None, testo_avviso([f"il controllo delle estensioni non e' riuscito ({e.__class__.__name__}: {e})"]),
                                             TITOLO, 0x0 | 0x30 | 0x10000 | 0x40000)
        sys.exit(2)

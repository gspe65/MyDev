"""L'insieme garantito delle estensioni dell'editor dell'unita': che cosa c'e' davanti a che cosa unita.json dichiara.

    <unita>\\python\\pythonw.exe -I -B <unita>\\vscodium\\insieme.py              a ogni avvio: lo fanno VSCodium.exe e il .bat
    <unita>\\python\\python.exe -I -B <unita>\\vscodium\\insieme.py --verifica    lo stesso confronto, solo stampato
    <unita>\\python\\python.exe -I -B <unita>\\vscodium\\insieme.py --scrivi <id=versione>...
                                                  il costruttore: scrive extensions.allowed e stampa il campo estensioni
    <unita>\\python\\python.exe -I -B <unita>\\vscodium\\insieme.py --sonde       il verdetto su dati sbagliati, senza scrivere
                                                  nell'unita' (le cartelle finte in una temporanea, tolta alla fine)

Si confrontano, col campo "estensioni" di unita.json:
- le cartelle di vscodium\\data\\extensions (nome e versione dal loro package.json), tolte quelle che l'editor ha
  segnato in .obsolete (una disinstallazione lascia la cartella fino all'avvio dopo);
- l'impronta sha256 di vscodium\\resources\\app\\product.json;
- extensions.allowed nelle impostazioni dell'utente dell'editor, che deve dire le stesse estensioni alle stesse versioni.
  Le impostazioni si leggono come le legge l'editor, che accetta commenti (// e /* */) e virgole finali: tolti gli uni
  e le altre fuori dalle stringhe, il resto deve essere JSON; un file vuoto o di soli commenti e' un oggetto vuoto, come
  per l'editor. Impostazioni che non si leggono (col motivo: la riga dell'errore, il commento /* mai chiuso) e
  impostazione tolta sono due differenze diverse, con due frasi diverse.
Se qualcosa non torna, all'avvio una finestra dice che cosa e' cambiato, che MyDev non garantisce piu' l'unita' e come
tornare a quella garantita; l'editor parte lo stesso. Sull'unita' intatta, nessuna finestra.
La radice si ricava dalla posizione di questo file, mai dalla cartella di lavoro. Nulla si scrive fuori dall'unita',
se non la cartella temporanea delle sonde.

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
import tempfile

# I testi della finestra hanno gli accenti veri: il file si legge come UTF-8 (la codifica dei sorgenti di Python 3) e
# MessageBoxW riceve le stringhe in UTF-16, senza passare da una code page.
TITOLO = "MyDev - l'editor non è più quello garantito"


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


def salta(testo, i):
    """La posizione del primo carattere da i in poi che non sia spazio o commento."""
    n = len(testo)
    while i < n:
        if testo[i] in " \t\r\n":
            i += 1
        elif testo.startswith("//", i):
            j = testo.find("\n", i)
            i = n if j < 0 else j
        elif testo.startswith("/*", i):
            j = testo.find("*/", i + 2)
            i = n if j < 0 else j + 2
        else:
            break
    return i


def spazi(pezzo):
    """Un pezzo tolto dal testo, fatto di spazi con gli stessi a capo: righe e colonne di un errore restano quelle del file."""
    return "".join(c if c == "\n" else " " for c in pezzo)


class CommentoAperto(ValueError):
    """Un commento /* che il testo non chiude mai."""


def leggi_jsonc(testo):
    """Il testo come lo legge l'editor: commenti // e /* */ e virgole finali prima di } e ] tolti fuori dalle stringhe,
    il resto letto come JSON stretto (ValueError se non lo e'). Un testo vuoto o di soli commenti e spazi e' un oggetto
    vuoto, come per l'editor; un /* mai chiuso e' CommentoAperto, con la sua riga."""
    fuori, i, n = [], 0, len(testo)
    while i < n:
        c = testo[i]
        if c == '"':
            j = i + 1
            while j < n and testo[j] != '"':
                j += 2 if testo[j] == "\\" else 1
            fuori.append(testo[i:j + 1])
            i = j + 1
        elif testo.startswith("//", i):
            j = testo.find("\n", i)
            j = n if j < 0 else j
            fuori.append(spazi(testo[i:j]))
            i = j
        elif testo.startswith("/*", i):
            j = testo.find("*/", i + 2)
            if j < 0:
                raise CommentoAperto(f"il commento aperto con /* alla riga {testo.count(chr(10), 0, i) + 1} non è chiuso da */")
            fuori.append(spazi(testo[i:j + 2]))
            i = j + 2
        elif c == "," and salta(testo, i + 1) < n and testo[salta(testo, i + 1)] in "}]":
            fuori.append(" ")
            i += 1
        else:
            fuori.append(c)
            i += 1
    pulito = "".join(fuori)
    if not pulito.strip(" \t\r\n"):
        return {}
    return json.loads(pulito)


class Illeggibili:
    """Le impostazioni dell'utente che non si leggono, col motivo: una differenza diversa da extensions.allowed tolta."""

    def __init__(self, motivo):
        self.motivo = motivo


def consentite_da_testo(testo):
    """extensions.allowed dal testo delle impostazioni: il valore, None se tolta, Illeggibili se il testo non si legge."""
    try:
        imp = leggi_jsonc(testo)
    except CommentoAperto as e:
        return Illeggibili(str(e))
    except json.JSONDecodeError as e:
        return Illeggibili(f"errore di scrittura alla riga {e.lineno}, colonna {e.colno}")
    except ValueError as e:
        return Illeggibili(f"il testo non è JSON: {e}")
    if not isinstance(imp, dict):
        return Illeggibili("il testo non è un oggetto tra parentesi graffe { }")
    return imp.get("extensions.allowed")


def consentite(radice):
    """extensions.allowed delle impostazioni dell'unita': None se il file o la chiave mancano, Illeggibili se non si legge."""
    f = radice / "vscodium" / "data" / "user-data" / "User" / "settings.json"
    if not f.is_file():
        return None
    try:
        testo = f.read_text(encoding="utf-8-sig")
    except UnicodeDecodeError:
        return Illeggibili("il file non è testo UTF-8")
    except (OSError, ValueError) as e:
        return Illeggibili(f"il file non si apre: {e.__class__.__name__}")
    return consentite_da_testo(testo)


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
            d.append(f"estensione in più: {k} {viste[k]}")
        elif viste[k] != att[k]:
            d.append(f"estensione {k}: versione {viste[k]} invece di {att[k]}")
    if prodotto != dichiarato["prodotto"]:
        d.append("vscodium\\resources\\app\\product.json è cambiato" if prodotto else "manca vscodium\\resources\\app\\product.json")
    if isinstance(ammesse, Illeggibili):
        d.append(f"le impostazioni dell'utente (vscodium\\data\\user-data\\User\\settings.json) non si leggono ({ammesse.motivo}): "
                 "non si può controllare l'impostazione extensions.allowed, che blocca le installazioni fuori dall'insieme")
    elif ammesse is None:
        d.append("l'impostazione extensions.allowed, che blocca le installazioni fuori dall'insieme, è stata tolta")
    elif ammesse != {k: [v] for k, v in att.items()}:
        d.append("l'impostazione extensions.allowed, che blocca le installazioni fuori dall'insieme, è stata cambiata")
    return d


def confronta(radice):
    try:
        dichiarato = leggi_json(radice / "unita.json").get("estensioni")
    except (OSError, ValueError, AttributeError):
        dichiarato = None
    return giudica(dichiarato, installate(radice), impronta(radice / "vscodium" / "resources" / "app" / "product.json"), consentite(radice))


def testo_avviso(diff):
    return ("L'editor di questa unità non è più quello che MyDev ha provato.\n\n"
            "Che cosa è cambiato:\n" + "\n".join(f"- {x}" for x in diff) + "\n\n"
            "L'editor parte lo stesso, ma MyDev non garantisce più che l'unità funzioni come è stata provata.\n\n"
            "Per tornare all'unità garantita: disinstalla dal pannello Estensioni quelle aggiunte e rimetti i file cambiati, "
            "oppure usa una copia nuova dell'unità (scaricata di nuovo, o costruita dalla ricetta). "
            "La guida, README.md nella cartella dell'unità, lo spiega nella sezione \"Le versioni\".")


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
    stato = ("assente" if a is None else f"impostazioni illeggibili ({a.motivo})" if isinstance(a, Illeggibili)
             else f"{len(a)} voci" if isinstance(a, dict) else "non e' un oggetto")
    print(f"extensions.allowed: {stato}")
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


def sonde_cartelle():
    """Le sonde di installate(), quella del dato vero, su una cartella extensions finta: sta in una cartella temporanea
    del sistema, mai nell'unita', ed e' tolta alla fine."""
    with tempfile.TemporaryDirectory(prefix="mydev-insieme-sonde-") as t:
        radice = pathlib.Path(t)
        est = radice / "vscodium" / "data" / "extensions"

        def metti(rel, testo):
            p = est / rel
            p.parent.mkdir(parents=True, exist_ok=True)
            p.write_text(testo, encoding="utf-8")

        metti("a.uno-1.0.0/package.json", json.dumps({"publisher": "A", "name": "Uno", "version": "1.0.0"}))
        metti("b.due-2.0.0/package.json", json.dumps({"publisher": "b", "name": "due", "version": "2.0.0"}))
        metti(".obsolete", json.dumps({"b.due-2.0.0": True}))
        metti("vuota-1.0.0/LEGGIMI.txt", "nessun package.json")
        metti("rotta-1.0.0/package.json", "{ non e' JSON")
        metti("senza-nome-1.0.0/package.json", json.dumps({"version": "1.0.0"}))
        metti("extensions.json", "[]")
        viste = installate(radice)
        dich = {"insieme": {"a.uno": "1.0.0"}, "prodotto": "abc"}
        verdetto = giudica(dich, viste, "abc", {"a.uno": ["1.0.0"]})
        metti(".obsolete", "{ non e' JSON")
        senza_obsolete = installate(radice)
    return [
        ("cartelle: nome e versione dal package.json, nome in minuscolo", viste.get("a.uno") == "1.0.0"),
        ("cartelle: quella segnata in .obsolete non si conta", "b.due" not in viste),
        ("cartelle: una cartella senza package.json si conta", viste.get("(cartella senza package.json) vuota-1.0.0") == "?"),
        ("cartelle: un package.json illeggibile si conta", viste.get("(package.json illeggibile) rotta-1.0.0") == "?"),
        ("cartelle: un package.json senza nome si conta come illeggibile", viste.get("(package.json illeggibile) senza-nome-1.0.0") == "?"),
        ("cartelle: un file accanto alle cartelle non e' un'estensione, e non ce ne sono altre", len(viste) == 4),
        ("cartelle: la cartella senza package.json e' un'estensione in piu' nel verdetto",
         any("in più: (cartella senza package.json) vuota-1.0.0" in x for x in verdetto)),
        ("cartelle: .obsolete illeggibile, la cartella che segnava si conta", senza_obsolete.get("b.due") == "2.0.0"),
    ]


def sonde():
    """Una sonda per ogni ramo del verdetto, con giudica: quella del dato vero; e i rami delle cartelle, con installate."""
    att = {"a.uno": "1.0.0", "b.due": "2.0.0"}
    dich = {"insieme": att, "prodotto": "abc"}
    amm = {k: [v] for k, v in att.items()}
    # Le impostazioni come testo, lette dallo stesso lettore del dato vero.
    a_json = json.dumps(amm)
    con_commento = '{\n  // nota di chi usa l\'unita\'\n  /* un blocco\n     di due righe */ "editor.fontSize": 14,\n  "extensions.allowed": ' + a_json + "\n}\n"
    con_virgole = '{\n  "extensions.allowed": {"a.uno": ["1.0.0"], "b.due": ["2.0.0"],},\n  "editor.fontSize": 14,\n}\n'
    con_stringa = '{"workbench.colorTheme": "x // non e\' un commento /* nemmeno questo", "extensions.allowed": ' + a_json + "}"
    senza_chiave = '{\n  // tolta\n  "editor.fontSize": 14,\n}\n'
    rotto = '{\n  "editor.fontSize": 14\n  "extensions.allowed": ' + a_json + "\n}\n"
    # L'errore alla riga 4 del file, dopo un commento di due righe e una virgola finale tolti.
    rotto_dopo_commento = '{\n  /* due\n     righe */ "editor.fontSize": [14,],\n  "extensions.allowed" ' + a_json + "\n}\n"
    vuoto = ""
    soli_commenti = "// solo una nota\n\n/* e un blocco\n   di due righe */\n  \t\n"
    aperto = '{\n  "editor.fontSize": 14,\n  /* aperto e mai chiuso\n  "extensions.allowed": ' + a_json + "\n}\n"
    tolta = giudica(dich, dict(att), "abc", consentite_da_testo(senza_chiave))
    illeggibile = giudica(dich, dict(att), "abc", consentite_da_testo(rotto))
    da_vuoto = giudica(dich, dict(att), "abc", consentite_da_testo(vuoto))
    da_commenti = giudica(dich, dict(att), "abc", consentite_da_testo(soli_commenti))
    da_aperto = giudica(dich, dict(att), "abc", consentite_da_testo(aperto))
    da_rotto_dopo = giudica(dich, dict(att), "abc", consentite_da_testo(rotto_dopo_commento))
    casi = [
        ("impostazioni con commenti: nessuna differenza", giudica(dich, dict(att), "abc", consentite_da_testo(con_commento)) == []),
        ("impostazioni con virgole finali: nessuna differenza", giudica(dich, dict(att), "abc", consentite_da_testo(con_virgole)) == []),
        ("// e /* dentro una stringa: non sono commenti", giudica(dich, dict(att), "abc", consentite_da_testo(con_stringa)) == []),
        ("extensions.allowed tolta dal testo", len(tolta) == 1 and "è stata tolta" in tolta[0]),
        ("impostazioni illeggibili, con una frase diversa da tolta e la riga dell'errore",
         len(illeggibile) == 1 and "non si leggono (errore di scrittura alla riga 3, colonna 3)" in illeggibile[0] and illeggibile != tolta),
        ("errore dopo un commento di due righe: la riga e la colonna sono quelle del file",
         len(da_rotto_dopo) == 1 and "non si leggono (errore di scrittura alla riga 4, colonna 24)" in da_rotto_dopo[0]),
        ("impostazioni vuote: extensions.allowed tolta, non illeggibili",
         len(da_vuoto) == 1 and "è stata tolta" in da_vuoto[0]),
        ("impostazioni di soli commenti e spazi: extensions.allowed tolta, non illeggibili",
         len(da_commenti) == 1 and "è stata tolta" in da_commenti[0]),
        ("commento /* mai chiuso: illeggibili, col motivo e la riga",
         len(da_aperto) == 1 and "non si leggono (il commento aperto con /* alla riga 3 non è chiuso da */)" in da_aperto[0]),
        ("intatta: nessuna differenza", giudica(dich, dict(att), "abc", amm) == []),
        ("estensione in piu'", any("in più: c.tre" in x for x in giudica(dich, {**att, "c.tre": "1"}, "abc", amm))),
        ("estensione mancante", any("manca l'estensione b.due" in x for x in giudica(dich, {"a.uno": "1.0.0"}, "abc", amm))),
        ("versione cambiata", any("b.due: versione 2.0.1" in x for x in giudica(dich, {"a.uno": "1.0.0", "b.due": "2.0.1"}, "abc", amm))),
        ("product.json cambiato", any("product.json è cambiato" in x for x in giudica(dich, dict(att), "abd", amm))),
        ("product.json mancante", any("manca vscodium" in x for x in giudica(dich, dict(att), None, amm))),
        ("extensions.allowed tolta", any("extensions.allowed" in x and "tolta" in x for x in giudica(dich, dict(att), "abc", None))),
        ("extensions.allowed allargata", any("extensions.allowed" in x and "cambiata" in x for x in giudica(dich, dict(att), "abc", {**amm, "c.tre": ["1"]}))),
        ("unita.json senza il campo", any("unita.json" in x for x in giudica(None, dict(att), "abc", amm))),
    ] + sonde_cartelle()
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
            ctypes.windll.user32.MessageBoxW(None, testo_avviso([f"il controllo delle estensioni non è riuscito ({e.__class__.__name__}: {e})"]),
                                             TITOLO, 0x0 | 0x30 | 0x10000 | 0x40000)
        sys.exit(2)

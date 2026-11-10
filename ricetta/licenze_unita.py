"""L'indice delle licenze di un'unita' costruita: per ogni componente la licenza, i testi interi dentro l'unita' e, per
chi ha una licenza che chiede i sorgenti, il sorgente alla stessa versione con la sua impronta.

Uso, col Python dell'unita' (ha zstd e lzma):
  <unita>\\python\\python.exe -I -B ricetta\\licenze_unita.py <unita>            verifica: atteso ESITO: VERDE
  <unita>\\python\\python.exe -I -B ricetta\\licenze_unita.py <unita> --scrivi   riscrive gli indici in ricetta/licenze/
  <unita>\\python\\python.exe -I -B ricetta\\licenze_unita.py <unita> --sonde    i guasti del controllo positivo, su copie in memoria

La variante la dice unita.json. La base ha ricetta/licenze/base/LICENZE.txt; l'estesa aggiunge
ricetta/licenze/estesa/LICENZE-ESTESA.txt, solo per i componenti dell'aggiunta, e su un'estesa si verificano tutti e due.
I testi che i pacchetti non portano stanno in ricetta/licenze/<variante>/licenze/ e arrivano nell'unita' in licenze/.

Uscite: 0 verde, 1 rosso, 2 fermo (non si e' potuto misurare).

Che cosa NON guarda:
- che la licenza dichiarata sia quella vera: si riporta quella del pacchetto, o quella letta nella sorgente e scritta in
  ricetta/licenze/voci.json col motivo;
- che un testo sia completo: si riconosce dalla sua intestazione, e un testo d'autore (MIT, BSD, ISC, custom) solo dalla
  frase che lo distingue o dall'essere del componente;
- i sorgenti stessi: si confrontano impronta e presenza nell'elenco, non il contenuto; li scarica ricetta/sorgenti.ps1;
  la versione si confronta per i pacchetti di MSYS, che la portano nel nome del sorgente; per gli altri vale il nome;
- le licenze dei file nati dall'uso (home, progetti, dati dell'editor);
- gli avvisi delle librerie incorporate nei programmi a file unico (jq, mkcert, gh, rust-analyzer, Neovim, le librerie
  di Chromium dentro l'editor oltre alla FFmpeg): si riporta il testo del programma, non quelli delle sue parti;
Gli indici e i testi di licenze/ nell'unita' si confrontano con quelli della ricetta; le sonde li alterano in memoria.
"""
import hashlib
import json
import pathlib
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
RADICE = pathlib.Path(__file__).resolve().parent.parent
RIC = RADICE / "ricetta"
LIC = RIC / "licenze"
argomenti = [a for a in sys.argv[1:] if not a.startswith("--")]
SCRIVI, SONDE = "--scrivi" in sys.argv, "--sonde" in sys.argv


def fermo(m: str) -> None:
    print(f"FERMO: {m}")
    print("ESITO: FERMO")
    sys.exit(2)


sys.excepthook = lambda t, v, tb: fermo(f"{t.__name__}: {v}")
if len(argomenti) != 1:
    fermo("uso: licenze_unita.py <unita> [--scrivi | --sonde]")
UNITA = pathlib.Path(argomenti[0])
if not (UNITA / "unita.json").exists():
    fermo(f"non e' un'unita': manca unita.json in {UNITA}")
VARIANTE = json.loads((UNITA / "unita.json").read_text(encoding="utf-8-sig"))["variante"]


def leggi(p: pathlib.Path):
    return json.loads(p.read_text(encoding="utf-8"))


BASE = leggi(RIC / "componenti.json")
AGG = leggi(RIC / "componenti-estesa.json")
VOCI = leggi(LIC / "voci.json")
SORGENTI = leggi(RIC / "sorgenti.json")
INDICI = {"base": (LIC / "base" / "LICENZE.txt", BASE), "estesa": (LIC / "estesa" / "LICENZE-ESTESA.txt", AGG)}

# --- Il riconoscimento dei testi: l'intestazione per le licenze uguali per tutti, la frase tipica per quelle d'autore.
CANONICHE = {
    "GPL-1.0": r"gnu general public license version 1, february 1989",
    "GPL-2.0": r"gnu general public license version 2, june 1991",
    "GPL-3.0": r"gnu general public license version 3, 29 june 2007",
    "LGPL-2.0": r"gnu library general public license version 2, june 1991",
    "LGPL-2.1": r"gnu lesser general public license version 2\.1, february 1999",
    "LGPL-3.0": r"gnu lesser general public license version 3, 29 june 2007",
    "AGPL-3.0": r"gnu affero general public license version 3, 19 november 2007",
    "GFDL-1.3": r"gnu free documentation license version 1\.3",
    "Apache-2.0": r"apache license,? version 2\.0, january 2004",
    "MPL-2.0": r"mozilla public license,? version 2\.0",
    "MPL-1.1": r"mozilla public license,? version 1\.1",
    "Artistic-1.0": r"the \"artistic license\"",
    "Artistic-2.0": r"the artistic license 2\.0",
    "CC0-1.0": r"cc0 1\.0 universal",
    "CC-BY-4.0": r"attribution 4\.0 international",
    "EPL-2.0": r"eclipse public license - v 2\.0",
    "PSF-2.0": r"python software foundation license version 2",
    "GCC-exception-3.1": r"gcc runtime library exception version 3\.1",
    "LLVM-exception": r"llvm exceptions to the apache 2\.0 license",
}
D_AUTORE = {
    # La SIL Open Font License apre con la stessa frase della MIT: si riconosce dal suo nome, e lì la MIT non vale.
    "OFL-1.1": r"sil open font license,? version 1\.1",
    "Zlib": r"this software is provided 'as-is', without any express or implied\s+warranty\. in no event will the authors be held liable",
    "MIT": r"permission is hereby granted, free of charge",
    "BSD": r"redistribution and use in source and binary forms",
    "ISC": r"permission to use, copy, modify, and(/or)? distribute this software for any purpose",
    "0BSD": r"permission to use, copy, modify, and/or distribute this software for any purpose",
}
# Le licenze che chiedono di dare i sorgenti a chi riceve il programma. Si cercano anche dentro un identificatore con
# lo spazio dei nomi (LicenseRef-libgit2-GPL-2.0-with-linking-exception), non solo in testa.
COPYLEFT = re.compile(r"(?:^|-)(A?GPL|LGPL|MPL|EPL)-")
# Il nome di un testo di licenza: in testa (LICENSE, COPYING.txt) o come parola del nome (OpenSSL.LICENSE,
# OPEN-SANS-LICENSE.txt, extension.js.LICENSE.txt); un file di codice o di documentazione col nome dentro non lo e'.
NOME_TESTO = re.compile(r"^(licen[csz]e|copying|notice|copyright|thirdpartynotices|third_party_notices|unlicense|artistic|licenses\.chromium)", re.I)
NOME_TESTO_DENTRO = re.compile(r"(?:^|[._-])(licen[csz]e|copying|notice|copyright)(?:[._-]|$)", re.I)
NON_TESTO = re.compile(r"\.(js|mjs|cjs|ts|py|pyi|pyc|json|html?|css|map|c|h|rs|lua|vim|sh|ps1|dll|exe|rst)$", re.I)


def nome_di_testo(n: str) -> bool:
    if NOME_TESTO.match(n):
        return True
    return bool(NOME_TESTO_DENTRO.search(n)) and (not NON_TESTO.search(n) or bool(re.search(r"licen[cs]e\.txt$", n, re.I)))


def famiglia(i: str) -> str:
    """GPL-3.0-or-later -> GPL-3.0; Artistic-1.0-Perl -> Artistic-1.0; BSD-3-Clause -> BSD."""
    i = re.sub(r"(-only|-or-later|\+)$", "", i)
    if i.startswith("Artistic-1.0"):
        return "Artistic-1.0"
    if i.startswith("BSD-") or i == "BSD":
        return "BSD"
    return i


def etichette(testo: str) -> set[str]:
    # Un testo dentro un commento (Berkeley DB: « * » in testa a ogni riga) si legge senza i segni del commento.
    t = re.sub(r"(?m)^[ \t]*(\*|#|//|;|--)+[ \t]?", " ", testo.lower())
    t = re.sub(r"\s+", " ", t)
    trovate = {k for k, r in {**CANONICHE, **D_AUTORE}.items() if re.search(r, t)}
    if "OFL-1.1" in trovate:
        trovate.discard("MIT")
    return trovate


# --- Le espressioni: OR, AND, WITH, parentesi.
OPERATORI = {"AND", "OR", "WITH", "(", ")"}
# Gli identificatori SPDX che non cominciano con una maiuscola si elencano: una regola piu' larga farebbe passare le
# parole di una dichiarazione in prosa («MIT per il codice»).
IDENTIFICATORE = re.compile(r"^(LicenseRef-[\w.-]+|[A-Z][A-Za-z0-9.+-]*|0BSD|curl|bzip2-1\.0\.6)$")


def gettoni(e: str) -> list[str]:
    g = re.findall(r"\(|\)|[^\s()]+", e)
    for x in g:
        if x not in OPERATORI and not IDENTIFICATORE.match(x):
            raise ValueError(f"'{x}' non e' un identificatore di licenza")
    return g


def valuta(g: list[str], coperto) -> tuple[bool, list[str]]:
    """Ritorna (coperta, parti scoperte). OR: basta una; AND e WITH: tutte."""
    pos = 0

    def espr():
        nonlocal pos
        ok, sc = termine()
        while pos < len(g) and g[pos] == "OR":
            pos += 1
            ok2, sc2 = termine()
            ok, sc = ok or ok2, ([] if (ok or ok2) else sc + sc2)
        return ok, sc

    def termine():
        nonlocal pos
        ok, sc = fattore()
        while pos < len(g) and g[pos] == "AND":
            pos += 1
            ok2, sc2 = fattore()
            ok, sc = ok and ok2, sc + sc2
        return ok, sc

    def fattore():
        nonlocal pos
        if g[pos] == "(":
            pos += 1
            r = espr()
            pos += 1
            return r
        ident = g[pos]
        pos += 1
        ok, sc = coperto(ident), ([] if coperto(ident) else [ident])
        if pos < len(g) and g[pos] == "WITH":
            ecc = g[pos + 1]
            pos += 2
            if not coperto(ecc):
                ok, sc = False, sc + [ecc]
        return ok, sc

    r = espr()
    if pos != len(g):
        raise ValueError("espressione non chiusa")
    return r


def identificatori(e: str) -> list[str]:
    return [x for x in gettoni(e) if x not in OPERATORI]


# --- I testi di ogni componente, trovati nell'unita'.
def db_pacman() -> dict[str, list[str]]:
    voci: dict[str, list[str]] = {}
    loc = UNITA / "msys64/var/lib/pacman/local"
    for d in loc.iterdir():
        if (d / "files").exists():
            parti = (d / "files").read_text(encoding="utf-8").split("\n\n")
            file = next((b.strip().split("\n")[1:] for b in parti if b.strip().startswith("%FILES%")), [])
            voci[d.name] = [f for f in file if not f.endswith("/")]
    return voci


def testi_trovati(c: dict, db: dict, destinazioni: list[str]) -> list[str]:
    voce = VOCI["componenti"].get(c["nome"], {})
    if c["gruppo"] == "msys":
        chiave = f"{c['nome'][5:]}-{c['versione']}"
        if chiave not in db:
            return ["!non registrato da pacman: " + chiave]
        return sorted(f"msys64/{f}" for f in db[chiave] if (nome_di_testo(f.rsplit("/", 1)[-1]) or f.startswith("usr/share/licenses/")) and (UNITA / "msys64" / f).is_file())
    trovati = []
    for dest in voce.get("cerca", c.get("destinazioni", [])):
        radice = UNITA / dest
        if not radice.is_dir():
            continue
        if c["gruppo"] == "pip":
            n = c["nome"][4:].lower().replace("_", "-")
            radici = [d for d in radice.glob("*.dist-info") if d.name.lower().replace("_", "-").startswith(f"{n}-{c['versione'].lower()}")]
        elif c["gruppo"] == "estensioni":
            radici = [d for d in radice.iterdir() if d.name.lower().startswith(c["nome"].split("/", 1)[1].lower() + "-")]
        else:
            radici = [radice]
        dentro = [d + "/" for d in destinazioni if d != dest and d.startswith(dest + "/")] + ["vscodium/data/"]
        for r in radici:
            for f in r.rglob("*"):
                rel = f.relative_to(UNITA).as_posix()
                if f.is_file() and nome_di_testo(f.name) and (c["gruppo"] in ("pip", "estensioni") or not any(rel.startswith(x) for x in dentro)):
                    trovati.append(rel)
    return sorted(trovati)


NOSTRI_FILE = {c["destinazioni"][0]: RADICE / c["percorso"] for e in (BASE, AGG) for c in e["nostri"] if (RADICE / c["percorso"]).is_file()}


def basi_pacman() -> dict[str, str]:
    """La sorgente di ogni pacchetto di MSYS (%BASE% del database): i testi presi dalla sorgente stanno sotto quel nome."""
    basi = {}
    for d in (UNITA / "msys64/var/lib/pacman/local").iterdir():
        if (d / "desc").exists():
            t = (d / "desc").read_text(encoding="utf-8")
            nome = t.split("%NAME%\n", 1)[1].split("\n", 1)[0]
            basi["msys/" + nome] = t.split("%BASE%\n", 1)[1].split("\n", 1)[0] if "%BASE%" in t else nome
    return basi


def leggi_testo(rel: str, dati: dict) -> bytes | None:
    if rel in dati["alterati"]:
        return dati["alterati"][rel]
    if rel in NOSTRI_FILE:
        return NOSTRI_FILE[rel].read_bytes()
    if rel.startswith("licenze/"):
        for v in ("base", "estesa"):
            p = LIC / v / rel
            if p.is_file():
                return p.read_bytes()
    p = UNITA / rel
    return p.read_bytes() if p.is_file() else None


# --- La composizione di un indice e il verdetto: una funzione sola, attraversata dal dato vero e da quello alterato.
def componi(elenco: dict, dati: dict, difetti: list[str]) -> str:
    db = dati["db"]
    destinazioni = [d for e in (BASE, AGG) for c in e["scaricati"] for d in c["destinazioni"]]
    canonici = dati["voci"]["canonici"]
    sorgenti_di: dict[str, list[dict]] = {}
    for s in SORGENTI["sorgenti"]:
        for n in s["componenti"]:
            sorgenti_di.setdefault(n, []).append(s)
    # L'altro verso: un sorgente che nomina un componente che non c'e' piu' resterebbe nell'elenco senza ragione.
    noti = {c["nome"] for e in (BASE, AGG) for k in ("scaricati", "nostri") for c in e.get(k, [])}
    for n in sorted(set(sorgenti_di) - noti):
        difetti.append(f"ricetta/sorgenti.json: {n} non e' un componente di nessuna delle due varianti")
    cache: dict[str, tuple[str, set[str]]] = {}

    def info(rel: str) -> tuple[str, set[str]] | None:
        if rel not in cache:
            b = leggi_testo(rel, dati)
            if b is None:
                return None
            cache[rel] = (hashlib.sha256(b).hexdigest()[:16], etichette(b.decode("utf-8", "replace")))
        return cache[rel]

    righe = []
    componenti = [dict(c, tipo="scaricato") for c in elenco["scaricati"]] + [dict(c, tipo="nostro", nome="nostro/" + c["nome"], versione="", gruppo="nostri") for c in elenco["nostri"]]
    for c in componenti:
        voce = dati["voci"]["componenti"].get(c["nome"], {})
        dichiarata = c.get("licenza", "")
        if c["gruppo"] == "msys":
            chiave = f"{c['nome'][5:]}-{c['versione']}"
            desc = (UNITA / "msys64/var/lib/pacman/local" / chiave / "desc")
            lic = desc.read_text(encoding="utf-8").split("%LICENSE%\n", 1)[1].split("\n\n", 1)[0].split("\n") if desc.exists() and "%LICENSE%" in desc.read_text(encoding="utf-8") else []
            dichiarata = "; ".join(lic)
            # Una voce senza «spdx:» vale solo se e' un identificatore SPDX (MIT, BSD-2-Clause): «GPL3», «BSD», «custom» no.
            spdx = [x[5:] if x.startswith("spdx:") else x for x in lic if x.startswith("spdx:") or re.match(r"^(MIT|ISC|Zlib|[A-Za-z0-9.]+-[A-Za-z0-9.+-]+)$", x)]
            automatica = " AND ".join(f"({x})" if " OR " in x else x for x in spdx) if spdx and len(spdx) == len(lic) else None
        else:
            try:
                automatica = dichiarata if gettoni(dichiarata) else None
            except ValueError:
                automatica = None
        espressione = voce.get("espressione", automatica)
        propri = testi_trovati(c, db, destinazioni) if c["tipo"] == "scaricato" else []
        for p in propri:
            if p.startswith("!"):
                difetti.append(f"{c['nome']}: {p[1:]}")
        propri = [p for p in propri if not p.startswith("!")]
        aggiunti = [canonici[t[1:]] if t.startswith("@") else t for t in voce.get("testi", [])]
        if c["tipo"] == "nostro" and not aggiunti:
            aggiunti = ["licenze/MYDEV-LICENSE.txt"]
        # I testi presi dalla sorgente, nella cartella del sorgente (msys) o del componente.
        chiave = dati["basi"].get(c["nome"], c["nome"].replace("/", "-"))
        for v in ("base", "estesa"):
            cartella = LIC / v / "licenze" / chiave
            if cartella.is_dir():
                aggiunti += [f"licenze/{chiave}/{f.relative_to(cartella).as_posix()}" for f in sorted(cartella.rglob("*")) if f.is_file()]
        # Per ogni parte canonica dell'espressione, il testo canonico (scelta: il testo e' uguale per tutti gli autori).
        if espressione not in (None, "?"):
            try:
                for i in identificatori(espressione):
                    if famiglia(i) in canonici:
                        aggiunti.append(canonici[famiglia(i)])
            except ValueError:
                pass
        tutti = list(dict.fromkeys(propri + aggiunti))
        dettagli = {}
        for t in tutti:
            i = info(t)
            if i is None:
                difetti.append(f"{c['nome']}: il testo {t} non c'e'")
            else:
                dettagli[t] = i
        # Un testo d'autore e' un testo del componente che non sia solo una o piu' licenze canoniche: la licenza di curl
        # e' una MIT senza la frase tipica, e una frase obbligatoria la rifiuterebbe.
        da_autore = [t for t in tutti if t not in canonici.values() and t in dettagli and not (dettagli[t][1] and dettagli[t][1] <= set(CANONICHE))]

        def coperto(ident: str) -> bool:
            f = famiglia(ident)
            if f in CANONICHE:
                return any(f in dettagli[t][1] for t in dettagli)
            # MIT, BSD, ISC e 0BSD si riconoscono dalla frase: un AND con una di loro vuole il suo testo, non uno qualsiasi.
            if f in D_AUTORE:
                return any(f in dettagli[t][1] for t in da_autore)
            return bool(da_autore)

        if espressione is None:
            difetti.append(f"{c['nome']}: la licenza dichiarata «{dichiarata}» non e' un'espressione SPDX, e voci.json non la traduce")
            espressione = "?"
            scoperte = []
        else:
            try:
                ok, scoperte = valuta(gettoni(espressione), coperto)
            except (ValueError, IndexError) as e:
                difetti.append(f"{c['nome']}: espressione «{espressione}» illeggibile: {e}")
                ok, scoperte, espressione = False, [], "?"
            if scoperte or not ok:
                difetti.append(f"{c['nome']}: nessun testo per {', '.join(scoperte) or espressione}")
        # Il sorgente serve se nessuna alternativa dell'espressione evita le licenze copyleft.
        copyleft = [i for i in (identificatori(espressione) if espressione != "?" else []) if COPYLEFT.search(i)]
        obbligato = bool(copyleft) and not valuta(gettoni(espressione), lambda i: not COPYLEFT.search(i))[0]
        sorgenti = sorgenti_di.get(c["nome"], [])
        if obbligato:
            dati["richiesti"].add(c["nome"])
        if obbligato and not sorgenti and not voce.get("senza_sorgente"):
            difetti.append(f"{c['nome']}: licenza {', '.join(copyleft)} e nessun sorgente in ricetta/sorgenti.json")
        # Un pacchetto di MSYS porta la versione nel nome del suo sorgente: lo stesso numero, o il sorgente e' un altro.
        if c["gruppo"] == "msys" and c.get("versione"):
            for s in sorgenti:
                if f"-{c['versione']}." not in s["file"]:
                    difetti.append(f"{c['nome']}: il sorgente {s['file']} non e' alla versione {c['versione']}")
        r = [f"{c['nome']}{' ' + c['versione'] if c['versione'] else ''}", f"    licenza: {espressione}"]
        if dichiarata and dichiarata != espressione:
            r.append(f"    dichiarata dal pacchetto: {dichiarata}")
        if voce.get("motivo"):
            r.append(f"    nota: {voce['motivo']}")
        for t in tutti:
            if t in dettagli:
                r.append(f"    testo: {t} [{dettagli[t][0]}]{' ' + ', '.join(sorted(dettagli[t][1])) if dettagli[t][1] else ''}")
        for s in sorgenti:
            r.append(f"    sorgente: {s['fonte']} [{'sha256 ' + s['sha256'] if 'sha256' in s else 'senza impronta: il server genera l archivio al volo'}]")
        if voce.get("senza_sorgente"):
            r.append(f"    sorgente: {voce['senza_sorgente']}")
        righe.append("\n".join(r))
    tutti_i_nomi = {x["nome"] for x in BASE["scaricati"] + AGG["scaricati"]} | {"nostro/" + x["nome"] for x in BASE["nostri"] + AGG["nostri"]}
    for n in dati["voci"]["componenti"]:
        if n not in tutti_i_nomi and f"voci.json: {n} non e' un componente" not in difetti:
            difetti.append(f"voci.json: {n} non e' un componente")
    variante = "estesa" if elenco is AGG else "base"
    cartella = LIC / variante / "licenze"
    origini = [f"licenze/{f.relative_to(cartella).as_posix()}: {PROVENIENZA.get('licenze/' + f.relative_to(cartella).as_posix(), '?')}" for f in sorted(cartella.rglob("*")) if f.is_file()] if cartella.is_dir() else []
    for o in origini:
        if o.endswith(": ?"):
            difetti.append(f"provenienza.json: manca {o[:-3]}")
    coda = ["", "Da dove vengono i testi della cartella licenze/", "-----------------------------------------------", "", *origini] if origini else []
    return "\n".join([dati["testa"][elenco is AGG], "", *righe, *coda, ""])


PROVENIENZA = leggi(LIC / "provenienza.json")


TESTA_BASE = (LIC / "testa-base.txt").read_text(encoding="utf-8").rstrip("\n")
TESTA_ESTESA = (LIC / "testa-estesa.txt").read_text(encoding="utf-8").rstrip("\n")


def dall_unita(rel: str, dati: dict) -> bytes | None:
    """Un file dell'unita' com'e' sul disco, o come lo altera una sonda in memoria."""
    if rel in dati.get("unita_alterati", {}):
        return dati["unita_alterati"][rel]
    p = UNITA / rel
    return p.read_bytes() if p.is_file() else None


def verdetto(dati: dict) -> tuple[list[str], dict[str, str]]:
    difetti: list[str] = []
    composti = {}
    for v in (["base"] if VARIANTE == "base" else ["base", "estesa"]):
        file, elenco = INDICI[v]
        testo = componi(elenco, dati, difetti)
        composti[v] = testo
        scritto = dati["scritti"].get(v)
        if scritto is None:
            continue
        # Appaiamento nei due versi: le voci dell'indice scritto contro i componenti dell'elenco, per nome.
        # La versione puo' avere spazi («gcc 15.2.0 / mingw-w64 13.0.0 ucrt r5»): il nome e' la prima parola.
        nomi_scritti = re.findall(r"^(\S+)(?: [^\n]*)?\n    licenza:", scritto, re.M)
        nomi = [c["nome"] for c in elenco["scaricati"]] + ["nostro/" + c["nome"] for c in elenco["nostri"]]
        for n in sorted(set(nomi) - set(nomi_scritti)):
            difetti.append(f"{file.name}: manca la voce di {n}")
        for n in sorted(set(nomi_scritti) - set(nomi)):
            difetti.append(f"{file.name}: la voce {n} non e' un componente")
        if scritto != testo:
            difetti.append(f"{file.name}: non e' quello che si ricompone adesso (--scrivi)")
        if not SCRIVI and dall_unita(file.name, dati) != scritto.encode("utf-8"):
            difetti.append(f"{file.name}: nell'unita' manca o e' diverso da quello della ricetta")
    if not SCRIVI:
        for v in composti:
            radice = LIC / v / "licenze"
            for f in sorted(p for p in radice.rglob("*") if p.is_file()) if radice.is_dir() else []:
                rel = f.relative_to(radice).as_posix()
                if dall_unita(f"licenze/{rel}", dati) != f.read_bytes():
                    difetti.append(f"licenze/{rel}: nell'unita' manca o e' diverso da quello della ricetta")
    return difetti, composti


def dati_veri() -> dict:
    scritti = {v: None if SCRIVI or not INDICI[v][0].is_file() else INDICI[v][0].read_text(encoding="utf-8") for v in INDICI}
    return {"db": db_pacman(), "basi": basi_pacman(), "voci": VOCI, "alterati": {}, "testa": {False: TESTA_BASE, True: TESTA_ESTESA}, "scritti": scritti, "richiesti": set()}


dati = dati_veri()
difetti, composti = verdetto(dati)
print(f"unita': {UNITA}, variante {VARIANTE}")
for v, t in composti.items():
    n = len(re.findall(r"^    licenza:", t, re.M))
    print(f"{INDICI[v][0].name}: voci {n}, testi citati {len(re.findall(r'^    testo:', t, re.M))}, sorgenti {len(re.findall(r'^    sorgente:', t, re.M))}, byte {len(t.encode())}")
print(f"chiedono il sorgente: {len(dati['richiesti'])}: {' '.join(sorted(dati['richiesti']))}")
if not SCRIVI and not SONDE and any(dati["scritti"][v] is None for v in composti):
    fermo("manca un indice scritto: prima --scrivi")

if SONDE:
    if difetti:
        fermo("le sonde vogliono un verdetto verde sul dato vero: " + "; ".join(difetti[:3]))
    import copy
    accese = 0
    prove = []
    # 1. Una voce tolta dall'indice scritto.
    d = copy.deepcopy(dati)
    d["scritti"]["base"] = re.sub(r"^msys/zlib .*?(?=^\S)", "", d["scritti"]["base"], count=1, flags=re.M | re.S)
    prove.append(("una voce tolta", d, "manca la voce di msys/zlib"))
    # 2. Una licenza composta con una parte senza testo.
    d = copy.deepcopy(dati)
    # Una parte d'autore: per una canonica il generatore aggiunge da se' il testo, e la sonda non si accenderebbe.
    d["voci"]["componenti"]["msys/zlib"] = {"espressione": "Zlib AND BSD-3-Clause"}
    prove.append(("un AND senza testo", d, "msys/zlib: nessun testo per BSD-3-Clause"))
    # 3. Un testo dell'unita' alterato.
    d = copy.deepcopy(dati)
    d["alterati"]["msys64/usr/share/licenses/zlib/LICENSE"] = b"alterato"
    prove.append(("un testo alterato", d, "LICENZE.txt: non e' quello che si ricompone adesso"))
    # 4. Una licenza che chiede i sorgenti, senza sorgente.
    d = copy.deepcopy(dati)
    d["voci"]["componenti"]["msys/zlib"] = {"espressione": "Zlib AND GPL-2.0-only", "testi": ["@GPL-2.0"]}
    prove.append(("un copyleft senza sorgente", d, "msys/zlib: licenza GPL-2.0-only e nessun sorgente"))
    # 5. Una voce di voci.json senza componente.
    d = copy.deepcopy(dati)
    d["voci"]["componenti"]["msys/inesistente"] = {"espressione": "MIT"}
    prove.append(("una voce senza componente", d, "voci.json: msys/inesistente non e' un componente"))
    # 6. Un copyleft con lo spazio dei nomi, senza sorgente: la forma di libgit2.
    d = copy.deepcopy(dati)
    d["voci"]["componenti"]["msys/zlib"] = {"espressione": "LicenseRef-zlib-GPL-2.0-with-linking-exception", "testi": ["@GPL-2.0"]}
    prove.append(("un copyleft LicenseRef senza sorgente", d, "msys/zlib: licenza LicenseRef-zlib-GPL-2.0-with-linking-exception e nessun sorgente"))
    # 8. Un testo di licenze/ dell'unita' diverso da quello della ricetta, e l'indice dell'unita' diverso.
    primo_testo = sorted(p for p in (LIC / "base" / "licenze").rglob("*") if p.is_file())[0].relative_to(LIC / "base" / "licenze").as_posix()
    d = copy.deepcopy(dati)
    d["unita_alterati"] = {f"licenze/{primo_testo}": b"alterato"}
    prove.append(("un testo di licenze/ alterato nell'unita'", d, f"licenze/{primo_testo}: nell'unita' manca o e' diverso"))
    d = copy.deepcopy(dati)
    d["unita_alterati"] = {"LICENZE.txt": b"alterato"}
    prove.append(("l'indice dell'unita' alterato", d, "LICENZE.txt: nell'unita' manca o e' diverso"))
    # 7. Un sorgente a un'altra versione: l'elenco dei sorgenti e' globale, si altera e si rimette.
    primo = next(s for s in SORGENTI["sorgenti"] if any(n.startswith("msys/") for n in s["componenti"]))
    prove.append(("un sorgente a un'altra versione", copy.deepcopy(dati), f"{primo['componenti'][0]}: il sorgente sonda-0.0-0.src.tar.zst non e' alla versione"))
    for nome, d, atteso in prove:
        if nome == "un sorgente a un'altra versione":
            vero = primo["file"]
            primo["file"] = "sonda-0.0-0.src.tar.zst"
            try:
                df, _ = verdetto(d)
            finally:
                primo["file"] = vero
        else:
            df, _ = verdetto(d)
        acceso = any(x.startswith(atteso) or atteso in x for x in df)
        accese += acceso
        print(f"sonda {nome}: {'ACCESA' if acceso else 'SPENTA'}; difetti {len(df)}; attesa «{atteso}»")
    print(f"sonde accese: {accese}/{len(prove)}")
    print(f"ESITO: {'VERDE' if accese == len(prove) else 'ROSSO'}")
    sys.exit(0 if accese == len(prove) else 1)

if SCRIVI:
    if difetti:
        for x in difetti:
            print(f"ROSSO: {x}")
        print("ESITO: ROSSO (nulla scritto)")
        sys.exit(1)
    for v, t in composti.items():
        INDICI[v][0].parent.mkdir(parents=True, exist_ok=True)
        INDICI[v][0].write_text(t, encoding="utf-8", newline="\n")
        print(f"scritto: {INDICI[v][0]}")
    print("ESITO: VERDE")
    sys.exit(0)

for x in difetti:
    print(f"ROSSO: {x}")
print(f"ESITO: {'VERDE' if not difetti else 'ROSSO'}")
sys.exit(0 if not difetti else 1)

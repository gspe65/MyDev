"""E6, le guide leggibili: ogni guida nostra in Markdown dell'unità ha la sua copia HTML, e la copia ha le tabelle e i blocchi
di codice del sorgente.

    python -X utf8 -B guide.py <radice dell'unità>

Le guide e le copie si leggono da `unita-file.txt` (ciò che la costruzione ha scritto, non ciò che l'uso ha aggiunto dopo):
le guide sono `README.md` e i `.md` sotto `progetti/` fuori dalle cartelle `terzi/`, le copie gli `.html` sotto `guide/`
tranne `guide/indice.html`. Si appaiano nei due versi (una guida senza copia e una copia senza guida sono rosse, per nome);
per ogni coppia le tabelle e i blocchi di codice si contano nel sorgente con le righe del Markdown (riga d'intestazione più
riga dei trattini; recinti di tre apici inversi) e nella copia con un lettore dell'HTML (`<table>`, `<pre>`), e devono
essere uguali; ogni collegamento relativo di una copia deve portare a un file dell'elenco. L'indice deve collegare ogni
copia, e ogni suo collegamento deve portare a un file; la pagina di Chromium
(`chromium/benvenuto.html`) deve collegare l'indice.

Il verdetto è una funzione sola, attraversata dal dato vero e dalle sonde false in coda: una copia tolta, una copia in
più, una tabella persa, un blocco di codice perso, un collegamento rotto in una copia, un collegamento dell'indice tolto,
la pagina di Chromium senza l'indice. Ogni sonda deve dare il rosso col proprio nome, e solo quello.

Che cosa NON guarda: che il testo della copia sia quello del sorgente parola per parola, né l'aspetto della pagina (lo
guarda un occhio, nel cancello d'usabilità); i blocchi di codice rientrati di quattro spazi e le tabelle senza la riga
d'intestazione (le guide non ne hanno: se ne nascesse una, il conteggio del sorgente la mancherebbe, e la differenza
sarebbe un rosso da leggere).

Uscite: 0 verde, 1 rosso, 2 fermo (manca `unita-file.txt`, nessuna guida, una sonda che non si accende).
"""
import html.parser
import posixpath
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

INDICE = "guide/indice.html"
BENVENUTO = "chromium/benvenuto.html"


def fermo(m):
    print(f"FERMO: {m}")
    print("ESITO: FERMO")
    sys.exit(2)


class Lettore(html.parser.HTMLParser):
    def __init__(self):
        super().__init__()
        self.conti = {"table": 0, "pre": 0}
        self.collegamenti = []

    def handle_starttag(self, tag, attrs):
        if tag in self.conti:
            self.conti[tag] += 1
        if tag == "a":
            for k, v in attrs:
                if k == "href" and v:
                    self.collegamenti.append(v)


def leggi_html(testo):
    p = Lettore()
    p.feed(testo)
    p.close()
    return {"tabelle": p.conti["table"], "codice": p.conti["pre"]}, p.collegamenti


def conta_md(testo):
    righe = testo.replace("\r\n", "\n").split("\n")
    tabelle = sum(
        1
        for i in range(len(righe) - 1)
        if re.fullmatch(r"\s*\|.*\|\s*", righe[i]) and re.fullmatch(r"\s*\|[\s:|-]+\|\s*", righe[i + 1]) and "-" in righe[i + 1]
    )
    recinti = sum(1 for r in righe if re.match(r"\s*```", r))
    return {"tabelle": tabelle, "codice": recinti // 2, "recinti dispari": recinti % 2}


def guide_e_copie(elenco):
    guide = [r for r in elenco if r.endswith(".md") and (r == "README.md" or r.startswith("progetti/"))
             and "terzi" not in r.split("/")[:-1]]
    copie = [r for r in elenco if r.startswith("guide/") and r.endswith(".html") and r != INDICE]
    return guide, copie


def copia_di(rel):
    return "guide/" + rel[: -len(".md")] + ".html"


def giudica(guide, copie, sorgenti, pagine, indice, benvenuto, esistenti):
    """Il verdetto, uguale per il dato vero e per le sonde: torna l'elenco dei difetti, ciascuno col nome del file."""
    difetti = []
    attese = {copia_di(g): g for g in guide}
    for g in guide:
        if copia_di(g) not in copie:
            difetti.append(f"guida senza copia: {g}")
    for c in copie:
        if c not in attese:
            difetti.append(f"copia senza guida: {c}")
    for c, g in sorted(attese.items()):
        if c not in copie:
            continue
        s = conta_md(sorgenti[g])
        h, link = leggi_html(pagine[c])
        for u in link:
            if re.match(r"[a-z][a-z0-9+.-]*:", u) or u.startswith("#"):
                continue
            if posixpath.normpath(posixpath.join(posixpath.dirname(c), u)) not in esistenti:
                difetti.append(f"collegamento a un file che non c'è: {c} → {u}")
        if s["recinti dispari"]:
            difetti.append(f"recinto di codice non chiuso nel sorgente: {g}")
        for k in ("tabelle", "codice"):
            if s[k] != h[k]:
                difetti.append(f"{k} diverse: {g} {s[k]}, {c} {h[k]}")
    if indice is None:
        difetti.append(f"manca l'indice: {INDICE}")
    else:
        _, link = leggi_html(indice)
        portati = {posixpath.normpath(posixpath.join("guide", u)) for u in link}
        for c in copie:
            if c not in portati:
                difetti.append(f"copia che l'indice non collega: {c}")
        for u in sorted(portati):
            if u not in esistenti:
                difetti.append(f"collegamento dell'indice a un file che non c'è: {u}")
    if benvenuto is None:
        difetti.append(f"manca la pagina di Chromium: {BENVENUTO}")
    else:
        _, link = leggi_html(benvenuto)
        if INDICE not in {posixpath.normpath(posixpath.join("chromium", u)) for u in link}:
            difetti.append(f"la pagina di Chromium non collega l'indice: {BENVENUTO}")
    return difetti


def main():
    if len(sys.argv) != 2:
        fermo("uso: guide.py <radice dell'unità>")
    radice = Path(sys.argv[1])
    f = radice / "unita-file.txt"
    if not f.is_file():
        fermo(f"manca {f}")
    elenco = [r.split("  ", 1)[1] for r in f.read_text(encoding="utf-8").splitlines() if "  " in r]
    esistenti = set(elenco)
    guide, copie = guide_e_copie(elenco)
    print(f"file nell'elenco dell'unità: {len(elenco)}; guide nostre: {len(guide)}; copie: {len(copie)}")
    if not guide:
        fermo("nessuna guida nell'elenco dell'unità")

    def leggi(rel):
        p = radice / rel
        return p.read_bytes().decode("utf-8") if p.is_file() else None

    sorgenti = {g: leggi(g) for g in guide}
    pagine = {c: leggi(c) for c in copie}
    for k, v in list(sorgenti.items()) + list(pagine.items()):
        if v is None:
            fermo(f"nell'elenco ma non sul disco: {k}")
    indice = leggi(INDICE) if INDICE in esistenti else None
    benvenuto = leggi(BENVENUTO) if BENVENUTO in esistenti else None
    tot = {"tabelle": 0, "codice": 0}
    for g in guide:
        s = conta_md(sorgenti[g])
        for k in tot:
            tot[k] += s[k]
    print(f"nei sorgenti: tabelle {tot['tabelle']}, blocchi di codice {tot['codice']}")

    difetti = giudica(guide, copie, sorgenti, pagine, indice, benvenuto, esistenti)
    for d in difetti:
        print(f"ROSSO: {d}")

    # Le sonde false: lo stesso verdetto su dati alterati. La guida delle sonde è la prima con una tabella e un blocco di codice.
    scelta = next((g for g in guide if conta_md(sorgenti[g])["tabelle"] and conta_md(sorgenti[g])["codice"]
                   and copia_di(g) in pagine), None)
    if scelta is None:
        fermo("nessuna guida con una tabella e un blocco di codice e la sua copia: le sonde non hanno su che cosa accendersi")
    cs = copia_di(scelta)
    pag = dict(pagine)
    senza_tabella = dict(pag)
    senza_tabella[cs] = re.sub(r"<table>.*?</table>", "", pag[cs], count=1, flags=re.S)
    senza_codice = dict(pag)
    senza_codice[cs] = re.sub(r"<pre>.*?</pre>", "", pag[cs], count=1, flags=re.S)
    tolta_dall_indice = re.sub(r'<a href="' + re.escape(posixpath.relpath(cs, "guide")) + r'">', "<a>", indice or "", count=1)
    sonde = {
        "copia tolta": (dict(guide=guide, copie=[c for c in copie if c != cs], sorgenti=sorgenti, pagine=pag),
                        f"guida senza copia: {scelta}"),
        # Una copia in più non ha guida e l'indice non la collega: i due difetti insieme, e nessun altro.
        "copia in più": (dict(guide=guide, copie=copie + ["guide/progetti/in-piu.html"], sorgenti=sorgenti,
                              pagine={**pag, "guide/progetti/in-piu.html": ""}),
                         ["copia senza guida: guide/progetti/in-piu.html",
                          "copia che l'indice non collega: guide/progetti/in-piu.html"]),
        "tabella persa": (dict(guide=guide, copie=copie, sorgenti=sorgenti, pagine=senza_tabella), f"tabelle diverse: {scelta}"),
        "codice perso": (dict(guide=guide, copie=copie, sorgenti=sorgenti, pagine=senza_codice), f"codice diverse: {scelta}"),
        "collegamento rotto": (dict(guide=guide, copie=copie, sorgenti=sorgenti,
                                    pagine={**pag, cs: pag[cs].replace("</main>", '<a href="non-c-e.html">x</a></main>', 1)}),
                               f"collegamento a un file che non c'è: {cs} → non-c-e.html"),
        "indice senza una copia": (dict(guide=guide, copie=copie, sorgenti=sorgenti, pagine=pag, indice=tolta_dall_indice),
                                   f"copia che l'indice non collega: {cs}"),
        "Chromium senza l'indice": (dict(guide=guide, copie=copie, sorgenti=sorgenti, pagine=pag,
                                         benvenuto=(benvenuto or "").replace("indice.html", "altro.html")),
                                    f"la pagina di Chromium non collega l'indice: {BENVENUTO}"),
    }
    spente = []
    for nome, (dati, atteso) in sonde.items():
        attesi = atteso if isinstance(atteso, list) else [atteso]
        dati.setdefault("indice", indice)
        dati.setdefault("benvenuto", benvenuto)
        d = giudica(esistenti=esistenti | {"guide/progetti/in-piu.html"}, **dati)
        nuovi = [x for x in d if x not in difetti]
        # Accesa: ogni difetto atteso c'è, per intero all'inizio della riga, e la sonda non ne fa nascere altri. Se il dato vero
        # ha già il difetto della sonda, la sonda non si può misurare: lo si dice, e l'esito resta il rosso del dato vero.
        if all(any(x.startswith(t) for x in difetti) for t in attesi):
            print(f"sonda «{nome}»: NON MISURABILE, il dato vero ha già il suo difetto")
            continue
        acceso = all(any(x.startswith(t) for x in d) for t in attesi) and all(any(x.startswith(t) for t in attesi) for x in nuovi)
        print(f"sonda «{nome}» su {scelta}: {'ACCESA' if acceso else 'SPENTA'} ({'; '.join(nuovi) or 'nessun difetto nuovo'})")
        if not acceso:
            spente.append(nome)
    if spente:
        fermo(f"sonde che non si accendono: {', '.join(spente)}")
    if difetti:
        print(f"difetti: {len(difetti)}")
        print("ESITO: ROSSO")
        sys.exit(1)
    print(f"coppie: {len(guide)}, tabelle e blocchi uguali, indice e pagina di Chromium collegati")
    print("ESITO: VERDE")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:  # noqa: BLE001
        fermo(f"eccezione: {e!r}")

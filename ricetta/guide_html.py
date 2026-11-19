"""Le guide leggibili: la copia HTML di ogni guida nostra in Markdown dell'unità, scritta alla costruzione.

    python -I -B guide_html.py <radice dell'unità> [--uscita <cartella>]

Le guide nostre sono `README.md` alla radice e i `.md` sotto `progetti/`, tranne quelli in una cartella `terzi/` (il codice
di terzi che un progetto porta con sé, col suo README). Ogni copia va in `guide/` con lo stesso percorso e `.html` al posto
di `.md` (`progetti/GUIDA-C.md` → `guide/progetti/GUIDA-C.html`); `guide/indice.html` le elenca tutte. Senza `--uscita`
scrive nella cartella `guide` dell'unità, che non deve esistere.

Il convertitore è `markdown-it-py` del Python dell'unità: CommonMark con le tabelle, l'HTML nei sorgenti scritto come testo.
Un nome di guida scritto come codice (`progetti/GUIDA-C.md`) diventa un collegamento alla sua copia, e così il nome di un
progetto (`01-ciao`, sotto un titolo `c-comuni/`) porta alla copia del suo `LEGGIMI.md`; un collegamento del sorgente a
una guida nostra (`[01-ciao](c-comuni/01-ciao/LEGGIMI.md)`) porta alla sua copia `.html`. La pagina non chiede
nulla alla rete: lo stile è nel file.

Uscite: 0 verde, 1 rosso (una guida che non si legge come UTF-8, nessuna guida trovata), 2 fermo (la cartella delle copie
c'è già, il convertitore non si importa).

Che cosa NON guarda: che la copia abbia le tabelle e i blocchi di codice del sorgente (lo conta il kit dell'unità, con un
lettore indipendente da questo); le guide scritte dopo la costruzione (la copia resta quella della costruzione, e la
pagina lo dice).
"""
import argparse
import html
import posixpath
import re
import sys
from pathlib import Path

# Lanciato dal costruttore con -I l'uscita è nella codifica di Windows: un nome che non ci sta non deve fermare la scrittura.
sys.stdout.reconfigure(errors="replace")


def fermo(m):
    print(f"FERMO: {m}")
    print("ESITO: FERMO")
    sys.exit(2)


def rosso(m):
    print(f"ROSSO: {m}")
    print("ESITO: ROSSO")
    sys.exit(1)


try:
    from markdown_it import MarkdownIt
except ImportError as e:
    fermo(f"markdown-it-py non si importa: {e}")

STILE = """
  :root { color-scheme: light dark; --testo: #1f2328; --tenue: #57606a; --sfondo: #ffffff; --riquadro: #f6f8fa; --bordo: #d0d7de; --link: #0969da; }
  @media (prefers-color-scheme: dark) {
    :root { --testo: #e6edf3; --tenue: #9198a1; --sfondo: #0d1117; --riquadro: #161b22; --bordo: #30363d; --link: #4493f8; }
  }
  body { margin: 0; background: var(--sfondo); color: var(--testo); font: 16px/1.55 "Segoe UI", system-ui, sans-serif; }
  main { max-width: 52rem; margin: 0 auto; padding: 1.2rem 1rem 3rem; }
  nav { font-size: .95rem; margin: 0 0 1.2rem; }
  h1 { font-size: 1.7rem; margin: .4rem 0 .8rem; }
  h2 { font-size: 1.3rem; margin: 1.8rem 0 .6rem; padding-bottom: .2rem; border-bottom: 1px solid var(--bordo); }
  h3 { font-size: 1.1rem; margin: 1.4rem 0 .5rem; }
  li { margin: .25rem 0; }
  a { color: var(--link); }
  code { font: .92em Consolas, "Cascadia Mono", monospace; background: var(--riquadro); border: 1px solid var(--bordo); border-radius: 4px; padding: 0 .3em; overflow-wrap: anywhere; }
  pre { background: var(--riquadro); border: 1px solid var(--bordo); border-radius: 6px; padding: .7rem 1rem; overflow-x: auto; }
  pre code { background: none; border: 0; padding: 0; font-size: .9rem; }
  table { border-collapse: collapse; margin: .8rem 0; display: block; overflow-x: auto; }
  th, td { border: 1px solid var(--bordo); padding: .35rem .7rem; text-align: left; vertical-align: top; }
  th { background: var(--riquadro); }
  blockquote { margin: .8rem 0; padding: 0 1rem; color: var(--tenue); border-left: 4px solid var(--bordo); }
  .piede { color: var(--tenue); font-size: .92rem; margin-top: 2.5rem; border-top: 1px solid var(--bordo); padding-top: .8rem; }
  .contiene { display: block; }
  .percorso { display: block; color: var(--tenue); font-size: .82rem; overflow-wrap: anywhere; }
"""

# Nell'indice, la riga che dice che cosa contiene ogni guida generale; i LEGGIMI dei progetti non ne hanno.
CONTENUTO = {
    "README.md": "l'unità: che cosa avviare, l'editor, le guide, i dati",
    "progetti/GUIDA-C.md": "il C da zero, i due compilatori, i processi e i thread, la mappa dei progetti",
    "progetti/Avvio-C.md": "i comandi essenziali in breve",
    "progetti/GUIDA-ESTESA.md": "Rust, git e gh, nell'unità estesa",
}


def pagina(titolo, corpo, indietro, piede):
    return (
        '<!DOCTYPE html>\n<html lang="it">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n'
        f"<title>{html.escape(titolo)}</title>\n<style>{STILE}</style>\n</head>\n<body>\n<main>\n"
        + (f'<nav><a href="{indietro}">← Tutte le guide</a></nav>\n' if indietro else "")
        + corpo
        + f'<p class="piede">{piede}</p>\n</main>\n</body>\n</html>\n'
    )


def guide_nostre(radice):
    trovate = []
    if (radice / "README.md").is_file():
        trovate.append("README.md")
    progetti = radice / "progetti"
    if progetti.is_dir():
        for p in progetti.rglob("*.md"):
            rel = p.relative_to(radice).as_posix()
            if "terzi" in rel.split("/")[:-1]:
                continue
            trovate.append(rel)
    return sorted(trovate, key=lambda r: (r != "README.md", r.lower()))


def copia_di(rel):
    return "guide/" + rel[: -len(".md")] + ".html"


def titolo_di(token, rel):
    for i, t in enumerate(token):
        if t.type == "heading_open" and t.tag == "h1":
            return token[i + 1].content
    return rel


def main():
    a = argparse.ArgumentParser()
    a.add_argument("radice")
    a.add_argument("--uscita")
    o = a.parse_args()
    radice = Path(o.radice)
    uscita = Path(o.uscita) if o.uscita else radice / "guide"
    if uscita.exists():
        fermo(f"la cartella delle copie c'è già: {uscita}")
    rels = guide_nostre(radice)
    if not rels:
        rosso(f"nessuna guida in {radice}")
    md = MarkdownIt("commonmark", {"html": False}).enable("table")
    # Un nome di guida scritto come codice diventa un collegamento: dalla radice (`progetti/GUIDA-C.md`) o dalla
    # cartella `progetti` (`GUIDA-C.md`), come lo scrivono le guide.
    note = set(rels)
    titoli = {}
    pagine = {}
    for rel in rels:
        try:
            testo = (radice / rel).read_bytes().decode("utf-8")
        except UnicodeDecodeError as e:
            rosso(f"{rel} non si legge come UTF-8: {e}")
        token = md.parse(testo)
        titoli[rel] = titolo_di(token, rel)
        qui = posixpath.dirname(copia_di(rel))
        cartella = posixpath.dirname(rel)
        # Un nome di progetto scritto come codice (`01-ciao`) porta alla guida del progetto: si cerca nella cartella che
        # l'ultimo titolo nomina come codice (`c-comuni/`), poi accanto alla guida.
        gruppo = None
        for i, t in enumerate(token):
            if t.type == "heading_open":
                figli = token[i + 1].children or []
                nomi = [c.content for c in figli if c.type == "code_inline" and c.content.endswith("/")]
                gruppo = nomi[0].rstrip("/") if nomi else None
            if t.type != "inline" or not t.children:
                continue
            # Un collegamento scritto nel sorgente a una guida nostra (`[01-ciao](c-comuni/01-ciao/LEGGIMI.md)`) porta alla
            # sua copia; il codice dentro un collegamento resta com'è, senza un secondo collegamento.
            in_collegamento = 0
            for c in t.children:
                if c.type == "link_open":
                    in_collegamento += 1
                    href = c.attrGet("href") or ""
                    percorso, diesis, ancora = href.partition("#")
                    if percorso and not re.match(r"[a-zA-Z][a-zA-Z0-9+.-]*:", percorso) and not percorso.startswith("/"):
                        meta = posixpath.normpath(posixpath.join(cartella, percorso))
                        if meta in note:
                            c.attrSet("href", posixpath.relpath(copia_di(meta), qui) + diesis + ancora)
                    continue
                if c.type == "link_close":
                    in_collegamento -= 1
                    continue
                if c.type != "code_inline" or in_collegamento:
                    continue
                nome = c.content.replace("\\", "/")
                candidati = [nome, "progetti/" + nome]
                if gruppo:
                    candidati.append(posixpath.join(cartella, gruppo, nome, "LEGGIMI.md"))
                candidati.append(posixpath.join(cartella, nome, "LEGGIMI.md"))
                meta = next((x for x in candidati if x in note and x != rel), None)
                if meta:
                    c.meta["collegamento"] = posixpath.relpath(copia_di(meta), qui)
        pagine[rel] = (token, qui)

    def codice_in_linea(renderer, tokens, idx, options, env):
        c = tokens[idx]
        testo = f"<code>{html.escape(c.content)}</code>"
        if "collegamento" in c.meta:
            return f'<a href="{html.escape(c.meta["collegamento"])}">{testo}</a>'
        return testo

    md.add_render_rule("code_inline", codice_in_linea)
    for rel in rels:
        token, qui = pagine[rel]
        corpo = md.renderer.render(token, md.options, {})
        indice = posixpath.relpath("guide/indice.html", qui)
        piede = (
            f"Questa pagina è una copia della guida <code>{html.escape(rel)}</code>, fatta quando l'unità è stata "
            "costruita: se il file cambia, la pagina resta com'era."
        )
        f = uscita / copia_di(rel)[len("guide/") :]
        f.parent.mkdir(parents=True, exist_ok=True)
        f.write_bytes(pagina(titoli[rel], corpo, indice, piede).encode("utf-8"))

    # L'indice: prima le guide generali, poi i progetti, cartella per cartella.
    generali = [r for r in rels if r.count("/") <= 1]
    righe = ["<h1>Le guide di MyDev</h1>\n", "<h2>Le guide</h2>\n<ul>\n"]
    for r in generali:
        nome = "MyDev: la guida dell'unità" if r == "README.md" else titoli[r]
        contiene = f'<span class="contiene">{html.escape(CONTENUTO[r])}</span>' if r in CONTENUTO else ""
        righe.append(f'<li><a href="{html.escape(copia_di(r)[len("guide/"):])}">{html.escape(nome)}</a>{contiene}'
                     f'<span class="percorso"><code>{html.escape(r)}</code></span></li>\n')
    righe.append("</ul>\n")
    gruppo = None
    for r in rels:
        if r in generali:
            continue
        g = r.split("/")[1]
        if g != gruppo:
            if gruppo is not None:
                righe.append("</ul>\n")
            righe.append(f"<h2>I progetti in <code>progetti/{html.escape(g)}</code></h2>\n<ul>\n")
            gruppo = g
        cartella = posixpath.dirname(r)[len("progetti/") :]
        righe.append(f'<li><a href="{html.escape(copia_di(r)[len("guide/"):])}">{html.escape(titoli[r])}</a>'
                     f'<span class="percorso"><code>{html.escape(cartella)}</code></span></li>\n')
    if gruppo is not None:
        righe.append("</ul>\n")
    piede = ("Le pagine di questa cartella sono copie delle guide <code>.md</code> dell'unità, fatte quando l'unità è stata "
             "costruita. Le guide si leggono anche in VSCodium, dove si aprono come pagina.")
    (uscita / "indice.html").write_bytes(pagina("Le guide di MyDev", "".join(righe), None, piede).encode("utf-8"))
    print(f"guide: {len(rels)} copie e l'indice in {uscita}")
    print("ESITO: VERDE")


if __name__ == "__main__":
    try:
        main()
    except SystemExit:
        raise
    except Exception as e:  # noqa: BLE001 - un'eccezione non prevista è un fermo, non un rosso
        fermo(f"eccezione: {e!r}")

"""La copia del codice del corso sui puntatori contro il suo inventario e contro il commit da cui viene.

Uso, dalla radice del repository:
  python -B ricetta/puntatori/uguaglianza.py --repo <repository del corso>
      la prova intera: copia, inventario e commit
  python -B ricetta/puntatori/uguaglianza.py --solo-copia [--copia <cartella>]
      la sola copia contro l'inventario (il kit dell'estesa la lancia su progetti/puntatori dell'unita')
  python -B ricetta/puntatori/uguaglianza.py --repo <repository del corso> --scrivi --commit <commit>
      riscrive l'inventario e la copia in ricetta/unita/progetti-puntatori/ dal commit; poi si rilancia la prova
Il repository del corso si da' con --repo o con la variabile MYDEV_CORSO_REPO: nessun percorso e' scritto qui.

Che cosa confronta, sempre nei due versi:
1. la copia contro l'inventario: ogni file dell'inventario c'e', con la stessa dimensione e la stessa impronta, e nella
   copia non c'e' nessun altro file, ne' una cartella senza file (git non conserva le cartelle vuote: una cartella
   vuota nella copia non viene dal commit);
2. l'inventario contro il commit (non con --solo-copia): ogni file del commit sotto la cartella del corso sta
   nell'inventario con la stessa impronta, o fra gli esclusi; ogni file dell'inventario e ogni escluso esistono nel commit;
3. ogni sottocartella di terzi/: LICENSE e PROVENIENZA.md presenti, e la tabella delle impronte di PROVENIENZA.md
   appaiata ai file della cartella nei due versi;
4. ogni sottocartella di terzi/ ha il suo LICENSE fra i testi della voce del corso in ricetta/licenze/voci.json, e ogni
   testo di quella voce sotto terzi/ ha la sua cartella.
Le impronte del commit vengono dai byte che git conserva (cat-file); quelle della copia dai byte sul disco, a parte.

Che cosa NON guarda: il contenuto dei file (dati personali, licenza del codice del corso, nomi interni): si leggono a
mano prima di fissare un commit; che il commit sia quello che il corso usa; l'indice delle licenze (lo verifica
ricetta/licenze_unita.py).
Uscite: 0 verde, 1 rosso, 2 fermo (non si e' potuto misurare, una sonda che non si accende, un'eccezione).
Sonde false in coda: lo stesso verdetto, su dati alterati in memoria, una per ogni specie di difetto che giudica()
sa scrivere (quelle del commit solo senza --solo-copia); ognuna cerca il SUO difetto per nome.
"""
import argparse
import hashlib
import json
import os
import pathlib
import re
import subprocess
import sys

sys.stdout.reconfigure(encoding="utf-8")
RADICE = pathlib.Path(__file__).resolve().parents[2]
INVENTARIO = RADICE / "ricetta" / "puntatori" / "inventario.json"
COPIA = RADICE / "ricetta" / "unita" / "progetti-puntatori"
AGGIUNTA = RADICE / "ricetta" / "componenti-estesa.json"
VOCI = RADICE / "ricetta" / "licenze" / "voci.json"
NOME = "progetti-puntatori"
CARTELLA = "progetti/puntatori/codice"
# I file del commit che restano fuori dalla copia, ciascuno col suo motivo.
ESCLUSI = {
    ".gitattributes": "regola di fine riga del repository del corso",
    ".gitignore": "regole di esclusione del repository del corso",
    "strumenti/genera_prove.py": "rigenera i file di prova: non e' un verificatore",
    "strumenti/verifica-linux.sh": "gira solo sulla macchina Linux del corso",
}


def fermo(m):
    print(f"FERMO: {m}\nESITO: FERMO")
    sys.exit(2)


def impronte(dati):
    return len(dati), hashlib.sha256(dati).hexdigest(), hashlib.sha1(b"blob %d\0" % len(dati) + dati).hexdigest()


def leggi_cartella(c):
    return {p.relative_to(c).as_posix(): p.read_bytes() for p in sorted(c.rglob("*")) if p.is_file()}


def leggi_sottocartelle(c):
    return sorted(p.relative_to(c).as_posix() for p in c.rglob("*") if p.is_dir())


def vuote(cartelle, file):
    """Le sottocartelle senza nessun file sotto, a qualunque profondita'."""
    return [d for d in cartelle if not any(f.startswith(d + "/") for f in file)]


def tabella_di(provenienza):
    """La tabella delle impronte di PROVENIENZA.md: {file: sha256}."""
    return dict(re.findall(r"^\| `([^`]+)` \| `([0-9a-f]{64})` \|$", provenienza.decode("utf-8", "replace"), re.M))


def leggi_commit(repo, commit):
    """{percorso relativo alla cartella del corso: byte conservati}, dal solo commit (mai l'albero di lavoro)."""
    def git(*a, **k):
        r = subprocess.run(["git", "-C", str(repo), *a], capture_output=True, **k)
        if r.returncode != 0:
            fermo(f"git {a[0]}: {r.stderr.decode('utf-8', 'replace').strip()}")
        return r.stdout
    voci = [v for v in git("ls-tree", "-r", "-z", commit, "--", CARTELLA).split(b"\0") if v]
    righe = []
    for v in voci:
        testa, percorso = v.split(b"\t", 1)
        modo, tipo, oggetto = testa.split()
        if tipo != b"blob" or modo not in (b"100644", b"100755"):
            fermo(f"voce non ordinaria nel commit: {modo.decode()} {percorso.decode()}")
        righe.append((percorso.decode("utf-8")[len(CARTELLA) + 1:], oggetto.decode()))
    uscita = git("cat-file", "--batch", input="".join(o + "\n" for _, o in righe).encode())
    file, pos = {}, 0
    for rel, oggetto in righe:
        fine = uscita.index(b"\n", pos)
        o, tipo, n = uscita[pos:fine].decode().split()
        if o != oggetto or tipo != "blob":
            fermo(f"cat-file: atteso {oggetto}, letto {o} {tipo}")
        file[rel] = uscita[fine + 1:fine + 1 + int(n)]
        pos = fine + 1 + int(n) + 1
    return file


def testi_della_voce(voci, destinazione):
    """Le sottocartelle di terzi/ nominate dai testi della voce del corso, come percorsi della copia."""
    testi = voci["componenti"].get("nostro/" + NOME, {}).get("testi", [])
    pre = destinazione.rstrip("/") + "/"
    return sorted(t[len(pre):] for t in testi if t.startswith(pre + "terzi/"))


def giudica(copia, inventario, commit, testi, cartelle):
    """Il verdetto, uguale per il dato vero e per le sonde: torna l'elenco dei difetti, ognuno col suo file."""
    difetti = []
    inv = {f["percorso"]: f for f in inventario["file"]}
    # 1. copia contro inventario, nei due versi, e le cartelle senza file
    for rel in sorted(set(inv) - set(copia)):
        difetti.append(f"copia: manca {rel}")
    for rel in sorted(set(copia) - set(inv)):
        difetti.append(f"copia: file non nell'inventario {rel}")
    for rel in vuote(cartelle, copia):
        difetti.append(f"copia: cartella vuota {rel}")
    for rel in sorted(set(inv) & set(copia)):
        n, s, b = impronte(copia[rel])
        if (n, s, b) != (inv[rel]["byte"], inv[rel]["sha256"], inv[rel]["blob"]):
            difetti.append(f"copia: impronta diversa {rel}")
    # 2. inventario contro commit, nei due versi
    if commit is not None:
        esclusi = inventario["esclusi"]
        for rel in sorted(set(commit) - set(inv) - set(esclusi)):
            difetti.append(f"commit: file non nell'inventario e non escluso {rel}")
        for rel in sorted(set(inv) - set(commit)):
            difetti.append(f"commit: file dell'inventario assente {rel}")
        for rel in sorted(set(esclusi) - set(commit)):
            difetti.append(f"commit: escluso assente {rel}")
        for rel in sorted(set(inv) & set(commit)):
            n, s, b = impronte(commit[rel])
            if (n, s, b) != (inv[rel]["byte"], inv[rel]["sha256"], inv[rel]["blob"]):
                difetti.append(f"commit: impronta diversa {rel}")
    # 3. terzi/: LICENSE, PROVENIENZA.md e la sua tabella, nei due versi
    cartelle = sorted({rel.split("/")[1] for rel in copia if rel.startswith("terzi/") and rel.count("/") >= 2})
    for t in cartelle:
        pre = f"terzi/{t}/"
        for f in ("LICENSE", "PROVENIENZA.md"):
            if pre + f not in copia:
                difetti.append(f"terzi/{t}: manca {f}")
        if pre + "PROVENIENZA.md" in copia:
            tabella = tabella_di(copia[pre + "PROVENIENZA.md"])
            presenti = {rel[len(pre):] for rel in copia if rel.startswith(pre) and rel != pre + "PROVENIENZA.md"}
            for f in sorted(set(tabella) - presenti):
                difetti.append(f"terzi/{t}: PROVENIENZA.md nomina un file assente {f}")
            for f in sorted(presenti - set(tabella)):
                difetti.append(f"terzi/{t}: file senza impronta in PROVENIENZA.md {f}")
            for f in sorted(presenti & set(tabella)):
                if hashlib.sha256(copia[pre + f]).hexdigest() != tabella[f]:
                    difetti.append(f"terzi/{t}: impronta diversa da PROVENIENZA.md {f}")
    # 4. terzi/ contro i testi della voce delle licenze, nei due versi
    for t in cartelle:
        if f"terzi/{t}/LICENSE" not in testi:
            difetti.append(f"terzi/{t}: LICENSE assente dai testi della voce nostro/{NOME}")
    for x in testi:
        if not re.fullmatch(r"terzi/[^/]+/LICENSE", x) or x.split("/")[1] not in cartelle:
            difetti.append(f"voce nostro/{NOME}: testo senza cartella in terzi/ {x}")
    return difetti


def scrivi(repo, commit):
    file = leggi_commit(repo, commit)
    if not file:
        fermo(f"nessun file sotto {CARTELLA} al commit {commit}")
    mancano = sorted(set(ESCLUSI) - set(file))
    if mancano:
        fermo(f"esclusi assenti dal commit: {mancano}")
    tenuti = {rel: b for rel, b in file.items() if rel not in ESCLUSI}
    pieno = subprocess.run(["git", "-C", str(repo), "rev-parse", commit + "^{commit}"], capture_output=True, text=True).stdout.strip()
    righe = []
    for rel in sorted(tenuti):
        n, s, b = impronte(tenuti[rel])
        righe.append({"percorso": rel, "byte": n, "sha256": s, "blob": b})
    inv = {"formato": 1, "commit": pieno, "cartella": CARTELLA, "esclusi": ESCLUSI, "file": righe}
    INVENTARIO.write_text(json.dumps(inv, indent=1, ensure_ascii=True) + "\n", encoding="ascii", newline="\n")
    # La copia si riscrive per intero: i file che il commit non ha piu' si tolgono.
    for rel in sorted(set(leggi_cartella(COPIA)) - set(tenuti)) if COPIA.is_dir() else []:
        (COPIA / rel).unlink()
    # E le cartelle rimaste senza file, dalla piu' profonda: la prova le segna rosse (git non le conserva).
    for rel in sorted(vuote(leggi_sottocartelle(COPIA), tenuti), key=lambda d: -d.count("/")) if COPIA.is_dir() else []:
        (COPIA / rel).rmdir()
    for rel, b in tenuti.items():
        (COPIA / rel).parent.mkdir(parents=True, exist_ok=True)
        (COPIA / rel).write_bytes(b)
    print(f"scritti: inventario con {len(righe)} file e {len(ESCLUSI)} esclusi, commit {pieno}; copia in {COPIA}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--repo")
    ap.add_argument("--copia")
    ap.add_argument("--commit")
    ap.add_argument("--solo-copia", action="store_true")
    ap.add_argument("--scrivi", action="store_true")
    a = ap.parse_args()
    repo = a.repo or os.environ.get("MYDEV_CORSO_REPO")
    if a.scrivi:
        if not repo or not a.commit or a.copia:
            fermo("--scrivi vuole --repo (o MYDEV_CORSO_REPO) e --commit, e scrive solo la copia della ricetta")
        scrivi(pathlib.Path(repo), a.commit)
    if not a.solo_copia and not repo:
        fermo("serve --repo, o la variabile MYDEV_CORSO_REPO, oppure --solo-copia")

    inventario = json.loads(INVENTARIO.read_text(encoding="ascii"))
    aggiunta = json.loads(AGGIUNTA.read_text(encoding="utf-8"))
    voce = [v for v in aggiunta["nostri"] if v["nome"] == NOME]
    if len(voce) != 1:
        fermo(f"la voce {NOME} dell'aggiunta c'e' {len(voce)} volte, attesa 1")
    testi = testi_della_voce(json.loads(VOCI.read_text(encoding="utf-8")), voce[0]["destinazioni"][0])
    cartella = pathlib.Path(a.copia) if a.copia else COPIA
    if not cartella.is_dir():
        fermo(f"copia assente: {cartella}")
    copia = leggi_cartella(cartella)
    cartelle = leggi_sottocartelle(cartella)
    commit = None if a.solo_copia else leggi_commit(pathlib.Path(repo), inventario["commit"])
    print(f"commit: {inventario['commit']} | cartella del corso: {inventario['cartella']}")
    print(f"inventario: {len(inventario['file'])} file, esclusi {len(inventario['esclusi'])} | copia: {len(copia)} file in {cartella}"
          + ("" if commit is None else f" | commit: {len(commit)} file") + f" | terzi nei testi della voce: {len(testi)}")
    print(f"sottocartelle della copia: {len(cartelle)}, senza file: {len(vuote(cartelle, copia))}")
    if not inventario["file"] or not copia or (commit is not None and not commit):
        fermo("corpus vuoto")
    if inventario["esclusi"] != ESCLUSI:
        fermo("gli esclusi dell'inventario non sono quelli dichiarati qui: si riscrive con --scrivi")

    difetti = giudica(copia, inventario, commit, testi, cartelle)
    for d in difetti:
        print(f"  ROSSO {d}")
    print(f"difetti: {len(difetti)}")

    # Sonde false: ognuna altera una cosa sola in memoria e deve far comparire il SUO difetto, cercato per nome, che
    # nel verdetto vero non c'e' (l'esito deve cambiare). Una per ogni specie di difetto di giudica(). Le prime quattro,
    # in quest'ordine, le cerca il kit dell'estesa: le nuove vanno in coda.
    def prova(atteso, copia=copia, commit=commit, testi=testi, cartelle=cartelle):
        return atteso not in difetti and atteso in giudica(copia, inventario, commit, testi, cartelle)

    def senza(d, rel):
        return {r: b for r, b in d.items() if r != rel}

    primo = inventario["file"][0]["percorso"]
    terzi = sorted({r.split("/")[1] for r in copia if r.startswith("terzi/") and r.count("/") >= 2})
    t = terzi[0] if terzi else "?"
    pre = f"terzi/{t}/"
    provenienza = copia.get(pre + "PROVENIENZA.md", b"")
    # La voce della tabella per la sonda dell'impronta: la prima che nella copia c'e' davvero.
    in_tabella = sorted(set(tabella_di(provenienza)) & {r[len(pre):] for r in copia if r.startswith(pre)})
    voce_t = in_tabella[0] if in_tabella else "?"
    sonde = {
        "byte": prova(f"copia: impronta diversa {primo}", copia=dict(copia, **{primo: copia.get(primo, b"") + b"x"})),
        "in-piu": prova("copia: file non nell'inventario sonda/in-piu.txt", copia=dict(copia, **{"sonda/in-piu.txt": b""})),
        "provenienza": bool(terzi) and prova(f"terzi/{t}: manca PROVENIENZA.md", copia=senza(copia, pre + "PROVENIENZA.md")),
        "licenza": bool(terzi) and prova(f"terzi/{t}: LICENSE assente dai testi della voce nostro/{NOME}",
                                         testi=[x for x in testi if x != pre + "LICENSE"]),
        "manca": prova(f"copia: manca {primo}", copia=senza(copia, primo)),
        "vuota": prova("copia: cartella vuota sonda/vuota", cartelle=cartelle + ["sonda", "sonda/vuota"]),
        "senza-license": bool(terzi) and prova(f"terzi/{t}: manca LICENSE", copia=senza(copia, pre + "LICENSE")),
        "tabella-assente": bool(terzi) and prova(f"terzi/{t}: PROVENIENZA.md nomina un file assente sonda-assente.txt", copia=dict(
            copia, **{pre + "PROVENIENZA.md": provenienza + b"\n| `sonda-assente.txt` | `" + b"0" * 64 + b"` |\n"})),
        "senza-impronta": bool(terzi) and prova(f"terzi/{t}: file senza impronta in PROVENIENZA.md sonda.txt",
                                                copia=dict(copia, **{pre + "sonda.txt": b""})),
        "impronta-tabella": bool(in_tabella) and prova(f"terzi/{t}: impronta diversa da PROVENIENZA.md {voce_t}",
                                                       copia=dict(copia, **{pre + voce_t: copia.get(pre + voce_t, b"") + b"x"})),
        "testo-orfano": prova(f"voce nostro/{NOME}: testo senza cartella in terzi/ terzi/sonda/LICENSE", testi=testi + ["terzi/sonda/LICENSE"]),
    }
    if commit is not None:
        escluso = sorted(inventario["esclusi"])[0]
        sonde["commit"] = prova(f"commit: impronta diversa {primo}", commit=dict(commit, **{primo: commit.get(primo, b"") + b"x"}))
        sonde["commit-in-piu"] = prova("commit: file non nell'inventario e non escluso sonda/in-piu.txt", commit=dict(commit, **{"sonda/in-piu.txt": b""}))
        sonde["commit-manca"] = prova(f"commit: file dell'inventario assente {primo}", commit=senza(commit, primo))
        sonde["escluso-assente"] = prova(f"commit: escluso assente {escluso}", commit=senza(commit, escluso))
    print("sonde false: " + " ".join(f"{k}={'ACCESA' if v else 'ROTTA'}" for k, v in sonde.items()))
    print(f"sonde accese: {sum(1 for v in sonde.values() if v)}/{len(sonde)}")
    if not all(sonde.values()):
        fermo("una sonda non si accende")
    print("ESITO: " + ("ROSSO" if difetti else "VERDE"))
    return 1 if difetti else 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except BaseException as e:  # 2 anche sull'eccezione: un 1 si leggerebbe come un rosso
        print(f"FERMO: eccezione {e.__class__.__name__}: {e}\nESITO: FERMO")
        sys.exit(2)

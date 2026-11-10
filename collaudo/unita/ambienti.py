"""L'ambiente dei programmi dell'unita', appaiato nelle sue quattro copie.

    python -X utf8 -B collaudo/unita/ambienti.py [--sonde]

L'ambiente sta scritto in quattro posti: il lanciatore (ricetta/unita/lancia.c), i collegamenti di ripiego
(ricetta/unita/fallback/comune.bat), il terminale del kit (collaudo/unita/terminale.bat) e l'editor del gate
(collaudo/unita/gate.ps1). Una variabile aggiunta in uno e dimenticata in un altro non da' errore: la prova gira
con un ambiente diverso da quello di chi usa l'unita'. Qui si confrontano i NOMI, nei due versi, per la parte
comune e per quella dell'unita' estesa, con le eccezioni dichiarate qui sotto.

Con --sonde, in coda: un nome tolto da una copia e uno aggiunto devono dare DIVERSO.

Uscite: 0 verde, 1 rosso (nomina le variabili), 2 fermo (un file manca, o una copia non si legge).

Che cosa NON guarda: i valori (le forme Windows e POSIX sono scelte per programma, lo dicono i commenti delle copie);
le variabili che il lanciatore toglie.
"""
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
AIUTANTI = {"BASE", "DRIVE", "UBASE", "PATH_TERM", "SONDA"}
# Il terminale del kit lancia solo bash: non gli servono il PATH di Windows ne' le variabili per i programmi dell'editor.
SOLO_EDITOR = {"PATH", "MYDEV_RADICE", "MYDEV_RADICE_POSIX", "MYDEV_MSYS", "ProgramW6432"}


def fermo(m):
    print(f"FERMO: {m}")
    print("ESITO: FERMO")
    sys.exit(2)


def leggi(rel):
    p = REPO / rel
    if not p.is_file():
        fermo(f"manca {rel}")
    return p.read_text(encoding="utf-8")


def da_lanciatore(testo):
    """Comune (wWinMain), estesa (prepara_estesa), terminale (prepara_terminale)."""
    gruppi = {"comune": set(), "estesa": set(), "terminale": set()}
    dove = None
    for riga in testo.splitlines():
        m = re.match(r"^(?:static\s+\w+|int\s+WINAPI)\s+(\w+)\s*\(", riga)
        if m:
            dove = {"prepara_estesa": "estesa", "prepara_terminale": "terminale", "wWinMain": "comune"}.get(m.group(1))
            continue
        if dove:
            for n in re.findall(r'imposta\(L"(\w+)"', riga):
                gruppi[dove].add(n)
    return gruppi


def da_bat(testo):
    """Prima e dopo il salto dell'estesa."""
    comune, estesa = set(), set()
    nell_estesa = False
    for riga in testo.splitlines():
        if re.match(r'^if not exist ".*git\.exe" goto :fine_estesa', riga, re.I):
            nell_estesa = True
            continue
        if riga.strip().lower() == ":fine_estesa":
            nell_estesa = False
            continue
        # set "NOME=" con il valore vuoto toglie la variabile: non e' una variabile data.
        m = re.match(r'^set "(\w+)=[^"]', riga, re.I)
        if m and m.group(1) not in AIUTANTI:
            (estesa if nell_estesa else comune).add(m.group(1))
    return comune, estesa


def da_gate(testo):
    m = re.search(r"\$Ambiente = @\{(.*?)\n\s*\}", testo, re.S)
    if not m:
        fermo("l'elenco $Ambiente non si trova in gate.ps1")
    comune = set(re.findall(r"(\w+) = ", m.group(1)))
    e = re.search(r"if \(\$Estesa\) \{(.*?)\n\s*\}", testo[m.end():], re.S)
    if not e:
        fermo("il ramo dell'estesa di $Ambiente non si trova in gate.ps1")
    estesa = set(re.findall(r"\$Ambiente\['(\w+)'\]", e.group(1)))
    return comune, estesa


def attese(l):
    """Ogni copia, con le sue eccezioni, deve avere esattamente questi nomi."""
    return {
        "ripiego, parte comune": l["comune"] | l["terminale"],
        "ripiego, estesa": l["estesa"],
        "gate, parte comune": l["comune"],
        "gate, estesa": l["estesa"],
        "terminale del kit, parte comune": (l["comune"] | l["terminale"]) - SOLO_EDITOR,
        "terminale del kit, estesa": l["estesa"] - SOLO_EDITOR,
    }


def confronta(l, copie):
    diff = []
    for nome, atteso in attese(l).items():
        visto = copie[nome]
        for v in sorted(atteso - visto):
            diff.append(f"{nome}: manca {v}")
        for v in sorted(visto - atteso):
            diff.append(f"{nome}: in piu' {v}")
    return diff


def main():
    sonde = "--sonde" in sys.argv[1:]
    l = da_lanciatore(leggi("ricetta/unita/lancia.c"))
    rc, re_ = da_bat(leggi("ricetta/unita/fallback/comune.bat"))
    tc, te = da_bat(leggi("collaudo/unita/terminale.bat"))
    gc, ge = da_gate(leggi("collaudo/unita/gate.ps1"))
    copie = {
        "ripiego, parte comune": rc, "ripiego, estesa": re_,
        "gate, parte comune": gc, "gate, estesa": ge,
        "terminale del kit, parte comune": tc, "terminale del kit, estesa": te,
    }
    for k in ("comune", "estesa", "terminale"):
        print(f"lanciatore, {k}: {len(l[k])} ({' '.join(sorted(l[k]))})")
    for k, v in copie.items():
        print(f"{k}: {len(v)}")
    if not l["comune"] or not l["estesa"] or not l["terminale"] or not all(copie.values()):
        fermo("una copia senza variabili: il lettore non l'ha vista")
    diff = confronta(l, copie)
    for d in diff:
        print(f"DIVERSO: {d}")
    print(f"differenze: {len(diff)}")
    if sonde:
        tolto = {k: set(v) for k, v in copie.items()}
        tolto["gate, estesa"].discard(sorted(tolto["gate, estesa"])[0])
        aggiunto = {k: set(v) for k, v in copie.items()}
        aggiunto["terminale del kit, parte comune"].add("SONDA_IN_PIU")
        esiti = [bool(confronta(l, tolto)), bool(confronta(l, aggiunto))]
        print(f"sonde: tolto={'DIVERSO' if esiti[0] else 'UGUALE'} aggiunto={'DIVERSO' if esiti[1] else 'UGUALE'}")
        if not all(esiti):
            fermo("una sonda non si e' accesa")
    if diff:
        print("ESITO: ROSSO")
        return 1
    print("ESITO: VERDE")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except Exception as e:  # noqa: BLE001
        fermo(f"eccezione: {e}")

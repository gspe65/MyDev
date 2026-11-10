"""Appaia la guida dell'estesa con l'aggiunta dell'elenco dei componenti, nei due versi.

    python guida.py <GUIDA-ESTESA.md> <componenti-estesa.json>

Ogni voce e' un titolo `### nome` seguito da una riga "Nell'elenco:" con i componenti fra apici inversi; le
dipendenze stanno nel blocco di "## Le dipendenze". Un componente senza posto, un nome che l'elenco non ha, una voce
senza componente o un titolo atteso che manca sono rossi. I titoli attesi sono scritti qui, perche' piu' strumenti
vengono dallo stesso pacchetto e l'elenco non li distingue.

Che cosa NON guarda: che il testo di una voce sia giusto; che i comandi della guida funzionino.
Uscite: 0 verde, 1 rosso, 2 fermo. Sonde false in coda: lo stesso verdetto, su dati sbagliati.
"""
import json
import pathlib
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

TITOLI = ["rustc", "cargo", "clippy", "rustfmt", "rust-analyzer", "I manuali", "git", "gh", "cargo-ponte", "rustc-ponte",
          "programmi/Git/cmd/git.exe", "bin/gh", "Le impostazioni", "I progetti in Rust", "Le licenze"]


def leggi_guida(testo):
    """Torna {titolo: [componenti]} e l'elenco delle dipendenze."""
    voci = {}
    for m in re.finditer(r"^### (.+)\n(.*)$", testo, re.M):
        riga = m.group(2)
        voci[m.group(1).strip()] = re.findall(r"`([^`]+)`", riga) if riga.startswith("**Nell'elenco:**") else []
    b = re.search(r"^## Le dipendenze\n.*?```\n(.*?)\n```", testo, re.S | re.M)
    dipendenze = b.group(1).split("\n") if b else []
    return voci, dipendenze


def giudica(voci, dipendenze, componenti, titoli):
    """Il verdetto, uguale per il dato vero e per le sonde: torna le quattro liste dei difetti."""
    nella_guida = {c for cc in voci.values() for c in cc} | set(dipendenze)
    senza_voce = sorted(set(componenti) - nella_guida)
    senza_componente = sorted((nella_guida - set(componenti)) | {t for t, cc in voci.items() if not cc})
    mancanti = sorted(set(titoli) - set(voci))
    in_piu = sorted(set(voci) - set(titoli))
    return senza_voce, senza_componente, mancanti, in_piu


def main():
    guida, aggiunta = map(pathlib.Path, sys.argv[1:3])
    if not guida.is_file() or not aggiunta.is_file():
        print(f"FERMO: manca {guida if not guida.is_file() else aggiunta}\nESITO: FERMO")
        return 2
    d = json.loads(aggiunta.read_text(encoding="utf-8"))
    componenti = [v["nome"] for v in d["scaricati"]] + [v["nome"] for v in d["nostri"]]
    voci, dipendenze = leggi_guida(guida.read_text(encoding="utf-8"))
    print(f"voci: {len(voci)} (attese {len(TITOLI)}) | dipendenze: {len(dipendenze)} | componenti dell'aggiunta: {len(componenti)}")
    if not componenti or not voci or not dipendenze:
        print("FERMO: corpus vuoto\nESITO: FERMO")
        return 2
    senza_voce, senza_componente, mancanti, in_piu = giudica(voci, dipendenze, componenti, TITOLI)
    for n in senza_voce:
        print(f"  ROSSO componente senza voce: {n}")
    for n in senza_componente:
        print(f"  ROSSO voce senza componente: {n}")
    for n in mancanti:
        print(f"  ROSSO titolo atteso assente: {n}")
    for n in in_piu:
        print(f"  ROSSO titolo non atteso: {n}")
    print(f"appaiamento: senza voce {len(senza_voce)}, voci senza componente {len(senza_componente)}, titoli mancanti {len(mancanti)}, titoli in piu' {len(in_piu)}")

    # Sonde false: ognuna toglie o aggiunge una cosa sola, e la deve far comparire nella lista giusta. Si cerca il nome,
    # non l'elenco intero: su dati davvero guasti l'elenco ha gia' altre voci, e il rosso resterebbe un fermo.
    meno = {k: v for k, v in voci.items() if k != "gh"}
    tolta = giudica(meno, dipendenze, componenti, TITOLI)
    s1 = "strumenti/gh" in tolta[0] and "gh" in tolta[2]
    s2 = "sonda/senza-voce" in giudica(voci, dipendenze, componenti + ["sonda/senza-voce"], TITOLI)[0]
    s3 = "sonda/nome-estraneo" in giudica(voci, dipendenze + ["sonda/nome-estraneo"], componenti, TITOLI)[1]
    s4 = "senza riga" in giudica(dict(voci, **{"senza riga": []}), dipendenze, componenti, TITOLI)[1]
    print(f"sonde false: tolta={'ACCESA' if s1 else 'ROTTA'} senza-voce={'ACCESA' if s2 else 'ROTTA'} "
          f"nome-estraneo={'ACCESA' if s3 else 'ROTTA'} senza-riga={'ACCESA' if s4 else 'ROTTA'}")
    if not (s1 and s2 and s3 and s4):
        print("ESITO: FERMO")
        return 2
    if senza_voce or senza_componente or mancanti or in_piu:
        print("ESITO: ROSSO")
        return 1
    print("ESITO: VERDE")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except BaseException as e:  # 2 anche sull'eccezione: un 1 si leggerebbe come un rosso
        print(f"FERMO: eccezione {e.__class__.__name__}: {e}\nESITO: FERMO")
        sys.exit(2)

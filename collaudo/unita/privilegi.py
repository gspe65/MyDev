"""Cerca negli eseguibili dell'unita' la richiesta di privilegi nel manifesto.

    python -X utf8 -B privilegi.py <radice> <cartella di lavoro>

Legge i byte di ogni .exe; un manifesto che chiede requireAdministrator o highestAvailable e' un rosso.
Una sonda, un .exe vero nella cartella di lavoro, deve accendersi.

Che cosa NON guarda: le richieste fatte a run-time con ShellExecute, le DLL, il rilevamento degli installatori di Windows sui programmi a 32 bit senza manifesto.

Uscite: 0 verde, 1 rosso, 2 fermo.
"""
import os
import pathlib
import sys

sys.stdout.reconfigure(encoding="utf-8")
CHIAVI = [b"requireadministrator", b"highestavailable"]
BLOCCO = 16 * 1024 * 1024


def chiede(percorso):
    coda = b""
    with open(percorso, "rb") as h:
        while True:
            blocco = h.read(BLOCCO)
            if not blocco:
                return False
            dati = (coda + blocco).lower()
            if any(c in dati for c in CHIAVI):
                return True
            coda = blocco[-32:]


def principale():
    radice, lavoro = sys.argv[1], pathlib.Path(sys.argv[2])
    viste, colpi = 0, []
    for cartella, _, nomi in os.walk(radice):
        for n in nomi:
            if not n.lower().endswith(".exe"):
                continue
            f = os.path.join(cartella, n)
            if os.path.islink(f):
                continue
            viste += 1
            if chiede(f):
                colpi.append(os.path.relpath(f, radice).replace("\\", "/"))
    print(f"eseguibili letti: {viste}; con la richiesta di privilegi: {len(colpi)}")
    for c in colpi:
        print("  ROSSO", c)
    # Una sonda per chiave: una chiave tolta dall'elenco spegnerebbe la sua.
    sonda = lavoro / "sonda-privilegi.exe"
    accese = 0
    for livello in ("requireAdministrator", "highestAvailable"):
        sonda.write_bytes(b'MZ <requestedExecutionLevel level="' + livello.encode() + b'" uiAccess="false"/>')
        accese += chiede(sonda)
        sonda.unlink()
    accesa = accese == len(CHIAVI) == 2
    print(f"sonde: accese {accese} su 2, una per livello")
    if viste == 0 or not accesa:
        print("ESITO: FERMO")
        return 2
    if colpi:
        print("ESITO: ROSSO")
        return 1
    print("ESITO: VERDE")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(principale())
    except SystemExit:
        raise
    except BaseException as e:
        print(f"FERMO: eccezione {e.__class__.__name__}: {e}\nESITO: FERMO")
        sys.exit(2)

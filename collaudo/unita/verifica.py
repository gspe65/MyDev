"""Verifica le uscite di esegui.sh.

    python verifica.py <log> <cartella-uscite> <progetti>

1. La tabella di confronta.sh appaiata PER NOME con l'atteso, nei due versi.
2. L'uscita di ogni programma contro il blocco "Cosa devi vedere" del suo LEGGIMI.md,
   con un modo di confronto dichiarato per progetto.

Che cosa NON guarda: l'output di 15-segnali (interattivo), l'ordine delle righe dove il
LEGGIMI stesso dice che cambia, i numeri (PID, porte, date) dove il modo e' "numeri".
Sonde false in coda: un rilevatore che non dice mai DIVERSO non vale.
"""
import os
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
COMUNI = ["01-ciao", "02-argomenti", "03-file-testo", "04-memoria-dinamica",
          "05-struct-file-binario", "06-redirezione", "07-thread",
          "08-thread-asincrono", "09-produttore-consumatore"]
# il primo errore di clang per ciascuno dei 12
PROCESSI = {"10-fork": "'sys/wait.h' file not found",
            "11-zombie-e-orfani": "'sys/wait.h' file not found",
            "12-exec": "'sys/wait.h' file not found",
            "13-pipe": "'sys/wait.h' file not found",
            "14-fifo": "'sys/wait.h' file not found",
            "15-segnali": "use of undeclared identifier 'SIGUSR1'",
            "16-allarme": "variable has incomplete type 'struct sigaction'",
            "17-memoria-condivisa": "'sys/mman.h' file not found",
            "18-semafori": "'sys/mman.h' file not found",
            "19-processi-asincroni": "'sys/wait.h' file not found",
            "20-attesa-con-timeout": "'poll.h' file not found",
            "21-socket": "'sys/socket.h' file not found"}
GCC_ATTESO = {"15-segnali": "interattivo", "16-allarme": "OK (esce 1, voluto)"}

# modo di confronto: esatto | insieme (ordine libero) | numeri (cifre -> N, ordine libero)
# | estremi (prima e ultima riga) | argv0 (riga 1 a parte)
MODO = {"01-ciao": "esatto", "02-argomenti": "argv0", "03-file-testo": "esatto",
        "04-memoria-dinamica": "esatto", "05-struct-file-binario": "esatto",
        "06-redirezione": "esatto", "07-thread": "insieme",
        "08-thread-asincrono": "estremi", "09-produttore-consumatore": "estremi",
        "10-fork": "numeri", "11-zombie-e-orfani": "numeri", "12-exec": "numeri",
        "13-pipe": "estremi", "14-fifo": "esatto", "16-allarme": "esatto",
        # 18: senza semaforo e' una gara: la riga degli incrementi persi c'e' solo se la gara si perde
        "17-memoria-condivisa": "esatto", "18-semafori": "numeri-gara",
        # 20: il LEGGIMI dichiara che le attese a vuoto variano di uno
        "19-processi-asincroni": "numeri", "20-attesa-con-timeout": "estremi-numeri",
        "21-socket": "numeri"}


def righe_tabella(log):
    out = {}
    for r in log.splitlines():
        m = re.match(r"  (\d\d-[a-z-]+)\s{2,}(.+?)\s{2,}(OK|NO)(?:\s+(.*))?$", r)
        if m:
            out[m.group(1)] = (m.group(2).strip(), m.group(3), (m.group(4) or "").strip())
    return out


def verifica_tabella(tab):
    errori = 0
    attesi = COMUNI + list(PROCESSI)
    for n in attesi:
        if n not in tab:
            print(f"  ATTESO SENZA RIGA: {n}"); errori += 1; continue
        g, c, motivo = tab[n]
        g_atteso = GCC_ATTESO.get(n, "OK")
        c_atteso = "OK" if n in COMUNI else "NO"
        m_atteso = "" if n in COMUNI else PROCESSI[n]
        ok = g == g_atteso and c == c_atteso and m_atteso.startswith(motivo) and (motivo or not m_atteso)
        if not ok:
            print(f"  DIVERSO {n}: gcc={g!r} clang={c!r} motivo={motivo!r}"); errori += 1
    for n in tab:
        if n not in attesi:
            print(f"  RIGA SENZA ATTESO: {n}"); errori += 1
    return errori


def atteso_leggimi(progetti, nome):
    fam = "c-comuni" if nome in COMUNI else "c-processi"
    t = open(os.path.join(progetti, fam, nome, "LEGGIMI.md"), encoding="utf-8").read()
    m = re.search(r"## Cosa devi vedere\n\n```\n(.*?)\n```", t, re.S)
    return m.group(1).split("\n")


def pulisci(righe):
    # \r: la barra di 08 riscrive la riga; conta l'ultimo pezzo
    return [r.split("\r")[-1] for r in righe]


def confronta(modo, att, usc):
    usc = pulisci(usc)
    if modo == "esatto":
        return att == usc
    if modo == "insieme":
        return sorted(att) == sorted(usc)
    if modo == "numeri":
        n = lambda rr: sorted(re.sub(r"\d+", "N", x) for x in rr)
        return n(att) == n(usc)
    if modo == "numeri-gara":
        n = lambda rr: sorted(re.sub(r"\d+", "N", x.replace("<- MANCANO INCREMENTI", "")).rstrip() for x in rr)
        return n(att) == n(usc)
    if modo == "estremi":
        return bool(usc) and att[0] == usc[0] and att[-1] == usc[-1]
    if modo == "estremi-numeri":
        n = lambda x: re.sub(r"\d+", "N", x)
        return bool(usc) and n(att[0]) == n(usc[0]) and n(att[-1]) == n(usc[-1])
    if modo == "argv0":
        return att[1:] == usc[1:] and usc[0].startswith("mi chiamo          : ") and usc[0].endswith(("argomenti", "argomenti.exe"))
    raise ValueError(modo)


def main():
    log_p, out_d, progetti = sys.argv[1:4]
    log = open(log_p, encoding="utf-8", errors="replace").read()
    if "INIZIO esegui" not in log or "FINE esegui" not in log:
        print("ROTTO: log senza marcatore di inizio o di fine"); return 2

    tab = righe_tabella(log)
    print(f"tabella: {len(tab)} righe lette (attese {len(COMUNI) + len(PROCESSI)})")
    e_tab = verifica_tabella(tab)
    print(f"tabella: {e_tab} differenze dall'atteso")

    e_out = 0
    confronti = 0
    for nome, modo in MODO.items():
        att = atteso_leggimi(progetti, nome)
        for cc in (("gcc", "clang") if nome in COMUNI else ("gcc",)):
            p = os.path.join(out_d, f"{nome}.{cc}.txt")
            usc = open(p, encoding="utf-8", errors="replace").read().rstrip("\n").split("\n")
            esito = confronta(modo, att, usc)
            confronti += 1
            print(f"  {'UGUALE ' if esito else 'DIVERSO'} {nome:27s} {cc:5s} ({modo})")
            if not esito:
                e_out += 1
                print("      atteso : " + " | ".join(att))
                print("      uscita : " + " | ".join(pulisci(usc)))
    print(f"uscite: {confronti} confronti, {e_out} diversi (attesi confronti: 9*2 + 11 = 29)")

    # sonde false: devono dare DIVERSO
    s1 = confronta("esatto", ["Ciao, mondo!"], ["Ciao, mondo!", "in piu'"])
    s2 = confronta("numeri", ["pid 12"], ["PID 12"])
    t2 = dict(tab); t2["01-ciao"] = ("OK", "NO", "x")
    s3 = verifica_tabella(t2) > e_tab
    s4 = confronta("numeri-gara", ["contatore = 9  <- MANCANO INCREMENTI"], ["contatore sbagliato = 9"])
    print(f"sonde false: esatto={'DIVERSO' if not s1 else 'ROTTO'} "
          f"numeri={'DIVERSO' if not s2 else 'ROTTO'} tabella={'DIVERSO' if s3 else 'ROTTO'} "
          f"gara={'DIVERSO' if not s4 else 'ROTTO'}")
    # Una sonda per ogni altro modo, e l'elenco dei modi sondati appaiato a quello dei modi usati.
    altre = {
        "insieme": confronta("insieme", ["a", "b"], ["a", "c"]),
        "estremi": confronta("estremi", ["prima", "mezzo", "ultima"], ["prima", "mezzo", "un'altra"]),
        "estremi-numeri": confronta("estremi-numeri", ["inizio 1", "fine 2"], ["inizio 1", "finito 2"]),
        "argv0": confronta("argv0", ["mi chiamo          : x", "uno"], ["mi chiamo          : argomenti.exe", "due"]),
    }
    sondati = {"esatto", "numeri", "numeri-gara"} | set(altre)
    usati = set(MODO.values())
    print("sonde dei modi: " + " ".join(f"{k}={'DIVERSO' if not v else 'ROTTO'}" for k, v in altre.items())
          + f"; modi usati {len(usati)}, sondati {len(usati & sondati)}, senza sonda: {' '.join(sorted(usati - sondati)) or 'nessuno'}")
    print(f"totale: tabella {len(tab)}, confronti {confronti}")
    if any(altre.values()) or usati - sondati:
        print("ROTTO: una sonda dei modi non dice DIVERSO, o un modo non ha sonda")
        return 2
    return 0 if (e_tab == 0 and e_out == 0) else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except Exception as e:  # noqa: BLE001
        print(f"ROTTO: eccezione: {e}")
        sys.exit(2)

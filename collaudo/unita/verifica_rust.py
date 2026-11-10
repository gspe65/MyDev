"""Verifica la versione Rust dei progetti C.

    python verifica_rust.py <log di esegui_rust.sh> <cartella uscite-rust> <progetti>

1. L'appaiamento coi progetti C, per nome e nei due versi.
2. Ogni progetto compila senza avvisi ed esce col valore del C.
3. L'uscita contro il blocco "Cosa devi vedere" del LEGGIMI del C, coi modi di verifica.py.
4. Le chiamate POSIX del sorgente C sono dichiarate in `unsafe extern "C"`.
5. Il LEGGIMI del progetto Rust ha lo stesso atteso del C, e dice dove sta l'unsafe.

Che cosa NON guarda: la riga di mezzo dove il modo e' "estremi" (08, 09, 13, 20); i numeri
dove il modo e' "numeri"; l'editor; che le chiamate dichiarate siano usate bene. Il numero delle chiamate
POSIX controllate si stampa e non si confronta con un atteso: una chiamata non dichiarata la rifiuta il compilatore.
I modi di confronto sono quelli di verifica.py, che ha una sonda per ciascuno.
Ogni differenza col C sta in DICHIARATE, una per progetto. Sonde false in coda.
Uscite: 0 verde, 1 rosso, 2 rotto (un'eccezione compresa).
"""
import pathlib
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")
# Il Python dell'unita' ha il percorso dei moduli chiuso: la cartella dello script non ci sta da sola.
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import verifica  # noqa: E402

ATTESI = 23
# 15 si guida con i segnali veri: il suo atteso e' confrontabile, a meno dei numeri
MODO = dict(verifica.MODO, **{"15-segnali": "numeri"})
USCITA_ATTESA = {"16-allarme": 1}
SINGOLI = {"simple": "rust-simple", "multifile": "rust-multifile"}
FAMIGLIE = {"c-comuni": "rust-comuni", "c-processi": "rust-processi"}
POSIX = ("fork", "wait", "waitpid", "execlp", "pipe", "dup", "dup2", "open", "read", "write", "close",
         "mkfifo", "unlink", "kill", "getpid", "getppid", "sigaction", "sigemptyset", "alarm", "sleep",
         "mmap", "munmap", "sem_init", "sem_wait", "sem_post", "sem_destroy", "poll", "socket", "bind",
         "listen", "accept", "connect", "getsockname", "_exit")
# il C dei progetti su file, memoria e thread usa le funzioni della libreria C: qui la libreria standard di Rust
SENZA_CHIAMATE_POSIX = {"03-file-testo", "04-memoria-dinamica", "05-struct-file-binario", "07-thread",
                        "08-thread-asincrono", "09-produttore-consumatore"}
# Le differenze dal C, ciascuna col suo motivo. Il blocco del LEGGIMI Rust puo' differire solo qui.
DICHIARATE = {
    "02-argomenti": "argv[0] e' il percorso sotto target/debug, perche' il programma lo lancia cargo",
    "13-pipe": "la cartella di un progetto cargo ha un file in piu': 6 righe invece di 5",
    "15-segnali": "guidato coi segnali veri; il progetto C non e' eseguito dal kit",
}
ULTIMA_13 = "[padre] righe ricevute: 6"


def appaia(progetti):
    """Coppie (nome, cartella C, cartella Rust), piu' i due elenchi degli spaiati. Enumera il disco dai due lati."""
    p = pathlib.Path(progetti)
    c, r = {}, {}
    for s, q in SINGOLI.items():
        if (p / s).is_dir():
            c[s] = p / s
        if (p / q).is_dir():
            r[s] = p / q
    for fc, fr in FAMIGLIE.items():
        for d in sorted((p / fc).iterdir()) if (p / fc).is_dir() else []:
            if d.is_dir():
                c[d.name] = d
        for d in sorted((p / fr).iterdir()) if (p / fr).is_dir() else []:
            if d.is_dir():
                r[d.name] = d
    coppie = [(n, c[n], r[n]) for n in sorted(c) if n in r]
    return coppie, sorted(set(c) - set(r)), sorted(set(r) - set(c))


def blocco(leggimi):
    m = re.search(r"## Cosa devi vedere\n\n```\n(.*?)\n```", leggimi, re.S)
    return m.group(1).split("\n") if m else None


def righe_log(log, parola):
    return {m.group(1): (int(m.group(2)), m.group(3))
            for m in re.finditer(rf"^{parola} (\S+): uscita (\d+)(?: avvisi (\d+))?\r?$", log, re.M)}


def confronta(nome, att, usc):
    if nome == "13-pipe":
        att = att[:-1] + [ULTIMA_13]
    return verifica.confronta(MODO[nome], att, usc)


def chiamate_mancanti(c_testo, rust_testo):
    blocchi = re.findall(r'unsafe extern "C" \{(.*?)^\}', rust_testo, re.S | re.M)
    dichiarate = set(re.findall(r"\bfn (\w+)\(", " ".join(blocchi)))
    # le righe di commento del C nominano altre funzioni: si tolgono
    senza_commenti = re.sub(r"/\*.*?\*/", " ", c_testo, flags=re.S)
    usate = {f for f in POSIX if re.search(rf"\b{f}\(", senza_commenti)}
    return sorted(usate - dichiarate), len(usate)


def controlla_leggimi(nome, l_rust, att_c):
    """Torna l'elenco dei difetti del LEGGIMI Rust."""
    difetti = []
    att_r = blocco(l_rust)
    if att_r is None:
        return ["manca il blocco Cosa devi vedere"]
    if att_c is not None and att_r != att_c and nome not in DICHIARATE:
        difetti.append("atteso diverso dal C senza dichiarazione")
    if nome == "13-pipe" and att_r[-1] != ULTIMA_13:
        difetti.append("ultima riga diversa da quella dichiarata")
    if "## Dove sta l'`unsafe`" not in l_rust:
        difetti.append("manca la sezione sull'unsafe")
    return difetti


def controlla_unsafe(l_rust, sorgenti):
    """La prima parola della sezione deve dire se l'unsafe c'e', e il sorgente lo smentisce o no."""
    m = re.search(r"## Dove sta l'`unsafe`\n\n(\S+)", l_rust)
    if not m:
        return "sezione assente"
    dice_nessuno = m.group(1).startswith("Nessuno")
    ha_unsafe = bool(re.search(r"\bunsafe\b", re.sub(r"//.*", "", sorgenti)))
    if dice_nessuno == ha_unsafe:
        return f"il LEGGIMI dice {'nessuno' if dice_nessuno else 'che c e'}, il sorgente il contrario"
    return ""


def main():
    log_p, out_d, progetti = sys.argv[1:4]
    log = open(log_p, encoding="utf-8", errors="replace").read()
    if "INIZIO esegui_rust" not in log or "FINE esegui_rust" not in log:
        print("ROTTO: log senza marcatore di inizio o di fine")
        return 2

    errori = 0
    coppie, senza_rust, senza_c = appaia(progetti)
    print(f"appaiamento: {len(coppie)} coppie (attese {ATTESI})")
    for n in senza_rust:
        print(f"  ROSSO progetto C senza versione Rust: {n}")
    for n in senza_c:
        print(f"  ROSSO versione Rust senza progetto C: {n}")
    errori += len(senza_rust) + len(senza_c)
    if len(coppie) != ATTESI:
        print(f"  ROSSO coppie {len(coppie)}, attese {ATTESI}")
        errori += 1

    compila, esegue = righe_log(log, "COMPILA"), righe_log(log, "ESEGUE")
    confronti = chiamate_viste = 0
    usc_d = pathlib.Path(out_d)
    for nome, dir_c, dir_r in coppie:
        difetti = []
        # 1) compila ed esce come il C
        rc_c, avvisi = compila.get(nome, (None, None))
        if rc_c != 0:
            difetti.append(f"non compila (uscita {rc_c})")
        elif avvisi != "0":
            difetti.append(f"avvisi {avvisi}")
        rc = esegue.get(nome, (None, None))[0]
        if rc != USCITA_ATTESA.get(nome, 0):
            difetti.append(f"uscita {rc}, attesa {USCITA_ATTESA.get(nome, 0)}")

        # 2) l'uscita contro l'atteso del C
        u = usc_d / f"{nome}.rust.txt"
        usc = u.read_text(encoding="utf-8", errors="replace").rstrip("\n").split("\n") if u.exists() else None
        att_c = None
        if usc is None:
            difetti.append("uscita assente")
        elif nome in SINGOLI:
            usc_c = (usc_d / f"{nome}.c.txt").read_text(encoding="utf-8", errors="replace").rstrip("\n").split("\n")
            confronti += 1
            if usc != usc_c:
                difetti.append(f"uscita diversa dal C: {usc} / {usc_c}")
        else:
            att_c = blocco((dir_c / "LEGGIMI.md").read_text(encoding="utf-8"))
            confronti += 1
            if not confronta(nome, att_c, usc):
                difetti.append("uscita diversa: " + " | ".join(usc))

        # 3) le chiamate POSIX e il LEGGIMI
        sorgenti = "\n".join(p.read_text(encoding="utf-8") for p in sorted((dir_r / "src").glob("*.rs")))
        c_testo = "\n".join(p.read_text(encoding="utf-8") for p in sorted(dir_c.glob("*.c")))
        if nome not in SENZA_CHIAMATE_POSIX and nome not in SINGOLI:
            mancanti, viste = chiamate_mancanti(c_testo, sorgenti)
            chiamate_viste += viste
            if mancanti:
                difetti.append("chiamate POSIX non dichiarate: " + ", ".join(mancanti))
        l_rust = (dir_r / "LEGGIMI.md").read_text(encoding="utf-8") if (dir_r / "LEGGIMI.md").exists() else ""
        difetti += controlla_leggimi(nome, l_rust, att_c)
        d = controlla_unsafe(l_rust, sorgenti)
        if d:
            difetti.append(d)

        print(f"  {'UGUALE ' if not difetti else 'ROSSO  '} {nome}")
        for x in difetti:
            print(f"      {x}")
        errori += 1 if difetti else 0

    print(f"uscite: {confronti} confronti | chiamate POSIX controllate: {chiamate_viste}")
    print("differenze dichiarate: " + "; ".join(f"{k}: {v}" for k, v in DICHIARATE.items()))

    # Sonde false: gli stessi predicati del verdetto, su dati sbagliati.
    c_sonda = "int main(void){ pid_t f = fork(); }"
    s1 = chiamate_mancanti(c_sonda, 'unsafe extern "C" {\n    fn getpid() -> i32;\n}\n')[0] == ["fork"]
    s2 = controlla_unsafe("## Dove sta l'`unsafe`\n\nNessuno.", "unsafe { x() }") != ""
    s3 = controlla_leggimi("01-ciao", "## Cosa devi vedere\n\n```\nCiao\n```\n", ["Addio"]) != []
    s4 = not confronta("16-allarme", ["a"], ["b"])
    print(f"sonde false: chiamate={'ACCESA' if s1 else 'ROTTA'} unsafe={'ACCESA' if s2 else 'ROTTA'} "
          f"leggimi={'ACCESA' if s3 else 'ROTTA'} uscita={'ACCESA' if s4 else 'ROTTA'}")
    if not (s1 and s2 and s3 and s4):
        print("ROTTO: una sonda non si accende")
        return 2
    print(f"totale: coppie {len(coppie)}, confronti {confronti}, rossi {errori}")
    return 0 if errori == 0 else 1


if __name__ == "__main__":
    try:
        sys.exit(main())
    except SystemExit:
        raise
    except Exception as e:  # noqa: BLE001
        print(f"ROTTO: eccezione: {e}")
        sys.exit(2)

"""L'ambiente dei programmi dell'unita', appaiato nelle sue quattro copie.

    python -X utf8 -B collaudo/unita/ambienti.py [--sonde]

L'ambiente sta scritto in quattro posti: il lanciatore (ricetta/unita/lancia.c), i collegamenti di ripiego
(ricetta/unita/fallback/comune.bat), il terminale del kit (collaudo/unita/terminale.bat) e l'editor del gate
(collaudo/unita/gate.ps1). Una variabile aggiunta in uno e dimenticata in un altro non da' errore: la prova gira
con un ambiente diverso da quello di chi usa l'unita'. Qui si confrontano i NOMI, nei due versi, per la parte
comune e per quella dell'unita' estesa, con le eccezioni dichiarate qui sotto. In piu', gli script dell'editor
(vscodium\\<nome>.py: la lingua, l'insieme delle estensioni) che il lanciatore di VSCodium e il suo .bat di ripiego
lanciano: gli stessi nomi nei due versi. E le righe di comando intere, fra il lanciatore (i letterali di componi) e i
.bat di ripiego (VSCodium.bat, Chromium.bat), con la radice al posto di %ls e di %BASE%: per ogni script dell'editor
interprete (python o pythonw), opzioni e argomenti; per l'editor eseguibile e argomenti (la cartella dei progetti su cui
si apre); per Chromium eseguibile, profilo, opzioni e pagina d'avvio. Una riga diversa nomina gli argomenti che sono
solo nell'una o solo nell'altra. Infine
l'interprete che il passo A9 del gate conta fra i processi accesi deve essere quello con cui il lanciatore avvia
l'insieme: con un altro, A9 conterebbe zero per sempre.

Con --sonde, in coda: un nome tolto da una copia e uno aggiunto devono dare DIVERSO, e cosi' uno script tolto dal
ripiego; e, passando dal lettore dei .bat, l'interprete dell'insieme cambiato, un'opzione tolta alla lingua,
un'opzione tolta a Chromium e la cartella dei progetti tolta all'editor (il DIVERSO deve nominarla); e un interprete
diverso contato dal gate.

Uscite: 0 verde, 1 rosso (nomina le variabili), 2 fermo (un file manca, o una copia non si legge).

Che cosa NON guarda: i valori (le forme Windows e POSIX sono scelte per programma, lo dicono i commenti delle copie);
le variabili che il lanciatore toglie; l'ordine degli script dell'editor e se il lancio aspetta la fine (il lanciatore
aspetta la lingua fino a 10 secondi, il .bat fino alla fine); la cartella di lavoro dei programmi lanciati; i comandi
degli altri strumenti (terminale, Neovim, AlgoDesign, Progetti).
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


def script_editor(testo):
    """I nomi degli script vscodium\\<nome>.py lanciati: una o due barre, nel C e nel .bat."""
    return set(re.findall(r"vscodium\\{1,2}(\w+)\.py", testo))


def confronta_script(lanciatore, ripiego):
    return [f"script dell'editor: {n} nel lanciatore e non nel ripiego" for n in sorted(lanciatore - ripiego)] + \
           [f"script dell'editor: {n} nel ripiego e non nel lanciatore" for n in sorted(ripiego - lanciatore)]


def chiave_comando(riga):
    """Lo script dell'editor, l'editor o Chromium che la riga lancia, o None."""
    m = re.search(r'\\vscodium\\(\w+)\.py"', riga)
    if m:
        return m.group(1)
    if '\\vscodium\\VSCodium.exe"' in riga:
        return "editor"
    return "chromium" if '\\chromium\\chrome.exe"' in riga else None


def argomenti(riga):
    """Le parole di una riga di comando: un tratto fra virgolette (con gli spazi dentro) o una parola senza spazi."""
    return re.findall(r'"[^"]*"|\S+', riga)


def comandi_lanciatore(testo):
    """{script o chromium: riga di comando} dai letterali di componi in lancia.c, con <R> per la radice."""
    uscita = {}
    for lit in re.findall(r'componi\(\s*(?:appoggio|comando)\s*,\s*L"((?:[^"\\]|\\.)*)"', testo):
        riga = re.sub(r"\\(.)", r"\1", lit).replace("%ls", "<R>")
        k = chiave_comando(riga)
        if k:
            uscita[k] = " ".join(riga.split())
    return uscita


def comandi_ripiego(testo):
    """{script o chromium: riga di comando} dalle righe di un .bat, con <R> per la radice: senza start "" e senza i
    rinvii a nul, che non sono argomenti."""
    uscita = {}
    for riga in testo.splitlines():
        r = riga.strip()
        if re.match(r"(rem\b|::|cd\b)", r, re.I):
            continue
        r = re.sub(r'^start\s+""\s+', "", r, flags=re.I)
        r = re.sub(r"(\s+\d?>\s*nul)+$", "", r, flags=re.I).replace("%BASE%", "<R>")
        k = chiave_comando(r)
        if k:
            uscita[k] = " ".join(r.split())
    return uscita


def confronta_comandi(lanciatore, ripiego):
    d = []
    for k in sorted(set(lanciatore) | set(ripiego)):
        a, b = lanciatore.get(k), ripiego.get(k)
        if b is None:
            d.append(f"comando di {k}: nel lanciatore e non nel ripiego")
        elif a is None:
            d.append(f"comando di {k}: nel ripiego e non nel lanciatore")
        elif a != b:
            # Gli argomenti dell'uno che l'altro non ha, per nome: un argomento tolto si legge senza confrontare due righe a occhio.
            pa, pb = argomenti(a), argomenti(b)
            solo_l = [x for x in pa if x not in pb]
            solo_r = [x for x in pb if x not in pa]
            nomi = "; ".join([f"solo nel lanciatore {x}" for x in solo_l] + [f"solo nel ripiego {x}" for x in solo_r]) or "stessi argomenti, in un altro ordine o ripetuti"
            d.append(f"comando di {k}: {nomi}: lanciatore [{a}] ripiego [{b}]")
    return d


def interprete_gate(testo):
    """Il processo che il passo A9 del gate conta: la riga di $Avvisi."""
    m = re.search(r"\$Avvisi = .*?\$_\.Name -eq '([\w.]+)'", testo)
    if not m:
        fermo("il conteggio di A9 ($Avvisi ... $_.Name -eq '<eseguibile>') non si trova in gate.ps1")
    return m.group(1).lower()


def confronta_interprete(comandi, contato):
    m = re.match(r'"<R>\\python\\([\w.]+)"', comandi.get("insieme", ""))
    usato = m.group(1).lower() if m else None
    if usato != contato:
        return [f"il gate (A9) conta {contato}, il lanciatore avvia l'insieme con {usato}"]
    return []


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
    lanc = leggi("ricetta/unita/lancia.c")
    bat_editor = leggi("ricetta/unita/fallback/VSCodium.bat")
    bat_chromium = leggi("ricetta/unita/fallback/Chromium.bat")
    sl = script_editor(lanc)
    sr = script_editor(bat_editor)
    print(f"script dell'editor: lanciatore {len(sl)} ({' '.join(sorted(sl))}), ripiego {len(sr)} ({' '.join(sorted(sr))})")
    if not sl or not sr:
        fermo("nessuno script dell'editor letto: il lettore non l'ha visto")
    cl = comandi_lanciatore(lanc)
    cr = {**comandi_ripiego(bat_editor), **comandi_ripiego(bat_chromium)}
    print(f"righe di comando: lanciatore {len(cl)} ({' '.join(sorted(cl))}), ripiego {len(cr)} ({' '.join(sorted(cr))})")
    for k in sorted(cl):
        print(f"  {k}: {cl[k]}")
    # Il lettore deve aver visto ogni script dell'editor, l'editor e Chromium: un comando non letto non si confronta. Il ripiego
    # che non ha una riga la dice DIVERSO (nel lanciatore e non nel ripiego), non qui.
    if set(cl) != sl | {"editor", "chromium"}:
        fermo(f"righe di comando del lanciatore lette {sorted(cl)}, attese {sorted(sl | {'editor', 'chromium'})}")
    contato = interprete_gate(leggi("collaudo/unita/gate.ps1"))
    print(f"interprete contato da A9 nel gate: {contato}")
    diff = confronta(l, copie) + confronta_script(sl, sr) + confronta_comandi(cl, cr) + confronta_interprete(cl, contato)
    for d in diff:
        print(f"DIVERSO: {d}")
    print(f"differenze: {len(diff)}")
    if sonde:
        tolto = {k: set(v) for k, v in copie.items()}
        tolto["gate, estesa"].discard(sorted(tolto["gate, estesa"])[0])
        aggiunto = {k: set(v) for k, v in copie.items()}
        aggiunto["terminale del kit, parte comune"].add("SONDA_IN_PIU")
        esiti = {"tolto": bool(confronta(l, tolto)), "aggiunto": bool(confronta(l, aggiunto)),
                 "script tolto": bool(confronta_script(sl, sr - {sorted(sr)[-1]}))}
        # Le righe di comando: una mutazione del testo del .bat, riletta dallo stesso lettore. Ogni mutazione deve
        # toccare il testo una volta sola, o la sonda non prova nulla.
        # L'ultimo elemento, se c'e', e' cio' che il DIVERSO deve nominare.
        mutazioni = [
            ("interprete dell'insieme", bat_editor, "pythonw.exe\" -I -B \"%BASE%\\vscodium\\insieme.py", "python.exe\" -I -B \"%BASE%\\vscodium\\insieme.py", None),
            ("opzione tolta alla lingua", bat_editor, "-I -B \"%BASE%\\vscodium\\lingua.py", "-B \"%BASE%\\vscodium\\lingua.py", None),
            ("opzione tolta a Chromium", bat_chromium, " --disable-extensions", "", None),
            ("cartella dei progetti tolta all'editor", bat_editor, "VSCodium.exe\" \"%BASE%\\progetti\"", "VSCodium.exe\"",
             "comando di editor: solo nel lanciatore \"<R>\\progetti\""),
        ]
        for nome, testo, vecchio, nuovo, nomina in mutazioni:
            toccate = testo.count(vecchio)
            mutato = comandi_ripiego(testo.replace(vecchio, nuovo))
            altro = bat_chromium if testo is bat_editor else bat_editor
            righe = confronta_comandi(cl, {**comandi_ripiego(altro), **mutato})
            esiti[nome] = toccate == 1 and bool(righe) and (nomina is None or any(r.startswith(nomina) for r in righe))
            # Non «DIVERSO:»: il gate riporta quelle righe come differenze vere.
            print(f"  sonda {nome}: occorrenze toccate {toccate}" + "".join(f"\n    la sonda vede: {r}" for r in righe))
        esiti["interprete contato dal gate"] = bool(confronta_interprete(cl, "python.exe" if contato != "python.exe" else "pythonw.exe"))
        print("sonde: " + " ".join(f"{k}={'DIVERSO' if v else 'UGUALE'}" for k, v in esiti.items()))
        print(f"sonde accese: {sum(esiti.values())} su {len(esiti)}")
        if not all(esiti.values()):
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

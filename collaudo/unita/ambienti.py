"""L'ambiente dei programmi dell'unita', appaiato nelle sue quattro copie.

    python -X utf8 -B collaudo/unita/ambienti.py [--sonde]

L'ambiente sta scritto in quattro posti: il lanciatore (ricetta/unita/lancia.c), i collegamenti di ripiego
(ricetta/unita/fallback/comune.bat), il terminale del kit (collaudo/unita/terminale.bat) e l'editor del gate
(collaudo/unita/gate.ps1). Una variabile aggiunta in uno e dimenticata in un altro non da' errore: la prova gira
con un ambiente diverso da quello di chi usa l'unita'. Qui si confrontano i NOMI, nei due versi, per la parte
comune e per quella dell'unita' estesa, con le eccezioni dichiarate qui sotto. In piu', gli script dell'editor
(vscodium\\<nome>.py: la lingua, l'insieme delle estensioni) che il lanciatore di VSCodium e il suo .bat di ripiego
lanciano: gli stessi nomi nei due versi. E le righe di comando intere, fra il lanciatore (le chiamate di componi, con i
letterali uniti, le macro e gli argomenti al loro posto) e i .bat di ripiego (ogni collegamento della cartella
fallback, tranne comune.bat che e' l'ambiente), nei due versi: una riga per ogni script dell'editor e per ogni
collegamento alla radice (VSCodium, Chromium, AlgoDesign, Terminale, Neovim, Progetti), con la radice al posto di
radice e di %BASE%, la cartella di Windows al posto di sistema e di %SystemRoot%, il PATH del terminale al posto di
PATH_TERMINALE e di %PATH_TERM%, e un parametro di funzione (il titolo e il comando del terminale) col valore di ogni
chiamata. Per ogni riga interprete o eseguibile, opzioni e argomenti; una riga diversa nomina gli argomenti che sono
solo nell'una o solo nell'altra, e una riga che sta in due .bat e' diversa. Infine
l'interprete che il passo A9 del gate conta fra i processi accesi deve essere quello con cui il lanciatore avvia
l'insieme: con un altro, A9 conterebbe zero per sempre.

Con --sonde, in coda: un nome tolto da una copia e uno aggiunto devono dare DIVERSO, e cosi' uno script tolto dal
ripiego; e, passando dal lettore dei .bat, l'interprete dell'insieme cambiato, un'opzione tolta alla lingua,
un'opzione tolta a Chromium, la cartella dei progetti tolta all'editor e a Progetti, un argomento in piu' ad AlgoDesign,
la misura della finestra del Terminale cambiata, il programma di Neovim cambiato e il .bat di Neovim vuoto (il DIVERSO
deve nominare l'argomento o la riga); e, nell'altro verso, la riga di AlgoDesign tolta dal lanciatore; e un interprete
diverso contato dal gate. Il numero delle sonde e' dichiarato (SONDE_ATTESE): uno diverso e' un fermo.

Uscite: 0 verde, 1 rosso (nomina le variabili), 2 fermo (un file manca, una copia non si legge, un .bat di ripiego in
piu' o in meno di quelli dichiarati, un numero di sonde diverso da quello dichiarato).

Che cosa NON guarda: i valori (le forme Windows e POSIX sono scelte per programma, lo dicono i commenti delle copie;
anche il PATH del terminale, che nelle righe e' solo il suo segnaposto); le variabili che il lanciatore toglie; l'ordine
degli script dell'editor e se il lancio aspetta la fine (il lanciatore aspetta la lingua fino a 10 secondi, il .bat fino
alla fine); la cartella di lavoro dei programmi lanciati e la cartella home che il terminale crea prima di partire.
"""
import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
AIUTANTI = {"BASE", "DRIVE", "UBASE", "PATH_TERM", "SONDA"}
# Il terminale del kit lancia solo bash: non gli servono il PATH di Windows ne' le variabili per i programmi dell'editor.
SOLO_EDITOR = {"PATH", "MYDEV_RADICE", "MYDEV_RADICE_POSIX", "MYDEV_MSYS", "ProgramW6432"}
# I segnaposti delle righe di comando: gli argomenti di componi in lancia.c, le variabili dei .bat che valgono lo stesso, le
# macro di lancia.c che stanno in una riga. Un argomento che non e' qui resta <nome>, e la riga non torna con quella del .bat.
SEGNAPOSTI_C = {"radice": "<R>", "sistema": "<S>"}
SEGNAPOSTI_BAT = {"%BASE%": "<R>", "%SystemRoot%": "<S>", "%PATH_TERM%": "<PATH_TERM>"}
MACRO_C = {"PATH_TERMINALE": "<PATH_TERM>"}
# Le righe di comando del lanciatore oltre agli script dell'editor: una per collegamento alla radice.
COMANDI = {"editor", "chromium", "algodesign", "terminale", "neovim", "progetti"}
# I collegamenti di ripiego della cartella fallback, uno per collegamento alla radice (comune.bat e' l'ambiente).
RIPIEGHI = ["AlgoDesign.bat", "Chromium.bat", "Neovim.bat", "Progetti.bat", "Terminale.bat", "VSCodium.bat"]
# Le sonde di --sonde, quante ne dichiara questo file: una che sparisce dall'elenco e' un fermo, non un verde piu' corto.
SONDE_ATTESE = 14


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
    """Lo script dell'editor o il collegamento alla radice che la riga lancia, o None."""
    m = re.search(r'\\vscodium\\(\w+)\.py"', riga)
    if m:
        return m.group(1)
    for pezzo, chiave in (('\\vscodium\\VSCodium.exe"', "editor"), ('\\chromium\\chrome.exe"', "chromium"),
                          ('\\algodesign\\AlgoDesign.exe"', "algodesign"), ('\\explorer.exe"', "progetti")):
        if pezzo in riga:
            return chiave
    # Il Terminale e Neovim lanciano lo stesso mintty: li distingue il titolo della finestra.
    m = re.search(r'\\mintty\.exe" -t "(\w+)"', riga)
    return m.group(1).lower() if m else None


def argomenti(riga):
    """Le parole di una riga di comando: un tratto fra virgolette (con gli spazi dentro) o una parola senza spazi."""
    return re.findall(r'"[^"]*"|\S+', riga)


def letterale(s):
    """Il testo di un letterale del C, senza le sequenze di escape (\\\\, \\", \\n)."""
    return re.sub(r"\\(.)", lambda m: "\n" if m.group(1) == "n" else m.group(1), s)


def argomenti_della_chiamata(testo, inizio):
    """Gli argomenti di una chiamata del C, da dopo la sua parentesi aperta: virgole e parentesi dentro un letterale non
    contano. None se la chiamata non si chiude."""
    pezzi, corrente, profondita, i = [], "", 0, inizio
    while i < len(testo):
        c = testo[i]
        if c == '"':
            j = i + 1
            while j < len(testo) and testo[j] != '"':
                j += 2 if testo[j] == "\\" else 1
            corrente += testo[i:j + 1]
            i = j + 1
            continue
        if c == "(":
            profondita += 1
        elif c == ")":
            if profondita == 0:
                pezzi.append(corrente.strip())
                return pezzi
            profondita -= 1
        elif c == "," and profondita == 0:
            pezzi.append(corrente.strip())
            corrente = ""
            i += 1
            continue
        corrente += c
        i += 1
    return None


def espandi(formato, valori, macro, legati):
    """La riga composta da una chiamata di componi: i letterali uniti, ogni macro di MACRO_C col suo segnaposto (e i suoi
    %l. consumano i loro argomenti), ogni %l. sostituito dal suo argomento: radice e sistema col segnaposto, un parametro
    della funzione col valore della chiamata, il resto <espressione>. None con una macro che non e' in MACRO_C."""
    riga, resto = "", list(valori)
    for lit, nome in re.findall(r'L"((?:[^"\\]|\\.)*)"|(\w+)', formato):
        if nome:
            if nome not in MACRO_C or nome not in macro:
                return None
            for _ in re.findall(r"%l[scu]", macro[nome]):
                if resto:
                    resto.pop(0)
            riga += MACRO_C[nome]
            continue
        testo = letterale(lit)
        pos = 0
        for m in re.finditer(r"%l[scu]", testo):
            a = resto.pop(0) if resto else "?"
            riga += testo[pos:m.start()] + (SEGNAPOSTI_C.get(a) or legati.get(a) or f"<{a}>")
            pos = m.end()
        riga += testo[pos:]
    return riga


def comandi_lanciatore(testo):
    """{script o collegamento: riga di comando} dalle chiamate di componi(appoggio|comando, ...) di lancia.c, coi segnaposti.
    Una chiamata dentro una funzione che usa i parametri da' una riga per ogni chiamata della funzione (prepara_terminale per
    il Terminale e per Neovim). Torna anche le chiavi che due righe danno insieme (un collegamento composto due volte)."""
    macro = dict(re.findall(r'^#define\s+(\w+)\s+L"((?:[^"\\]|\\.)*)"', testo, re.M))
    funzioni = []
    for m in re.finditer(r"^(?:static\s+\w+|int\s+WINAPI)\s+(\w+)\s*\(([^)]*)\)\s*\{", testo, re.M):
        parametri = [p.split()[-1].lstrip("*") for p in m.group(2).split(",") if p.strip() not in ("", "void", "...")]
        funzioni.append((m.start(), m.group(1), parametri))

    def chiamate_di(nome):
        uscita = []
        for m in re.finditer(rf"(?<![\w*]){nome}\s*\(", testo):
            inizio_riga = testo.rfind("\n", 0, m.start()) + 1
            if re.match(r"\s*static\b", testo[inizio_riga:m.start()]):
                continue
            a = argomenti_della_chiamata(testo, m.end())
            if a is not None:
                uscita.append(a)
        return uscita

    uscita, doppie = {}, []
    for m in re.finditer(r"(?<![\w*])componi\s*\(", testo):
        a = argomenti_della_chiamata(testo, m.end())
        if a is None or len(a) < 2 or a[0] not in ("appoggio", "comando"):
            continue
        prima = [f for f in funzioni if f[0] < m.start()]
        nome_f, parametri = (prima[-1][1], prima[-1][2]) if prima else (None, [])
        legami = [{}]
        if any(x in parametri for x in a[2:]):
            legami = []
            for c in chiamate_di(nome_f):
                valori = [letterale(v.group(1)) if (v := re.fullmatch(r'L"((?:[^"\\]|\\.)*)"', x)) else f"<{x}>" for x in c]
                legami.append(dict(zip(parametri, valori)))
        for legato in legami:
            riga = espandi(a[1], a[2:], macro, legato)
            k = chiave_comando(riga) if riga else None
            if not k:
                continue
            if k in uscita:
                doppie.append(k)
            uscita[k] = " ".join(riga.split())
    return uscita, doppie


def comandi_ripiego(testo):
    """{script o collegamento: riga di comando} dalle righe di un .bat, coi segnaposti: senza start "" e senza i rinvii a
    nul, che non sono argomenti."""
    uscita = {}
    for riga in testo.splitlines():
        r = riga.strip()
        if re.match(r"(rem\b|::|cd\b)", r, re.I):
            continue
        r = re.sub(r'^start\s+""\s+', "", r, flags=re.I)
        r = re.sub(r"(\s+\d?>\s*nul)+$", "", r, flags=re.I)
        for variabile, segnaposto in SEGNAPOSTI_BAT.items():
            r = re.sub(re.escape(variabile), lambda _m, s=segnaposto: s, r, flags=re.I)
        k = chiave_comando(r)
        if k:
            uscita[k] = " ".join(r.split())
    return uscita


def comandi_dei_ripieghi(bats):
    """Le righe di tutti i .bat di ripiego insieme; le differenze per una riga che sta in due .bat; i .bat senza righe."""
    uscita, dove, diff, vuoti = {}, {}, [], []
    for nome, testo in bats.items():
        righe = comandi_ripiego(testo)
        if not righe:
            vuoti.append(nome)
        for k, v in righe.items():
            if k in uscita:
                diff.append(f"comando di {k}: in due ripieghi, {dove[k]} e {nome}")
            uscita[k], dove[k] = v, nome
    return uscita, diff, vuoti


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
    # I .bat di ripiego dalla cartella, contro l'elenco dichiarato nei due versi: uno nuovo non resterebbe fuori dal confronto.
    trovati = sorted(p.name for p in (REPO / "ricetta" / "unita" / "fallback").glob("*.bat") if p.name.lower() != "comune.bat")
    print(f"collegamenti di ripiego: {len(trovati)} ({' '.join(trovati)}), dichiarati {len(RIPIEGHI)}")
    if trovati != sorted(RIPIEGHI):
        fermo(f"i .bat di ripiego {trovati} non sono quelli dichiarati {sorted(RIPIEGHI)}")
    bats = {n: leggi(f"ricetta/unita/fallback/{n}") for n in RIPIEGHI}
    sl = script_editor(lanc)
    sr = script_editor(bats["VSCodium.bat"])
    print(f"script dell'editor: lanciatore {len(sl)} ({' '.join(sorted(sl))}), ripiego {len(sr)} ({' '.join(sorted(sr))})")
    if not sl or not sr:
        fermo("nessuno script dell'editor letto: il lettore non l'ha visto")
    cl, doppie_l = comandi_lanciatore(lanc)
    cr, doppie_r, vuoti = comandi_dei_ripieghi(bats)
    print(f"righe di comando: lanciatore {len(cl)} ({' '.join(sorted(cl))}), ripiego {len(cr)} ({' '.join(sorted(cr))})")
    for k in sorted(cl):
        print(f"  {k}: {cl[k]}")
    # Il lettore deve aver visto ogni script dell'editor e ogni collegamento, una volta: un comando non letto non si confronta.
    # Un .bat senza la sua riga e' un lettore cieco (fermo); il ripiego che non ha una riga la dice DIVERSO, non qui.
    if set(cl) != sl | COMANDI or doppie_l:
        fermo(f"righe di comando del lanciatore lette {sorted(cl)} (due volte: {doppie_l}), attese {sorted(sl | COMANDI)}")
    if vuoti:
        fermo(f"nessuna riga di comando letta nei .bat di ripiego {vuoti}: il lettore non l'ha vista")
    contato = interprete_gate(leggi("collaudo/unita/gate.ps1"))
    print(f"interprete contato da A9 nel gate: {contato}")
    diff = confronta(l, copie) + confronta_script(sl, sr) + doppie_r + confronta_comandi(cl, cr) + confronta_interprete(cl, contato)
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
        # Le righe di comando: una mutazione del testo di un .bat, riletta dallo stesso lettore. Ogni mutazione deve
        # toccare il testo una volta sola, o la sonda non prova nulla. L'ultimo elemento e' cio' che il DIVERSO deve nominare.
        mutazioni = [
            ("interprete dell'insieme", "VSCodium.bat", "pythonw.exe\" -I -B \"%BASE%\\vscodium\\insieme.py", "python.exe\" -I -B \"%BASE%\\vscodium\\insieme.py",
             "comando di insieme: solo nel lanciatore \"<R>\\python\\pythonw.exe\""),
            ("opzione tolta alla lingua", "VSCodium.bat", "-I -B \"%BASE%\\vscodium\\lingua.py", "-B \"%BASE%\\vscodium\\lingua.py",
             "comando di lingua: solo nel lanciatore -I"),
            ("opzione tolta a Chromium", "Chromium.bat", " --disable-extensions", "", "comando di chromium: solo nel lanciatore --disable-extensions"),
            ("cartella dei progetti tolta all'editor", "VSCodium.bat", "VSCodium.exe\" \"%BASE%\\progetti\"", "VSCodium.exe\"",
             "comando di editor: solo nel lanciatore \"<R>\\progetti\""),
            ("cartella dei progetti tolta a Progetti", "Progetti.bat", "explorer.exe\" \"%BASE%\\progetti\"", "explorer.exe\"",
             "comando di progetti: solo nel lanciatore \"<R>\\progetti\""),
            ("argomento in piu' ad AlgoDesign", "AlgoDesign.bat", "AlgoDesign.exe\"", "AlgoDesign.exe\" --sonda",
             "comando di algodesign: solo nel ripiego --sonda"),
            ("misura della finestra del Terminale", "Terminale.bat", "--geometry=96x32", "--geometry=80x24",
             "comando di terminale: solo nel lanciatore --geometry=96x32"),
            ("programma di Neovim cambiato", "Neovim.bat", "&& nvim\"", "&& vim\"", "comando di neovim: solo nel lanciatore nvim\""),
            ("il .bat di Neovim vuoto", "Neovim.bat", bats["Neovim.bat"], "", "comando di neovim: nel lanciatore e non nel ripiego"),
        ]
        for nome, bat, vecchio, nuovo, nomina in mutazioni:
            toccate = bats[bat].count(vecchio)
            mutato, doppie_m, _ = comandi_dei_ripieghi({**bats, bat: bats[bat].replace(vecchio, nuovo)})
            righe = doppie_m + confronta_comandi(cl, mutato)
            esiti[nome] = toccate == 1 and bool(righe) and any(r.startswith(nomina) for r in righe)
            # Non «DIVERSO:»: il gate riporta quelle righe come differenze vere.
            print(f"  sonda {nome}: occorrenze toccate {toccate}" + "".join(f"\n    la sonda vede: {r}" for r in righe))
        # L'altro verso: una riga che il lanciatore non compone piu' (AlgoDesign tolto da lancia.c) e che il ripiego ha ancora.
        vecchio = 'componi(comando, L"\\"%ls\\\\algodesign\\\\AlgoDesign.exe\\"", radice);'
        toccate = lanc.count(vecchio)
        senza, _ = comandi_lanciatore(lanc.replace(vecchio, ""))
        righe = confronta_comandi(senza, cr)
        esiti["riga di AlgoDesign tolta dal lanciatore"] = toccate == 1 and any(r.startswith("comando di algodesign: nel ripiego e non nel lanciatore") for r in righe)
        print(f"  sonda riga di AlgoDesign tolta dal lanciatore: occorrenze toccate {toccate}" + "".join(f"\n    la sonda vede: {r}" for r in righe))
        esiti["interprete contato dal gate"] = bool(confronta_interprete(cl, "python.exe" if contato != "python.exe" else "pythonw.exe"))
        print("sonde: " + " ".join(f"{k}={'DIVERSO' if v else 'UGUALE'}" for k, v in esiti.items()))
        print(f"sonde accese: {sum(esiti.values())} su {len(esiti)}, dichiarate {SONDE_ATTESE}")
        if len(esiti) != SONDE_ATTESE:
            fermo(f"sonde nell'elenco {len(esiti)}, dichiarate {SONDE_ATTESE}")
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
        fermo(f"eccezione: {e!r}")

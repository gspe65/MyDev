"""Verifica il banco degli esempi delle lezioni, su Windows e su Linux.

Uso, dalla cartella del codice del corso (lo script trova i file da dove sta):
    python -B strumenti/verifica_esempi.py

Ogni esempio in esempi/lezNN/ ha una riga in esempi/ESITI.txt:
    percorso | tipo | atteso

Tipi di esito:
  uscita         compila senza avvisi, esce con 0, e stampa esattamente l'atteso
                 (righe separate da « ; »); in C esce pulito anche con ASan
  esegue         come uscita, ma la stampa cambia a ogni corsa e non si confronta
  asan           ASan segnala l'errore atteso, e senza ASan non c'e' la segnalazione
  asan_ritorno   come asan, e dopo « ; » si puo' dichiarare la stampa senza ASan;
                 si compila con -fsanitize-address-use-after-return=always:
                 su Windows, senza quell'opzione, lo stack use-after-return non si vede
  avviso         compila, e clang segnala l'avviso atteso
  errore         non si compila, e clang stampa il messaggio atteso
  collega        si compila con -c, ma il collegamento fallisce citando il simbolo atteso
  modulo         si compila con -c senza avvisi, ma da solo non si collega: manca main
  codice         compila senza avvisi, esce con il codice atteso e stampa le righe
                 attese: l'atteso e' «codice ; riga ; riga»
  perdita       su Linux LeakSanitizer segnala la perdita; su Windows si controlla
                 che ASan esca con 0, cioe' che la perdita li' non si veda
  rustc          non compila, e l'unico codice d'errore e' quello atteso
  panico         compila senza avvisi, esce con 101, e stderr contiene l'atteso
  crollo         compila senza avvisi e finisce con lo stack esaurito
  prova          in Rust: compilato con --test senza avvisi, esce con 0 e il
                 riepilogo delle prove contiene l'atteso («2 passed»)

Un programma con accanto un file .in lo riceve sullo standard input.

Che cosa controlla inoltre:
  - appaiamento nei due versi: ogni sorgente ha un esito, ogni esito un sorgente;
  - sonde false: esiti volutamente sbagliati, che devono dare ROTTO.

Che cosa NON guarda (uno zero qui vale solo per cio' che sta sopra):
  - se l'esempio insegna quel che deve, o usa solo cio' che gli alunni hanno gia'
    visto: si rilegge a mano;
  - se i materiali citano davvero questi file: si controlla a mano.
"""

import os
import re
import shutil
import subprocess
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

RADICE = Path(__file__).resolve().parent.parent
ESEMPI = RADICE / "esempi"
ELENCO = ESEMPI / "ESITI.txt"
SU_LINUX = os.name != "nt"
EDIZIONE = "2024"
TIPI_C = {"uscita", "esegue", "asan", "asan_ritorno", "avviso", "errore", "collega", "modulo", "codice", "perdita"}
TIPI_RUST = {"uscita", "esegue", "rustc", "panico", "crollo", "prova"}
SENZA_ATTESO = {"esegue", "perdita", "crollo", "modulo"}


@dataclass
class Esito:
    percorso: str
    tipo: str
    atteso: str


def trova_clang():
    if os.environ.get("CLANG"):
        return Path(os.environ["CLANG"])
    if shutil.which("clang"):
        return Path(shutil.which("clang"))
    sys.exit("ROTTO: clang non trovato (imposta la variabile CLANG)")


def leggi_esiti():
    """Le righe di ESITI.txt. Le parti sono separate da « | »."""
    esiti = []
    for numero, riga in enumerate(ELENCO.read_text(encoding="utf-8").splitlines(), 1):
        if not riga.strip() or riga.startswith("#"):
            continue
        parti = [p.strip() for p in riga.split("|", 2)]
        if len(parti) != 3:
            sys.exit(f"ROTTO: ESITI.txt, riga {numero}: servono tre parti separate da |")
        esiti.append(Esito(*parti))
    return esiti


def sorgenti_del_banco():
    return sorted(
        p.relative_to(ESEMPI).as_posix()
        for p in ESEMPI.rglob("*")
        if p.suffix in (".c", ".rs")
    )


def appaia(esiti, sorgenti):
    """Nei due versi: restituisce (sorgenti senza esito, esiti senza sorgente, doppioni)."""
    elencati = [e.percorso for e in esiti]
    doppioni = sorted({p for p in elencati if elencati.count(p) > 1})
    return sorted(set(sorgenti) - set(elencati)), sorted(set(elencati) - set(sorgenti)), doppioni


class Strumenti:
    def __init__(self, cartella):
        self.clang = trova_clang()
        self.cartella = Path(cartella)
        self.ambiente = dict(os.environ)
        self.ambiente["PATH"] = str(self.clang.parent) + os.pathsep + self.ambiente.get("PATH", "")
        self.progressivo = 0

    def eseguibile(self):
        self.progressivo += 1
        nome = f"es{self.progressivo}" + (".exe" if not SU_LINUX else "")
        return self.cartella / nome

    def c(self, sorgente, *opzioni):
        destinazione = self.eseguibile()
        esito = subprocess.run(
            [str(self.clang), "-Wall", "-Wextra", "-g", *opzioni, "-o", str(destinazione), str(sorgente)],
            capture_output=True, env=self.ambiente,
        )
        return esito, destinazione

    def oggetto(self, sorgente):
        """Solo compilazione, fino al file oggetto, senza collegare."""
        destinazione = self.eseguibile().with_suffix(".o")
        esito = subprocess.run(
            [str(self.clang), "-Wall", "-Wextra", "-Werror", "-g", "-c", "-o", str(destinazione), str(sorgente)],
            capture_output=True, env=self.ambiente,
        )
        return esito

    def rust(self, sorgente, *opzioni):
        destinazione = self.eseguibile()
        esito = subprocess.run(
            ["rustc", "--edition", EDIZIONE, "--error-format=short", *opzioni, "-o", str(destinazione), str(sorgente)],
            capture_output=True, env=self.ambiente,
        )
        return esito, destinazione

    def lancia(self, eseguibile, sorgente):
        ingresso = sorgente.with_suffix(".in")
        dati = ingresso.read_bytes() if ingresso.exists() else b""
        return subprocess.run([str(eseguibile)], input=dati, capture_output=True, timeout=120, env=self.ambiente)


def testo(byte):
    return byte.decode("utf-8", "replace").replace("\r\n", "\n").strip("\n")


def righe_attese(atteso):
    return atteso.split(" ; ") if atteso else []


def stampa_giusta(esito, atteso):
    return testo(esito.stdout).split("\n") == righe_attese(atteso) or (not atteso and not testo(esito.stdout))


def una_delle(atteso, messaggio):
    return any(alternativa.strip() in messaggio for alternativa in atteso.split(" oppure "))


def controlla_c(sorgente, tipo, atteso, st):
    """Restituisce None se l'esito e' quello atteso, altrimenti il problema."""
    if tipo in ("uscita", "esegue"):
        compila, exe = st.c(sorgente, "-Werror")
        if compila.returncode != 0:
            return "non compila senza avvisi: " + testo(compila.stderr)[:300]
        for etichetta, opzioni in (("senza ASan", ()), ("con ASan", ("-fsanitize=address",))):
            if opzioni:
                compila, exe = st.c(sorgente, "-Werror", *opzioni)
                if compila.returncode != 0:
                    return "non compila con ASan"
            corsa = st.lancia(exe, sorgente)
            if corsa.returncode != 0 or testo(corsa.stderr):
                return f"{etichetta}: uscita {corsa.returncode}, stderr «{testo(corsa.stderr)[:200]}»"
            if tipo == "uscita" and not stampa_giusta(corsa, atteso):
                return f"{etichetta}: stampa «{testo(corsa.stdout)[:200]}», attesa «{atteso}»"
        return None

    if tipo == "avviso":
        compila, _ = st.c(sorgente)
        if compila.returncode != 0:
            return "non compila: " + testo(compila.stderr)[:300]
        if atteso not in testo(compila.stderr):
            return f"manca l'avviso {atteso}: «{testo(compila.stderr)[:200]}»"
        return None

    if tipo == "errore":
        compila, _ = st.c(sorgente)
        if compila.returncode == 0:
            return "si compila, invece di dare un errore"
        if atteso not in testo(compila.stderr):
            return f"manca il messaggio «{atteso}»: «{testo(compila.stderr)[:200]}»"
        return None

    if tipo in ("collega", "modulo"):
        oggetto = st.oggetto(sorgente)
        if oggetto.returncode != 0:
            return "non si compila con -c: " + testo(oggetto.stderr)[:300]
        collega, _ = st.c(sorgente)
        if collega.returncode == 0:
            return "il collegamento riesce, invece di fallire"
        cercato = atteso if tipo == "collega" else "main"
        if cercato not in testo(collega.stderr):
            return f"il linker non cita «{cercato}»: «{testo(collega.stderr)[:200]}»"
        return None

    if tipo == "codice":
        codice, _, resto = atteso.partition(" ; ")
        for etichetta, opzioni in (("senza ASan", ()), ("con ASan", ("-fsanitize=address",))):
            compila, exe = st.c(sorgente, "-Werror", *opzioni)
            if compila.returncode != 0:
                return "non compila senza avvisi: " + testo(compila.stderr)[:300]
            corsa = st.lancia(exe, sorgente)
            if str(corsa.returncode) != codice:
                return f"{etichetta}: codice di uscita {corsa.returncode}, atteso {codice}"
            if not stampa_giusta(corsa, resto):
                return f"{etichetta}: stampa «{testo(corsa.stdout)[:200]}», attesa «{resto}»"
        return None

    if tipo in ("asan", "asan_ritorno", "perdita"):
        # asan_ritorno: dopo « ; » si puo' dichiarare che cosa stampa il programma senza ASan
        atteso, _, stampa_senza = atteso.partition(" ; ") if tipo == "asan_ritorno" else (atteso, "", "")
        compila, senza = st.c(sorgente)
        if compila.returncode != 0:
            return "non compila: " + testo(compila.stderr)[:300]
        extra = ["-fsanitize-address-use-after-return=always"] if tipo == "asan_ritorno" else []
        compila, con = st.c(sorgente, "-fsanitize=address", *extra)
        if compila.returncode != 0:
            return "non compila con ASan"
        corsa_senza = st.lancia(senza, sorgente)
        corsa_con = st.lancia(con, sorgente)
        messaggio = testo(corsa_con.stderr)
        if "Sanitizer" in testo(corsa_senza.stderr):
            return "senza ASan c'e' gia' una segnalazione"
        if stampa_senza and testo(corsa_senza.stdout) != stampa_senza:
            return f"senza ASan stampa «{testo(corsa_senza.stdout)[:200]}», attesa «{stampa_senza}»"
        if tipo == "perdita":
            if not SU_LINUX:
                return None if corsa_con.returncode == 0 else f"su Windows ASan esce con {corsa_con.returncode}"
            atteso = "LeakSanitizer: detected memory leaks"
        if corsa_con.returncode == 0 or not una_delle(atteso, messaggio):
            return f"ASan non segnala «{atteso}» (uscita {corsa_con.returncode}): «{messaggio[:200]}»"
        return None
    return f"tipo «{tipo}» non previsto per il C"


def controlla_rust(sorgente, tipo, atteso, st):
    if tipo == "rustc":
        compila, _ = st.rust(sorgente)
        codici = sorted(set(re.findall(r"error\[(E\d{4})\]", testo(compila.stderr))))
        if compila.returncode == 0:
            return "compila, invece di dare un errore"
        if codici != [atteso]:
            return f"codici {codici}, atteso {atteso}"
        return None

    if tipo == "prova":
        compila, exe = st.rust(sorgente, "--test", "-D", "warnings")
        if compila.returncode != 0:
            return "non compila con --test senza avvisi: " + testo(compila.stderr)[:300]
        corsa = st.lancia(exe, sorgente)
        if corsa.returncode != 0 or atteso not in testo(corsa.stdout):
            return f"uscita {corsa.returncode}, riepilogo «{testo(corsa.stdout)[-200:]}»"
        return None

    compila, exe = st.rust(sorgente, "-D", "warnings")
    if compila.returncode != 0:
        return "non compila senza avvisi: " + testo(compila.stderr)[:300]
    corsa = st.lancia(exe, sorgente)
    if tipo in ("uscita", "esegue"):
        if corsa.returncode != 0 or testo(corsa.stderr):
            return f"uscita {corsa.returncode}, stderr «{testo(corsa.stderr)[:200]}»"
        if tipo == "uscita" and not stampa_giusta(corsa, atteso):
            return f"stampa «{testo(corsa.stdout)[:200]}», attesa «{atteso}»"
        return None
    if tipo == "panico":
        if corsa.returncode != 101 or atteso not in testo(corsa.stderr):
            return f"uscita {corsa.returncode}, stderr «{testo(corsa.stderr)[:200]}»"
        return None
    if tipo == "crollo":
        if corsa.returncode == 0 or "overflowed its stack" not in testo(corsa.stderr):
            return f"uscita {corsa.returncode}, stderr «{testo(corsa.stderr)[:200]}»"
        return None
    return f"tipo «{tipo}» non previsto per Rust"


def controlla(percorso, tipo, atteso, st):
    sorgente = Path(percorso)
    ammessi, funzione = (TIPI_C, controlla_c) if sorgente.suffix == ".c" else (TIPI_RUST, controlla_rust)
    if tipo not in ammessi:
        return f"tipo «{tipo}» non ammesso per {sorgente.suffix}"
    if tipo not in SENZA_ATTESO and tipo != "uscita" and not atteso:
        return "manca l'atteso"
    return funzione(sorgente, tipo, atteso, st)


C_SALUTA = '#include <stdio.h>\nint main(void)\n{\n    printf("uno\\n");\n    return 0;\n}\n'
C_ERRORE = "int main(void)\n{\n    return soma;\n}\n"
C_RITORNO = '#include <stdio.h>\nint *f(void)\n{\n    int x = 42;\n    int *p = &x;\n    return p;\n}\nint main(void)\n{\n    int *p = f();\n    printf("%d\\n", *p);\n    return 0;\n}\n'
C_SENZA_DEFINIZIONE = "int triplo(int x);\nint main(void)\n{\n    return triplo(1);\n}\n"
RUST_SALUTA = 'fn main() {\n    println!("uno");\n}\n'
RUST_ERRORE = "fn main() {\n    let x = 1;\n    x = 2;\n    println!(\"{x}\");\n}\n"
RUST_PANICO = 'fn main() {\n    let v = vec![1];\n    let i = v.len();\n    println!("{}", v[i]);\n}\n'
RUST_PROVA_ROTTA = 'fn main() {}\n#[test]\nfn sbagliata() {\n    assert_eq!(1, 2);\n}\n'

# (nome, sorgente, estensione, tipo, atteso): ognuna deve risultare ROTTO.
SONDE = [
    ("C, stampa diversa", C_SALUTA, ".c", "uscita", "due"),
    ("C, righe in piu' attese", C_SALUTA, ".c", "uscita", "uno ; due"),
    ("C pulito dichiarato errore di ASan", C_SALUTA, ".c", "asan", "stack-buffer-overflow"),
    ("C pulito dichiarato stack use-after-return", C_SALUTA, ".c", "asan_ritorno", "stack-use-after-return"),
    ("C use-after-return, stampa senza ASan sbagliata", C_RITORNO, ".c", "asan_ritorno", "stack-use-after-return ; 41"),
    ("C pulito dichiarato con un avviso", C_SALUTA, ".c", "avviso", "-Wformat"),
    ("C con un tipo solo di Rust", C_SALUTA, ".c", "rustc", "E0382"),
    ("C pulito dichiarato errore di compilazione", C_SALUTA, ".c", "errore", "undeclared"),
    ("C con errore, messaggio sbagliato", C_ERRORE, ".c", "errore", "expected ';'"),
    ("C completo dichiarato collegamento fallito", C_SALUTA, ".c", "collega", "triplo"),
    ("C, collegamento fallito su un altro simbolo", C_SENZA_DEFINIZIONE, ".c", "collega", "quadruplo"),
    ("C con main dichiarato modulo", C_SALUTA, ".c", "modulo", ""),
    ("C, codice di uscita diverso", C_SALUTA, ".c", "codice", "1 ; uno"),
    ("C, codice giusto e stampa diversa", C_SALUTA, ".c", "codice", "0 ; due"),
    ("Rust, stampa diversa", RUST_SALUTA, ".rs", "uscita", "due"),
    ("Rust che compila dichiarato errore", RUST_SALUTA, ".rs", "rustc", "E0382"),
    ("Rust con il codice d'errore sbagliato", RUST_ERRORE, ".rs", "rustc", "E0382"),
    ("Rust dichiarato panico che esce bene", RUST_SALUTA, ".rs", "panico", "index out of bounds"),
    ("Rust, panico con il messaggio sbagliato", RUST_PANICO, ".rs", "panico", "divide by zero"),
    ("Rust dichiarato crollo che esce bene", RUST_SALUTA, ".rs", "crollo", ""),
    ("Rust senza prove dichiarato con due prove", RUST_SALUTA, ".rs", "prova", "2 passed"),
    ("Rust con una prova che fallisce", RUST_PROVA_ROTTA, ".rs", "prova", "1 passed"),
]
if SU_LINUX:
    SONDE.append(("C pulito dichiarato perdita", C_SALUTA, ".c", "perdita", ""))


def prova_sonde(st, cartella):
    """Restituisce (quante, quante hanno detto ROTTO)."""
    viste = 0
    for indice, (nome, sorgente, estensione, tipo, atteso) in enumerate(SONDE):
        file = Path(cartella) / f"sonda{indice}{estensione}"
        file.write_text(sorgente, encoding="utf-8")
        problema = controlla(file, tipo, atteso, st)
        if problema:
            viste += 1
            print(f"  sonda falsa «{nome}»: ROTTO, come deve")
        else:
            print(f"  ROTTO: la sonda falsa «{nome}» e' passata per buona")
    return len(SONDE), viste


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    esiti = leggi_esiti()
    sorgenti = sorgenti_del_banco()
    senza_esito, senza_sorgente, doppioni = appaia(esiti, sorgenti)
    problemi = len(senza_esito) + len(senza_sorgente) + len(doppioni)
    print(f"A. Appaiamento: {len(sorgenti)} sorgenti, {len(esiti)} esiti")
    for p in senza_esito:
        print(f"  ROTTO: {p} non ha un esito")
    for p in senza_sorgente:
        print(f"  ROTTO: l'esito di {p} non ha un sorgente")
    for p in doppioni:
        print(f"  ROTTO: {p} ha piu' di un esito")

    # L'appaiamento deve saper dire di no.
    falso_senza, falso_orfano, _ = appaia(esiti[1:], sorgenti)
    if falso_senza == [esiti[0].percorso] and not falso_orfano:
        print("  controllo positivo: togliendo un esito, l'appaiamento lo segnala")
    else:
        print("  ROTTO: togliendo un esito l'appaiamento non lo segnala")
        problemi += 1

    print("B. Esempi")
    conteggio = {}
    with tempfile.TemporaryDirectory() as cartella:
        st = Strumenti(cartella)
        for esito in esiti:
            sorgente = ESEMPI / esito.percorso
            if not sorgente.exists():
                continue
            problema = controlla(sorgente, esito.tipo, esito.atteso, st)
            conteggio[esito.tipo] = conteggio.get(esito.tipo, 0) + 1
            if problema:
                print(f"  ROTTO {esito.percorso} ({esito.tipo}): {problema}")
                problemi += 1
            else:
                print(f"  {esito.percorso}: {esito.tipo} come atteso")

        print("C. Sonde false")
        quante, viste = prova_sonde(st, cartella)
        problemi += quante - viste

    riepilogo = ", ".join(f"{tipo} {n}" for tipo, n in sorted(conteggio.items()))
    print(f"esempi per tipo: {riepilogo}")
    print(f"sonde false: {quante}, viste {viste}")
    print(f"sistema: {'Linux' if SU_LINUX else 'Windows'}; rustc {testo(subprocess.run(['rustc', '--version'], capture_output=True).stdout)}")
    print(f"totale: {sum(conteggio.values())} esempi, {problemi} problemi")
    print("VERDE" if problemi == 0 else "ROTTO")
    sys.exit(0 if problemi == 0 else 1)


if __name__ == "__main__":
    main()

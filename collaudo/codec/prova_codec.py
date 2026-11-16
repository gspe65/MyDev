"""Pagina dei codec: serve pagina.html su 127.0.0.1 (porta scelta dal sistema), apre Chromium in una finestra
VISIBILE con un profilo nuovo, aspetta l'esito che la pagina invia, fotografa lo schermo, chiude i processi
di QUEL Chromium (per percorso dell'eseguibile) e dà il verdetto. Il gate con le finestre la fa girare sul chrome.exe
dell'unità (passo A13, «senza»), dopo le aperture di Chromium; il controllo positivo «ufficiale» si misura a mano sulla
release di ungoogled-chromium della stessa versione. I sei campioni sono sintetici, generati con ffmpeg, una traccia
ciascuno; le loro impronte stanno in campioni.sha256 e si controllano prima di aprire Chromium.

  python -X utf8 -B prova_codec.py --chromium <chrome.exe> --profilo <cartella nuova> --uscita <cartella> \
      --nome <prefisso> --atteso senza|ufficiale
  python -X utf8 -B prova_codec.py --sonde

Atteso «senza»: H.264, H.265, AAC: tutte le domande «no» e nessuna decodifica; VP9, AV1, Opus: decodifica.
Atteso «ufficiale» (controllo positivo): H.264 decodifica e canPlayType non vuoto; VP9, AV1, Opus decodifica.
Che cosa NON guarda: altri formati (MP3, Theora, FLAC...); la decodifica in hardware; i contenuti cifrati.
Uscite: 0 VERDE, 1 ROSSO, 2 FERMO (nessun esito dalla pagina, Chromium assente, profilo già esistente, campioni
diversi dalle impronte).
"""
import argparse
import hashlib
import http.server
import json
import os
import subprocess
import sys
import threading
import time
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
QUI = Path(__file__).resolve().parent
PROPRIETARI = ["H.264", "H.265", "AAC"]
LIBERI = ["VP9", "AV1", "Opus"]
FORMATI = PROPRIETARI + LIBERI


def verdetto(risultati, atteso):
    """Una sola funzione per il verdetto: la attraversano il dato vero e le sonde."""
    rossi = []
    per_nome = {r["formato"]: r for r in risultati}
    for f in FORMATI:
        if f not in per_nome:
            rossi.append(f"{f}: assente dall'esito")
    for f in per_nome:
        if f not in FORMATI:
            rossi.append(f"{f}: formato non atteso")
    for f in LIBERI:
        r = per_nome.get(f)
        if r and r.get("decodifica") is not True:
            rossi.append(f"{f}: non decodifica ({r.get('motivo')})")
    if atteso == "senza":
        for f in PROPRIETARI:
            r = per_nome.get(f)
            if not r:
                continue
            if r.get("decodifica") is not False:
                rossi.append(f"{f}: decodifica ({r.get('motivo')})")
            if r.get("canPlayType") != "":
                rossi.append(f"{f}: canPlayType={r.get('canPlayType')!r}")
            for k in ("mse", "infoFile", "infoMse"):
                if r.get(k) is not False:
                    rossi.append(f"{f}: {k}={r.get(k)!r}")
    elif atteso == "ufficiale":
        r = per_nome.get("H.264")
        if r and r.get("decodifica") is not True:
            rossi.append(f"H.264: non decodifica ({r.get('motivo')}): controllo positivo spento")
        if r and r.get("canPlayType") == "":
            rossi.append("H.264: canPlayType vuoto: controllo positivo spento")
    else:
        raise ValueError(atteso)
    return rossi


def tabella(risultati):
    righe = ["formato | canPlayType | MSE | info file | info MSE | decodifica | dettaglio"]
    for r in risultati:
        det = f"{r.get('motivo')}, t={r.get('tempo')}"
        if r.get("fotogrammi") is not None:
            det += f", fotogrammi={r.get('fotogrammi')}"
        if r.get("errore"):
            det += f", {r.get('errore')}"
        righe.append(f"{r['formato']} | {r.get('canPlayType')!r} | {r.get('mse')} | {r.get('infoFile')} | "
                     f"{r.get('infoMse')} | {r.get('decodifica')} | {det}")
    return righe


def sonde():
    buono = [{"formato": f, "decodifica": f in LIBERI, "canPlayType": "probably" if f in LIBERI else "",
              "mse": f in LIBERI, "infoFile": f in LIBERI, "infoMse": f in LIBERI, "motivo": "finto"} for f in FORMATI]
    casi = []
    casi.append(("senza, dato pulito", buono, "senza", 0))
    c = json.loads(json.dumps(buono)); c[0].update(decodifica=True)
    casi.append(("senza, H.264 decodifica", c, "senza", 1))
    c = json.loads(json.dumps(buono)); c[2].update(canPlayType="maybe")
    casi.append(("senza, AAC risponde maybe", c, "senza", 1))
    c = json.loads(json.dumps(buono)); c[1].update(infoMse=True)
    casi.append(("senza, H.265 supportato in MSE", c, "senza", 1))
    c = json.loads(json.dumps(buono)); c[3].update(decodifica=False)
    casi.append(("senza, VP9 non decodifica", c, "senza", 1))
    casi.append(("senza, Opus assente", buono[:5], "senza", 1))
    casi.append(("senza, formato in più", buono + [dict(buono[0], formato="MP3")], "senza", 1))
    casi.append(("ufficiale, H.264 non decodifica", buono, "ufficiale", 1))
    c = json.loads(json.dumps(buono)); c[0].update(decodifica=True, canPlayType="probably")
    casi.append(("ufficiale, H.264 decodifica", c, "ufficiale", 0))
    ok = 0
    for nome, ris, att, rossi_attesi in casi:
        rossi = verdetto(ris, att)
        giusto = (len(rossi) > 0) == (rossi_attesi > 0)
        ok += giusto
        print(f"sonda: {nome}: {'ROSSO' if rossi else 'VERDE'} {rossi[:2]} -> {'come atteso' if giusto else 'SBAGLIATA'}")
    print(f"sonde: {ok}/{len(casi)} come attese")
    return 0 if ok == len(casi) else 1


def foto(percorso, cartella_chromium):
    ps = r"""
param([string]$Uscita, [string]$Radice)
Add-Type -AssemblyName System.Windows.Forms, System.Drawing
Add-Type -Namespace W -Name U -MemberDefinition '[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int n); [DllImport("user32.dll")] public static extern void keybd_event(byte k, byte s, int f, int e);'
$f = @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($Radice + '\', [StringComparison]::OrdinalIgnoreCase) -and $_.MainWindowHandle -ne [IntPtr]::Zero }) | Select-Object -First 1
if ($f) { [W.U]::keybd_event(0x12, 0, 0, 0); [W.U]::keybd_event(0x12, 0, 2, 0); [void][W.U]::ShowWindow($f.MainWindowHandle, 3); [void][W.U]::SetForegroundWindow($f.MainWindowHandle); "finestra: $($f.MainWindowTitle)" } else { "finestra: nessuna" }
Start-Sleep 2
$b = [System.Windows.Forms.Screen]::PrimaryScreen.Bounds
$img = New-Object System.Drawing.Bitmap $b.Width, $b.Height
$g = [System.Drawing.Graphics]::FromImage($img)
$g.CopyFromScreen($b.Location, [System.Drawing.Point]::Empty, $b.Size)
$img.Save($Uscita, [System.Drawing.Imaging.ImageFormat]::Png)
"foto: $Uscita"
"""
    script = Path(percorso).with_suffix(".ps1")
    script.write_text(ps, encoding="utf-8-sig")
    r = subprocess.run(["powershell.exe", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", str(script),
                        "-Uscita", str(percorso), "-Radice", str(cartella_chromium)],
                       capture_output=True, text=True, encoding="utf-8", errors="replace")
    script.unlink()
    return (r.stdout + r.stderr).strip()


def chiudi(cartella_chromium):
    ps = ("$r=@(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith('"
          + str(cartella_chromium) + "\\', [StringComparison]::OrdinalIgnoreCase) }); "
          "$r | Stop-Process -Force -ErrorAction SilentlyContinue; \"chiusi: $($r.Count)\"")
    r = subprocess.run(["powershell.exe", "-NoProfile", "-Command", ps], capture_output=True, text=True,
                       encoding="utf-8", errors="replace")
    return r.stdout.strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chromium")
    ap.add_argument("--profilo")
    ap.add_argument("--uscita")
    ap.add_argument("--nome")
    ap.add_argument("--atteso", choices=["senza", "ufficiale"])
    ap.add_argument("--sonde", action="store_true")
    ap.add_argument("--rileggi", help="un esito .json già salvato: solo il verdetto, nessuna finestra")
    a = ap.parse_args()
    if a.sonde:
        return sonde()
    if a.rileggi and a.atteso:
        d = json.loads(Path(a.rileggi).read_text(encoding="utf-8"))
        print(f"rilettura: {a.rileggi}")
        print(f"programma: {d['programma']}")
        rossi = verdetto(d["risultati"], a.atteso)
        for r in rossi:
            print(f"ROSSO: {r}")
        print(f"ESITO ({a.atteso}): {'VERDE' if not rossi else 'ROSSO'}")
        return 0 if not rossi else 1
    if not (a.chromium and a.profilo and a.uscita and a.nome and a.atteso):
        print("FERMO: servono --chromium --profilo --uscita --nome --atteso")
        return 2
    # I campioni sono quelli delle impronte: un file cambiato cambierebbe la prova senza dirlo.
    attese = {}
    for riga in (QUI / "campioni.sha256").read_text(encoding="utf-8").splitlines():
        if riga.strip():
            impronta, nome = riga.split(maxsplit=1)
            attese[nome.lstrip("*")] = impronta
    presenti = sorted(p.name for p in (QUI / "campioni").iterdir() if p.is_file())
    diversi = [n for n in presenti if hashlib.sha256((QUI / "campioni" / n).read_bytes()).hexdigest() != attese.get(n)]
    print(f"campioni: {len(presenti)} presenti, {len(attese)} nelle impronte, diversi o senza impronta {diversi}")
    if diversi or sorted(attese) != presenti or len(presenti) != len(FORMATI):
        print("FERMO: i campioni non sono quelli delle impronte")
        return 2
    exe = Path(a.chromium).resolve()
    if not exe.is_file():
        print(f"FERMO: Chromium assente: {exe}")
        return 2
    profilo = Path(a.profilo)
    if profilo.exists():
        print(f"FERMO: il profilo esiste già: {profilo}")
        return 2
    uscita = Path(a.uscita)
    uscita.mkdir(parents=True, exist_ok=True)
    esito = {}

    class Gestore(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *x, **k):
            super().__init__(*x, directory=str(QUI), **k)

        def do_POST(self):
            if self.path != "/esito":
                self.send_error(404)
                return
            n = int(self.headers.get("Content-Length", "0"))
            esito["dati"] = json.loads(self.rfile.read(n).decode("utf-8"))
            self.send_response(204)
            self.end_headers()

        def log_message(self, *x):
            pass

    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Gestore)
    porta = server.server_address[1]
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{porta}/pagina.html"
    print(f"chromium: {exe}")
    print(f"profilo: {profilo}")
    print(f"pagina: {url}")
    # Le due opzioni dell'occlusione: una finestra aperta sotto un'altra avrebbe i media sospesi (falso rosso misurato).
    proc = subprocess.Popen([str(exe), f"--user-data-dir={profilo}", "--no-first-run", "--no-default-browser-check",
                             "--disable-backgrounding-occluded-windows",
                             "--disable-features=CalculateNativeWinOcclusion",
                             "--autoplay-policy=no-user-gesture-required", "--window-position=0,0",
                             "--window-size=1280,1000", "--new-window", url])
    t0 = time.time()
    while "dati" not in esito and time.time() - t0 < 120:
        time.sleep(1)
    print(f"attesa dell'esito: {round(time.time() - t0, 1)} s")
    time.sleep(2)
    print(foto(uscita / f"{a.nome}.png", exe.parent))
    print(chiudi(exe.parent))
    try:
        proc.wait(timeout=10)
    except subprocess.TimeoutExpired:
        pass
    server.shutdown()
    if "dati" not in esito:
        print("ESITO: FERMO, la pagina non ha consegnato l'esito")
        return 2
    d = esito["dati"]
    (uscita / f"{a.nome}.json").write_text(json.dumps(d, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"programma: {d['programma']}")
    for riga in tabella(d["risultati"]):
        print(riga)
    print(f"denominatore: formati nell'esito {len(d['risultati'])}, attesi {len(FORMATI)}")
    rossi = verdetto(d["risultati"], a.atteso)
    for r in rossi:
        print(f"ROSSO: {r}")
    print(f"ESITO ({a.atteso}): {'VERDE' if not rossi else 'ROSSO'}")
    return 0 if not rossi else 1


if __name__ == "__main__":
    sys.exit(main())

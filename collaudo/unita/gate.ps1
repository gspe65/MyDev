# Il gate di portabilita' di un'unita' costruita: rifiuta una radice senza spazi doppi e
# fa girare da li' le prove del kit e i rilevatori di percorsi, tracce e privilegi.
#
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File collaudo\unita\gate.ps1 -Unita <cartella con spazi doppi> [-Vsix <file>] [-Altro "<percorso>;<percorso>"] [-Finestre]
#
# Con -Finestre apre l'editor cinque volte, sei nell'estesa: apertura 1 e apertura 1b dal lanciatore (la 1b con una differenza
# finta per il controllo positivo di A9, che apre la finestra di avviso dell'insieme), apertura 2 con progetti e un file C,
# nell'estesa apertura 3 con un progetto Rust, e le due corse di S-E1 (la prima apre anche la finestra "Salva con nome" di
# Windows e la preme: coi tasti solo se e' davanti, col messaggio al pulsante anche dietro; il controllo positivo si ferma
# prima). Apre Chromium tre volte, sulla base e sull'estesa: dal lanciatore, senza lanciatore per il controllo negativo di A13,
# e la pagina dei codec di A13 (prova_codec.py). A16 fa girare l'eseguibile dell'editor come Node, senza finestra, anche senza
# -Finestre. Fotografa cartelle e registro: la finestra puo' prendere la tastiera. Con -Finestre l'unita' non deve essere mai
# stata aperta: se home\chromium esiste gia', A13 e' un fermo (il motore della barra verrebbe da un'apertura precedente); se
# l'editor ha gia' stati di cartella (workspaceStorage) prima dell'apertura 1, E1 dell'apertura 1 e' un fermo.
# Senza, i percorsi si cercano a file fermi e tracce e ascolti dell'editor non si misurano: l'esito lo dice.
# Il lavoro sta accanto all'unita', in una cartella che finisce con spazi doppi, e il kit gira da una sua copia li' dentro.
# Su una copia, la cartella in cui l'unita' e' stata costruita si legge da extensions.json e si cerca anche quella.
#
# Uscite: 0 verde, 1 rosso, 2 fermo (non si e' potuto misurare). Solo ASCII: PowerShell 5.1 legge un .ps1 senza BOM come ANSI.
#
# Le sigle dei passi sono le clausole del collaudo dell'unita': U12 nessun percorso assoluto dopo l'uso, U13 il kit da una
# radice con spazi doppi, U14 un'altra lettera, U15 nulla fuori dall'unita', U16 nessun privilegio, U17 le licenze,
# E9 le stesse sull'unita' estesa, A7 l'editor in italiano (con le finestre, dopo la prima apertura dal lanciatore; sempre
# le sonde dello script della lingua), A9 l'insieme garantito delle estensioni (dopo l'uso; con le finestre anche il
# silenzio del lanciatore sull'unita' intatta, stampato accanto al suo controllo positivo: lo stesso lanciatore con una
# cartella vuota in piu' fra le estensioni lascia acceso il controllo dell'insieme, poi la cartella si toglie e
# estensioni e impostazioni si confrontano con prima), A16 il codice generato dal .vsix dell'unita' che compila e gira sui casi d'uso del corpus (Bun e
# il repository del nucleo, come la costruzione), A13 Chromium dal lanciatore col profilo nell'unita' e la pagina dell'unita'
# all'avvio, con un controllo negativo senza lanciatore, e la pagina dei codec sul suo chrome.exe (con le finestre), E1 lo scenario S-E1 dello studente nell'editor
# dell'unita', dalla pagina del flowchart al punto d'arresto, col suo controllo positivo, e l'editor che dal lanciatore si apre
# sulla cartella progetti (con le finestre; sempre la sonda del suo verdetto, e1-sonda.ps1), E6 le guide
# leggibili (ogni guida .md nostra con la sua copia HTML in guide, tabelle e blocchi di codice uguali, l'indice e la pagina
# di Chromium che lo collega, con le sonde del verdetto).
#
# Che cosa NON guarda: la chiavetta (la si indica come radice); le prove delle estensioni e del nucleo, che hanno le loro;
# una richiesta di privilegi di un programma lanciato a mano dentro l'unita'; le voci di PATH dell'utente; la cartella
# temporanea del PC, che compiti e debug dell'editor usano come ogni programma; un figlio appeso, che non ha un tempo massimo;
# che cosa Chromium decodifica senza le finestre (la pagina dei codec apre Chromium), e il controllo positivo sul dato vero
# della pagina dei codec (la release ufficiale, a mano a ogni versione di Chromium: qui solo le sonde del verdetto);
# un controllo dell'insieme che il lanciatore non riesce ad avviare sul PC di chi usa l'unita' (il lanciatore non lo
# segnala: il gate prova solo che qui parte); che cosa dice la finestra di avviso (le frasi le provano le sonde di insieme.py).

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Unita,
    [string]$Vsix = '',
    [string]$Altro = '',
    [switch]$Finestre
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2

function Scrivi([string]$t) { [Console]::Out.WriteLine($t) }
function Fermo([string]$m) { Scrivi "FERMO: $m"; Scrivi 'ESITO: FERMO'; exit 2 }

function Lancia([string]$exe, [string]$argomenti, [hashtable]$ambiente) {
    $psi = New-Object Diagnostics.ProcessStartInfo
    $psi.FileName = $exe
    $psi.Arguments = $argomenti
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    if ($null -ne $ambiente) { foreach ($k in $ambiente.Keys) { $psi.EnvironmentVariables[$k] = $ambiente[$k] } }
    $pr = [Diagnostics.Process]::Start($psi)
    $o = $pr.StandardOutput.ReadToEndAsync()
    $e = $pr.StandardError.ReadToEndAsync()
    $pr.WaitForExit()
    return New-Object PSObject -Property @{ Uscita = $pr.ExitCode; Testo = ($o.Result + $e.Result) }
}

$script:Passi = New-Object Collections.Generic.List[object]
function Annota([string]$clausola, [string]$cosa, [int]$uscita) {
    $script:Passi.Add((New-Object PSObject -Property @{ Clausola = $clausola; Cosa = $cosa; Uscita = $uscita }))
    Scrivi ("--- {0} {1}: uscita {2}" -f $clausola, $cosa, $uscita)
}

function Passo([string]$clausola, [string]$nome, [string]$exe, [string]$argomenti) {
    $r = Lancia $exe $argomenti $null
    [IO.File]::WriteAllText((Join-Path $Lav "$nome.log"), $r.Testo, $Utf8)
    foreach ($riga in ($r.Testo -split "`r?`n")) {
        # Il rientro non nasconde un rosso: alcune prove lo elencano con due spazi davanti.
        if ($riga -match '^\s*(ESITO|FERMO|ROSSO|NON COMPILA|FAIL|DIVERSO|differenze|sonda ROTTA|SONDA SPENTA|tipi: |esiti: |SENZA|file nell|errori|sonde|file letti|file con un colpo|denominatore|grezzi|R[123] |controlli rossi|eseguibili|casi: |casi decisi)') { Scrivi "    $riga" }
    }
    Annota $clausola $nome $r.Uscita
    return $r
}

function Script51([string]$file, [string]$resto) {
    return '-NoProfile -ExecutionPolicy Bypass -File "' + (Join-Path $Kit $file) + '" ' + $resto
}

function Sotto([string]$percorso) { return $percorso.StartsWith($Rad + '\', [StringComparison]::OrdinalIgnoreCase) }

function ProcessiUnita() {
    return @(Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and (Sotto $_.ExecutablePath) })
}

# --- Gli ascolti di rete dei programmi dell'unita'.
$script:Ascolti = New-Object Collections.Generic.List[object]
$script:Richieste = New-Object Collections.Generic.List[string]
function AnnotaAscolti([string]$quando) {
    $nomi = @{}
    foreach ($p in (ProcessiUnita)) { $nomi[[int]$p.ProcessId] = [string]$p.Name }
    $n = 0
    foreach ($c in @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue)) {
        if ($nomi.ContainsKey([int]$c.OwningProcess)) { $n++; $script:Ascolti.Add((New-Object PSObject -Property @{ Quando = $quando; Proto = 'tcp'; Ind = [string]$c.LocalAddress; Porta = [int]$c.LocalPort; Nome = $nomi[[int]$c.OwningProcess] })) }
    }
    foreach ($c in @(Get-NetUDPEndpoint -ErrorAction SilentlyContinue)) {
        if ($nomi.ContainsKey([int]$c.OwningProcess)) { $n++; $script:Ascolti.Add((New-Object PSObject -Property @{ Quando = $quando; Proto = 'udp'; Ind = [string]$c.LocalAddress; Porta = [int]$c.LocalPort; Nome = $nomi[[int]$c.OwningProcess] })) }
    }
    foreach ($g in @(Get-Process -Name 'consent', 'FirewallControlPanel' -ErrorAction SilentlyContinue)) { $script:Richieste.Add("$($g.ProcessName) ($quando)") }
    Scrivi ("    ascolti ({0}): processi dell'unita' {1}, ascolti {2}, finestre di richiesta {3}" -f $quando, $nomi.Count, $n, $script:Richieste.Count)
}
# Il verdetto sugli ascolti, uguale per il dato vero e per la sonda.
# Una porta UDP dinamica e' lo zoccolo di un client (Chromium la apre per QUIC): non ascolta e il firewall non chiede.
function FuoriLocale($righe) {
    $f = New-Object Collections.Generic.List[string]
    foreach ($r in $righe) {
        if ($r.Proto -eq 'udp' -and $r.Porta -ge 49152) { continue }
        if ($r.Ind -ne '127.0.0.1' -and $r.Ind -ne '::1') { $f.Add(("{0} {1} {2}:{3} ({4})" -f $r.Nome, $r.Proto, $r.Ind, $r.Porta, $r.Quando)) }
    }
    return , $f
}

# --- Le regole del firewall sotto un percorso.
function ContaSotto([string[]]$programmi, [string]$prefisso) {
    $p = $prefisso.TrimEnd('\') + '\'
    $n = 0
    foreach ($x in $programmi) { if ($x.StartsWith($p, [StringComparison]::OrdinalIgnoreCase)) { $n++ } }
    return $n
}

# --- Le aperture.
function Attendi-Editor() {
    $inizio = Get-Date
    while (((Get-Date) - $inizio).TotalSeconds -lt 60) {
        if (@(ProcessiUnita | Where-Object { $_.Name -eq 'VSCodium.exe' }).Count -ge 3) { break }
        Start-Sleep -Seconds 2
    }
    Start-Sleep -Seconds 25
}

function Chiudi-Tutto() {
    foreach ($p in (ProcessiUnita)) {
        $g = Get-Process -Id $p.ProcessId -ErrorAction SilentlyContinue
        # Chiusa la finestra principale di Chromium, gli altri suoi processi escono: su uno gia' uscito CloseMainWindow
        # solleva un'eccezione ("il processo e' terminato"), e un processo uscito e' cio' che si vuole. Ogni altra eccezione
        # si stampa; la chiusura forzata qui sotto vale per tutti e due.
        try { if ($g -and $g.MainWindowHandle -ne [IntPtr]::Zero) { [void]$g.CloseMainWindow() } }
        catch { $g.Refresh(); if (-not $g.HasExited) { Scrivi "    chiusura di $($p.Name) ($($p.ProcessId)): $($_.Exception.Message)" } }
    }
    $inizio = Get-Date
    while (((Get-Date) - $inizio).TotalSeconds -lt 20) {
        if (@(ProcessiUnita).Count -eq 0) { return }
        Start-Sleep -Seconds 1
    }
    foreach ($p in (ProcessiUnita)) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
    Start-Sleep -Seconds 2
}

function Apri([string]$exe, [string]$argomenti, [hashtable]$ambiente) {
    $psi = New-Object Diagnostics.ProcessStartInfo
    $psi.FileName = $exe
    $psi.Arguments = $argomenti
    $psi.UseShellExecute = $false
    foreach ($k in @($psi.EnvironmentVariables.Keys)) {
        if ($k -like 'VSCODE_*' -or $k -like 'ELECTRON_*') { $psi.EnvironmentVariables.Remove($k) }
    }
    if ($null -ne $ambiente) { foreach ($k in $ambiente.Keys) { $psi.EnvironmentVariables[$k] = $ambiente[$k] } }
    [void][Diagnostics.Process]::Start($psi)
}

# --- A9, il controllo positivo dal lanciatore. La differenza finta e' una cartella vuota fra le estensioni dell'editor:
# insieme.py la conta ("cartella senza package.json"), l'editor non la carica (non ha un manifesto), e si toglie con
# un Remove-Item. Le fotografie di U15 guardano fuori dall'unita' e U12, la verifica e l'insieme dopo l'uso girano a
# cartella gia' tolta. Il predicato e' un pythonw dell'unita' con insieme.py nella riga di comando ancora acceso qualche
# secondo dopo l'apertura: sull'unita' intatta lo script esce subito, con la differenza resta sulla finestra di avviso.
function Impronta([string]$f) {
    if (-not [IO.File]::Exists($f)) { return 'assente' }
    $h = [Security.Cryptography.SHA256]::Create()
    try { return [BitConverter]::ToString($h.ComputeHash([IO.File]::ReadAllBytes($f))).Replace('-', '') } finally { $h.Dispose() }
}

# Lo stato che il passo tocca: le voci della cartella delle estensioni e le impostazioni dell'utente, byte per byte.
function Stato-Insieme() {
    $est = Join-Path $Rad 'vscodium\data\extensions'
    $voci = @(Get-ChildItem -LiteralPath $est -Force | ForEach-Object { $_.Name } | Sort-Object)
    return ('voci ' + ($voci -join '|') + '; settings.json ' + (Impronta (Join-Path $Rad 'vscodium\data\user-data\User\settings.json')))
}

function Insieme-Accesi() {
    return @(Get-CimInstance Win32_Process -Filter "Name = 'pythonw.exe'" | Where-Object { $_.ExecutablePath -and (Sotto $_.ExecutablePath) -and $_.CommandLine -and $_.CommandLine.ToLower().Contains('insieme.py') }).Count
}

# $finta: il nome della cartella finta; vuoto, nessuna differenza (il controllo negativo della prova del passo).
function Avviso-Dal-Lanciatore([string]$finta) {
    $cartella = ''
    if ($finta) {
        $cartella = Join-Path $Rad ('vscodium\data\extensions\' + $finta)
        if (Test-Path -LiteralPath $cartella) { throw "la cartella finta c'e' gia': $cartella" }
    }
    $prima = Stato-Insieme
    $accesi = 0
    try {
        if ($cartella) { [void][IO.Directory]::CreateDirectory($cartella) }
        Apri (Join-Path $Rad 'VSCodium.exe') '' $null
        $inizio = Get-Date
        while (((Get-Date) - $inizio).TotalSeconds -lt 60) {
            if ((Insieme-Accesi) -ge 1 -and @(ProcessiUnita | Where-Object { $_.Name -eq 'VSCodium.exe' }).Count -ge 3) { break }
            Start-Sleep -Seconds 2
        }
        Start-Sleep -Seconds 5
        $accesi = Insieme-Accesi
    }
    finally {
        Chiudi-Tutto
        if ($cartella -and (Test-Path -LiteralPath $cartella)) { Remove-Item -LiteralPath $cartella -Recurse -Force }
    }
    $dopo = Stato-Insieme
    return New-Object PSObject -Property @{ Accesi = $accesi; Prima = $prima; Dopo = $dopo; Uguale = ($prima -ceq $dopo) }
}

# --- E1, l'editor dal lanciatore sulla cartella progetti. L'editor scrive lo stato di una cartella aperta in
# workspaceStorage\<id>\workspace.json, con la cartella come indirizzo file:///. Le tre funzioni le usa il gate e le chiama
# anche e1-sonda.ps1, accanto a questo file (le estrae da qui), su copie finte della sola cartella workspaceStorage: il gate
# la esegue come passo E1 anche senza -Finestre.
function NominaProgetti([string]$testo, [string]$radice) {
    $m = [regex]::Match($testo, '"folder"\s*:\s*"file:///([^"]+)"')
    if (-not $m.Success) { return $false }
    $p = [Uri]::UnescapeDataString($m.Groups[1].Value).Replace('/', '\').TrimEnd('\')
    return $p.ToLower() -eq (Join-Path $radice 'progetti').ToLower()
}
function Stati-Di-Cartella([string]$radice) {
    $cartellaStati = Join-Path $radice 'vscodium\data\user-data\User\workspaceStorage'
    $fileStati = @()
    if ([IO.Directory]::Exists($cartellaStati)) { $fileStati = @(Get-ChildItem -LiteralPath $cartellaStati -Directory | ForEach-Object { Join-Path $_.FullName 'workspace.json' } | Where-Object { [IO.File]::Exists($_) }) }
    $codifica = New-Object Text.UTF8Encoding($false)
    $suProgetti = @($fileStati | Where-Object { NominaProgetti ([IO.File]::ReadAllText($_, $codifica)) $radice }).Count
    return New-Object PSObject -Property @{ Totale = $fileStati.Count; SuiProgetti = $suProgetti }
}
# Il verdetto: fermo se la sonda della cartella vicina si accende o se la copia aveva gia' stati di cartella prima
# dell'apertura 1 (uno stato vecchio su progetti darebbe il verde qualunque cosa faccia il lanciatore); poi verde se uno
# stato nomina progetti, rosso se no.
function Esito-E1($prima, $dopo, [bool]$vicina) {
    if ($vicina) { return 2 }
    if ($prima.Totale -gt 0) { return 2 }
    if ($dopo.SuiProgetti -ge 1) { return 0 }
    return 1
}

try {
    $Qui = Split-Path -Parent $MyInvocation.MyCommand.Definition
    $Rad = [IO.Path]::GetFullPath($Unita).TrimEnd('\')
    # U13: una radice senza spazi doppi non si misura: si rifiuta prima di ogni altra cosa.
    if (-not $Rad.Contains('  ')) { Fermo "radice senza spazi doppi: $Rad" }
    if (-not [IO.Directory]::Exists($Rad)) { Fermo "manca $Rad" }
    if (-not (Test-Path -LiteralPath (Join-Path $Rad 'msys64\usr\bin\bash.exe'))) { Fermo "non e' un'unita': $Rad" }
    $Io = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
    if ($Io.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) { Fermo 'da amministratore la prova dei privilegi non dice nulla' }
    $Lettera = $Rad.Substring(0, 1)
    $Posix = '/' + $Lettera + $Rad.Substring(2).Replace('\', '/')
    $Lav = $Rad + '  gate'
    if ([IO.Directory]::Exists($Lav)) { Remove-Item -LiteralPath $Lav -Recurse -Force }
    $Kit = Join-Path $Lav 'kit  corrente'
    [void][IO.Directory]::CreateDirectory($Kit)
    Copy-Item -Path (Join-Path $Qui '*') -Destination $Kit
    $Verifica = Join-Path (Split-Path -Parent (Split-Path -Parent $Qui)) 'ricetta\verifica.ps1'
    Copy-Item -LiteralPath $Verifica -Destination $Kit
    # L'unita' estesa si riconosce come fa il lanciatore: la base non sa dell'aggiunta.
    $Estesa = Test-Path -LiteralPath (Join-Path $Rad 'programmi\Git\cmd\git.exe')
    if ($Estesa) { Copy-Item -LiteralPath (Join-Path (Split-Path -Parent (Split-Path -Parent $Qui)) 'ricetta\componenti-estesa.json') -Destination $Kit }
    $Utf8 = New-Object Text.UTF8Encoding($false)
    $Ps = Join-Path $PSHOME 'powershell.exe'
    $Py = Join-Path $Rad 'python\python.exe'
    # Le esportazioni del registro stanno sul disco del PC: mai accanto a un'unita' su una chiavetta.
    $Rip = Join-Path $env:TEMP 'gate-unita-fotografie'
    if ([IO.Directory]::Exists($Rip)) { Remove-Item -LiteralPath $Rip -Recurse -Force }
    Scrivi "unita': $Rad"
    Scrivi "lettera: $Lettera"
    Scrivi "lavoro: $Lav"

    function Terminale([string]$sh, [hashtable]$amb) {
        $riga = '/s /c ""' + (Join-Path $Kit 'terminale.bat') + '" "' + $Rad + '" "' + (Join-Path $Kit $sh) + '""'
        return Lancia $env:ComSpec $riga $amb
    }

    $RegolePrima = @(Get-NetFirewallApplicationFilter -All | ForEach-Object { [string]$_.Program } | Where-Object { $_ })
    Scrivi "regole del firewall con un programma, prima: $($RegolePrima.Count)"

    if ($Finestre) {
        Scrivi '=== U15: prima fotografia'
        $null = Passo 'U15' 'foto-prima' $Py ('-X utf8 -B "' + (Join-Path $Kit 'tracce.py') + '" foto "' + $Rip + '" prima')
        # E1, la premessa: la copia mai aperta, cioe' nessuno stato di cartella dell'editor prima dell'apertura 1.
        $StatiPrima = Stati-Di-Cartella $Rad
        Scrivi "    stati di cartella dell'editor prima dell'apertura 1: $($StatiPrima.Totale), su progetti $($StatiPrima.SuiProgetti) (atteso 0: copia mai aperta)"
        Scrivi '=== apertura 1, dal lanciatore'
        Apri (Join-Path $Rad 'VSCodium.exe') '' $null
        Attendi-Editor
        AnnotaAscolti 'apertura 1'
        # A9: il silenzio del lanciatore sull'unita' intatta. Lo script dell'insieme parte con pythonw dopo l'editor: senza
        # differenze esce subito, con una differenza resta acceso finche' la finestra di avviso e' aperta.
        $Avvisi = @(ProcessiUnita | Where-Object { $_.Name -eq 'pythonw.exe' }).Count
        Annota 'A9' "nessun avviso dal lanciatore: pythonw dell'unita' accesi $Avvisi" $(if ($Avvisi -eq 0) { 0 } else { 1 })
        Chiudi-Tutto
        # E1: il lanciatore apre l'editor sulla cartella progetti (lo studente vede subito la cartella del flowchart, e le
        # finestre per aprire un file partono da li'). La premessa "copia mai aperta" e' misurata prima dell'apertura 1
        # ($StatiPrima): con zero stati di cartella prima, uno stato su progetti dopo e' nato dall'apertura 1, cioe' dal
        # lanciatore; con uno stato gia' presente il passo e' un fermo. La sonda: una cartella vicina non conta.
        $StatiDopo = Stati-Di-Cartella $Rad
        $SondaVicina = NominaProgetti ('{"folder":"file:///' + (Join-Path $Rad 'progetti\c-comuni').Replace('\', '/') + '"}') $Rad
        Scrivi "    cartella dal lanciatore: stati di cartella $($StatiDopo.Totale), che nominano progetti di questa radice $($StatiDopo.SuiProgetti); prima dell'apertura 1 $($StatiPrima.Totale); sonda cartella vicina $SondaVicina (atteso False)"
        $CosaE1 = if ($StatiPrima.Totale -gt 0) { "l'editor dal lanciatore sulla cartella progetti: fermo, la copia non e' 'mai aperta' ($($StatiPrima.Totale) stati di cartella gia' presenti prima dell'apertura 1), serve un'unita' mai aperta" } else { "l'editor dal lanciatore si apre sulla cartella progetti" }
        Annota 'E1' $CosaE1 (Esito-E1 $StatiPrima $StatiDopo $SondaVicina)
        # A7: l'editor aperto dal lanciatore ha caricato l'italiano. La cache delle traduzioni nasce solo se la lingua di
        # argv.json ha un pacchetto installato (misurato: col pacchetto e senza la lingua non nasce), e tcf.json deve
        # nominare questa radice: una cache rimasta da un'altra cartella lascerebbe in inglese le estensioni incorporate.
        # L'ago e' ancorato alla cartella dei dati dell'editor sotto questa radice, come in vscodium\lingua.py: la sola radice
        # seguita da una barra si troverebbe anche dentro il percorso di una radice discendente (E:\MyDev in E:\MyDev\MyDev).
        function AgoRadice([string]$r) { return ($r.TrimEnd('\') + '\vscodium\data\').ToLower().Replace('\', '\\') }
        $Esc = AgoRadice $Rad
        # La sonda del predicato: una cache scritta da una radice che contiene questa ("unita' spostata un livello piu' su")
        # non la nomina. Il caso positivo e' il dato vero qui sotto: una cache scritta da questa radice.
        $SondaSu = ('{"x":"' + (AgoRadice ($Rad + '\MyDev')) + 'extensions"}').ToLower().Contains($Esc)
        $Clp = Join-Path $Rad 'vscodium\data\user-data\clp'
        $Tcf = @()
        if ([IO.Directory]::Exists($Clp)) { $Tcf = @(Get-ChildItem -LiteralPath $Clp -Directory -Filter '*.it' | ForEach-Object { Join-Path $_.FullName 'tcf.json' } | Where-Object { [IO.File]::Exists($_) }) }
        $Nominano = @($Tcf | Where-Object { [IO.File]::ReadAllText($_, $Utf8).ToLower().Contains($Esc) }).Count
        Scrivi "    lingua: cache italiane con tcf.json $($Tcf.Count), che nominano questa radice $Nominano; sonda radice discendente $SondaSu (atteso False)"
        Annota 'A7' 'editor in italiano dal lanciatore' $(if ($SondaSu) { 2 } elseif ($Tcf.Count -ge 1 -and $Nominano -eq $Tcf.Count) { 0 } else { 1 })
        # A9, il controllo positivo: lo stesso lanciatore con una differenza finta deve far restare acceso il controllo
        # dell'insieme (la finestra di avviso). Senza, lo zero dell'apertura 1 varrebbe anche per "mai partito". Dopo
        # l'apertura 1, che misura il silenzio sull'unita' intatta, e dopo A7, che ne legge la cache della lingua.
        Scrivi '=== apertura 1b, dal lanciatore con una differenza finta'
        $Positivo = Avviso-Dal-Lanciatore 'sonda-gate-insieme'
        Scrivi "    A9: pythonw dell'unita' accesi senza differenze $Avvisi (silenzio), con insieme.py e la differenza finta $($Positivo.Accesi) (avviso)"
        Annota 'A9' "controllo positivo dal lanciatore: con la differenza finta pythonw con insieme.py accesi $($Positivo.Accesi)" $(if ($Positivo.Accesi -ge 1) { 0 } else { 1 })
        if (-not $Positivo.Uguale) { Scrivi "    prima: $($Positivo.Prima)"; Scrivi "    dopo:  $($Positivo.Dopo)" }
        Annota 'A9' 'differenza finta tolta: estensioni e impostazioni come prima' $(if ($Positivo.Uguale) { 0 } else { 1 })
        Scrivi '=== apertura 2, con una cartella e un file'
        # Lo stesso ambiente che da' il lanciatore, che apre sempre e solo la cartella progetti e non accetta un file da aprire
        # (qui servono progetti e main.c, per accendere clangd): senza il PATH clangd sarebbe un altro.
        # Nell'estesa anche le sue variabili, come prepara_estesa di lancia.c: progetti contiene i progetti Rust, rust-analyzer si
        # accende gia' qui, e senza CARGO_HOME lancia il cargo del profilo dell'utente, se sul PC c'e'.
        # I nomi di questo elenco si confrontano con quelli del lanciatore e dei collegamenti di ripiego (ambienti.py).
        $Sistema = $env:SystemRoot
        $Ambiente = @{
            MYDEV = $Posix; MYDEV_RADICE = $Rad; MYDEV_RADICE_POSIX = $Posix; MYDEV_MSYS = (Join-Path $Rad 'msys64')
            XDG_STATE_HOME = (Join-Path $Rad 'home\.local\state'); XDG_CACHE_HOME = (Join-Path $Rad 'home\.cache')
            PIP_CACHE_DIR = (Join-Path $Rad 'home\.cache\pip'); VIRTUALENV_OVERRIDE_APP_DATA = (Join-Path $Rad 'home\.cache\virtualenv')
            PYTHON_HISTORY = (Join-Path $Rad 'home\.python_history')
            PATH = "$Rad\bin;$Rad\msys64\usr\bin;$Rad\llvm\bin;$Rad\python;$Rad\python\Scripts;$Sistema\System32;$Sistema"
        }
        if ($Estesa) {
            $Ambiente['ProgramW6432'] = Join-Path $Rad 'programmi'
            $Ambiente['PATH'] = "$Rad\bin;$Rad\programmi\Git\cmd;$Rad\gh\bin;$Rad\msys64\usr\bin;$Rad\llvm\bin;$Rad\python;$Rad\python\Scripts;$Sistema\System32;$Sistema"
            $Ambiente['CARGO_HOME'] = "$Posix/home/.cargo"
            $Ambiente['GH_CONFIG_DIR'] = Join-Path $Rad 'home\.config\gh'
            $Ambiente['GH_TELEMETRY'] = 'false'
            $Ambiente['GH_NO_UPDATE_NOTIFIER'] = '1'
        }
        Apri (Join-Path $Rad 'vscodium\VSCodium.exe') ('"' + (Join-Path $Rad 'progetti') + '" "' + (Join-Path $Rad 'progetti\c-comuni\01-ciao\main.c') + '"') $Ambiente
        Attendi-Editor
        AnnotaAscolti 'apertura 2'
        # A editor aperto: un file temporaneo sparisce alla chiusura e la seconda fotografia non lo vedrebbe.
        # Premessa: senza clangd acceso, l'assenza dei suoi file non direbbe nulla.
        $Clangd = @(ProcessiUnita | Where-Object { $_.Name -eq 'clangd.exe' }).Count
        Annota 'U15' "clangd acceso a editor aperto: $Clangd" $(if ($Clangd -ge 1) { 0 } else { 2 })
        $null = Passo 'U15' 'foto-durante' $Py ('-X utf8 -B "' + (Join-Path $Kit 'tracce.py') + '" foto "' + $Rip + '" durante')
        Chiudi-Tutto
        $null = Passo 'U15' 'tracce-durante' $Py ('-X utf8 -B "' + (Join-Path $Kit 'tracce.py') + '" confronta "' + $Rip + '" prima durante --radice "' + $Rad + '"')
        if ($Estesa) {
            Scrivi '=== apertura 3, un progetto Rust'
            # Lo stesso ambiente che il lanciatore da' all'estesa, gia' preparato per l'apertura 2. Premessa: senza rust-analyzer acceso, l'assenza dei suoi file non direbbe nulla.
            $Cartella = Join-Path $Rad 'progetti\rust-comuni\01-ciao'
            Apri (Join-Path $Rad 'vscodium\VSCodium.exe') ('"' + $Cartella + '" "' + (Join-Path $Cartella 'src\main.rs') + '"') $Ambiente
            Attendi-Editor
            $Inizio = Get-Date
            while (((Get-Date) - $Inizio).TotalSeconds -lt 60 -and @(ProcessiUnita | Where-Object { $_.Name -eq 'rust-analyzer.exe' }).Count -lt 1) { Start-Sleep -Seconds 2 }
            Start-Sleep -Seconds 30
            AnnotaAscolti 'apertura 3'
            $Ra = @(ProcessiUnita | Where-Object { $_.Name -eq 'rust-analyzer.exe' }).Count
            Annota 'E9' "rust-analyzer acceso a editor aperto: $Ra" $(if ($Ra -ge 1) { 0 } else { 2 })
            $null = Passo 'E9' 'foto-rust' $Py ('-X utf8 -B "' + (Join-Path $Kit 'tracce.py') + '" foto "' + $Rip + '" rust')
            Chiudi-Tutto
            $null = Passo 'E9' 'tracce-rust' $Py ('-X utf8 -B "' + (Join-Path $Kit 'tracce.py') + '" confronta "' + $Rip + '" prima rust --radice "' + $Rad + '"')
        }
        # A13: Chromium dal lanciatore. Il profilo nasce in home\chromium e, al primo avvio, chromium\initial_preferences vi
        # scrive il motore della barra. Le scritture fuori le vedono le fotografie di U15: il registro di Chromium e'
        # dichiarato in tracce.py, una cartella Chromium nel profilo dell'utente e' un rosso (R1).
        # Il motore si accredita solo a un profilo nato in questo passo: uno rimasto da un'apertura precedente lo porta gia',
        # anche con le preferenze iniziali rotte, e il passo non potrebbe dire rosso (fermo: si misura su un'unita' mai aperta).
        $ProfiloPrima = [IO.Directory]::Exists((Join-Path $Rad 'home\chromium'))
        Scrivi '=== apertura di Chromium, dal lanciatore'
        Apri (Join-Path $Rad 'Chromium.exe') '' $null
        $Inizio = Get-Date
        while (((Get-Date) - $Inizio).TotalSeconds -lt 60 -and @(ProcessiUnita | Where-Object { $_.Name -eq 'chrome.exe' }).Count -lt 1) { Start-Sleep -Seconds 2 }
        Start-Sleep -Seconds 15
        AnnotaAscolti 'chromium'
        $Chrome = @(ProcessiUnita | Where-Object { $_.Name -eq 'chrome.exe' }).Count
        # La scheda aperta all'avvio e' la pagina dell'unita' (chromium\benvenuto.html), che il lanciatore passa a Chromium.
        $Titoli = @(Get-Process -Name chrome -ErrorAction SilentlyContinue | Where-Object { $_.Path -and (Sotto $_.Path) -and $_.MainWindowHandle -ne 0 } | ForEach-Object { $_.MainWindowTitle })
        $Pagina = @($Titoli | Where-Object { $_ -like 'Chromium in MyDev*' }).Count -ge 1
        Chiudi-Tutto
        $Pref = Join-Path $Rad 'home\chromium\Default\Preferences'
        $Motore = ([IO.File]::Exists($Pref)) -and ([IO.File]::ReadAllText($Pref, $Utf8).Contains('duckduckgo.com'))
        Scrivi "    chromium: profilo assente prima del passo: $(-not $ProfiloPrima); processi accesi $Chrome; profilo nell'unita' col motore della barra: $Motore; finestre: $($Titoli -join ' | ')"
        $CosaA13 = if ($ProfiloPrima) { 'chromium dal lanciatore: home\chromium esisteva gia'', serve un''unita'' mai aperta' } else { 'chromium dal lanciatore, profilo nell''unita'', la pagina dell''unita'' all''avvio' }
        Annota 'A13' $CosaA13 $(if ($ProfiloPrima) { 2 } elseif ($Chrome -ge 1 -and $Motore -and $Pagina) { 0 } else { 1 })
        # A13, controllo negativo: lo stesso chrome.exe senza il lanciatore, senza la pagina, con un profilo nuovo nella cartella
        # di lavoro e senza primo avvio (cosi' le preferenze iniziali non si leggono): pagina e motore devono uscire falsi.
        # Premessa: Chromium acceso, una finestra e le preferenze scritte; senza, due falsi non direbbero nulla (fermo).
        $ProfSonda = Join-Path $Lav 'chromium  sonda'
        Scrivi '=== apertura di Chromium senza lanciatore, controllo negativo'
        Apri (Join-Path $Rad 'chromium\chrome.exe') ('--user-data-dir="' + $ProfSonda + '" --no-first-run --disable-extensions --no-default-browser-check') $null
        $Inizio = Get-Date
        while (((Get-Date) - $Inizio).TotalSeconds -lt 60 -and @(ProcessiUnita | Where-Object { $_.Name -eq 'chrome.exe' }).Count -lt 1) { Start-Sleep -Seconds 2 }
        Start-Sleep -Seconds 15
        $ChromeS = @(ProcessiUnita | Where-Object { $_.Name -eq 'chrome.exe' }).Count
        # Solo finestre con un titolo: una scheda senza titolo farebbe "pagina falsa" per una ragione banale.
        $TitoliS = @(Get-Process -Name chrome -ErrorAction SilentlyContinue | Where-Object { $_.Path -and (Sotto $_.Path) -and $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle } | ForEach-Object { $_.MainWindowTitle })
        $PaginaS = @($TitoliS | Where-Object { $_ -like 'Chromium in MyDev*' }).Count -ge 1
        Chiudi-Tutto
        $PrefS = Join-Path $ProfSonda 'Default\Preferences'
        $ScritteS = [IO.File]::Exists($PrefS)
        $MotoreS = $ScritteS -and ([IO.File]::ReadAllText($PrefS, $Utf8).Contains('duckduckgo.com'))
        Scrivi "    sonda: processi accesi $ChromeS; preferenze scritte $ScritteS; pagina dell'unita' $PaginaS; motore della barra $MotoreS; finestre: $($TitoliS -join ' | ')"
        Annota 'A13' 'controllo negativo: senza lanciatore ne'' primo avvio, pagina e motore falsi' $(if ($ChromeS -lt 1 -or $TitoliS.Count -lt 1 -or -not $ScritteS) { 2 } elseif (-not $PaginaS -and -not $MotoreS) { 0 } else { 1 })
        # A13, che cosa Chromium decodifica: la pagina dei codec (collaudo\codec, dal repository come le licenze) sul
        # chrome.exe dell'unita', con un profilo nuovo nella cartella di lavoro: H.264, H.265 e AAC rifiutati, VP9, AV1 e
        # Opus riprodotti. Il chrome.dll dell'unita' importa ffmpeg.dll alla partenza: senza quel file la pagina e' un fermo
        # (misurato). Poi le sonde del verdetto; il controllo positivo sul dato vero (la release ufficiale che decodifica
        # H.264) si misura a ogni versione nuova di Chromium, fuori dal gate.
        Scrivi '=== A13: la pagina dei codec sul Chromium dell''unita'''
        $Codec = '-X utf8 -B "' + (Join-Path (Split-Path -Parent $Qui) 'codec\prova_codec.py') + '"'
        $null = Passo 'A13' 'codec' $Py ($Codec + ' --chromium "' + (Join-Path $Rad 'chromium\chrome.exe') + '" --profilo "' + (Join-Path $Lav 'codec  profilo') + '" --uscita "' + (Join-Path $Lav 'codec') + '" --nome unita --atteso senza')
        $null = Passo 'A13' 'codec-sonde' $Py ($Codec + ' --sonde')
        Chiudi-Tutto

        # E1: lo scenario S-E1 dello studente nell'editor dell'unita' (dal flowchart al punto d'arresto, con la finestra
        # "Salva con nome" vera di Windows), con l'ambiente che il gate da' all'editor, quello del lanciatore. Il flowchart
        # non e' mai stato aperto: le aperture prima non lo toccano. Poi il controllo positivo: la stessa corsa col pacchetto
        # della 0.2.0 deve essere rossa al passo 3 (nessuna pagina). I file dello scenario se1.py li toglie dall'unita'.
        Scrivi '=== E1: lo scenario S-E1 nell''editor dell''unita'''
        $GitPc = Get-Command git -ErrorAction SilentlyContinue
        if ($null -eq $GitPc) { Annota 'E1' 'S-E1: git non c''e' 2; Annota 'E1' 'S-E1 controllo positivo: git non c''e' 2 }
        else {
            $Se1 = '-X utf8 -B "' + (Join-Path $Kit 'se1.py') + '" --unita "' + $Rad + '" --lavoro "' + (Join-Path $Lav 'se1') + '" --kit "' + $Kit + '" --repo "' + (Split-Path -Parent (Split-Path -Parent $Qui)) + '" --git "' + $GitPc.Source + '"'
            foreach ($giro in @(@{ Nome = 'se1'; Arg = ''; Cosa = 'S-E1 dalla pagina al punto d''arresto' }, @{ Nome = 'se1-controllo'; Arg = ' --controllo'; Cosa = 'S-E1 controllo positivo: col pacchetto della 0.2.0 rosso al passo 3' })) {
                $r = Lancia $Py ($Se1 + $giro.Arg) $Ambiente
                [IO.File]::WriteAllText((Join-Path $Lav ($giro.Nome + '.log')), $r.Testo, $Utf8)
                foreach ($riga in ($r.Testo -split "`r?`n")) { if ($riga -match '^(PASS|FAIL|ROSSO|FERMO|ESITO|passi dello|la finestra di Windows|controllo positivo|il \.algo|impostazioni del debug|configurazioni di lancio|barra di stato|sonde del giudice)') { Scrivi "    $riga" } }
                Annota 'E1' $giro.Cosa $r.Uscita
                Chiudi-Tutto
            }
        }
    }

    # --- L'ambiente C, dal terminale dell'unita'.
    $Lc = Join-Path $Lav 'prova-c'
    $r = Passo 'U13' 'prova-c' $Ps (Script51 'prova.ps1' ('-Unita "' + $Rad + '" -Lavoro "' + $Lc + '"'))
    $Esegui = Join-Path $Lc 'esegui.log'
    $primo = ''
    if ([IO.File]::Exists($Esegui)) { $primo = [string]([IO.File]::ReadAllLines($Esegui, $Utf8) | Where-Object { $_ -match '^INIZIO esegui' } | Select-Object -First 1) }
    Scrivi "    letta dalla prova: $primo"
    $lettaOk = $primo -match ('MYDEV=/' + $Lettera + '/')
    Annota 'U14' "lettera $Lettera letta dalla prova" $(if ($lettaOk) { 0 } else { 1 })
    if ($Estesa) {
        # -Repo: la copia del corso nell'unita' si confronta con l'inventario della ricetta.
        $null = Passo 'E9' 'prova-estesa' $Ps (Script51 'estesa.ps1' ('-Unita "' + $Rad + '" -Lavoro "' + (Join-Path $Lav 'prova-estesa') + '" -Repo "' + (Split-Path -Parent (Split-Path -Parent $Qui)) + '"'))
    }

    # --- U15: i programmi del terminale col profilo dell'utente in una cartella vuota.
    Scrivi '=== U15: profilo finto'
    $Finto = Join-Path $Lav 'profilo  finto'
    $Pos = Join-Path $Lav 'profilo  positivo'
    foreach ($c in @("$Finto\Local", "$Finto\Roaming", "$Finto\Utente", "$Pos\Local", "$Pos\Roaming", "$Pos\Utente")) { [void][IO.Directory]::CreateDirectory($c) }
    # Le librerie Python chiedono a Windows le cartelle note e ignorano le variabili: le WIN_PD_OVERRIDE_* spostano anche quelle.
    $r = Terminale 'profilo.sh' @{ LOCALAPPDATA = "$Finto\Local"; APPDATA = "$Finto\Roaming"; USERPROFILE = "$Finto\Utente"; WIN_PD_OVERRIDE_LOCAL_APPDATA = "$Finto\Local"; WIN_PD_OVERRIDE_APPDATA = "$Finto\Roaming"; PROFILO_FINTO = $Finto; PROFILO_POSITIVO = $Pos; PROFILO_LAVORO = (Join-Path $Lav 'profilo-venv') }
    [IO.File]::WriteAllText((Join-Path $Lav 'profilo.log'), $r.Testo, $Utf8)
    foreach ($riga in ($r.Testo -split "`r?`n")) { if ($riga -match '^(PROFILO|POSITIVO|PIP|ESITO|FUORI|FERMO)') { Scrivi "    $riga" } }
    Annota 'U15' 'profilo finto' $r.Uscita

    # --- U15: l'ambiente del lanciatore, appaiato alle sue copie.
    $null = Passo 'U15' 'ambienti' $Py ('-X utf8 -B "' + (Join-Path $Qui 'ambienti.py') + '" --sonde')

    # --- Il server locale: gli ascolti.
    Scrivi '=== U16: il server locale'
    $occupate = @(Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue | Where-Object { $_.LocalPort -eq 8080 -or $_.LocalPort -eq 8443 })
    if ($occupate.Count -gt 0) {
        Annota 'U16' 'porte 8080 e 8443 occupate da altri' 2
    }
    else {
        $LogServer = Join-Path $Lav 'server.log'
        $null = Terminale 'server-su.sh' @{ SERVER_LOG = $LogServer }
        Start-Sleep -Seconds 3
        AnnotaAscolti 'nginx'
        # Premessa: le due porte della configurazione, ciascuna vista da nginx.
        $Porte = @($script:Ascolti | Where-Object { $_.Quando -eq 'nginx' -and $_.Proto -eq 'tcp' -and $_.Nome -eq 'nginx.exe' } | ForEach-Object { $_.Porta } | Sort-Object -Unique)
        $Viste = ($Porte -contains 8080) -and ($Porte -contains 8443)
        Annota 'U16' "porte del server viste: $($Porte -join ' '), attese 8080 e 8443" $(if ($Viste) { 0 } else { 2 })
        $null = Terminale 'server-giu.sh' @{}
        Start-Sleep -Seconds 2
    }
    Chiudi-Tutto

    # --- U15: la seconda fotografia e il confronto.
    if ($Finestre) {
        Scrivi '=== U15: seconda fotografia e confronto'
        $null = Passo 'U15' 'foto-dopo' $Py ('-X utf8 -B "' + (Join-Path $Kit 'tracce.py') + '" foto "' + $Rip + '" dopo')
        $null = Passo 'U15' 'tracce' $Py ('-X utf8 -B "' + (Join-Path $Kit 'tracce.py') + '" confronta "' + $Rip + '" prima dopo --sonde --radice "' + $Rad + '"')
        $null = Lancia $Py ('-X utf8 -B "' + (Join-Path $Kit 'tracce.py') + '" pulisci "' + $Rip + '"') $null
    }

    # --- A16: il corpus di esecuzione. Dopo le fotografie (Bun e i compilatori scrivono nella cartella temporanea del PC) e prima
    # della verifica, che vede se la generazione o i programmi hanno scritto nell'unita'. Gira dal repository, come le licenze.
    Scrivi '=== A16: il corpus di esecuzione'
    $Bun = Get-Command bun -ErrorAction SilentlyContinue
    if ($null -eq $Bun) { Annota 'A16' 'esecuzione: bun non c''e' 2 }
    else {
        $Esec = '"' + (Join-Path (Split-Path -Parent $Qui) 'esecuzione\prova.ts') + '" --unita "' + $Rad + '" --lavoro "' + (Join-Path $Lav 'esecuzione  lavoro') + '"'
        $null = Passo 'A16' 'esecuzione' $Bun.Source $Esec
    }

    # --- La verifica dei file, dopo l'uso.
    $null = Passo 'U13' 'verifica' $Ps (Script51 'verifica.ps1' ('-Unita "' + $Rad + '"'))
    $ArgEditor = '-Unita "' + $Rad + '"'
    if ($Vsix) { $ArgEditor += ' -Vsix "' + $Vsix + '"' }
    $null = Passo 'U13' 'editor' $Ps (Script51 'editor.ps1' $ArgEditor)
    # --- A9: l'insieme garantito delle estensioni, dopo l'uso: lo stesso confronto che il lanciatore fa a ogni avvio,
    # con lo script dell'unita' e non con una copia, piu' le sonde del verdetto.
    $Ins = '-I -B "' + (Join-Path $Rad 'vscodium\insieme.py') + '"'
    $null = Passo 'A9' 'insieme' $Py ($Ins + ' --verifica')
    $null = Passo 'A9' 'insieme-sonde' $Py ($Ins + ' --sonde')
    # --- A7: le sonde dello script della lingua dell'unita' (il verdetto sulla cache e la forma dei percorsi).
    $null = Passo 'A7' 'lingua-sonde' $Py ('-I -B "' + (Join-Path $Rad 'vscodium\lingua.py') + '" --sonde')
    # --- E1: la sonda del verdetto dell'editor dal lanciatore sulla cartella progetti, senza finestre: le tre funzioni del
    # passo, estratte da gate.ps1 nella copia del kit, su copie finte di workspaceStorage nella cartella temporanea del PC.
    $null = Passo 'E1' 'e1-sonda' $Ps (Script51 'e1-sonda.ps1' '')
    # --- E6: le guide leggibili. Le guide e le copie sono quelle di unita-file.txt (la costruzione), le sonde nello script.
    $null = Passo 'E6' 'guide' $Py ('-X utf8 -B "' + (Join-Path $Kit 'guide.py') + '" "' + $Rad + '"')

    # --- U17: le licenze. Il generatore legge la ricetta, quindi gira dal repository e non dalla copia del kit.
    Scrivi '=== U17: licenze'
    $Lic = '-I -B "' + (Join-Path (Split-Path -Parent (Split-Path -Parent $Qui)) 'ricetta\licenze_unita.py') + '" "' + $Rad + '"'
    $null = Passo 'U17' 'licenze' $Py $Lic
    $null = Passo 'U17' 'licenze-sonde' $Py ($Lic + ' --sonde')

    # --- U12: i percorsi assoluti.
    Scrivi '=== U12: percorsi assoluti'
    $Arg = '-X utf8 -B "' + (Join-Path $Kit 'assoluti.py') + '" "' + $Rad + '"'
    if ($Finestre) { $Arg += ' --usata' }
    # Una barra finale prima della virgoletta di chiusura la renderebbe letterale: la radice si cercherebbe con una virgoletta in coda.
    $Radici = New-Object Collections.Generic.List[string]
    foreach ($a in ($Altro -split ';')) { $t = $a.Trim().TrimEnd('\'); if ($t) { $Radici.Add($t) } }
    # Su una copia l'editor ha registrato la cartella di costruzione in extensions.json: e' la radice da cui un percorso salvato verrebbe.
    $Estensioni = Join-Path $Rad 'vscodium\data\extensions\extensions.json'
    if ([IO.File]::Exists($Estensioni)) {
        $m = [regex]::Match([IO.File]::ReadAllText($Estensioni, $Utf8), '"path":"/([A-Za-z]):(/[^"]*?)?/vscodium/data/extensions/')
        if (-not $m.Success) { Fermo "extensions.json non dice la cartella di costruzione: $Estensioni" }
        $Origine = $m.Groups[1].Value + ':' + [Uri]::UnescapeDataString($m.Groups[2].Value).Replace('/', '\')
        if ($Origine.Length -eq 2) { $Origine += '\' }
        Scrivi "radice di costruzione, da extensions.json: $Origine"
        if ($Origine.TrimEnd('\') -ne $Rad) { $Radici.Add($Origine.TrimEnd('\')) }
    }
    foreach ($a in $Radici) { $Arg += ' --altro "' + $a + '"' }
    $null = Passo 'U12' 'assoluti' $Py $Arg

    # --- U16: regole del firewall, richieste di elevazione, ascolti.
    Scrivi '=== U16: privilegi'
    $null = Passo 'U16' 'privilegi' $Py ('-X utf8 -B "' + (Join-Path $Kit 'privilegi.py') + '" "' + $Rad + '" "' + $Lav + '"')
    $RegoleDopo = @(Get-NetFirewallApplicationFilter -All | ForEach-Object { [string]$_.Program } | Where-Object { $_ })
    $SottoRadice = ContaSotto $RegoleDopo $Rad
    Scrivi "regole del firewall con un programma, dopo: $($RegoleDopo.Count); sotto la radice: $SottoRadice"
    Annota 'U16' 'regole del firewall sotto la radice' $(if ($SottoRadice -eq 0) { 0 } else { 1 })
    # Controllo positivo: il percorso di una regola vera, gia' autorizzato.
    $Vera = @($RegoleDopo | Where-Object { $_ -match '^[A-Za-z]:\\' -and $_ -notmatch '%' } | Select-Object -First 1)
    $Conta = 0
    if ($Vera.Count -eq 1) { $Conta = ContaSotto $RegoleDopo (Split-Path -Parent $Vera[0]) }
    Scrivi "controllo positivo, regole di un percorso gia' autorizzato: $Conta"
    Annota 'U16' 'controllo positivo delle regole' $(if ($Conta -ge 1) { 0 } else { 2 })

    Scrivi "ascolti visti: $($script:Ascolti.Count)"
    foreach ($a in $script:Ascolti) { Scrivi ("    {0} {1} {2}:{3} ({4})" -f $a.Nome, $a.Proto, $a.Ind, $a.Porta, $a.Quando) }
    $Fuori = FuoriLocale $script:Ascolti
    foreach ($x in $Fuori) { Scrivi "    FUORI DA 127.0.0.1: $x" }
    Annota 'U16' "ascolti fuori da 127.0.0.1: $($Fuori.Count)" $(if ($Fuori.Count -eq 0) { 0 } else { 1 })
    $Sonda = @(
        (New-Object PSObject -Property @{ Quando = 'sonda'; Proto = 'tcp'; Ind = '0.0.0.0'; Porta = 80; Nome = 'tcp' }),
        (New-Object PSObject -Property @{ Quando = 'sonda'; Proto = 'udp'; Ind = '0.0.0.0'; Porta = 5353; Nome = 'udp fissa' }),
        (New-Object PSObject -Property @{ Quando = 'sonda'; Proto = 'udp'; Ind = '0.0.0.0'; Porta = 52789; Nome = 'udp dinamica' })
    )
    Annota 'U16' 'sonda degli ascolti: due fuori, la porta dinamica no' $(if ((FuoriLocale $Sonda).Count -eq 2) { 0 } else { 2 })
    foreach ($x in $script:Richieste) { Scrivi "    RICHIESTA: $x" }
    Annota 'U16' "finestre di richiesta viste: $($script:Richieste.Count)" $(if ($script:Richieste.Count -eq 0) { 0 } else { 1 })

    # --- L'esito.
    $Tot = $script:Passi.Count
    $Attesi = if ($Finestre) { 39 } else { 22 }
    if ($Estesa) { if ($Finestre) { $Attesi += 4 } else { $Attesi += 1 } }
    Scrivi "denominatore: passi $Tot, attesi $Attesi"
    if ($Tot -ne $Attesi) { Fermo "passi eseguiti $Tot, attesi $Attesi" }
    $Fermi = @($script:Passi | Where-Object { $_.Uscita -eq 2 })
    $Rossi = @($script:Passi | Where-Object { $_.Uscita -ne 0 -and $_.Uscita -ne 2 })
    Scrivi "passi: $Tot, verdi $($Tot - $Fermi.Count - $Rossi.Count), rossi $($Rossi.Count), fermi $($Fermi.Count)"
    foreach ($p in ($Rossi + $Fermi)) { Scrivi ("  non verde: {0} {1} (uscita {2})" -f $p.Clausola, $p.Cosa, $p.Uscita) }
    if ($Rossi.Count -gt 0) { Scrivi 'ESITO: ROSSO'; exit 1 }
    if ($Fermi.Count -gt 0) { Scrivi 'ESITO: FERMO'; exit 2 }
    if ($Finestre) { Scrivi 'ESITO: VERDE' }
    else { Scrivi 'ESITO: VERDE, senza le finestre: tracce e ascolti dell''editor non misurati, percorsi a file fermi' }
    exit 0
}
catch {
    Fermo "eccezione: $($_.Exception.Message) ($($_.InvocationInfo.ScriptLineNumber))"
}

# Il gate di portabilita' di un'unita' costruita: rifiuta una radice senza spazi doppi e
# fa girare da li' le prove del kit e i rilevatori di percorsi, tracce e privilegi.
#
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File collaudo\unita\gate.ps1 -Unita <cartella con spazi doppi> [-Vsix <file>] [-Altro "<percorso>;<percorso>"] [-Finestre]
#
# Con -Finestre apre l'editor due volte, tre nell'estesa, e fotografa cartelle e registro: la finestra puo' prendere la tastiera.
# Senza, i percorsi si cercano a file fermi e tracce e ascolti dell'editor non si misurano: l'esito lo dice.
# Il lavoro sta accanto all'unita', in una cartella che finisce con spazi doppi, e il kit gira da una sua copia li' dentro.
# Su una copia, la cartella in cui l'unita' e' stata costruita si legge da extensions.json e si cerca anche quella.
#
# Uscite: 0 verde, 1 rosso, 2 fermo (non si e' potuto misurare). Solo ASCII: PowerShell 5.1 legge un .ps1 senza BOM come ANSI.
#
# Le sigle dei passi sono le clausole del collaudo dell'unita': U12 nessun percorso assoluto dopo l'uso, U13 il kit da una
# radice con spazi doppi, U14 un'altra lettera, U15 nulla fuori dall'unita', U16 nessun privilegio, U17 le licenze,
# E9 le stesse sull'unita' estesa.
#
# Che cosa NON guarda: la chiavetta (la si indica come radice); le prove delle estensioni e del nucleo, che hanno le loro;
# una richiesta di privilegi di un programma lanciato a mano dentro l'unita'; le voci di PATH dell'utente; la cartella
# temporanea del PC, che compiti e debug dell'editor usano come ogni programma; un figlio appeso, che non ha un tempo massimo.

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
        if ($riga -match '^(ESITO|FERMO|ROSSO|SENZA|  SENZA|file nell|errori|sonde|file letti|file con un colpo|denominatore|grezzi|R[123] |controlli rossi|eseguibili)') { Scrivi "    $riga" }
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
        if ($g -and $g.MainWindowHandle -ne [IntPtr]::Zero) { [void]$g.CloseMainWindow() }
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
        Scrivi '=== apertura 1, dal lanciatore'
        Apri (Join-Path $Rad 'VSCodium.exe') '' $null
        Attendi-Editor
        AnnotaAscolti 'apertura 1'
        Chiudi-Tutto
        Scrivi '=== apertura 2, con una cartella e un file'
        # Lo stesso ambiente che da' il lanciatore, che non accetta una cartella da aprire: senza il PATH clangd sarebbe un altro.
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
        $null = Passo 'E9' 'prova-estesa' $Ps (Script51 'estesa.ps1' ('-Unita "' + $Rad + '" -Lavoro "' + (Join-Path $Lav 'prova-estesa') + '"'))
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

    # --- La verifica dei file, dopo l'uso.
    $null = Passo 'U13' 'verifica' $Ps (Script51 'verifica.ps1' ('-Unita "' + $Rad + '"'))
    $ArgEditor = '-Unita "' + $Rad + '"'
    if ($Vsix) { $ArgEditor += ' -Vsix "' + $Vsix + '"' }
    $null = Passo 'U13' 'editor' $Ps (Script51 'editor.ps1' $ArgEditor)

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
    $Attesi = if ($Finestre) { 22 } else { 16 }
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

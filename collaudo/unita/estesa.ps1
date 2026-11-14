# La prova di Rust, git e gh su un'unita' estesa costruita, dal suo terminale.
#
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File collaudo\unita\estesa.ps1 -Unita <cartella> [-Lavoro <cartella>] [-Repo <repository>]
#
# -Repo e' il repository di MyDev, per l'inventario del corso sui puntatori: senza, la cartella sopra il kit
# (giusto se il kit gira dal repository; il gate, che lo copia altrove, lo passa).
# Uscite: 0 verde, 1 rosso, 2 fermo. Solo ASCII: PowerShell 5.1 legge un .ps1 senza BOM come ANSI.
#
# Che cosa NON guarda: l'editor; il login di gh; che l'https vada (si stampa, ma non decide: vuole la rete); la
# copia del corso contro il commit da cui viene (lo fa ricetta\puntatori\uguaglianza.py col repository del corso).

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Unita,
    [string]$Lavoro = '',
    [string]$Repo = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2

function Scrivi([string]$t) { [Console]::Out.WriteLine($t) }
function Fermo([string]$m) { Scrivi "FERMO: $m"; Scrivi 'ESITO: FERMO'; exit 2 }

$script:Rossi = New-Object Collections.Generic.List[string]
$script:Visti = 0
function Verifica([bool]$ok, [string]$cosa) {
    $script:Visti++
    if ($ok) { Scrivi "  ok    $cosa" } else { Scrivi "  ROSSO $cosa"; $script:Rossi.Add($cosa) }
}

function Numero([string]$testo, [string]$nome) {
    $m = [regex]::Match($testo, "(?m)^SENTINELLA $nome`: (\d+)")
    if (-not $m.Success) { return -1 }
    return [int]$m.Groups[1].Value
}

try {
    $Qui = Split-Path -Parent $MyInvocation.MyCommand.Definition
    $Rad = [IO.Path]::GetFullPath($Unita).TrimEnd('\')
    if (-not (Test-Path -LiteralPath (Join-Path $Rad 'programmi\Git\cmd\git.exe'))) { Fermo "non e' un'unita' estesa: $Rad" }
    if (-not $Lavoro) { $Lavoro = Join-Path $env:TEMP 'mydev-prova  estesa' }
    $Lav = [IO.Path]::GetFullPath($Lavoro).TrimEnd('\')
    # La cartella di lavoro si cancella: mai l'unita', una sua cartella o una cartella che la contiene.
    if ($Lav.Length -le 3 -or $Lav -eq $Rad -or $Lav.StartsWith($Rad + '\', [StringComparison]::OrdinalIgnoreCase) -or $Rad.StartsWith($Lav + '\', [StringComparison]::OrdinalIgnoreCase)) { Fermo "la cartella di lavoro coincide con l'unita' o la contiene: $Lav" }
    # Si cancella solo una cartella che questo script ha creato (il segno), o una vuota.
    if ([IO.Directory]::Exists($Lav)) {
        if (-not [IO.File]::Exists((Join-Path $Lav '.mydev-lavoro')) -and @([IO.Directory]::EnumerateFileSystemEntries($Lav)).Count -gt 0) { Fermo "la cartella di lavoro esiste e non e' di questa prova: $Lav" }
        Remove-Item -LiteralPath $Lav -Recurse -Force
    }
    [void][IO.Directory]::CreateDirectory($Lav)
    [IO.File]::WriteAllText((Join-Path $Lav '.mydev-lavoro'), '', (New-Object Text.UTF8Encoding($false)))
    $Utf8 = New-Object Text.UTF8Encoding($false)
    Scrivi "unita': $Rad"
    Scrivi "lavoro: $Lav"

    function Lancia([string]$Exe, [string]$Argomenti, [hashtable]$Ambiente) {
        $psi = New-Object Diagnostics.ProcessStartInfo
        $psi.FileName = $Exe
        $psi.Arguments = $Argomenti
        $psi.UseShellExecute = $false
        $psi.CreateNoWindow = $true
        $psi.RedirectStandardOutput = $true
        $psi.RedirectStandardError = $true
        foreach ($k in $Ambiente.Keys) { $psi.EnvironmentVariables[$k] = $Ambiente[$k] }
        $pr = [Diagnostics.Process]::Start($psi)
        $o = $pr.StandardOutput.ReadToEndAsync()
        $e = $pr.StandardError.ReadToEndAsync()
        $pr.WaitForExit()
        return @{ Testo = ($o.Result + $e.Result); Uscita = $pr.ExitCode }
    }
    function Terminale([string]$Script, [hashtable]$Ambiente) {
        return Lancia $env:ComSpec ('/s /c ""' + (Join-Path $Qui 'terminale.bat') + '" "' + $Rad + '" "' + (Join-Path $Qui $Script) + '""') $Ambiente
    }

    $t = (Terminale 'estesa.sh' @{ ESTESA_OUT = $Lav; ESTESA_KIT = $Qui }).Testo
    [IO.File]::WriteAllText((Join-Path $Lav 'estesa.log'), $t, $Utf8)

    Verifica ($t.Contains('INIZIO estesa') -and $t.Contains('FINE estesa')) 'marcatori di inizio e fine nel log'
    $Posix = '/' + $Rad.Substring(0, 1) + $Rad.Substring(2).Replace('\', '/')
    Verifica ($t.Contains("CARGO_HOME=$Posix/home/.cargo")) 'CARGO_HOME in forma POSIX dentro l unita'
    foreach ($p in 'rustc', 'clippy', 'rustfmt', 'cargo new', 'cargo build', 'cargo run', 'cargo clippy', 'cargo fmt', 'git init', 'git commit', 'git clone', 'gh', 'gh senza MYDEV', 'gh col registro', "device-id dentro l'unita'", 'gh senza stato') {
        Verifica ($t -match ('(?m)^PASSO ' + [regex]::Escape($p) + ': uscita 0')) "$p`: uscita 0"
    }
    foreach ($s in 'atteso giusto true, codice 7', 'allarme arrivato true', 'thread 42', 'git: /usr/bin/git', 'telemetria: GH_TELEMETRY=false GH_NO_UPDATE_NOTIFIER=1', 'login: ARGOMENTI auth login --insecure-storage --web', 'refresh: ARGOMENTI auth refresh --insecure-storage -s repo', 'altro: ARGOMENTI auth status', 'gitconfig: percorsi 0, nome 1', 'controllo percorso: 1', 'token attivo: prima 0, dopo 1', 'logout senza strumento: hosts 0, ARGOMENTI 0') {
        Verifica ($t.Contains($s)) $s
    }
    foreach ($n in 'rust', 'git', 'gh', 'gh-stato') {
        $c = Numero $t $n
        Verifica ($c -eq 0) "sentinella $n`: $c file, attesi 0"
    }
    foreach ($n in 'cargo-fuori', 'gh-fuori') {
        $c = Numero $t $n
        Verifica ($c -ge 1) "controllo positivo $n`: $c file, atteso almeno 1"
    }

    # --- I progetti in Rust, contro lo stesso atteso del C.
    $r7 = (Terminale 'esegui_rust.sh' @{ ESEGUI_OUT = $Lav }).Testo
    $Log7 = Join-Path $Lav 'esegui_rust.log'
    [IO.File]::WriteAllText($Log7, $r7, $Utf8)
    $Arg7 = '-X utf8 -B "' + (Join-Path $Qui 'verifica_rust.py') + '" "' + $Log7 + '" "' + (Join-Path $Lav 'uscite-rust') + '" "' + (Join-Path $Rad 'progetti') + '"'
    $v7 = Lancia (Join-Path $Rad 'python\python.exe') $Arg7 @{}
    Scrivi $v7.Testo.TrimEnd()
    if ($v7.Uscita -eq 2) { Fermo 'verifica_rust.py non ha potuto misurare' }
    Verifica ($v7.Uscita -eq 0) "verifica_rust.py uscita $($v7.Uscita)"
    Verifica ($v7.Testo.Contains('appaiamento: 23 coppie (attese 23)')) 'E7: 23 progetti appaiati ai progetti C'
    Verifica ($v7.Testo.Contains('totale: coppie 23, confronti 23, rossi 0')) 'E7: 23 confronti, nessun rosso'
    Verifica ($v7.Testo.Contains('sonde false: chiamate=ACCESA unsafe=ACCESA leggimi=ACCESA uscita=ACCESA cartelle=ACCESA')) 'E7: sonde false accese'
    Verifica ($v7.Testo.Contains('non coppie dichiarate 3 (fastapi-hello, flask-hello, puntatori), senza posto 0, dichiarate assenti 0')) 'E7: ogni cartella di progetti ha un posto'

    # --- Il corso sui puntatori: i suoi due verificatori su una copia, la sonda, e la cartella contro l'inventario.
    $rp = (Terminale 'puntatori.sh' @{ PUNTATORI_OUT = $Lav }).Testo
    [IO.File]::WriteAllText((Join-Path $Lav 'puntatori.log'), $rp, $Utf8)
    Scrivi $rp.TrimEnd()
    function LeggiLog([string]$nome) { $p = Join-Path $Lav $nome; if ([IO.File]::Exists($p)) { return [IO.File]::ReadAllText($p, $Utf8) } return '' }
    $lv = LeggiLog 'puntatori-verifica.log'
    $le = LeggiLog 'puntatori-esempi.log'
    $ls = LeggiLog 'puntatori-sonda.log'
    Verifica ($rp.Contains('INIZIO puntatori') -and $rp.Contains('FINE puntatori')) 'corso: marcatori di inizio e fine'
    Verifica (($rp -match '(?m)^PASSO verifica: uscita 0') -and $lv.Contains('totale: 8 versioni in C e 3 in Rust provate, 0 problemi')) 'corso: verifica.py, 8 versioni in C e 3 in Rust, 0 problemi'
    Verifica (($rp -match '(?m)^PASSO verifica_esempi: uscita 0') -and $le.Contains('totale: 155 esempi, 0 problemi')) 'corso: verifica_esempi.py, 155 esempi, 0 problemi'
    Verifica ($le.Contains('sonde false: 22, viste 22')) 'corso: le 22 sonde false di verifica_esempi.py viste'
    Verifica (($rp -match '(?m)^PASSO sonda: uscita 1') -and $ls.Contains("ROTTO v0 senza ASan: uscita 0, differenze [(1, '(nil)', 'SONDA (nil)')]") -and $ls.Contains('totale: 8 versioni in C e 3 in Rust provate, 2 problemi'))'corso: sonda, un atteso alterato di v0 fa dire ROTTO a verifica.py'
    Verifica ($rp -match '(?m)^temporanei rimasti: 0') 'corso: nessun temporaneo rimasto'
    if (-not $Repo) { $Repo = Split-Path -Parent (Split-Path -Parent $Qui) }
    $Ugu = Join-Path $Repo 'ricetta\puntatori\uguaglianza.py'
    if (-not (Test-Path -LiteralPath $Ugu)) { Fermo "manca ${Ugu}, si passa -Repo" }
    $vu = Lancia (Join-Path $Rad 'python\python.exe') ('-X utf8 -B "' + $Ugu + '" --solo-copia --copia "' + (Join-Path $Rad 'progetti\puntatori') + '"') @{}
    Scrivi $vu.Testo.TrimEnd()
    if ($vu.Uscita -eq 2) { Fermo 'uguaglianza.py non ha potuto misurare' }
    Verifica ($vu.Uscita -eq 0 -and $vu.Testo.Contains('difetti: 0')) 'corso: progetti\puntatori uguale all inventario della ricetta'
    Verifica ($vu.Testo.Contains('sonde false: byte=ACCESA in-piu=ACCESA provenienza=ACCESA licenza=ACCESA')) 'corso: sonde false di uguaglianza.py accese'
    # Tutte le sonde, una per ramo del verdetto: accese quante ne dichiara, e almeno quelle contate con la copia sola.
    $mu = [regex]::Match($vu.Testo, 'sonde accese: (\d+)/(\d+)')
    Verifica ($mu.Success -and $mu.Groups[1].Value -eq $mu.Groups[2].Value -and [int]$mu.Groups[2].Value -ge 11) "corso: ogni sonda di uguaglianza.py accesa ($($mu.Value))"

    # --- La guida, appaiata con l'aggiunta. Il gate copia l'aggiunta accanto al kit.
    $Agg = Join-Path $Qui 'componenti-estesa.json'
    if (-not (Test-Path -LiteralPath $Agg)) { $Agg = Join-Path (Split-Path -Parent (Split-Path -Parent $Qui)) 'ricetta\componenti-estesa.json' }
    $Arg8 = '-X utf8 -B "' + (Join-Path $Qui 'guida.py') + '" "' + (Join-Path $Rad 'progetti\GUIDA-ESTESA.md') + '" "' + $Agg + '"'
    $v8 = Lancia (Join-Path $Rad 'python\python.exe') $Arg8 @{}
    Scrivi $v8.Testo.TrimEnd()
    if ($v8.Uscita -eq 2) { Fermo 'guida.py non ha potuto misurare' }
    Verifica ($v8.Uscita -eq 0) "guida.py uscita $($v8.Uscita)"
    Verifica ($v8.Testo.Contains("appaiamento: senza voce 0, voci senza componente 0, titoli mancanti 0, titoli in piu' 0")) 'E8: guida e aggiunta appaiate nei due versi'
    Verifica ($v8.Testo.Contains('sonde false: tolta=ACCESA senza-voce=ACCESA nome-estraneo=ACCESA senza-riga=ACCESA')) 'E8: sonde false accese'

    $Attesi = 53
    Scrivi "denominatore: controlli $script:Visti, attesi $Attesi"
    if ($script:Visti -ne $Attesi) { Fermo "controlli eseguiti $script:Visti, attesi $Attesi" }
    Scrivi "controlli rossi: $($script:Rossi.Count)"
    if ($script:Rossi.Count -gt 0) { Scrivi 'ESITO: ROSSO'; exit 1 }
    Scrivi 'ESITO: VERDE'
    exit 0
}
catch {
    Fermo "eccezione: $($_.Exception.Message) ($($_.InvocationInfo.ScriptLineNumber))"
}

# La prova di Rust, git e gh su un'unita' estesa costruita, dal suo terminale.
#
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File collaudo\unita\estesa.ps1 -Unita <cartella> [-Lavoro <cartella>]
#
# Uscite: 0 verde, 1 rosso, 2 fermo. Solo ASCII: PowerShell 5.1 legge un .ps1 senza BOM come ANSI.
#
# Che cosa NON guarda: l'editor; il login di gh; che l'https vada (si stampa, ma non decide: vuole la rete).

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Unita,
    [string]$Lavoro = ''
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
    Verifica ($v7.Testo.Contains('sonde false: chiamate=ACCESA unsafe=ACCESA leggimi=ACCESA uscita=ACCESA')) 'E7: sonde false accese'

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

    $Attesi = 43
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

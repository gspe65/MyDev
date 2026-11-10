# La prova dell'ambiente C su un'unita' costruita: compila, collega ed esegue dalla sua radice.
#
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File collaudo\unita\prova.ps1 -Unita <cartella>
#   opzioni: -Lavoro <cartella>  (uscite e programmi fuori dall'unita'; predefinita in %TEMP%)
#
# Uscite: 0 verde, 1 rosso, 2 fermo. Solo ASCII: PowerShell 5.1 legge un .ps1 senza BOM come ANSI.
#
# Che cosa NON guarda: il progetto interattivo 15-segnali; i servizi web; l'editor.

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
function Verifica([bool]$ok, [string]$cosa) {
    if ($ok) { Scrivi "  ok    $cosa" } else { Scrivi "  ROSSO $cosa"; $script:Rossi.Add($cosa) }
}

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

try {
    $Qui = Split-Path -Parent $MyInvocation.MyCommand.Definition
    $Rad = [IO.Path]::GetFullPath($Unita).TrimEnd('\')
    if (-not (Test-Path -LiteralPath (Join-Path $Rad 'msys64\usr\bin\bash.exe'))) { Fermo "non e' un'unita': $Rad" }
    if (-not $Lavoro) { $Lavoro = Join-Path $env:TEMP 'mydev-prova-c' }
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
    $Bat = Join-Path $Qui 'terminale.bat'
    Scrivi "unita': $Rad"
    Scrivi "lavoro: $Lav"

    function Terminale([string]$sh, [hashtable]$amb) {
        $riga = '/s /c ""' + $Bat + '" "' + $Rad + '" "' + (Join-Path $Qui $sh) + '""'
        return Lancia $env:ComSpec $riga $amb
    }

    # --- La compilazione e le uscite.
    Scrivi '=== compila ed esegue i progetti'
    $r = Terminale 'esegui.sh' @{ ESEGUI_OUT = $Lav }
    $Log = Join-Path $Lav 'esegui.log'
    [IO.File]::WriteAllText($Log, $r.Testo, $Utf8)
    $t = $r.Testo
    Verifica ($t.Contains('INIZIO esegui') -and $t.Contains('FINE esegui')) 'marcatori di inizio e fine nel log'
    Verifica ($t -match 'compilati con gcc\s*:\s*21 su 21') 'gcc 21 su 21'
    Verifica ($t -match 'compilati con clang\s*:\s*9 su 21') 'clang 9 su 21'
    Verifica ($t -match 'residui di confronta.sh: 0') 'residui di confronta.sh: 0'
    Verifica ($t -match 'totale residui: 0') 'residui nei progetti dopo la corsa: 0'

    $Python = Join-Path $Rad 'python\python.exe'
    $Arg = '-X utf8 -B "' + (Join-Path $Qui 'verifica.py') + '" "' + $Log + '" "' + (Join-Path $Lav 'uscite') + '" "' + (Join-Path $Rad 'progetti') + '"'
    $v = Lancia $Python $Arg $null
    [IO.File]::WriteAllText((Join-Path $Lav 'verifica.txt'), $v.Testo, $Utf8)
    if ($v.Uscita -eq 2) { Scrivi $v.Testo; Fermo 'verifica.py non ha potuto misurare' }
    Verifica ($v.Uscita -eq 0) "verifica.py uscita $($v.Uscita)"
    Verifica ($v.Testo -match 'tabella: 21 righe lette') 'tabella: 21 righe (denominatore)'
    Verifica ($v.Testo -match 'tabella: 0 differenze') 'tabella appaiata per nome: 0 differenze (clang i 9 di c-comuni)'
    Verifica ($v.Testo -match 'uscite: 29 confronti, 0 diversi') 'uscite: 29 su 29'
    Verifica ($v.Testo -match 'sonde false: esatto=DIVERSO numeri=DIVERSO tabella=DIVERSO gara=DIVERSO') 'sonde false accese'
    Verifica ($v.Testo -match 'sonde dei modi: insieme=DIVERSO estremi=DIVERSO estremi-numeri=DIVERSO argv0=DIVERSO; modi usati 7, sondati 7') 'una sonda per ogni modo di confronto'

    # --- AddressSanitizer: lo stesso programma con e senza; l'esito deve cambiare e il rapporto dire file e riga.
    Scrivi '=== AddressSanitizer'
    # Una funzione sola per il dato vero e per la sonda: il verdetto che decide e' quello che si vede rosso.
    function GiudicaAsan([string]$rcSenza, [string]$rcCon, [string]$rapporto) {
        $d = New-Object Collections.Generic.List[string]
        if ($rcSenza -ne '0') { $d.Add("senza il sanitizer uscita $rcSenza invece di 0") }
        if ($rcCon -eq '0' -or $rcCon -eq '') { $d.Add("col sanitizer uscita '$rcCon': l'esito non cambia") }
        if ($rapporto -notmatch 'heap-buffer-overflow') { $d.Add('rapporto senza heap-buffer-overflow') }
        if ($rapporto -notmatch 'sconfina\.c:6') { $d.Add('rapporto senza file e riga') }
        return , $d
    }
    function LeggiAsan([string]$nome) {
        $p = Join-Path $Lav "asan  lavoro\$nome"
        if (-not [IO.File]::Exists($p)) { return '' }
        return [IO.File]::ReadAllText($p, $Utf8).Trim()
    }
    $r = Terminale 'asan.sh' @{ ESEGUI_OUT = $Lav; ASAN_SORGENTE = (Join-Path $Qui 'sconfina.c') }
    [IO.File]::WriteAllText((Join-Path $Lav 'asan.log'), $r.Testo, $Utf8)
    Scrivi "  uscite: senza $(LeggiAsan 'senza.rc'), con $(LeggiAsan 'con.rc'), sonda $(LeggiAsan 'finta.rc')"
    $Vero = GiudicaAsan (LeggiAsan 'senza.rc') (LeggiAsan 'con.rc') (LeggiAsan 'rapporto.txt')
    foreach ($x in $Vero) { Scrivi "  difetto: $x" }
    Verifica ($Vero.Count -eq 0) 'ASan: l esito cambia, il rapporto ha file e riga'
    $Finta = GiudicaAsan (LeggiAsan 'senza.rc') (LeggiAsan 'finta.rc') (LeggiAsan 'sonda.txt')
    Verifica ($Finta.Count -ge 1) "sonda ASan, compilato senza sanitizer: difetti $($Finta.Count), atteso almeno 1"

    # --- Gli eseguibili portati fuori, col solo PATH di sistema.
    Scrivi '=== eseguibili fuori dall''unita'''
    $Fuori = Join-Path $Lav 'fuori'
    $r = Terminale 'fuori.sh' @{ FUORI = $Fuori }
    [IO.File]::WriteAllText((Join-Path $Lav 'fuori.log'), $r.Testo, $Utf8)
    # Senza questo, una DLL mancante apre una finestra di errore e il passo resta appeso.
    if (-not ('K.Err' -as [type])) {
        Add-Type -Namespace K -Name Err -MemberDefinition '[DllImport("kernel32.dll")] public static extern uint SetErrorMode(uint m);'
    }
    [void][K.Err]::SetErrorMode(3)
    $Atteso = [ordered]@{
        'ciao-clang.exe'          = 0
        'thread-clang.exe'        = -1073741515
        'thread-clang-static.exe' = 0
        'ciao-gcc-msys.exe'       = -1073741515
    }
    $Solo = @{ PATH = "$env:SystemRoot\system32;$env:SystemRoot" }
    foreach ($exe in $Atteso.Keys) {
        $f = Join-Path $Fuori $exe
        if (-not (Test-Path -LiteralPath $f)) { Verifica $false "$exe presente"; continue }
        $x = Lancia $f '' $Solo
        Verifica ($x.Uscita -eq $Atteso[$exe]) ("{0} uscita {1}, attesa {2}" -f $exe, $x.Uscita, $Atteso[$exe])
        $testo = $x.Testo.Trim()
        if ($exe -eq 'ciao-clang.exe') { Verifica ($testo -eq 'Ciao, mondo!') "ciao-clang stampa il saluto" }
        if ($exe -eq 'thread-clang-static.exe') { Verifica ($testo -match 'thread') 'thread-clang-static stampa i thread' }
    }

    # --- L'esito.
    Scrivi "controlli rossi: $($script:Rossi.Count)"
    if ($script:Rossi.Count -gt 0) { Scrivi 'ESITO: ROSSO'; exit 1 }
    Scrivi 'ESITO: VERDE'
    exit 0
}
catch {
    Fermo "eccezione: $($_.Exception.Message) ($($_.InvocationInfo.ScriptLineNumber))"
}

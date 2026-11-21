# Verifica un'unita' costruita contro l'elenco dei propri file.
#
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File ricetta\verifica.ps1 -Unita <cartella>
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File ricetta\verifica.ps1 -Sonde
#
# Uscite: 0 verde, 1 rosso (nomina i file), 2 fermo (non si e' potuto misurare).
#
# Con -Sonde, senza unita': le sonde del giudice dei nati dall'uso (NatoDallUso), sui modelli e sui prefissi che la
# costruzione scrive in unita.json, letti da costruisci.ps1 accanto a questo file. Ogni sonda e' un percorso finto con il
# verdetto atteso: il .pyc misurato dopo il passo passo (controllo positivo), **/ a zero e a due cartelle, e i file che il
# modello deve dire estranei (un .py, un .pyc fuori da __pycache__, una cartella sotto __pycache__, un .pyd, una cartella
# che comincia come lib). Poi la mutazione: il modello ridotto al suo prefisso (la forma di prima, che ammetteva ogni file
# sotto llvm/python/lib/) deve ammettere il .py che il modello rifiuta. Il numero delle sonde e' dichiarato ($SondeAttese).
# Uscite con -Sonde: 0 tutte accese, 2 fermo (una spenta, il numero diverso, i modelli non letti).
#
# Che cosa NON guarda:
# - i file dichiarati variabili, di cui controlla solo la presenza;
# - che i programmi funzionino;
# - che cosa contengono i file nati dall'uso sotto i prefissi dichiarati in unita.json (o che ne seguono i modelli, le voci
#   con *): si contano e basta; fa eccezione una cartella di estensione nuova sotto vscodium/data/extensions/, che e' un ESTRANEO;
# - le cartelle vuote: l'elenco ha solo file, e una copia che le perde non si vede.
# Una radice di disco (E:\) si legge come una cartella qualsiasi.

[CmdletBinding(DefaultParameterSetName = 'Unita')]
param(
    [Parameter(Mandatory = $true, ParameterSetName = 'Unita')][string]$Unita,
    [Parameter(Mandatory = $true, ParameterSetName = 'Sonde')][switch]$Sonde
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2

# La verifica e il giudice dei nati dall'uso (NatoDallUso) stanno nel motore generico, accanto a questo file; qui restano le
# parti di MyDev: la cartella chiusa delle estensioni dell'editor e le sonde.
$Motore = Join-Path $PSScriptRoot 'motore.ps1'
if (-not (Test-Path -LiteralPath $Motore)) { [Console]::Out.WriteLine("FERMO: manca $Motore"); [Console]::Out.WriteLine('ESITO: FERMO'); exit 2 }
. $Motore

# Le sonde di NatoDallUso. Il percorso del controllo positivo e' quello misurato dopo il passo passo nel Python di lldb.
$SondeAttese = 10
if ($Sonde) {
    try {
        $Costr = Join-Path $PSScriptRoot 'costruisci.ps1'
        if (-not (Test-Path -LiteralPath $Costr)) { Fermo "manca $Costr`: le sonde leggono da li' i nati dall'uso" }
        $Testo = [IO.File]::ReadAllText($Costr, (New-Object Text.UTF8Encoding($false)))
        $Blocco = [regex]::Match($Testo, '(?ms)^\$NatiDallUso = @\((.*?)^\)')
        if (-not $Blocco.Success) { Fermo 'l''elenco $NatiDallUso non si trova in costruisci.ps1' }
        $Voci = @([regex]::Matches($Blocco.Groups[1].Value, "(?m)^\s*'([^']+)'") | ForEach-Object { $_.Groups[1].Value })
        $Modello = 'llvm/python/lib/**/__pycache__/*.pyc'
        Scrivi "nati dall'uso in costruisci.ps1: $($Voci.Count) voci, con *: $(@($Voci | Where-Object { $_.IndexOf('*') -ge 0 }).Count)"
        if ($Voci -notcontains $Modello) { Fermo "il modello delle sonde ($Modello) non e' fra i nati dall'uso di costruisci.ps1" }
        $Casi = [ordered]@{
            'il .pyc misurato (controllo positivo)'   = @('llvm/python/lib/python3.14/encodings/__pycache__/aliases.cpython-314.pyc', $true)
            '**/ a zero cartelle'                     = @('llvm/python/lib/__pycache__/x.cpython-314.pyc', $true)
            '**/ a due cartelle'                      = @('llvm/python/lib/python3.14/site-packages/__pycache__/x.cpython-314.pyc', $true)
            'un prefisso senza *'                     = @('home/.bash_history', $true)
            'un .py nuovo'                            = @('llvm/python/lib/python3.14/encodings/nuovo.py', $false)
            'un .pyc fuori da __pycache__'            = @('llvm/python/lib/python3.14/encodings/aliases.pyc', $false)
            'una cartella sotto __pycache__'          = @('llvm/python/lib/python3.14/__pycache__/sotto/x.cpython-314.pyc', $false)
            'un .pyd in __pycache__'                  = @('llvm/python/lib/python3.14/__pycache__/x.pyd', $false)
            'una cartella che comincia come lib'      = @('llvm/python/libx/__pycache__/x.cpython-314.pyc', $false)
        }
        $Accese = 0
        $Spente = New-Object Collections.Generic.List[string]
        foreach ($k in $Casi.Keys) {
            $visto = NatoDallUso $Casi[$k][0] $Voci
            $ok = ($visto -eq $Casi[$k][1])
            if ($ok) { $Accese++ } else { $Spente.Add($k) }
            Scrivi ("sonda {0}: {1} -> {2}, atteso {3}: {4}" -f $k, $Casi[$k][0], $(if ($visto) { 'nato dall''uso' } else { 'ESTRANEO' }), $(if ($Casi[$k][1]) { 'nato dall''uso' } else { 'ESTRANEO' }), $(if ($ok) { 'ACCESA' } else { 'SPENTA' }))
        }
        # La mutazione: al posto del modello il suo prefisso, la forma di prima. Il .py nuovo deve passare da estraneo a nato.
        $Prefisso = $Modello.Substring(0, $Modello.IndexOf('*'))
        $Mutate = @($Voci | ForEach-Object { if ($_ -ceq $Modello) { $Prefisso } else { $_ } })
        $Toccate = @($Voci | Where-Object { $_ -ceq $Modello }).Count
        $Py = $Casi['un .py nuovo'][0]
        $Cambia = (-not (NatoDallUso $Py $Voci)) -and (NatoDallUso $Py $Mutate)
        if ($Toccate -eq 1 -and $Cambia) { $Accese++ } else { $Spente.Add('il modello ridotto al prefisso') }
        Scrivi "sonda il modello ridotto al prefisso ($Prefisso, voci toccate $Toccate): $Py da ESTRANEO a nato dall'uso: $(if ($Toccate -eq 1 -and $Cambia) { 'ACCESA' } else { 'SPENTA' })"
        $Tot = $Casi.Count + 1
        Scrivi "sonde: $Accese accese su $Tot, dichiarate $SondeAttese"
        if ($Tot -ne $SondeAttese) { Fermo "sonde nell'elenco $Tot, dichiarate $SondeAttese" }
        if ($Spente.Count -gt 0) { Fermo "sonde spente: $($Spente -join ', ')" }
        Scrivi 'ESITO: VERDE (sonde)'
        exit 0
    }
    catch {
        Fermo "eccezione: $($_.Exception.Message) ($($_.InvocationInfo.ScriptLineNumber))"
    }
}

try {
    # Un'estensione che non c'era alla costruzione non e' un dato dell'uso: e' una versione cambiata.
    VerificaUnita $Unita @{ 'vscodium/data/extensions/' = "un'estensione che la costruzione non ha installato" }
}
catch {
    Fermo "eccezione: $($_.Exception.Message) ($($_.InvocationInfo.ScriptLineNumber))"
}

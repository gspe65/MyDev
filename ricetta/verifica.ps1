# Verifica un'unita' costruita contro l'elenco dei propri file.
#
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File ricetta\verifica.ps1 -Unita <cartella>
#
# Uscite: 0 verde, 1 rosso (nomina i file), 2 fermo (non si e' potuto misurare).
#
# Che cosa NON guarda:
# - i file dichiarati variabili, di cui controlla solo la presenza;
# - che i programmi funzionino;
# - che cosa contengono i file nati dall'uso sotto i prefissi dichiarati in unita.json: si contano e basta; fa
#   eccezione una cartella di estensione nuova sotto vscodium/data/extensions/, che e' un ESTRANEO;
# - le cartelle vuote: l'elenco ha solo file, e una copia che le perde non si vede.
# Una radice di disco (E:\) si legge come una cartella qualsiasi.

[CmdletBinding()]
param([Parameter(Mandatory = $true)][string]$Unita)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2

function Scrivi([string]$t) { [Console]::Out.WriteLine($t) }
function Fermo([string]$m) { Scrivi "FERMO: $m"; Scrivi 'ESITO: FERMO'; exit 2 }

try {
    $Radice = [IO.Path]::GetFullPath($Unita).TrimEnd('\')
    $Lista = Join-Path $Radice 'unita-file.txt'
    $Dich = Join-Path $Radice 'unita.json'
    if (-not (Test-Path -LiteralPath $Lista)) { Fermo "manca unita-file.txt in $Radice" }
    if (-not (Test-Path -LiteralPath $Dich)) { Fermo "manca unita.json in $Radice" }
    $Utf8 = New-Object Text.UTF8Encoding($false)
    $D = [IO.File]::ReadAllText($Dich, $Utf8) | ConvertFrom-Json
    $VoceVariante = $D.PSObject.Properties['variante']
    $NomeVariante = if ($null -ne $VoceVariante) { $VoceVariante.Value } else { 'non dichiarata' }
    $VoceAlbero = $D.PSObject.Properties['albero']
    $NomeAlbero = if ($null -ne $VoceAlbero) { $VoceAlbero.Value } else { 'non dichiarato' }
    Scrivi "unita': numero $($D.numero), variante $NomeVariante, commit $($D.commit), albero $NomeAlbero"

    $Attesi = @{}
    foreach ($r in [IO.File]::ReadAllLines($Lista, $Utf8)) {
        if (-not $r) { continue }
        $i = $r.IndexOf('  ')
        $Attesi[$r.Substring($i + 2)] = $r.Substring(0, $i)
    }

    $Nati = @()
    $Voce = $D.PSObject.Properties['nati_dall_uso']
    if ($null -ne $Voce) { $Nati = @($Voce.Value) }

    $Errori = New-Object Collections.Generic.List[string]
    $Controllati = 0
    $NatiVisti = 0
    $Presenti = @{}
    # Alla radice di un disco GetFullPath e TrimEnd danno E:, che per l'enumerazione e' la cartella corrente del disco.
    $Base = $Radice + '\'
    $n = $Base.Length
    $Ext = 'vscodium/data/extensions/'
    $Cartelle = @{}
    foreach ($k in $Attesi.Keys) { if ($k.StartsWith($Ext, [StringComparison]::Ordinal) -and $k.IndexOf('/', $Ext.Length) -gt 0) { $Cartelle[$k.Substring($Ext.Length, $k.IndexOf('/', $Ext.Length) - $Ext.Length)] = 1 } }
    foreach ($f in [IO.Directory]::EnumerateFiles($Base, '*', [IO.SearchOption]::AllDirectories)) {
        $rel = $f.Substring($n).Replace('\', '/')
        if ($rel -ceq 'unita-file.txt' -or $rel -ceq 'unita.json') { continue }
        $Presenti[$rel] = 1
        if (-not $Attesi.ContainsKey($rel)) {
            # Un'estensione che non c'era alla costruzione non e' un dato dell'uso: e' una versione cambiata.
            if ($rel.StartsWith($Ext, [StringComparison]::Ordinal) -and $rel.IndexOf('/', $Ext.Length) -gt 0 -and -not $Cartelle.ContainsKey($rel.Substring($Ext.Length, $rel.IndexOf('/', $Ext.Length) - $Ext.Length))) {
                $Errori.Add("ESTRANEO: $rel (un'estensione che la costruzione non ha installato)")
                continue
            }
            $ammesso = $false
            foreach ($q in $Nati) { if ($rel.StartsWith($q, [StringComparison]::Ordinal)) { $ammesso = $true; break } }
            if ($ammesso) { $NatiVisti++ } else { $Errori.Add("ESTRANEO: $rel") }
            continue
        }
        $atteso = $Attesi[$rel]
        if ($atteso -eq '-') { continue }
        $Controllati++
        $s = (Get-FileHash -LiteralPath $f -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($s -ne $atteso) { $Errori.Add("IMPRONTA: $rel") }
    }
    foreach ($k in $Attesi.Keys) { if (-not $Presenti.ContainsKey($k)) { $Errori.Add("MANCA: $k") } }

    Scrivi "file nell'elenco: $($Attesi.Count), con impronta controllata: $Controllati, nati dall'uso: $NatiVisti (prefissi dichiarati: $($Nati.Count)), errori: $($Errori.Count)"
    if ($Errori.Count -gt 0) {
        $Errori | Sort-Object | Select-Object -First 30 | ForEach-Object { Scrivi "  $_" }
        Scrivi 'ESITO: ROSSO'
        exit 1
    }
    Scrivi 'ESITO: VERDE'
    exit 0
}
catch {
    Fermo "eccezione: $($_.Exception.Message) ($($_.InvocationInfo.ScriptLineNumber))"
}

# Scarica i sorgenti dei componenti di un'unita' la cui licenza chiede di darli a chi riceve il programma (GPL, LGPL,
# AGPL, MPL, EPL), alla versione esatta, e li verifica con byte e impronta di ricetta\sorgenti.json.
#
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File ricetta\sorgenti.ps1 -Destinazione <cartella>
#   opzioni: -Variante base|estesa  -SenzaRete
#
# La cartella si mette sulla chiavetta accanto all'unita', o si conserva per onorare un'offerta scritta: lo spiega
# LICENZE.txt dell'unita'. Un file gia' presente non si riscarica, si verifica.
#
# Uscite: 0 verde, 1 rosso, 2 fermo (non si e' potuto scaricare o misurare).
#
# Che cosa NON guarda:
# - che l'elenco sia completo: lo controlla ricetta\licenze_unita.py, che vuole un sorgente per ogni componente la cui
#   licenza lo chiede;
# - il contenuto degli archivi: si confrontano byte e impronta, non si apre nulla;
# - gli archivi che il server genera al volo (la FFmpeg di Chromium): due richieste danno byte diversi, quindi non
#   hanno impronta; si prendono dall'indirizzo col commit, si legge che siano un gzip intero e si nominano in uscita.

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Destinazione,
    [ValidateSet('base', 'estesa')][string]$Variante = 'base',
    [switch]$SenzaRete
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2

function Scrivi([string]$t) { [Console]::Out.WriteLine($t) }
function Rosso([string]$m) { Scrivi "ROSSO: $m"; Scrivi 'ESITO: ROSSO'; exit 1 }
function Fermo([string]$m) { Scrivi "FERMO: $m"; Scrivi 'ESITO: FERMO'; exit 2 }
function Impronta([string]$p) { return (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant() }
function Leggi([string]$p) { return [IO.File]::ReadAllText($p, (New-Object Text.UTF8Encoding($false))) | ConvertFrom-Json }

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $Qui = Split-Path -Parent $MyInvocation.MyCommand.Definition
    $Elenco = Leggi (Join-Path $Qui 'sorgenti.json')
    $Nomi = @{}
    foreach ($c in (Leggi (Join-Path $Qui 'componenti.json')).scaricati) { $Nomi[$c.nome] = 1 }
    if ($Variante -eq 'estesa') { foreach ($c in (Leggi (Join-Path $Qui 'componenti-estesa.json')).scaricati) { $Nomi[$c.nome] = 1 } }
    $Scelti = @($Elenco.sorgenti | Where-Object { @($_.componenti | Where-Object { $Nomi.ContainsKey($_) }).Count -gt 0 })
    if ($Scelti.Count -eq 0) { Fermo "nessun sorgente per la variante $Variante" }

    $Dest = [IO.Path]::GetFullPath($Destinazione)
    [void][IO.Directory]::CreateDirectory($Dest)
    $Ora = 0
    $Byte = [long]0
    $Instabili = @()
    foreach ($s in $Scelti) {
        $p = Join-Path $Dest $s.file
        if (-not (Test-Path -LiteralPath $p)) {
            if ($SenzaRete) { Fermo "manca: $($s.file) ($($s.componenti -join ', '))" }
            $parte = "$p.parte"
            $wc = New-Object Net.WebClient
            $wc.Headers['User-Agent'] = 'mydev-sorgenti'
            try { $wc.DownloadFile($s.fonte, $parte) }
            catch { Fermo "scaricamento non riuscito: $($s.fonte): $($_.Exception.Message)" }
            finally { $wc.Dispose() }
            Move-Item -LiteralPath $parte -Destination $p
            $Ora++
        }
        $n = (Get-Item -LiteralPath $p).Length
        $Byte += $n
        # Un archivio generato al volo dal server cambia a ogni richiesta (le date dei file): non ha un'impronta.
        # Senza impronta si guarda almeno che sia un gzip intero: si legge fino in fondo, e uno troncato o vuoto da' rosso.
        if ($null -eq $s.PSObject.Properties['sha256']) {
            $letti = [long]0
            $f = [IO.File]::OpenRead($p)
            try {
                $z = New-Object IO.Compression.GZipStream($f, [IO.Compression.CompressionMode]::Decompress)
                $buf = New-Object byte[] 1048576
                try { while (($k = $z.Read($buf, 0, $buf.Length)) -gt 0) { $letti += $k } }
                catch { Rosso "$($s.file): non e' un archivio gzip intero: $($_.Exception.Message)" }
                finally { $z.Dispose() }
            }
            finally { $f.Dispose() }
            if ($letti -lt 1MB) { Rosso "$($s.file): $letti byte decompressi, troppo pochi per un sorgente" }
            # Il gzip scrive in coda la lunghezza decompressa: un archivio troncato non la porta, e .NET non lo segnala.
            $tutto = [IO.File]::ReadAllBytes($p)
            $coda = [BitConverter]::ToUInt32($tutto, $tutto.Length - 4)
            if ($coda -ne ($letti % 4294967296)) { Rosso "$($s.file): troncato ($letti byte decompressi, la coda ne dichiara $coda)" }
            $Instabili += $s.file
            continue
        }
        if ($n -ne $s.byte) { Rosso "$($s.file): $n byte invece di $($s.byte)" }
        $h = Impronta $p
        if ($h -ne $s.sha256) { Rosso "$($s.file): impronta $h invece di $($s.sha256)" }
    }
    foreach ($f in $Instabili) { Scrivi "senza impronta, generato al volo dal server: $f (il commit e' nell'indirizzo)" }
    Scrivi "variante: $Variante; sorgenti: $($Scelti.Count), scaricati ora $Ora, MB $([math]::Round($Byte / 1MB))"
    Scrivi "cartella: $Dest"
    Scrivi 'ESITO: VERDE'
    exit 0
}
catch { Fermo "$($_.Exception.Message)" }

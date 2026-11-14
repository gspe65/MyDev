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
# - l'impronta degli archivi che il server genera al volo (la FFmpeg di Chromium da googlesource: due richieste danno
#   byte diversi): si prendono dall'indirizzo col commit, si legge che siano un gzip intero e si nominano in uscita.
#   Possono non avere l'impronta solo le voci elencate per nome in $SenzaImpronta, confrontato coi sorgenti nei due
#   versi: una voce senza impronta che non vi compare, o una che vi compare e ha l'impronta o non esiste, da' rosso.
#   Un archivio di GitHub a un commit fissato porta byte e impronta come gli altri: misurato stabile nel novembre 2026 (tre
#   scaricamenti uguali), ma GitHub non lo garantisce. Se un giorno l'impronta cambia, si confronta il contenuto
#   dell'archivio nuovo con quello vecchio e, se e' lo stesso, si rimisurano byte e impronta in sorgenti.json;
# - un .parte lasciato da un processo ucciso (Ctrl+C e gli errori lo tolgono): si vede per nome nella cartella.

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

# Le sole voci che possono non avere l'impronta: archivi generati al volo dal server, nominati uno per uno.
$SenzaImpronta = @('ffmpeg-chromium-ad41607c6189.tar.gz', 'ffmpeg-chromium-5c85ff666b34.tar.gz')

# Le voci senza impronta contro l'elenco dichiarato, nei due versi. $Voci: nome del file -> ha l'impronta.
# Scrive un difetto per riga, ognuno col suo file; nessuna riga se tornano.
function Confronta($Voci, [string[]]$Dichiarati) {
    foreach ($f in @($Voci.Keys | Sort-Object)) {
        if (-not $Voci[$f] -and $Dichiarati -notcontains $f) { "senza impronta e non dichiarato: $f" }
    }
    foreach ($f in $Dichiarati) {
        if (-not $Voci.ContainsKey($f)) { "dichiarato senza impronta, ma non e' fra i sorgenti: $f" }
        elseif ($Voci[$f]) { "dichiarato senza impronta, ma ne ha una: $f" }
    }
}

try {
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $Qui = Split-Path -Parent $MyInvocation.MyCommand.Definition
    $Elenco = Leggi (Join-Path $Qui 'sorgenti.json')

    # Prima di scaricare: quali voci non hanno l'impronta, contro $SenzaImpronta, con le sonde false.
    $Mappa = @{}
    foreach ($v in $Elenco.sorgenti) {
        if ($Mappa.ContainsKey($v.file)) { Fermo "voce doppia in sorgenti.json: $($v.file)" }
        $Mappa[$v.file] = ($null -ne $v.PSObject.Properties['sha256'])
    }
    $Difetti = @(Confronta $Mappa $SenzaImpronta)
    # Sonde false: ognuna altera una cosa sola in una copia e deve far comparire il SUO difetto, cercato per nome.
    $Stabili = @($Elenco.sorgenti | Where-Object { $null -ne $_.PSObject.Properties['sha256'] })
    if ($Stabili.Count -eq 0) { Fermo 'nessuna voce con impronta per la sonda' }
    $Stabile = $Stabili[0].file
    $Tolta = $Mappa.Clone()
    $Tolta[$Stabile] = $false
    $ConImpronta = $Mappa.Clone()
    $ConImpronta[$SenzaImpronta[0]] = $true
    $Sonde = [ordered]@{
        'tolta'        = (@(Confronta $Tolta $SenzaImpronta) -contains "senza impronta e non dichiarato: $Stabile")
        'assente'      = (@(Confronta $Mappa ($SenzaImpronta + 'sonda-assente.tar.gz')) -contains "dichiarato senza impronta, ma non e' fra i sorgenti: sonda-assente.tar.gz")
        'con-impronta' = (@(Confronta $ConImpronta $SenzaImpronta) -contains "dichiarato senza impronta, ma ne ha una: $($SenzaImpronta[0])")
    }
    $Righe = foreach ($Sonda in $Sonde.Keys) { if ($Sonde[$Sonda]) { "$Sonda=ACCESA" } else { "$Sonda=ROTTA" } }
    $SenzaNelElenco = @($Mappa.Keys | Where-Object { -not $Mappa[$_] }).Count
    Scrivi "voci: $($Mappa.Count); senza impronta: $SenzaNelElenco, dichiarate per nome: $($SenzaImpronta.Count)"
    Scrivi "sonde false: $($Righe -join ' ')"
    if (@($Sonde.Values | Where-Object { -not $_ }).Count -gt 0) { Fermo 'una sonda non si accende' }
    foreach ($x in $Difetti) { Scrivi "ROSSO: $x" }
    if ($Difetti.Count -gt 0) { Scrivi 'ESITO: ROSSO'; exit 1 }

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
            $Arrivato = $false
            try { $wc.DownloadFile($s.fonte, $parte); $Arrivato = $true }
            catch { Fermo "scaricamento non riuscito: $($s.fonte): $($_.Exception.Message)" }
            finally {
                $wc.Dispose()
                # Uno scaricamento non riuscito o interrotto (anche con Ctrl+C) non lascia il .parte nella cartella che si
                # da' via. Il finally gira anche dopo l'exit di Fermo (misurato in 5.1).
                if (-not $Arrivato -and (Test-Path -LiteralPath $parte)) { Remove-Item -LiteralPath $parte -Force -ErrorAction SilentlyContinue }
            }
            # Lo spostamento ha il suo messaggio: il file e' arrivato intero, e non e' la fonte a mancare.
            try { Move-Item -LiteralPath $parte -Destination $p }
            catch { Fermo "scaricato ma non spostato: $parte in $p ($($_.Exception.Message)) -- il file arrivato resta col nome .parte: si rinomina a mano togliendo .parte, poi si rilancia" }
            $Ora++
        }
        $n = (Get-Item -LiteralPath $p).Length
        $Byte += $n
        # Un archivio generato al volo dal server cambia a ogni richiesta (le date dei file): non ha un'impronta, e qui
        # arriva solo se e' in $SenzaImpronta (controllato prima di scaricare).
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

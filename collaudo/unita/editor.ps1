# Le parti proprietarie dell'unita' e il blocco degli aggiornamenti dell'editor, a file fermi: nessuna finestra.
#
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File collaudo\unita\editor.ps1 -Unita <cartella> [-Vsix <file>]
#
# Cerca, in tutta l'unita':
# - i file noti dell'editor per nome;
# - ogni programma o libreria che nelle voci di versione nomina Microsoft: quelli previsti stanno nell'elenco
#   qui sotto, uno per uno e col motivo; uno senza voce, o una voce senza file, e' un rosso;
# - vsce-sign, nei nomi di tutta l'unita' e nell'elenco del .vsix dato;
# - le due chiavi di aggiornamento in product.json;
# - le chiavi di blocco nelle impostazioni dell'editor, coi valori scritti qui (non letti dalla ricetta), con una sonda
#   che altera una chiave e deve dare rosso.
#
# Uscite: 0 verde, 1 rosso (nomina i file), 2 fermo (non si e' potuto misurare).
#
# Che cosa NON guarda:
# - i file senza voci di versione: un programma proprietario che non le ha passa;
# - la licenza dei file che non nominano Microsoft, e ffmpeg.dll coi suoi codec;
# - che l'editor si comporti come dicono le chiavi: si guarda che ci siano, coi valori del blocco.

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Unita,
    [string]$Vsix = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2

function Scrivi([string]$t) { [Console]::Out.WriteLine($t) }
function Fermo([string]$m) { Scrivi "FERMO: $m"; Scrivi 'ESITO: FERMO'; exit 2 }

$FileNoti = @('d3dcompiler_47.dll', 'dxcompiler.dll', 'dxil.dll', 'codium-tunnel.exe')
$ChiaviVietate = @('updateUrl', 'extensionsGallery')
# Le chiavi del blocco nelle impostazioni dell'utente dell'editor, coi loro valori.
$Blocco = [ordered]@{
    'update.mode' = 'none'; 'extensions.autoCheckUpdates' = $false; 'extensions.autoUpdate' = 'off'
    'telemetry.telemetryLevel' = 'off'; 'chat.disableAIFeatures' = $true; 'workbench.welcomePage.extraAnnouncements' = $false
}
# Percorsi relativi alla radice dell'unita', a barre dritte e minuscoli.
$Conpty = 'vscodium/resources/app/node_modules.asar.unpacked/node-pty/build/release/conpty'
$Lettura = 'vscodium/resources/app/out/vs/workbench/contrib/terminal/common/scripts/psreadline'
$Dichiarati = @{
    "$Conpty/conpty.dll"                                                     = 'terminale integrato: ConPTY di Microsoft, MIT per il suo pacchetto; nota nella voce dell''editor in LICENZE.txt'
    "$Conpty/openconsole.exe"                                                = 'terminale integrato: ConPTY di Microsoft, MIT per il suo pacchetto; nota nella voce dell''editor in LICENZE.txt'
    "$Lettura/microsoft.powershell.pager.dll"                                = 'integrazione con PowerShell: nessun testo di licenza nel pacchetto; nota nella voce dell''editor'
    'python/vcruntime140.dll'                                                = 'runtime di Visual C++ del Python incorporato: le condizioni stanno in python/LICENSE.txt'
    'python/vcruntime140_1.dll'                                              = 'runtime di Visual C++ del Python incorporato: le condizioni stanno in python/LICENSE.txt'
    'nvim/bin/dbghelp.dll'                                                   = 'libreria di Windows che Neovim porta con se''; nota nella voce di Neovim in LICENZE.txt'
    "$Lettura/microsoft.powershell.psreadline.dll"                           = 'PSReadLine: BSD-2-Clause, testo in ThirdPartyNotices.txt'
    "$Lettura/net6plus/microsoft.powershell.psreadline.polyfiller.dll"       = 'PSReadLine: BSD-2-Clause, testo in ThirdPartyNotices.txt'
    "$Lettura/netstd/microsoft.powershell.psreadline.polyfiller.dll"         = 'PSReadLine: BSD-2-Clause, testo in ThirdPartyNotices.txt'
}

try {
    $Radice = [IO.Path]::GetFullPath($Unita).TrimEnd('\')
    $Editor = Join-Path $Radice 'vscodium'
    if (-not [IO.Directory]::Exists($Editor)) { Fermo "manca $Editor" }
    $Errori = New-Object Collections.Generic.List[string]

    # Alla radice di un disco $Radice e' E:, che per l'enumerazione e' la cartella corrente del disco: si rimette la barra.
    $Base = $Radice + '\'
    $n = $Base.Length
    $Totale = 0
    $Programmi = 0
    $Visti = @{}
    foreach ($f in [IO.Directory]::EnumerateFiles($Base, '*', [IO.SearchOption]::AllDirectories)) {
        $Totale++
        $rel = $f.Substring($n).Replace('\', '/').ToLowerInvariant()
        $nome = [IO.Path]::GetFileName($rel)
        if ($FileNoti -contains $nome) { $Errori.Add("FILE NOTO: $rel") }
        $s = [IO.File]::OpenRead($f)
        try { $b0 = $s.ReadByte(); $b1 = $s.ReadByte() } finally { $s.Dispose() }
        if ($b0 -ne 0x4D -or $b1 -ne 0x5A) { continue }
        $Programmi++
        $i = [Diagnostics.FileVersionInfo]::GetVersionInfo($f)
        if ("$($i.CompanyName) $($i.LegalCopyright) $($i.ProductName)" -match 'Microsoft') {
            $Visti[$rel] = 1
            Scrivi "microsoft: $rel | $($i.CompanyName) | $($i.LegalCopyright) | $($i.FileDescription)"
            if (-not $Dichiarati.ContainsKey($rel)) { $Errori.Add("SENZA VOCE: $rel") }
        }
    }
    foreach ($k in $Dichiarati.Keys) { if (-not $Visti.ContainsKey($k)) { $Errori.Add("VOCE SENZA FILE: $k") } }
    Scrivi "unita': file $Totale, programmi e librerie $Programmi, che nominano Microsoft $($Visti.Count), voci dichiarate $($Dichiarati.Count)"
    if ($Programmi -eq 0) { Fermo "nessun programma trovato sotto $Radice" }

    $NomiFirma = 0
    foreach ($f in [IO.Directory]::EnumerateFileSystemEntries($Base, '*', [IO.SearchOption]::AllDirectories)) {
        if ($f -match 'vsce-sign') { $NomiFirma++; $Errori.Add("VSCE-SIGN: $($f.Substring($n))") }
    }
    Scrivi "nomi con vsce-sign nell'unita': $NomiFirma"
    if ($Vsix) {
        if (-not [IO.File]::Exists($Vsix)) { Fermo "manca $Vsix" }
        Add-Type -AssemblyName System.IO.Compression.FileSystem
        $z = [IO.Compression.ZipFile]::OpenRead($Vsix)
        try {
            $voci = @($z.Entries | ForEach-Object { $_.FullName })
            $colpi = @($voci | Where-Object { $_ -match 'vsce-sign' })
            Scrivi ".vsix: voci $($voci.Count), con vsce-sign $($colpi.Count)"
            foreach ($c in $colpi) { $Errori.Add("VSCE-SIGN NEL VSIX: $c") }
            if ($voci.Count -eq 0) { Fermo ".vsix vuoto: $Vsix" }
        }
        finally { $z.Dispose() }
    }

    $Prodotto = Join-Path $Editor 'resources\app\product.json'
    if (-not [IO.File]::Exists($Prodotto)) { Fermo "manca $Prodotto" }
    $d = [IO.File]::ReadAllText($Prodotto, (New-Object Text.UTF8Encoding($false))) | ConvertFrom-Json
    Scrivi "product.json: chiavi $(@($d.PSObject.Properties).Count)"
    foreach ($c in $ChiaviVietate) { if ($null -ne $d.PSObject.Properties[$c]) { $Errori.Add("CHIAVE: $c") } }

    # Il verdetto sulle impostazioni, uguale per il dato vero e per la sonda.
    function BloccoRotto($impostazioni) {
        $rotte = New-Object Collections.Generic.List[string]
        foreach ($k in $Blocco.Keys) {
            $p = $impostazioni.PSObject.Properties[$k]
            if ($null -eq $p) { $rotte.Add("IMPOSTAZIONE ASSENTE: $k") }
            elseif ($p.Value -ne $Blocco[$k] -or $p.Value.GetType() -ne $Blocco[$k].GetType()) { $rotte.Add("IMPOSTAZIONE: $k = $($p.Value), attesa $($Blocco[$k])") }
        }
        return , $rotte
    }
    $FileImp = Join-Path $Editor 'data\user-data\User\settings.json'
    if (-not [IO.File]::Exists($FileImp)) { Fermo "manca $FileImp" }
    $TestoImp = [IO.File]::ReadAllText($FileImp, (New-Object Text.UTF8Encoding($false)))
    $Imp = $TestoImp | ConvertFrom-Json
    foreach ($x in (BloccoRotto $Imp)) { $Errori.Add($x) }
    Scrivi "impostazioni del blocco: $($Blocco.Count) chiavi controllate"
    # Tre sonde, una per modo (valore, tipo, chiave assente): ciascuna si controlla col nome che ha alterato, non col
    # numero degli errori, che su un dato guasto sarebbe un altro e farebbe sparire la chiave vera dietro un fermo.
    $Accese = 0
    foreach ($modo in 'valore', 'tipo', 'assente') {
        $Sonda = '{"update.mode": "none", "extensions.autoCheckUpdates": false}' | ConvertFrom-Json
        switch ($modo) {
            'valore' { $Sonda.'update.mode' = 'start'; $Chiave = 'update.mode' }
            'tipo' { $Sonda.'extensions.autoCheckUpdates' = 'false'; $Chiave = 'extensions.autoCheckUpdates' }
            'assente' { $Sonda.PSObject.Properties.Remove('update.mode'); $Chiave = 'update.mode' }
        }
        if (@(BloccoRotto $Sonda | Where-Object { $_ -match (': ' + [regex]::Escape($Chiave) + '( |$)') }).Count -eq 1) { $Accese++ }
    }
    Scrivi "sonde delle impostazioni: $Accese accese su 3 (valore, tipo, chiave assente)"
    $SondeSpente = $Accese -ne 3

    Scrivi "errori: $($Errori.Count)"
    $Errori | Sort-Object | ForEach-Object { Scrivi "  $_" }
    # Gli errori si stampano anche quando una sonda e' spenta: il fermo non nasconde la chiave guasta.
    if ($SondeSpente) { Fermo "una sonda delle impostazioni non si e' accesa: il verdetto sulle chiavi non e' provato" }
    if ($Errori.Count -gt 0) {
        Scrivi 'ESITO: ROSSO'
        exit 1
    }
    Scrivi 'ESITO: VERDE'
    exit 0
}
catch {
    Fermo "eccezione: $($_.Exception.Message) ($($_.InvocationInfo.ScriptLineNumber))"
}

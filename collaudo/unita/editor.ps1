# Le parti proprietarie dell'unita' e il blocco degli aggiornamenti dell'editor, a file fermi: nessuna finestra.
#
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File collaudo\unita\editor.ps1 -Unita <cartella> [-Vsix <file>]
#
# Cerca, in tutta l'unita':
# - i file tolti dai pacchetti, per nome, e la cartella dell'estensione di autenticazione di Microsoft;
# - ogni programma o libreria che nelle voci di versione nomina Microsoft: quelli previsti stanno nell'elenco
#   qui sotto, uno per uno e col motivo; uno senza voce, o una voce senza file, e' un rosso;
# - vsce-sign, nei nomi di tutta l'unita' e nell'elenco del .vsix dato;
# - le due chiavi di aggiornamento in product.json;
# - vscodium/ffmpeg.dll, che deve essere quello di Electron coi soli codec liberi (impronta scritta qui);
# - le chiavi di blocco nelle impostazioni dell'editor e la scheda video spenta in argv.json (senza, H.264 e H.265 si
#   decodificano dalla scheda video), coi valori scritti qui (non letti dalla ricetta), con sonde che alterano una
#   chiave e devono dare rosso.
# Le sonde della scansione passano per le stesse funzioni del dato vero, su un albero finto in una cartella temporanea
# del sistema (mai nell'unita'), tolta alla fine: un file col nome di uno tolto, la cartella dell'autenticazione, una
# copia di un programma dell'unita' che nomina Microsoft sotto un altro percorso (senza voce), le voci dell'elenco
# senza i loro file, un nome con vsce-sign, un product.json con le due chiavi, un ffmpeg.dll diverso e uno assente.
# Ciascuna deve far comparire il suo rosso, cercato per nome; una che non si accende e' un fermo.
#
# Uscite: 0 verde, 1 rosso (nomina i file), 2 fermo (non si e' potuto misurare).
#
# Che cosa NON guarda:
# - i file senza voci di versione che non hanno un nome noto: un programma proprietario che non le ha passa;
# - la licenza dei file che non nominano Microsoft;
# - che cosa l'editor decodifica: lo dice la pagina dei codec aperta nell'editor, non un file fermo;
# - che l'editor si comporti come dicono le chiavi: si guarda che ci siano, coi valori del blocco;
# - il ramo vsce-sign del .vsix: nessuna sonda lo attraversa.

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Unita,
    [string]$Vsix = ''
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2

function Scrivi([string]$t) { [Console]::Out.WriteLine($t) }
function Fermo([string]$m) { Scrivi "FERMO: $m"; Scrivi 'ESITO: FERMO'; exit 2 }

# Nomi minuscoli: si confrontano col nome del file portato a minuscole.
$FileNoti = @('d3dcompiler_47.dll', 'dxcompiler.dll', 'dxil.dll', 'codium-tunnel.exe', 'msalruntime.dll', 'microsoft.powershell.pager.dll', 'dbghelp.dll')
$CartelleNote = @('vscodium/resources/app/extensions/microsoft-authentication/')
$FfmpegLibero = 'b4884e1c70a640890b66f2df296c934a175667f59c9ff4d28c433cbc85a05dc8'
$ChiaviVietate = @('updateUrl', 'extensionsGallery')
# Le chiavi del blocco nelle impostazioni dell'utente dell'editor, coi loro valori.
$Blocco = [ordered]@{
    'update.mode' = 'none'; 'extensions.autoCheckUpdates' = $false; 'extensions.autoUpdate' = 'off'
    'telemetry.telemetryLevel' = 'off'; 'chat.disableAIFeatures' = $true; 'workbench.welcomePage.extraAnnouncements' = $false
}
$Argv = [ordered]@{ 'disable-hardware-acceleration' = $true }
# Percorsi relativi alla radice dell'unita', a barre dritte e minuscoli.
$Conpty = 'vscodium/resources/app/node_modules.asar.unpacked/node-pty/build/release/conpty'
$Lettura = 'vscodium/resources/app/out/vs/workbench/contrib/terminal/common/scripts/psreadline'
$Dichiarati = @{
    "$Conpty/conpty.dll"                                                     = 'terminale integrato: ConPTY di Microsoft, MIT per il suo pacchetto; nota nella voce dell''editor in LICENZE.txt'
    "$Conpty/openconsole.exe"                                                = 'terminale integrato: ConPTY di Microsoft, MIT per il suo pacchetto; nota nella voce dell''editor in LICENZE.txt'
    'python/vcruntime140.dll'                                                = 'runtime di Visual C++ del Python incorporato: le condizioni stanno in python/LICENSE.txt'
    'python/vcruntime140_1.dll'                                              = 'runtime di Visual C++ del Python incorporato: le condizioni stanno in python/LICENSE.txt'
    "$Lettura/microsoft.powershell.psreadline.dll"                           = 'PSReadLine: BSD-2-Clause, testo in ThirdPartyNotices.txt'
    "$Lettura/net6plus/microsoft.powershell.psreadline.polyfiller.dll"       = 'PSReadLine: BSD-2-Clause, testo in ThirdPartyNotices.txt'
    "$Lettura/netstd/microsoft.powershell.psreadline.polyfiller.dll"         = 'PSReadLine: BSD-2-Clause, testo in ThirdPartyNotices.txt'
}

# La scansione di una base (con la barra finale), uguale per l'unita' e per le sonde: i rossi FILE NOTO, CARTELLA NOTA,
# SENZA VOCE, VOCE SENZA FILE e VSCE-SIGN, coi conteggi.
function Scansiona([string]$Base, [bool]$Stampa) {
    $n = $Base.Length
    $err = New-Object Collections.Generic.List[string]
    $totale = 0
    $programmi = 0
    $visti = @{}
    foreach ($f in [IO.Directory]::EnumerateFiles($Base, '*', [IO.SearchOption]::AllDirectories)) {
        $totale++
        $rel = $f.Substring($n).Replace('\', '/').ToLowerInvariant()
        $nome = [IO.Path]::GetFileName($rel)
        if ($FileNoti -contains $nome) { $err.Add("FILE NOTO: $rel") }
        foreach ($c in $CartelleNote) { if ($rel.StartsWith($c)) { $err.Add("CARTELLA NOTA: $rel") } }
        $s = [IO.File]::OpenRead($f)
        try { $b0 = $s.ReadByte(); $b1 = $s.ReadByte() } finally { $s.Dispose() }
        if ($b0 -ne 0x4D -or $b1 -ne 0x5A) { continue }
        $programmi++
        $i = [Diagnostics.FileVersionInfo]::GetVersionInfo($f)
        if ("$($i.CompanyName) $($i.LegalCopyright) $($i.ProductName)" -match 'Microsoft') {
            $visti[$rel] = 1
            if ($Stampa) { Scrivi "microsoft: $rel | $($i.CompanyName) | $($i.LegalCopyright) | $($i.FileDescription)" }
            if (-not $Dichiarati.ContainsKey($rel)) { $err.Add("SENZA VOCE: $rel") }
        }
    }
    foreach ($k in $Dichiarati.Keys) { if (-not $visti.ContainsKey($k)) { $err.Add("VOCE SENZA FILE: $k") } }
    $firma = 0
    foreach ($f in [IO.Directory]::EnumerateFileSystemEntries($Base, '*', [IO.SearchOption]::AllDirectories)) {
        if ($f -match 'vsce-sign') { $firma++; $err.Add("VSCE-SIGN: $($f.Substring($n))") }
    }
    return @{ Errori = $err; Totale = $totale; Programmi = $programmi; Visti = $visti; Firma = $firma }
}

function LeggiJson([string]$file) {
    return [IO.File]::ReadAllText($file, (New-Object Text.UTF8Encoding($false))) | ConvertFrom-Json
}

# Le chiavi di aggiornamento in un product.json letto: un rosso CHIAVE per ciascuna.
function ChiaviTrovate($prodotto) {
    $l = New-Object Collections.Generic.List[string]
    foreach ($c in $ChiaviVietate) { if ($null -ne $prodotto.PSObject.Properties[$c]) { $l.Add("CHIAVE: $c") } }
    return , $l
}

# ffmpeg.dll nella cartella dell'editor data: un rosso FFMPEG se manca o non e' quello libero.
function FfmpegRotto([string]$cartella, [bool]$Stampa) {
    $l = New-Object Collections.Generic.List[string]
    $ff = Join-Path $cartella 'ffmpeg.dll'
    if (-not [IO.File]::Exists($ff)) { $l.Add('FFMPEG: manca vscodium/ffmpeg.dll (senza, la finestra dell''editor non parte)') }
    else {
        $h = (Get-FileHash -LiteralPath $ff -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($Stampa) { Scrivi "ffmpeg.dll: sha256 $h, atteso quello libero $FfmpegLibero" }
        if ($h -ne $FfmpegLibero) { $l.Add("FFMPEG: vscodium/ffmpeg.dll non e' quello coi soli codec liberi ($h)") }
    }
    return , $l
}

# Il verdetto sulle chiavi, uguale per il dato vero e per le sonde.
function BloccoRotto($impostazioni, $attese) {
    $rotte = New-Object Collections.Generic.List[string]
    foreach ($k in $attese.Keys) {
        $p = $impostazioni.PSObject.Properties[$k]
        if ($null -eq $p) { $rotte.Add("IMPOSTAZIONE ASSENTE: $k") }
        elseif ($p.Value -ne $attese[$k] -or $p.Value.GetType() -ne $attese[$k].GetType()) { $rotte.Add("IMPOSTAZIONE: $k = $($p.Value), attesa $($attese[$k])") }
    }
    return , $rotte
}

# Le sonde della scansione, di product.json e di ffmpeg.dll: un albero finto in una cartella temporanea del sistema,
# tolta alla fine. Ogni sonda e' il rosso esatto che deve comparire una volta sola tra quelli dell'albero finto.
# $Microsoft e' un programma dell'unita' che nomina Microsoft (relativo, come la scansione lo vede): la sua copia sotto
# un altro percorso e' il programma senza voce. Senza, quella sonda resta spenta.
function SondeScansione([string]$Radice, $Microsoft) {
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ('mydev-editor-sonde-' + [guid]::NewGuid().ToString('N'))
    try {
        $editor = Join-Path $tmp 'vscodium'
        $app = Join-Path $editor 'resources\app'
        foreach ($d in @((Join-Path $tmp 'sonda'), (Join-Path $app 'extensions\microsoft-authentication'), (Join-Path $tmp 'senza-ffmpeg'))) {
            $null = [IO.Directory]::CreateDirectory($d)
        }
        $Utf8 = New-Object Text.UTF8Encoding($false)
        [IO.File]::WriteAllText((Join-Path $tmp 'sonda\dbghelp.dll'), 'sonda', $Utf8)
        [IO.File]::WriteAllText((Join-Path $app 'extensions\microsoft-authentication\package.json'), '{}', $Utf8)
        [IO.File]::WriteAllText((Join-Path $tmp 'sonda\vsce-sign.exe'), 'sonda', $Utf8)
        [IO.File]::WriteAllText((Join-Path $app 'product.json'), '{"nameShort": "sonda", "updateUrl": "u", "extensionsGallery": {}}', $Utf8)
        [IO.File]::WriteAllText((Join-Path $editor 'ffmpeg.dll'), 'sonda', $Utf8)
        if ($Microsoft) { Copy-Item -LiteralPath (Join-Path $Radice $Microsoft.Replace('/', '\')) -Destination (Join-Path $tmp 'sonda\senza-voce.dll') }
        $voce = @($Dichiarati.Keys | Sort-Object)[0]

        $finti = New-Object Collections.Generic.List[string]
        foreach ($x in (Scansiona ($tmp + '\') $false).Errori) { $finti.Add($x) }
        foreach ($x in (ChiaviTrovate (LeggiJson (Join-Path $app 'product.json')))) { $finti.Add($x) }
        foreach ($x in (FfmpegRotto $editor $false)) { $finti.Add($x) }
        foreach ($x in (FfmpegRotto (Join-Path $tmp 'senza-ffmpeg') $false)) { $finti.Add($x) }

        $sonde = [ordered]@{
            'FILE NOTO'          = 'FILE NOTO: sonda/dbghelp.dll'
            'CARTELLA NOTA'      = 'CARTELLA NOTA: vscodium/resources/app/extensions/microsoft-authentication/package.json'
            'SENZA VOCE'         = 'SENZA VOCE: sonda/senza-voce.dll'
            'VOCE SENZA FILE'    = "VOCE SENZA FILE: $voce"
            'VSCE-SIGN'          = 'VSCE-SIGN: sonda\vsce-sign.exe'
            'CHIAVE updateUrl'   = 'CHIAVE: updateUrl'
            'CHIAVE extensionsGallery' = 'CHIAVE: extensionsGallery'
            'FFMPEG diverso'     = 'FFMPEG: vscodium/ffmpeg.dll non e'' quello coi soli codec liberi (*)'
            'FFMPEG assente'     = 'FFMPEG: manca vscodium/ffmpeg.dll (senza, la finestra dell''editor non parte)'
        }
        $spente = New-Object Collections.Generic.List[string]
        foreach ($k in $sonde.Keys) {
            if (@($finti | Where-Object { $_ -like $sonde[$k] }).Count -ne 1) { $spente.Add($k) }
        }
        return @{ Totale = $sonde.Count; Spente = $spente; Finti = $finti.Count }
    }
    finally {
        if ([IO.Directory]::Exists($tmp)) { Remove-Item -LiteralPath $tmp -Recurse -Force }
    }
}

try {
    $Radice = [IO.Path]::GetFullPath($Unita).TrimEnd('\')
    $Editor = Join-Path $Radice 'vscodium'
    if (-not [IO.Directory]::Exists($Editor)) { Fermo "manca $Editor" }
    $Errori = New-Object Collections.Generic.List[string]

    # Alla radice di un disco $Radice e' E:, che per l'enumerazione e' la cartella corrente del disco: si rimette la barra.
    $S = Scansiona ($Radice + '\') $true
    foreach ($x in $S.Errori) { $Errori.Add($x) }
    Scrivi "unita': file $($S.Totale), programmi e librerie $($S.Programmi), che nominano Microsoft $($S.Visti.Count), voci dichiarate $($Dichiarati.Count)"
    if ($S.Programmi -eq 0) { Fermo "nessun programma trovato sotto $Radice" }
    Scrivi "nomi con vsce-sign nell'unita': $($S.Firma)"
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
    $d = LeggiJson $Prodotto
    Scrivi "product.json: chiavi $(@($d.PSObject.Properties).Count)"
    foreach ($x in (ChiaviTrovate $d)) { $Errori.Add($x) }

    foreach ($x in (FfmpegRotto $Editor $true)) { $Errori.Add($x) }

    $FileImp = Join-Path $Editor 'data\user-data\User\settings.json'
    if (-not [IO.File]::Exists($FileImp)) { Fermo "manca $FileImp" }
    $Imp = LeggiJson $FileImp
    foreach ($x in (BloccoRotto $Imp $Blocco)) { $Errori.Add($x) }
    Scrivi "impostazioni del blocco: $($Blocco.Count) chiavi controllate"
    $FileArgv = Join-Path $Editor 'data\argv.json'
    if (-not [IO.File]::Exists($FileArgv)) { Fermo "manca $FileArgv" }
    $ArgvLetto = LeggiJson $FileArgv
    foreach ($x in (BloccoRotto $ArgvLetto $Argv)) { $Errori.Add("argv.json: $x") }
    Scrivi "argv.json: $($Argv.Count) chiavi controllate"
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
        if (@(BloccoRotto $Sonda $Blocco | Where-Object { $_ -match (': ' + [regex]::Escape($Chiave) + '( |$)') }).Count -eq 1) { $Accese++ }
    }
    # La sonda di argv.json: la scheda video riaccesa.
    $Sonda = '{"locale": "it", "disable-hardware-acceleration": false}' | ConvertFrom-Json
    if (@(BloccoRotto $Sonda $Argv | Where-Object { $_ -match ': disable-hardware-acceleration( |$)' }).Count -eq 1) { $Accese++ }
    Scrivi "sonde delle impostazioni: $Accese accese su 4 (valore, tipo, chiave assente, scheda video riaccesa)"

    $Microsoft = @($S.Visti.Keys | Sort-Object | Select-Object -First 1)
    $Ss = SondeScansione $Radice $(if ($Microsoft.Count -gt 0) { $Microsoft[0] } else { $null })
    $AcceseScan = $Ss.Totale - $Ss.Spente.Count
    Scrivi "sonde della scansione: $AcceseScan accese su $($Ss.Totale) (FILE NOTO, CARTELLA NOTA, SENZA VOCE, VOCE SENZA FILE, VSCE-SIGN, CHIAVE due, FFMPEG diverso e assente), rossi dell'albero finto $($Ss.Finti)"
    foreach ($k in $Ss.Spente) { Scrivi "SONDA SPENTA: $k" }

    Scrivi "errori: $($Errori.Count)"
    $Errori | Sort-Object | ForEach-Object { Scrivi "  $_" }
    # Gli errori si stampano anche quando una sonda e' spenta: il fermo non nasconde la chiave guasta.
    if ($Accese -ne 4) { Fermo "una sonda delle impostazioni non si e' accesa: il verdetto sulle chiavi non e' provato" }
    if ($Ss.Spente.Count -gt 0) { Fermo "una sonda della scansione non si e' accesa ($($Ss.Spente -join ', ')): quel rosso non e' provato" }
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

# Costruisce l'unita' portabile dall'elenco dei componenti.
#
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File ricetta\costruisci.ps1 -Destinazione <cartella>
#   opzioni: -Deposito <cartella>  -SenzaRete  -Elenco <file>  -Commit <hash>
#            -Variante base|estesa  -Aggiunta <file>  -AlberoModificato
#
# La costruzione e' divisa in due: il motore generico (motore.ps1, accanto a questo file: elenco, albero, deposito,
# componenti, file nostri, elenco dell'unita' e unita.json, verifica), che non sa nulla di MyDev, e questo file, la ricetta
# di MyDev: i suoi dati (numero, file variabili, nati dall'uso), i suoi passi (MSYS in due tempi, le estensioni
# dell'editor, impostazioni della variante, guide, lingua, insieme delle estensioni, lanciatori) e la sequenza.
#
# L'unita' dichiara in unita.json il commit da cui viene: con un file modificato o nuovo sotto ricetta\, extensions\
# o fra LICENSE e LICENSE-DOCS, o un file ignorato sotto ricetta\unita\, la costruzione si ferma; con -AlberoModificato
# procede scrivendo "albero": "modificato".
# -Commit, -Elenco e -Aggiunta si prendono come sono dati: servono alle prove; un -Commit diverso da HEAD si scrive
# "albero": "non verificato".
#
# Con -Variante estesa, all'elenco si somma l'aggiunta, predefinita ricetta\componenti-estesa.json. Ogni
# variante vuole il proprio deposito: un file che l'elenco non nomina e' un rosso. L'estesa si costruisce
# per convenzione in C:\MyDev-estesa.
#
# unita.json dichiara anche i file tolti dai pacchetti ufficiali (le voci togli) e quelli sostituiti: una voce con
# sostituisce deve nominare un file che una voce precedente toglie, o la costruzione e' un rosso. Dichiara anche
# l'insieme delle estensioni installate e l'impronta di product.json (campo estensioni), che il lanciatore confronta.
#
# Il deposito predefinito sta accanto alla destinazione. Ogni file del deposito si confronta con byte e
# impronta dell'elenco: un'impronta sbagliata e' un rosso e non fa riscaricare nulla; un file che manca
# si scarica dalla fonte, o con -SenzaRete e' un fermo che lo nomina. Vale anche per il .vsix nostro (stato release):
# e' un file della release del repository dell'estensione, e si installa dal deposito.
#
# Uscite: 0 verde, 1 rosso, 2 fermo (non si e' potuto misurare o costruire).
#
# Che cosa NON guarda:
# - che i programmi costruiti funzionino: lo dicono le prove dell'unita';
# - i file nostri ancora da scrivere: si elencano e si saltano; quelli presenti si copiano dal repository;
# - da dove viene il .vsix della release: si confronta la sua impronta con quella dell'elenco (l'attestazione e i sorgenti
#   all'etichetta li guarda collaudo/algo/prova.ts).

[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][string]$Destinazione,
    [string]$Deposito = '',
    [switch]$SenzaRete,
    [string]$Elenco = '',
    [string]$Commit = '',
    [ValidateSet('base', 'estesa')][string]$Variante = 'base',
    [string]$Aggiunta = '',
    [switch]$AlberoModificato
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2

# ===== I dati di MyDev =====

$Numero = '0.3.1'
# File che cambiano a ogni costruzione: stanno nell'elenco dell'unita' senza impronta.
$Variabili = @(
    'msys64/var/log/pacman.log',
    'msys64/var/lib/pacman/local/*/desc',
    'msys64/etc/pki/ca-trust/extracted/java/cacerts',
    'vscodium/data/extensions/extensions.json',
    'vscodium/data/user-data/languagepacks.json',
    'nginx/conf/nginx.conf'
)
# Dove nascono file con l'uso dell'unita', non con la costruzione: per la verifica non sono estranei. Una voce senza * e' un
# prefisso (ammette ogni file sotto di lei); una con * e' un modello, letto da verifica.ps1: * vale dentro un nome, **/ vale
# zero o piu' cartelle.
$NatiDallUso = @(
    'home/',
    'progetti/',
    'algodesign/data/',
    'vscodium/data/',
    'vscodium/resources/app/node-compile-cache/',
    'nginx/logs/',
    'nginx/ssl/',
    'python/Lib/site-packages/',
    'python/Scripts/',
    # Il Python incorporato in lldb: lldb-dap (il passo passo) all'avvio scrive i __pycache__ dei moduli che carica
    # (misurato con lo scenario dello studente nel gate: cinque .pyc di encodings/). Solo quelli: un .py, un .pth o un .pyd
    # nuovi sotto llvm/python/lib/ sono estranei. I file dell'elenco restano controllati.
    'llvm/python/lib/**/__pycache__/*.pyc',
    'msys64/etc/hosts',
    'msys64/etc/mtab',
    'msys64/etc/networks',
    'msys64/etc/protocols',
    'msys64/etc/services'
)
# I metadati dei pacchetti di MSYS, che restano fuori dall'unita'.
$Metadati = @('.BUILDINFO', '.MTREE', '.PKGINFO', '.INSTALL')
# Che cosa si controlla nell'albero di lavoro (modificato o nuovo) e dove un file ignorato ferma la costruzione.
$AlberoControllato = @('ricetta', 'extensions', 'LICENSE', 'LICENSE-DOCS')
$AlberoCopiato = @('ricetta/unita')

$Qui = Split-Path -Parent $MyInvocation.MyCommand.Definition
. (Join-Path $Qui 'motore.ps1')

# ===== I passi di MyDev =====

# Il modo dei pacchetti di MSYS: il tar di System32 sul pacchetto, senza i metadati. E' il primo dei due tempi; il secondo,
# la registrazione con pacman, e' RegistraMsys.
$ModiMyDev = @{
    'tar.zst' = {
        param($v, $a)
        $script:Msys = Unisci $Dest $v.destinazioni[0]
        CreaCartella $script:Msys
        $esclusi = ($Metadati | ForEach-Object { "--exclude=$_" }) -join ' '
        $r = Lancia $Tar ("-xf " + (Virgolette $a) + " -C " + (Virgolette $script:Msys) + " $esclusi") $null
        if ($r.Uscita -ne 0) { Fermo "$($v.nome): tar uscito con $($r.Uscita): $($r.Testo)" }
    }
    # Le estensioni dell'editor si installano dopo, con InstallaEstensioni.
    'vsix'    = { param($v, $a) }
}

function InstallaVsix([string]$vsix, [string]$nome) {
    # Direttamente l'eseguibile, come fa bin\codium.cmd: niente cmd.exe di mezzo sui percorsi con spazi.
    $a = (Virgolette (Join-Path $Editor 'resources\app\out\cli.js')) + ' --install-extension ' + (Virgolette $vsix)
    $r = Lancia (Join-Path $Editor 'VSCodium.exe') $a $AmbienteEditor
    if ($r.Uscita -ne 0 -or $r.Testo -notmatch 'successfully installed') { Rosso "$nome`: installazione non riuscita, uscita $($r.Uscita): $($r.Testo)" }
}

# MSYS, secondo tempo: pacman appena estratto registra i pacchetti nel database e fa girare gli script di installazione;
# poi le potature e le cartelle dei tre elenchi per gruppo.
function RegistraMsys() {
    if ($null -eq $script:Msys) { Fermo "nessun pacchetto di MSYS nell'elenco" }
    foreach ($c in 'tmp', 'dev', 'var\lib\pacman', 'var\log', 'var\cache\pacman\pkg') { CreaCartella (Join-Path $Msys $c) }
    $sh = Join-Path $Msys 'tmp\installa.sh'
    # -dd: con --noconfirm pacman risponde si' anche alla domanda di saltare i pacchetti con una dipendenza
    # irrisolta, ed esce 0. Nell'estesa saltava git, perl-libwww e perl-http-daemon, che vogliono
    # perl-io-socket-ip: il modulo e' gia' nel Perl dell'unita', manca solo il pacchetto. Il controllo sotto
    # vuole nel database ogni pacchetto dell'elenco.
    $corpo = "set -e`nexport PATH=/usr/bin`ncd `"`$(cygpath -u `"`$MYDEV_DEPOSITO`")/msys`"`npacman -U --noconfirm -dd --overwrite '*' *.pkg.tar.zst`n"
    [IO.File]::WriteAllBytes($sh, [Text.Encoding]::ASCII.GetBytes($corpo))
    $bash = Join-Path $Msys 'usr\bin\bash.exe'
    $amb = @{ MYDEV_DEPOSITO = $Dep; MSYSTEM = 'MSYS'; HOME = '/tmp'; PATH = (Join-Path $Msys 'usr\bin') + ';' + (Join-Path $env:SystemRoot 'System32') }
    Scrivi 'registrazione dei pacchetti con pacman...'
    $r = Lancia $bash '/tmp/installa.sh' $amb
    # Non accanto alla destinazione: in C:\ un utente normale puo' creare cartelle, non file.
    $registro = Join-Path ([IO.Path]::GetTempPath()) 'mydev-pacman.log'
    [IO.File]::WriteAllText($registro, $r.Testo, (New-Object Text.UTF8Encoding($false)))
    if ($r.Uscita -ne 0) { Fermo "pacman uscito con $($r.Uscita): vedi $registro" }
    [IO.File]::Delete($sh)
    $registrati = @{}
    foreach ($d in [IO.Directory]::GetDirectories((Join-Path $Msys 'var\lib\pacman\local'))) { $registrati[[IO.Path]::GetFileName($d)] = 1 }
    $nonRegistrati = @($Dati.scaricati | Where-Object { $_.modo -eq 'tar.zst' } | Where-Object { -not $registrati.ContainsKey("$($_.nome.Substring(5))-$($_.versione)") } | ForEach-Object { $_.nome })
    if ($nonRegistrati.Count -gt 0) { Rosso "pacman non ha registrato: $($nonRegistrati -join ', '); vedi $registro" }
    Scrivi "pacchetti registrati da pacman: $($registrati.Count)"

    foreach ($g in $Dati.togli_da_gruppo.PSObject.Properties) {
        foreach ($t in $g.Value) {
            $p = Unisci $Msys $t.TrimEnd('/')
            if (-not (Test-Path -LiteralPath $p)) { Rosso "togli_da_gruppo: $t non esiste" }
            Remove-Item -LiteralPath $p -Recurse -Force
        }
    }
    foreach ($g in $Dati.svuota_da_gruppo.PSObject.Properties) {
        foreach ($t in $g.Value) {
            $p = Unisci $Msys $t
            if (-not (Test-Path -LiteralPath $p)) { Rosso "svuota_da_gruppo: $t non esiste" }
            [IO.File]::WriteAllBytes($p, [byte[]]@())
        }
    }
    foreach ($g in $Dati.crea_da_gruppo.PSObject.Properties) {
        foreach ($t in $g.Value) { CreaCartella (Unisci $Msys $t.TrimEnd('/')) }
    }
}

# Le estensioni, da riga di comando: senza finestra e dopo che product.json ha perso la galleria.
# La cartella data\ deve esistere prima: senza, l'editor scriverebbe nel profilo dell'utente.
function InstallaEstensioni() {
    $cartella = Join-Path $Editor 'data\extensions'
    CreaCartella $cartella
    $daInstallare = @($Dati.scaricati | Where-Object { $_.modo -eq 'vsix' } | ForEach-Object { New-Object PSObject -Property @{ nome = $_.nome; vsix = (Unisci $Dep "$($_.gruppo)/$($_.file)") } })
    foreach ($v in $Release) { $daInstallare += New-Object PSObject -Property @{ nome = $v.nome; vsix = (Unisci $Dep "$($v.gruppo)/$($v.file)") } }
    foreach ($e in $daInstallare) { InstallaVsix $e.vsix $e.nome }
    $installate = @([IO.Directory]::GetDirectories($cartella))
    if ($installate.Count -ne $daInstallare.Count) { Rosso "estensioni installate: $($installate.Count) invece di $($daInstallare.Count)" }
    # L'installazione scrive l'ora nel manifesto: fissata, o il file cambierebbe a ogni costruzione.
    $codifica = New-Object Text.UTF8Encoding($false)
    foreach ($d in $installate) {
        $m = Join-Path $d 'package.json'
        $t = [IO.File]::ReadAllText($m, $codifica)
        $fissato = [regex]::Replace($t, '"installedTimestamp":\s*\d+', '"installedTimestamp": 0')
        if ($fissato -ceq $t) { Rosso "$m`: manca installedTimestamp" }
        [IO.File]::WriteAllText($m, $fissato, $codifica)
    }
    # I registri e le cache dell'installazione non fanno parte dell'unita'.
    $scarti = Join-Path $Editor 'data\user-data'
    if ([IO.Directory]::Exists($scarti)) { Remove-Item -LiteralPath $scarti -Recurse -Force }
    Scrivi "estensioni installate: $($installate.Count)"
}

# Dopo i file nostri: le impostazioni della variante, le guide in HTML, la lingua dell'editor, l'insieme delle estensioni.
# Restituisce il campo estensioni di unita.json.
function PreparaEditorEGuide() {
    # Le impostazioni dell'editor della variante: la differenza si fonde su quelle della base, gia' copiate.
    foreach ($v in @($Dati.nostri | Where-Object { $_.stato -eq 'fuso' })) {
        $r = Lancia (Unisci $Dest 'python/python.exe') ('-I -B ' + (Virgolette (Unisci $Repo 'ricetta/fondi_impostazioni.py')) + ' ' + (Virgolette (Unisci $Repo $v.percorso)) + ' ' + (Virgolette (Unisci $Dest $v.destinazioni[0]))) $null
        if ($r.Uscita -ne 0) { Rosso "$($v.nome): fusione non riuscita, uscita $($r.Uscita): $($r.Testo)" }
        Scrivi $r.Testo.Trim()
    }
    # Le guide leggibili: la copia HTML di ogni guida nostra in Markdown, nella cartella guide, scritta dal convertitore
    # col Python dell'unita' (markdown-it-py e' una voce dell'elenco). Dopo i file nostri, che portano le guide.
    $r = Lancia (Unisci $Dest 'python/python.exe') ('-I -B ' + (Virgolette (Unisci $Repo 'ricetta/guide_html.py')) + ' ' + (Virgolette $Dest)) $null
    if ($r.Uscita -ne 0) { Rosso "guide in HTML non scritte, uscita $($r.Uscita): $($r.Testo)" }
    Scrivi $r.Testo.Trim()
    $mancanti = @($Dati.nostri | Where-Object { $_.stato -eq 'da scrivere' })
    Scrivi ("file nostri ancora da scrivere: $($mancanti.Count): " + (($mancanti | ForEach-Object { $_.nome }) -join ', '))
    # La lingua dell'editor: senza languagepacks.json la prima apertura sarebbe in inglese. Lo stesso script lo
    # riscrive dal lanciatore quando l'unita' si sposta, quindi il file e' fra i variabili.
    $r = Lancia (Unisci $Dest 'python/python.exe') ('-I -B ' + (Virgolette (Unisci $Dest 'vscodium/lingua.py'))) $null
    if ($r.Uscita -ne 0) { Rosso "lingua dell'editor non preparata, uscita $($r.Uscita): $($r.Testo)" }
    Scrivi $r.Testo.Trim()
    # L'insieme garantito delle estensioni: le cartelle installate devono essere le voci dell'elenco alle loro versioni
    # (piu' il .vsix nostro, col nome della sua voce); vscodium/insieme.py scrive extensions.allowed nelle
    # impostazioni, dopo le installazioni da riga di comando che altrimenti rifiuterebbe, e da' il campo estensioni di
    # unita.json, che il lanciatore confronta a ogni avvio.
    $attese = @($Dati.scaricati | Where-Object { $_.modo -eq 'vsix' } | ForEach-Object { $_.nome.Substring($_.nome.IndexOf('/') + 1) + '=' + $_.versione })
    foreach ($v in $Release) { $attese += "$($v.estensione)=$($v.versione)" }
    $r = Lancia (Unisci $Dest 'python/python.exe') ('-I -B ' + (Virgolette (Unisci $Dest 'vscodium/insieme.py')) + ' --scrivi ' + ($attese -join ' ')) $null
    if ($r.Uscita -ne 0) { Rosso "insieme delle estensioni non scritto, uscita $($r.Uscita): $($r.Testo)" }
    $riga = @($r.Testo -split "`r?`n" | Where-Object { $_.StartsWith('ESTENSIONI: ') })
    if ($riga.Count -ne 1) { Rosso "insieme delle estensioni: la riga ESTENSIONI c'e' $($riga.Count) volte invece di una" }
    $campo = $riga[0].Substring(12) | ConvertFrom-Json
    Scrivi "insieme delle estensioni: $(@($campo.insieme.PSObject.Properties).Count) voci, product.json $($campo.prodotto)"
    return $campo
}

# Il lanciatore: un eseguibile per strumento alla radice, col clang dell'unita', e i programmi da console dei file nostri.
# Senza --no-insert-timestamp il file cambierebbe a ogni costruzione.
function CompilaLanciatori() {
    $ambClang = @{ PATH = (Unisci $Dest 'llvm/bin') + ';' + (Join-Path $env:SystemRoot 'System32') }
    # Le icone dei lanciatori: VSCodium, AlgoDesign e Chromium tengono le loro, gli altri il lampo della ricetta.
    # Si compilano in una cartella temporanea dell'unita': il .rc cita l'icona col solo nome.
    $icone = Join-Path $Dest 'icone-temporanee'
    CreaCartella $icone
    $r = Lancia (Join-Path $Dest 'python\python.exe') ('-I -B ' + (Virgolette (Unisci $Repo 'ricetta/estrai_icona.py')) + ' ' + (Virgolette (Unisci $Dest 'algodesign/AlgoDesign.exe')) + ' ' + (Virgolette (Join-Path $icone 'algodesign.ico'))) $null
    if ($r.Uscita -ne 0) { Rosso "icona di AlgoDesign non estratta, uscita $($r.Uscita): $($r.Testo)" }
    Scrivi $r.Testo.Trim()
    $r = Lancia (Join-Path $Dest 'python\python.exe') ('-I -B ' + (Virgolette (Unisci $Repo 'ricetta/estrai_icona.py')) + ' ' + (Virgolette (Unisci $Dest 'chromium/chrome.exe')) + ' ' + (Virgolette (Join-Path $icone 'chromium.ico'))) $null
    if ($r.Uscita -ne 0) { Rosso "icona di Chromium non estratta, uscita $($r.Uscita): $($r.Testo)" }
    Scrivi $r.Testo.Trim()
    [IO.File]::Copy((Unisci $Dest 'vscodium/resources/app/resources/win32/code.ico'), (Join-Path $icone 'vscodium.ico'), $true)
    foreach ($nome in @('terminale', 'neovim', 'progetti')) { [IO.File]::Copy((Unisci $Repo 'ricetta/unita/mydev.ico'), (Join-Path $icone "$nome.ico"), $true) }
    $rc = Unisci $Dest 'llvm/bin/llvm-rc.exe'
    $res = @{}
    foreach ($nome in @('vscodium', 'algodesign', 'terminale', 'neovim', 'progetti', 'chromium')) {
        $f = Join-Path $icone "$nome.rc"
        [IO.File]::WriteAllText($f, "1 ICON `"$nome.ico`"`n", (New-Object Text.ASCIIEncoding))
        $res[$nome] = Join-Path $icone "$nome.res"
        $r = Lancia $rc ('/no-preprocess /FO ' + (Virgolette $res[$nome]) + ' ' + (Virgolette $f)) $ambClang
        if ($r.Uscita -ne 0 -or -not (Test-Path -LiteralPath $res[$nome])) { Rosso "icona di $nome non compilata, uscita $($r.Uscita): $($r.Testo)" }
    }
    foreach ($v in @($Dati.nostri | Where-Object { $_.stato -eq 'compilato' })) {
        $s = Unisci $Repo $v.percorso
        if (-not (Test-Path -LiteralPath $s)) { Rosso "$($v.nome): manca $($v.percorso)" }
        if ($null -eq (Campo $v 'eseguibili')) {
            # Un programma da console, nella cartella che la voce dichiara.
            $o = Unisci $Dest $v.destinazioni[0]
            CreaCartella ([IO.Path]::GetDirectoryName($o))
            $def = ''
            if ($null -ne (Campo $v 'definizioni')) { foreach ($x in @($v.definizioni)) { $def += " -D$x" } }
            $a = '-O2' + $def + ' ' + (Virgolette $s) + ' -o ' + (Virgolette $o) + ' -Wl,--no-insert-timestamp'
            $r = Lancia (Unisci $Dest 'llvm/bin/clang.exe') $a $ambClang
            if ($r.Uscita -ne 0 -or -not (Test-Path -LiteralPath $o)) { Rosso "$($v.nome): non compilato, uscita $($r.Uscita): $($r.Testo)" }
            Scrivi "$($v.nome): compilato"
            continue
        }
        foreach ($e in @($v.eseguibili)) {
            $o = Join-Path $Dest "$e.exe"
            $a = '-O2 -municode -mwindows -DSTRUMENTO=' + $e.ToUpperInvariant() + ' ' + (Virgolette $s) + ' ' + (Virgolette $res[$e.ToLowerInvariant()]) + ' -o ' + (Virgolette $o) + ' -lshlwapi -Wl,--no-insert-timestamp'
            $r = Lancia (Unisci $Dest 'llvm/bin/clang.exe') $a $ambClang
            if ($r.Uscita -ne 0 -or -not (Test-Path -LiteralPath $o)) { Rosso "$($v.nome): $e non compilato, uscita $($r.Uscita): $($r.Testo)" }
        }
        Scrivi "$($v.nome): compilati $(@($v.eseguibili).Count)"
    }
    [IO.Directory]::Delete($icone, $true)
}

# ===== La sequenza =====

try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    $Repo = Split-Path -Parent $Qui
    if (-not $Elenco) { $Elenco = Join-Path $Qui 'componenti.json' }
    if ($Variante -eq 'estesa' -and -not $Aggiunta) { $Aggiunta = Join-Path $Qui 'componenti-estesa.json' }
    if ($Variante -ne 'estesa') { $Aggiunta = '' }
    $Dati = LeggiElenco $Elenco $Aggiunta $Variante

    $Dest = [IO.Path]::GetFullPath($Destinazione).TrimEnd('\')
    if ($Deposito) { $Dep = [IO.Path]::GetFullPath($Deposito).TrimEnd('\') } else { $Dep = $Dest + '-deposito' }
    if ([IO.Directory]::Exists($Dest) -and @([IO.Directory]::EnumerateFileSystemEntries($Dest)).Count -gt 0) { Fermo "la destinazione non e' vuota: $Dest" }
    $Tar = Join-Path $env:SystemRoot 'System32\tar.exe'
    if (-not (Test-Path -LiteralPath $Tar)) { Fermo "manca $Tar" }
    Scrivi "edizione di PowerShell: $($PSVersionTable.PSVersion)"
    Scrivi "destinazione: $Dest"
    Scrivi "deposito: $Dep"
    if ($Dest.Length -le 3) { Fermo "la destinazione e' la radice di un disco: si costruisce in una cartella, poi si copia: $Dest" }
    if ($Dep.Length -le 3) { Fermo "il deposito e' la radice di un disco: si indica una cartella: $Dep" }

    $Stato = ControllaAlbero $Repo $Commit $AlberoModificato.IsPresent $AlberoControllato $AlberoCopiato
    $Release = @(VerificaDeposito $Dati $Dep $SenzaRete.IsPresent 'mydev-costruttore')

    $Msys = $null
    $Componenti = ApplicaComponenti $Dati $Dest $Dep $ModiMyDev
    RegistraMsys

    $Editor = Unisci $Dest 'vscodium'
    $AmbienteEditor = @{ ELECTRON_RUN_AS_NODE = '1'; VSCODE_DEV = $null }
    foreach ($k in [Environment]::GetEnvironmentVariables().Keys) { if ($k -like 'VSCODE_*') { $AmbienteEditor[$k] = $null } }
    InstallaEstensioni

    CopiaNostri $Dati $Repo $Dest
    $CampoInsieme = PreparaEditorEGuide
    CompilaLanciatori

    ScriviUnita $Dest $Numero $Variante $Stato.Commit $Stato.Albero $Variabili $NatiDallUso $Componenti.Tolti $Componenti.Sostituiti ([ordered]@{ estensioni = $CampoInsieme })
    Scrivi 'ESITO: VERDE'
    exit 0
}
catch {
    Fermo "eccezione: $($_.Exception.Message) ($($_.InvocationInfo.ScriptLineNumber))"
}

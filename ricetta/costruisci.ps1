# Costruisce l'unita' portabile dall'elenco dei componenti.
#
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File ricetta\costruisci.ps1 -Destinazione <cartella>
#   opzioni: -Deposito <cartella>  -SenzaRete  -Elenco <file>  -Commit <hash>
#            -Variante base|estesa  -Aggiunta <file>  -AlberoModificato
#
# L'unita' dichiara in unita.json il commit da cui viene: con un file modificato o nuovo sotto ricetta\, extensions\
# o fra LICENSE e LICENSE-DOCS, o un file ignorato sotto ricetta\unita\ (il .vsix ignorato di extensions\ resta: si
# prende come lo trova), la costruzione si ferma; con -AlberoModificato procede scrivendo "albero": "modificato".
# -Commit, -Elenco e -Aggiunta si prendono come sono dati: servono alle prove; un -Commit diverso da HEAD si scrive
# "albero": "non verificato".
#
# Con -Variante estesa, all'elenco si somma l'aggiunta, predefinita ricetta\componenti-estesa.json. Ogni
# variante vuole il proprio deposito: un file che l'elenco non nomina e' un rosso. L'estesa si costruisce
# per convenzione in C:\MyDev-estesa.
#
# Il deposito predefinito sta accanto alla destinazione. Ogni file del deposito si confronta con byte e
# impronta dell'elenco: un'impronta sbagliata e' un rosso e non fa riscaricare nulla; un file che manca
# si scarica dalla fonte, o con -SenzaRete e' un fermo che lo nomina.
#
# Uscite: 0 verde, 1 rosso, 2 fermo (non si e' potuto misurare o costruire).
#
# Che cosa NON guarda:
# - che i programmi costruiti funzionino: lo dicono le prove dell'unita';
# - i file nostri ancora da scrivere: si elencano e si saltano; quelli presenti si copiano dal repository;
# - che il .vsix del prototipo corrisponda ai sorgenti: si prende come lo trova, lo prova la sua prova.

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

$Numero = '0.1.0'
# File che cambiano a ogni costruzione: stanno nell'elenco dell'unita' senza impronta.
$Variabili = @(
    'msys64/var/log/pacman.log',
    'msys64/var/lib/pacman/local/*/desc',
    'msys64/etc/pki/ca-trust/extracted/java/cacerts',
    'vscodium/data/extensions/extensions.json',
    'nginx/conf/nginx.conf'
)
# Dove nascono file con l'uso dell'unita', non con la costruzione: per la verifica non sono estranei.
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
    'msys64/etc/hosts',
    'msys64/etc/mtab',
    'msys64/etc/networks',
    'msys64/etc/protocols',
    'msys64/etc/services'
)
$Metadati = @('.BUILDINFO', '.MTREE', '.PKGINFO', '.INSTALL')

function Scrivi([string]$t) { [Console]::Out.WriteLine($t) }
function Rosso([string]$m) { Scrivi "ROSSO: $m"; Scrivi 'ESITO: ROSSO'; exit 1 }
function Fermo([string]$m) { Scrivi "FERMO: $m"; Scrivi 'ESITO: FERMO'; exit 2 }

function Campo($voce, [string]$nome) {
    $p = $voce.PSObject.Properties[$nome]
    if ($null -eq $p) { return $null }
    return $p.Value
}

function Lancia([string]$exe, [string]$argomenti, [hashtable]$ambiente) {
    # Un processo con le uscite catturate: in PowerShell 5.1 lo stderr di un programma, con
    # ErrorActionPreference a Stop, diventerebbe un'eccezione.
    $psi = New-Object Diagnostics.ProcessStartInfo
    $psi.FileName = $exe
    $psi.Arguments = $argomenti
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    if ($null -ne $ambiente) {
        foreach ($k in $ambiente.Keys) {
            if ($null -eq $ambiente[$k]) { [void]$psi.EnvironmentVariables.Remove($k) } else { $psi.EnvironmentVariables[$k] = $ambiente[$k] }
        }
    }
    $pr = [Diagnostics.Process]::Start($psi)
    $o = $pr.StandardOutput.ReadToEndAsync()
    $e = $pr.StandardError.ReadToEndAsync()
    $pr.WaitForExit()
    return New-Object PSObject -Property @{ Uscita = $pr.ExitCode; Testo = ($o.Result + $e.Result) }
}

function Impronta([string]$p) { return (Get-FileHash -LiteralPath $p -Algorithm SHA256).Hash.ToLowerInvariant() }
function Virgolette([string]$p) { return '"' + $p + '"' }
function Unisci([string]$base, [string]$rel) { return [IO.Path]::Combine($base, $rel.Replace('/', '\')) }
function CreaCartella([string]$d) { if (-not [IO.Directory]::Exists($d)) { [void][IO.Directory]::CreateDirectory($d) } }

$script:Colpi = @{}
function DaTogliere([string]$n, $togli) {
    foreach ($t in $togli) {
        $preso = if ($t.EndsWith('/')) { $n.StartsWith($t, [StringComparison]::OrdinalIgnoreCase) } else { $n -ieq $t }
        if ($preso) { $script:Colpi[$t] = 1 + [int]$script:Colpi[$t]; return $true }
    }
    return $false
}

function EstraiZip([string]$archivio, [string]$dest, [string]$radice, $togli, [string]$nome) {
    $z = [IO.Compression.ZipFile]::OpenRead($archivio)
    try {
        foreach ($e in $z.Entries) {
            $n = $e.FullName.Replace('\', '/')
            if ($radice) {
                if (-not $n.StartsWith($radice)) { continue }
                $n = $n.Substring($radice.Length)
                if ($n -eq '') { continue }
            }
            if (DaTogliere $n $togli) { continue }
            $f = Unisci $dest $n
            if ($n.EndsWith('/')) { CreaCartella $f; continue }
            CreaCartella ([IO.Path]::GetDirectoryName($f))
            [IO.Compression.ZipFileExtensions]::ExtractToFile($e, $f, $true)
        }
    }
    finally { $z.Dispose() }
    foreach ($t in $togli) { if (-not $script:Colpi.ContainsKey($t)) { Rosso "$nome`: la voce togli '$t' non ha trovato nulla" } }
}

function EstraiScelti([string]$archivio, [string]$dest, $scelti, [string]$nome) {
    $z = [IO.Compression.ZipFile]::OpenRead($archivio)
    try {
        foreach ($s in $scelti) {
            $n = 0
            foreach ($e in $z.Entries) {
                $x = $e.FullName.Replace('\', '/')
                if ($x.EndsWith('/')) { continue }
                if ($s.da.EndsWith('/')) {
                    if (-not $x.StartsWith($s.da)) { continue }
                    $rel = $s.a + $x.Substring($s.da.Length)
                }
                else {
                    if ($x -cne $s.da) { continue }
                    $rel = $s.a
                }
                $f = Unisci $dest $rel
                CreaCartella ([IO.Path]::GetDirectoryName($f))
                [IO.Compression.ZipFileExtensions]::ExtractToFile($e, $f, $true)
                $n++
            }
            if ($n -eq 0) { Rosso "$nome`: '$($s.da)' non c'e' nell'archivio" }
        }
    }
    finally { $z.Dispose() }
}

function TogliChiavi([string]$f, $chiavi, [string]$nome) {
    # PowerShell 5.1: ConvertFrom-Json lascia le date come testo; il 7 le convertirebbe.
    $cod = New-Object Text.UTF8Encoding($false)
    $d = [IO.File]::ReadAllText($f, $cod) | ConvertFrom-Json
    foreach ($c in $chiavi) {
        if ($null -eq $d.PSObject.Properties[$c]) { Rosso "$nome`: la chiave '$c' non c'e' in $f" }
        $d.PSObject.Properties.Remove($c)
    }
    [IO.File]::WriteAllText($f, ($d | ConvertTo-Json -Depth 64).Replace("`r`n", "`n") + "`n", $cod)
}

function InstallaVsix([string]$vsix, [string]$nome) {
    # Direttamente l'eseguibile, come fa bin\codium.cmd: niente cmd.exe di mezzo sui percorsi con spazi.
    $a = (Virgolette (Join-Path $Editor 'resources\app\out\cli.js')) + ' --install-extension ' + (Virgolette $vsix)
    $r = Lancia (Join-Path $Editor 'VSCodium.exe') $a $AmbienteEditor
    if ($r.Uscita -ne 0 -or $r.Testo -notmatch 'successfully installed') { Rosso "$nome`: installazione non riuscita, uscita $($r.Uscita): $($r.Testo)" }
}

try {
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

    $Qui = Split-Path -Parent $MyInvocation.MyCommand.Definition
    if (-not $Elenco) { $Elenco = Join-Path $Qui 'componenti.json' }
    if (-not (Test-Path -LiteralPath $Elenco)) { Fermo "elenco assente: $Elenco" }
    $Dati = [IO.File]::ReadAllText($Elenco, (New-Object Text.UTF8Encoding($false))) | ConvertFrom-Json
    if ($Dati.formato -ne 1) { Fermo "formato dell'elenco sconosciuto: $($Dati.formato)" }
    if ($Variante -eq 'estesa') {
        if (-not $Aggiunta) { $Aggiunta = Join-Path $Qui 'componenti-estesa.json' }
        if (-not (Test-Path -LiteralPath $Aggiunta)) { Fermo "aggiunta assente: $Aggiunta" }
        $Agg = [IO.File]::ReadAllText($Aggiunta, (New-Object Text.UTF8Encoding($false))) | ConvertFrom-Json
        if ($Agg.formato -ne 1 -or $Agg.variante -ne 'estesa') { Fermo "aggiunta non riconosciuta: formato $($Agg.formato), variante $($Agg.variante)" }
        $NomiBase = @{}
        foreach ($v in $Dati.scaricati) { $NomiBase[$v.nome] = 1 }
        foreach ($v in $Agg.scaricati) { if ($NomiBase.ContainsKey($v.nome)) { Rosso "voce ripetuta fra base e aggiunta: $($v.nome)" } }
        $Dati.scaricati = @($Dati.scaricati) + @($Agg.scaricati)
        $Dati.nostri = @($Dati.nostri) + @($Agg.nostri)
        Scrivi "aggiunta: $(@($Agg.scaricati).Count) voci da $Aggiunta"
    }

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
    $Testa = Lancia 'git' ('-C ' + (Virgolette $Qui) + ' rev-parse HEAD') $null
    $Albero = 'pulito'
    if (-not $Commit) {
        if ($Testa.Uscita -ne 0) { Fermo "commit non determinabile: passa -Commit" }
        $Commit = $Testa.Testo.Trim()
    }
    elseif ($Testa.Uscita -ne 0 -or $Commit -ne $Testa.Testo.Trim()) { $Albero = 'non verificato'; Scrivi "commit dato a mano, diverso da HEAD: $Commit" }
    # I file nostri si copiano dall'albero di lavoro: l'unita' dichiara il commit solo se l'albero e' quello del commit.
    # Un file modificato o nuovo sotto ricetta\, extensions\ o fra le due licenze della radice, o ignorato sotto
    # ricetta\unita\, ferma la costruzione; con -AlberoModificato si costruisce lo stesso, e unita.json lo dice.
    $g = Lancia 'git' ('-C ' + (Virgolette (Split-Path -Parent $Qui)) + ' status --porcelain --untracked-files=all -- ricetta extensions LICENSE LICENSE-DOCS') $null
    $i = Lancia 'git' ('-C ' + (Virgolette (Split-Path -Parent $Qui)) + ' ls-files --others --ignored --exclude-standard -- ricetta/unita') $null
    if ($g.Uscita -ne 0 -or $i.Uscita -ne 0) { Fermo "stato dell'albero non determinabile: $($g.Testo) $($i.Testo)" }
    $Sporchi = @(($g.Testo + "`n" + $i.Testo) -split "`r?`n" | Where-Object { $_.Trim() })
    if ($Sporchi.Count -gt 0) {
        foreach ($s in ($Sporchi | Select-Object -First 10)) { Scrivi "  albero: $s" }
        if (-not $AlberoModificato) { Fermo "l'albero non e' quello del commit $Commit ($($Sporchi.Count) file): si fa il commit, o si passa -AlberoModificato" }
        $Albero = 'modificato'
        Scrivi "albero modificato: $($Sporchi.Count) file, lo dice unita.json"
    }
    # Il pacchetto dell'estensione si cerca subito: dopo, la destinazione e' gia' piena e va tolta a mano.
    foreach ($v in @($Dati.nostri | Where-Object { $_.stato -eq 'prototipo' })) {
        if (-not (Test-Path -LiteralPath (Join-Path (Split-Path -Parent $Qui) $v.vsix))) { Fermo "$($v.nome): manca $($v.vsix), si costruisce con: bun run algo:costruisci" }
    }

    # --- Il deposito.
    CreaCartella $Dep
    $Attesi = @{}
    $Scaricati = 0
    foreach ($v in $Dati.scaricati) {
        $rel = "$($v.gruppo)/$($v.file)"
        $Attesi[$rel] = 1
        $p = Unisci $Dep $rel
        if (-not (Test-Path -LiteralPath $p)) {
            if ($SenzaRete) { Fermo "manca nel deposito: $($v.nome) $($v.versione), file $rel" }
            CreaCartella ([IO.Path]::GetDirectoryName($p))
            $parte = "$p.parte"
            $wc = New-Object Net.WebClient
            $wc.Headers['User-Agent'] = 'mydev-costruttore'
            # Una fonte che non risponde piu': si nomina il componente, e la strada e' una copia del deposito.
            try { $wc.DownloadFile($v.fonte, $parte) }
            catch { Fermo "scaricamento non riuscito: $($v.nome) $($v.versione), da $($v.fonte): $($_.Exception.Message) -- se la fonte non c'e' piu', il file $rel (sha256 $($v.sha256)) si copia nel deposito da una sua copia, poi si costruisce con -SenzaRete" }
            finally { $wc.Dispose() }
            Move-Item -LiteralPath $parte -Destination $p
            $Scaricati++
        }
        $n = (Get-Item -LiteralPath $p).Length
        if ($n -ne $v.byte) { Rosso "$($v.nome): $n byte invece di $($v.byte): $rel" }
        $s = Impronta $p
        if ($s -ne $v.sha256) { Rosso "$($v.nome): impronta $s invece di $($v.sha256): $rel" }
    }
    $Estranei = @([IO.Directory]::EnumerateFiles($Dep, '*', [IO.SearchOption]::AllDirectories) | ForEach-Object { $_.Substring($Dep.Length + 1).Replace('\', '/') } | Where-Object { -not $Attesi.ContainsKey($_) })
    if ($Estranei.Count -gt 0) { Rosso "file estraneo nel deposito: $($Estranei[0]) (totale $($Estranei.Count))" }
    Scrivi "deposito verificato: voci $(@($Dati.scaricati).Count), scaricate ora $Scaricati"

    # --- I componenti.
    CreaCartella $Dest
    $PerModo = @{}
    $Msys = $null
    foreach ($v in $Dati.scaricati) {
        $a = Unisci $Dep "$($v.gruppo)/$($v.file)"
        $modo = $v.modo
        $PerModo[$modo] = 1 + [int]$PerModo[$modo]
        $togli = @(); if ($null -ne (Campo $v 'togli')) { $togli = @($v.togli) }
        switch ($modo) {
            'zip' {
                $script:Colpi = @{}
                $radice = Campo $v 'radice'
                if ($null -eq $radice) { $radice = '' }
                EstraiZip $a (Unisci $Dest $v.destinazioni[0]) $radice $togli $v.nome
            }
            'wheel' {
                foreach ($d in $v.destinazioni) { $script:Colpi = @{}; EstraiZip $a (Unisci $Dest $d) '' @() $v.nome }
            }
            'estrai' {
                EstraiScelti $a $Dest $v.estrai $v.nome
            }
            'copia' {
                $f = Unisci $Dest $v.destinazioni[0]
                CreaCartella ([IO.Path]::GetDirectoryName($f))
                [IO.File]::Copy($a, $f, $true)
            }
            'tar.zst' {
                $Msys = Unisci $Dest $v.destinazioni[0]
                CreaCartella $Msys
                $esclusi = ($Metadati | ForEach-Object { "--exclude=$_" }) -join ' '
                $r = Lancia $Tar ("-xf " + (Virgolette $a) + " -C " + (Virgolette $Msys) + " $esclusi") $null
                if ($r.Uscita -ne 0) { Fermo "$($v.nome): tar uscito con $($r.Uscita): $($r.Testo)" }
            }
            'tar.xz' {
                $d = Unisci $Dest $v.destinazioni[0]
                CreaCartella $d
                $membri = (@($v.membri) | ForEach-Object { Virgolette $_ }) -join ' '
                $r = Lancia $Tar ("-xf " + (Virgolette $a) + " -C " + (Virgolette $d) + " --strip-components=$($v.togli_livelli) $membri") $null
                if ($r.Uscita -ne 0) { Fermo "$($v.nome): tar uscito con $($r.Uscita): $($r.Testo)" }
            }
            'vsix' { }
            default { Fermo "$($v.nome): modo sconosciuto $modo" }
        }
        $corr = Campo $v 'correggi'
        if ($null -ne $corr) {
            foreach ($c in @($corr)) {
                $f = Unisci (Unisci $Dest $v.destinazioni[0]) $c.file
                $cod = [Text.Encoding]::GetEncoding(28591)
                $t = $cod.GetString([IO.File]::ReadAllBytes($f))
                $parti = $t.Split(@($c.da), [StringSplitOptions]::None)
                if ($parti.Count -ne 2) { Rosso "$($v.nome): '$($c.da)' in $($c.file) compare $($parti.Count - 1) volte" }
                [IO.File]::WriteAllBytes($f, $cod.GetBytes($t.Replace($c.da, $c.a)))
            }
        }
        $tc = Campo $v 'togli_chiavi'
        if ($null -ne $tc) { TogliChiavi (Unisci (Unisci $Dest $v.destinazioni[0]) $tc.file) @($tc.chiavi) $v.nome }
    }
    Scrivi ("componenti applicati: " + (($PerModo.Keys | Sort-Object | ForEach-Object { "$_ $($PerModo[$_])" }) -join ', '))

    # --- MSYS: registrazione nel database e script di installazione.
    if ($null -eq $Msys) { Fermo "nessun pacchetto di MSYS nell'elenco" }
    foreach ($c in 'tmp', 'dev', 'var\lib\pacman', 'var\log', 'var\cache\pacman\pkg') { CreaCartella (Join-Path $Msys $c) }
    $Sh = Join-Path $Msys 'tmp\installa.sh'
    # -dd: con --noconfirm pacman risponde si' anche alla domanda di saltare i pacchetti con una dipendenza
    # irrisolta, ed esce 0. Nell'estesa saltava git, perl-libwww e perl-http-daemon, che vogliono
    # perl-io-socket-ip: il modulo e' gia' nel Perl dell'unita', manca solo il pacchetto. Il controllo sotto
    # vuole nel database ogni pacchetto dell'elenco.
    $Corpo = "set -e`nexport PATH=/usr/bin`ncd `"`$(cygpath -u `"`$MYDEV_DEPOSITO`")/msys`"`npacman -U --noconfirm -dd --overwrite '*' *.pkg.tar.zst`n"
    [IO.File]::WriteAllBytes($Sh, [Text.Encoding]::ASCII.GetBytes($Corpo))
    $Bash = Join-Path $Msys 'usr\bin\bash.exe'
    $Amb = @{ MYDEV_DEPOSITO = $Dep; MSYSTEM = 'MSYS'; HOME = '/tmp'; PATH = (Join-Path $Msys 'usr\bin') + ';' + (Join-Path $env:SystemRoot 'System32') }
    Scrivi 'registrazione dei pacchetti con pacman...'
    $r = Lancia $Bash '/tmp/installa.sh' $Amb
    # Non accanto alla destinazione: in C:\ un utente normale puo' creare cartelle, non file.
    $RegistroPacman = Join-Path ([IO.Path]::GetTempPath()) 'mydev-pacman.log'
    [IO.File]::WriteAllText($RegistroPacman, $r.Testo, (New-Object Text.UTF8Encoding($false)))
    if ($r.Uscita -ne 0) { Fermo "pacman uscito con $($r.Uscita): vedi $RegistroPacman" }
    [IO.File]::Delete($Sh)
    $Registrati = @{}
    foreach ($d in [IO.Directory]::GetDirectories((Join-Path $Msys 'var\lib\pacman\local'))) { $Registrati[[IO.Path]::GetFileName($d)] = 1 }
    $NonRegistrati = @($Dati.scaricati | Where-Object { $_.modo -eq 'tar.zst' } | Where-Object { -not $Registrati.ContainsKey("$($_.nome.Substring(5))-$($_.versione)") } | ForEach-Object { $_.nome })
    if ($NonRegistrati.Count -gt 0) { Rosso "pacman non ha registrato: $($NonRegistrati -join ', '); vedi $RegistroPacman" }
    Scrivi "pacchetti registrati da pacman: $($Registrati.Count)"

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

    $Repo = Split-Path -Parent $Qui

    # --- Le estensioni, da riga di comando: senza finestra e dopo che product.json ha perso la galleria.
    # La cartella data\ deve esistere prima: senza, l'editor scriverebbe nel profilo dell'utente.
    $Editor = Unisci $Dest 'vscodium'
    $CartellaEstensioni = Join-Path $Editor 'data\extensions'
    CreaCartella $CartellaEstensioni
    $AmbienteEditor = @{ ELECTRON_RUN_AS_NODE = '1'; VSCODE_DEV = $null }
    foreach ($k in [Environment]::GetEnvironmentVariables().Keys) { if ($k -like 'VSCODE_*') { $AmbienteEditor[$k] = $null } }
    $DaInstallare = @($Dati.scaricati | Where-Object { $_.modo -eq 'vsix' } | ForEach-Object { New-Object PSObject -Property @{ nome = $_.nome; vsix = (Unisci $Dep "$($_.gruppo)/$($_.file)") } })
    foreach ($v in @($Dati.nostri | Where-Object { $_.stato -eq 'prototipo' })) {
        $p = Unisci $Repo $v.vsix
        if (-not (Test-Path -LiteralPath $p)) { Fermo "$($v.nome): manca $($v.vsix), si costruisce con: bun run algo:costruisci" }
        $DaInstallare += New-Object PSObject -Property @{ nome = $v.nome; vsix = $p }
    }
    foreach ($e in $DaInstallare) { InstallaVsix $e.vsix $e.nome }
    $Installate = @([IO.Directory]::GetDirectories($CartellaEstensioni))
    if ($Installate.Count -ne $DaInstallare.Count) { Rosso "estensioni installate: $($Installate.Count) invece di $($DaInstallare.Count)" }
    # L'installazione scrive l'ora nel manifesto: fissata, o il file cambierebbe a ogni costruzione.
    $CodificaManifesto = New-Object Text.UTF8Encoding($false)
    foreach ($d in $Installate) {
        $m = Join-Path $d 'package.json'
        $t = [IO.File]::ReadAllText($m, $CodificaManifesto)
        $fissato = [regex]::Replace($t, '"installedTimestamp":\s*\d+', '"installedTimestamp": 0')
        if ($fissato -ceq $t) { Rosso "$m`: manca installedTimestamp" }
        [IO.File]::WriteAllText($m, $fissato, $CodificaManifesto)
    }
    # I registri e le cache dell'installazione non fanno parte dell'unita'.
    $Scarti = Join-Path $Editor 'data\user-data'
    if ([IO.Directory]::Exists($Scarti)) { Remove-Item -LiteralPath $Scarti -Recurse -Force }
    Scrivi "estensioni installate: $($Installate.Count)"

    # --- I file nostri.
    foreach ($v in @($Dati.nostri | Where-Object { $_.stato -eq 'presente' })) {
        $o = Unisci $Repo $v.percorso.TrimEnd('/')
        $d = Unisci $Dest $v.destinazioni[0]
        if ([IO.File]::Exists($o)) {
            CreaCartella ([IO.Path]::GetDirectoryName($d))
            [IO.File]::Copy($o, $d, $true)
        }
        elseif ([IO.Directory]::Exists($o)) {
            foreach ($f in [IO.Directory]::EnumerateFiles($o, '*', [IO.SearchOption]::AllDirectories)) {
                $t = Join-Path $d $f.Substring($o.Length + 1)
                CreaCartella ([IO.Path]::GetDirectoryName($t))
                [IO.File]::Copy($f, $t, $true)
            }
        }
        else { Rosso "$($v.nome): manca $($v.percorso)" }
    }
    # Le impostazioni dell'editor della variante: la differenza si fonde su quelle della base, gia' copiate.
    foreach ($v in @($Dati.nostri | Where-Object { $_.stato -eq 'fuso' })) {
        $r = Lancia (Unisci $Dest 'python/python.exe') ('-I -B ' + (Virgolette (Unisci $Repo 'ricetta/fondi_impostazioni.py')) + ' ' + (Virgolette (Unisci $Repo $v.percorso)) + ' ' + (Virgolette (Unisci $Dest $v.destinazioni[0]))) $null
        if ($r.Uscita -ne 0) { Rosso "$($v.nome): fusione non riuscita, uscita $($r.Uscita): $($r.Testo)" }
        Scrivi $r.Testo.Trim()
    }
    $Mancanti = @($Dati.nostri | Where-Object { $_.stato -eq 'da scrivere' })
    Scrivi ("file nostri ancora da scrivere: $($Mancanti.Count): " + (($Mancanti | ForEach-Object { $_.nome }) -join ', '))


    # --- Il lanciatore: un eseguibile per strumento alla radice, col clang dell'unita'.
    # Senza --no-insert-timestamp il file cambierebbe a ogni costruzione.
    $AmbClang = @{ PATH = (Unisci $Dest 'llvm/bin') + ';' + (Join-Path $env:SystemRoot 'System32') }
    # Le icone dei lanciatori: VSCodium e AlgoDesign tengono le loro, gli altri il lampo della ricetta.
    # Si compilano in una cartella temporanea dell'unita': il .rc cita l'icona col solo nome.
    $Icone = Join-Path $Dest 'icone-temporanee'
    CreaCartella $Icone
    $r = Lancia (Join-Path $Dest 'python\python.exe') ('-I -B ' + (Virgolette (Unisci $Repo 'ricetta/estrai_icona.py')) + ' ' + (Virgolette (Unisci $Dest 'algodesign/AlgoDesign.exe')) + ' ' + (Virgolette (Join-Path $Icone 'algodesign.ico'))) $null
    if ($r.Uscita -ne 0) { Rosso "icona di AlgoDesign non estratta, uscita $($r.Uscita): $($r.Testo)" }
    Scrivi $r.Testo.Trim()
    [IO.File]::Copy((Unisci $Dest 'vscodium/resources/app/resources/win32/code.ico'), (Join-Path $Icone 'vscodium.ico'), $true)
    foreach ($nome in @('terminale', 'neovim', 'progetti')) { [IO.File]::Copy((Unisci $Repo 'ricetta/unita/mydev.ico'), (Join-Path $Icone "$nome.ico"), $true) }
    $Rc = Unisci $Dest 'llvm/bin/llvm-rc.exe'
    $Res = @{}
    foreach ($nome in @('vscodium', 'algodesign', 'terminale', 'neovim', 'progetti')) {
        $f = Join-Path $Icone "$nome.rc"
        [IO.File]::WriteAllText($f, "1 ICON `"$nome.ico`"`n", (New-Object Text.ASCIIEncoding))
        $Res[$nome] = Join-Path $Icone "$nome.res"
        $r = Lancia $Rc ('/no-preprocess /FO ' + (Virgolette $Res[$nome]) + ' ' + (Virgolette $f)) $AmbClang
        if ($r.Uscita -ne 0 -or -not (Test-Path -LiteralPath $Res[$nome])) { Rosso "icona di $nome non compilata, uscita $($r.Uscita): $($r.Testo)" }
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
            $r = Lancia (Unisci $Dest 'llvm/bin/clang.exe') $a $AmbClang
            if ($r.Uscita -ne 0 -or -not (Test-Path -LiteralPath $o)) { Rosso "$($v.nome): non compilato, uscita $($r.Uscita): $($r.Testo)" }
            Scrivi "$($v.nome): compilato"
            continue
        }
        foreach ($e in @($v.eseguibili)) {
            $o = Join-Path $Dest "$e.exe"
            $a = '-O2 -municode -mwindows -DSTRUMENTO=' + $e.ToUpperInvariant() + ' ' + (Virgolette $s) + ' ' + (Virgolette $Res[$e.ToLowerInvariant()]) + ' -o ' + (Virgolette $o) + ' -lshlwapi -Wl,--no-insert-timestamp'
            $r = Lancia (Unisci $Dest 'llvm/bin/clang.exe') $a $AmbClang
            if ($r.Uscita -ne 0 -or -not (Test-Path -LiteralPath $o)) { Rosso "$($v.nome): $e non compilato, uscita $($r.Uscita): $($r.Testo)" }
        }
        Scrivi "$($v.nome): compilati $(@($v.eseguibili).Count)"
    }
    [IO.Directory]::Delete($Icone, $true)

    # --- Che cosa l'unita' dichiara.
    $Unita = New-Object Collections.Generic.List[string]
    $prefisso = $Dest.Length + 1
    $Tutti = [string[]]@([IO.Directory]::EnumerateFiles($Dest, '*', [IO.SearchOption]::AllDirectories) | ForEach-Object { $_.Substring($prefisso).Replace('\', '/') })
    [Array]::Sort($Tutti, [StringComparer]::Ordinal)
    foreach ($r in $Tutti) {
        $varia = $false
        foreach ($m in $Variabili) { if ($r -like $m) { $varia = $true; break } }
        if ($varia) { $Unita.Add("-  $r") } else { $Unita.Add((Impronta (Unisci $Dest $r)) + "  $r") }
    }
    $Utf8 = New-Object Text.UTF8Encoding($false)
    [IO.File]::WriteAllText((Join-Path $Dest 'unita-file.txt'), (($Unita -join "`n") + "`n"), $Utf8)
    $Dichiara = (New-Object PSObject -Property ([ordered]@{ numero = $Numero; variante = $Variante; commit = $Commit; albero = $Albero; variabili = $Variabili; nati_dall_uso = $NatiDallUso })) | ConvertTo-Json
    [IO.File]::WriteAllText((Join-Path $Dest 'unita.json'), $Dichiara.Replace("`r`n", "`n") + "`n", $Utf8)
    $Lungo = ($Tutti | ForEach-Object { $_.Length } | Measure-Object -Maximum).Maximum
    Scrivi "unita': numero $Numero, variante $Variante, commit $Commit, file $($Tutti.Count), percorso relativo piu' lungo $Lungo caratteri"
    Scrivi 'ESITO: VERDE'
    exit 0
}
catch {
    Fermo "eccezione: $($_.Exception.Message) ($($_.InvocationInfo.ScriptLineNumber))"
}

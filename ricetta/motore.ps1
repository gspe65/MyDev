# Il motore generico delle unita' portabili: si carica col punto (. motore.ps1) da una ricetta, che porta i propri dati e i
# propri passi. Non sa nulla del progetto che lo usa: i nomi, i percorsi da controllare nell'albero, i modi di estrazione
# propri, le cartelle chiuse della verifica gli arrivano come argomenti.
#
# Che cosa da':
# - le uscite a tre valori: Scrivi, Rosso (exit 1), Fermo (exit 2);
# - gli aiuti: Campo, Lancia (un processo con le uscite catturate), Impronta (sha256), Virgolette, Unisci, CreaCartella;
# - LeggiElenco: l'elenco dei componenti (formato 1), piu' l'aggiunta di una variante;
# - ControllaAlbero: il commit da dichiarare e lo stato dell'albero ('pulito', 'modificato', 'non verificato');
# - VerificaDeposito: ogni file del deposito per byte e impronta, lo scaricamento di chi manca, il rosso degli estranei;
# - ApplicaComponenti: i modi zip, wheel, estrai, copia, tar.xz, piu' quelli del progetto; le voci togli, sostituisce,
#   correggi, togli_chiavi;
# - CopiaNostri: i file nostri allo stato 'presente', dal repository;
# - ScriviUnita: unita-file.txt (impronta e percorso di ogni file, '-' per i variabili) e unita.json;
# - VerificaUnita e NatoDallUso: un'unita' contro il proprio elenco.
#
# Che cosa NON fa:
# - i passi propri del progetto (pacchetti da registrare, editor, lanciatori): li fa la ricetta, coi suoi passi;
# - decidere l'ordine: la ricetta chiama le funzioni nella sua sequenza.
# Il file e' solo ASCII, per PowerShell 5.1.

function Scrivi([string]$t) { [Console]::Out.WriteLine($t) }
function Rosso([string]$m) { Scrivi "ROSSO: $m"; Scrivi 'ESITO: ROSSO'; exit 1 }
function Fermo([string]$m) { Scrivi "FERMO: $m"; Scrivi 'ESITO: FERMO'; exit 2 }

# Il rosso dei file del deposito che l'elenco non nomina: il totale, i primi tre per nome e il rimedio. La regola resta: ogni
# variante il suo deposito, e un file in piu' e' un rosso anche se nessun passo della costruzione lo leggerebbe. Un .parte resta
# solo se il processo e' stato ucciso a meta' scaricamento: si dice che cosa e'.
function MessaggioEstranei([string[]]$estranei, [string]$deposito) {
    $primi = @($estranei | Select-Object -First 3 | ForEach-Object { if ($_.EndsWith('.parte')) { $_ + ' (resto di uno scaricamento interrotto)' } else { $_ } })
    $altri = if ($estranei.Count -gt 3) { ' e altri ' + ($estranei.Count - 3) } else { '' }
    return 'file estraneo nel deposito, totale ' + $estranei.Count + ': ' + ($primi -join ', ') + $altri + '. L''elenco dei componenti non lo nomina: si sposta fuori dal deposito (' + $deposito + ') o si cancella, poi si rilancia'
}

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

# L'elenco dei componenti e, se c'e', l'aggiunta della variante: le voci dell'aggiunta si sommano, e una voce con lo stesso
# nome nei due elenchi e' un rosso (la variante aggiunge, non cambia).
function LeggiElenco([string]$elenco, [string]$aggiunta, [string]$variante) {
    if (-not (Test-Path -LiteralPath $elenco)) { Fermo "elenco assente: $elenco" }
    $dati = [IO.File]::ReadAllText($elenco, (New-Object Text.UTF8Encoding($false))) | ConvertFrom-Json
    if ($dati.formato -ne 1) { Fermo "formato dell'elenco sconosciuto: $($dati.formato)" }
    if ($aggiunta) {
        if (-not (Test-Path -LiteralPath $aggiunta)) { Fermo "aggiunta assente: $aggiunta" }
        $agg = [IO.File]::ReadAllText($aggiunta, (New-Object Text.UTF8Encoding($false))) | ConvertFrom-Json
        if ($agg.formato -ne 1 -or $agg.variante -ne $variante) { Fermo "aggiunta non riconosciuta: formato $($agg.formato), variante $($agg.variante)" }
        $nomiBase = @{}
        foreach ($v in $dati.scaricati) { $nomiBase[$v.nome] = 1 }
        foreach ($v in $agg.scaricati) { if ($nomiBase.ContainsKey($v.nome)) { Rosso "voce ripetuta fra base e aggiunta: $($v.nome)" } }
        $dati.scaricati = @($dati.scaricati) + @($agg.scaricati)
        $dati.nostri = @($dati.nostri) + @($agg.nostri)
        Scrivi "aggiunta: $(@($agg.scaricati).Count) voci da $aggiunta"
    }
    return $dati
}

# Il commit che l'unita' dichiara e lo stato dell'albero. I file nostri si copiano dall'albero di lavoro: l'unita' dichiara
# il commit solo se l'albero e' quello del commit. Un file modificato o nuovo sotto i percorsi controllati, o ignorato sotto
# i percorsi copiati, ferma la costruzione; con $modificato si costruisce lo stesso, e lo stato e' 'modificato'. Un commit dato
# a mano diverso da HEAD e' 'non verificato'.
function ControllaAlbero([string]$repo, [string]$commit, [bool]$modificato, [string[]]$controllati, [string[]]$copiati) {
    $testa = Lancia 'git' ('-C ' + (Virgolette $repo) + ' rev-parse HEAD') $null
    $albero = 'pulito'
    if (-not $commit) {
        if ($testa.Uscita -ne 0) { Fermo "commit non determinabile: passa -Commit" }
        $commit = $testa.Testo.Trim()
    }
    elseif ($testa.Uscita -ne 0 -or $commit -ne $testa.Testo.Trim()) { $albero = 'non verificato'; Scrivi "commit dato a mano, diverso da HEAD: $commit" }
    $g = Lancia 'git' ('-C ' + (Virgolette $repo) + ' status --porcelain --untracked-files=all -- ' + ($controllati -join ' ')) $null
    $i = Lancia 'git' ('-C ' + (Virgolette $repo) + ' ls-files --others --ignored --exclude-standard -- ' + ($copiati -join ' ')) $null
    if ($g.Uscita -ne 0 -or $i.Uscita -ne 0) { Fermo "stato dell'albero non determinabile: $($g.Testo) $($i.Testo)" }
    $sporchi = @(($g.Testo + "`n" + $i.Testo) -split "`r?`n" | Where-Object { $_.Trim() })
    if ($sporchi.Count -gt 0) {
        foreach ($s in ($sporchi | Select-Object -First 10)) { Scrivi "  albero: $s" }
        if (-not $modificato) { Fermo "l'albero non e' quello del commit $commit ($($sporchi.Count) file): si fa il commit, o si passa -AlberoModificato" }
        $albero = 'modificato'
        Scrivi "albero modificato: $($sporchi.Count) file, lo dice unita.json"
    }
    return New-Object PSObject -Property @{ Commit = $commit; Albero = $albero }
}

# Il deposito: le voci scaricate e i file nostri della release, con byte e impronta. 'artefatto': un pacchetto costruito e
# attestato da una corsa che non ha fatto la release (la fonte e' la pagina della corsa, non un file): si legge dal deposito
# come una release, e se manca lo scaricamento fallisce col rimedio scritto. Restituisce i file nostri della release.
function VerificaDeposito($dati, [string]$dep, [bool]$senzaRete, [string]$cliente) {
    $release = @($dati.nostri | Where-Object { $_.stato -eq 'release' -or $_.stato -eq 'artefatto' })
    CreaCartella $dep
    $attesi = @{}
    $scaricati = 0
    foreach ($v in (@($dati.scaricati) + $release)) {
        $rel = "$($v.gruppo)/$($v.file)"
        $attesi[$rel] = 1
        $p = Unisci $dep $rel
        if (-not (Test-Path -LiteralPath $p)) {
            if ($senzaRete) { Fermo "manca nel deposito: $($v.nome) $($v.versione), file $rel" }
            CreaCartella ([IO.Path]::GetDirectoryName($p))
            $parte = "$p.parte"
            $wc = New-Object Net.WebClient
            $wc.Headers['User-Agent'] = $cliente
            # Una fonte che non risponde piu': si nomina il componente, e la strada e' una copia del deposito.
            $arrivato = $false
            try { $wc.DownloadFile($v.fonte, $parte); $arrivato = $true }
            catch { Fermo "scaricamento non riuscito: $($v.nome) $($v.versione), da $($v.fonte): $($_.Exception.Message) -- se la fonte non c'e' piu', il file $rel (sha256 $($v.sha256)) si copia nel deposito da una sua copia, poi si costruisce con -SenzaRete" }
            finally {
                $wc.Dispose()
                # Uno scaricamento non riuscito o interrotto (anche con Ctrl+C) non lascia il .parte, che il rilancio con
                # -SenzaRete troverebbe come file estraneo. Il finally gira anche dopo l'exit di Fermo (misurato in 5.1).
                if (-not $arrivato -and (Test-Path -LiteralPath $parte)) { Remove-Item -LiteralPath $parte -Force -ErrorAction SilentlyContinue }
            }
            # Lo spostamento ha il suo messaggio: il file e' arrivato intero, e non e' la fonte a mancare.
            try { Move-Item -LiteralPath $parte -Destination $p }
            catch { Fermo "scaricato ma non spostato: $parte in $p ($($_.Exception.Message)) -- il file arrivato resta col nome .parte: si rinomina a mano togliendo .parte, poi si rilancia" }
            $scaricati++
        }
        $n = (Get-Item -LiteralPath $p).Length
        if ($n -ne $v.byte) { Rosso "$($v.nome): $n byte invece di $($v.byte): $rel" }
        $s = Impronta $p
        if ($s -ne $v.sha256) { Rosso "$($v.nome): impronta $s invece di $($v.sha256): $rel" }
    }
    $estranei = @([IO.Directory]::EnumerateFiles($dep, '*', [IO.SearchOption]::AllDirectories) | ForEach-Object { $_.Substring($dep.Length + 1).Replace('\', '/') } | Where-Object { -not $attesi.ContainsKey($_) })
    if ($estranei.Count -gt 0) { Rosso (MessaggioEstranei $estranei $dep) }
    Scrivi "deposito verificato: voci $(@($dati.scaricati).Count) piu' $($release.Count) della release, scaricate ora $scaricati"
    return $release
}

# I componenti scaricati, nell'ordine dell'elenco. $modi porta i modi propri del progetto: nome del modo -> blocco che riceve
# la voce e il percorso dell'archivio nel deposito. Un modo che ne' il motore ne' il progetto conosce e' un fermo.
# Restituisce cio' che si e' tolto dai pacchetti ufficiali e cio' che ne ha preso il posto (Tolti, Sostituiti).
function ApplicaComponenti($dati, [string]$dest, [string]$dep, [hashtable]$modi) {
    CreaCartella $dest
    $perModo = @{}
    $tolti = New-Object Collections.Generic.List[string]
    $sostituiti = New-Object Collections.Generic.List[string]
    $tar = Join-Path $env:SystemRoot 'System32\tar.exe'
    foreach ($v in $dati.scaricati) {
        $a = Unisci $dep "$($v.gruppo)/$($v.file)"
        $modo = $v.modo
        $perModo[$modo] = 1 + [int]$perModo[$modo]
        $togli = @(); if ($null -ne (Campo $v 'togli')) { $togli = @($v.togli) }
        foreach ($t in $togli) { $tolti.Add("$($v.nome): $t") }
        if ($null -ne (Campo $v 'sostituisce')) {
            foreach ($s in @($v.sostituisce)) {
                if (-not $tolti.Contains($s)) { Rosso "$($v.nome): sostituisce '$s', che nessuna voce precedente toglie" }
                $sostituiti.Add("$s <- $($v.nome)")
            }
        }
        switch ($modo) {
            'zip' {
                $script:Colpi = @{}
                $radice = Campo $v 'radice'
                if ($null -eq $radice) { $radice = '' }
                EstraiZip $a (Unisci $dest $v.destinazioni[0]) $radice $togli $v.nome
            }
            'wheel' {
                foreach ($d in $v.destinazioni) { $script:Colpi = @{}; EstraiZip $a (Unisci $dest $d) '' @() $v.nome }
            }
            'estrai' {
                EstraiScelti $a $dest $v.estrai $v.nome
            }
            'copia' {
                $f = Unisci $dest $v.destinazioni[0]
                CreaCartella ([IO.Path]::GetDirectoryName($f))
                [IO.File]::Copy($a, $f, $true)
            }
            'tar.xz' {
                $d = Unisci $dest $v.destinazioni[0]
                CreaCartella $d
                $membri = (@($v.membri) | ForEach-Object { Virgolette $_ }) -join ' '
                $r = Lancia $tar ("-xf " + (Virgolette $a) + " -C " + (Virgolette $d) + " --strip-components=$($v.togli_livelli) $membri") $null
                if ($r.Uscita -ne 0) { Fermo "$($v.nome): tar uscito con $($r.Uscita): $($r.Testo)" }
            }
            default {
                if ($null -eq $modi -or -not $modi.ContainsKey($modo)) { Fermo "$($v.nome): modo sconosciuto $modo" }
                & $modi[$modo] $v $a
            }
        }
        $corr = Campo $v 'correggi'
        if ($null -ne $corr) {
            foreach ($c in @($corr)) {
                $f = Unisci (Unisci $dest $v.destinazioni[0]) $c.file
                $cod = [Text.Encoding]::GetEncoding(28591)
                $t = $cod.GetString([IO.File]::ReadAllBytes($f))
                $parti = $t.Split(@($c.da), [StringSplitOptions]::None)
                if ($parti.Count -ne 2) { Rosso "$($v.nome): '$($c.da)' in $($c.file) compare $($parti.Count - 1) volte" }
                [IO.File]::WriteAllBytes($f, $cod.GetBytes($t.Replace($c.da, $c.a)))
            }
        }
        $tc = Campo $v 'togli_chiavi'
        if ($null -ne $tc) { TogliChiavi (Unisci (Unisci $dest $v.destinazioni[0]) $tc.file) @($tc.chiavi) $v.nome }
    }
    Scrivi ("componenti applicati: " + (($perModo.Keys | Sort-Object | ForEach-Object { "$_ $($perModo[$_])" }) -join ', '))
    return New-Object PSObject -Property @{ Tolti = [string[]]$tolti.ToArray(); Sostituiti = [string[]]$sostituiti.ToArray() }
}

# I file nostri allo stato 'presente': un file o una cartella del repository, copiati nella destinazione della voce.
function CopiaNostri($dati, [string]$repo, [string]$dest) {
    foreach ($v in @($dati.nostri | Where-Object { $_.stato -eq 'presente' })) {
        $o = Unisci $repo $v.percorso.TrimEnd('/')
        $d = Unisci $dest $v.destinazioni[0]
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
}

# Che cosa l'unita' dichiara: unita-file.txt, con l'impronta di ogni file ('-' per quelli che cambiano a ogni costruzione),
# e unita.json coi campi del motore nell'ordine fisso, poi quelli del progetto ($altri, un dizionario ordinato).
function ScriviUnita([string]$dest, [string]$numero, [string]$variante, [string]$commit, [string]$albero, [string[]]$variabili, [string[]]$nati, [string[]]$tolti, [string[]]$sostituiti, $altri) {
    $unita = New-Object Collections.Generic.List[string]
    $prefisso = $dest.Length + 1
    $tutti = [string[]]@([IO.Directory]::EnumerateFiles($dest, '*', [IO.SearchOption]::AllDirectories) | ForEach-Object { $_.Substring($prefisso).Replace('\', '/') })
    [Array]::Sort($tutti, [StringComparer]::Ordinal)
    foreach ($r in $tutti) {
        $varia = $false
        foreach ($m in $variabili) { if ($r -like $m) { $varia = $true; break } }
        if ($varia) { $unita.Add("-  $r") } else { $unita.Add((Impronta (Unisci $dest $r)) + "  $r") }
    }
    $utf8 = New-Object Text.UTF8Encoding($false)
    [IO.File]::WriteAllText((Join-Path $dest 'unita-file.txt'), (($unita -join "`n") + "`n"), $utf8)
    $campi = [ordered]@{ numero = $numero; variante = $variante; commit = $commit; albero = $albero; variabili = $variabili; nati_dall_uso = $nati; tolti = $tolti; sostituiti = $sostituiti }
    if ($null -ne $altri) { foreach ($k in $altri.Keys) { $campi[$k] = $altri[$k] } }
    $dichiara = (New-Object PSObject -Property $campi) | ConvertTo-Json -Depth 5
    [IO.File]::WriteAllText((Join-Path $dest 'unita.json'), $dichiara.Replace("`r`n", "`n") + "`n", $utf8)
    $lungo = ($tutti | ForEach-Object { $_.Length } | Measure-Object -Maximum).Maximum
    Scrivi "unita': numero $numero, variante $variante, commit $commit, file $($tutti.Count), percorso relativo piu' lungo $lungo caratteri"
}

# Un file nato dall'uso: una voce di nati_dall_uso senza * e' un prefisso, confrontato carattere per carattere; una con * e' un
# modello di tutto il percorso, dove * vale dentro un nome (mai una barra) e **/ vale zero o piu' cartelle.
function NatoDallUso([string]$rel, $nati) {
    foreach ($q in $nati) {
        if ($q.IndexOf('*') -lt 0) {
            if ($rel.StartsWith($q, [StringComparison]::Ordinal)) { return $true }
            continue
        }
        $rx = '^' + ([regex]::Escape($q) -replace '\\\*\\\*/', '(?:[^/]+/)*' -replace '\\\*', '[^/]*') + '$'
        if ([regex]::IsMatch($rel, $rx)) { return $true }
    }
    return $false
}

# Un'unita' contro il proprio elenco: un file che manca, un'impronta diversa, un estraneo fuori dai nati dall'uso sono errori.
# $chiuse: prefisso -> descrizione; sotto un prefisso chiuso una cartella che la costruzione non ha scritto e' un ESTRANEO
# anche se il prefisso e' fra i nati dall'uso (la descrizione va nel messaggio). Esce: 0 verde, 1 rosso.
function VerificaUnita([string]$unita, $chiuse) {
    $radice = [IO.Path]::GetFullPath($unita).TrimEnd('\')
    $lista = Join-Path $radice 'unita-file.txt'
    $dich = Join-Path $radice 'unita.json'
    if (-not (Test-Path -LiteralPath $lista)) { Fermo "manca unita-file.txt in $radice" }
    if (-not (Test-Path -LiteralPath $dich)) { Fermo "manca unita.json in $radice" }
    $utf8 = New-Object Text.UTF8Encoding($false)
    $d = [IO.File]::ReadAllText($dich, $utf8) | ConvertFrom-Json
    $voceVariante = $d.PSObject.Properties['variante']
    $nomeVariante = if ($null -ne $voceVariante) { $voceVariante.Value } else { 'non dichiarata' }
    $voceAlbero = $d.PSObject.Properties['albero']
    $nomeAlbero = if ($null -ne $voceAlbero) { $voceAlbero.Value } else { 'non dichiarato' }
    Scrivi "unita': numero $($d.numero), variante $nomeVariante, commit $($d.commit), albero $nomeAlbero"

    $attesi = @{}
    foreach ($r in [IO.File]::ReadAllLines($lista, $utf8)) {
        if (-not $r) { continue }
        $i = $r.IndexOf('  ')
        $attesi[$r.Substring($i + 2)] = $r.Substring(0, $i)
    }

    $nati = @()
    $voce = $d.PSObject.Properties['nati_dall_uso']
    if ($null -ne $voce) { $nati = @($voce.Value) }

    $errori = New-Object Collections.Generic.List[string]
    $controllati = 0
    $natiVisti = 0
    $presenti = @{}
    # Alla radice di un disco GetFullPath e TrimEnd danno E:, che per l'enumerazione e' la cartella corrente del disco.
    $base = $radice + '\'
    $n = $base.Length
    # Per ogni prefisso chiuso, le cartelle di primo livello che la costruzione ha scritto.
    $scritte = @{}
    foreach ($c in @($chiuse.Keys)) {
        $scritte[$c] = @{}
        foreach ($k in $attesi.Keys) { if ($k.StartsWith($c, [StringComparison]::Ordinal) -and $k.IndexOf('/', $c.Length) -gt 0) { $scritte[$c][$k.Substring($c.Length, $k.IndexOf('/', $c.Length) - $c.Length)] = 1 } }
    }
    foreach ($f in [IO.Directory]::EnumerateFiles($base, '*', [IO.SearchOption]::AllDirectories)) {
        $rel = $f.Substring($n).Replace('\', '/')
        if ($rel -ceq 'unita-file.txt' -or $rel -ceq 'unita.json') { continue }
        $presenti[$rel] = 1
        if (-not $attesi.ContainsKey($rel)) {
            $chiusa = $null
            foreach ($c in @($chiuse.Keys)) {
                if ($rel.StartsWith($c, [StringComparison]::Ordinal) -and $rel.IndexOf('/', $c.Length) -gt 0 -and -not $scritte[$c].ContainsKey($rel.Substring($c.Length, $rel.IndexOf('/', $c.Length) - $c.Length))) { $chiusa = $c; break }
            }
            if ($null -ne $chiusa) { $errori.Add("ESTRANEO: $rel ($($chiuse[$chiusa]))"); continue }
            if (NatoDallUso $rel $nati) { $natiVisti++ } else { $errori.Add("ESTRANEO: $rel") }
            continue
        }
        $atteso = $attesi[$rel]
        if ($atteso -eq '-') { continue }
        $controllati++
        $s = (Get-FileHash -LiteralPath $f -Algorithm SHA256).Hash.ToLowerInvariant()
        if ($s -ne $atteso) { $errori.Add("IMPRONTA: $rel") }
    }
    foreach ($k in $attesi.Keys) { if (-not $presenti.ContainsKey($k)) { $errori.Add("MANCA: $k") } }

    Scrivi "file nell'elenco: $($attesi.Count), con impronta controllata: $controllati, nati dall'uso: $natiVisti (voci dichiarate, prefissi o modelli: $($nati.Count)), errori: $($errori.Count)"
    if ($errori.Count -gt 0) {
        $errori | Sort-Object | Select-Object -First 30 | ForEach-Object { Scrivi "  $_" }
        Scrivi 'ESITO: ROSSO'
        exit 1
    }
    Scrivi 'ESITO: VERDE'
    exit 0
}

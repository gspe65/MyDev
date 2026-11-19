# La sonda senza finestre del passo E1 del gate (l'editor dal lanciatore sulla cartella progetti): estrae da gate.ps1 le
# tre funzioni del passo (NominaProgetti, Stati-Di-Cartella, Esito-E1) e le fa girare su copie finte della sola cartella
# workspaceStorage dell'editor, con lo stato di cartella scritto come lo scrive l'editor (workspace.json con la cartella
# come indirizzo file:///). Nessun editor, nessun lanciatore, nessuna finestra: il gate la esegue anche senza -Finestre.
#
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File collaudo\unita\e1-sonda.ps1
#
# I quattro casi, ciascuno col suo esito atteso:
#   copia gia' aperta, un workspace.json di tre giorni fa su progetti e nessuna apertura nuova  -> 2 (fermo: premessa falsa)
#   copia pulita, il lanciatore apre progetti                                                  -> 0 (verde)
#   copia pulita, il lanciatore guasto apre un'altra cartella                                  -> 1 (rosso)
#   copia gia' aperta su un'altra cartella, il lanciatore apre progetti                        -> 2 (fermo: premessa falsa)
# Il controllo della premessa: lo stesso verdetto senza la premessa "copia mai aperta" deve cambiare esito proprio nei due
# casi della copia gia' aperta (lo stato vecchio darebbe il verde qualunque cosa faccia il lanciatore); se non li cambia, i
# casi non discriminano e la sonda e' un fermo.
# Le copie finte stanno nella cartella temporanea del PC, in una cartella con spazi doppi nel nome, e si tolgono alla fine.
#
# Uscite: 0 verde (casi tutti come attesi), 1 rosso (un caso diverso dall'atteso), 2 fermo (gate.ps1 che non si legge, una
# funzione che manca, un numero di casi diverso da quello dichiarato, la premessa che non decide i casi attesi, un'eccezione).
# Solo ASCII: PowerShell 5.1 legge un .ps1 senza BOM come ANSI.
#
# Che cosa NON guarda: che l'editor scriva davvero workspace.json in quella forma (lo misura il passo E1 con le finestre,
# sull'unita' vera); il lanciatore; la sonda della cartella vicina sul dato vero (qui solo sul testo costruito).

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2

# Quanti casi questo file dichiara, e in quanti la premessa "copia mai aperta" decide l'esito.
$CasiDichiarati = 4
$DecisiDallaPremessa = 2

$Lavoro = Join-Path $env:TEMP ("e1-sonda  " + $PID)
$uscita = 2
try {
    $Gate = Join-Path $PSScriptRoot 'gate.ps1'
    if (-not [IO.File]::Exists($Gate)) { 'FERMO: manca gate.ps1 accanto alla sonda'; 'ESITO: FERMO'; exit 2 }
    $errori = $null
    $ast = [Management.Automation.Language.Parser]::ParseFile($Gate, [ref]$null, [ref]$errori)
    if ($errori.Count -gt 0) { "FERMO: gate.ps1 non si legge: $($errori.Count) errori"; 'ESITO: FERMO'; exit 2 }
    $nomi = @('NominaProgetti', 'Stati-Di-Cartella', 'Esito-E1')
    $funzioni = @($ast.FindAll({ param($n) $n -is [Management.Automation.Language.FunctionDefinitionAst] -and $nomi -contains $n.Name }, $true))
    "funzioni estratte da gate.ps1: $($funzioni.Count) di $($nomi.Count) ($(($funzioni | ForEach-Object { $_.Name }) -join ', '))"
    if ($funzioni.Count -ne $nomi.Count) { 'FERMO: funzioni mancanti in gate.ps1'; 'ESITO: FERMO'; exit 2 }
    foreach ($f in $funzioni) { . ([ScriptBlock]::Create($f.Extent.Text)) }

    # La cartella come la scrive l'editor in workspace.json: file:///c%3A/... con gli spazi codificati.
    function Indirizzo([string]$cartella) {
        return 'file:///' + $cartella.Substring(0, 1).ToLower() + '%3A' + (($cartella.Substring(2) -replace '\\', '/') -replace ' ', '%20')
    }
    function Stato([string]$radice, [string]$id, [string]$cartella, [int]$giorni) {
        $d = Join-Path $radice ('vscodium\data\user-data\User\workspaceStorage\' + $id)
        [void][IO.Directory]::CreateDirectory($d)
        $f = Join-Path $d 'workspace.json'
        [IO.File]::WriteAllText($f, ('{"folder":"' + (Indirizzo $cartella) + '"}'), (New-Object Text.UTF8Encoding($false)))
        if ($giorni -gt 0) { (Get-Item -LiteralPath $f).LastWriteTime = (Get-Date).AddDays(-$giorni) }
    }
    # Il verdetto senza la premessa: la sola lettura dopo l'apertura (il controllo che i casi della copia gia' aperta discriminano).
    function Esito-Senza-Premessa($dopo, [bool]$vicina) { if ($vicina) { 2 } elseif ($dopo.SuiProgetti -ge 1) { 0 } else { 1 } }

    if ([IO.Directory]::Exists($Lavoro)) { Remove-Item -LiteralPath $Lavoro -Recurse -Force }
    [void][IO.Directory]::CreateDirectory($Lavoro)
    "copie finte in: $Lavoro"
    $casi = @(
        @{ Nome = 'copia gia'' aperta: workspace.json di tre giorni fa su progetti, nessuna apertura nuova'; Cartella = 'e1  vecchia'; Prima = 'progetti'; Apertura = ''; Atteso = 2 },
        @{ Nome = 'copia pulita, il lanciatore apre progetti'; Cartella = 'e1  pulita'; Prima = ''; Apertura = 'progetti'; Atteso = 0 },
        @{ Nome = 'copia pulita, il lanciatore guasto apre un''altra cartella'; Cartella = 'e1  guasta'; Prima = ''; Apertura = 'progetti\c-comuni'; Atteso = 1 },
        @{ Nome = 'copia gia'' aperta su un''altra cartella, il lanciatore apre progetti'; Cartella = 'e1  altra'; Prima = 'progetti\c-comuni'; Apertura = 'progetti'; Atteso = 2 }
    )
    $giusti = 0
    $decisi = 0
    foreach ($c in $casi) {
        $rad = Join-Path $Lavoro $c.Cartella
        [void][IO.Directory]::CreateDirectory((Join-Path $rad 'progetti'))
        if ($c.Prima) { Stato $rad 'vecchio' (Join-Path $rad $c.Prima) 3 }
        $prima = Stati-Di-Cartella $rad
        if ($c.Apertura) { Stato $rad 'nuovo' (Join-Path $rad $c.Apertura) 0 }
        $dopo = Stati-Di-Cartella $rad
        $vicina = NominaProgetti ('{"folder":"' + (Indirizzo (Join-Path $rad 'progetti\c-comuni')) + '"}') $rad
        $esito = Esito-E1 $prima $dopo $vicina
        $senza = Esito-Senza-Premessa $dopo $vicina
        $ok = $esito -eq $c.Atteso
        if ($ok) { $giusti++ }
        if ($senza -ne $esito) { $decisi++ }
        "caso: $($c.Nome)"
        "    stati prima $($prima.Totale) (su progetti $($prima.SuiProgetti)); dopo $($dopo.Totale) (su progetti $($dopo.SuiProgetti)); sonda della cartella vicina $vicina"
        "    uscita $esito, attesa $($c.Atteso): $(if ($ok) { 'come attesa' } else { 'SBAGLIATA' }); senza la premessa: $senza"
    }
    "casi: $giusti come attesi su $($casi.Count) (dichiarati $CasiDichiarati)"
    "casi decisi dalla premessa: $decisi (dichiarati $DecisiDallaPremessa)"
    if ($casi.Count -ne $CasiDichiarati) { "FERMO: casi nell'elenco $($casi.Count), dichiarati $CasiDichiarati"; $uscita = 2 }
    elseif ($giusti -ne $casi.Count) { $uscita = 1 }
    elseif ($decisi -ne $DecisiDallaPremessa) { "FERMO: la premessa decide $decisi casi, dichiarati ${DecisiDallaPremessa}, i casi non discriminano"; $uscita = 2 }
    else { $uscita = 0 }
}
catch {
    "FERMO: eccezione: $($_.Exception.Message) ($($_.InvocationInfo.ScriptLineNumber))"
    $uscita = 2
}
finally {
    if ([IO.Directory]::Exists($Lavoro)) { Remove-Item -LiteralPath $Lavoro -Recurse -Force -ErrorAction SilentlyContinue }
}
"copie finte tolte: $(-not [IO.Directory]::Exists($Lavoro))"
'ESITO: ' + @{ 0 = 'VERDE'; 1 = 'ROSSO'; 2 = 'FERMO' }[$uscita]
exit $uscita

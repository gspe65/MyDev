# S-E1, passo 11: la finestra "Salva con nome" di Windows aperta dall'editor dell'unita'. La trova fra quelle dei processi
# dell'unita', ne legge con UI Automation titolo, nome del file e cartella, la fotografa (PrintWindow: solo quella finestra,
# mai lo schermo) e preme "Salva" con Invio, come lo studente (o con le altre due vie qui sotto).
#   powershell.exe -NoProfile -ExecutionPolicy Bypass -File dialogo.ps1 -Unita <radice> -Uscita <file.json> -Foto <file.png> [-Attesa 30]
#
# Misurato (Windows 11, novembre 2026): la finestra di dialogo non e' figlia della radice di UI Automation ma della finestra
# dell'editor che la possiede; il nome del file e' un elemento di classe Edit con l'identificativo 1001 (il suo nome e' il testo),
# la cartella e' la barra "Indirizzo: <cartella>", e "Salva" e "Annulla" hanno gli identificativi 1 e 2 ma il tipo Pane, non
# Button. I tasti partono SOLO se la finestra davanti e' quella di dialogo (il messaggio al pulsante anche dietro), e "premuto"
# vuol dire che la finestra si e' chiusa (vedi sotto le tre vie); se no la finestra si chiude ("Annulla") e l'esito lo dice.
#
# Uscite: 0 premuto (finestra chiusa da "Salva"), 2 non si e' potuto (nessuna finestra, non davanti, non chiusa). Solo ASCII: PowerShell 5.1 legge un .ps1 senza BOM
# come ANSI. Che cosa NON guarda: le finestre di altri processi; il contenuto della cartella mostrata.
param(
    [Parameter(Mandatory = $true)][string]$Unita,
    [Parameter(Mandatory = $true)][string]$Uscita,
    [Parameter(Mandatory = $true)][string]$Foto,
    [int]$Attesa = 30
)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
Add-Type -AssemblyName System.Drawing
Add-Type -Namespace SE1 -Name D -MemberDefinition @'
[DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr hdc, uint f);
[DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
[DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
[DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
[DllImport("user32.dll")] public static extern void keybd_event(byte k, byte s, int f, int e);
[DllImport("user32.dll")] public static extern bool SetProcessDPIAware();
[DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h);
[DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
[DllImport("user32.dll")] public static extern bool PostMessage(IntPtr h, uint m, IntPtr w, IntPtr l);
public struct RECT { public int Left, Top, Right, Bottom; }
'@
# Senza, con lo schermo ridimensionato (125%) GetWindowRect da' la finestra ridotta e la foto e' tagliata (misurato).
[void][SE1.D]::SetProcessDPIAware()
$A = [Windows.Automation.AutomationElement]
$Utf8 = New-Object Text.UTF8Encoding($false)
$Radice = [IO.Path]::GetFullPath($Unita).TrimEnd('\') + '\'

function Pid-Unita {
    $s = @{}
    foreach ($p in @(Get-Process -ErrorAction SilentlyContinue | Where-Object { $_.Path -and $_.Path.StartsWith($Radice, [StringComparison]::OrdinalIgnoreCase) })) { $s[[int]$p.Id] = $true }
    return $s
}
function Dialogo([hashtable]$ids) {
    $c = New-Object Windows.Automation.PropertyCondition($A::ClassNameProperty, '#32770')
    foreach ($w in @($A::RootElement.FindAll([Windows.Automation.TreeScope]::Children, [Windows.Automation.Condition]::TrueCondition) | Where-Object { $ids.ContainsKey([int]$_.Current.ProcessId) })) {
        if ($w.Current.ClassName -eq '#32770') { return $w }
        $d = $w.FindFirst([Windows.Automation.TreeScope]::Children, $c)
        if ($null -ne $d) { return $d }
    }
    return $null
}
function Elemento($el, [string]$classe, [string]$id) {
    $c = New-Object Windows.Automation.AndCondition((New-Object Windows.Automation.PropertyCondition($A::ClassNameProperty, $classe)), (New-Object Windows.Automation.PropertyCondition($A::AutomationIdProperty, $id)))
    return $el.FindFirst([Windows.Automation.TreeScope]::Descendants, $c)
}

$esito = [ordered]@{ trovato = $false; premuto = $false }
$t = Get-Date
$d = $null
while (((Get-Date) - $t).TotalSeconds -lt $Attesa) {
    $d = Dialogo (Pid-Unita)
    if ($null -ne $d) { break }
    Start-Sleep -Milliseconds 300
}
if ($null -ne $d) {
    $esito.trovato = $true
    $esito.ms = [int]((Get-Date) - $t).TotalMilliseconds
    # Il campo del nome e il pulsante nascono dopo la finestra (misurato: a 1,2 s non c'erano ancora): si aspetta il pulsante.
    $t2 = Get-Date
    while (((Get-Date) - $t2).TotalSeconds -lt 10 -and $null -eq (Elemento $d 'Button' '1')) { Start-Sleep -Milliseconds 300 }
    Start-Sleep -Milliseconds 500
    $esito.titolo = $d.Current.Name
    $nome = Elemento $d 'Edit' '1001'
    $esito.nome = if ($null -ne $nome) { $nome.Current.Name } else { $null }
    $ind = @($d.FindAll([Windows.Automation.TreeScope]::Descendants, (New-Object Windows.Automation.PropertyCondition($A::ClassNameProperty, 'ToolbarWindow32'))) | Where-Object { $_.Current.Name -match '^(Indirizzo|Address): ' }) | Select-Object -First 1
    $esito.cartella = if ($null -ne $ind) { $ind.Current.Name -replace '^(Indirizzo|Address): ', '' } else { $null }
    $salva = Elemento $d 'Button' '1'
    $esito.pulsante = if ($null -ne $salva) { $salva.Current.Name } else { $null }
    # La foto della sola finestra di dialogo.
    $h = [IntPtr]$d.Current.NativeWindowHandle
    $r = New-Object SE1.D+RECT
    [void][SE1.D]::GetWindowRect($h, [ref]$r)
    $img = New-Object System.Drawing.Bitmap ($r.Right - $r.Left), ($r.Bottom - $r.Top)
    $g = [System.Drawing.Graphics]::FromImage($img)
    $dc = $g.GetHdc()
    [void][SE1.D]::PrintWindow($h, $dc, 2)
    $g.ReleaseHdc($dc)
    $img.Save($Foto, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose(); $img.Dispose()
    # "Salva", solo con la finestra di dialogo davanti, e premuto vuol dire CHIUSA: misurato, Invio mandato con la finestra
    # davanti puo' non arrivare al pulsante (la seconda finestra della sessione restava aperta, col nome nel campo, e la misura
    # contava "premuto"). Tre vie in fila, ciascuna verificata dalla chiusura: Invio, Alt+S (la lettera sottolineata di "Salva"),
    # e il messaggio BM_CLICK al pulsante. L'esito dice quale. Le due vie da tastiera solo con la finestra davanti; il messaggio
    # no: misurato di notte, senza nessuno al PC, il primo piano resta alla barra delle applicazioni e nessuna finestra nuova
    # viene davanti (gate FERMO al passo 11), mentre BM_CLICK mandato con PostMessage a una "Salva con nome" vera
    # DIETRO la chiude e salva (4 su 4). PostMessage e non SendMessage: una seconda domanda di Windows ("Sostituire?") terrebbe
    # SendMessage appeso. La pressione di UI Automation qui non c'e': il pulsante e' un Pane e risponde "Pattern non supportato".
    $chiusa = { -not [SE1.D]::IsWindow($h) -or -not [SE1.D]::IsWindowVisible($h) }
    foreach ($via in @('{ENTER}', '%s', 'messaggio')) {
        if (& $chiusa) { break }
        [SE1.D]::keybd_event(0x12, 0, 0, 0); [SE1.D]::keybd_event(0x12, 0, 2, 0)
        [void][SE1.D]::SetForegroundWindow($h)
        Start-Sleep -Milliseconds 600
        $davanti = [SE1.D]::GetForegroundWindow() -eq $h
        $esito.davanti = $davanti
        if (-not $davanti -and $via -ne 'messaggio') { continue }
        # Il nome si rilegge subito prima del tasto: misurato nel gate, un tasto battuto da chi lavora sul PC mentre la
        # finestra prendeva il primo piano e' finito nel campo ("'.c" salvato al posto di "lettura-intero.c"). Se il nome
        # e' cambiato non si preme nulla: non e' piu' il gesto dello scenario.
        $ora = Elemento $d 'Edit' '1001'
        $esito.nomePrimaDelTasto = if ($null -ne $ora) { $ora.Current.Name } else { $null }
        if ($esito.nomePrimaDelTasto -ne $esito.nome) { $esito.motivo = 'il nome nel campo e'' cambiato mentre la finestra era davanti (un tasto da fuori): nessun tasto, chiusa'; break }
        if ($via -eq 'messaggio') {
            $b = Elemento $d 'Button' '1'
            if ($null -ne $b) { $esito.messaggio = [SE1.D]::PostMessage([IntPtr]$b.Current.NativeWindowHandle, 0x00F5, [IntPtr]::Zero, [IntPtr]::Zero) }
        }
        else { (New-Object -ComObject WScript.Shell).SendKeys($via) }
        $t3 = Get-Date
        while (((Get-Date) - $t3).TotalSeconds -lt 3 -and -not (& $chiusa)) { Start-Sleep -Milliseconds 200 }
        if (& $chiusa) { $esito.premuto = $true; $esito.via = $via }
    }
    if (-not $esito.premuto) {
        if (-not $esito.Contains('motivo')) { $esito.motivo = 'la finestra di dialogo non si e'' chiusa con "Salva" (o non e'' venuta davanti): chiusa con Annulla' }
        try { $d.GetCurrentPattern([Windows.Automation.WindowPattern]::Pattern).Close() } catch { }
    }
}
else { $esito.motivo = "nessuna finestra di dialogo dell'unita' in $Attesa s" }
[IO.File]::WriteAllText($Uscita, ($esito | ConvertTo-Json -Depth 4), $Utf8)
if ($esito.premuto) { exit 0 } else { exit 2 }

// S-E1 dentro l'editor dell'unità (lo lancia se1.py): fa i passi dello scenario come lo studente e scrive che cosa ha visto, passo
// per passo, in un JSON. Non giudica: il verdetto sta in se1.py. Si ferma al primo passo che non riesce (quelli dopo partirebbero
// da uno stato che lo scenario non ha).
//
// La pagina si legge dal suo DOM coi comandi di prova dell'estensione (esistono solo con ALGO_PROVA=1, che se1.py dà all'editor);
// i clic sono clic veri sugli elementi della pagina. La finestra «Salva con nome» è quella VERA di Windows: la preme dialogo.ps1
// (Invio o Alt+S solo con la finestra davanti; il messaggio al pulsante anche dietro). «▶ Compila ed esegui» e «Passo passo» sono i comandi dei due pulsanti dell'estensione per
// il C; il numero si scrive nel terminale con sendText; il punto d'arresto si mette dove lo mette il clic sul margine.
//
// Per la regola «un solo triangolo di esecuzione visibile» legge anche, all'inizio, le impostazioni EFFETTIVE delle chiavi
// debug.* che se1.py chiede (SE1_DEBUG: valore e da dove viene, con inspect), e la barra di stato dell'estensione per il C col
// comando c-run.statoDellaBarra (dalla 0.0.5) in due momenti: col .c salvato e aperto, e col programma fermo al punto
// d'arresto. Se il comando non c'è lo scrive («disponibile» falso): il giudice ne fa un fermo.
//
// Che cosa NON guarda: i passi 1–2 (lanciatore, cartella `flowchart`): l'editor parte con la cartella `progetti` dagli
// argomenti, come dal lanciatore, e il lanciatore lo provano le aperture del gate; i pixel dello schermo (la foto della finestra di dialogo si guarda a
// occhio); il clic sul margine come gesto del puntatore; la barra di stato come la disegna l'editor (il comando dice le voci
// che l'estensione mostra, non quelle dell'editor né la barra del debug).

const { spawn } = require("node:child_process");
const { existsSync, readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");
const vscode = require("vscode");

const { SE1_ALGO, SE1_USCITA, SE1_UNITA, SE1_KIT, SE1_LAVORO } = process.env;
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));
const e = { passi: [], estensioni: {} };
const salva = () => writeFileSync(SE1_USCITA, JSON.stringify(e, null, 2));

async function foto(selettore) {
  try {
    return (await vscode.commands.executeCommand("algo.prova.fotografia", selettore)).fotografia;
  } catch (x) {
    return null;
  }
}
async function aspetta(cond, ms) {
  const t = Date.now();
  let f = null;
  while (Date.now() - t < ms) {
    f = await foto();
    if (f !== null && cond(f)) return f;
    await pausa(150);
  }
  return f;
}
async function attendi(cond, ms) {
  const t = Date.now();
  while (Date.now() - t < ms) {
    if (await cond()) return true;
    await pausa(200);
  }
  return Boolean(await cond());
}
async function testoDel(t) {
  if (t === undefined) return "";
  try {
    t.show(false);
  } catch {
    return "";
  }
  await pausa(150);
  await vscode.commands.executeCommand("workbench.action.terminal.selectAll");
  await vscode.commands.executeCommand("workbench.action.terminal.copySelection");
  await vscode.commands.executeCommand("workbench.action.terminal.clearSelection");
  return vscode.env.clipboard.readText();
}
/** Un passo: il gesto, ciò che si è visto, se è riuscito. */
function passo(n, gesto, visto, riuscito) {
  e.passi.push({ n, gesto, visto, riuscito: Boolean(riuscito) });
  salva();
  if (!riuscito) throw new Error(`passo ${n} non riuscito`);
}
const vistaAttiva = () => {
  const input = vscode.window.tabGroups.activeTabGroup.activeTab?.input;
  return input instanceof vscode.TabInputCustom ? { tipo: "pagina", viewType: input.viewType } : input instanceof vscode.TabInputText ? { tipo: "testo", file: input.uri.fsPath } : { tipo: String(input) };
};

/** Le impostazioni effettive delle chiavi chieste: il valore, quello di ogni livello e da dove viene. */
function impostazioni() {
  const chiavi = JSON.parse(process.env.SE1_DEBUG ?? "[]");
  const lette = {};
  for (const chiave of chiavi) {
    const [sezione, ...resto] = chiave.split(".");
    const c = vscode.workspace.getConfiguration(sezione);
    const k = resto.join(".");
    const i = c.inspect(k);
    if (i === undefined) {
      lette[chiave] = null;
      continue;
    }
    const origine = i.workspaceFolderValue !== undefined ? "cartella" : i.workspaceValue !== undefined ? "area di lavoro" : i.globalValue !== undefined ? "utente" : "predefinito";
    lette[chiave] = { valore: c.get(k) ?? null, origine, utente: i.globalValue ?? null, areaDiLavoro: i.workspaceValue ?? null, predefinito: i.defaultValue ?? null };
  }
  return lette;
}
/** Le voci della barra di stato dell'estensione per il C, dal suo comando di prova; «disponibile» falso se il comando non c'è. */
async function barra() {
  await vscode.extensions.getExtension("gilan65.c-run")?.activate();
  if (!(await vscode.commands.getCommands(true)).includes("c-run.statoDellaBarra")) return { disponibile: false, voci: null };
  try {
    const s = await vscode.commands.executeCommand("c-run.statoDellaBarra");
    return { disponibile: true, voci: Array.isArray(s?.voci) ? s.voci : null };
  } catch (x) {
    return { disponibile: true, voci: null, errore: String(x) };
  }
}

const eventi = [];
vscode.debug.registerDebugAdapterTrackerFactory("*", { createDebugAdapterTracker: () => ({ onDidSendMessage: (m) => m.type === "event" && eventi.push({ evento: m.event, corpo: m.body }) }) });
const aperti = [];
vscode.window.onDidOpenTerminal((t) => aperti.push(t));

exports.run = async () => {
  for (const id of ["gilan65.algodesign-code", "prototipo.algo-codice", "gilan65.c-run", "llvm-vs-code-extensions.lldb-dap"]) e.estensioni[id] = vscode.extensions.getExtension(id)?.packageJSON?.version ?? null;
  e.lingua = vscode.env.language;
  try {
    e.impostazioni = impostazioni();
  } catch (x) {
    e.impostazioni = null;
    e.erroreImpostazioni = String(x);
  }
  e.barra = {};
  e.algoPrima = readFileSync(SE1_ALGO).toString("base64");
  try {
    await scenario();
  } catch (x) {
    e.fermo = String(x);
  }
  if (vscode.debug.activeDebugSession) await vscode.debug.stopDebugging();
  e.algoDopo = readFileSync(SE1_ALGO).toString("base64");
  salva();
};

async function scenario() {
  const cartella = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? null;
  passo("1-2", "l'editor dell'unità con la cartella progetti", { cartella }, cartella !== null && cartella.toLowerCase() === join(SE1_UNITA, "progetti").toLowerCase());

  // 3. Il flowchart, come lo apre un clic in «Esplora risorse»: l'editor predefinito per quel file.
  await vscode.extensions.getExtension("gilan65.algodesign-code")?.activate();
  await vscode.commands.executeCommand("vscode.open", vscode.Uri.file(SE1_ALGO));
  const pagina = await aspetta((f) => f.versione > 0 && f.titolo !== "" && f.disegno.svg !== null, 30000);
  await pausa(500);
  const vista = vistaAttiva();
  passo(3, "lettura-intero.algo", { vista, titolo: pagina?.titolo ?? null, schede: pagina?.funzioni ?? null, disegno: pagina?.disegno.svg !== null && pagina?.disegno.svg !== undefined, codice: pagina?.codice !== null && pagina?.codice !== undefined }, vista.tipo === "pagina" && vista.viewType === "algo.pagina" && pagina !== null && pagina.disegno.svg !== null && pagina.codice !== null);

  // 4–5. «Linguaggio» → «C»: il codice C, in italiano.
  await foto('[data-scelta="c"]');
  const paginaInC = await aspetta((f) => f.linguaggi.some((x) => x.nome === "C" && x.attivo), 5000);
  passo("4-5", "«Linguaggio» → «C»", { linguaggi: paginaInC?.linguaggi, lingue: paginaInC?.lingue, inizio: (paginaInC?.codice ?? "").slice(0, 60) }, paginaInC?.linguaggi.some((x) => x.nome === "C" && x.attivo) && paginaInC.lingue.some((x) => x.nome === "italiano" && x.attivo) && (paginaInC.codice ?? "").includes("int main("));
  const codice = paginaInC.codice;

  // 6–7. «Salva il codice come…», poi «Salva» nella finestra VERA di Windows (dialogo.ps1, Invio).
  const fileC = join(SE1_ALGO, "..", "lettura-intero.c");
  const fuori = join(SE1_LAVORO, "dialogo.json");
  const ps = join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const lato = new Promise((r) => {
    const p = spawn(ps, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(SE1_KIT, "dialogo.ps1"), "-Unita", SE1_UNITA, "-Uscita", fuori, "-Foto", join(SE1_LAVORO, "dialogo.png")], { stdio: "ignore" });
    p.on("exit", (c) => r(c));
  });
  const paginaAlClic = await foto("#salva-codice");
  passo(6, "«Salva il codice come…»", { comando: paginaAlClic?.salvataggio.comando ?? null }, paginaAlClic !== null && paginaAlClic.salvataggio.comando !== null);
  const uscitaDialogo = await lato;
  // dialogo.ps1 scrive UTF-8 senza BOM.
  const dialogo = existsSync(fuori) ? JSON.parse(readFileSync(fuori, "utf8")) : null;
  const paginaSalvata = await aspetta((f) => f.salvataggio.riga !== null, 15000);
  await attendi(() => vscode.window.activeTextEditor?.document.uri.fsPath.toLowerCase() === fileC.toLowerCase(), 10000);
  const scritto = existsSync(fileC) ? readFileSync(fileC, "utf8") : null;
  const attivo = vscode.window.activeTextEditor?.document.uri.fsPath ?? null;
  passo(7, "«Salva»", { dialogo, uscitaDialogo, riga: paginaSalvata?.salvataggio.riga ?? null, attivo, uguale: scritto !== null && scritto.replace(/\r\n/g, "\n").replace(/\n$/, "") === codice }, uscitaDialogo === 0 && scritto !== null && scritto.replace(/\r\n/g, "\n").replace(/\n$/, "") === codice && attivo !== null && attivo.toLowerCase() === fileC.toLowerCase());

  // La barra di stato col .c salvato e aperto: le due voci dell'estensione per il C, un solo triangolo. Non è un passo:
  // nessun gesto. Si aspetta fino a 3 s che le voci siano due (l'estensione le aggiorna al cambio dell'editor attivo).
  let conIlFile = await barra();
  if (conIlFile.disponibile) await attendi(async () => ((conIlFile = await barra()).voci ?? []).length === 2, 3000);
  e.barra.conIlFile = conIlFile;
  salva();

  // 8–9. «▶ Compila ed esegui», poi 21 e Invio: nel terminale 42. La riga prima del programma comincia con «Eseguo
  // lettura-intero.exe» (dall'estensione per il C 0.0.2 seguita da ciò che dice di scrivere lì).
  const programmaC = () => vscode.window.terminals.filter((t) => t.creationOptions?.name === "Programma C" && t.exitStatus === undefined).at(-1);
  await vscode.commands.executeCommand("c-run.compilaEdEsegui");
  const pronto = await attendi(async () => (await testoDel(programmaC())).includes("Eseguo lettura-intero.exe"), 90000);
  await pausa(1000);
  programmaC()?.sendText("21", true);
  await attendi(async () => (await testoDel(programmaC())).includes("(finito:"), 30000);
  const testoDelProgramma = await testoDel(programmaC());
  const dopo = testoDelProgramma.split("Eseguo lettura-intero.exe").at(-1) ?? "";
  passo("8-9", "«▶ Compila ed esegui», 21 e Invio", { pronto, terminale: testoDelProgramma.slice(-600) }, pronto && /(^|\D)42(\D|$)/.test(dopo) && dopo.includes("(finito: uscita 0)"));

  // 10. Il punto d'arresto sulla riga di printf (dove lo mette il clic sul margine).
  const ed = vscode.window.visibleTextEditors.find((x) => x.document.uri.fsPath.toLowerCase() === fileC.toLowerCase()) ?? (await vscode.window.showTextDocument(vscode.Uri.file(fileC), { preview: false }));
  const righe = ed.document.getText().split("\n");
  const riga = righe.findIndex((r) => r.includes("printf(") && r.includes("n * 2"));
  vscode.debug.addBreakpoints([new vscode.SourceBreakpoint(new vscode.Location(ed.document.uri, new vscode.Position(riga, 0)))]);
  passo(10, "clic sul margine della riga di printf", { riga: riga + 1 }, riga >= 0);

  // 11–12. «Passo passo», poi 21: fermo su quella riga, n = 21.
  eventi.length = 0;
  aperti.length = 0;
  let sessione;
  const s = vscode.debug.onDidStartDebugSession((x) => (sessione = x));
  await vscode.window.showTextDocument(ed.document, { preview: false });
  const partito = await vscode.commands.executeCommand("c-run.passoPasso");
  await attendi(() => aperti.some((t) => t.creationOptions?.name !== "Programma C"), 60000);
  const t = aperti.find((x) => x.creationOptions?.name !== "Programma C");
  await pausa(2000);
  t?.sendText("21", true);
  const fermo = await attendi(() => eventi.some((x) => x.evento === "stopped"), 45000);
  const arresto = { partito, terminale: t?.name ?? null, fermo };
  if (fermo && sessione) {
    const ev = eventi.find((x) => x.evento === "stopped");
    const st = await sessione.customRequest("stackTrace", { threadId: ev.corpo.threadId, startFrame: 0, levels: 1 });
    arresto.riga = st.stackFrames[0]?.line ?? null;
    arresto.file = st.stackFrames[0]?.source?.path ?? null;
    arresto.n = (await sessione.customRequest("evaluate", { expression: "n", frameId: st.stackFrames[0].id, context: "watch" })).result;
    // La barra di stato col programma fermo al punto d'arresto: nessuna voce dell'estensione per il C (il triangolo che
    // resta è «Continua» della barra del debug).
    e.barra.alPuntoDArresto = await barra();
    salva();
    await sessione.customRequest("continue", { threadId: ev.corpo.threadId });
  }
  s.dispose();
  vscode.debug.removeBreakpoints(vscode.debug.breakpoints);
  passo("11-12", "«Passo passo», 21", arresto, fermo && arresto.riga === riga + 1 && arresto.n === "21");
}

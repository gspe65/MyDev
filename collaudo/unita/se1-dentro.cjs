// S-E1 dentro l'editor dell'unità (lo lancia se1.py): fa i passi dello scenario come lo studente e scrive che cosa ha visto, passo
// per passo, in un JSON. Non giudica: il verdetto sta in se1.py. Si ferma al primo passo che non riesce (quelli dopo partirebbero
// da uno stato che lo scenario non ha).
//
// La pagina si legge dal suo DOM coi comandi di prova dell'estensione (esistono solo con ALGO_PROVA=1, che se1.py dà all'editor);
// i clic sono clic veri sugli elementi della pagina. La finestra «Salva con nome» è quella VERA di Windows: la preme dialogo.ps1
// (Invio o Alt+S solo con la finestra davanti; il messaggio al pulsante anche dietro). «▶ Compila ed esegui» e «Passo passo» sono i comandi dei due pulsanti dell'estensione per
// il C; il numero si scrive nel terminale con sendText; il punto d'arresto si mette dove lo mette il clic sul margine.
//
// Che cosa NON guarda: i passi 1–2 (lanciatore, cartella `flowchart`): l'editor parte con la cartella `progetti` dagli
// argomenti, come dal lanciatore, e il lanciatore lo provano le aperture del gate; i pixel dello schermo (la foto della finestra di dialogo si guarda a
// occhio); il clic sul margine come gesto del puntatore.

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

const eventi = [];
vscode.debug.registerDebugAdapterTrackerFactory("*", { createDebugAdapterTracker: () => ({ onDidSendMessage: (m) => m.type === "event" && eventi.push({ evento: m.event, corpo: m.body }) }) });
const aperti = [];
vscode.window.onDidOpenTerminal((t) => aperti.push(t));

exports.run = async () => {
  for (const id of ["gilan65.algodesign-code", "prototipo.algo-codice", "gilan65.c-run", "llvm-vs-code-extensions.lldb-dap"]) e.estensioni[id] = vscode.extensions.getExtension(id)?.packageJSON?.version ?? null;
  e.lingua = vscode.env.language;
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
  const p7 = await aspetta((f) => f.versione > 0 && f.titolo !== "" && f.disegno.svg !== null, 30000);
  await pausa(500);
  const v7 = vistaAttiva();
  passo(3, "lettura-intero.algo", { vista: v7, titolo: p7?.titolo ?? null, schede: p7?.funzioni ?? null, disegno: p7?.disegno.svg !== null && p7?.disegno.svg !== undefined, codice: p7?.codice !== null && p7?.codice !== undefined }, v7.tipo === "pagina" && v7.viewType === "algo.pagina" && p7 !== null && p7.disegno.svg !== null && p7.codice !== null);

  // 4–5. «Linguaggio» → «C»: il codice C, in italiano.
  await foto('[data-scelta="c"]');
  const p9 = await aspetta((f) => f.linguaggi.some((x) => x.nome === "C" && x.attivo), 5000);
  passo("4-5", "«Linguaggio» → «C»", { linguaggi: p9?.linguaggi, lingue: p9?.lingue, inizio: (p9?.codice ?? "").slice(0, 60) }, p9?.linguaggi.some((x) => x.nome === "C" && x.attivo) && p9.lingue.some((x) => x.nome === "italiano" && x.attivo) && (p9.codice ?? "").includes("int main("));
  const codice = p9.codice;

  // 6–7. «Salva il codice come…», poi «Salva» nella finestra VERA di Windows (dialogo.ps1, Invio).
  const fileC = join(SE1_ALGO, "..", "lettura-intero.c");
  const fuori = join(SE1_LAVORO, "dialogo.json");
  const ps = join(process.env.SystemRoot, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
  const lato = new Promise((r) => {
    const p = spawn(ps, ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", join(SE1_KIT, "dialogo.ps1"), "-Unita", SE1_UNITA, "-Uscita", fuori, "-Foto", join(SE1_LAVORO, "dialogo.png")], { stdio: "ignore" });
    p.on("exit", (c) => r(c));
  });
  const p10 = await foto("#salva-codice");
  passo(6, "«Salva il codice come…»", { comando: p10?.salvataggio.comando ?? null }, p10 !== null && p10.salvataggio.comando !== null);
  const uscitaDialogo = await lato;
  // dialogo.ps1 scrive UTF-8 senza BOM.
  const dialogo = existsSync(fuori) ? JSON.parse(readFileSync(fuori, "utf8")) : null;
  const p11 = await aspetta((f) => f.salvataggio.riga !== null, 15000);
  await attendi(() => vscode.window.activeTextEditor?.document.uri.fsPath.toLowerCase() === fileC.toLowerCase(), 10000);
  const scritto = existsSync(fileC) ? readFileSync(fileC, "utf8") : null;
  const attivo = vscode.window.activeTextEditor?.document.uri.fsPath ?? null;
  passo(7, "«Salva»", { dialogo, uscitaDialogo, riga: p11?.salvataggio.riga ?? null, attivo, uguale: scritto !== null && scritto.replace(/\r\n/g, "\n").replace(/\n$/, "") === codice }, uscitaDialogo === 0 && scritto !== null && scritto.replace(/\r\n/g, "\n").replace(/\n$/, "") === codice && attivo !== null && attivo.toLowerCase() === fileC.toLowerCase());

  // 8–9. «▶ Compila ed esegui», poi 21 e Invio: nel terminale 42. La riga prima del programma comincia con «Eseguo
  // lettura-intero.exe» (dall'estensione per il C 0.0.2 seguita da ciò che dice di scrivere lì).
  const programmaC = () => vscode.window.terminals.filter((t) => t.creationOptions?.name === "Programma C" && t.exitStatus === undefined).at(-1);
  await vscode.commands.executeCommand("c-run.compilaEdEsegui");
  const pronto = await attendi(async () => (await testoDel(programmaC())).includes("Eseguo lettura-intero.exe"), 90000);
  await pausa(1000);
  programmaC()?.sendText("21", true);
  await attendi(async () => (await testoDel(programmaC())).includes("(finito:"), 30000);
  const t13 = await testoDel(programmaC());
  const dopo = t13.split("Eseguo lettura-intero.exe").at(-1) ?? "";
  passo("8-9", "«▶ Compila ed esegui», 21 e Invio", { pronto, terminale: t13.slice(-600) }, pronto && /(^|\D)42(\D|$)/.test(dopo) && dopo.includes("(finito: uscita 0)"));

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
  const v16 = { partito, terminale: t?.name ?? null, fermo };
  if (fermo && sessione) {
    const ev = eventi.find((x) => x.evento === "stopped");
    const st = await sessione.customRequest("stackTrace", { threadId: ev.corpo.threadId, startFrame: 0, levels: 1 });
    v16.riga = st.stackFrames[0]?.line ?? null;
    v16.file = st.stackFrames[0]?.source?.path ?? null;
    v16.n = (await sessione.customRequest("evaluate", { expression: "n", frameId: st.stackFrames[0].id, context: "watch" })).result;
    await sessione.customRequest("continue", { threadId: ev.corpo.threadId });
  }
  s.dispose();
  vscode.debug.removeBreakpoints(vscode.debug.breakpoints);
  passo("11-12", "«Passo passo», 21", v16, fermo && v16.riga === riga + 1 && v16.n === "21");
}

// Gira dentro l'editor: fa ciò che fa lo studente e scrive che cosa ha visto. Non giudica nulla: i confronti stanno in `prova.ts`.
//
// La sola lettura si prova digitando: una modifica passata dall'API entra anche in un documento virtuale, l'editor no.

const { readFileSync, writeFileSync } = require("node:fs");
const vscode = require("vscode");

const { ALGO_FILE, ALGO_USCITA, ALGO_CASI } = process.env;
const fonte = vscode.Uri.file(ALGO_FILE);
const impostazioni = () => vscode.workspace.getConfiguration("algo");

const mostraIlFile = async () => vscode.window.showTextDocument(await vscode.workspace.openTextDocument(fonte), { preserveFocus: false, viewColumn: vscode.ViewColumn.One });

async function imposta(linguaggio, lingua) {
  await impostazioni().update("linguaggio", linguaggio, vscode.ConfigurationTarget.Global);
  await impostazioni().update("lingua", lingua, vscode.ConfigurationTarget.Global);
}

/** Il comando sul file attivo; il documento lo si cerca fra quelli visibili, come farebbe chi guarda. */
async function comando(linguaggio, lingua) {
  await mostraIlFile();
  await vscode.commands.executeCommand("algo.mostraCodice");
  const fuocoDopoIlComando = vscode.window.activeTextEditor?.document.uri.scheme;
  const editor = vscode.window.visibleTextEditors.find((e) => e.document.uri.scheme === "algo-codice" && e.document.uri.path.endsWith(`(${linguaggio} ${lingua})`));
  if (editor === undefined) throw new Error(`nessun documento visibile per ${linguaggio} ${lingua}`);
  return { documento: editor.document, fuocoDopoIlComando };
}

/** Il documento si aggiorna dopo il comando: si attende che il testo non sia più quello di prima. */
async function testoDiverso(linguaggio, lingua, prima) {
  const { documento } = await comando(linguaggio, lingua);
  for (let i = 0; i < 100; i++) {
    if (documento.getText() !== prima) return documento.getText();
    await new Promise((r) => setTimeout(r, 50));
  }
  return documento.getText();
}

exports.run = async () => {
  const esiti = { casi: {} };
  for (const [linguaggio, lingua] of JSON.parse(ALGO_CASI)) {
    await imposta(linguaggio, lingua);
    const { documento, fuocoDopoIlComando } = await comando(linguaggio, lingua);
    const testo = documento.getText();
    await vscode.window.showTextDocument(documento, { preserveFocus: false, viewColumn: vscode.ViewColumn.Active });
    const fuocoNelDocumento = vscode.window.activeTextEditor?.document.uri.scheme;
    await vscode.commands.executeCommand("type", { text: "x" });
    esiti.casi[`${linguaggio} ${lingua}`] = { testo, fuocoDopoIlComando, fuocoNelDocumento, invariatoDopoAverDigitato: documento.getText() === testo, sporco: documento.isDirty, idLinguaggio: documento.languageId };
  }

  // Il file alterato, poi illeggibile, e il testo vero rimesso: ogni volta lo stesso documento, rilanciando il comando.
  const [linguaggio, lingua] = JSON.parse(ALGO_CASI)[0];
  await imposta(linguaggio, lingua);
  const originale = readFileSync(ALGO_FILE, "utf8");
  const primaDi = esiti.casi[`${linguaggio} ${lingua}`].testo;
  writeFileSync(ALGO_FILE, originale.replace("2.5", "3.5"));
  esiti.alterato = await testoDiverso(linguaggio, lingua, primaDi);
  writeFileSync(ALGO_FILE, "questo non è un file");
  esiti.illeggibile = await testoDiverso(linguaggio, lingua, esiti.alterato);
  const illeggibile = await comando(linguaggio, lingua);
  esiti.illeggibileIdLinguaggio = illeggibile.documento.languageId;
  writeFileSync(ALGO_FILE, originale);
  esiti.rimesso = await testoDiverso(linguaggio, lingua, esiti.illeggibile);

  // Il controllo positivo della digitazione: la stessa azione, su un documento vero, deve cambiarlo.
  const vero = await mostraIlFile();
  const prima = vero.document.getText();
  esiti.salvatoNonDetto = (await vscode.commands.executeCommand("algo.mostraCodice"))?.nonSalvato === false;
  await vscode.commands.executeCommand("type", { text: "x" });
  esiti.controlloDigitazione = vero.document.getText() !== prima;

  // Con quella modifica non salvata: il documento viene dal file salvato, e il comando lo dice.
  esiti.nonSalvatoDetto = (await vscode.commands.executeCommand("algo.mostraCodice"))?.nonSalvato === true;
  esiti.nonSalvato = vscode.window.visibleTextEditors.find((e) => e.document.uri.scheme === "algo-codice" && e.document.uri.path.endsWith(`(${linguaggio} ${lingua})`))?.document.getText();
  await vscode.commands.executeCommand("workbench.action.revertAndCloseActiveEditor");

  writeFileSync(ALGO_USCITA, JSON.stringify(esiti));
};

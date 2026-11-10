// Il collegamento con l'editor: un comando sul file attivo, e un documento virtuale, in sola lettura, per ogni file, linguaggio e
// lingua. Il documento si ricalcola rilanciando il comando, non da solo, e viene dal file salvato: le modifiche non salvate non
// contano, e il comando lo dice.

import * as vscode from "vscode";
import type { LinguaDelCodice } from "../../libreria/src/index";
import { documento, type Documento, type Libreria } from "./documento";

// La copia del pacchetto della libreria, accanto a questo file dopo la costruzione: è lo stesso file che si prova fuori dall'editor.
const libreria = require("./libreria.cjs") as Libreria;

const SCHEMA = "algo-codice";

async function calcola(fonte: vscode.Uri, linguaggio: string, lingua: LinguaDelCodice): Promise<Documento> {
  const byte = await vscode.workspace.fs.readFile(fonte);
  return documento(libreria, Buffer.from(byte).toString("utf8"), linguaggio, lingua);
}

export function activate(contesto: vscode.ExtensionContext): void {
  const cambio = new vscode.EventEmitter<vscode.Uri>();
  contesto.subscriptions.push(
    cambio,
    vscode.workspace.registerTextDocumentContentProvider(SCHEMA, {
      onDidChange: cambio.event,
      async provideTextDocumentContent(uri) {
        const q = new URLSearchParams(uri.query);
        return (await calcola(vscode.Uri.parse(q.get("fonte") ?? ""), q.get("linguaggio") ?? "", (q.get("lingua") ?? "") as LinguaDelCodice)).testo;
      },
    }),
    vscode.commands.registerCommand("algo.mostraCodice", async () => {
      const editor = vscode.window.activeTextEditor;
      if (editor === undefined) {
        void vscode.window.showWarningMessage("Apri un file .algo.");
        return undefined;
      }
      const fonte = editor.document.uri;
      const nonSalvato = editor.document.isDirty;
      if (nonSalvato) void vscode.window.showWarningMessage("Il file ha modifiche non salvate: il codice è quello dell'ultimo salvataggio.");
      const impostazioni = vscode.workspace.getConfiguration("algo");
      const linguaggio = impostazioni.get<string>("linguaggio", "python");
      const lingua = impostazioni.get<LinguaDelCodice>("lingua", "it");
      const uri = vscode.Uri.from({
        scheme: SCHEMA,
        path: `${fonte.path} (${linguaggio} ${lingua})`,
        query: new URLSearchParams({ fonte: fonte.toString(), linguaggio, lingua }).toString(),
      });
      // Un documento virtuale già aperto resta in memoria: senza questo avviso, il comando mostrerebbe il testo di prima.
      cambio.fire(uri);
      const { idLinguaggio } = await calcola(fonte, linguaggio, lingua);
      const aperto = await vscode.languages.setTextDocumentLanguage(await vscode.workspace.openTextDocument(uri), idLinguaggio);
      await vscode.window.showTextDocument(aperto, { preview: true, viewColumn: vscode.ViewColumn.Beside, preserveFocus: true });
      return { nonSalvato };
    }),
  );
}

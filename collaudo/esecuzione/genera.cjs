// Il lato del `.vsix` nella prova del corpus di esecuzione: il pacchetto installato nell'unità, caricato dal motore dell'editor
// dell'unità (l'eseguibile dell'editor con ELECTRON_RUN_AS_NODE=1, lo stesso motore in cui l'estensione gira). Enumera il corpus
// da solo e scrive in un file il codice C e Python di ogni file nelle due lingue, o il rifiuto così com'è. Non giudica nulla.
//
//   <editor dell'unità> genera.cjs <pacchetto> <cartella del corpus> <file di uscita>

const { readFileSync, readdirSync, writeFileSync } = require("node:fs");
const { join, resolve } = require("node:path");

const LINGUAGGI = ["c", "python"];
const LINGUE = ["it", "en"];

const [pacchetto, corpus, uscita] = process.argv.slice(2);
const m = require(resolve(pacchetto));

function esito(testo, linguaggio, lingua) {
  try {
    const aperto = m.apri(testo);
    if (!aperto.ok) return { apriRifiuta: aperto };
    return m.genera(aperto.progetto, linguaggio, lingua);
  } catch (e) {
    return { eccezione: e.message };
  }
}

const esiti = {};
for (const tappa of readdirSync(corpus, { withFileTypes: true }).filter((v) => v.isDirectory()).map((v) => v.name).sort())
  for (const f of readdirSync(join(corpus, tappa)).filter((f) => f.endsWith(".algo")).sort()) {
    const testo = readFileSync(join(corpus, tappa, f), "utf8");
    for (const lingua of LINGUE)
      for (const linguaggio of LINGUAGGI) esiti[`${tappa}/${f.slice(0, -".algo".length)} ${linguaggio} ${lingua}`] = esito(testo, linguaggio, lingua);
  }
writeFileSync(uscita, JSON.stringify({ motore: { node: process.versions.node, electron: process.versions.electron ?? null }, esiti }));

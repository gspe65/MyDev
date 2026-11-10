// L'ottenuto della prova di conformità: il pacchetto indicato, sotto Node, il motore dello studente. Enumera il corpus da solo e
// porta il proprio elenco dei linguaggi, perché il pacchetto non lo esporta: una combinazione che esiste solo da una parte si vede.
// Non legge gli attesi e non giudica nulla: i confronti stanno in `prova.ts`.
//
//   node collaudo/conformita/ottenuto.cjs <pacchetto> <cartella del corpus> <file di uscita>

const { readFileSync, readdirSync, writeFileSync } = require("node:fs");
const { join, resolve } = require("node:path");

const LINGUAGGI = ["pseudocodice", "python", "c", "accademico", "typescript"];
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
writeFileSync(uscita, JSON.stringify(esiti));

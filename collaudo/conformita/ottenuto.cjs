// L'ottenuto della prova di conformità: il pacchetto indicato, sotto Node, il motore dello studente. Enumera il corpus da solo e
// porta il proprio elenco dei linguaggi, perché il pacchetto non lo esporta: una combinazione che esiste solo da una parte si vede.
// Le funzioni del disegno le enumera dai progetti che il pacchetto apre. Non legge gli attesi e non giudica nulla: i confronti
// stanno in `prova.ts`.
//
//   node collaudo/conformita/ottenuto.cjs <modo> <pacchetto> <cartella del corpus> <file di uscita> [<file di uscita del disegno>]
//
// Il modo: `require`, il pacchetto caricato come lo carica un'estensione; `vm`, il pacchetto eseguito in un contesto `node:vm`
// creato con i soli `module` ed `exports` (nessun `process`, `Buffer`, `require`, `global`), come in una pagina. Senza il file del
// disegno si chiama solo `genera` (il pacchetto del contratto 1.0 non ha le funzioni del disegno).

const { readFileSync, readdirSync, writeFileSync } = require("node:fs");
const { basename, join, resolve } = require("node:path");
const vm = require("node:vm");

const LINGUAGGI = ["pseudocodice", "python", "c", "accademico", "typescript"];
const LINGUE = ["it", "en"];
/** La misura fissa del testo: la stessa degli attesi (`attesi.ts`). */
const misura = (t, stile) => t.length * 7 + (stile === "grassetto" ? t.length : stile === "corsivo" ? t.length / 2 : 0);
const CARATTERE = "system-ui, sans-serif";

const [modo, pacchetto, corpus, uscita, uscitaDelDisegno] = process.argv.slice(2);

function carica() {
  if (modo === "require") return { m: require(resolve(pacchetto)), globali: null };
  if (modo === "vm") {
    const modulo = { exports: {} };
    const contesto = vm.createContext({ module: modulo, exports: modulo.exports });
    // Che cosa vede il pacchetto nel contesto, prima di caricarlo: la prova lo confronta con l'atteso.
    const globali = vm.runInContext("[typeof process, typeof Buffer, typeof require, typeof global, typeof globalThis.module]", contesto);
    vm.runInContext(readFileSync(pacchetto, "utf8"), contesto, { filename: basename(pacchetto) });
    return { m: modulo.exports, globali: Array.from(globali) };
  }
  throw new Error(`modo sconosciuto: ${modo}`);
}
const { m, globali } = carica();

function esito(testo, linguaggio, lingua) {
  try {
    const aperto = m.apri(testo);
    if (!aperto.ok) return { apriRifiuta: aperto };
    return m.genera(aperto.progetto, linguaggio, lingua);
  } catch (e) {
    return { eccezione: e.message };
  }
}

function chiamata(f) {
  try {
    return f();
  } catch (e) {
    return { eccezione: e.message };
  }
}

const esiti = {};
const controlli = {};
const elenchi = {};
const disegni = {};
for (const tappa of readdirSync(corpus, { withFileTypes: true }).filter((v) => v.isDirectory()).map((v) => v.name).sort())
  for (const f of readdirSync(join(corpus, tappa)).filter((f) => f.endsWith(".algo")).sort()) {
    const nome = `${tappa}/${f.slice(0, -".algo".length)}`;
    const testo = readFileSync(join(corpus, tappa, f), "utf8");
    for (const lingua of LINGUE) for (const linguaggio of LINGUAGGI) esiti[`${nome} ${linguaggio} ${lingua}`] = esito(testo, linguaggio, lingua);
    if (uscitaDelDisegno === undefined) continue;

    const aperto = m.apri(testo);
    if (!aperto.ok) {
      controlli[nome] = { apriRifiuta: aperto };
      continue;
    }
    const p = aperto.progetto;
    const errori = m.controlla(p);
    controlli[nome] = errori;
    for (const lingua of LINGUE) {
      elenchi[`${nome} ${lingua}`] = chiamata(() => m.segnalazioni(p, lingua));
      for (const funzione of p.functions) {
        disegni[`${nome} ${funzione.id} ${lingua} senza`] = chiamata(() => m.disegna(p, funzione.id, lingua, misura, CARATTERE));
        disegni[`${nome} ${funzione.id} ${lingua} bollini`] = chiamata(() => m.disegna(p, funzione.id, lingua, misura, CARATTERE, { errori }));
      }
    }
  }
writeFileSync(uscita, JSON.stringify(esiti));
if (uscitaDelDisegno !== undefined) writeFileSync(uscitaDelDisegno, JSON.stringify({ globali, controlli, segnalazioni: elenchi, disegni }));

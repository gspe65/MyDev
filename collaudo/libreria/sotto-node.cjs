// Ciò che la prova della libreria esegue sotto Node, il motore dello studente: carica il pacchetto indicato e stampa, in
// JSON, le esportazioni e l'esito di ogni funzione (le sette del contratto 1.1). Non giudica nulla: i confronti stanno in `prova.ts`.
//
//   node collaudo/libreria/sotto-node.cjs <pacchetto> <file .algo>

const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const [pacchetto, fileAlgo] = process.argv.slice(2);
const m = require(resolve(pacchetto));
const esportazioni = Object.keys(m).filter((k) => k !== "default" && k !== "__esModule").sort();

const esiti = {};
const aperto = m.apri(readFileSync(fileAlgo, "utf8"));
esiti.apri = aperto.ok;
esiti.apriRifiuta = m.apri("questo non è un file").ok === false;
esiti.controllo = m.controlla(aperto.progetto).fuoriTappa === false;

esiti.genera = {};
for (const linguaggio of ["pseudocodice", "python", "c", "accademico", "typescript"]) {
  for (const lingua of ["it", "en"]) {
    const g = m.genera(aperto.progetto, linguaggio, lingua);
    esiti.genera[`${linguaggio} ${lingua}`] = g.generato ? (g.testo.length > 0 ? "testo" : "vuoto") : g.perche;
  }
}
try {
  m.genera(aperto.progetto, "inesistente", "it");
  esiti.linguaggioSconosciuto = "nessuna eccezione";
} catch (e) {
  esiti.linguaggioSconosciuto = e.message;
}
try {
  m.genera(aperto.progetto, "python", "IT");
  esiti.linguaSconosciuta = "nessuna eccezione";
} catch (e) {
  esiti.linguaSconosciuta = e.message;
}

const funzione = (segno) => `function somma(a: integer, b: integer) → integer\n    return a ${segno} b\nend function\n`;
const letta = m.leggiAccademico(funzione("+"));
const diversa = m.leggiAccademico(funzione("-"));
esiti.lettura = letta.ok && diversa.ok;
esiti.letturaRifiuta = m.leggiAccademico("function (((").ok === false;

const nuova = m.aggiungiAllaLibreria({ nome: "prova" }, letta, false);
esiti.nuova = nuova.ok ? nuova.aggiunte : "rifiutata";
const riaperta = m.apri(nuova.testo);
esiti.riaperta = riaperta.ok && riaperta.progetto.metadata.library === true;
const identica = m.aggiungiAllaLibreria(riaperta.progetto, letta, false);
esiti.identica = identica.ok ? { aggiunte: identica.aggiunte, identiche: identica.identiche } : "rifiutata";
const conflitto = m.aggiungiAllaLibreria(riaperta.progetto, diversa, false);
esiti.conflitto = conflitto.ok ? "nessun conflitto" : (conflitto.conflitti ?? []).map((c) => c.nome);
const rinominata = m.aggiungiAllaLibreria(riaperta.progetto, diversa, true);
esiti.rinominata = rinominata.ok ? rinominata.aggiunte : "rifiutata";
const rinominataRiaperta = rinominata.ok ? m.apri(rinominata.testo) : { ok: false };
esiti.rinominataRiaperta = rinominataRiaperta.ok && rinominataRiaperta.progetto.metadata.library === true && rinominata.testo.includes("somma_2");
const nonLibreria = m.aggiungiAllaLibreria(aperto.progetto, letta, false);
esiti.nonLibreria = nonLibreria.ok ? "accettata" : nonLibreria.rifiuto?.motivo;
const nomeCattivo = m.aggiungiAllaLibreria({ nome: "" }, letta, false);
esiti.nomeCattivo = nomeCattivo.ok ? "accettato" : nomeCattivo.rifiuto?.motivo;

// Il contratto 1.1: la misura del testo la dà chi chiama (qui una regola fissa, come nella conformità).
const misura = (t, stile) => t.length * 7 + (stile === "grassetto" ? t.length : stile === "corsivo" ? t.length / 2 : 0);
const prima = aperto.progetto.functions[0].id;
const d = m.disegna(aperto.progetto, prima, "it", misura, "system-ui, sans-serif", { errori: m.controlla(aperto.progetto) });
esiti.disegno = d.svg.startsWith("<svg ") && d.larghezza > 0 && d.altezza > 0 && d.svg.includes(`width="${d.larghezza}" height="${d.altezza}"`);
const rifiuto = (f) => {
  try {
    f();
    return "nessuna eccezione";
  } catch (e) {
    return e.message;
  }
};
esiti.disegnaRifiuta = [
  rifiuto(() => m.disegna(aperto.progetto, "nessuna", "it", misura, "sans-serif")),
  rifiuto(() => m.disegna(aperto.progetto, prima, "IT", misura, "sans-serif")),
  rifiuto(() => m.disegna(aperto.progetto, prima, "it", misura, "sans-serif", { colori: "verde" })),
];
esiti.segnalazioni = Array.isArray(m.segnalazioni(aperto.progetto, "it"));
esiti.segnalazioniRifiuta = rifiuto(() => m.segnalazioni(aperto.progetto, "IT"));

console.log(JSON.stringify({ esportazioni, esiti }));

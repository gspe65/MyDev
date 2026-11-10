// La prova della libreria: costruisce il pacchetto e lo guarda da fuori, sotto Node.
//
//   bun collaudo/libreria/prova.ts          atteso: ESITO: VERDE, prove N/N
//
// Uscite: 0 verde, 1 rosso, 2 fermo (non si è potuto misurare).
//
// Che cosa NON guarda:
// - che il codice generato sia giusto, cioè uguale a quello del nucleo: è la prova di conformità, sull'intero corpus;
// - il nome del progetto e i percorsi assoluti nei sorgenti di `extensions/`: guarda solo il pacchetto;
// - che il pacchetto giri dentro un editor;
// - che `aggiungiAllaLibreria` scriva lo stesso testo dello strumento del nucleo: prova che il file si riapre, su una funzione sola;
// - le esportazioni di soli tipi, che nel pacchetto non esistono.

import { appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { differenzeDegliElenchi, fermo, fermoSeEtichettaSpostata, git, INVENTARIO, leggiInventario, RADICE, repoDelNucleo } from "../../ricetta/nucleo/comune";

/** Il denominatore, dichiarato prima della corsa e confrontato alla fine. */
const PROVE_ATTESE = 21;

/** Le funzioni del contratto: un'esportazione in più è un rosso, non una comodità. */
const CINQUE = ["aggiungiAllaLibreria", "apri", "controlla", "genera", "leggiAccademico"];
/** Stringhe che nel pacchetto non devono esserci: la struttura del repo ospite, e il motore con cui si costruisce. */
const VIETATE = ["ricetta/", "ricetta\\", "estratto/", "estratto\\", "bun:", "Bun."];
/** Un file vero del corpus, con l'esito atteso di ogni generatore in entrambe le lingue. */
const CASO = "app/casi/tappa-1/arrotonda-meta.algo";
const GENERATI_ATTESI: Record<string, string> = { pseudocodice: "testo", python: "testo", c: "testo", accademico: "non-ci-sta", typescript: "testo" };

const LIBRERIA = join(RADICE, "extensions", "libreria");
const CONFIGURAZIONE = join(LIBRERIA, "tsconfig.json");
const PACCHETTO = join(LIBRERIA, "dist", "libreria.cjs");
const SOTTO_NODE = join(import.meta.dir, "sotto-node.cjs");

const cartella = mkdtempSync(join(tmpdir(), "libreria  prova-"));
process.on("exit", () => rmSync(cartella, { recursive: true, force: true }));

let fatte = 0;
const fallite: string[] = [];
function prova(nome: string, buona: boolean, dettaglio = ""): void {
  fatte++;
  console.log(`${buona ? "PASS" : "FAIL"}  ${nome}${buona ? "" : `\n      ${dettaglio}`}`);
  if (!buona) fallite.push(nome);
}

function esegui(comando: string[], cwd = RADICE): { uscita: number; testo: string; fuori: string } {
  const p = Bun.spawnSync(comando, { cwd, stdout: "pipe", stderr: "pipe" });
  return { uscita: p.exitCode, fuori: p.stdout.toString(), testo: p.stdout.toString() + p.stderr.toString() };
}

const tsc = Bun.which("tsc", { PATH: join(RADICE, "node_modules", ".bin") }) ?? fermo("tsc non c'è: bun install alla radice");
const node = Bun.which("node") ?? fermo("node non c'è: serve per provare il pacchetto");
const inventario = leggiInventario(INVENTARIO);
console.log(`inventario: ${inventario.etichetta}, ${inventario.file.length} file; node ${esegui([node, "--version"]).fuori.trim()}`);

// Il file del corpus, al commit fissato.
const repo = repoDelNucleo(undefined);
fermoSeEtichettaSpostata(repo, inventario);
const fileAlgo = join(cartella, "caso.algo");
writeFileSync(fileAlgo, git(repo, "show", `${inventario.commit}:${CASO}`));

// --- La costruzione, sempre da capo: si prova ciò che esce adesso, non un pacchetto rimasto.
rmSync(PACCHETTO, { force: true });
const costruzione = esegui(["bun", "run", "libreria:costruisci"]);
prova("la costruzione, dopo la verifica dell'estratto", costruzione.uscita === 0 && existsSync(PACCHETTO), costruzione.testo);
if (!existsSync(PACCHETTO)) fermo(`il pacchetto non c'è:\n${costruzione.testo}`);
console.log(`pacchetto: ${readFileSync(PACCHETTO).length} byte`);

// --- I tipi: il denominatore è l'elenco dell'inventario, più il sorgente dell'adattatore.
const tipi = esegui([tsc, "-p", CONFIGURAZIONE]);
prova("tsc sull'adattatore", tipi.uscita === 0, tipi.testo);
const elenco = esegui([tsc, "-p", CONFIGURAZIONE, "--listFilesOnly"]);
const righe = elenco.fuori.split(/\r?\n/).filter((r) => r !== "").map((r) => r.replaceAll("\\", "/"));
const sigla = "/ricetta/nucleo/estratto/";
/** Ogni riga ha un posto per nome: un termine calcolato per differenza accoglierebbe qualunque file estraneo. */
function classifica(elenco: string[]): { delNucleo: string[]; delSorgente: string[]; librerie: string[]; estranei: string[] } {
  const delSorgente = elenco.filter((r) => r.includes("/extensions/libreria/src/"));
  const librerie = elenco.filter((r) => /\/lib\.[a-z0-9.]+\.d\.ts$/.test(r));
  const estranei = elenco.filter((r) => !r.includes(sigla) && !delSorgente.includes(r) && !librerie.includes(r));
  return { delNucleo: elenco.filter((r) => r.includes(sigla)).map((r) => r.slice(r.indexOf(sigla) + sigla.length)), delSorgente, librerie, estranei };
}
const { delNucleo, delSorgente, librerie, estranei } = classifica(righe);
const { soloA: fuoriInventario, soloB: nonRaggiunti } = differenzeDegliElenchi(delNucleo, inventario.file.map((v) => v.percorso));
console.log(`tsc --listFilesOnly: righe ${righe.length} = ${delNucleo.length} del nucleo + ${delSorgente.length} del sorgente + ${librerie.length} librerie + ${estranei.length} estranei`);
console.log(`nucleo contro inventario: ${delNucleo.length} · ${inventario.file.length}, fuori dall'inventario ${fuoriInventario.length}, non raggiunti ${nonRaggiunti.length}`);
prova("l'adattatore raggiunge esattamente i file dell'inventario", fuoriInventario.length === 0 && nonRaggiunti.length === 0 && delSorgente.length === 1 && estranei.length === 0, `fuori: ${fuoriInventario.join(", ")}; non raggiunti: ${nonRaggiunti.join(", ")}; estranei: ${estranei.join(", ")}`);
prova("mutazione: un file estraneo nell'elenco del compilatore si vede", classifica([...righe, "C:/altrove/aiuto.ts"]).estranei.join() === "C:/altrove/aiuto.ts");

/** Una sonda di tipo nella configurazione vera, in una cartella a parte: il codice d'errore atteso, e nessun altro. */
function sondaDiTipo(nome: string, codice: string, atteso: string): void {
  const dir = join(cartella, `sonda-${nome}`);
  const adattatore = join(LIBRERIA, "src", "index").replaceAll("\\", "/");
  mkdirSync(dir);
  writeFileSync(join(dir, "sonda.ts"), codice.replace("ADATTATORE", adattatore));
  writeFileSync(join(dir, "tsconfig.json"), JSON.stringify({ extends: CONFIGURAZIONE.replaceAll("\\", "/"), include: [], files: ["sonda.ts"] }));
  const r = esegui([tsc, "-p", join(dir, "tsconfig.json")]);
  const codici = [...new Set(r.testo.match(/TS\d+/g) ?? [])];
  prova(`sonda di tipo ${nome}: ${atteso}`, r.uscita !== 0 && codici.length === 1 && codici[0] === atteso, `uscita ${r.uscita}, codici ${codici.join(", ")}\n${r.testo}`);
}
sondaDiTipo("firma", 'import { genera } from "ADATTATORE";\ngenera(1, "c", "it");\n', "TS2345");
sondaDiTipo("dom", "export const x = document;\n", "TS2584");

// --- Il pacchetto da fuori.
type Lettura = { uscita: number; testo: string; esportazioni: string[]; esiti: Record<string, unknown> };

function sottoNode(pacchetto: string): Lettura {
  const r = esegui([node, SOTTO_NODE, pacchetto, fileAlgo]);
  if (r.uscita !== 0) return { uscita: r.uscita, testo: r.testo, esportazioni: [], esiti: {} };
  const dati = JSON.parse(r.fuori) as { esportazioni: string[]; esiti: Record<string, unknown> };
  return { uscita: 0, testo: r.testo, ...dati };
}

/** Gli import del pacchetto letti dal parser: le stringhe del programma generato non contano. */
const importDel = (pacchetto: string): string[] => new Bun.Transpiler({ loader: "js" }).scanImports(readFileSync(pacchetto, "utf8")).map((i) => i.path);
const vietateIn = (pacchetto: string): string[] => VIETATE.filter((v) => readFileSync(pacchetto, "utf8").includes(v));

const vero = sottoNode(PACCHETTO);
if (vero.uscita !== 0) fermo(`il pacchetto non gira sotto Node:\n${vero.testo}`);
const confronto = differenzeDegliElenchi(vero.esportazioni, CINQUE);
console.log(`esportazioni: ${vero.esportazioni.length} [${vero.esportazioni.join(", ")}]; attese ${CINQUE.length}; in più ${confronto.soloA.length}, mancanti ${confronto.soloB.length}`);
prova("esporta esattamente le cinque funzioni", confronto.soloA.length === 0 && confronto.soloB.length === 0, `in più: ${confronto.soloA.join(", ")}; mancanti: ${confronto.soloB.join(", ")}`);
const imports = importDel(PACCHETTO);
console.log(`import del pacchetto: ${imports.length} [${imports.join(", ")}]`);
prova("nessun import nel pacchetto", imports.length === 0, imports.join(", "));
prova("nessuna stringa vietata nel pacchetto", vietateIn(PACCHETTO).length === 0, vietateIn(PACCHETTO).join(", "));

const e = vero.esiti;
const uguale = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const generatiAttesi = Object.fromEntries(Object.entries(GENERATI_ATTESI).flatMap(([l, x]) => [[`${l} it`, x], [`${l} en`, x]]));
prova("apri e controlla, su un file del corpus e su un testo che non è un file", e.apri === true && e.apriRifiuta === true && e.controllo === true, JSON.stringify(e));
prova(`genera: ${Object.keys(generatiAttesi).length} combinazioni di linguaggio e lingua`, uguale(e.genera, generatiAttesi), JSON.stringify(e.genera));
prova("genera: un linguaggio sconosciuto è un'eccezione col nome", e.linguaggioSconosciuto === "linguaggio sconosciuto: inesistente", String(e.linguaggioSconosciuto));
prova("genera: una lingua sconosciuta è un'eccezione col nome", e.linguaSconosciuta === "lingua sconosciuta: IT", String(e.linguaSconosciuta));
prova("leggi Accademico: una lettura riuscita e una rifiutata", e.lettura === true && e.letturaRifiuta === true, JSON.stringify(e));
prova(
  "aggiungi alla libreria: nuova, riaperta dal suo testo, identica, in conflitto, rinominata e riaperta",
  uguale(e.nuova, ["somma"]) && e.riaperta === true && uguale(e.identica, { aggiunte: [], identiche: ["somma"] }) && uguale(e.conflitto, ["somma"]) && uguale(e.rinominata, ["somma_2"]) && e.rinominataRiaperta === true,
  JSON.stringify(e),
);
// Il motivo del nome vuoto è quello che il nucleo dà ai metadati, passato così com'è.
prova("aggiungi alla libreria: un progetto che non è una libreria e un nome vuoto sono rifiuti", e.nonLibreria === "non_e_una_libreria" && e.nomeCattivo === "illeggibile", `${String(e.nonLibreria)}, ${String(e.nomeCattivo)}`);

// --- Le mutazioni, su copie del pacchetto: i controlli di sopra devono accendersi.
function copia(nome: string, coda: string): string {
  const p = join(cartella, `${nome}.cjs`);
  copyFileSync(PACCHETTO, p);
  appendFileSync(p, `\n${coda}\n`);
  return p;
}
const inPiu = sottoNode(copia("in-piu", "module.exports = { ...module.exports, inPiu: () => 1 };"));
prova("mutazione: un'esportazione in più si vede", differenzeDegliElenchi(inPiu.esportazioni, CINQUE).soloA.join() === "inPiu", inPiu.testo);
const senza = sottoNode(copia("senza", 'module.exports = Object.fromEntries(Object.entries(module.exports).filter(([k]) => k !== "genera"));'));
prova("mutazione: un'esportazione mancante ferma il pacchetto sotto Node", senza.uscita !== 0 && senza.testo.includes("genera"), senza.testo);
prova("mutazione: un require si vede dal parser", importDel(copia("require", 'if (false) require("inesistente");')).includes("inesistente"), "");
prova("mutazione: un import di Bun si vede, come import e come stringa", importDel(copia("bun", 'if (false) import("bun:sqlite");')).includes("bun:sqlite") && vietateIn(join(cartella, "bun.cjs")).includes("bun:"), "");
prova("mutazione: un percorso della ricetta si vede, con la barra e con la rovescia", vietateIn(copia("barra", "// ricetta/nucleo")).includes("ricetta/") && vietateIn(copia("rovescia", "// estratto\\app")).includes("estratto\\"), "");

console.log(`prove: ${fatte}/${PROVE_ATTESE}, fallite ${fallite.length}`);
if (fatte !== PROVE_ATTESE) {
  console.log(`FERMO: il denominatore non torna: dichiarate ${PROVE_ATTESE}, eseguite ${fatte}`);
  process.exit(2);
}
console.log(`ESITO: ${fallite.length === 0 ? "VERDE" : "ROSSO"}`);
process.exit(fallite.length === 0 ? 0 : 1);

// La prova di conformità: il codice che esce dal pacchetto sotto Node è identico a quello che danno i sorgenti del nucleo sotto
// Bun, su tutto il corpus al commit fissato, per ogni linguaggio del registro e nelle due lingue, rifiuti compresi.
//
//   bun collaudo/conformita/prova.ts          atteso: ESITO: VERDE, prove N/N
//
// Uscite: 0 verde, 1 rosso, 2 fermo (non si è potuto misurare).
//
// Che cosa NON guarda:
// - che il codice generato sia giusto: qui si confrontano testi, nessun programma generato viene eseguito;
// - le altre funzioni del contratto (`controlla`, `leggiAccademico`, `aggiungiAllaLibreria`): è la prova della libreria;
// - la forma senza tipi del TypeScript, che non è una voce del registro;
// - che il pacchetto giri dentro un editor;
// - i rifiuti di `apri`, le eccezioni, «fuori tappa» e «non ancora»: il corpus non li produce, quindi qui quei rami si contano e non si
//   esercitano. Li provano altrove, con casi fatti a mano, la prova della libreria e la logica dell'estensione;
// - un percorso verso l'adattatore costruito a run time: il parser e la spia leggono il testo del file.

import { appendFileSync, copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { differenzeDegliElenchi, fermo, fermoSeEtichettaSpostata, git, INVENTARIO, leggiInventario, RADICE, repoDelNucleo } from "../../ricetta/nucleo/comune";

/** I denominatori, dichiarati prima della corsa e confrontati con ciò che si misura. Cambiare etichetta è rimisurarli. */
const PROVE_ATTESE = 25;
const FILE_ATTESI = 192;
const LINGUAGGI = ["pseudocodice", "python", "c", "accademico", "typescript"];
const LINGUE = ["it", "en"];
const COMBINAZIONI_ATTESE = FILE_ATTESI * LINGUAGGI.length * LINGUE.length;
/** Gli esiti per motivo: se tutto venisse rifiutato allo stesso modo le differenze sarebbero zero, e il verde falso. */
const MOTIVI_ATTESI: Record<string, number> = { testo: 1456, "non-ci-sta": 274, "errori-statici": 190, "fuori-tappa": 0, "non-ancora": 0, "apri rifiuta": 0, eccezione: 0 };

/** Le combinazioni vere che le mutazioni colpiscono, una ciascuna. */
const FILE_COLPITO = "tappa-1/arrotonda-meta";
const COLPITA_TESTO = `${FILE_COLPITO} python en`;
const COLPITA_RIFIUTO = `${FILE_COLPITO} accademico en`;
const COLPITA_ATTESI = `${FILE_COLPITO} c it`;
const TOLTA_ATTESI = `${FILE_COLPITO} typescript it`;
const TOLTA_OTTENUTO = `${FILE_COLPITO} pseudocodice it`;

const QUI = import.meta.dir;
const ATTESI = join(QUI, "attesi.ts");
const OTTENUTO = join(QUI, "ottenuto.cjs");
const PACCHETTO = join(RADICE, "extensions", "libreria", "dist", "libreria.cjs");

const cartella = mkdtempSync(join(tmpdir(), "conformita  prova-"));
process.on("exit", () => rmSync(cartella, { recursive: true, force: true }));

let fatte = 0;
const fallite: string[] = [];
function prova(nome: string, buona: boolean, dettaglio = ""): void {
  fatte++;
  console.log(`${buona ? "PASS" : "FAIL"}  ${nome}${buona ? "" : `\n      ${dettaglio}`}`);
  if (!buona) fallite.push(nome);
}

/** Lo standard output e lo standard error restano distinti: i dati stanno nei file, mai in ciò che un processo stampa. */
function esegui(comando: string[]): { uscita: number; testo: string } {
  const p = Bun.spawnSync(comando, { cwd: RADICE, stdout: "pipe", stderr: "pipe" });
  return { uscita: p.exitCode, testo: `${p.stdout.toString()}${p.stderr.toString()}` };
}

const tsc = Bun.which("tsc", { PATH: join(RADICE, "node_modules", ".bin") }) ?? fermo("tsc non c'è: bun install alla radice");
const node = Bun.which("node") ?? fermo("node non c'è: serve per provare il pacchetto");
const inventario = leggiInventario(INVENTARIO);
const repo = repoDelNucleo(undefined);
fermoSeEtichettaSpostata(repo, inventario);
console.log(`inventario: ${inventario.etichetta}, commit ${inventario.commit.slice(0, 7)}; bun ${Bun.version}, node ${esegui([node, "--version"]).testo.trim()}`);
console.log(`dichiarato prima della corsa: ${FILE_ATTESI} file × ${LINGUAGGI.length} linguaggi × ${LINGUE.length} lingue = ${COMBINAZIONI_ATTESE}`);

// --- La costruzione, sempre da capo: verifica l'estratto per impronta e fa nascere il pacchetto di adesso.
rmSync(PACCHETTO, { force: true });
const costruzione = esegui(["bun", "run", "libreria:costruisci"]);
prova("la costruzione, dopo la verifica dell'estratto", costruzione.uscita === 0 && existsSync(PACCHETTO), costruzione.testo);
if (!existsSync(PACCHETTO)) fermo(`il pacchetto non c'è:\n${costruzione.testo}`);
const tipi = esegui([tsc, "-p", join(QUI, "tsconfig.json")]);
prova("tsc sulla prova e sugli attesi", tipi.uscita === 0, tipi.testo);

// --- Il corpus, al commit fissato. L'elenco di git è il riscontro indipendente di ciò che i due lati enumerano dal disco.
const SOTTO = "app/casi/";
const tutti = new TextDecoder().decode(git(repo, "-c", "core.quotepath=off", "ls-tree", "-r", "--name-only", inventario.commit, SOTTO)).split("\n").filter((r) => r !== "");
const algo = tutti.filter((f) => f.endsWith(".algo")).map((f) => f.slice(SOTTO.length, -".algo".length));
const altri = tutti.filter((f) => !f.endsWith(".algo"));
console.log(`corpus al commit: totale ${tutti.length} = ${algo.length} .algo + ${altri.length} esclusi [${altri.join(", ")}]`);
prova(`il corpus al commit ha i file dichiarati`, algo.length === FILE_ATTESI, `${algo.length} contro ${FILE_ATTESI}`);
await new Bun.Archive(git(repo, "archive", "--format=tar", inventario.commit, SOTTO)).extract(cartella);
const corpus = join(cartella, ...SOTTO.split("/"));

// --- I due lati, in due processi. Un lato che non scrive il suo file è un fermo: non si è potuto misurare.
type Esiti = Record<string, unknown>;
const leggiEsiti = (file: string): Esiti => JSON.parse(readFileSync(file, "utf8")) as Esiti;

function latoAtteso(): string {
  const uscita = join(cartella, "attesi.json");
  const r = esegui(["bun", ATTESI, corpus, uscita]);
  if (r.uscita !== 0 || !existsSync(uscita)) fermo(`gli attesi non sono nati, uscita ${r.uscita}:\n${r.testo}`);
  return uscita;
}
function latoOttenuto(pacchetto: string, nome: string): string {
  const uscita = join(cartella, `${nome}.json`);
  const r = esegui([node, OTTENUTO, pacchetto, corpus, uscita]);
  if (r.uscita !== 0 || !existsSync(uscita)) fermo(`l'ottenuto ${nome} non è nato, uscita ${r.uscita}:\n${r.testo}`);
  return uscita;
}

const fileAttesi = latoAtteso();
const attesi = leggiEsiti(fileAttesi);
const ottenuto = leggiEsiti(latoOttenuto(PACCHETTO, "ottenuto"));

// --- Il confronto: gli elementi nei due versi, e ogni combinazione come oggetto intero. Il conteggio sta accanto.
type Confronto = { soloAttesi: string[]; soloOttenuto: string[]; diverse: string[] };
function confronta(a: Esiti, o: Esiti): Confronto {
  const { soloA: soloAttesi, soloB: soloOttenuto } = differenzeDegliElenchi(Object.keys(a), Object.keys(o));
  const diverse = Object.keys(a).filter((k) => k in o && JSON.stringify(a[k]) !== JSON.stringify(o[k]));
  return { soloAttesi, soloOttenuto, diverse };
}

/** Dove due esiti si separano: una sola regola per testi e rifiuti, sulla loro forma JSON. */
function primaDifferenza(k: string, a: Esiti, o: Esiti): string {
  const [x, y] = [JSON.stringify(a[k]), JSON.stringify(o[k])];
  let i = 0;
  while (i < x.length && x[i] === y[i]) i++;
  const pezzo = (s: string) => s.slice(Math.max(0, i - 50), i + 50);
  return `${k}, al carattere ${i}\n      atteso:   ${pezzo(x)}\n      ottenuto: ${pezzo(y)}`;
}

// I verdetti stanno in funzioni: le stesse che decidono l'esito le attraversano le mutazioni e le sonde qui sotto.
const previste = algo.flatMap((f) => LINGUE.flatMap((l) => LINGUAGGI.map((v) => `${f} ${v} ${l}`)));
function controIlDichiarato(esiti: Esiti): { soloA: string[]; soloB: string[]; torna: boolean } {
  const { soloA, soloB } = differenzeDegliElenchi(Object.keys(esiti), previste);
  return { soloA, soloB, torna: Object.keys(esiti).length === COMBINAZIONI_ATTESE && soloA.length === 0 && soloB.length === 0 };
}
function controElenco(nome: string, esiti: Esiti): void {
  const { soloA, soloB, torna } = controIlDichiarato(esiti);
  console.log(`${nome}: ${Object.keys(esiti).length} combinazioni; previste ${previste.length}, dichiarate ${COMBINAZIONI_ATTESE}; fuori elenco ${soloA.length}, mancanti ${soloB.length}`);
  prova(`${nome}: le combinazioni sono quelle dichiarate, elemento per elemento`, torna, `fuori elenco: ${soloA.slice(0, 5).join("; ")}; mancanti: ${soloB.slice(0, 5).join("; ")}`);
}
controElenco("attesi", attesi);
controElenco("ottenuto", ottenuto);

const nessunoDaUnaParte = (c: Confronto): boolean => c.soloAttesi.length === 0 && c.soloOttenuto.length === 0;
const nessunaDifferenza = (c: Confronto): boolean => c.diverse.length === 0;
const esito = confronta(attesi, ottenuto);
console.log(`solo negli attesi ${esito.soloAttesi.length}, solo nell'ottenuto ${esito.soloOttenuto.length}, differenze ${esito.diverse.length}`);
prova("nessuna combinazione solo da una parte", nessunoDaUnaParte(esito), `solo negli attesi: ${esito.soloAttesi.slice(0, 5).join("; ")}; solo nell'ottenuto: ${esito.soloOttenuto.slice(0, 5).join("; ")}`);
const prima = esito.diverse[0];
prova("zero differenze", nessunaDifferenza(esito), prima === undefined ? "" : primaDifferenza(prima, attesi, ottenuto));

function motivoDi(e: unknown): string {
  const v = e as { eccezione?: string; apriRifiuta?: unknown; generato?: boolean; testo?: string; perche?: string };
  if (v.eccezione !== undefined) return "eccezione";
  if (v.apriRifiuta !== undefined) return "apri rifiuta";
  if (v.generato === true) return v.testo === "" ? "testo vuoto" : "testo";
  return v.perche ?? "esito sconosciuto";
}
function motiviDi(esiti: Esiti): { motivi: Record<string, number>; scarti: string[] } {
  const motivi: Record<string, number> = Object.fromEntries(Object.keys(MOTIVI_ATTESI).map((m) => [m, 0]));
  for (const e of Object.values(esiti)) motivi[motivoDi(e)] = (motivi[motivoDi(e)] ?? 0) + 1;
  return { motivi, scarti: Object.keys(motivi).filter((m) => motivi[m] !== MOTIVI_ATTESI[m]) };
}
const { motivi, scarti } = motiviDi(attesi);
console.log(`esiti per motivo: ${Object.entries(motivi).map(([m, n]) => `${m} ${n}`).join(", ")}; somma ${Object.values(motivi).reduce((a, b) => a + b, 0)}`);
prova("gli esiti per motivo sono quelli dichiarati", scarti.length === 0, scarti.map((m) => `${m}: ${motivi[m]} contro ${MOTIVI_ATTESI[m]}`).join("; "));

// Le sonde false dei due verdetti che le mutazioni non attraversano. Qui il fatto cercato è la deviazione: inventarle è corretto.
const chiavi = Object.keys(attesi);
const tuttiRifiutati: Esiti = Object.fromEntries(chiavi.map((k) => [k, { generato: false, perche: "errori-statici" }]));
prova("sonda: tutto rifiutato allo stesso modo sui due lati è zero differenze, e il verdetto dei motivi lo vede", nessunaDifferenza(confronta(tuttiRifiutati, tuttiRifiutati)) && motiviDi(tuttiRifiutati).scarti.length > 0);
prova("sonda: una combinazione mancante e una in più, il verdetto dell'elenco le vede", !controIlDichiarato(Object.fromEntries(chiavi.slice(1).map((k) => [k, 0]).concat([["inventata", 0]]))).torna && controIlDichiarato(attesi).torna);

// --- Gli attesi non importano l'adattatore. Due rilevatori, ciascuno col suo controllo positivo.
/** Gli import che il parser vede, cioè quelli che esistono quando il file gira. Non vede gli `import type`: per quelli c'è la spia. */
const importDi = (testo: string, loader: "ts" | "js"): string[] => new Bun.Transpiler({ loader }).scanImports(testo).map((i) => i.path);
const ESTRATTO_RELATIVO = "../../ricetta/nucleo/estratto/app/";
const nonAmmessi = (testo: string): string[] => importDi(testo, "ts").filter((p) => !p.startsWith("node:") && !p.startsWith(ESTRATTO_RELATIVO));
/** La spia di testo: copre ciò che il parser non vede. */
const spia = (testo: string): string[] => testo.match(/libreria|extensions\/|dist\//gi) ?? [];

const testoAttesi = readFileSync(ATTESI, "utf8");
const importAttesi = importDi(testoAttesi, "ts");
console.log(`import degli attesi visti dal parser: ${importAttesi.length}, dall'estratto ${importAttesi.filter((p) => p.startsWith(ESTRATTO_RELATIVO)).length}, non ammessi ${nonAmmessi(testoAttesi).length}; colpi della spia ${spia(testoAttesi).length}`);
prova("gli attesi importano solo node: e l'estratto", importAttesi.length > 0 && nonAmmessi(testoAttesi).length === 0, nonAmmessi(testoAttesi).join(", "));
prova("gli attesi non nominano l'adattatore né il pacchetto", spia(testoAttesi).length === 0, spia(testoAttesi).join(", "));
const importOttenuto = importDi(readFileSync(OTTENUTO, "utf8"), "js");
console.log(`import del lato Node visti dal parser: ${importOttenuto.length} [${importOttenuto.join(", ")}]`);
prova("il lato Node importa solo node:, oltre al pacchetto che riceve", importOttenuto.length > 0 && importOttenuto.every((p) => p.startsWith("node:")), importOttenuto.join(", "));

// I controlli positivi: lo stesso rilevatore su una copia degli attesi che importa davvero. Qui il fatto cercato è l'assenza: le sonde sono inventate per forza.
const SORGENTE = "../../extensions/libreria/src/index";
const conRiga = (riga: string): string => `${riga}\n${testoAttesi}`;
prova("controllo positivo del parser: un import usato del sorgente", nonAmmessi(conRiga(`import { genera as g } from "${SORGENTE}";\nconsole.log(g);`)).includes(SORGENTE));
prova("controllo positivo del parser: un import inutilizzato del sorgente", nonAmmessi(conRiga(`import { genera as g } from "${SORGENTE}";`)).includes(SORGENTE));
prova("controllo positivo del parser: un require del pacchetto", nonAmmessi(conRiga(`require("../../extensions/libreria/dist/libreria.cjs");`)).includes("../../extensions/libreria/dist/libreria.cjs"));
prova("controllo positivo del parser: un aiuto locale che potrebbe importarlo", nonAmmessi(conRiga(`import { aiuto } from "./aiuto";\nconsole.log(aiuto);`)).includes("./aiuto"));
const soloTipo = conRiga(`import type { CodiceGenerato } from "${SORGENTE}";`);
prova("controllo positivo della spia: un import di soli tipi, che il parser non vede", spia(soloTipo).length > 0 && !nonAmmessi(soloTipo).includes(SORGENTE), `spia ${spia(soloTipo).length}, parser ${nonAmmessi(soloTipo).join(", ")}`);

prova("controllo positivo del lato Node: un require degli attesi", importDi(`${readFileSync(OTTENUTO, "utf8")}\nrequire("./attesi.ts");`, "js").includes("./attesi.ts"));

// --- Le mutazioni, su copie: ciascuna colpisce una sola combinazione vera, e il rosso deve nominare quella e nessun'altra.
const indiceDi = (k: string): number => {
  const i = Object.keys(ottenuto).indexOf(k);
  if (i < 0) fermo(`la combinazione colpita non c'è: ${k}`);
  return i;
};

/** Una copia del pacchetto in cui la chiamata numero `indice` di `genera` passa per `altera`. L'ordine è quello del lato Node. */
function pacchettoAlterato(nome: string, indice: number, altera: string): string {
  const copia = join(cartella, `${nome}.cjs`);
  copyFileSync(PACCHETTO, copia);
  appendFileSync(copia, `\n{ const vera = module.exports.genera; let n = 0; module.exports = { ...module.exports, genera: (p, l, li) => { const g = vera(p, l, li); return n++ === ${indice} ? (${altera})(g) : g; } }; }\n`);
  return copia;
}

/** Il rosso deve nominare esattamente la combinazione attesa, in una delle tre liste e vuote le altre due. */
function sensibile(nome: string, c: Confronto, lista: keyof Confronto, k: string): void {
  const ok = !(nessunoDaUnaParte(c) && nessunaDifferenza(c)) && c[lista].join() === k && (Object.keys(c) as (keyof Confronto)[]).filter((l) => l !== lista).every((l) => c[l].length === 0);
  prova(`mutazione: ${nome} → rosso su ${k}`, ok, JSON.stringify({ soloAttesi: c.soloAttesi.slice(0, 3), soloOttenuto: c.soloOttenuto.slice(0, 3), diverse: c.diverse.slice(0, 3), quante: c.diverse.length }));
}

const conTesto = leggiEsiti(latoOttenuto(pacchettoAlterato("un-carattere", indiceDi(COLPITA_TESTO), `(g) => ({ ...g, testo: (g.testo[0] === "x" ? "y" : "x") + g.testo.slice(1) })`), "ottenuto-un-carattere"));
const cTesto = confronta(attesi, conTesto);
sensibile("il pacchetto cambia un carattere del testo", cTesto, "diverse", COLPITA_TESTO);
if (cTesto.diverse[0] !== undefined) console.log(`      come si legge: ${primaDifferenza(cTesto.diverse[0], attesi, conTesto)}`);

const conRifiuto = leggiEsiti(latoOttenuto(pacchettoAlterato("mancanze", indiceDi(COLPITA_RIFIUTO), `(g) => ({ ...g, mancanze: g.mancanze.slice(1) })`), "ottenuto-mancanze"));
sensibile("il pacchetto taglia le mancanze, col motivo intatto", confronta(attesi, conRifiuto), "diverse", COLPITA_RIFIUTO);
prova("mutazione: il motivo della combinazione colpita è rimasto uguale, quindi il rosso viene dall'oggetto intero", motivoDi(attesi[COLPITA_RIFIUTO]) === "non-ci-sta" && motivoDi(conRifiuto[COLPITA_RIFIUTO]) === "non-ci-sta", `${motivoDi(attesi[COLPITA_RIFIUTO])}, ${motivoDi(conRifiuto[COLPITA_RIFIUTO])}`);

/** Una copia di un file di esiti, alterata e riletta dallo stesso caricatore. */
function copiaAlterata(nome: string, file: string, altera: (e: Esiti) => void): Esiti {
  const e = leggiEsiti(file);
  altera(e);
  const copia = join(cartella, `${nome}.json`);
  writeFileSync(copia, JSON.stringify(e));
  return leggiEsiti(copia);
}
const fileOttenuto = join(cartella, "ottenuto.json");
sensibile(
  "gli attesi cambiano un carattere",
  confronta(copiaAlterata("attesi-carattere", fileAttesi, (e) => {
    const v = e[COLPITA_ATTESI] as { testo: string };
    v.testo = (v.testo[0] === "x" ? "y" : "x") + v.testo.slice(1);
  }), ottenuto),
  "diverse",
  COLPITA_ATTESI,
);
sensibile("gli attesi perdono una combinazione", confronta(copiaAlterata("attesi-meno", fileAttesi, (e) => delete e[TOLTA_ATTESI]), ottenuto), "soloOttenuto", TOLTA_ATTESI);
sensibile("l'ottenuto perde una combinazione", confronta(attesi, copiaAlterata("ottenuto-meno", fileOttenuto, (e) => delete e[TOLTA_OTTENUTO])), "soloAttesi", TOLTA_OTTENUTO);

console.log(`prove: ${fatte}/${PROVE_ATTESE}, fallite ${fallite.length}`);
if (fatte !== PROVE_ATTESE) {
  console.log(`FERMO: il denominatore non torna: dichiarate ${PROVE_ATTESE}, eseguite ${fatte}`);
  process.exit(2);
}
console.log(`ESITO: ${fallite.length === 0 ? "VERDE" : "ROSSO"}`);
process.exit(fallite.length === 0 ? 0 : 1);

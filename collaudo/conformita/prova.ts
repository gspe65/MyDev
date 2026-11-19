// La prova di conformità: ciò che esce dal pacchetto sotto Node è identico a ciò che danno i sorgenti del nucleo sotto Bun, su tutto
// il corpus al commit fissato:
// - `genera`, per ogni linguaggio del registro e nelle due lingue, rifiuti compresi (il contratto 1.0);
// - dal contratto 1.1, dal punto d'ingresso estratto: `controlla` di ogni file, `segnalazioni` nelle due lingue, e `disegna` di ogni
//   funzione nelle due lingue, senza e coi bollini (`errori` = l'esito di `controlla`), con la misura fissa del testo: l'SVG uguale
//   byte per byte;
// - lo stesso pacchetto eseguito in un contesto senza Node (`node:vm` coi soli `module` ed `exports`), come in una pagina: gli stessi
//   esiti, tutti;
// - il pacchetto provato è il file della release all'etichetta dell'inventario: byte per byte quello dello zip del deposito, che la
//   costruzione ha appena verificato con le due impronte di pacchetto.json;
// - l'appaiamento, sull'ottenuto: i codici delle segnalazioni sono quelli di `controlla` (errori e avvisi), file per file e lingua per
//   lingua, nei due versi; i bollini del disegno sono i blocchi delle segnalazioni, nei due versi, col segno e i codici.
//
//   bun collaudo/conformita/prova.ts          atteso: ESITO: VERDE, prove N/N
//
// Uscite: 0 verde, 1 rosso, 2 fermo (non si è potuto misurare).
//
// Che cosa NON guarda:
// - che il codice generato sia giusto: qui si confrontano testi, nessun programma generato viene eseguito;
// - `leggiAccademico` e `aggiungiAllaLibreria`: è la prova della libreria, su casi a mano;
// - la forma senza tipi del TypeScript, che non è una voce del registro;
// - che il pacchetto giri dentro un editor o in una pagina vera: il contesto senza Node non ha il DOM, e la misura vera del testo (il
//   canvas col carattere caricato) è un'altra prova;
// - che `disegna` sia il disegno che l'app esporta: lo prova AlgoDesign; qui il sorgente è il punto d'ingresso estratto, non impacchettato;
// - le opzioni del disegno diverse dai predefiniti (forme, insiemi di colori, modo, sfondo, prefisso): solo i predefiniti ed `errori`;
// - nell'appaiamento, gli elenchi di dettaglio di `controlla` (fermate, dati, valori mancanti…): si confrontano per identità, e i codici
//   che portano devono stare fra gli errori e gli avvisi dello stesso file;
// - i rifiuti di `apri`, le eccezioni, «fuori tappa» e «non ancora»: il corpus non li produce, quindi qui quei rami si contano e non si
//   esercitano. Li provano altrove, con casi fatti a mano, la prova della libreria e la logica dell'estensione;
// - un percorso verso l'adattatore costruito a run time: il parser e la spia leggono il testo del file;
// - il file della release di un'etichetta precedente (il contratto 1.0 della `v1.0.0`, che porta il pacchetto di prova dell'estensione
//   nella versione pubblicata prima della 1.0.1): il suo `genera` uguale ai sorgenti si è provato fino all'etichetta `v1.0.1`, e qui
//   non si prova più.

import { appendFileSync, copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { differenzeDegliElenchi, fermo, fermoSeEtichettaSpostata, git, impronta, INVENTARIO, leggiInventario, RADICE, repoDelNucleo, riferimentoDi, vocedelloZip } from "../../ricetta/nucleo/comune";

/** I denominatori, dichiarati prima della corsa e confrontati con ciò che si misura. Cambiare riferimento è rimisurarli. */
const PROVE_ATTESE = 48;
const FILE_ATTESI = 192;
const LINGUAGGI = ["pseudocodice", "python", "c", "accademico", "typescript"];
const LINGUE = ["it", "en"];
const COMBINAZIONI_ATTESE = FILE_ATTESI * LINGUAGGI.length * LINGUE.length;
/** Gli esiti per motivo: se tutto venisse rifiutato allo stesso modo le differenze sarebbero zero, e il verde falso. */
const MOTIVI_ATTESI: Record<string, number> = { testo: 1456, "non-ci-sta": 274, "errori-statici": 190, "fuori-tappa": 0, "non-ancora": 0, "apri rifiuta": 0, eccezione: 0 };
/** Il contratto 1.1, misurato all'etichetta dell'inventario (gli stessi numeri che AlgoDesign dichiara per le sue prove). Due disegni
 *  per funzione e lingua: senza e coi bollini. */
const FUNZIONI_ATTESE = 335;
const DISEGNI_ATTESI = FUNZIONI_ATTESE * LINGUE.length * 2;
const ELENCHI_ATTESI = FILE_ATTESI * LINGUE.length;
const VOCI_ATTESE = 74;
const VOCI_SENZA_BLOCCO = 18;
const BOLLINI_ATTESI = 56;
/** I codici negli elenchi di dettaglio di `controlla` (dati 5, fermate 7, record 2), contati per intero sugli attesi. */
const DETTAGLI_COL_CODICE = 14;
/** Che cosa il contesto senza Node mostra al pacchetto: `process`, `Buffer`, `require`, `global` no, `module` sì. */
const GLOBALI_SENZA_NODE = ["undefined", "undefined", "undefined", "undefined", "object"];

/** Le combinazioni vere che le mutazioni colpiscono, una ciascuna. */
const FILE_COLPITO = "tappa-1/arrotonda-meta";
const COLPITA_TESTO = `${FILE_COLPITO} python en`;
const COLPITA_RIFIUTO = `${FILE_COLPITO} accademico en`;
const COLPITA_ATTESI = `${FILE_COLPITO} c it`;
const TOLTA_ATTESI = `${FILE_COLPITO} typescript it`;
const TOLTA_OTTENUTO = `${FILE_COLPITO} pseudocodice it`;
/** Un file con una sola segnalazione e il suo bollino: l'errore E034 (`invalid_step`) sul blocco b1 della funzione f1. */
const COLPITO_DISEGNO = "tappa-2/per-passo-zero f1 it bollini";
const COLPITO_ELENCO = "tappa-2/per-passo-zero en";
const CODICE_COLPITO = "invalid_step";
const BLOCCO_COLPITO = "b1";

const QUI = import.meta.dir;
const ATTESI = join(QUI, "attesi.ts");
const OTTENUTO = join(QUI, "ottenuto.cjs");
const PACCHETTO = join(RADICE, "extensions", "libreria", "dist", "libreria.cjs");
const DESCRIZIONE = JSON.parse(readFileSync(join(RADICE, "ricetta", "nucleo", "pacchetto.json"), "utf8")) as { zip: { nome: string }; file: { percorso: string; sha256: string } };
const ZIP_DELLA_RELEASE = join(RADICE, "ricetta", "nucleo", "scaricato", DESCRIZIONE.zip.nome);

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
console.log(`inventario: ${riferimentoDi(inventario)}; bun ${Bun.version}, node ${esegui([node, "--version"]).testo.trim()}`);
console.log(`dichiarato prima della corsa: ${FILE_ATTESI} file × ${LINGUAGGI.length} linguaggi × ${LINGUE.length} lingue = ${COMBINAZIONI_ATTESE}; contratto 1.1: ${FUNZIONI_ATTESE} funzioni × ${LINGUE.length} lingue × 2 = ${DISEGNI_ATTESI} disegni, ${ELENCHI_ATTESI} elenchi con ${VOCI_ATTESE} voci (${VOCI_SENZA_BLOCCO} senza blocco), ${BOLLINI_ATTESI} bollini`);

// --- La costruzione, sempre da capo: verifica l'estratto per impronta e fa nascere il pacchetto di adesso.
rmSync(PACCHETTO, { force: true });
const costruzione = esegui(["bun", "run", "libreria:costruisci"]);
prova("la costruzione, dopo la verifica dell'estratto", costruzione.uscita === 0 && existsSync(PACCHETTO), costruzione.testo);
if (!existsSync(PACCHETTO)) fermo(`il pacchetto non c'è:\n${costruzione.testo}`);
const tipi = esegui([tsc, "-p", join(QUI, "tsconfig.json")]);
prova("tsc sulla prova e sugli attesi", tipi.uscita === 0, tipi.testo);

// Il file della release, dallo zip che la costruzione ha appena verificato nel deposito: il pacchetto in uso deve essere lui.
if (!existsSync(ZIP_DELLA_RELEASE)) fermo(`manca lo zip della release nel deposito: ${ZIP_DELLA_RELEASE}`);
const fileDellaRelease = vocedelloZip(readFileSync(ZIP_DELLA_RELEASE), DESCRIZIONE.file.percorso) ?? fermo(`il file non è nello zip della release: ${DESCRIZIONE.file.percorso}`);
const pacchettoInUso = readFileSync(PACCHETTO);
console.log(`file della release: ${fileDellaRelease.length} byte, impronta ${impronta(fileDellaRelease).slice(0, 12)}; pacchetto in uso: ${pacchettoInUso.length} byte, impronta ${impronta(pacchettoInUso).slice(0, 12)}`);
prova("il file della release, dallo zip del deposito, ha l'impronta dichiarata", impronta(fileDellaRelease) === DESCRIZIONE.file.sha256, impronta(fileDellaRelease));
/** Il verdetto dell'identità, attraversato dal dato vero e dalla sonda. */
const eIlFileDellaRelease = (pacchetto: Buffer): boolean => Buffer.compare(pacchetto, fileDellaRelease) === 0;
prova("il pacchetto provato è il file della release, byte per byte", eIlFileDellaRelease(pacchettoInUso), `${pacchettoInUso.length} contro ${fileDellaRelease.length} byte`);
prova("sonda: il pacchetto con un byte in più non è il file della release", !eIlFileDellaRelease(Buffer.concat([pacchettoInUso, Buffer.from("\n")])));

// --- Il corpus, al commit fissato. L'elenco di git è il riscontro indipendente di ciò che i due lati enumerano dal disco.
const SOTTO = "app/casi/";
const tutti = new TextDecoder().decode(git(repo, "-c", "core.quotepath=off", "ls-tree", "-r", "--name-only", inventario.commit, SOTTO)).split("\n").filter((r) => r !== "");
const algo = tutti.filter((f) => f.endsWith(".algo")).map((f) => f.slice(SOTTO.length, -".algo".length));
const altri = tutti.filter((f) => !f.endsWith(".algo"));
console.log(`corpus al commit: totale ${tutti.length} = ${algo.length} .algo + ${altri.length} esclusi [${altri.join(", ")}]`);
prova(`il corpus al commit ha i file dichiarati`, algo.length === FILE_ATTESI, `${algo.length} contro ${FILE_ATTESI}`);
await new Bun.Archive(git(repo, "archive", "--format=tar", inventario.commit, SOTTO)).extract(cartella);
const corpus = join(cartella, ...SOTTO.split("/"));

// --- I lati, in processi distinti. Un lato che non scrive i suoi file è un fermo: non si è potuto misurare.
type Esiti = Record<string, unknown>;
type Disegno = { globali?: string[] | null; controlli: Esiti; segnalazioni: Esiti; disegni: Esiti };
const leggiEsiti = (file: string): Esiti => JSON.parse(readFileSync(file, "utf8")) as Esiti;
const leggiDisegno = (file: string): Disegno => JSON.parse(readFileSync(file, "utf8")) as Disegno;

function latoAtteso(): { genera: string; disegno: string } {
  const genera = join(cartella, "attesi.json");
  const disegno = join(cartella, "attesi-disegno.json");
  const r = esegui(["bun", ATTESI, corpus, genera, disegno]);
  if (r.uscita !== 0 || !existsSync(genera) || !existsSync(disegno)) fermo(`gli attesi non sono nati, uscita ${r.uscita}:\n${r.testo}`);
  return { genera, disegno };
}
type Lato = { uscita: number; testo: string; genera: string; disegno: string };
/** Un lato Node: `require` o il contesto senza Node; col file del disegno, anche il contratto 1.1. */
function eseguiOttenuto(pacchetto: string, nome: string, modo: "require" | "vm", conDisegno: boolean): Lato {
  const genera = join(cartella, `${nome}.json`);
  const disegno = join(cartella, `${nome}-disegno.json`);
  const r = esegui([node, OTTENUTO, modo, pacchetto, corpus, genera, ...(conDisegno ? [disegno] : [])]);
  return { ...r, genera, disegno };
}
function latoOttenuto(pacchetto: string, nome: string, modo: "require" | "vm", conDisegno: boolean): Lato {
  const l = eseguiOttenuto(pacchetto, nome, modo, conDisegno);
  if (l.uscita !== 0 || !existsSync(l.genera) || (conDisegno && !existsSync(l.disegno))) fermo(`l'ottenuto ${nome} non è nato, uscita ${l.uscita}:\n${l.testo}`);
  return l;
}

const fileDegliAttesi = latoAtteso();
const fileAttesi = fileDegliAttesi.genera;
const attesi = leggiEsiti(fileAttesi);
const attesiD = leggiDisegno(fileDegliAttesi.disegno);
const latoVero = latoOttenuto(PACCHETTO, "ottenuto", "require", true);
const ottenuto = leggiEsiti(latoVero.genera);
const ottenutoD = leggiDisegno(latoVero.disegno);
const latoSenzaNode = latoOttenuto(PACCHETTO, "senza-node", "vm", true);
const senzaNode = leggiEsiti(latoSenzaNode.genera);
const senzaNodeD = leggiDisegno(latoSenzaNode.disegno);

// --- Il confronto: gli elementi nei due versi, e ogni combinazione come oggetto intero. Il conteggio sta accanto.
type Confronto = { soloAttesi: string[]; soloOttenuto: string[]; diverse: string[] };
function confronta(a: Esiti, o: Esiti): Confronto {
  const { soloA: soloAttesi, soloB: soloOttenuto } = differenzeDegliElenchi(Object.keys(a), Object.keys(o));
  const diverse = Object.keys(a).filter((k) => k in o && JSON.stringify(a[k]) !== JSON.stringify(o[k]));
  return { soloAttesi, soloOttenuto, diverse };
}

/** Dove due esiti si separano: una sola regola per testi, disegni e rifiuti, sulla loro forma JSON. */
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
const identici = (c: Confronto): boolean => nessunoDaUnaParte(c) && nessunaDifferenza(c);
const comeSiLegge = (c: Confronto, a: Esiti, o: Esiti): string =>
  `solo negli attesi: ${c.soloAttesi.slice(0, 3).join("; ")}; solo nell'ottenuto: ${c.soloOttenuto.slice(0, 3).join("; ")}; differenze ${c.diverse.length}${c.diverse[0] === undefined ? "" : `: ${primaDifferenza(c.diverse[0], a, o)}`}`;
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

// L'altro lato di `genera`: lo stesso pacchetto senza Node.
const conSenzaNode = confronta(attesi, senzaNode);
console.log(`genera senza Node: ${Object.keys(senzaNode).length} combinazioni, differenze ${conSenzaNode.diverse.length}`);
prova("senza Node, genera: nessuna combinazione da una parte e zero differenze", identici(conSenzaNode), comeSiLegge(conSenzaNode, attesi, senzaNode));

// Le sonde false dei due verdetti che le mutazioni non attraversano. Qui il fatto cercato è la deviazione: inventarle è corretto.
const chiavi = Object.keys(attesi);
const tuttiRifiutati: Esiti = Object.fromEntries(chiavi.map((k) => [k, { generato: false, perche: "errori-statici" }]));
prova("sonda: tutto rifiutato allo stesso modo sui due lati è zero differenze, e il verdetto dei motivi lo vede", nessunaDifferenza(confronta(tuttiRifiutati, tuttiRifiutati)) && motiviDi(tuttiRifiutati).scarti.length > 0);
prova("sonda: una combinazione mancante e una in più, il verdetto dell'elenco le vede", !controIlDichiarato(Object.fromEntries(chiavi.slice(1).map((k) => [k, 0]).concat([["inventata", 0]]))).torna && controIlDichiarato(attesi).torna);

// --- Il contratto 1.1: i denominatori degli attesi, poi l'identità di ciascuna parte sui due lati Node.
type Voce = { numero: string; genere: string; codice: string; blocco: string | null };
const vociDi = (d: Disegno): Voce[] => Object.values(d.segnalazioni).flatMap((v) => (Array.isArray(v) ? (v as Voce[]) : []));
const eccezioniIn = (e: Esiti): number => Object.values(e).filter((v) => (v as { eccezione?: string }).eccezione !== undefined).length;
const funzioniDegliAttesi = Object.keys(attesiD.disegni).length / (LINGUE.length * 2);
console.log(
  `attesi del contratto 1.1: controlli ${Object.keys(attesiD.controlli).length}, elenchi ${Object.keys(attesiD.segnalazioni).length} con ${vociDi(attesiD).length} voci (senza blocco ${vociDi(attesiD).filter((v) => v.blocco === null).length}), disegni ${Object.keys(attesiD.disegni).length} (funzioni ${funzioniDegliAttesi}); eccezioni ${eccezioniIn(attesiD.segnalazioni) + eccezioniIn(attesiD.disegni)}`,
);
prova(
  "attesi del contratto 1.1: i denominatori dichiarati, e nessuna eccezione",
  Object.keys(attesiD.controlli).length === FILE_ATTESI &&
    Object.keys(attesiD.segnalazioni).length === ELENCHI_ATTESI &&
    Object.keys(attesiD.disegni).length === DISEGNI_ATTESI &&
    vociDi(attesiD).length === VOCI_ATTESE &&
    vociDi(attesiD).filter((v) => v.blocco === null).length === VOCI_SENZA_BLOCCO &&
    eccezioniIn(attesiD.segnalazioni) + eccezioniIn(attesiD.disegni) === 0,
);
const PARTI = ["controlli", "segnalazioni", "disegni"] as const;
for (const [nome, d] of [["ottenuto", ottenutoD], ["senza Node", senzaNodeD]] as const)
  for (const parte of PARTI) {
    const c = confronta(attesiD[parte], d[parte]);
    console.log(`${nome}, ${parte}: ${Object.keys(d[parte]).length} voci; solo negli attesi ${c.soloAttesi.length}, solo nell'ottenuto ${c.soloOttenuto.length}, differenze ${c.diverse.length}`);
    prova(`${nome}, ${parte}: nessuna voce da una parte e zero differenze${parte === "disegni" ? " (l'SVG byte per byte)" : ""}`, identici(c), comeSiLegge(c, attesiD[parte], d[parte]));
  }
console.log(`globali visti dal pacchetto senza Node: [${(senzaNodeD.globali ?? []).join(", ")}]`);
prova("senza Node: il contesto non ha process, Buffer, require, global, e ha module", JSON.stringify(senzaNodeD.globali) === JSON.stringify(GLOBALI_SENZA_NODE), JSON.stringify(senzaNodeD.globali));

// --- L'appaiamento dei codici, sull'ottenuto: per ogni file e lingua, i codici delle segnalazioni sono quelli di `controlla`, nei due
// versi e con le ripetizioni (un multiinsieme). Gli elenchi di dettaglio di `controlla` non sono segnalazioni: i codici che portano
// devono stare fra gli errori e gli avvisi dello stesso file.
type Controllo = { errori?: { code: string }[]; avvisi?: { code: string }[] } & Record<string, unknown>;
const contaDi = (codici: string[]): Map<string, number> => codici.reduce((m, c) => m.set(c, (m.get(c) ?? 0) + 1), new Map<string, number>());
function appaiamento(d: Disegno): { coppie: number; spaiati: string[]; numeri: string[]; dettagli: number; dettagliFuori: string[] } {
  let coppie = 0;
  let dettagli = 0;
  const spaiati: string[] = [];
  const numeri: string[] = [];
  const dettagliFuori: string[] = [];
  for (const [k, elenco] of Object.entries(d.segnalazioni)) {
    const nome = k.slice(0, k.lastIndexOf(" "));
    const c = d.controlli[nome] as Controllo;
    const delControllo = contaDi([...(c.errori ?? []), ...(c.avvisi ?? [])].map((x) => x.code));
    if (!Array.isArray(elenco)) {
      spaiati.push(`${k}: l'elenco non c'è (${JSON.stringify(elenco).slice(0, 80)})`);
      continue;
    }
    const delleVoci = contaDi((elenco as Voce[]).map((v) => v.codice));
    for (const codice of new Set([...delControllo.keys(), ...delleVoci.keys()])) {
      const [a, b] = [delControllo.get(codice) ?? 0, delleVoci.get(codice) ?? 0];
      coppie += Math.min(a, b);
      if (a > b) spaiati.push(`${k}: ${codice} solo nel controllo (${a} contro ${b})`);
      if (b > a) spaiati.push(`${k}: ${codice} solo nelle segnalazioni (${b} contro ${a})`);
    }
    for (const v of elenco as Voce[])
      if (!/^[EA]\d{3}$/.test(v.numero) || (v.numero.startsWith("E") ? "errore" : "avviso") !== v.genere) numeri.push(`${k}: ${v.codice} ${v.numero} ${v.genere}`);
  }
  for (const [nome, c] of Object.entries(d.controlli)) {
    const tra = new Set([...((c as Controllo).errori ?? []), ...((c as Controllo).avvisi ?? [])].map((x) => x.code));
    for (const [elenco, voci] of Object.entries(c as Controllo))
      if (elenco !== "errori" && elenco !== "avvisi" && Array.isArray(voci))
        for (const x of voci as { code?: string }[])
          if (x.code !== undefined) {
            dettagli++;
            if (!tra.has(x.code)) dettagliFuori.push(`${nome} ${elenco}: ${x.code}`);
          }
  }
  return { coppie, spaiati, numeri, dettagli, dettagliFuori };
}
const app = appaiamento(ottenutoD);
console.log(`appaiamento: coppie ${app.coppie} (dichiarate ${VOCI_ATTESE}), spaiati ${app.spaiati.length}; numeri sbagliati ${app.numeri.length}; codici nei dettagli ${app.dettagli} (dichiarati ${DETTAGLI_COL_CODICE}), fuori ${app.dettagliFuori.length}`);
prova("appaiamento: i codici delle segnalazioni sono quelli di controlla, file per file e lingua per lingua, nei due versi", app.spaiati.length === 0 && app.coppie === VOCI_ATTESE, app.spaiati.slice(0, 5).join("; "));
prova("appaiamento: ogni voce ha un numero E o A di tre cifre, col genere che il numero dice", app.numeri.length === 0, app.numeri.slice(0, 5).join("; "));
prova("appaiamento: i codici degli elenchi di dettaglio stanno fra gli errori e gli avvisi del file", app.dettagliFuori.length === 0 && app.dettagli === DETTAGLI_COL_CODICE, `${app.dettagli}; ${app.dettagliFuori.join("; ")}`);

// --- I bollini, sull'ottenuto: nei disegni coi bollini, i blocchi segnalati sono quelli delle segnalazioni, nei due versi, col segno
// («errore» vince) e i codici nell'ordine dell'elenco, senza ripetizioni. Senza `errori` nessun bollino, e coi bollini l'SVG cambia
// solo per loro (tolti i gruppi dei bollini, di cinque righe ciascuno, è quello senza).
const bolliniDi = (svg: string) =>
  [...svg.matchAll(/<g data-bollino="" data-id="([^"]*)" data-segno="(errore|avviso)" data-codici="([^"]*)">/g)].map((m) => ({ id: m[1]!, segno: m[2]!, codici: m[3]! }));
function attesiDalle(voci: readonly Voce[]): Map<string, string> {
  const m = new Map<string, { segno: string; codici: string[] }>();
  for (const v of voci) {
    if (v.blocco === null) continue;
    const prima = m.get(v.blocco);
    m.set(v.blocco, { segno: prima?.segno === "errore" ? "errore" : v.genere, codici: prima === undefined ? [v.numero] : prima.codici.includes(v.numero) ? prima.codici : [...prima.codici, v.numero] });
  }
  return new Map([...m].map(([id, x]) => [id, `${x.segno} ${x.codici.join(" ")}`]));
}
function bollini(d: Disegno): { visti: number; spaiati: string[]; senzaErrori: number; altroCambiato: string[] } {
  let visti = 0;
  let senzaErrori = 0;
  const spaiati: string[] = [];
  const altroCambiato: string[] = [];
  const perElenco = new Map<string, Map<string, string>>();
  for (const [k, v] of Object.entries(d.disegni)) {
    const parti = k.split(" ");
    const [variante, lingua] = [parti.at(-1)!, parti.at(-2)!];
    const nome = parti.slice(0, -3).join(" ");
    const svg = (v as { svg?: string }).svg ?? "";
    if (variante === "senza") {
      senzaErrori += bolliniDi(svg).length;
      continue;
    }
    const qui = bolliniDi(svg);
    visti += qui.length;
    const elenco = perElenco.get(`${nome} ${lingua}`) ?? new Map<string, string>();
    for (const b of qui) elenco.set(b.id, `${b.segno} ${b.codici}`);
    perElenco.set(`${nome} ${lingua}`, elenco);
    const senza = (d.disegni[`${parti.slice(0, -1).join(" ")} senza`] as { svg?: string } | undefined)?.svg;
    if (svg.replace(/<g data-bollino=""[^\n]*\n[^\n]*\n[^\n]*\n[^\n]*\n<\/g>\n/g, "") !== senza) altroCambiato.push(k);
  }
  for (const [k, voci] of Object.entries(d.segnalazioni)) {
    const attesi = attesiDalle(Array.isArray(voci) ? (voci as Voce[]) : []);
    const qui = perElenco.get(k) ?? new Map<string, string>();
    for (const id of new Set([...attesi.keys(), ...qui.keys()])) if (attesi.get(id) !== qui.get(id)) spaiati.push(`${k} ${id}: dalle segnalazioni ${attesi.get(id) ?? "nessuno"}, nel disegno ${qui.get(id) ?? "nessuno"}`);
  }
  return { visti, spaiati, senzaErrori, altroCambiato };
}
const bol = bollini(ottenutoD);
console.log(`bollini: ${bol.visti} nei disegni (dichiarati ${BOLLINI_ATTESI}), spaiati ${bol.spaiati.length}; nei disegni senza errori ${bol.senzaErrori}; disegni che cambiano oltre i bollini ${bol.altroCambiato.length}`);
prova("bollini: i blocchi segnalati del disegno sono quelli delle segnalazioni, nei due versi, col segno e i codici", bol.spaiati.length === 0 && bol.visti === BOLLINI_ATTESI, bol.spaiati.slice(0, 5).join("; "));
prova("bollini: senza errori nessun bollino, e coi bollini l'SVG cambia solo per loro", bol.senzaErrori === 0 && bol.altroCambiato.length === 0, `${bol.senzaErrori}; ${bol.altroCambiato.slice(0, 3).join("; ")}`);

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
const indiceDi = (k: string, esiti: Esiti): number => {
  const i = Object.keys(esiti).indexOf(k);
  if (i < 0) fermo(`la combinazione colpita non c'è: ${k}`);
  return i;
};

/** Una copia del pacchetto in cui la chiamata numero `indice` di una funzione passa per `altera`. L'ordine è quello del lato Node,
 *  che chiama ogni funzione nell'ordine delle chiavi che scrive. */
function pacchettoAlterato(nome: string, funzione: "genera" | "disegna" | "segnalazioni", indice: number, altera: string): string {
  const copia = join(cartella, `${nome}.cjs`);
  copyFileSync(PACCHETTO, copia);
  appendFileSync(copia, `\n{ const vera = module.exports.${funzione}; let n = 0; module.exports = { ...module.exports, ${funzione}: (...a) => { const g = vera(...a); return n++ === ${indice} ? (${altera})(g) : g; } }; }\n`);
  return copia;
}

/** Il rosso deve nominare esattamente la combinazione attesa, in una delle tre liste e vuote le altre due. */
function sensibile(nome: string, c: Confronto, lista: keyof Confronto, k: string): void {
  const ok = !(nessunoDaUnaParte(c) && nessunaDifferenza(c)) && c[lista].join() === k && (Object.keys(c) as (keyof Confronto)[]).filter((l) => l !== lista).every((l) => c[l].length === 0);
  prova(`mutazione: ${nome} → rosso su ${k}`, ok, JSON.stringify({ soloAttesi: c.soloAttesi.slice(0, 3), soloOttenuto: c.soloOttenuto.slice(0, 3), diverse: c.diverse.slice(0, 3), quante: c.diverse.length }));
}

const conTesto = leggiEsiti(latoOttenuto(pacchettoAlterato("un-carattere", "genera", indiceDi(COLPITA_TESTO, ottenuto), `(g) => ({ ...g, testo: (g.testo[0] === "x" ? "y" : "x") + g.testo.slice(1) })`), "ottenuto-un-carattere", "require", false).genera);
const cTesto = confronta(attesi, conTesto);
sensibile("il pacchetto cambia un carattere del testo", cTesto, "diverse", COLPITA_TESTO);
if (cTesto.diverse[0] !== undefined) console.log(`      come si legge: ${primaDifferenza(cTesto.diverse[0], attesi, conTesto)}`);

const conRifiuto = leggiEsiti(latoOttenuto(pacchettoAlterato("mancanze", "genera", indiceDi(COLPITA_RIFIUTO, ottenuto), `(g) => ({ ...g, mancanze: g.mancanze.slice(1) })`), "ottenuto-mancanze", "require", false).genera);
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
const fileOttenuto = latoVero.genera;
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

// Il contratto 1.1. Un carattere dell'SVG di un disegno, dentro il pacchetto: il rosso nomina quel disegno.
const conDisegno = leggiDisegno(latoOttenuto(pacchettoAlterato("un-carattere-del-disegno", "disegna", indiceDi(COLPITO_DISEGNO, ottenutoD.disegni), `(g) => ({ ...g, svg: g.svg.replace("<svg ", "<svg  ") })`), "ottenuto-disegno", "require", true).disegno);
sensibile("il pacchetto cambia un carattere dell'SVG", confronta(attesiD.disegni, conDisegno.disegni), "diverse", COLPITO_DISEGNO);

// Una segnalazione tolta dentro il pacchetto: l'identità la nomina, l'appaiamento nomina il codice, i bollini il blocco.
const senzaUnaVoce = leggiDisegno(
  latoOttenuto(pacchettoAlterato("senza-una-voce", "segnalazioni", indiceDi(COLPITO_ELENCO, ottenutoD.segnalazioni), `(g) => g.filter((v) => v.codice !== ${JSON.stringify(CODICE_COLPITO)})`), "ottenuto-senza-una-voce", "require", true).disegno,
);
sensibile("il pacchetto toglie una segnalazione", confronta(attesiD.segnalazioni, senzaUnaVoce.segnalazioni), "diverse", COLPITO_ELENCO);
const appSenza = appaiamento(senzaUnaVoce);
prova(`mutazione: la segnalazione tolta → l'appaiamento nomina ${CODICE_COLPITO} in ${COLPITO_ELENCO}, e nient'altro`, appSenza.spaiati.length === 1 && appSenza.spaiati[0]!.startsWith(`${COLPITO_ELENCO}: ${CODICE_COLPITO} solo nel controllo`), appSenza.spaiati.join("; "));
const bolSenza = bollini(senzaUnaVoce);
prova(`mutazione: la segnalazione tolta → i bollini nominano il blocco ${BLOCCO_COLPITO} in ${COLPITO_ELENCO}, e nient'altro`, bolSenza.spaiati.length === 1 && bolSenza.spaiati[0]!.startsWith(`${COLPITO_ELENCO} ${BLOCCO_COLPITO}:`), bolSenza.spaiati.join("; "));

// Un codice in più, su una copia dell'ottenuto: l'appaiamento lo nomina.
const conUnCodice = structuredClone(ottenutoD);
const voceInPiu = { ...(conUnCodice.segnalazioni[COLPITO_ELENCO] as Voce[])[0]!, codice: "codice_inventato" };
(conUnCodice.segnalazioni[COLPITO_ELENCO] as Voce[]).push(voceInPiu);
const appInPiu = appaiamento(conUnCodice);
prova(`mutazione: un codice in più nelle segnalazioni → l'appaiamento lo nomina in ${COLPITO_ELENCO}, e nient'altro`, appInPiu.spaiati.length === 1 && appInPiu.spaiati[0]!.startsWith(`${COLPITO_ELENCO}: codice_inventato solo nelle segnalazioni`), appInPiu.spaiati.join("; "));

// Il controllo positivo del contesto senza Node: una riga che usa un globale di Node in testa al pacchetto non si carica.
const caricamenti = ["process.env", "Buffer.from", "require", "global.x"].map((globale) => {
  const copia = join(cartella, `con-${globale.replace(/\W/g, "-")}.cjs`);
  writeFileSync(copia, `void ${globale};\n${readFileSync(PACCHETTO, "utf8")}`);
  const r = eseguiOttenuto(copia, `globale-${globale.replace(/\W/g, "-")}`, "vm", true);
  const nome = globale.split(".")[0]!;
  console.log(`controllo positivo senza Node, ${globale}: uscita ${r.uscita}, ${r.testo.includes("ReferenceError") && r.testo.includes(nome) ? "ReferenceError col nome" : "altro"}`);
  return r.uscita !== 0 && r.testo.includes("ReferenceError") && r.testo.includes(`${nome} is not defined`);
});
prova("controllo positivo senza Node: process, Buffer, require, global in testa al pacchetto danno ReferenceError col nome", caricamenti.every((x) => x), JSON.stringify(caricamenti));

console.log(`prove: ${fatte}/${PROVE_ATTESE}, fallite ${fallite.length}`);
if (fatte !== PROVE_ATTESE) {
  console.log(`FERMO: il denominatore non torna: dichiarate ${PROVE_ATTESE}, eseguite ${fatte}`);
  process.exit(2);
}
console.log(`ESITO: ${fallite.length === 0 ? "VERDE" : "ROSSO"}`);
process.exit(fallite.length === 0 ? 0 : 1);

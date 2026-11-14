// La prova dell'estensione: costruisce il pacchetto, ne guarda il contenuto e prova la logica, senza aprire nulla. Con `--finestra` apre
// l'editor installato per pochi secondi, e la finestra prende la tastiera: si lancia solo quando serve, avvisando prima.
//
//   bun collaudo/algo/prova.ts              atteso: ESITO: VERDE, prove N/N
//   bun collaudo/algo/prova.ts --finestra   atteso: lo stesso, con le prove nell'editor
//   bun collaudo/algo/prova.ts --unita <cartella>   atteso: lo stesso, nell'editor di quella cartella e con l'estensione installata lì
//
// Uscite: 0 verde, 1 rosso, 2 fermo (non si è potuto misurare).
//
// Che cosa NON guarda:
// - l'identità su tutto il corpus: è la prova di conformità, e qui si controlla che il pacchetto dentro l'estensione sia lo stesso file;
// - un valore di linguaggio o di lingua scritto a mano nelle impostazioni, fuori dall'elenco del manifesto: nell'editor no, l'errore col nome lo prova la logica;
// - l'aggiornamento del documento senza rilanciare il comando, che non c'è;
// - la condizione del comando nella palette: chiama il comando direttamente, e quella condizione distingue le maiuscole (`.ALGO` non lo vede);
// - un altro editor derivato: gira su quello installato sulla macchina, o su quello dato con `--unita`;
// - la costruzione in una radice con spazi doppi: gli spazi doppi stanno nelle cartelle temporanee, non nel repository;
// - il primo piano del sistema: lo misura e lo stampa, non è un verde né un rosso. Il fuoco dentro l'editor invece è una prova.

import { dlopen, FFIType } from "bun:ffi";
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { inflateRawSync } from "node:zlib";
import { documento, testoDelRifiuto, type Libreria, type Rifiuto } from "../../extensions/algo/src/documento";
import { differenzeDegliElenchi, fermo, fermoSeEtichettaSpostata, git, impronta, INVENTARIO, leggiInventario, RADICE, repoDelNucleo } from "../../ricetta/nucleo/comune";

const POSIZIONE_UNITA = process.argv.indexOf("--unita");
const UNITA = POSIZIONE_UNITA >= 0 ? (process.argv[POSIZIONE_UNITA + 1] ?? fermo("--unita vuole la cartella")) : undefined;
const CON_FINESTRA = process.argv.includes("--finestra") || UNITA !== undefined;

/** I denominatori, dichiarati prima della corsa: le chiamate a `prova` senza finestra, più le 19 della finestra, più le 2 dell'unità. */
const PROVE_SENZA_FINESTRA = 33;
const PROVE_CON_FINESTRA = 52;
const PROVE_NELL_UNITA = 54;
const TEST_ATTESI = 15;

/** Ciò che il pacchetto contiene, e nient'altro. */
const NEL_PACCHETTO = ["[Content_Types].xml", "extension.vsixmanifest", "extension/LICENSE.txt", "extension/LICENZA-ALGODESIGN.txt", "extension/dist/extension.cjs", "extension/dist/libreria.cjs", "extension/icona.png", "extension/package.json"];
/** L'icona di AlgoDesign, nel repository del nucleo: l'estensione ne porta una copia, che deve essere lo stesso file. */
const ICONA_NEL_NUCLEO = "app/shell/icons/128x128.png";
const IMPORT_ATTESI = ["./libreria.cjs", "vscode"];
const PERCORSO_ASSOLUTO = /(?<![A-Za-z])[A-Za-z]:[\\/]/;
/** Stringhe che nel pacchetto non devono esserci: il nome e la struttura del repo ospite (come le conta il controllo di confine sui
 *  sorgenti), e il motore con cui si costruisce. */
const VIETATE = [/my[-_\s]*dev/i, /ricetta[\\/]/, /estratto[\\/]/, /collaudo[\\/]/, /bun:/, /Bun\./];

/** Un file vero del corpus, e le combinazioni che la finestra guarda: un testo in due lingue, e un rifiuto. */
const FILE = "tappa-1/arrotonda-meta";
const CASI = [["python", "en"], ["python", "it"], ["accademico", "en"]] as const;

const ESTENSIONE = join(RADICE, "extensions", "algo");
const VSIX = join(ESTENSIONE, "dist", "algo-codice.vsix");
const LIBRERIA = join(RADICE, "extensions", "libreria", "dist", "libreria.cjs");
const CONFORMITA_ATTESI = join(RADICE, "collaudo", "conformita", "attesi.ts");

const cartella = mkdtempSync(join(tmpdir(), "algo  prova-"));
process.on("exit", () => rmSync(cartella, { recursive: true, force: true }));

let fatte = 0;
const fallite: string[] = [];
function prova(nome: string, buona: boolean, dettaglio = ""): void {
  fatte++;
  console.log(`${buona ? "PASS" : "FAIL"}  ${nome}${buona ? "" : `\n      ${dettaglio}`}`);
  if (!buona) fallite.push(nome);
}

function esegui(comando: string[], cwd = RADICE): { uscita: number; testo: string } {
  const p = Bun.spawnSync(comando, { cwd, stdout: "pipe", stderr: "pipe" });
  return { uscita: p.exitCode, testo: `${p.stdout.toString()}${p.stderr.toString()}` };
}

/** Le voci di uno zip lette dal suo indice in coda al file, coi contenuti: il nome di ogni file (le cartelle no) e i suoi byte. Uno
 *  zip che non si legge è un'eccezione, con il motivo. */
function vociDelloZip(archivio: Uint8Array): Map<string, Uint8Array> {
  const z = Buffer.from(archivio.buffer, archivio.byteOffset, archivio.byteLength);
  let fine = z.length - 22;
  while (fine >= Math.max(0, z.length - 22 - 0xffff) && z.readUInt32LE(fine) !== 0x06054b50) fine--;
  if (fine < 0 || z.readUInt32LE(fine) !== 0x06054b50) throw new Error("manca la fine dell'indice");
  const quante = z.readUInt16LE(fine + 10);
  const voci = new Map<string, Uint8Array>();
  let p = z.readUInt32LE(fine + 16);
  for (let i = 0; i < quante; i++) {
    if (z.readUInt32LE(p) !== 0x02014b50) throw new Error(`voce ${i} dell'indice senza la sua firma`);
    const lunghezzaNome = z.readUInt16LE(p + 28);
    const nome = z.toString("utf8", p + 46, p + 46 + lunghezzaNome);
    const testata = z.readUInt32LE(p + 42);
    if (z.readUInt32LE(testata) !== 0x04034b50) throw new Error(`${nome}: testata locale senza la sua firma`);
    const inizio = testata + 30 + z.readUInt16LE(testata + 26) + z.readUInt16LE(testata + 28);
    const dati = z.subarray(inizio, inizio + z.readUInt32LE(p + 20));
    const metodo = z.readUInt16LE(p + 10);
    if (metodo !== 0 && metodo !== 8) throw new Error(`${nome}: metodo di compressione sconosciuto ${metodo}`);
    if (voci.has(nome)) throw new Error(`${nome}: voce ripetuta nell'indice`);
    if (!nome.endsWith("/")) voci.set(nome, metodo === 0 ? new Uint8Array(dati) : new Uint8Array(inflateRawSync(dati)));
    p += 46 + lunghezzaNome + z.readUInt16LE(p + 30) + z.readUInt16LE(p + 32);
  }
  return voci;
}

/** Uno zip senza compressione con le voci date: serve solo a comporre le mutazioni del pacchetto della release. */
function zipDi(voci: ReadonlyMap<string, Uint8Array>): Buffer {
  const locali: Buffer[] = [];
  const indice: Buffer[] = [];
  let posizione = 0;
  for (const [nome, dati] of voci) {
    const n = Buffer.from(nome, "utf8");
    const crc = Bun.hash.crc32(dati);
    const l = Buffer.alloc(30);
    l.writeUInt32LE(0x04034b50, 0);
    l.writeUInt16LE(20, 4);
    l.writeUInt32LE(crc, 14);
    l.writeUInt32LE(dati.length, 18);
    l.writeUInt32LE(dati.length, 22);
    l.writeUInt16LE(n.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0);
    c.writeUInt16LE(20, 4);
    c.writeUInt16LE(20, 6);
    c.writeUInt32LE(crc, 16);
    c.writeUInt32LE(dati.length, 20);
    c.writeUInt32LE(dati.length, 24);
    c.writeUInt16LE(n.length, 28);
    c.writeUInt32LE(posizione, 42);
    locali.push(l, n, Buffer.from(dati));
    indice.push(c, n);
    posizione += 30 + n.length + dati.length;
  }
  const grandezzaIndice = indice.reduce((s, b) => s + b.length, 0);
  const e = Buffer.alloc(22);
  e.writeUInt32LE(0x06054b50, 0);
  e.writeUInt16LE(voci.size, 8);
  e.writeUInt16LE(voci.size, 10);
  e.writeUInt32LE(grandezzaIndice, 12);
  e.writeUInt32LE(posizione, 16);
  return Buffer.concat([...locali, ...indice, e]);
}

const tsc = Bun.which("tsc", { PATH: join(RADICE, "node_modules", ".bin") }) ?? fermo("tsc non c'è: bun install alla radice");
// Quello di sistema: il `tar` che una shell può trovare prima non sa leggere uno zip.
const tar = join(process.env.SystemRoot ?? fermo("manca SystemRoot"), "System32", "tar.exe");
if (!existsSync(tar)) fermo(`non c'è ${tar}: serve per aprire il pacchetto`);

// --- La costruzione, sempre da capo, e i tipi.
rmSync(join(ESTENSIONE, "dist"), { recursive: true, force: true });
const costruzione = esegui(["bun", "run", "algo:costruisci"]);
prova("la costruzione: libreria, estensione, pacchetto", costruzione.uscita === 0 && existsSync(VSIX), costruzione.testo);
if (!existsSync(VSIX)) fermo(`il pacchetto non c'è:\n${costruzione.testo}`);
console.log(`pacchetto: ${readFileSync(VSIX).length} byte`);
for (const conf of [join(ESTENSIONE, "tsconfig.json"), join(RADICE, "collaudo", "algo", "tsconfig.json")]) {
  const t = esegui([tsc, "-p", conf]);
  prova(`tsc su ${conf.includes("collaudo") ? "la prova" : "l'estensione"}`, t.uscita === 0, t.testo);
}

// --- La logica. L'esito si legge dal rapporto che il programma scrive, non dalla sola uscita.
const rapporto = join(cartella, "test.xml");
const test = esegui(["bun", "test", "./collaudo/algo/documento.test.ts", "--reporter=junit", `--reporter-outfile=${rapporto}`]);
if (!existsSync(rapporto)) fermo(`bun test non ha scritto il rapporto, uscita ${test.uscita}:\n${test.testo}`);
const radiceDelRapporto = /<testsuites\b[^>]*>/.exec(readFileSync(rapporto, "utf8"))?.[0] ?? "";
const numero = (nome: string) => Number(new RegExp(`\\b${nome}="(\\d+)"`).exec(radiceDelRapporto)?.[1] ?? "-1");
console.log(`logica: ${numero("tests")} prove, fallite ${numero("failures")}, saltate ${numero("skipped")}; dichiarate ${TEST_ATTESI}`);
// `tests` conta anche quelle saltate: una prova saltata non è una prova passata.
prova("la logica, senza editor", test.uscita === 0 && numero("tests") === TEST_ATTESI && numero("failures") === 0 && numero("skipped") === 0, test.testo);

// --- Il pacchetto da fuori: estratto in una cartella con spazi doppi.
const estratto = join(cartella, "estratto  dal pacchetto");
mkdirSync(estratto);
const elencoTar = esegui([tar, "-tf", VSIX]);
const estrazione = esegui([tar, "-xf", VSIX, "-C", estratto]);
if (elencoTar.uscita !== 0 || estrazione.uscita !== 0) fermo(`il pacchetto non si apre:\n${elencoTar.testo}\n${estrazione.testo}`);
const contenuto = elencoTar.testo.split(/\r?\n/).filter((r) => r !== "" && !r.endsWith("/"));

const scarti = (elenco: string[]) => differenzeDegliElenchi(elenco, NEL_PACCHETTO);
const contro = scarti(contenuto);
console.log(`nel pacchetto: ${contenuto.length} file; attesi ${NEL_PACCHETTO.length}; in più ${contro.soloA.length}, mancanti ${contro.soloB.length}`);
prova("il pacchetto contiene esattamente i file attesi", contro.soloA.length === 0 && contro.soloB.length === 0, `in più: ${contro.soloA.join(", ")}; mancanti: ${contro.soloB.join(", ")}`);

const copiaNelPacchetto = join(estratto, "extension", "dist", "libreria.cjs");
const stessoFile = (a: string, b: string): boolean => impronta(readFileSync(a)) === impronta(readFileSync(b));
console.log(`libreria nel pacchetto: ${impronta(readFileSync(copiaNelPacchetto)).slice(0, 12)}; provata dalla conformità: ${impronta(readFileSync(LIBRERIA)).slice(0, 12)}`);
prova("la libreria nel pacchetto è lo stesso file che la conformità prova", stessoFile(copiaNelPacchetto, LIBRERIA));

// Le licenze: la nostra uguale a quella del repository, quella del nucleo uguale a quella che accompagna il file della release.
const datiDelNucleo = JSON.parse(readFileSync(join(RADICE, "ricetta", "nucleo", "pacchetto.json"), "utf8")) as { zip: { nome: string }; file: { percorso: string } };
const licenzaDelNucleo = join(cartella, "licenza del nucleo");
mkdirSync(licenzaDelNucleo);
const voceLicenza = `${dirname(datiDelNucleo.file.percorso)}/LICENSE`;
const apertura = esegui([tar, "-xf", join(RADICE, "ricetta", "nucleo", "scaricato", datiDelNucleo.zip.nome), "-C", licenzaDelNucleo, voceLicenza]);
if (apertura.uscita !== 0) fermo(`la licenza del nucleo non si estrae:\n${apertura.testo}`);
// Un testo che manca è un rosso di questa prova, non un'eccezione.
const stessoTesto = (nome: string, atteso: string): boolean => existsSync(join(estratto, "extension", nome)) && stessoFile(join(estratto, "extension", nome), atteso);
prova("i testi delle licenze sono quelli del repository e del file della release", stessoTesto("LICENSE.txt", join(RADICE, "LICENSE")) && stessoTesto("LICENZA-ALGODESIGN.txt", join(licenzaDelNucleo, voceLicenza)));

const colpiIn = (testo: string): string[] => [PERCORSO_ASSOLUTO, ...VIETATE].flatMap((rx) => rx.exec(testo)?.[0] ?? []);

// Il lettore dello zip di questa prova contro il `tar` di sistema, sul pacchetto costruito: lo stesso elenco nei due versi, e ogni voce
// con i byte del file estratto. È il controllo che il lettore usato sul pacchetto della release veda ciò che c'è.
const vociDelCostruito = vociDelloZip(readFileSync(VSIX));
const lettoreContro = differenzeDegliElenchi(vociDelCostruito.keys(), contenuto);
const lettoreDiverse = [...vociDelCostruito].filter(([v, d]) => !existsSync(join(estratto, v)) || impronta(d) !== impronta(readFileSync(join(estratto, v)))).map(([v]) => v);
console.log(`lettore dello zip sul pacchetto costruito: ${vociDelCostruito.size} voci, tar ${contenuto.length}; solo nel lettore ${lettoreContro.soloA.length}, solo nel tar ${lettoreContro.soloB.length}, byte diversi ${lettoreDiverse.length}`);
prova("il lettore dello zip vede il pacchetto costruito come il tar di sistema: stesso elenco, stessi byte", vociDelCostruito.size > 0 && lettoreContro.soloA.length + lettoreContro.soloB.length + lettoreDiverse.length === 0, `solo nel lettore: ${lettoreContro.soloA.join(", ")}; solo nel tar: ${lettoreContro.soloB.join(", ")}; diversi: ${lettoreDiverse.join(", ")}`);

// Il pacchetto della release, quello che la ricetta installa nell'unità: byte e impronta della sua voce, l'elenco delle voci contro
// quello atteso nei due versi, il contenuto uguale, voce per voce, al pacchetto costruito ora dai sorgenti (le date dello zip cambiano
// a ogni costruzione, il contenuto no), e i cercatori di percorsi assoluti e stringhe vietate su ogni sua voce di testo. Si prende da
// extensions/algo/scaricato/ (ignorata) o dalla fonte; un'impronta sbagliata è un rosso, e il file scaricato non vi entra.
type VoceRelease = { nome: string; stato: string; fonte: string; file: string; byte: number; sha256: string };
const voceRelease = (JSON.parse(readFileSync(join(RADICE, "ricetta", "componenti.json"), "utf8")) as { nostri: VoceRelease[] }).nostri.find((v) => v.nome === "estensione-algo" && v.stato === "release") ?? fermo("in ricetta/componenti.json non c'è la voce estensione-algo con stato release");
const fileRelease = join(ESTENSIONE, "scaricato", voceRelease.file);
let release: Buffer;
if (existsSync(fileRelease)) release = readFileSync(fileRelease);
else {
  try {
    const r = await fetch(voceRelease.fonte);
    if (!r.ok) fermo(`non si è potuto scaricare ${voceRelease.fonte}: risposta ${r.status}; prima della release il file si copia in ${fileRelease} dal deposito dell'unità`);
    release = Buffer.from(await r.arrayBuffer());
  } catch (e) {
    fermo(`non si è potuto scaricare ${voceRelease.fonte}: ${e instanceof Error ? e.message : String(e)}`);
  }
  if (impronta(release) === voceRelease.sha256) {
    mkdirSync(dirname(fileRelease), { recursive: true });
    writeFileSync(fileRelease, release);
  }
}
type Attesa = { byte: number; sha256: string };
/** Il verdetto sul pacchetto della release: una funzione sola, per il vero e per le mutazioni. Vuoto è verde; ogni motivo nomina la voce. */
function motiviDellaRelease(pacchetto: Uint8Array, attesa: Attesa, costruito: string): string[] {
  const motivi: string[] = [];
  if (pacchetto.length !== attesa.byte) motivi.push(`byte ${pacchetto.length}, nella ricetta ${attesa.byte}`);
  if (impronta(pacchetto) !== attesa.sha256) motivi.push(`impronta ${impronta(pacchetto).slice(0, 12)}, nella ricetta ${attesa.sha256.slice(0, 12)}`);
  let voci: Map<string, Uint8Array>;
  try {
    voci = vociDelloZip(pacchetto);
  } catch (e) {
    return [...motivi, `lo zip non si legge: ${e instanceof Error ? e.message : String(e)}`];
  }
  const elenco = scarti([...voci.keys()]);
  for (const v of elenco.soloA) motivi.push(`voce in più: ${v}`);
  for (const v of elenco.soloB) motivi.push(`voce mancante: ${v}`);
  for (const v of NEL_PACCHETTO) {
    const d = voci.get(v);
    if (d !== undefined && (!existsSync(join(costruito, v)) || impronta(d) !== impronta(readFileSync(join(costruito, v))))) motivi.push(`contenuto diverso da quello costruito: ${v}`);
  }
  // Ogni voce tranne l'icona, che è un'immagine confrontata qui sopra per contenuto: anche le voci in più.
  for (const [v, d] of voci) if (v !== "extension/icona.png") for (const c of colpiIn(Buffer.from(d).toString("utf8"))) motivi.push(`${v}: ${c}`);
  return motivi;
}
const vociRelease = (() => {
  try {
    return vociDelloZip(release);
  } catch (e) {
    return fermo(`il pacchetto della release non si legge: ${e instanceof Error ? e.message : String(e)}`);
  }
})();
const motiviVeri = motiviDellaRelease(release, voceRelease, estratto);
const elencoRelease = scarti([...vociRelease.keys()]);
console.log(`pacchetto della release: ${release.length} byte, impronta ${impronta(release).slice(0, 12)}; nella ricetta ${voceRelease.byte} byte, ${voceRelease.sha256.slice(0, 12)}; voci ${vociRelease.size}, attese ${NEL_PACCHETTO.length}, in più ${elencoRelease.soloA.length}, mancanti ${elencoRelease.soloB.length}; voci di testo guardate dai cercatori ${[...vociRelease.keys()].filter((v) => v !== "extension/icona.png").length}; motivi ${motiviVeri.length}`);
prova("il pacchetto della release: byte e impronta della ricetta, le voci attese nei due versi, il contenuto di quello costruito, nessun percorso assoluto né stringa vietata", motiviVeri.length === 0, motiviVeri.join("; "));

// Le mutazioni del verdetto, su copie del pacchetto della release: ognuna deve dare rosso col suo motivo, e lei solo. Uno zip ricomposto
// porta byte e impronta propri nell'attesa, come se la ricetta li avesse scritti dal file caricato: resta solo ciò che è mutato.
const attesaDi = (b: Uint8Array): Attesa => ({ byte: b.length, sha256: impronta(b) });
const ricomposto = (cambia: (m: Map<string, Uint8Array>) => number): { zip: Buffer; toccate: number } => {
  const m = new Map(vociRelease);
  const toccate = cambia(m);
  return { zip: zipDi(m), toccate };
};
function mutazione(nome: string, zip: Uint8Array, toccate: number, attesa: Attesa, buona: (motivi: string[]) => boolean): void {
  const motivi = motiviDellaRelease(zip, attesa, estratto);
  console.log(`  ${nome}: toccate ${toccate}, motivi ${motivi.length}: ${motivi.join("; ")}`);
  prova(`mutazione della release: ${nome}`, toccate > 0 && buona(motivi), `toccate ${toccate}; motivi: ${motivi.join("; ")}`);
}
const tale = (attesi: string[]) => (motivi: string[]): boolean => motivi.length === attesi.length && attesi.every((a, i) => motivi[i] === a);
const intatto = ricomposto(() => 0);
const motiviIntatto = motiviDellaRelease(intatto.zip, attesaDi(intatto.zip), estratto);
console.log(`  ricomposto senza mutazioni: ${intatto.zip.length} byte, voci ${vociDelloZip(intatto.zip).size}, motivi ${motiviIntatto.length}`);
prova("controllo: il pacchetto della release ricomposto senza mutazioni è verde", motiviIntatto.length === 0 && vociDelloZip(intatto.zip).size === vociRelease.size, motiviIntatto.join("; "));
const EXTRA = "extension/dist/extra.cjs";
const inPiu = ricomposto((m) => (m.set(EXTRA, new TextEncoder().encode("module.exports = 1;\n")), 1));
mutazione("una voce in più", inPiu.zip, inPiu.toccate, attesaDi(inPiu.zip), tale([`voce in più: ${EXTRA}`]));
const senza = ricomposto((m) => Number(m.delete("extension/LICENSE.txt")));
mutazione("una voce mancante", senza.zip, senza.toccate, attesaDi(senza.zip), tale(["voce mancante: extension/LICENSE.txt"]));
const diverso = ricomposto((m) => (m.set("extension/package.json", Buffer.concat([m.get("extension/package.json") ?? new Uint8Array(), Buffer.from(" ")])), 1));
mutazione("una voce col contenuto diverso", diverso.zip, diverso.toccate, attesaDi(diverso.zip), tale(["contenuto diverso da quello costruito: extension/package.json"]));
const vietato = ricomposto((m) => (m.set(EXTRA, new TextEncoder().encode(String.raw`module.exports = "C:\MyDev";`)), 1));
mutazione("una voce in più con un percorso assoluto e il nome del progetto", vietato.zip, vietato.toccate, attesaDi(vietato.zip), tale([`voce in più: ${EXTRA}`, `${EXTRA}: C:\\`, `${EXTRA}: MyDev`]));
// Sul file vero, contro la voce vera della ricetta. L'impronta: un bit dell'ora della prima testata locale, che nessun lettore usa, a
// byte uguali. I byte: uno in coda, dove il lettore non guarda.
if (Buffer.from(release.subarray(0, 4)).readUInt32LE(0) !== 0x04034b50) fermo("il pacchetto della release non comincia con una testata locale");
const conAltraImpronta = Buffer.from(release);
conAltraImpronta[10] = conAltraImpronta[10]! ^ 1;
mutazione("un'impronta diversa, a byte uguali", conAltraImpronta, Buffer.compare(conAltraImpronta, release) === 0 ? 0 : 1, voceRelease, tale([`impronta ${impronta(conAltraImpronta).slice(0, 12)}, nella ricetta ${voceRelease.sha256.slice(0, 12)}`]));
const conUnByte = Buffer.concat([release, Buffer.from([0])]);
mutazione("un byte in più", conUnByte, conUnByte.length - release.length, voceRelease, tale([`byte ${release.length + 1}, nella ricetta ${voceRelease.byte}`, `impronta ${impronta(conUnByte).slice(0, 12)}, nella ricetta ${voceRelease.sha256.slice(0, 12)}`]));

// L'icona: lo stesso file di AlgoDesign al commit dell'etichetta, nel pannello e accanto ai file del linguaggio.
const inventarioDelNucleo = leggiInventario(INVENTARIO);
const repoDellIcona = repoDelNucleo(undefined);
fermoSeEtichettaSpostata(repoDellIcona, inventarioDelNucleo);
const iconaDellEtichetta = git(repoDellIcona, "show", `${inventarioDelNucleo.commit}:${ICONA_NEL_NUCLEO}`);
const fileDellIcona = join(estratto, "extension", "icona.png");
// Un pacchetto senza icona è un rosso di questa prova, non un fermo: lo nomina già il confronto degli elenchi.
const iconaNelPacchetto = existsSync(fileDellIcona) ? readFileSync(fileDellIcona) : new Uint8Array();
console.log(`icona nel pacchetto: ${impronta(iconaNelPacchetto).slice(0, 12)}; all'etichetta ${inventarioDelNucleo.etichetta}: ${impronta(iconaDellEtichetta).slice(0, 12)}`);
/** Un'icona è quella dell'etichetta se ha la sua impronta: una funzione sola, per il vero e per la mutazione. */
const stessaIcona = (a: Uint8Array, b: Uint8Array): boolean => impronta(a) === impronta(b);
prova("l'icona è quella di AlgoDesign all'etichetta", stessaIcona(iconaNelPacchetto, iconaDellEtichetta));
type ManifestoDelleIcone = { icon?: string; contributes?: { languages?: { id: string; extensions?: string[]; icon?: { light?: string; dark?: string } }[] } };
/** Il manifesto dà l'icona al pannello e al linguaggio dei file `.algo`, chiaro e scuro: una funzione sola, per il vero e per la mutazione. */
const iconaDichiarata = (m: ManifestoDelleIcone): boolean => {
  const l = m.contributes?.languages?.find((x) => x.extensions?.includes(".algo"));
  return m.icon === "icona.png" && l !== undefined && [l.icon?.light, l.icon?.dark].every((p) => p?.replace(/^\.\//, "") === "icona.png");
};
const manifestoDelleIcone = JSON.parse(readFileSync(join(estratto, "extension", "package.json"), "utf8")) as ManifestoDelleIcone;
prova("il manifesto dà l'icona al pannello e ai file .algo", iconaDichiarata(manifestoDelleIcone), JSON.stringify({ icon: manifestoDelleIcone.icon, languages: manifestoDelleIcone.contributes?.languages }));

// L'icona è un'immagine, non un testo: si confronta per impronta, qui sopra.
const testuali = contenuto.filter((f) => f !== "extension/icona.png");
const colpi = testuali.flatMap((f) => colpiIn(readFileSync(join(estratto, f), "utf8")).map((c) => `${f}: ${c}`));
console.log(`percorsi assoluti e stringhe vietate nel pacchetto: ${colpi.length}, su ${testuali.length} file di testo; l'icona è confrontata per impronta`);
prova("nessun percorso assoluto e nessuna stringa vietata nel pacchetto", colpi.length === 0, colpi.join("; "));

const importDi = (testo: string): string[] => [...new Set(new Bun.Transpiler({ loader: "js" }).scanImports(testo).map((i) => i.path))].sort();
const codice = readFileSync(join(estratto, "extension", "dist", "extension.cjs"), "utf8");
console.log(`import dell'estensione: ${importDi(codice).join(", ")}`);
prova("l'estensione importa solo l'editor e la copia della libreria", importDi(codice).join() === IMPORT_ATTESI.join(), importDi(codice).join(", "));

const manifesto = JSON.parse(readFileSync(join(estratto, "extension", "package.json"), "utf8")) as { license: string; contributes: { configuration: { properties: { "algo.linguaggio": { enum: string[] } } } } };
const vsixManifest = readFileSync(join(estratto, "extension.vsixmanifest"), "utf8");
prova("il manifesto dichiara la licenza e il pacchetto la indica", manifesto.license === "MIT" && vsixManifest.includes("<License>extension/LICENSE.txt</License>"), `${manifesto.license}; ${vsixManifest.slice(0, 300)}`);
const offerti = manifesto.contributes.configuration.properties["algo.linguaggio"].enum;
// Solo qui: la costruzione ha già verificato l'estratto, e senza estratto si ferma prima con un motivo.
const { linguaggi } = await import("../../ricetta/nucleo/estratto/app/core/genera/linguaggi");
const registro = differenzeDegliElenchi(offerti, linguaggi.map((v) => v.id));
console.log(`linguaggi offerti: ${offerti.length}, nel registro ${linguaggi.length}; solo offerti ${registro.soloA.length}, solo nel registro ${registro.soloB.length}`);
prova("l'impostazione offre le voci del registro, elemento per elemento", registro.soloA.length === 0 && registro.soloB.length === 0, `${registro.soloA.join(", ")}; ${registro.soloB.join(", ")}`);

// --- I controlli di sopra devono sapersi accendere: su copie, e su elenchi con una voce in più.
prova("mutazione: un file in più nel pacchetto si vede", scarti([...contenuto, "extension/src/x.ts"]).soloA.join() === "extension/src/x.ts");
prova("mutazione: un file mancante si vede", scarti(contenuto.filter((f) => !f.endsWith("libreria.cjs"))).soloB.join() === "extension/dist/libreria.cjs");
prova("mutazione: una licenza mancante si vede", scarti(contenuto.filter((f) => !f.endsWith("LICENSE.txt"))).soloB.join() === "extension/LICENSE.txt");
const altra = join(cartella, "libreria-alterata.cjs");
copyFileSync(LIBRERIA, altra);
writeFileSync(altra, `${readFileSync(altra, "utf8")}\n// un byte in più\n`);
prova("mutazione: una libreria diversa ha un'altra impronta", !stessoFile(altra, LIBRERIA));
prova("mutazione: un percorso assoluto si vede, con la barra e con la rovescia", colpiIn("x = 'D:/a'").length === 1 && colpiIn(String.raw`x = 'C:\a'`).length === 1);
prova("mutazione: ogni stringa vietata si vede", ["my dev", "MyDev", "my-dev", "my_dev", "ricetta/x", "ricetta\\x", "estratto/x", "estratto\\x", "collaudo/x", "collaudo\\x", "bun:sqlite", "Bun.spawn"].every((s) => colpiIn(s).length === 1));
prova("mutazione: un import in più si vede", importDi(`${codice}\nif (false) require("altro");`).includes("altro"));
prova("mutazione: un'icona diversa non è quella dell'etichetta", !stessaIcona(new Uint8Array([...iconaNelPacchetto, 0]), iconaDellEtichetta));
prova("mutazione: senza l'icona del linguaggio il manifesto non basta", !iconaDichiarata({ ...manifestoDelleIcone, contributes: { languages: [] } }));
prova("mutazione: senza l'icona del pannello il manifesto non basta", !iconaDichiarata({ ...manifestoDelleIcone, icon: undefined }));
prova("mutazione: un'icona solo chiara non basta", !iconaDichiarata({ ...manifestoDelleIcone, contributes: { languages: (manifestoDelleIcone.contributes?.languages ?? []).map((l) => ({ ...l, icon: { light: l.icon?.light } })) } }));

// --- Nell'editor installato.
async function nellEditor(): Promise<void> {
  const eseguibile = UNITA !== undefined ? join(UNITA, "vscodium", "VSCodium.exe") : join(dirname(dirname(Bun.which("code") ?? fermo("code non è nel PATH: serve l'editor installato"))), "Code.exe");
  if (!existsSync(eseguibile)) fermo(`non c'è ${eseguibile}`);
  // Nell'unità si carica la copia installata dal pacchetto, non quella estratta qui.
  const installata = UNITA !== undefined ? join(UNITA, "vscodium", "data", "extensions", "prototipo.algo-codice-0.0.1") : undefined;
  if (installata !== undefined) {
    const nellaCartella = contenuto.filter((f) => f.startsWith("extension/")).map((f) => f.slice("extension/".length));
    // Il manifesto l'editor lo riscrive e ci aggiunge i suoi metadati: si confronta senza.
    const senzaMetadati = (p: string): string => JSON.stringify({ ...(JSON.parse(readFileSync(p, "utf8")) as object), __metadata: undefined });
    const uguali = (f: string): boolean => (f === "package.json" ? senzaMetadati(join(estratto, "extension", f)) === senzaMetadati(join(installata, f)) : stessoFile(join(estratto, "extension", f), join(installata, f)));
    const diversi = nellaCartella.filter((f) => !existsSync(join(installata, f)) || !uguali(f));
    console.log(`estensione installata: ${nellaCartella.length} file confrontati col pacchetto, diversi ${diversi.length}`);
    prova("l'estensione installata è il pacchetto, file per file", nellaCartella.length > 0 && diversi.length === 0, diversi.join(", "));
  }
  const node = Bun.which("node") ?? fermo("node non c'è");

  // Gli attesi, ricalcolati dai sorgenti: lo stesso script della conformità, sul file al commit fissato.
  const inventario = leggiInventario(INVENTARIO);
  const repo = repoDelNucleo(undefined);
  fermoSeEtichettaSpostata(repo, inventario);
  const corpus = join(cartella, "corpus");
  await new Bun.Archive(git(repo, "archive", "--format=tar", inventario.commit, "app/casi/")).extract(corpus);
  const casi = join(corpus, "app", "casi");
  const fileAttesi = join(cartella, "attesi.json");
  const a = esegui(["bun", CONFORMITA_ATTESI, casi, fileAttesi]);
  if (a.uscita !== 0 || !existsSync(fileAttesi)) fermo(`gli attesi non sono nati:\n${a.testo}`);
  const attesi = JSON.parse(readFileSync(fileAttesi, "utf8")) as Record<string, { generato: true; testo: string } | Rifiuto>;
  const attesoDi = (linguaggio: string, lingua: "it" | "en"): string => {
    const e = attesi[`${FILE} ${linguaggio} ${lingua}`] ?? fermo(`manca l'atteso di ${linguaggio} ${lingua}`);
    return e.generato ? e.testo : testoDelRifiuto(e, linguaggio, lingua);
  };

  // Il file in una cartella con spazi doppi.
  const dove = join(cartella, "cartella  con  spazi");
  mkdirSync(dove);
  const fileAlgo = join(dove, "arrotonda-meta.algo");
  copyFileSync(join(casi, ...`${FILE}.algo`.split("/")), fileAlgo);
  const originale = readFileSync(fileAlgo);

  // Il primo piano del sistema, campionato mentre l'editor gira: si misura e si stampa.
  const user32 = dlopen("user32.dll", { GetForegroundWindow: { args: [], returns: FFIType.u64_fast } });
  const davanti = (): unknown => user32.symbols.GetForegroundWindow();
  const prima = davanti();
  const inizio = performance.now();
  let perso: number | undefined;
  let ripreso: number | undefined;
  let campioni = 0;
  const viste = new Set<unknown>([prima]);
  const campiona = setInterval(() => {
    const ora = performance.now() - inizio;
    campioni++;
    viste.add(davanti());
    if (perso === undefined && davanti() !== prima) perso = ora;
    if (perso !== undefined && ripreso === undefined && davanti() === prima) ripreso = ora;
  }, 25);

  const uscita = join(cartella, "esiti.json");
  const dati = join(cartella, "dati  editor");
  // Nell'unità le impostazioni sono quelle di chi la usa: la prova cambia linguaggio e lingua, e le rimette byte per byte
  // a editor chiuso, o la verifica dell'unità direbbe rosso sul file.
  const impostazioniDellUnita = UNITA !== undefined ? join(UNITA, "vscodium", "data", "user-data", "User", "settings.json") : undefined;
  const impostazioniPrima = impostazioniDellUnita !== undefined && existsSync(impostazioniDellUnita) ? readFileSync(impostazioniDellUnita) : undefined;
  // Si rimettono anche se la prova si interrompe (Ctrl+C) o il lancio fallisce; un file che prima non c'era si toglie.
  const rimetti = (): string => {
    if (impostazioniDellUnita === undefined) return "";
    const ora = existsSync(impostazioniDellUnita) ? readFileSync(impostazioniDellUnita) : undefined;
    if (impostazioniPrima === undefined) {
      if (ora === undefined) return "non c'erano, non ci sono";
      rmSync(impostazioniDellUnita);
      return "nate dall'editor, tolte";
    }
    const cambiate = ora === undefined || Buffer.compare(ora, impostazioniPrima) !== 0;
    writeFileSync(impostazioniDellUnita, impostazioniPrima);
    return cambiate ? "cambiate dall'editor, rimesse" : "non cambiate";
  };
  // All'interruzione si ferma prima l'editor, che altrimenti potrebbe riscrivere le impostazioni dopo il ripristino.
  let lanciato: ReturnType<typeof Bun.spawn> | undefined;
  const allInterruzione = (): void => {
    lanciato?.kill();
    void (lanciato?.exited ?? Promise.resolve()).finally(() => {
      rimetti();
      process.exit(2);
    });
  };
  process.once("SIGINT", allInterruzione);
  console.log(UNITA !== undefined ? "APRO L'EDITOR: una finestra per pochi secondi, con i dati dell'unità" : "APRO L'EDITOR: una finestra per pochi secondi, con un profilo temporaneo");
  let fuori = "";
  let errori = "";
  let codiceUscita = -1;
  let statoImpostazioni = "";
  try {
    const figlio = Bun.spawn([node, join(RADICE, "collaudo", "algo", "lancia.cjs"), eseguibile, installata ?? join(estratto, "extension"), fileAlgo, uscita, dati, JSON.stringify(CASI)], { cwd: cartella, stdout: "pipe", stderr: "pipe" });
    lanciato = figlio;
    [fuori, errori] = await Promise.all([new Response(figlio.stdout).text(), new Response(figlio.stderr).text()]);
    codiceUscita = await figlio.exited;
  } finally {
    process.off("SIGINT", allInterruzione);
    clearInterval(campiona);
    user32.close();
    statoImpostazioni = rimetti();
  }
  const durata = performance.now() - inizio;
  if (impostazioniDellUnita !== undefined) {
    console.log(`impostazioni dell'unità: ${statoImpostazioni}`);
    const comePrima = impostazioniPrima === undefined ? !existsSync(impostazioniDellUnita) : Buffer.compare(readFileSync(impostazioniDellUnita), impostazioniPrima) === 0;
    prova("le impostazioni dell'unità sono quelle di prima, byte per byte", comePrima);
  }
  if (codiceUscita !== 0 || !existsSync(uscita)) fermo(`l'editor non ha scritto gli esiti, uscita ${codiceUscita}:\n${fuori.slice(-1500)}\n${errori.slice(-1500)}`);
  console.log(`editor: ${(durata / 1000).toFixed(1)} s; primo piano del sistema: ${perso === undefined ? "mai perso" : `perso a ${(perso / 1000).toFixed(1)} s, ${ripreso === undefined ? "non ripreso" : `ripreso a ${(ripreso / 1000).toFixed(1)} s`}`}; campioni ${campioni}, finestre viste ${viste.size} [${[...viste].join(", ")}]`);

  type DiUnCaso = { testo: string; fuocoDopoIlComando: string; fuocoNelDocumento: string; invariatoDopoAverDigitato: boolean; sporco: boolean; idLinguaggio: string };
  const e = JSON.parse(readFileSync(uscita, "utf8")) as { casi: Record<string, DiUnCaso>; alterato: string; illeggibile: string; illeggibileIdLinguaggio: string; rimesso: string; controlloDigitazione: boolean; salvatoNonDetto: boolean; nonSalvatoDetto: boolean; nonSalvato: string };
  const pacchetto = require(LIBRERIA) as Libreria;
  for (const [linguaggio, lingua] of CASI) {
    const nome = `${linguaggio} ${lingua}`;
    const c = e.casi[nome] ?? fermo(`manca l'esito di ${nome}`);
    const atteso = attesoDi(linguaggio, lingua);
    console.log(`${nome}: ${Buffer.byteLength(c.testo)} byte, sha256 ${impronta(new TextEncoder().encode(c.testo)).slice(0, 12)}, colore ${c.idLinguaggio}`);
    prova(`${nome}: il documento è identico all'atteso`, c.testo === atteso, `documento:\n${c.testo.slice(0, 300)}\natteso:\n${atteso.slice(0, 300)}`);
    prova(`${nome}: colore`, c.idLinguaggio === documento(pacchetto, originale.toString("utf8"), linguaggio, lingua).idLinguaggio, c.idLinguaggio);
    prova(`${nome}: dopo il comando il fuoco resta sul file`, c.fuocoDopoIlComando === "file", c.fuocoDopoIlComando);
    prova(`${nome}: digitando col fuoco nel documento non cambia nulla`, c.fuocoNelDocumento === "algo-codice" && c.invariatoDopoAverDigitato && !c.sporco, JSON.stringify(c));
  }
  const [primo, lingua] = CASI[0];
  const atteso = attesoDi(primo, lingua);
  prova("controllo positivo: la stessa digitazione su un documento vero lo cambia", e.controlloDigitazione);
  prova("con modifiche non salvate il codice è quello del file salvato, e il comando lo dice solo in quel caso", e.nonSalvato === atteso && e.nonSalvatoDetto && e.salvatoNonDetto, `${e.salvatoNonDetto}, ${e.nonSalvatoDetto}: ${e.nonSalvato.slice(0, 300)}`);
  prova("un file alterato cambia il documento, e non è più l'atteso", e.alterato !== atteso && e.alterato.includes("3.5"), e.alterato.slice(0, 300));
  prova("un file illeggibile: il documento lo dice, senza il codice di prima", e.illeggibile === documento(pacchetto, "questo non è un file", primo, lingua).testo && e.illeggibileIdLinguaggio === "plaintext", `${e.illeggibileIdLinguaggio}: ${e.illeggibile.slice(0, 300)}`);
  prova("rimesso il file, il documento torna identico all'atteso", e.rimesso === atteso, e.rimesso.slice(0, 300));
  prova("il file non è rimasto alterato", Buffer.compare(readFileSync(fileAlgo), originale) === 0);
  prova("nessun download dell'editor", !existsSync(join(RADICE, ".vscode-test")) && !existsSync(join(cartella, ".vscode-test")), readdirSync(cartella).join(", "));
}

if (CON_FINESTRA) await nellEditor();

const provePreviste = UNITA !== undefined ? PROVE_NELL_UNITA : CON_FINESTRA ? PROVE_CON_FINESTRA : PROVE_SENZA_FINESTRA;
console.log(`prove: ${fatte}/${provePreviste}, fallite ${fallite.length}${CON_FINESTRA ? "" : "; la finestra non è stata aperta"}`);
if (fatte !== provePreviste) {
  console.log(`FERMO: il denominatore non torna: dichiarate ${provePreviste}, eseguite ${fatte}`);
  process.exit(2);
}
console.log(`ESITO: ${fallite.length > 0 ? "ROSSO" : CON_FINESTRA ? "VERDE" : "VERDE, senza la finestra: il documento nell'editor non è stato provato"}`);
process.exit(fallite.length === 0 ? 0 : 1);

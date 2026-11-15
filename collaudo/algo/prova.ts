// La prova del pacchetto di un'estensione che la ricetta installa da una release: il file della release del suo repository,
// riscaricato a ogni corsa, legato alla sua voce di ricetta/componenti.json, all'etichetta, all'attestazione della corsa che l'ha
// costruito, ai sorgenti all'etichetta e, per l'estensione `.algo`, al file del nucleo che la conformità prova. Il pacchetto non si
// costruisce qui: lo costruisce e lo prova con l'editor, su tre sistemi, il repository dell'estensione. Le voci hanno un profilo
// ciascuna (PROFILI): che cosa c'è nel pacchetto, quali voci sono file del repository, se porta il nucleo.
//
//   bun collaudo/algo/prova.ts [--voce <nome>]                    atteso: ESITO: VERDE, prove N/N (senza --voce: estensione-algo)
//   bun collaudo/algo/prova.ts [--voce <nome>] --unita <cartella> lo stesso, e l'estensione installata nell'unità è il pacchetto
//
// Serve la rete (release, etichetta, sorgenti all'etichetta) e `gh` (l'attestazione; basta un account qualunque).
// Uscite: 0 verde, 1 rosso, 2 fermo (non si è potuto misurare).
//
// Che cosa NON guarda:
// - il comportamento dell'estensione nell'editor: lo prova la corsa del suo repository, e qui conta che il file sia quello;
// - `extension/dist/extension.cjs` contro i sorgenti: è costruito, e lo lega ai sorgenti l'attestazione (repository, commit, corsa);
// - i metadati dello zip (date, ordine delle voci): si guardano byte e impronta del file, e il contenuto voce per voce;
// - la fotografia di un'etichetta spostata DOPO la corsa: si confrontano l'etichetta di adesso, il commit della voce e quello attestato.

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { inflateRawSync } from "node:zlib";
import { differenzeDegliElenchi, fermo, impronta, RADICE } from "../../ricetta/nucleo/comune";

const POSIZIONE_UNITA = process.argv.indexOf("--unita");
const UNITA = POSIZIONE_UNITA >= 0 ? (process.argv[POSIZIONE_UNITA + 1] ?? fermo("--unita vuole la cartella")) : undefined;
const POSIZIONE_VOCE = process.argv.indexOf("--voce");
const NOME_DELLA_VOCE = POSIZIONE_VOCE >= 0 ? (process.argv[POSIZIONE_VOCE + 1] ?? fermo("--voce vuole il nome della voce")) : "estensione-algo";

/** Per ogni voce: ciò che il pacchetto contiene, e nient'altro; le voci che sono file del repository dell'estensione così come
 *  sono, all'etichetta; le immagini (confrontate per contenuto, non lette come testo); se porta il nucleo di AlgoDesign; e il
 *  denominatore, cioè le chiamate a `prova` (una in più con `--unita`), dichiarato prima della corsa. */
type Profilo = { pacchetto: string[]; daiSorgenti: Record<string, string>; immagini: string[]; nucleo: boolean; prove: number };
const PROFILI: Record<string, Profilo> = {
  "estensione-algo": {
    pacchetto: ["[Content_Types].xml", "extension.vsixmanifest", "extension/LICENSE.txt", "extension/LICENZA-ALGODESIGN.txt", "extension/dist/extension.cjs", "extension/dist/libreria.cjs", "extension/icona.png", "extension/package.json", "extension/readme.md"],
    daiSorgenti: { "extension/package.json": "package.json", "extension/LICENSE.txt": "LICENSE", "extension/LICENZA-ALGODESIGN.txt": "LICENZA-ALGODESIGN.txt", "extension/icona.png": "icona.png", "extension/readme.md": "README.md" },
    immagini: ["extension/icona.png"],
    nucleo: true,
    prove: 17,
  },
  "estensione-c": {
    pacchetto: ["[Content_Types].xml", "extension.vsixmanifest", "extension/LICENSE.txt", "extension/dist/extension.cjs", "extension/dist/terminale.cjs", "extension/package.json", "extension/readme.md"],
    daiSorgenti: { "extension/package.json": "package.json", "extension/LICENSE.txt": "LICENSE", "extension/readme.md": "README.md" },
    immagini: [],
    nucleo: false,
    prove: 16,
  },
};
const PROFILO = PROFILI[NOME_DELLA_VOCE] ?? fermo(`nessun profilo per la voce ${NOME_DELLA_VOCE}: ${Object.keys(PROFILI).join(", ")}`);
const PROVE = PROFILO.prove;
const PROVE_NELL_UNITA = PROFILO.prove + 1;
const NEL_PACCHETTO = PROFILO.pacchetto;
const DAI_SORGENTI = PROFILO.daiSorgenti;
const PERCORSO_ASSOLUTO = /(?<![A-Za-z])[A-Za-z]:[\\/]/;
/** Stringhe che nel pacchetto non devono esserci: il nome e la struttura di questo repository (come le conta il controllo di confine),
 *  e il motore con cui si costruisce. */
const VIETATE = [/my[-_\s]*dev/i, /ricetta[\\/]/, /estratto[\\/]/, /collaudo[\\/]/, /bun:/, /Bun\./];

const cartella = mkdtempSync(join(tmpdir(), "algo  release-"));
process.on("exit", () => rmSync(cartella, { recursive: true, force: true }));

let fatte = 0;
const fallite: string[] = [];
function prova(nome: string, buona: boolean, dettaglio = ""): void {
  fatte++;
  console.log(`${buona ? "PASS" : "FAIL"}  ${nome}${buona ? "" : `\n      ${dettaglio}`}`);
  if (!buona) fallite.push(nome);
}

async function scarica(indirizzo: string): Promise<Uint8Array> {
  const r = await fetch(indirizzo).catch((e: unknown) => fermo(`non si è potuto scaricare ${indirizzo}: ${String(e)}`));
  if (!r.ok) fermo(`non si è potuto scaricare ${indirizzo}: risposta ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

/** Le voci di uno zip lette dal suo indice in coda al file, coi contenuti (le cartelle no). Uno zip che non si legge è un'eccezione,
 *  col motivo: il verdetto la trasforma in un rosso. */
function vociDelloZip(archivio: Uint8Array): Map<string, Uint8Array> {
  const z = Buffer.from(archivio.buffer, archivio.byteOffset, archivio.byteLength);
  if (z.length < 22) throw new Error(`troppo corto per uno zip: ${z.length} byte`);
  let fine = z.length - 22;
  while (fine >= Math.max(0, z.length - 22 - 0xffff) && z.readUInt32LE(fine) !== 0x06054b50) fine--;
  if (fine < 0 || z.readUInt32LE(fine) !== 0x06054b50) throw new Error("manca la fine dell'indice");
  const quante = z.readUInt16LE(fine + 10);
  const voci = new Map<string, Uint8Array>();
  let p = z.readUInt32LE(fine + 16);
  for (let i = 0; i < quante; i++) {
    if (p + 46 > z.length || z.readUInt32LE(p) !== 0x02014b50) throw new Error(`voce ${i} dell'indice senza la sua firma`);
    const lunghezzaNome = z.readUInt16LE(p + 28);
    const nome = z.toString("utf8", p + 46, p + 46 + lunghezzaNome);
    const testata = z.readUInt32LE(p + 42);
    if (testata + 30 > z.length || z.readUInt32LE(testata) !== 0x04034b50) throw new Error(`${nome}: testata locale senza la sua firma`);
    const inizio = testata + 30 + z.readUInt16LE(testata + 26) + z.readUInt16LE(testata + 28);
    const grandezza = z.readUInt32LE(p + 20);
    if (inizio + grandezza > z.length) throw new Error(`${nome}: i dati escono dal file`);
    const dati = z.subarray(inizio, inizio + grandezza);
    const metodo = z.readUInt16LE(p + 10);
    if (metodo !== 0 && metodo !== 8) throw new Error(`${nome}: metodo di compressione sconosciuto ${metodo}`);
    if (voci.has(nome)) throw new Error(`${nome}: voce ripetuta nell'indice`);
    if (!nome.endsWith("/")) voci.set(nome, metodo === 0 ? new Uint8Array(dati) : new Uint8Array(inflateRawSync(dati)));
    p += 46 + lunghezzaNome + z.readUInt16LE(p + 30) + z.readUInt16LE(p + 32);
  }
  return voci;
}

// --- I tipi di questa prova: il suo tsconfig non lo fa girare nessun altro.
const tsc = Bun.which("tsc", { PATH: join(RADICE, "node_modules", ".bin") }) ?? fermo("tsc non c'è: bun install alla radice");
const tipi = Bun.spawnSync([tsc, "-p", join(RADICE, "collaudo", "algo", "tsconfig.json")], { stdout: "pipe", stderr: "pipe" });
prova("tsc sulla prova", tipi.exitCode === 0, `${tipi.stdout.toString()}${tipi.stderr.toString()}`);

// --- La voce della ricetta, e da lì il repository e l'etichetta.
type Voce = { nome: string; stato: string; fonte: string; file: string; byte: number; sha256: string; versione: string; estensione: string; commit: string };
const voce = (JSON.parse(readFileSync(join(RADICE, "ricetta", "componenti.json"), "utf8")) as { nostri: Voce[] }).nostri.find((v) => v.nome === NOME_DELLA_VOCE && v.stato === "release") ?? fermo(`in ricetta/componenti.json non c'è la voce ${NOME_DELLA_VOCE} con stato release`);
const fonte = /^https:\/\/github\.com\/([^/]+\/[^/]+)\/releases\/download\/([^/]+)\/([^/]+)$/.exec(voce.fonte) ?? fermo(`la fonte non è un file di una release di GitHub: ${voce.fonte}`);
const [, repository, etichetta, nomeDelFile] = fonte as unknown as [string, string, string, string];
if (nomeDelFile !== voce.file) fermo(`la fonte nomina ${nomeDelFile}, la voce ${voce.file}`);
if (!/^[0-9a-f]{40}$/.test(voce.commit ?? "")) fermo(`la voce non ha il commit dell'etichetta: ${voce.commit}`);
console.log(`voce: ${voce.file}, ${voce.byte} byte, ${voce.sha256.slice(0, 12)}; repository ${repository}, etichetta ${etichetta}, commit ${voce.commit.slice(0, 12)}`);

// --- L'etichetta riletta adesso: deve puntare al commit della voce.
const ref = (await (await fetch(`https://api.github.com/repos/${repository}/git/ref/tags/${etichetta}`).catch((e: unknown) => fermo(`etichetta non letta: ${String(e)}`))).json()) as { object?: { type: string; sha: string } };
let commitDellEtichetta = ref.object?.sha ?? fermo(`l'etichetta ${etichetta} non c'è su ${repository}: ${JSON.stringify(ref).slice(0, 200)}`);
if (ref.object?.type === "tag") {
  const t = (await (await fetch(`https://api.github.com/repos/${repository}/git/tags/${commitDellEtichetta}`)).json()) as { object?: { sha: string } };
  commitDellEtichetta = t.object?.sha ?? fermo("etichetta annotata senza oggetto");
}
console.log(`etichetta ${etichetta}: ${ref.object?.type}, commit ${commitDellEtichetta}`);
prova("l'etichetta punta al commit della voce", commitDellEtichetta === voce.commit, `${commitDellEtichetta} contro ${voce.commit}`);

// --- Il file della release, riscaricato, e i sorgenti all'etichetta che il pacchetto porta così come sono.
const release = await scarica(voce.fonte);
const fileRelease = join(cartella, voce.file);
writeFileSync(fileRelease, release);
console.log(`file della release riscaricato: ${release.length} byte, impronta ${impronta(release)}`);
const sorgenti = new Map<string, Uint8Array>();
for (const f of new Set(Object.values(DAI_SORGENTI))) sorgenti.set(f, await scarica(`https://raw.githubusercontent.com/${repository}/${voce.commit}/${f}`));
// Il nucleo, solo per il profilo che lo porta: il file della conformità e la sua licenza, dallo zip del deposito.
const nucleo = JSON.parse(readFileSync(join(RADICE, "ricetta", "nucleo", "pacchetto.json"), "utf8")) as { zip: { nome: string; sha256: string }; file: { percorso: string; sha256: string } };
let licenzaDelNucleo: Uint8Array = new Uint8Array();
if (PROFILO.nucleo) {
  const zipDelNucleo = join(RADICE, "ricetta", "nucleo", "scaricato", nucleo.zip.nome);
  if (!existsSync(zipDelNucleo)) fermo(`manca ${zipDelNucleo}: si fa prima bun run libreria:costruisci`);
  const vociDelNucleo = vociDelloZip(readFileSync(zipDelNucleo));
  if (impronta(readFileSync(zipDelNucleo)) !== nucleo.zip.sha256) fermo("lo zip del nucleo nel deposito non ha l'impronta di pacchetto.json");
  licenzaDelNucleo = vociDelNucleo.get(`${nucleo.file.percorso.split("/")[0]}/LICENSE`) ?? fermo("la licenza non è nello zip del nucleo");
}

// --- Il verdetto sul pacchetto: una funzione sola, per il vero e per le mutazioni. Vuoto è verde; ogni motivo nomina la voce.
// Uno zip che non si legge è un rosso col suo motivo, come ogni altro: una politica sola.
const colpiIn = (testo: string): string[] => [PERCORSO_ASSOLUTO, ...VIETATE].flatMap((rx) => rx.exec(testo)?.[0] ?? []);
type Attesa = { byte: number; sha256: string };
function motiviDellaRelease(pacchetto: Uint8Array, attesa: Attesa): string[] {
  const motivi: string[] = [];
  if (pacchetto.length !== attesa.byte) motivi.push(`byte ${pacchetto.length}, nella ricetta ${attesa.byte}`);
  if (impronta(pacchetto) !== attesa.sha256) motivi.push(`impronta ${impronta(pacchetto).slice(0, 12)}, nella ricetta ${attesa.sha256.slice(0, 12)}`);
  let voci: Map<string, Uint8Array>;
  try {
    voci = vociDelloZip(pacchetto);
  } catch (e) {
    return [...motivi, `lo zip non si legge: ${e instanceof Error ? e.message : String(e)}`];
  }
  const elenco = differenzeDegliElenchi(voci.keys(), NEL_PACCHETTO);
  for (const v of elenco.soloA) motivi.push(`voce in più: ${v}`);
  for (const v of elenco.soloB) motivi.push(`voce mancante: ${v}`);
  for (const [v, f] of Object.entries(DAI_SORGENTI)) {
    const d = voci.get(v);
    if (d !== undefined && impronta(d) !== impronta(sorgenti.get(f)!)) motivi.push(`${v}: non è ${f} all'etichetta`);
  }
  if (PROFILO.nucleo) {
    const libreria = voci.get("extension/dist/libreria.cjs");
    if (libreria !== undefined && impronta(libreria) !== nucleo.file.sha256) motivi.push(`extension/dist/libreria.cjs: non è il file del nucleo che la conformità prova (${impronta(libreria).slice(0, 12)})`);
    const licenza = voci.get("extension/LICENZA-ALGODESIGN.txt");
    if (licenza !== undefined && impronta(licenza) !== impronta(licenzaDelNucleo)) motivi.push("extension/LICENZA-ALGODESIGN.txt: non è la licenza dello zip del nucleo");
  }
  // Ogni voce tranne le immagini, confrontate qui sopra per contenuto: anche le voci in più.
  for (const [v, d] of voci) if (!PROFILO.immagini.includes(v)) for (const c of colpiIn(Buffer.from(d).toString("utf8"))) motivi.push(`${v}: ${c}`);
  return motivi;
}
const motiviVeri = motiviDellaRelease(release, voce);
console.log(`motivi sul file della release: ${motiviVeri.length}`);
prova(`il file della release: byte e impronta della voce, le voci attese nei due versi, i file del repository all'etichetta,${PROFILO.nucleo ? " il nucleo e la sua licenza," : ""} nessun percorso assoluto né stringa vietata`, motiviVeri.length === 0, motiviVeri.join("; "));

// --- Il lettore dello zip contro il `tar` di System32, SUL FILE DELLA RELEASE: stesso elenco nei due versi, stessi byte.
const tar = join(process.env.SystemRoot ?? fermo("manca SystemRoot"), "System32", "tar.exe");
if (!existsSync(tar)) fermo(`non c'è ${tar}`);
const estratto = join(cartella, "estratto  dalla release");
mkdirSync(estratto);
const elencoTar = Bun.spawnSync([tar, "-tf", fileRelease], { stdout: "pipe", stderr: "pipe" });
const estrazione = Bun.spawnSync([tar, "-xf", fileRelease, "-C", estratto], { stdout: "pipe", stderr: "pipe" });
if (elencoTar.exitCode !== 0 || estrazione.exitCode !== 0) fermo(`il tar non apre il file della release: ${elencoTar.stderr.toString()} ${estrazione.stderr.toString()}`);
const nelTar = elencoTar.stdout.toString().split(/\r?\n/).filter((r) => r !== "" && !r.endsWith("/"));
const vociRelease = vociDelloZip(release);
const lettoreContro = differenzeDegliElenchi(vociRelease.keys(), nelTar);
const lettoreDiverse = [...vociRelease].filter(([v, d]) => !existsSync(join(estratto, v)) || impronta(d) !== impronta(readFileSync(join(estratto, v)))).map(([v]) => v);
console.log(`lettore dello zip sul file della release: ${vociRelease.size} voci, tar ${nelTar.length}; solo nel lettore ${lettoreContro.soloA.length}, solo nel tar ${lettoreContro.soloB.length}, byte diversi ${lettoreDiverse.length}`);
prova("il lettore dello zip vede il file della release come il tar di sistema: stesso elenco, stessi byte", vociRelease.size > 0 && lettoreContro.soloA.length + lettoreContro.soloB.length + lettoreDiverse.length === 0, `solo nel lettore: ${lettoreContro.soloA.join(", ")}; solo nel tar: ${lettoreContro.soloB.join(", ")}; diversi: ${lettoreDiverse.join(", ")}`);
prova("controllo del lettore: il tar con una voce in più non torna", differenzeDegliElenchi(vociRelease.keys(), [...nelTar, "extension/x"]).soloB.join() === "extension/x");

// --- Il manifesto nel pacchetto: versione e identificativo della voce, come l'editor li scrive (in minuscolo).
const manifesto = JSON.parse(Buffer.from(vociRelease.get("extension/package.json") ?? new Uint8Array()).toString("utf8")) as { name?: string; publisher?: string; version?: string };
const identificativo = `${manifesto.publisher}.${manifesto.name}`.toLowerCase();
console.log(`manifesto: ${manifesto.publisher}.${manifesto.name} ${manifesto.version}; nella voce ${voce.estensione} ${voce.versione}`);
prova("il manifesto ha la versione e l'identificativo della voce", manifesto.version === voce.versione && identificativo === voce.estensione, `${identificativo} ${manifesto.version}`);

// --- L'attestazione, sul file riscaricato: il soggetto è quel file, il repository è quello della fonte, il commit quello della voce.
type Verifica = { verificationResult?: { statement?: { subject?: { digest?: { sha256?: string } }[] }; signature?: { certificate?: { sourceRepositoryURI?: string; sourceRepositoryDigest?: string; runInvocationURI?: string; sourceRepositoryRef?: string } } } }[];
const gh = Bun.which("gh") ?? fermo("gh non c'è: serve per verificare l'attestazione");
function attestazione(file: string): { uscita: number; testo: string; verifiche: Verifica } {
  const p = Bun.spawnSync([gh, "attestation", "verify", file, "-R", repository, "--format", "json"], { stdout: "pipe", stderr: "pipe" });
  const testo = `${p.stdout.toString()}${p.stderr.toString()}`;
  let verifiche: Verifica = [];
  try {
    if (p.exitCode === 0) verifiche = JSON.parse(p.stdout.toString()) as Verifica;
  } catch {
    fermo(`gh attestation verify non ha dato JSON:\n${testo.slice(0, 500)}`);
  }
  return { uscita: p.exitCode ?? -1, testo, verifiche };
}
const a = attestazione(fileRelease);
if (a.uscita !== 0 && /could not|network|dial tcp|timeout/i.test(a.testo) && !/no attestations|404/i.test(a.testo)) fermo(`attestazione non verificabile:\n${a.testo.slice(0, 800)}`);
const certificati = a.verifiche.map((v) => v.verificationResult?.signature?.certificate ?? {});
const soggetti = a.verifiche.flatMap((v) => v.verificationResult?.statement?.subject ?? []).map((s) => s.digest?.sha256);
for (const c of certificati) console.log(`attestazione: repository ${c.sourceRepositoryURI}, commit ${c.sourceRepositoryDigest}, riferimento ${c.sourceRepositoryRef}, corsa ${c.runInvocationURI}`);
prova(
  "l'attestazione del file riscaricato: il soggetto è il file, repository e commit sono quelli della voce, c'è la corsa",
  a.uscita === 0 && certificati.length > 0 && soggetti.includes(impronta(release)) && certificati.every((c) => c.sourceRepositoryURI === `https://github.com/${repository}` && c.sourceRepositoryDigest === voce.commit && /\/actions\/runs\/\d+\//.test(c.runInvocationURI ?? "")),
  `uscita ${a.uscita}: ${a.testo.slice(0, 500)}`,
);

// --- Le mutazioni del verdetto, ognuna col suo motivo e lei sola; e quante voci ha toccato.
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
const attesaDi = (b: Uint8Array): Attesa => ({ byte: b.length, sha256: impronta(b) });
const ricomposto = (cambia: (m: Map<string, Uint8Array>) => number): { zip: Buffer; toccate: number } => {
  const m = new Map(vociRelease);
  const toccate = cambia(m);
  return { zip: zipDi(m), toccate };
};
function mutazione(nome: string, zip: Uint8Array, toccate: number, attesa: Attesa, attesi: string[]): void {
  const motivi = motiviDellaRelease(zip, attesa);
  console.log(`  ${nome}: toccate ${toccate}, motivi ${motivi.length}: ${motivi.join("; ")}`);
  prova(`mutazione: ${nome}`, toccate > 0 && motivi.length === attesi.length && attesi.every((x, i) => motivi[i] === x), `toccate ${toccate}; motivi: ${motivi.join("; ")}`);
}
const intatto = ricomposto(() => 0);
const motiviIntatto = motiviDellaRelease(intatto.zip, attesaDi(intatto.zip));
prova("controllo: il file della release ricomposto senza mutazioni è verde", motiviIntatto.length === 0 && vociDelloZip(intatto.zip).size === vociRelease.size, motiviIntatto.join("; "));
const EXTRA = "extension/dist/extra.cjs";
const inPiu = ricomposto((m) => (m.set(EXTRA, new TextEncoder().encode("module.exports = 1;\n")), 1));
mutazione("una voce in più", inPiu.zip, inPiu.toccate, attesaDi(inPiu.zip), [`voce in più: ${EXTRA}`]);
const senza = ricomposto((m) => Number(m.delete("extension/LICENSE.txt")));
mutazione("una voce mancante", senza.zip, senza.toccate, attesaDi(senza.zip), ["voce mancante: extension/LICENSE.txt"]);
const diverso = ricomposto((m) => (m.set("extension/package.json", Buffer.concat([m.get("extension/package.json") ?? new Uint8Array(), Buffer.from(" ")])), 1));
mutazione("una voce diversa dal file del repository all'etichetta", diverso.zip, diverso.toccate, attesaDi(diverso.zip), ["extension/package.json: non è package.json all'etichetta"]);
if (PROFILO.nucleo) {
  const altroNucleo = ricomposto((m) => (m.set("extension/dist/libreria.cjs", Buffer.concat([m.get("extension/dist/libreria.cjs") ?? new Uint8Array(), Buffer.from("\n")])), 1));
  mutazione("un altro file del nucleo", altroNucleo.zip, altroNucleo.toccate, attesaDi(altroNucleo.zip), [`extension/dist/libreria.cjs: non è il file del nucleo che la conformità prova (${impronta(Buffer.concat([vociRelease.get("extension/dist/libreria.cjs")!, Buffer.from("\n")])).slice(0, 12)})`]);
}
const vietato = ricomposto((m) => (m.set(EXTRA, new TextEncoder().encode(String.raw`module.exports = "C:\MyDev";`)), 1));
mutazione("una voce in più con un percorso assoluto e il nome del progetto", vietato.zip, vietato.toccate, attesaDi(vietato.zip), [`voce in più: ${EXTRA}`, `${EXTRA}: C:\\`, `${EXTRA}: MyDev`]);
// Sul file vero, contro la voce vera. L'impronta: un bit dell'ora della prima testata locale, che nessun lettore usa, a byte uguali.
if (Buffer.from(release.subarray(0, 4)).readUInt32LE(0) !== 0x04034b50) fermo("il file della release non comincia con una testata locale");
const conAltraImpronta = Buffer.from(release);
conAltraImpronta[10] = conAltraImpronta[10]! ^ 1;
mutazione("un'impronta diversa, a byte uguali", conAltraImpronta, Buffer.compare(conAltraImpronta, release) === 0 ? 0 : 1, voce, [`impronta ${impronta(conAltraImpronta).slice(0, 12)}, nella ricetta ${voce.sha256.slice(0, 12)}`]);
const conUnByte = Buffer.concat([release, Buffer.from([0])]);
mutazione("un byte in più", conUnByte, conUnByte.length - release.length, voce, [`byte ${release.length + 1}, nella ricetta ${voce.byte}`, `impronta ${impronta(conUnByte).slice(0, 12)}, nella ricetta ${voce.sha256.slice(0, 12)}`]);
const troncato = Buffer.from(release.subarray(0, release.length - 30));
mutazione("uno zip troncato: non si legge", troncato, release.length - troncato.length, attesaDi(troncato), ["lo zip non si legge: manca la fine dell'indice"]);
// L'attestazione di un file con un byte in più non c'è: gh lo rifiuta.
const fileConUnByte = join(cartella, `con un byte ${voce.file}`);
writeFileSync(fileConUnByte, conUnByte);
const b = attestazione(fileConUnByte);
console.log(`  attestazione del file con un byte in più: uscita ${b.uscita}, ${b.testo.trim().split(/\r?\n/).slice(-1)[0] ?? ""}`);
prova("mutazione: un byte in più non ha attestazione", b.uscita !== 0 && b.verifiche.length === 0, b.testo.slice(0, 300));

// --- Nell'unità: l'estensione installata è il pacchetto, file per file (il manifesto senza i metadati che l'editor aggiunge).
if (UNITA !== undefined) {
  const installata = join(UNITA, "vscodium", "data", "extensions", `${voce.estensione}-${voce.versione}`);
  const nellaCartella = [...vociRelease.keys()].filter((f) => f.startsWith("extension/")).map((f) => f.slice("extension/".length));
  const senzaMetadati = (b: Uint8Array): string => JSON.stringify({ ...(JSON.parse(Buffer.from(b).toString("utf8")) as object), __metadata: undefined });
  const uguali = (f: string): boolean => {
    const p = join(installata, f);
    if (!existsSync(p)) return false;
    const d = vociRelease.get(`extension/${f}`)!;
    return f === "package.json" ? senzaMetadati(d) === senzaMetadati(readFileSync(p)) : impronta(d) === impronta(readFileSync(p));
  };
  const diversi = nellaCartella.filter((f) => !uguali(f));
  console.log(`estensione installata in ${installata}: ${nellaCartella.length} file confrontati col pacchetto, diversi ${diversi.length}`);
  prova("l'estensione installata nell'unità è il pacchetto della release, file per file", existsSync(installata) && nellaCartella.length > 0 && diversi.length === 0, `${installata}: ${diversi.join(", ")}`);
}

const previste = UNITA !== undefined ? PROVE_NELL_UNITA : PROVE;
console.log(`prove: ${fatte}/${previste}, fallite ${fallite.length}`);
if (fatte !== previste) {
  console.log(`FERMO: il denominatore non torna: dichiarate ${previste}, eseguite ${fatte}`);
  process.exit(2);
}
console.log(`ESITO: ${fallite.length > 0 ? "ROSSO" : "VERDE"}`);
process.exit(fallite.length === 0 ? 0 : 1);

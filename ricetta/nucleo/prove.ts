// Le prove della ricetta del nucleo: l'estrazione è ripetibile, e ogni guasto dà il suo rosso o il suo fermo.
//
//   bun ricetta/nucleo/prove.ts            atteso: ESITO: VERDE, prove N/N
//
// Lavora in una cartella temporanea col nome a spazi doppi e su copie dell'inventario: non tocca né l'inventario
// versionato né la cartella estratta. Un rosso vale solo se esce 1 e dice il motivo per intero, non solo il nome del file:
// un altro ramo può nominare lo stesso file. Un fermo vale solo se esce 2, e non è mai un rosso.
//
// Le spie e il compilatore si provano su un repository finto, copia di `app/` al commit fissato, con un commit alterato per
// ogni guasto.
//
// Che cosa NON guarda: il contenuto del nucleo (lo guarda la prova di conformità); il `.gitignore`.

import { appendFileSync, copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { git as gitDelNucleo, impronta, INVENTARIO, leggiInventario, RADICE, repoDelNucleo, type Inventario } from "./comune";

/** Il denominatore, dichiarato prima della corsa e confrontato alla fine. */
const PROVE_ATTESE = 37;

const QUI = import.meta.dir;
const cartella = mkdtempSync(join(tmpdir(), "nucleo  prova-"));
process.on("exit", () => rmSync(cartella, { recursive: true, force: true }));

const base = leggiInventario(INVENTARIO);
const voce = base.file[0]!;
const file = voce.percorso;
const A = join(cartella, "prima estrazione");
const B = join(cartella, "seconda estrazione");

function corsa(script: string, ...argomenti: string[]): { uscita: number; testo: string } {
  const p = Bun.spawnSync([process.execPath, join(QUI, script), ...argomenti], { stdout: "pipe", stderr: "pipe" });
  return { uscita: p.exitCode, testo: p.stdout.toString() + p.stderr.toString() };
}

function inventarioFinto(nome: string, cambia: (i: Inventario) => void): string {
  const copia = structuredClone(base);
  cambia(copia);
  const percorso = join(cartella, `${nome}.json`);
  writeFileSync(percorso, JSON.stringify(copia, null, 2));
  return percorso;
}

let fatte = 0;
const fallite: string[] = [];
function prova(nome: string, buona: boolean, dettaglio: string): void {
  fatte++;
  console.log(`${buona ? "PASS" : "FAIL"}  ${nome}${buona ? "" : `\n${dettaglio}`}`);
  if (!buona) fallite.push(nome);
}
const verde = (nome: string, c: { uscita: number; testo: string }) => prova(nome, c.uscita === 0 && c.testo.includes("ESITO: VERDE"), c.testo);
const rossoCon = (nome: string, c: { uscita: number; testo: string }, ...attesi: string[]) =>
  prova(nome, c.uscita === 1 && c.testo.includes("ESITO: ROSSO") && attesi.every((a) => c.testo.includes(a)), `uscita ${c.uscita}, atteso 1 con ${attesi.join(", ")}\n${c.testo}`);
const fermoCon = (nome: string, c: { uscita: number; testo: string }, ...attesi: string[]) =>
  prova(nome, c.uscita === 2 && c.testo.includes("FERMO:") && !c.testo.includes("ESITO:") && attesi.every((a) => c.testo.includes(a)), `uscita ${c.uscita}, atteso 2 con ${attesi.join(", ")}\n${c.testo}`);

console.log(`inventario: ${base.etichetta}, ${base.file.length} file; file bersaglio: ${file}`);

// La chiusura ricalcolata coincide con l'inventario versionato.
verde("chiusura ricalcolata uguale all'inventario", corsa("chiusura.ts"));

// L'estrazione è ripetibile, anche in un percorso con spazi doppi.
const primo = corsa("estrai.ts", "--cartella", A);
const secondo = corsa("estrai.ts", "--cartella", B);
verde("prima estrazione", primo);
verde("seconda estrazione", secondo);
const byteUguali = base.file.every((v) => Buffer.compare(readFileSync(join(A, v.percorso)), readFileSync(join(B, v.percorso))) === 0);
prova("le due estrazioni sono identiche, byte per byte", byteUguali, "due estrazioni diverse");

// Un byte alterato in un file estratto.
const percorsoA = join(A, file);
const originale = readFileSync(percorsoA);
const alterato = Buffer.from(originale);
alterato[alterato.length - 1] = alterato[alterato.length - 1]! ^ 1;
writeFileSync(percorsoA, alterato);
const impronteDi = `l'impronta di ${file} non torna`;
rossoCon("un byte alterato", corsa("estrai.ts", "--verifica", "--cartella", A), impronteDi);

// La stessa riga con CRLF: contenuto uguale, impronta diversa.
writeFileSync(percorsoA, originale.toString("latin1").replaceAll("\n", "\r\n"), "latin1");
rossoCon("i fine riga convertiti", corsa("estrai.ts", "--verifica", "--cartella", A), impronteDi);
writeFileSync(percorsoA, originale);

// Un file che manca, un file in più. Quello tolto va fuori dalla cartella: accanto sarebbe anche un file in più, e quel rosso coprirebbe questo.
const tolto = join(cartella, "file tolto");
renameSync(percorsoA, tolto);
rossoCon("un file mancante dalla cartella", corsa("estrai.ts", "--verifica", "--cartella", A), `manca dalla cartella: ${file}`);
renameSync(tolto, percorsoA);
mkdirSync(dirname(join(A, "app/core/intruso.ts")), { recursive: true });
appendFileSync(join(A, "app/core/intruso.ts"), "export {};\n");
rossoCon("un file in più nella cartella", corsa("estrai.ts", "--verifica", "--cartella", A), "in più nella cartella: app/core/intruso.ts");
rmSync(join(A, "app/core/intruso.ts"));

// Rimesso tutto a posto la verifica torna verde: i rossi di sopra erano di quei guasti.
verde("la cartella rimessa a posto torna verde", corsa("estrai.ts", "--verifica", "--cartella", A));

// Un'impronta alterata nell'inventario: la vedono tutti e due.
const conImpronta = inventarioFinto("impronta", (i) => {
  i.file[0]!.sha256 = "0".repeat(64);
});
rossoCon("un'impronta alterata, all'estrazione", corsa("estrai.ts", "--inventario", conImpronta, "--cartella", join(cartella, "c")), impronteDi);
rossoCon("un'impronta alterata, alla chiusura", corsa("chiusura.ts", "--inventario", conImpronta), impronteDi);

// Un file tolto dall'inventario, un file inventato: i due versi del confronto.
rossoCon("un file tolto dall'inventario", corsa("chiusura.ts", "--inventario", inventarioFinto("tolto", (i) => void i.file.shift())), `solo nella chiusura: ${file}`);
rossoCon("un file inventato nell'inventario", corsa("chiusura.ts", "--inventario", inventarioFinto("inventato", (i) => void i.file.push({ percorso: "app/core/inventato.ts", sha256: "0".repeat(64) }))), "solo nell'inventario: app/core/inventato.ts");

// Un inventario che dice un altro commit: l'etichetta è l'unica fonte del commit. Qui si provano le guardie di estrai.ts e
// chiusura.ts; il fermo comune delle prove a valle (fermoSeEtichettaSpostata di comune.ts, «non è più al commit
// dell'inventario») non ha una prova: quegli script non accettano un inventario finto, e un'etichetta spostata nel
// repository vero non si fa per provare.
const conCommit = inventarioFinto("commit", (i) => void (i.commit = "0".repeat(40)));
rossoCon("un commit diverso da quello dell'etichetta, all'estrazione", corsa("estrai.ts", "--inventario", conCommit, "--cartella", join(cartella, "d")), "non è quello dell'etichetta");
rossoCon("un commit diverso da quello dell'etichetta, alla chiusura", corsa("chiusura.ts", "--inventario", conCommit), "non è quello dell'etichetta");

// --- Il repository finto: lo stesso `app/`, con un commit per ogni guasto, su un'etichetta sua.
const finto = join(cartella, "repository finto");
mkdirSync(finto);
await new Bun.Archive(gitDelNucleo(repoDelNucleo(undefined), "archive", "--format=tar", base.commit, "--", "app")).extract(finto);
function nelFinto(...argomenti: string[]): void {
  const p = Bun.spawnSync(["git", "-C", finto, "-c", "user.name=prova", "-c", "user.email=prova@esempio.invalid", "-c", "core.autocrlf=false", ...argomenti], { stdout: "pipe", stderr: "pipe" });
  if (p.exitCode !== 0) throw new Error(`git ${argomenti.join(" ")}: ${p.stderr.toString()}`);
}
nelFinto("init", "-q");
nelFinto("add", "app");
nelFinto("commit", "-q", "-m", "base");
function etichettaFinta(nome: string, percorso: string, cambia: (testo: string) => string): void {
  const f = join(finto, percorso);
  const prima = readFileSync(f, "utf8");
  writeFileSync(f, cambia(prima));
  nelFinto("add", "app");
  nelFinto("commit", "-q", "-m", nome);
  nelFinto("tag", nome);
  writeFileSync(f, prima);
}
const chiusuraSul = (etichetta: string) => corsa("chiusura.ts", "--repo", finto, "--etichetta", etichetta);

etichettaFinta("con-spia", file, (t) => `${t}\nexport const sonda = "bun:sqlite";\n`);
// La riga del rosso, non il nome della spia: quello sta anche nel conteggio stampato, e un altro rosso più avanti lo coprirebbe.
rossoCon("una riga con la spia, che il compilatore accetta", chiusuraSul("con-spia"), "ROSSO: spia Bun:", `${file}: export const sonda`);
etichettaFinta("con-errore", file, (t) => `${t}\nexport const sonda: number = "x";\n`);
rossoCon("un errore di tipo nella chiusura", chiusuraSul("con-errore"), "il tsc completo sulla chiusura", "TS2322");
etichettaFinta("senza-colpo", "app/core/genera/typescript.ts", (t) => t.replaceAll('"node:fs"', '"altro:fs"'));
fermoCon("un colpo atteso sparito", chiusuraSul("senza-colpo"), "il colpo atteso della spia node: non c'è più");

// --- I fermi: non si è potuto misurare, e non è un rosso del nucleo.
fermoCon("un'etichetta che non c'è", corsa("estrai.ts", "--inventario", inventarioFinto("assente", (i) => void (i.etichetta = "non-esiste")), "--cartella", join(cartella, "e")), "l'etichetta non c'è: non-esiste");
fermoCon("un ramo al posto dell'etichetta", chiusuraSul("HEAD"), "l'etichetta non c'è: HEAD");
fermoCon("un repository che non c'è", corsa("chiusura.ts", "--repo", join(cartella, "nessuno")), "il repository del nucleo non c'è");
fermoCon("un'opzione sconosciuta", corsa("estrai.ts", "--inesistente", "x"), "eccezione non catturata");
const rotto = join(cartella, "rotto.json");
writeFileSync(rotto, "{ non è JSON");
fermoCon("un inventario che non è JSON", corsa("estrai.ts", "--inventario", rotto), "eccezione non catturata");

// --- Il pacchetto della release: il deposito vero per il caso buono, depositi finti per i guasti. L'uscita non è mai quella vera.
type Descrizione = { etichetta: string; indirizzo: string; zip: { nome: string; sha256: string }; file: { percorso: string; sha256: string } };
const descrizioneVera = JSON.parse(readFileSync(join(QUI, "pacchetto.json"), "utf8")) as Descrizione;
const pacchetti = join(cartella, "pacchetti");
mkdirSync(pacchetti);
let numero = 0;
function descrizioneFinta(cambia: (d: Descrizione) => void): string {
  const copia = structuredClone(descrizioneVera);
  cambia(copia);
  const percorso = join(pacchetti, `descrizione ${++numero}.json`);
  writeFileSync(percorso, JSON.stringify(copia));
  return percorso;
}
function depositoFinto(contenuto?: Buffer): string {
  const d = join(pacchetti, `deposito ${++numero}`);
  mkdirSync(d);
  if (contenuto !== undefined) writeFileSync(join(d, descrizioneVera.zip.nome), contenuto);
  return d;
}
const uscitaFinta = () => join(pacchetti, `uscita ${++numero}.cjs`);

const uscitaBuona = uscitaFinta();
verde("il pacchetto dal deposito", corsa("pacchetto.ts", "--uscita", uscitaBuona));
prova("il file scritto ha l'impronta dichiarata", existsSync(uscitaBuona) && impronta(readFileSync(uscitaBuona)) === descrizioneVera.file.sha256, "impronta diversa o file assente");

const zipVero = readFileSync(join(QUI, "scaricato", descrizioneVera.zip.nome));
const zipAlterato = Buffer.from(zipVero);
zipAlterato[zipAlterato.length - 1] = zipAlterato[zipAlterato.length - 1]! ^ 1;

// Un'impronta sbagliata nel deposito è un rosso, e il deposito resta com'è: non si riscarica.
const depositoGuasto = depositoFinto(zipAlterato);
rossoCon("uno zip alterato nel deposito", corsa("pacchetto.ts", "--deposito", depositoGuasto, "--uscita", uscitaFinta()), "ROSSO: l'impronta dello zip non torna");
prova("uno zip alterato non si riscarica", Buffer.compare(readFileSync(join(depositoGuasto, descrizioneVera.zip.nome)), zipAlterato) === 0, "il deposito è cambiato");

const uscitaMancata = uscitaFinta();
rossoCon("un'impronta del file diversa da quella dichiarata", corsa("pacchetto.ts", "--descrizione", descrizioneFinta((d) => void (d.file.sha256 = "0".repeat(64))), "--uscita", uscitaMancata), "ROSSO: l'impronta del file non torna");
prova("con l'impronta sbagliata il file non si scrive", !existsSync(uscitaMancata), "il file è stato scritto");

rossoCon("un'etichetta diversa da quella dell'inventario", corsa("pacchetto.ts", "--descrizione", descrizioneFinta((d) => void (d.etichetta = "v0.0.0")), "--uscita", uscitaFinta()), "ROSSO: l'etichetta del pacchetto (v0.0.0) non è quella dell'inventario");
rossoCon("un file che non è nello zip", corsa("pacchetto.ts", "--descrizione", descrizioneFinta((d) => void (d.file.percorso = "altro/assente.cjs")), "--uscita", uscitaFinta()), "ROSSO: il file non è nello zip: altro/assente.cjs");

// L'adattatore alterato: la riga del rosso nomina quella che differisce.
const adattatoreAlterato = join(pacchetti, "adattatore.ts");
copyFileSync(join(RADICE, "extensions", "libreria", "src", "index.ts"), adattatoreAlterato);
writeFileSync(adattatoreAlterato, `// riga in più\n${readFileSync(adattatoreAlterato, "utf8")}`);
rossoCon("un adattatore diverso dal punto d'ingresso", corsa("pacchetto.ts", "--adattatore", adattatoreAlterato, "--uscita", uscitaFinta()), "ROSSO: l'adattatore non è quello di AlgoDesign alla riga 1");

// Senza deposito e senza rete non si è potuto misurare: un fermo, mai un rosso.
fermoCon("un indirizzo irraggiungibile", corsa("pacchetto.ts", "--descrizione", descrizioneFinta((d) => void (d.indirizzo = "http://127.0.0.1:9/assente.zip")), "--deposito", depositoFinto(), "--uscita", uscitaFinta()), "non si è potuto scaricare");

// Ciò che arriva dalla rete entra nel deposito solo se l'impronta torna. La rete qui è un file locale.
const fontePer = (contenuto: Buffer): string => {
  const f = join(pacchetti, `fonte ${++numero}.zip`);
  writeFileSync(f, contenuto);
  return descrizioneFinta((d) => void (d.indirizzo = pathToFileURL(f).href));
};
const depositoBuono = depositoFinto();
verde("il pacchetto scaricato", corsa("pacchetto.ts", "--descrizione", fontePer(zipVero), "--deposito", depositoBuono, "--uscita", uscitaFinta()));
prova("lo zip scaricato entra nel deposito", existsSync(join(depositoBuono, descrizioneVera.zip.nome)), "il deposito è vuoto");
const depositoVuoto = depositoFinto();
rossoCon("uno zip scaricato con l'impronta sbagliata", corsa("pacchetto.ts", "--descrizione", fontePer(zipAlterato), "--deposito", depositoVuoto, "--uscita", uscitaFinta()), "ROSSO: l'impronta dello zip non torna");
prova("uno zip con l'impronta sbagliata non entra nel deposito", !existsSync(join(depositoVuoto, descrizioneVera.zip.nome)), "lo zip è entrato nel deposito");

console.log(`prove: ${fatte}/${PROVE_ATTESE}, fallite ${fallite.length}`);
if (fatte !== PROVE_ATTESE) {
  console.log(`FERMO: il denominatore non torna: dichiarate ${PROVE_ATTESE}, eseguite ${fatte}`);
  process.exit(2);
}
console.log(`ESITO: ${fallite.length === 0 ? "VERDE" : "ROSSO"}`);
process.exit(fallite.length === 0 ? 0 : 1);

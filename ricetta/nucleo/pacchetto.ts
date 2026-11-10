// Il pacchetto del nucleo pubblicato con la release di AlgoDesign: preso dal deposito o dalla rete, con l'impronta dello zip e quella del file confrontate.
//
//   bun ricetta/nucleo/pacchetto.ts        mette il file della release al posto del pacchetto (atteso verde)
//   opzioni: --repo <cartella>, --descrizione <file>, --deposito <cartella>, --uscita <file>, --adattatore <file>
//
// Uscite: 0 verde, 1 rosso, 2 fermo (non si è potuto misurare). Un'impronta sbagliata è un rosso e non fa riscaricare nulla.
//
// L'adattatore resta in questo repository per i tipi: qui si confronta col punto d'ingresso di AlgoDesign al commit dell'etichetta, a specificatori
// uguali, perché i tipi siano quelli del file che si usa.
//
// Che cosa NON guarda:
// - che il pacchetto si comporti come i sorgenti: lo dice la prova di conformità;
// - che il file sia stato costruito davvero da quell'etichetta: si confronta con l'impronta dichiarata;
// - gli altri file dello zip.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { inflateRawSync } from "node:zlib";
import { fermo, fermoSeEtichettaSpostata, git, impronta, INVENTARIO, leggiInventario, RADICE, repoDelNucleo, rosso } from "./comune";

type Descrizione = { etichetta: string; indirizzo: string; zip: { nome: string; sha256: string }; file: { percorso: string; sha256: string } };

const { values: opzioni } = parseArgs({
  args: Bun.argv.slice(2),
  options: { repo: { type: "string" }, descrizione: { type: "string" }, deposito: { type: "string" }, uscita: { type: "string" }, adattatore: { type: "string" } },
  strict: true,
});

const descrizione = JSON.parse(readFileSync(opzioni.descrizione ?? join(import.meta.dir, "pacchetto.json"), "utf8")) as Descrizione;
const deposito = opzioni.deposito ?? join(import.meta.dir, "scaricato");
const uscita = opzioni.uscita ?? join(RADICE, "extensions", "libreria", "dist", "libreria.cjs");
const adattatore = opzioni.adattatore ?? join(RADICE, "extensions", "libreria", "src", "index.ts");

const inventario = leggiInventario(INVENTARIO);
console.log(`pacchetto ${descrizione.zip.nome}, etichetta ${descrizione.etichetta}`);
if (descrizione.etichetta !== inventario.etichetta) rosso(`l'etichetta del pacchetto (${descrizione.etichetta}) non è quella dell'inventario (${inventario.etichetta})`);

// --- L'adattatore, contro il punto d'ingresso al commit dell'etichetta.
const repo = repoDelNucleo(opzioni.repo);
fermoSeEtichettaSpostata(repo, inventario);
const atteso = new TextDecoder().decode(git(repo, "show", `${inventario.commit}:app/entrypoint/index.ts`)).replaceAll('from "../', 'from "nucleo/');
const trovato = readFileSync(adattatore, "utf8").replaceAll("\r\n", "\n");
if (trovato !== atteso) {
  const righeAttese = atteso.split("\n");
  const prima = trovato.split("\n").findIndex((r, i) => r !== righeAttese[i]);
  rosso(`l'adattatore non è quello di AlgoDesign alla riga ${prima + 1}`);
}
console.log(`adattatore uguale al punto d'ingresso: ${trovato.split("\n").length} righe`);

// --- Lo zip: dal deposito se c'è, altrimenti dalla rete. Nel deposito entra soltanto ciò che ha l'impronta giusta.
async function scarica(indirizzo: string): Promise<Buffer> {
  try {
    const r = await fetch(indirizzo);
    if (!r.ok) fermo(`non si è potuto scaricare ${indirizzo}: risposta ${r.status}`);
    return Buffer.from(await r.arrayBuffer());
  } catch (e) {
    fermo(`non si è potuto scaricare ${indirizzo}: ${e instanceof Error ? e.message : String(e)}`);
  }
}

const nelDeposito = join(deposito, descrizione.zip.nome);
const giaLi = existsSync(nelDeposito);
const zip = giaLi ? readFileSync(nelDeposito) : await scarica(descrizione.indirizzo);
console.log(`zip ${giaLi ? "dal deposito" : "dalla rete"}: ${zip.length} byte`);
const improntaDelloZip = impronta(zip);
if (improntaDelloZip !== descrizione.zip.sha256) rosso(`l'impronta dello zip non torna: dichiarata ${descrizione.zip.sha256}, misurata ${improntaDelloZip}`);
if (!giaLi) {
  mkdirSync(deposito, { recursive: true });
  writeFileSync(nelDeposito, zip);
}

/** Una voce dello zip, letta dall'indice in coda al file: non dipende da quale `tar` c'è sulla macchina. */
function vocedelloZip(archivio: Buffer, nome: string): Buffer | null {
  let fine = archivio.length - 22;
  while (fine >= 0 && archivio.readUInt32LE(fine) !== 0x06054b50) fine--;
  if (fine < 0) return null;
  const voci = archivio.readUInt16LE(fine + 10);
  let p = archivio.readUInt32LE(fine + 16);
  for (let i = 0; i < voci; i++) {
    const lunghezzaNome = archivio.readUInt16LE(p + 28);
    if (archivio.toString("utf8", p + 46, p + 46 + lunghezzaNome) === nome) {
      const testata = archivio.readUInt32LE(p + 42);
      const inizio = testata + 30 + archivio.readUInt16LE(testata + 26) + archivio.readUInt16LE(testata + 28);
      const dati = archivio.subarray(inizio, inizio + archivio.readUInt32LE(p + 20));
      const metodo = archivio.readUInt16LE(p + 10);
      if (metodo === 0) return Buffer.from(dati);
      if (metodo === 8) return inflateRawSync(dati);
      fermo(`la voce ${nome} usa un metodo di compressione sconosciuto: ${metodo}`);
    }
    p += 46 + lunghezzaNome + archivio.readUInt16LE(p + 30) + archivio.readUInt16LE(p + 32);
  }
  return null;
}

// --- Il file: scritto soltanto dopo aver confrontato la sua impronta.
const file = vocedelloZip(zip, descrizione.file.percorso);
if (file === null) rosso(`il file non è nello zip: ${descrizione.file.percorso}`);
const improntaDelFile = impronta(file);
if (improntaDelFile !== descrizione.file.sha256) rosso(`l'impronta del file non torna: dichiarata ${descrizione.file.sha256}, misurata ${improntaDelFile}`);
mkdirSync(dirname(uscita), { recursive: true });
writeFileSync(uscita, file);
console.log(`file ${descrizione.file.percorso}: ${file.length} byte, impronta ${improntaDelFile}`);
console.log("ESITO: VERDE");

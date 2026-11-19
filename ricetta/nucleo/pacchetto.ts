// Il pacchetto del nucleo pubblicato con la release di AlgoDesign: preso dal deposito o dalla rete, con l'impronta dello zip e quella del file confrontate.
//
//   bun ricetta/nucleo/pacchetto.ts        mette il file della release al posto del pacchetto (atteso verde)
//   opzioni: --repo <cartella>, --descrizione <file>, --deposito <cartella>, --uscita <file>, --adattatore <file>
//
// Il pacchetto in uso è il file della release, all'etichetta dell'inventario. Il modo che lo costruiva dal commit (`dal_commit` in
// pacchetto.json, l'eccezione del contratto 1.1 fino alla release che lo porta) è tolto: una descrizione che lo porta ancora è un
// rosso, non un ramo che si percorre.
//
// Uscite: 0 verde, 1 rosso, 2 fermo (non si è potuto misurare). Un'impronta sbagliata è un rosso e non fa riscaricare nulla.
//
// L'adattatore resta in questo repository per i tipi: qui si confronta col punto d'ingresso di AlgoDesign al commit dell'etichetta, a specificatori
// uguali, perché i tipi siano quelli del file che si usa.
//
// Il contratto ha un numero (`contratto` in pacchetto.json, una voce per etichetta, l'ultima è quella in uso) legato all'impronta del
// punto d'ingresso a quell'etichetta: un campo o un valore nuovo porta il numero da 1.0 a 1.1. Rosso se un numero non è nella forma
// maggiore.minore (cifre senza zeri in testa), se una voce non ha l'etichetta o ha un commit, se due voci hanno la stessa etichetta, se
// l'ultima non è per l'etichetta del pacchetto, se l'impronta misurata non è quella dell'ultima voce, se fra due voci consecutive il
// numero scende, e se l'impronta cambia e il numero no (o il numero cambia e l'impronta no).
// Delle voci prima dell'ultima l'impronta non si misura: la lista storica si legge com'è scritta.
//
// Che cosa NON guarda:
// - che il pacchetto si comporti come i sorgenti: lo dice la prova di conformità;
// - che il file della release sia stato costruito davvero da quell'etichetta: si confronta con l'impronta dichiarata;
// - gli altri file dello zip.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { fermo, fermoSeEtichettaSpostata, git, impronta, INVENTARIO, leggiInventario, RADICE, repoDelNucleo, riferimentoDi, rosso, vocedelloZip } from "./comune";

type VoceDelContratto = { versione: string; etichetta?: string; commit?: string; punto_ingresso_sha256: string };
type Descrizione = { etichetta: string; indirizzo: string; zip: { nome: string; sha256: string }; file: { percorso: string; sha256: string }; dal_commit?: unknown; contratto?: VoceDelContratto[] };

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
console.log(`pacchetto ${descrizione.zip.nome}, etichetta ${descrizione.etichetta}; inventario ${riferimentoDi(inventario)}`);
if (descrizione.dal_commit !== undefined) rosso("pacchetto.json porta ancora dal_commit: il pacchetto costruito dal commit è tolto, il pacchetto in uso è il file della release");
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

// --- Il contratto: il numero e l'impronta del punto d'ingresso, voce per voce.
const contratto = descrizione.contratto ?? [];
const ultima = contratto.at(-1) ?? rosso("pacchetto.json non dichiara il contratto");
for (const v of contratto) if (!/^(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(v.versione)) rosso(`il numero del contratto non è nella forma maggiore.minore: ${v.versione}`);
for (const v of contratto) if (v.etichetta === undefined || v.commit !== undefined) rosso(`la voce ${v.versione} del contratto deve avere un'etichetta, e nessun commit`);
const ripetuti = contratto.map((v) => v.etichetta!).filter((e, i, tutte) => tutte.indexOf(e) !== i);
if (ripetuti.length > 0) rosso(`il contratto ha più voci per la stessa etichetta: ${[...new Set(ripetuti)].join(", ")}`);
const numeroDi = (v: VoceDelContratto): [number, number] => v.versione.split(".").map(Number) as [number, number];
if (ultima.etichetta !== descrizione.etichetta) rosso(`l'ultima voce del contratto è per ${ultima.etichetta}, il pacchetto per ${descrizione.etichetta}`);
const improntaIngresso = impronta(git(repo, "show", `${inventario.commit}:app/entrypoint/index.ts`));
if (improntaIngresso !== ultima.punto_ingresso_sha256)
  rosso(`il punto d'ingresso a ${ultima.etichetta} ha l'impronta ${improntaIngresso}, il contratto ${ultima.versione} dichiara ${ultima.punto_ingresso_sha256}`);
for (let i = 1; i < contratto.length; i++) {
  const [a, b] = [contratto[i - 1]!, contratto[i]!];
  const [[am, an], [bm, bn]] = [numeroDi(a), numeroDi(b)];
  if (bm < am || (bm === am && bn < an)) rosso(`contratto, da ${a.etichetta} a ${b.etichetta}: il numero scende da ${a.versione} a ${b.versione}`);
  const cambiaImpronta = a.punto_ingresso_sha256 !== b.punto_ingresso_sha256;
  if (cambiaImpronta !== (a.versione !== b.versione))
    rosso(`contratto, da ${a.etichetta} a ${b.etichetta}: ${cambiaImpronta ? `l'impronta del punto d'ingresso cambia e il numero resta ${b.versione}` : `il numero passa da ${a.versione} a ${b.versione} e l'impronta del punto d'ingresso non cambia`}`);
}
console.log(`contratto ${ultima.versione}: punto d'ingresso a ${ultima.etichetta}, impronta ${improntaIngresso.slice(0, 12)}; voci ${contratto.length}`);

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

// --- Il file: scritto soltanto dopo aver confrontato la sua impronta.
const file = vocedelloZip(zip, descrizione.file.percorso);
if (file === null) rosso(`il file non è nello zip: ${descrizione.file.percorso}`);
const improntaDelFile = impronta(file);
if (improntaDelFile !== descrizione.file.sha256) rosso(`l'impronta del file non torna: dichiarata ${descrizione.file.sha256}, misurata ${improntaDelFile}`);
console.log(`file ${descrizione.file.percorso}: ${file.length} byte, impronta ${improntaDelFile}`);
mkdirSync(dirname(uscita), { recursive: true });
writeFileSync(uscita, file);
console.log("ESITO: VERDE");

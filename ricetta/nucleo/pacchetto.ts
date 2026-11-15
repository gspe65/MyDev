// Il pacchetto del nucleo pubblicato con la release di AlgoDesign: preso dal deposito o dalla rete, con l'impronta dello zip e quella del file confrontate.
//
//   bun ricetta/nucleo/pacchetto.ts        mette il pacchetto in uso al posto del pacchetto (atteso verde)
//   opzioni: --repo <cartella>, --descrizione <file>, --deposito <cartella>, --uscita <file>, --adattatore <file>, --estratto <cartella>
//
// Due modi. Senza `dal_commit` in pacchetto.json il pacchetto in uso è il file della release. Con `dal_commit` (l'eccezione del contratto
// dal commit, fino alla release che lo porta) il pacchetto in uso si costruisce dall'estratto verificato, con le opzioni di AlgoDesign
// (`bun build app/entrypoint/index.ts --target=node --format=cjs --minify-whitespace`), e deve avere i byte e l'impronta dichiarati;
// il riferimento dell'inventario è allora quel commit, senza etichetta. Lo zip della release si verifica in tutti e due i modi e resta
// nel deposito: è il nucleo che le estensioni già distribuite portano (`collaudo/algo/prova.ts`), e la conformità lo prova ancora.
//
// Uscite: 0 verde, 1 rosso, 2 fermo (non si è potuto misurare). Un'impronta sbagliata è un rosso e non fa riscaricare nulla.
//
// L'adattatore resta in questo repository per i tipi: qui si confronta col punto d'ingresso di AlgoDesign al commit dell'etichetta, a specificatori
// uguali, perché i tipi siano quelli del file che si usa.
//
// Il contratto ha un numero (`contratto` in pacchetto.json, una voce per riferimento, l'ultima è quella in uso) legato all'impronta del
// punto d'ingresso a quel riferimento: un campo o un valore nuovo porta il numero da 1.0 a 1.1. Una voce ha un'etichetta o un commit
// (scritto per intero), uno solo. Rosso se un numero non è nella forma maggiore.minore (cifre senza zeri in testa), se due voci hanno lo
// stesso riferimento, se l'ultima non è per il riferimento del pacchetto in uso, se l'impronta misurata non è quella dell'ultima voce,
// se fra due voci consecutive il numero scende, e se l'impronta cambia e il numero no (o il numero cambia e l'impronta no).
// Delle voci prima dell'ultima l'impronta non si misura: la lista storica si legge com'è scritta.
//
// Che cosa NON guarda:
// - che il pacchetto si comporti come i sorgenti: lo dice la prova di conformità;
// - che il file della release sia stato costruito davvero da quell'etichetta: si confronta con l'impronta dichiarata;
// - gli altri file dello zip;
// - nel modo dal commit, la versione di Bun: si stampa accanto a quella dichiarata, e decide l'impronta (un altro Bun può dare altri byte).

import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { parseArgs } from "node:util";
import { ESTRATTO, fermo, fermoSeEtichettaSpostata, git, impronta, INVENTARIO, leggiInventario, RADICE, repoDelNucleo, riferimentoDi, rosso, vocedelloZip } from "./comune";

type VoceDelContratto = { versione: string; etichetta?: string; commit?: string; punto_ingresso_sha256: string };
type DalCommit = { commit: string; byte: number; sha256: string; bun: string };
type Descrizione = { etichetta: string; indirizzo: string; zip: { nome: string; sha256: string }; file: { percorso: string; sha256: string }; dal_commit?: DalCommit; contratto?: VoceDelContratto[] };

const { values: opzioni } = parseArgs({
  args: Bun.argv.slice(2),
  options: { repo: { type: "string" }, descrizione: { type: "string" }, deposito: { type: "string" }, uscita: { type: "string" }, adattatore: { type: "string" }, estratto: { type: "string" } },
  strict: true,
});

const descrizione = JSON.parse(readFileSync(opzioni.descrizione ?? join(import.meta.dir, "pacchetto.json"), "utf8")) as Descrizione;
const deposito = opzioni.deposito ?? join(import.meta.dir, "scaricato");
const uscita = opzioni.uscita ?? join(RADICE, "extensions", "libreria", "dist", "libreria.cjs");
const adattatore = opzioni.adattatore ?? join(RADICE, "extensions", "libreria", "src", "index.ts");
const estratto = opzioni.estratto ?? ESTRATTO;

const inventario = leggiInventario(INVENTARIO);
const dalCommit = descrizione.dal_commit;
console.log(`pacchetto ${descrizione.zip.nome}, etichetta ${descrizione.etichetta}${dalCommit === undefined ? "" : `; in uso quello costruito dal commit ${dalCommit.commit}`}`);
if (dalCommit === undefined) {
  if (descrizione.etichetta !== inventario.etichetta) rosso(`l'etichetta del pacchetto (${descrizione.etichetta}) non è quella dell'inventario (${riferimentoDi(inventario)})`);
} else if (inventario.etichetta !== undefined || dalCommit.commit !== inventario.commit) {
  rosso(`il commit del pacchetto (${dalCommit.commit}) non è il riferimento dell'inventario (${riferimentoDi(inventario)})`);
}

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
for (const v of contratto) if ((v.etichetta === undefined) === (v.commit === undefined)) rosso(`la voce ${v.versione} del contratto deve avere un'etichetta o un commit, uno solo`);
/** Il riferimento di una voce, come si legge: «v1.0.0», o «commit <hash>». */
const rif = (v: { etichetta?: string; commit?: string }): string => (v.etichetta !== undefined ? v.etichetta : `commit ${v.commit}`);
const ripetuti = contratto.map(rif).filter((e, i, tutte) => tutte.indexOf(e) !== i);
if (ripetuti.length > 0) rosso(`il contratto ha più voci per lo stesso riferimento: ${[...new Set(ripetuti)].join(", ")}`);
const numeroDi = (v: VoceDelContratto): [number, number] => v.versione.split(".").map(Number) as [number, number];
const delPacchetto = dalCommit === undefined ? descrizione.etichetta : `commit ${dalCommit.commit}`;
if (rif(ultima) !== delPacchetto) rosso(`l'ultima voce del contratto è per ${rif(ultima)}, il pacchetto in uso per ${delPacchetto}`);
const improntaIngresso = impronta(git(repo, "show", `${inventario.commit}:app/entrypoint/index.ts`));
if (improntaIngresso !== ultima.punto_ingresso_sha256)
  rosso(`il punto d'ingresso a ${rif(ultima)} ha l'impronta ${improntaIngresso}, il contratto ${ultima.versione} dichiara ${ultima.punto_ingresso_sha256}`);
for (let i = 1; i < contratto.length; i++) {
  const [a, b] = [contratto[i - 1]!, contratto[i]!];
  const [[am, an], [bm, bn]] = [numeroDi(a), numeroDi(b)];
  if (bm < am || (bm === am && bn < an)) rosso(`contratto, da ${rif(a)} a ${rif(b)}: il numero scende da ${a.versione} a ${b.versione}`);
  const cambiaImpronta = a.punto_ingresso_sha256 !== b.punto_ingresso_sha256;
  if (cambiaImpronta !== (a.versione !== b.versione))
    rosso(`contratto, da ${rif(a)} a ${rif(b)}: ${cambiaImpronta ? `l'impronta del punto d'ingresso cambia e il numero resta ${b.versione}` : `il numero passa da ${a.versione} a ${b.versione} e l'impronta del punto d'ingresso non cambia`}`);
}
console.log(`contratto ${ultima.versione}: punto d'ingresso a ${rif(ultima)}, impronta ${improntaIngresso.slice(0, 12)}; voci ${contratto.length}`);

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
if (dalCommit === undefined) {
  mkdirSync(dirname(uscita), { recursive: true });
  writeFileSync(uscita, file);
  console.log("ESITO: VERDE");
  process.exit(0);
}

// --- Il modo dal commit: il pacchetto in uso nasce dall'estratto, e si scrive soltanto se byte e impronta sono quelli dichiarati.
console.log("il file della release resta nel deposito (lo portano le estensioni distribuite) e non si scrive al posto del pacchetto");
const ingresso = join(estratto, "app", "entrypoint", "index.ts");
if (!existsSync(ingresso)) fermo(`manca l'estratto del punto d'ingresso: ${ingresso} (bun ricetta/nucleo/estrai.ts)`);
const temporanea = mkdtempSync(join(tmpdir(), "nucleo  costruzione-"));
process.on("exit", () => rmSync(temporanea, { recursive: true, force: true }));
const costruito = join(temporanea, "algodesign-core.cjs");
const costruzione = Bun.spawnSync([process.execPath, "build", ingresso, "--target=node", "--format=cjs", "--minify-whitespace", `--outfile=${costruito}`], { stdout: "pipe", stderr: "pipe" });
if (costruzione.exitCode !== 0 || !existsSync(costruito)) rosso(`la costruzione dall'estratto è uscita ${costruzione.exitCode}: ${costruzione.stdout.toString()}${costruzione.stderr.toString()}`);
const byteCostruiti = readFileSync(costruito);
const improntaCostruita = impronta(byteCostruiti);
console.log(`costruito dal commit ${dalCommit.commit} con bun ${Bun.version} (dichiarato ${dalCommit.bun}): ${byteCostruiti.length} byte, impronta ${improntaCostruita}`);
if (improntaCostruita !== dalCommit.sha256 || byteCostruiti.length !== dalCommit.byte)
  rosso(`l'impronta del pacchetto costruito non torna: dichiarata ${dalCommit.sha256} (${dalCommit.byte} byte, bun ${dalCommit.bun}), misurata ${improntaCostruita} (${byteCostruiti.length} byte, bun ${Bun.version})`);
mkdirSync(dirname(uscita), { recursive: true });
writeFileSync(uscita, byteCostruiti);
console.log("ESITO: VERDE");

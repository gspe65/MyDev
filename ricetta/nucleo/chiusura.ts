// La chiusura degli import del nucleo, al commit di un'etichetta, e il suo confronto con l'inventario.
//
//   bun ricetta/nucleo/chiusura.ts                                    ricalcola e confronta (atteso verde)
//   bun ricetta/nucleo/chiusura.ts --scrivi --etichetta <etichetta>   ricalcola e riscrive l'inventario
//   opzioni: --repo <cartella>, --inventario <file>
//
// Chi decide l'elenco è il compilatore: `tsc --listFilesOnly` sull'intero `app/` del commit, estratto in una cartella
// temporanea, a partire da un file che importa per nome le funzioni d'ingresso (una funzione sparita è un errore).
// `--listFilesOnly` esce 0 anche se un import non si risolve, e quel file sparisce in silenzio: per questo nello stesso
// giro gira un `tsc` completo, che deve uscire 0, e un giro col file tolto, che deve uscire rosso.
//
// Che cosa NON guarda:
// - un import con lo specificatore calcolato (`import(x)`): il compilatore non lo segue;
// - un file letto a run time per nome, senza import;
// - le spie vedono il codice senza commenti e senza tipi, solo le parole elencate; un `import type` da `node:` non lo
//   vedono: lo ferma il `tsc` completo, che gira senza librerie né tipi di Node e di Bun;
// - che cosa fanno le funzioni: la prova di conformità è un'altra.

import { existsSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, isAbsolute, join, normalize, relative } from "node:path";
import { parseArgs } from "node:util";
import { commitDellEtichetta, differenzeDegliElenchi, fermo, FORMA, git, impronta, INVENTARIO, leggiInventario, RADICE, repoDelNucleo, rosso, type Inventario, type VoceDelFile } from "./comune";

/** Le funzioni d'ingresso del contratto, più quelle con cui lo strumento differenziale genera fuori dalla finestra. */
const INGRESSI: { modulo: string; funzioni: string[] }[] = [
  { modulo: "core/progetto/formato", funzioni: ["apri", "salva"] },
  { modulo: "core/controllo/controllo", funzioni: ["controlla", "tetti"] },
  { modulo: "core/modifica/operazioni", funzioni: ["progettoNuovo"] },
  { modulo: "core/lettore/accademico", funzioni: ["leggiAccademico", "aggiungiAllaLibreria"] },
  { modulo: "core/genera/forma", funzioni: ["testoDelCodice"] },
  { modulo: "core/genera/linguaggi", funzioni: ["linguaggi"] },
  { modulo: "ui/genera/parole", funzioni: ["paroleDelloPseudocodice"] },
];

const FILE_DEGLI_INGRESSI = "__ingressi__.ts";

/** Il controllo positivo del tsc completo: un file vero della chiusura, che non è quello di un difetto da correggere. */
const FILE_DA_TOGLIERE = "app/core/interprete/potenza.ts";
/** Il controllo positivo dell'elenco: un arco noto. */
const ARCO_NOTO = { da: "app/ui/genera/parole.ts", a: "app/i18n/lingue.ts" };

/** Le spie, ognuna col file vero che la porta davvero. Su un file che non c'è il controllo si ferma. */
const SPIE: { nome: string; rx: RegExp; controllo: string }[] = [
  { nome: "Bun", rx: /\bBun\b|\bbun:[a-z]/g, controllo: "app/strumenti/differenziale.ts" },
  { nome: "node:", rx: /\bnode:[a-z]/g, controllo: "app/strumenti/differenziale.ts" },
  // Con l'accesso a una proprietà: nei dizionari «window» e «document» sono parole inglesi. L'uso nudo lo ferma il tsc completo.
  { nome: "DOM", rx: /\b(?:document|window|navigator|localStorage|sessionStorage)\.[A-Za-z]|\baddEventListener\b|\bHTML[A-Za-z]*Element\b/g, controllo: "app/ui/avvio.tsx" },
];

/**
 * I colpi noti: testo, non codice del nucleo. Un esito che non li ritrova è un rilevatore rotto, non una buona notizia.
 * I due `node:` sono righe del programma che il generatore TypeScript scrive per lo studente, non import del nucleo:
 * il nucleo non li esegue, e il tsc completo, senza i tipi di Node, lo conferma.
 */
const COLPI_ATTESI: { spia: string; file: string; testo: string }[] = [
  { spia: "node:", file: "app/core/genera/typescript.ts", testo: '"node:child_process"' },
  { spia: "node:", file: "app/core/genera/typescript.ts", testo: '"node:fs"' },
];

/** Una parola che in questo file sta solo in un commento: togliere i commenti deve spegnerla. */
const NEL_COMMENTO = { spia: "Bun", file: "app/core/progetto/formato.ts" };

const { values: opzioni } = parseArgs({
  args: Bun.argv.slice(2),
  options: { repo: { type: "string" }, inventario: { type: "string" }, etichetta: { type: "string" }, scrivi: { type: "boolean", default: false } },
  strict: true,
});

const repo = repoDelNucleo(opzioni.repo);
const percorsoInventario = opzioni.inventario ?? INVENTARIO;
const precedente: Inventario | null = opzioni.scrivi && !existsSync(percorsoInventario) ? null : leggiInventario(percorsoInventario);
const etichetta = opzioni.etichetta ?? precedente?.etichetta ?? fermo("manca l'etichetta (--etichetta)");
const commit = commitDellEtichetta(repo, etichetta);
console.log(`etichetta ${etichetta}, commit ${commit}`);

function tsc(cartella: string, ...argomenti: string[]): { uscita: number; testo: string } {
  const eseguibile = Bun.which("tsc", { PATH: join(RADICE, "node_modules", ".bin") });
  if (eseguibile === null) fermo("tsc non c'è: bun install alla radice");
  const p = Bun.spawnSync([eseguibile, "-p", "tsconfig.chiusura.json", ...argomenti], { cwd: cartella, stdout: "pipe", stderr: "pipe" });
  return { uscita: p.exitCode, testo: p.stdout.toString() + p.stderr.toString() };
}

/** I file che il compilatore segue, dentro l'albero; quelli fuori possono essere solo le sue librerie. */
function elencoDelCompilatore(albero: string): string[] {
  const { uscita, testo } = tsc(albero, "--listFilesOnly");
  if (uscita !== 0) fermo(`tsc --listFilesOnly è uscito ${uscita}: ${testo}`);
  const righe = testo.split(/\r?\n/).filter((r) => r !== "");
  const dentro: string[] = [];
  const librerie: string[] = [];
  for (const riga of righe) {
    const r = relative(albero, normalize(riga));
    if (!r.startsWith("..") && !isAbsolute(r)) {
      const p = r.replaceAll("\\", "/");
      if (p !== FILE_DEGLI_INGRESSI) dentro.push(p);
    } else if (/^lib\.[a-z0-9.]+\.d\.ts$/.test(basename(riga))) librerie.push(riga);
    else rosso(`il compilatore segue un file fuori dall'albero che non è una sua libreria: ${riga}`);
  }
  console.log(`tsc --listFilesOnly: righe ${righe.length} = ${dentro.length} del nucleo + 1 degli ingressi + ${librerie.length} librerie del compilatore`);
  return dentro.sort();
}

function righeConLaSpia(codice: string, rx: RegExp): string[] {
  return codice.split("\n").filter((r) => r.search(new RegExp(rx.source)) >= 0);
}

function senzaCommenti(albero: string, file: string): string {
  if (!existsSync(join(albero, file))) fermo(`il file del controllo positivo non c'è: ${file}`);
  const t = new Bun.Transpiler({ loader: file.endsWith("x") ? "tsx" : "ts", trimUnusedImports: false });
  return t.transformSync(readFileSync(join(albero, file), "utf8"));
}

const albero = mkdtempSync(join(tmpdir(), "nucleo  chiusura-"));
// All'uscita, non in un `finally`: `process.exit` di un rosso non lo eseguirebbe.
process.on("exit", () => rmSync(albero, { recursive: true, force: true }));
let ricalcolati: VoceDelFile[];
{
  await new Bun.Archive(git(repo, "archive", "--format=tar", commit, "--", "app")).extract(albero);
  const importazioni = INGRESSI.map((i) => `import { ${i.funzioni.join(", ")} } from "./app/${i.modulo}";`).join("\n");
  writeFileSync(join(albero, FILE_DEGLI_INGRESSI), `${importazioni}\n`);
  writeFileSync(
    join(albero, "tsconfig.chiusura.json"),
    JSON.stringify({
      compilerOptions: { target: "ES2022", lib: ["ES2023"], module: "ESNext", moduleResolution: "bundler", resolveJsonModule: true, strict: true, noUncheckedIndexedAccess: true, verbatimModuleSyntax: true, noEmit: true, skipLibCheck: true, types: [] },
      files: [FILE_DEGLI_INGRESSI],
    }),
  );
  console.log(`ingressi: ${INGRESSI.length} moduli, ${INGRESSI.flatMap((i) => i.funzioni).length} funzioni`);

  // Il tsc completo: un import irrisolto, una funzione d'ingresso sparita, un `document` o un `process` sono errori.
  const completo = tsc(albero);
  if (completo.uscita !== 0) rosso(`il tsc completo sulla chiusura è uscito ${completo.uscita}:\n${completo.testo}`);
  console.log("tsc completo sulla chiusura: uscita 0 (senza librerie del DOM, senza tipi di Node e di Bun)");

  const elenco = elencoDelCompilatore(albero);

  // L'arco noto, letto dalla spiegazione del compilatore: chi importa ciascun file.
  let corrente = "";
  let arco = false;
  for (const riga of tsc(albero, "--explainFiles").testo.split(/\r?\n/)) {
    if (riga !== "" && !riga.startsWith(" ")) corrente = riga.replaceAll("\\", "/");
    else if (corrente === ARCO_NOTO.a && riga.includes(`from file '${ARCO_NOTO.da}'`)) arco = true;
  }
  if (!arco) fermo(`controllo positivo spento: l'arco ${ARCO_NOTO.da} -> ${ARCO_NOTO.a} non si legge`);
  console.log(`controllo positivo dell'elenco: arco ${ARCO_NOTO.da} -> ${ARCO_NOTO.a} letto`);

  // Le spie, sul codice senza commenti.
  for (const spia of SPIE) {
    const colpi = elenco.flatMap((f) => righeConLaSpia(senzaCommenti(albero, f), spia.rx).map((riga) => ({ file: f, riga })));
    const nelControllo = righeConLaSpia(senzaCommenti(albero, spia.controllo), spia.rx).length;
    if (nelControllo === 0) fermo(`controllo positivo spento: la spia ${spia.nome} non si accende su ${spia.controllo}`);
    const attesi = COLPI_ATTESI.filter((a) => a.spia === spia.nome);
    const inattesi = colpi.filter((c) => !attesi.some((a) => a.file === c.file && c.riga.includes(a.testo)));
    const mancanti = attesi.filter((a) => !colpi.some((c) => a.file === c.file && c.riga.includes(a.testo)));
    if (mancanti.length > 0) fermo(`il colpo atteso della spia ${spia.nome} non c'è più: ${mancanti.map((m) => `${m.file} [${m.testo}]`).join(", ")}`);
    console.log(`spia ${spia.nome}: ${inattesi.length} colpi su ${elenco.length} file (${attesi.length} attesi, di testo) · controllo positivo ${spia.controllo}: ${nelControllo}`);
    if (inattesi.length > 0) rosso(`spia ${spia.nome}:\n${inattesi.map((c) => `  ${c.file}: ${c.riga.trim()}`).join("\n")}`);
  }
  const conCommento = new TextDecoder().decode(git(repo, "show", `${commit}:${NEL_COMMENTO.file}`));
  const spiaDelCommento = SPIE.find((s) => s.nome === NEL_COMMENTO.spia)!;
  if (righeConLaSpia(conCommento, spiaDelCommento.rx).length === 0 || righeConLaSpia(senzaCommenti(albero, NEL_COMMENTO.file), spiaDelCommento.rx).length !== 0) {
    fermo(`controllo spento: in ${NEL_COMMENTO.file} la parola ${NEL_COMMENTO.spia} doveva stare solo in un commento`);
  }
  console.log(`controllo dei commenti: ${NEL_COMMENTO.spia} in ${NEL_COMMENTO.file} c'è nel testo e non nel codice`);

  // Il controllo positivo del tsc completo: tolto un file vero, l'elenco si accorcia in silenzio e il completo è rosso.
  renameSync(join(albero, FILE_DA_TOGLIERE), join(albero, `${FILE_DA_TOGLIERE}.tolto`));
  const senza = tsc(albero);
  const elencoSenza = tsc(albero, "--listFilesOnly");
  renameSync(join(albero, `${FILE_DA_TOGLIERE}.tolto`), join(albero, FILE_DA_TOGLIERE));
  if (senza.uscita === 0 || !senza.testo.includes("TS2307")) fermo(`controllo positivo spento: tolto ${FILE_DA_TOGLIERE}, il tsc completo è uscito ${senza.uscita}`);
  if (elencoSenza.testo.includes(basename(FILE_DA_TOGLIERE))) fermo(`controllo positivo spento: tolto ${FILE_DA_TOGLIERE}, l'elenco lo porta ancora`);
  console.log(`controllo positivo del tsc completo: tolto ${FILE_DA_TOGLIERE}, uscita ${senza.uscita} con TS2307`);

  ricalcolati = elenco.map((percorso) => ({ percorso, sha256: impronta(git(repo, "show", `${commit}:${percorso}`)) }));
}

for (const v of ricalcolati) console.log(`  ${v.sha256.slice(0, 12)}  ${v.percorso}`);

if (opzioni.scrivi) {
  const inventario: Inventario = { etichetta, commit, forma: FORMA, file: ricalcolati };
  writeFileSync(percorsoInventario, `${JSON.stringify(inventario, null, 2)}\n`);
  console.log(`inventario scritto: ${relative(RADICE, percorsoInventario).replaceAll("\\", "/")}`);
  console.log(`totale: ${ricalcolati.length}`);
  console.log("ESITO: SCRITTO");
  process.exit(0);
}

const inventario = precedente!;
console.log(`confronto con l'inventario: inventario ${inventario.file.length} · chiusura ${ricalcolati.length}`);
if (inventario.commit !== commit) rosso(`il commit dell'inventario (${inventario.commit}) non è quello dell'etichetta ${etichetta} (${commit})`);
const { soloA: soloInventario, soloB: soloChiusura } = differenzeDegliElenchi(inventario.file.map((v) => v.percorso), ricalcolati.map((v) => v.percorso));
console.log(`solo nell'inventario: ${soloInventario.length} · solo nella chiusura: ${soloChiusura.length}`);
if (soloInventario.length > 0 || soloChiusura.length > 0) {
  rosso([...soloInventario.map((f) => `solo nell'inventario: ${f}`), ...soloChiusura.map((f) => `solo nella chiusura: ${f}`)].join("\n"));
}
const perPercorso = new Map(inventario.file.map((v) => [v.percorso, v.sha256]));
for (const v of ricalcolati) if (perPercorso.get(v.percorso) !== v.sha256) rosso(`l'impronta di ${v.percorso} non torna: inventario ${perPercorso.get(v.percorso)}, commit ${v.sha256}`);
console.log(`impronte confrontate: ${ricalcolati.length}/${inventario.file.length}, tutte uguali`);
console.log(`totale: ${ricalcolati.length}`);
console.log("ESITO: VERDE");

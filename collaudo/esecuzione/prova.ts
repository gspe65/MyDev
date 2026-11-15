// La prova del corpus di esecuzione: il codice C e Python che il `.vsix` di un'unità genera compila coi due compilatori
// dell'unità, gira col suo Python, e su ogni caso d'uso del corpus di AlgoDesign dà l'atteso del caso; ogni differenza ha un
// nome, una specie e un motivo in `DICHIARATE`.
//
//   bun collaudo/esecuzione/prova.ts --unita <radice con due spazi consecutivi> [--lavoro <cartella>]   atteso: ESITO: VERDE
//
// Uscite: 0 verde, 1 rosso, 2 fermo (non si è potuto misurare).
//
// Da dove viene ogni cosa:
// - il codice che si compila e si esegue è quello del pacchetto installato nell'unità dal `.vsix`, generato dal motore
//   dell'editor dell'unità (`genera.cjs`);
// - il corpus, i casi, gli attesi e le regole del confronto vengono da AlgoDesign al commit dell'inventario del nucleo, letti con
//   `git archive` in una cartella con spazi doppi: la funzione che costruisce l'ottenuto dall'uscita di un programma
//   (`ottenutoDaiTesti`, che legge «Errore alla riga N: motivo» e la provenienza delle righe) e la sola funzione che confronta un
//   caso (`esitoDelCaso`). Nessun atteso nasce da un'esecuzione nostra;
// - la provenienza delle righe e i programmi di prova dei casi di una funzione eseguita da sola vengono dal generatore di
//   AlgoDesign a quel commit: il contratto del `.vsix` non li dà. Per i programmi del progetto il testo del `.vsix` deve essere
//   identico a quello del generatore, o la provenienza non varrebbe: è un rosso.
//
// Le specie di una differenza: `unita` (un difetto dell'unità, si corregge qui), `generatore` (una segnalazione ad AlgoDesign,
// dichiarata fino alla sua release), `linguaggio` (un comportamento che il linguaggio non definisce o non ha). Un programma che non
// compila è sempre rosso, anche se il caso è dichiarato: non è mai una differenza. Il C si compila con gcc e clang; il Python passa
// prima dal `compile` del Python dell'unità, in un processo solo e senza scrivere nulla accanto ai sorgenti, e solo ciò che compila
// si esegue.
//
// Gli esiti sono `ESITI_ATTESI`, i casi per 6 esecutori: `DA_UN_PROGRAMMA` vengono da un programma compilato ed eseguito, gli altri
// (i casi dei file con un errore statico, per 6) non eseguono nulla, perché li decide il controllo di AlgoDesign contro l'atteso del
// caso. Le costanti sono controllate a ogni corsa e i numeri si stampano (all'etichetta v1.0.0: 1506, 1392 e 114).
//
// Il motore dell'editor che genera ha un tempo massimo: oltre, il motore si ferma e la prova è rossa, con il suo nome.
//
// Che cosa NON guarda:
// - gli avvisi del compilatore, che si contano e si stampano senza decidere;
// - la console di Windows: ingresso e uscita sono tubi;
// - il pseudocodice, «Accademico» e il TypeScript, che l'unità non esegue;
// - l'editor: l'esempio dall'editor è una prova con la finestra, a parte;
// - che i casi siano quelli giusti: li scrive AlgoDesign;
// - un ingresso con una riga vuota: il corpus non ne ha (il conteggio si stampa); gli ingressi con spazi sì, e sono una prova;
// - la forma di una differenza dichiarata: una voce di `DICHIARATE` ammette qualunque esito non verde del suo caso e dei suoi
//   esecutori (salvo «non compila», sempre rosso), non solo quello del motivo scritto.

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fermo, fermoSeEtichettaSpostata, git, INVENTARIO, leggiInventario, RADICE, repoDelNucleo, riferimentoDi, rosso } from "../../ricetta/nucleo/comune";

/** I denominatori, dichiarati prima della corsa e confrontati con ciò che si misura. Cambiare etichetta è rimisurarli. */
const FILE_ATTESI = 192;
const CASI_DEL_PROGRAMMA = 213;
const CASI_DI_FUNZIONI = 38;
const CASI_CON_ERRORE_STATICO = 19;
const ESEMPI_ATTESI = 12;
const ESECUTORI = ["python it", "python en", "gcc it", "gcc en", "clang it", "clang en"] as const;
const ESITI_ATTESI = (CASI_DEL_PROGRAMMA + CASI_DI_FUNZIONI) * ESECUTORI.length;
/** Gli esiti che vengono da un programma (eseguito, o rosso perché non compila); gli altri li decide l'errore statico. */
const DA_UN_PROGRAMMA = ESITI_ATTESI - CASI_CON_ERRORE_STATICO * ESECUTORI.length;
const SECONDI_DI_UN_PROGRAMMA = 10;
const SECONDI_DEL_MOTORE = 300;
const PROVE_ATTESE = 12;

type Specie = "unita" | "generatore" | "linguaggio";
type Esecutore = (typeof ESECUTORI)[number];
/** Le differenze per nome del caso (`tappa/file#caso`, o `tappa/file#funzione/caso`): gli esecutori in cui c'è, la specie, il motivo. */
type Dichiarate = Readonly<Record<string, { readonly esecutori: readonly Esecutore[]; readonly specie: Specie; readonly motivo: string }>>;
const TUTTI: readonly Esecutore[] = ESECUTORI;
// I calcoli che il codice generato non controlla per scelta di AlgoDesign, che lo dice nel commento in testa a ogni programma
// generato, nella guida per lo studente e nelle note di rilascio: l'interprete li ferma, il C e il Python fanno ciò che fanno.
const NON_CONTROLLATO = "calcolo che il codice generato non controlla (lo dicono il commento in testa al programma e la guida per lo studente di AlgoDesign)";
const linguaggio = (cosa: string): Dichiarate[string] => ({ esecutori: TUTTI, specie: "linguaggio", motivo: `${cosa}: ${NON_CONTROLLATO}` });
// Il limite delle azioni è una regola dell'interprete, che il programma generato non ha: un limite voluto del generatore, non un
// difetto da segnalare (la guida per lo studente lo dice).
const LIMITE = "limite voluto del generatore: il programma generato non ha il limite delle azioni dell'interprete (lo dice la guida per lo studente di AlgoDesign)";
const DICHIARATE: Dichiarate = {
  "tappa-1/divisione-per-zero#divisione-per-zero": linguaggio("divisione intera per zero; il programma di clang cade, il Python solleva ZeroDivisionError"),
  "tappa-1/indice-fuori#indice-fuori": linguaggio("indice fuori dal vettore; il C legge fuori, il Python solleva IndexError"),
  "tappa-1/intero-minimo-diviso-meno-uno#intero-minimo-diviso-meno-uno": linguaggio("trabocco di un intero; gcc e clang danno esiti diversi, il Python non ha il limite dei 32 bit"),
  "tappa-1/opposto-intero-minimo#opposto-intero-minimo": linguaggio("trabocco di un intero; il Python non ha il limite dei 32 bit"),
  "tappa-1/overflow-fattoriale#overflow-fattoriale": linguaggio("trabocco del fattoriale di 13, uno dei dodici esempi; il C stampa un valore sbagliato, il Python quello giusto senza limite"),
  "tappa-1/reale-fuori-intervallo#reale-fuori-intervallo": linguaggio("reale fuori dall'intervallo degli interi convertito in intero"),
  "tappa-1/reale-non-finito#reale-non-finito": linguaggio("reale che diventa infinito; il C lo stampa, il Python solleva un'eccezione"),
  "tappa-1/senza-valore-booleano#senza-valore-booleano": linguaggio("dato letto senza valore; il C legge ciò che trova, il Python solleva un'eccezione"),
  "tappa-1/senza-valore-carattere#senza-valore-carattere": linguaggio("dato letto senza valore; il C legge ciò che trova, il Python solleva un'eccezione"),
  "tappa-1/senza-valore-intero#senza-valore-intero": linguaggio("dato letto senza valore; il valore di clang cambia da una corsa all'altra"),
  "tappa-1/senza-valore-reale#senza-valore-reale": linguaggio("dato letto senza valore; il C legge ciò che trova, il Python solleva un'eccezione"),
  "tappa-1/senza-valore-stringa#senza-valore-stringa": linguaggio("dato letto senza valore; il C può scrivere byte che non sono testo"),
  "tappa-1/troppi-passi#troppi-passi": { esecutori: TUTTI, specie: "generatore", motivo: `${LIMITE}; il programma non finisce` },
  "tappa-2/per-overflow-contatore#per-overflow-contatore": linguaggio("trabocco del contatore di un per; il programma C non finisce"),
  "tappa-3/reale-fuori-intervallo-parametro#reale-fuori-intervallo-parametro": linguaggio("reale fuori dall'intervallo degli interi convertito in intero, in un parametro"),
  "tappa-3/riferimento-senza-valore-in-esecuzione#senza valore": linguaggio("dato senza valore passato per riferimento e letto"),
  "tappa-3/uscita-con-valore-prima#uscita-con-valore-prima": linguaggio("parametro per uscita letto prima di avere un valore: il C riceve il valore di chi chiama, il Python solleva UnboundLocalError (per AlgoDesign una divergenza voluta)"),
  "tappa-3/uscita-letta-prima#uscita-letta-prima": linguaggio("parametro per uscita letto senza valore"),
  "tappa-3/uscita-non-assegnata#uscita-non-assegnata": linguaggio("parametro per uscita mai assegnato e letto dopo (per AlgoDesign una divergenza voluta)"),
  "tappa-4/passi-fuori-dal-ciclo#passi-fuori-dal-ciclo": { esecutori: TUTTI, specie: "generatore", motivo: `${LIMITE}; in una ricorsione` },
  "tappa-4/sequenza-di-fibonacci#ventisei": { esecutori: TUTTI, specie: "generatore", motivo: `${LIMITE}; in una ricorsione dentro un ciclo, uno dei dodici esempi` },
  "tipi/copia-con-un-campo-senza-valore#copia-con-un-campo-senza-valore": linguaggio("campo di un record letto senza valore nella copia"),
  "tipi/indice-fuori-dalla-matrice#indice-fuori-dalla-matrice": linguaggio("indice fuori da una matrice; il valore di clang cambia da una corsa all'altra"),
  "tipi/riferimento-a-un-record-senza-valore#senza-valore": linguaggio("record senza nessun campo con un valore passato per riferimento"),
};

let fatte = 0;
const fallite: string[] = [];
function prova(nome: string, buona: boolean, dettaglio = ""): void {
  fatte++;
  console.log(`${buona ? "PASS" : "FAIL"}  ${nome}${buona ? "" : `\n      ${dettaglio}`}`);
  if (!buona) fallite.push(nome);
}

// --- I tipi di questa prova: Bun non li controlla, li controlla `tsc` con la configurazione accanto.
const tsc = Bun.which("tsc", { PATH: join(RADICE, "node_modules", ".bin") }) ?? fermo("tsc non c'è: bun install alla radice");
const tipi = Bun.spawnSync([tsc, "-p", join(import.meta.dir, "tsconfig.json")], { cwd: RADICE, stdout: "pipe", stderr: "pipe" });
const testoDeiTipi = `${tipi.stdout.toString()}${tipi.stderr.toString()}`;
console.log(`tipi: tsc uscita ${tipi.exitCode}, errori ${[...testoDeiTipi.matchAll(/error TS\d+/g)].length}`);
prova("tsc sulla prova", tipi.exitCode === 0, testoDeiTipi.slice(0, 1500));

// --- Le premesse.
const argomento = (nome: string): string | undefined => {
  const i = process.argv.indexOf(nome);
  return i >= 0 ? (process.argv[i + 1] ?? fermo(`${nome} vuole un valore`)) : undefined;
};
const radice = resolve(argomento("--unita") ?? fermo("serve --unita <radice dell'unità>"));
if (!radice.includes("  ")) fermo(`radice senza spazi doppi: ${radice}`);
const editor = join(radice, "vscodium", "VSCodium.exe");
const gcc = join(radice, "msys64", "usr", "bin", "gcc.exe");
const clang = join(radice, "llvm", "bin", "clang.exe");
const python = join(radice, "python", "python.exe");
for (const f of [editor, gcc, clang, python]) if (!existsSync(f)) fermo(`non è un'unità costruita, manca ${f}`);
const estensioni = join(radice, "vscodium", "data", "extensions");
const pacchetti = readdirSync(estensioni).filter((d) => existsSync(join(estensioni, d, "dist", "libreria.cjs")));
if (pacchetti.length !== 1) fermo(`le estensioni con il pacchetto del nucleo sono ${pacchetti.length}, attesa una: ${pacchetti.join(", ")}`);
const pacchetto = join(estensioni, pacchetti[0]!, "dist", "libreria.cjs");

const lavoro = resolve(argomento("--lavoro") ?? join(tmpdir(), "esecuzione  prova"));
if (!lavoro.includes("  ")) fermo(`cartella di lavoro senza spazi doppi: ${lavoro}`);
if (lavoro.toLowerCase().startsWith(`${radice.toLowerCase()}\\`)) fermo(`la cartella di lavoro sta dentro l'unità: ${lavoro}`);
if (existsSync(lavoro) && !existsSync(join(lavoro, ".esecuzione"))) fermo(`la cartella di lavoro esiste e non è di questa prova: ${lavoro}`);
rmSync(lavoro, { recursive: true, force: true });
mkdirSync(join(lavoro, "programmi"), { recursive: true });
writeFileSync(join(lavoro, ".esecuzione"), "");

const inventario = leggiInventario(INVENTARIO);
const repo = repoDelNucleo(undefined);
fermoSeEtichettaSpostata(repo, inventario);
const sha = (f: string): string => createHash("sha256").update(readFileSync(f)).digest("hex");
console.log(`unità: ${radice}`);
console.log(`lavoro: ${lavoro}`);
console.log(`nucleo: ${riferimentoDi(inventario)}; pacchetto del .vsix: ${pacchetti[0]}, sha256 ${sha(pacchetto).slice(0, 16)}…`);
console.log(`dichiarato prima della corsa: file ${FILE_ATTESI}, casi ${CASI_DEL_PROGRAMMA} del programma + ${CASI_DI_FUNZIONI} di funzioni (con l'errore statico ${CASI_CON_ERRORE_STATICO}), esecutori ${ESECUTORI.length}, esiti ${ESITI_ATTESI}; esempi ${ESEMPI_ATTESI}`);

// --- AlgoDesign al commit: il corpus e le funzioni del confronto.
const PARTI = ["app/casi", "app/core", "app/ui", "app/i18n", "app/strumenti/casi-del-confronto.ts"];
await new Bun.Archive(git(repo, "archive", "--format=tar", inventario.commit, ...PARTI)).extract(join(lavoro, "algodesign"));
const app = join(lavoro, "algodesign", "app");
const corpus = join(app, "casi");

type Segnalazione = { code: string; block: string };
type Atteso = { output: string; error?: Segnalazione; static_error?: Segnalazione; warnings?: readonly Segnalazione[] };
type Caso = { name: string; inputs: readonly { data: string; text?: string }[]; expected: Atteso };
type Funzione = { id: string; name?: string };
type Progetto = { functions: readonly (Funzione & { test_cases?: readonly Caso[] })[]; test_cases?: readonly Caso[]; records?: unknown };
type Riga = { testo: string; blocco?: string };
type Generato = { generato: true; righe: readonly Riga[] } | { generato: false; perche: string };
type Voce = { id: string; genere: string; genera: (p: Progetto, t: unknown, l: string, parole: unknown, prova?: unknown) => Generato };
type Controllo = { fuoriTappa: false; errori: readonly Segnalazione[]; avvisi: readonly Segnalazione[] } | { fuoriTappa: true };
type DelProgetto = { id: string; delCaso: string; caso: Caso; funzione?: Funzione } & ({ input: string[] } | { escluso: string } | { problema: string });
type Ottenuto = { atteso: Atteso; tagliato: boolean } | { senzaEsito: string };
type EsitoDelCaso = { fuoriTappa: false; raggiunto: boolean; differenze: readonly { campo: string; atteso: string; ottenuto: string }[]; avvisi?: { attesi: string; ottenuti: string } };

const da = async (f: string) => import(join(app, f));
const { apri } = (await da("core/progetto/formato.ts")) as { apri: (t: string) => { ok: true; progetto: Progetto } | { ok: false } };
const { controlla, tetti } = (await da("core/controllo/controllo.ts")) as { controlla: (p: Progetto, t: unknown) => Controllo; tetti: unknown };
const { tettoDelleChiamate } = (await da("core/controllo/spazio.ts")) as { tettoDelleChiamate: (p: Progetto) => number };
const { testoDelCodice, parametriDelCaso } = (await da("core/genera/forma.ts")) as { testoDelCodice: (r: readonly Riga[]) => string; parametriDelCaso: (f: Funzione, c: Caso, r: unknown) => { righe: string[] } | { problema: string } };
const { linguaggi } = (await da("core/genera/linguaggi.ts")) as { linguaggi: readonly Voce[] };
const { paroleDelloPseudocodice } = (await da("ui/genera/parole.ts")) as { paroleDelloPseudocodice: (l: string) => unknown };
const { esitoDelCaso } = (await da("core/casi/esito.ts")) as { esitoDelCaso: (a: Atteso, o: Atteso, tagliato: boolean) => EsitoDelCaso };
const { casiDelProgetto, ottenutoDaiTesti } = (await da("strumenti/casi-del-confronto.ts")) as {
  casiDelProgetto: (nome: string, base: string, p: Progetto) => DelProgetto[];
  ottenutoDaiTesti: (f: { uscita: number | null; tutto: string; err: string }, voce: Voce, righe: readonly Riga[], lingua: string, atteso: Atteso, controllo: Controllo, pila: number) => Ottenuto;
};
const voceDi = (id: string): Voce => linguaggi.find((v) => v.id === id) ?? fermo(`il registro di AlgoDesign non ha ${id}`);
const voci = { c: voceDi("c"), python: voceDi("python") };

// --- Il lato del `.vsix`, nel motore dell'editor dell'unità.
const fileDelVsix = join(lavoro, "vsix.json");
// Con un tempo massimo: un motore che non entra nel modo di Node aprirebbe una finestra e resterebbe lì.
const g = Bun.spawnSync([editor, join(import.meta.dir, "genera.cjs"), pacchetto, corpus, fileDelVsix], { env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" }, stdout: "pipe", stderr: "pipe", timeout: SECONDI_DEL_MOTORE * 1000 });
if (g.exitedDueToTimeout === true) rosso(`il motore dell'editor (${editor}) non ha finito di generare in ${SECONDI_DEL_MOTORE} s ed è stato fermato: ${g.stderr.toString().slice(0, 500)}`);
if (g.exitCode !== 0 || !existsSync(fileDelVsix)) fermo(`il motore dell'editor non ha generato, uscita ${g.exitCode}: ${g.stderr.toString().slice(0, 500)}`);
const dalVsix = JSON.parse(readFileSync(fileDelVsix, "utf8")) as { motore: { node: string; electron: string | null }; esiti: Record<string, { generato?: boolean; testo?: string; perche?: string }> };
console.log(`motore dell'editor: electron ${dalVsix.motore.electron}, node ${dalVsix.motore.node}; combinazioni generate ${Object.keys(dalVsix.esiti).length}`);

// --- Il corpus: i file, i casi, i programmi. Il testo del `.vsix` contro quello del generatore, combinazione per combinazione.
type DaEseguire = { id: string; file: string; caso: Caso; funzione?: Funzione; input: string[]; controllo: Extract<Controllo, { fuoriTappa: false }>; pila: number; esclusoDaAlgoDesign?: string };
type Programma = { sorgente: string; righe: readonly Riga[] };
const daEseguire: DaEseguire[] = [];
const programmi = new Map<string, Programma>(); // `${id o file} ${linguaggio} ${lingua}`
const statici = new Set<string>(); // i file con errori statici: nessun programma
const testiDiversi: string[] = [];
let testiUguali = 0;
let rifiutiUguali = 0;
let quantiFile = 0;
let casiProgramma = 0;
let casiFunzioni = 0;
for (const tappa of readdirSync(corpus, { withFileTypes: true }).filter((v) => v.isDirectory()).map((v) => v.name).sort())
  for (const f of readdirSync(join(corpus, tappa)).filter((f) => f.endsWith(".algo")).sort()) {
    quantiFile++;
    const base = f.slice(0, -".algo".length);
    const nome = `${tappa}/${base}`;
    const aperto = apri(readFileSync(join(corpus, tappa, f), "utf8"));
    if (!aperto.ok) fermo(`${nome}: AlgoDesign non lo apre`);
    const p = aperto.progetto;
    const controllo = controlla(p, tetti);
    if (controllo.fuoriTappa) fermo(`${nome}: fuori tappa`);
    if (controllo.errori.length > 0) statici.add(nome);
    for (const [lid, voce] of Object.entries(voci))
      for (const l of ["it", "en"]) {
        const gen = voce.genera(p, tetti, l, paroleDelloPseudocodice(l));
        const v = dalVsix.esiti[`${nome} ${lid} ${l}`];
        if (!gen.generato) {
          if (v?.generato === false && v.perche === gen.perche) rifiutiUguali++;
          else testiDiversi.push(`${nome} ${lid} ${l}: il generatore rifiuta (${gen.perche}), il .vsix ${JSON.stringify(v).slice(0, 80)}`);
          continue;
        }
        if (v?.generato === true && v.testo === testoDelCodice(gen.righe)) testiUguali++;
        else {
          testiDiversi.push(`${nome} ${lid} ${l}: il testo del .vsix non è quello del generatore`);
          continue;
        }
        const sorgente = join(lavoro, "programmi", `${tappa}-${base}-${l}${voce.id === "c" ? ".c" : ".py"}`);
        writeFileSync(sorgente, v.testo);
        programmi.set(`${nome} ${lid} ${l}`, { sorgente, righe: gen.righe });
      }
    for (const c of casiDelProgetto(nome, base, p)) {
      if (c.funzione === undefined) casiProgramma++;
      else casiFunzioni++;
      if ("problema" in c) fermo(`${c.id}: ${c.problema}`);
      // I casi che AlgoDesign esclude dal suo confronto qui si eseguono: le righe d'ingresso come le farebbe `casiDelProgetto`.
      let input: string[];
      if ("input" in c) input = c.input;
      else if (c.funzione === undefined) input = c.caso.inputs.map((v) => v.text ?? "");
      else {
        const r = parametriDelCaso(c.funzione, c.caso, p.records);
        if ("problema" in r) fermo(`${c.id}: ${r.problema}`);
        input = r.righe;
      }
      daEseguire.push({ id: c.id, file: nome, caso: c.caso, input, controllo, pila: tettoDelleChiamate(p), ...(c.funzione !== undefined ? { funzione: c.funzione } : {}), ...("escluso" in c ? { esclusoDaAlgoDesign: c.escluso } : {}) });
      // Il programma di prova di un caso di una funzione: solo dal generatore, il `.vsix` non lo dà.
      if (c.funzione !== undefined && controllo.errori.length === 0)
        for (const [lid, voce] of Object.entries(voci))
          for (const l of ["it", "en"]) {
            const gp = voce.genera(p, tetti, l, paroleDelloPseudocodice(l), { funzione: c.funzione.id, caso: c.caso });
            if (!gp.generato) fermo(`${c.id}: il programma di prova ${lid} ${l} non si genera (${gp.perche})`);
            const sorgente = join(lavoro, "programmi", `${tappa}-${base}-prova-${daEseguire.length}-${l}${voce.id === "c" ? ".c" : ".py"}`);
            writeFileSync(sorgente, testoDelCodice(gp.righe));
            programmi.set(`${c.id} ${lid} ${l}`, { sorgente, righe: gp.righe });
          }
    }
  }
const combinazioni = quantiFile * 4;
console.log(`corpus: file ${quantiFile}, casi del programma ${casiProgramma}, di funzioni ${casiFunzioni}, file con errori statici ${statici.size}; esclusi dal confronto di AlgoDesign ${daEseguire.filter((d) => d.esclusoDaAlgoDesign !== undefined).length} (qui eseguiti)`);
console.log(`il .vsix contro il generatore: combinazioni ${combinazioni}, testi uguali ${testiUguali}, rifiuti uguali ${rifiutiUguali}, diversi ${testiDiversi.length}`);
const casiStatici = daEseguire.filter((d) => statici.has(d.file)).length;
const conSpazi = daEseguire.filter((d) => d.input.some((t) => t.includes(" "))).map((d) => d.id);
const conRigaVuota = daEseguire.filter((d) => d.input.some((t) => t.trim() === "")).length;
console.log(`ingressi: casi con uno spazio ${conSpazi.length} [${conSpazi.join(", ")}], con una riga vuota ${conRigaVuota}`);
prova("il corpus ha i file e i casi dichiarati", quantiFile === FILE_ATTESI && casiProgramma === CASI_DEL_PROGRAMMA && casiFunzioni === CASI_DI_FUNZIONI && casiStatici === CASI_CON_ERRORE_STATICO, `file ${quantiFile}, casi ${casiProgramma} + ${casiFunzioni}, con l'errore statico ${casiStatici}`);
prova("il codice del .vsix è quello del generatore, combinazione per combinazione", testiDiversi.length === 0 && testiUguali + rifiutiUguali === combinazioni, testiDiversi.slice(0, 5).join("; "));

// --- I processi: la cartella dell'eseguibile in testa a un PATH che ha solo Windows, così una libreria che manca nell'unità si vede.
const PATH_DI_WINDOWS = [join(process.env.SystemRoot ?? "C:\\Windows", "system32"), process.env.SystemRoot ?? "C:\\Windows"].join(";");
type Fine = { uscita: number | null; out: Uint8Array; err: Uint8Array; scaduto: boolean };
async function lancia(cmd: string[], stdin: Uint8Array, secondi: number, cartella: string): Promise<Fine> {
  const env: Record<string, string> = { SystemRoot: process.env.SystemRoot ?? "C:\\Windows", TEMP: process.env.TEMP ?? tmpdir(), TMP: process.env.TMP ?? tmpdir(), PATH: `${cartella};${PATH_DI_WINDOWS}` };
  const proc = Bun.spawn({ cmd, env, stdin, stdout: "pipe", stderr: "pipe" });
  let scaduto = false;
  const orologio = setTimeout(() => {
    scaduto = true;
    proc.kill();
  }, secondi * 1000);
  const [out, err, uscita] = await Promise.all([new Response(proc.stdout).arrayBuffer(), new Response(proc.stderr).arrayBuffer(), proc.exited]);
  clearTimeout(orologio);
  return { uscita, out: new Uint8Array(out), err: new Uint8Array(err), scaduto };
}
async function inParallelo(lavori: (() => Promise<void>)[]): Promise<void> {
  let prossimo = 0;
  const operaio = async () => {
    while (prossimo < lavori.length) await lavori[prossimo++]!();
  };
  await Promise.all([...Array(Math.max(2, availableParallelism())).keys()].map(operaio));
}
const comeTesto = new TextDecoder("utf-8", { fatal: false });

/** Una compilazione: l'eseguibile, o il testo del compilatore se non compila. Gli avvisi si contano. */
async function compila(cc: string, sorgente: string, eseguibile: string): Promise<{ ok: boolean; testo: string; avvisi: number }> {
  const f = await lancia([cc, "-std=c11", "-Wall", "-Wextra", "-o", eseguibile, sorgente], new Uint8Array(), 120, dirname(cc));
  const testo = comeTesto.decode(f.err) + comeTesto.decode(f.out);
  return { ok: f.uscita === 0 && existsSync(eseguibile), testo, avvisi: [...testo.matchAll(/\bwarning:/g)].length };
}

// --- Le compilazioni.
const MACCHINE = { gcc, clang } as const;
const eseguibili = new Map<string, string>();
const nonCompilati = new Map<string, string>();
const avvisiPer = { gcc: 0, clang: 0 };
const compilazioni: (() => Promise<void>)[] = [];
for (const [chiave, prog] of programmi) {
  if (!chiave.includes(" c ")) continue;
  for (const [m, cc] of Object.entries(MACCHINE) as [keyof typeof MACCHINE, string][])
    compilazioni.push(async () => {
      const eseguibile = prog.sorgente.replace(/\.c$/, `-${m}.exe`);
      const r = await compila(cc, prog.sorgente, eseguibile);
      avvisiPer[m] += r.avvisi;
      if (r.ok) eseguibili.set(`${chiave} ${m}`, eseguibile);
      else nonCompilati.set(`${chiave} ${m}`, r.testo.slice(0, 300));
    });
}
let t0 = performance.now();
await inParallelo(compilazioni);
console.log(`compilazioni ${compilazioni.length} in ${((performance.now() - t0) / 1000).toFixed(1)} s, non compilati ${nonCompilati.size}; avvisi gcc ${avvisiPer.gcc}, clang ${avvisiPer.clang}`);

// Il Python: `compile` di ogni sorgente letto in byte, come lo leggerebbe l'interprete, in un processo solo. Non scrive `__pycache__`:
// compila in memoria e non importa nulla. Un file che non si legge è un'eccezione del controllo, quindi un fermo.
const CONTROLLO_PYTHON = [
  "import json, sys",
  "elenco = open(sys.argv[1], encoding='utf-8').read().split('\\n')",
  "errori = {}",
  "for f in elenco:",
  "    with open(f, 'rb') as d:",
  "        testo = d.read()",
  "    try:",
  "        compile(testo, f, 'exec', dont_inherit=True)",
  "    except (SyntaxError, ValueError) as e:",
  "        errori[f] = type(e).__name__ + ': ' + str(e)",
  "sys.stdout.write(json.dumps({'controllati': len(elenco), 'errori': errori}))",
  "",
].join("\n");
const cartellaDelControllo = join(lavoro, "controllo python");
mkdirSync(cartellaDelControllo, { recursive: true });
const scriptDelControllo = join(cartellaDelControllo, "compila.py");
writeFileSync(scriptDelControllo, CONTROLLO_PYTHON);
let elenchiPython = 0;
/** I sorgenti Python che non compilano, col messaggio del compilatore: una funzione sola, per il corpus e per la sonda. */
async function nonCompilaPython(sorgenti: readonly string[]): Promise<Map<string, string>> {
  const elenco = join(cartellaDelControllo, `elenco ${++elenchiPython}.txt`);
  writeFileSync(elenco, sorgenti.join("\n"));
  const f = await lancia([python, "-I", "-B", scriptDelControllo, elenco], new Uint8Array(), 120, dirname(python));
  if (f.scaduto || f.uscita !== 0) fermo(`il controllo di sintassi del Python non ha finito, uscita ${f.uscita}: ${comeTesto.decode(f.err).slice(0, 500)}`);
  const r = JSON.parse(comeTesto.decode(f.out)) as { controllati: number; errori: Record<string, string> };
  if (r.controllati !== sorgenti.length) fermo(`il controllo di sintassi del Python ha letto ${r.controllati} file su ${sorgenti.length}`);
  return new Map(Object.entries(r.errori));
}
const sorgentiPython = [...programmi.values()].filter((p) => p.sorgente.endsWith(".py")).map((p) => p.sorgente);
t0 = performance.now();
const pythonNonCompilati = await nonCompilaPython(sorgentiPython);
console.log(`programmi Python controllati ${sorgentiPython.length} in ${((performance.now() - t0) / 1000).toFixed(1)} s, non compilati ${pythonNonCompilati.size}`);

// --- Le esecuzioni e gli esiti, uno per caso ed esecutore.
type Esito =
  | { genere: "verde"; ottenuto?: Atteso; tagliato?: boolean }
  | { genere: "differenza"; dettaglio: string; ottenuto: Atteso; tagliato: boolean }
  | { genere: "senza esito"; dettaglio: string }
  | { genere: "non compila"; dettaglio: string };
const esiti = new Map<string, Esito>(); // `${id}|${esecutore}`
const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

/** L'esito di un ottenuto contro l'atteso del caso: la funzione di AlgoDesign, un caso alla volta. */
function esitoDi(atteso: Atteso, o: Ottenuto): Esito {
  if ("senzaEsito" in o) return { genere: "senza esito", dettaglio: o.senzaEsito };
  const e = esitoDelCaso(atteso, o.atteso, o.tagliato);
  if (e.raggiunto && e.avvisi === undefined) return { genere: "verde", ottenuto: o.atteso, tagliato: o.tagliato };
  const campi = [...e.differenze.map((d) => `${d.campo}: atteso ${JSON.stringify(d.atteso).slice(0, 120)}, ottenuto ${JSON.stringify(d.ottenuto).slice(0, 120)}`), ...(e.avvisi ? [`avvisi: attesi ${e.avvisi.attesi}, ottenuti ${e.avvisi.ottenuti}`] : [])];
  return { genere: "differenza", dettaglio: campi.join("; "), ottenuto: o.atteso, tagliato: o.tagliato };
}
function ottenutoDi(f: Fine, voce: Voce, righe: readonly Riga[], lingua: string, d: DaEseguire): Ottenuto {
  if (f.scaduto) return { senzaEsito: `non finito in ${SECONDI_DI_UN_PROGRAMMA} s` };
  try {
    return ottenutoDaiTesti({ uscita: f.uscita, tutto: utf8.decode(f.out), err: utf8.decode(f.err) }, voce, righe, lingua, d.caso.expected, d.controllo, d.pila);
  } catch {
    return { senzaEsito: `uscita ${f.uscita}, lo stdout o lo stderr non è UTF-8` };
  }
}

const esecuzioni: (() => Promise<void>)[] = [];
let decisiDalloStatico = 0;
let esitiNonCompila = 0;
for (const d of daEseguire) {
  const input = new TextEncoder().encode(d.input.map((t) => `${t}\n`).join(""));
  for (const esecutore of ESECUTORI) {
    const [m, l] = esecutore.split(" ") as ["python" | "gcc" | "clang", string];
    const lid = m === "python" ? "python" : "c";
    const k = `${d.id}|${esecutore}`;
    if (statici.has(d.file)) {
      esiti.set(k, esitoDi(d.caso.expected, { atteso: { output: "", static_error: d.controllo.errori[0]!, warnings: d.controllo.avvisi }, tagliato: false }));
      decisiDalloStatico++;
      continue;
    }
    const prog = programmi.get(`${d.funzione !== undefined ? d.id : d.file} ${lid} ${l}`) ?? fermo(`manca il programma di ${k}`);
    let cmd: string[];
    if (m === "python") {
      const errore = pythonNonCompilati.get(prog.sorgente);
      if (errore !== undefined) {
        esiti.set(k, { genere: "non compila", dettaglio: errore });
        esitiNonCompila++;
        continue;
      }
      cmd = [python, "-I", "-B", prog.sorgente];
    } else {
      const chiaveExe = `${d.funzione !== undefined ? d.id : d.file} c ${l} ${m}`;
      const exe = eseguibili.get(chiaveExe);
      if (exe === undefined) {
        esiti.set(k, { genere: "non compila", dettaglio: nonCompilati.get(chiaveExe) ?? "eseguibile assente" });
        esitiNonCompila++;
        continue;
      }
      cmd = [exe];
    }
    esecuzioni.push(async () => {
      const f = await lancia(cmd, input, SECONDI_DI_UN_PROGRAMMA, dirname(m === "python" ? python : MACCHINE[m]));
      esiti.set(k, esitoDi(d.caso.expected, ottenutoDi(f, voci[lid], prog.righe, l, d)));
    });
  }
}
t0 = performance.now();
await inParallelo(esecuzioni);
console.log(`esecuzioni ${esecuzioni.length} in ${((performance.now() - t0) / 1000).toFixed(1)} s, non compilati ${esitiNonCompila} (insieme ${esecuzioni.length + esitiNonCompila}, dichiarati ${DA_UN_PROGRAMMA}); esiti senza programma (errore statico) ${decisiDalloStatico}`);

// --- Il verdetto: una funzione sola, attraversata dal dato vero e dalle sonde.
const previste = daEseguire.flatMap((d) => ESECUTORI.map((e) => `${d.id}|${e}`));
const nomina = (k: string): string => {
  const [id, esecutore] = k.split("|") as [string, string];
  const [m, l] = esecutore.split(" ") as [string, string];
  const [file, caso] = id.split("#") as [string, string];
  return `file ${file}, caso ${caso}, linguaggio ${m === "python" ? "python" : `c (${m})`}, lingua ${l}`;
};
type Giudizio = { rossi: string[]; perSpecie: Record<Specie, number>; verdi: number };
function giudica(e: ReadonlyMap<string, Esito>, attese: readonly string[], dichiarate: Dichiarate): Giudizio {
  const rossi: string[] = [];
  const perSpecie: Record<Specie, number> = { unita: 0, generatore: 0, linguaggio: 0 };
  let verdi = 0;
  const ids = new Set(attese.map((k) => k.split("|")[0]!));
  for (const k of e.keys()) if (!attese.includes(k)) rossi.push(`ROSSO esito fuori elenco: ${k}`);
  for (const id of Object.keys(dichiarate)) if (!ids.has(id)) rossi.push(`ROSSO dichiarata senza caso nel corpus: ${id}`);
  for (const k of attese) {
    const x = e.get(k);
    const [id, esecutore] = k.split("|") as [string, Esecutore];
    const dich = dichiarate[id];
    const dichiarata = dich !== undefined && dich.esecutori.includes(esecutore);
    if (x === undefined) rossi.push(`ROSSO senza esito (mancante): ${nomina(k)}`);
    else if (x.genere === "non compila") rossi.push(`ROSSO NON COMPILA: ${nomina(k)}: ${x.dettaglio.replace(/\s+/g, " ").slice(0, 200)}`);
    else if (x.genere === "verde") {
      if (dichiarata) rossi.push(`ROSSO dichiarata e non avvenuta (${dich.specie}): ${nomina(k)}`);
      else verdi++;
    } else if (dichiarata) perSpecie[dich.specie]++;
    else rossi.push(`ROSSO differenza non dichiarata, ${x.genere}: ${nomina(k)}: ${x.dettaglio}`);
  }
  return { rossi, perSpecie, verdi };
}

const vero = giudica(esiti, previste, DICHIARATE);
console.log(`esiti: ${esiti.size} su ${previste.length} previsti, dichiarati ${ESITI_ATTESI}; verdi ${vero.verdi}, differenze dichiarate: unità ${vero.perSpecie.unita}, generatore ${vero.perSpecie.generatore}, linguaggio ${vero.perSpecie.linguaggio}; rossi ${vero.rossi.length}`);
for (const r of vero.rossi) console.log(`  ${r}`);
for (const [id, v] of Object.entries(DICHIARATE)) console.log(`  DICHIARATA ${v.specie} ${id} [${v.esecutori.join(", ")}]: ${v.motivo}`);
prova("gli esiti sono quelli dichiarati, elemento per elemento", previste.length === ESITI_ATTESI && esiti.size === ESITI_ATTESI && esecuzioni.length + esitiNonCompila === DA_UN_PROGRAMMA && decisiDalloStatico === ESITI_ATTESI - DA_UN_PROGRAMMA,
  `previsti ${previste.length}, esiti ${esiti.size}, dichiarati ${ESITI_ATTESI}; da un programma ${esecuzioni.length + esitiNonCompila}, dichiarati ${DA_UN_PROGRAMMA}; dall'errore statico ${decisiDalloStatico}`);
prova("ogni differenza è dichiarata con specie e motivo, ogni dichiarata è avvenuta, ogni programma compila", vero.rossi.length === 0, `${vero.rossi.length} rossi`);
prova("nessun difetto dell'unità dichiarato", vero.perSpecie.unita === 0, `${vero.perSpecie.unita}`);
// Gli ingressi con spazi, passati da una cartella con spazi doppi: la premessa è che il corpus ne abbia.
const spaziNonVerdi = conSpazi.flatMap((id) => ESECUTORI.filter((x) => esiti.get(`${id}|${x}`)?.genere !== "verde").map((x) => `${id} ${x}`));
prova(`gli ingressi con spazi tornano su ogni esecutore (casi ${conSpazi.length})`, conSpazi.length > 0 && spaziNonVerdi.length === 0, spaziNonVerdi.join("; "));

// --- I dodici esempi che AlgoDesign copia per lo studente: un sottoinsieme nominato, ciascuno tornato o dichiarato.
const esempi = [...readFileSync(join(app, "ui", "esempi.ts"), "utf8").matchAll(/from "\.\.\/casi\/([^"]+)\.algo"/g)].map((m) => m[1]!);
console.log(`esempi: ${esempi.length}`);
for (const nome of esempi) {
  const casi = daEseguire.filter((d) => d.file === nome);
  const nonVerdi = casi.flatMap((d) => ESECUTORI.filter((x) => esiti.get(`${d.id}|${x}`)?.genere !== "verde").map((x) => `${d.id.split("#")[1]} ${x}: ${DICHIARATE[d.id]?.specie ?? "NON DICHIARATA"}`));
  console.log(`  ${nonVerdi.length === 0 ? "TORNATO  " : "DICHIARATO"} ${nome} (casi ${casi.length})${nonVerdi.length > 0 ? `: ${nonVerdi.join("; ")}` : ""}`);
}
prova("gli esempi sono quelli dichiarati, e ciascuno ha casi", esempi.length === ESEMPI_ATTESI && esempi.every((n) => daEseguire.some((d) => d.file === n)), `esempi ${esempi.length}`);

// --- Le sonde, dentro `giudica`. Qui il fatto cercato è la deviazione: inventarle è corretto; la combinazione colpita è vera.
const SONDA = "tappa-1/riferimento-media-voti#riferimento-media-voti";
const caso = daEseguire.find((d) => d.id === SONDA) ?? fermo(`il caso della sonda non c'è: ${SONDA}`);
const alterato: Atteso = { ...caso.caso.expected, output: `x${caso.caso.expected.output}` };
const conAtteso = new Map(esiti);
for (const x of ESECUTORI) {
  const v = esiti.get(`${SONDA}|${x}`);
  if (v?.genere === "verde" && v.ottenuto !== undefined) conAtteso.set(`${SONDA}|${x}`, esitoDi(alterato, { atteso: v.ottenuto, tagliato: v.tagliato ?? false }));
}
const s1 = giudica(conAtteso, previste, DICHIARATE).rossi.filter((r) => !vero.rossi.includes(r));
const nominaTutto = ESECUTORI.every((x) => s1.some((r) => r.includes(nomina(`${SONDA}|${x}`)) && r.includes("differenza non dichiarata")));
prova(`sonda: un atteso alterato è rosso e nomina file, linguaggio, lingua e caso (${s1.length} righe)`, s1.length === ESECUTORI.length && nominaTutto, s1.join(" | "));
if (s1[0] !== undefined) console.log(`      come si legge: ${s1[0].slice(0, 220)}`);

// Un programma che non compila, preso dal corpus e guastato, sul caso di un file: rosso «non compila» anche se il caso è dichiarato.
const guasto = programmi.get(`tappa-1/overflow-fattoriale c it`) ?? fermo("manca il programma della sonda");
const sorgenteGuasto = join(lavoro, "sonda-non-compila.c");
writeFileSync(sorgenteGuasto, `${readFileSync(guasto.sorgente, "utf8")}\nint sonda = ;\n`);
const r2 = await compila(gcc, sorgenteGuasto, join(lavoro, "sonda-non-compila.exe"));
const idGuasto = "tappa-1/overflow-fattoriale#overflow-fattoriale";
const conGuasto = new Map(esiti);
conGuasto.set(`${idGuasto}|gcc it`, r2.ok ? { genere: "verde" } : { genere: "non compila", dettaglio: r2.testo });
const conDichiarata: Dichiarate = { ...DICHIARATE, [idGuasto]: { esecutori: ["gcc it"], specie: "linguaggio", motivo: "sonda" } };
const s2 = giudica(conGuasto, previste, conDichiarata).rossi.filter((r) => r.includes(nomina(`${idGuasto}|gcc it`)));
prova("sonda: un programma che non compila è rosso «non compila», mai una differenza, anche dichiarato", !r2.ok && s2.length === 1 && s2[0]!.startsWith("ROSSO NON COMPILA"), `compila ${r2.ok}; ${s2.join(" | ")}`);

// Lo stesso per il Python, con lo stesso controllo del corpus: il programma vero compila, la sua copia guastata no, e il caso
// dichiarato in quello slot è rosso «non compila». Eseguito senza controllo, il guasto sarebbe stato un «senza esito», cioè una
// differenza che la dichiarata avrebbe coperto: si stampa per confronto.
const guastoPy = programmi.get(`tappa-1/overflow-fattoriale python it`) ?? fermo("manca il programma Python della sonda");
const sorgenteGuastoPy = join(lavoro, "sonda-non-compila.py");
writeFileSync(sorgenteGuastoPy, `${readFileSync(guastoPy.sorgente, "utf8")}\ndef sonda(:\n`);
const r5 = await nonCompilaPython([guastoPy.sorgente, sorgenteGuastoPy]);
const casoGuasto = daEseguire.find((d) => d.id === idGuasto) ?? fermo(`il caso della sonda non c'è: ${idGuasto}`);
const senzaControllo = esitoDi(casoGuasto.caso.expected, ottenutoDi(await lancia([python, "-I", "-B", sorgenteGuastoPy], new TextEncoder().encode(casoGuasto.input.map((t) => `${t}\n`).join("")), SECONDI_DI_UN_PROGRAMMA, dirname(python)), voci.python, guastoPy.righe, "it", casoGuasto));
console.log(`      sonda Python: controllati 2, non compilati ${r5.size} [${[...r5.keys()].map((f) => f.slice(lavoro.length + 1)).join(", ")}]; il guasto eseguito senza controllo: ${senzaControllo.genere}`);
const conGuastoPy = new Map(esiti);
const erroreDelGuasto = r5.get(sorgenteGuastoPy);
conGuastoPy.set(`${idGuasto}|python it`, erroreDelGuasto !== undefined ? { genere: "non compila", dettaglio: erroreDelGuasto } : { genere: "verde" });
const conDichiarataPy: Dichiarate = { ...DICHIARATE, [idGuasto]: { esecutori: ["python it"], specie: "linguaggio", motivo: "sonda" } };
const s5 = giudica(conGuastoPy, previste, conDichiarataPy).rossi.filter((r) => r.includes(nomina(`${idGuasto}|python it`)));
prova("sonda: un programma Python che non compila è rosso «non compila», mai una differenza, anche dichiarato", r5.size === 1 && erroreDelGuasto !== undefined && s5.length === 1 && s5[0]!.startsWith("ROSSO NON COMPILA"), `non compilati ${[...r5.keys()].join(", ")}; ${s5.join(" | ")}`);

// I due versi dell'elenco: una dichiarata su un caso verde, e un esito che manca.
const verde = previste.find((k) => esiti.get(k)?.genere === "verde") ?? fermo("nessun esito verde per la sonda");
const [idVerde, exVerde] = verde.split("|") as [string, Esecutore];
const s3 = giudica(esiti, previste, { ...DICHIARATE, [idVerde]: { esecutori: [exVerde], specie: "generatore", motivo: "sonda" } }).rossi.filter((r) => !vero.rossi.includes(r));
const senzaUno = new Map(esiti);
senzaUno.delete(verde);
const s4 = giudica(senzaUno, previste, DICHIARATE).rossi.filter((r) => !vero.rossi.includes(r));
prova("sonda: una dichiarata che non avviene e un esito che manca sono rossi", s3.length === 1 && s3[0]!.includes("dichiarata e non avvenuta") && s4.length === 1 && s4[0]!.includes("mancante"), `${s3.join(" | ")} || ${s4.join(" | ")}`);

console.log(`prove: ${fatte}/${PROVE_ATTESE}, fallite ${fallite.length}`);
if (fatte !== PROVE_ATTESE) {
  console.log(`FERMO: il denominatore non torna: dichiarate ${PROVE_ATTESE}, eseguite ${fatte}`);
  process.exit(2);
}
console.log(`ESITO: ${fallite.length === 0 ? "VERDE" : "ROSSO"}`);
process.exit(fallite.length === 0 ? 0 : 1);

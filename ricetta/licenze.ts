// L'elenco delle licenze di terze parti: il nucleo incorporato, gli strumenti esterni e ogni pacchetto installato per sviluppare,
// col nome, la versione, la licenza dichiarata, il repository e i numeri dei testi. Un testo uguale per più pacchetti compare una volta.
//
//   bun ricetta/licenze.ts              riscrive LICENZE-DI-TERZE-PARTI.txt alla radice
//   bun ricetta/licenze.ts --verifica   ricompone e confronta col file: atteso ESITO: VERDE
//
// Uscite: 0 verde, 1 rosso, 2 fermo (non si è potuto misurare).
//
// Che cosa NON guarda:
// - che la licenza dichiarata da un pacchetto sia quella giusta: si riporta ciò che il pacchetto dichiara, coi file di licenza che ha alla
//   radice; un testo più in fondo entra solo se è dichiarato in `TESTI_ALTROVE`, e una licenza con `AND` senza quella voce è un rosso;
// - gli strumenti esterni: nome, licenza e fonte sono scritti qui a mano, e nessuno li confronta con la loro fonte;
// - le librerie dell'interfaccia e del programma del progetto da cui viene il nucleo: non entrano qui, e il loro elenco è nel suo pacchetto;
// - il contenuto del pacchetto dell'estensione, che oggi non porta testi di licenza;
// - le varianti dei pacchetti per le altre piattaforme, che qui non si installano: l'elenco vale per Windows x64.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { differenzeDegliElenchi, fermo, fermoSeEtichettaSpostata, git, INVENTARIO, leggiInventario, RADICE, repoDelNucleo } from "./nucleo/comune";

const USCITA = join(RADICE, "LICENZE-DI-TERZE-PARTI.txt");
const CARTELLA = join(RADICE, "node_modules");
const VERIFICA = process.argv.includes("--verifica");

/** Gli strumenti che non stanno fra i pacchetti. Si usano per costruire e provare: nessuno entra nel repository né nel pacchetto. */
const ESTERNI = [
  "Bun, licenza MIT, con JavaScriptCore e WebCore di WebKit sotto LGPL-2.0 e tinycc sotto LGPL-2.1: https://bun.sh/docs/project/licensing",
  "Node.js, licenza MIT, con le licenze dei suoi componenti: https://github.com/nodejs/node/blob/main/LICENSE",
  "Git, licenza GPL-2.0-only: https://github.com/git/git/blob/master/COPYING",
  "Visual Studio Code, licenza Microsoft del prodotto, solo per la prova nell'editor: https://code.visualstudio.com/license",
];

/** I pacchetti che non portano un file di licenza: un altro che manchi è un rosso, non un'omissione. */
const SENZA_TESTO = ["@napi-rs/keyring-win32-x64-msvc", "bun-types", "isarray"];

/** I testi che un pacchetto porta fuori dalla sua radice: la metà di una licenza composta, per esempio. */
const TESTI_ALTROVE: Readonly<Record<string, readonly string[]>> = { pako: ["lib/zlib/README"] };

const dipendenze = (JSON.parse(readFileSync(join(RADICE, "package.json"), "utf8")) as { devDependencies: Record<string, string> }).devDependencies;
/** Pacchetti veri e testi veri, che l'elenco deve contenere: un elenco che li perde è rotto, anche se i conteggi tornano. Le versioni vengono da `package.json`. */
const CONTROLLI_POSITIVI = [...["typescript", "@vscode/vsce", "@vscode/test-electron"].map((n) => `${n} ${dipendenze[n]}, licenza`), "Permission is hereby granted", "Attribution 4.0 International", "Jean-loup Gailly"];

type Pacchetto = { nome: string; versione: string; licenza: string; repository: string; file: string[]; cartella: string };

/** Ogni pacchetto installato, anche annidato: si scende solo nelle cartelle `node_modules`, non nei file di prova dei pacchetti. */
function pacchettiIn(nm: string, trovati: Map<string, Pacchetto>): void {
  for (const voce of readdirSync(nm, { withFileTypes: true })) {
    if (!voce.isDirectory() || voce.name.startsWith(".")) continue;
    const cartelle = voce.name.startsWith("@") ? readdirSync(join(nm, voce.name)).map((s) => join(nm, voce.name, s)) : [join(nm, voce.name)];
    for (const cartella of cartelle) {
      const manifesto = join(cartella, "package.json");
      if (!existsSync(manifesto)) continue;
      const j = JSON.parse(readFileSync(manifesto, "utf8")) as { name: string; version: string; license?: unknown; repository?: unknown };
      const licenza = typeof j.license === "string" ? j.license : "non dichiarata";
      const r = j.repository as string | { url?: string } | undefined;
      const repository = (typeof r === "string" ? r : r?.url) ?? "repository non dichiarato";
      const file = [...readdirSync(cartella, { withFileTypes: true }).filter((f) => f.isFile() && /^(licen[cs]e|copying|notice)/i.test(f.name)).map((f) => f.name).sort(), ...(TESTI_ALTROVE[j.name] ?? [])];
      trovati.set(`${j.name}@${j.version}`, { nome: j.name, versione: j.version, licenza, repository, file, cartella });
      const dentro = join(cartella, "node_modules");
      if (existsSync(dentro)) pacchettiIn(dentro, trovati);
    }
  }
}

/** Fine riga uniformi e nessun carattere di controllo, come il salto pagina di certi testi: il file resta testo, per git e per chi lo legge. */
const normalizza = (t: string): string => [...t.replace(/^﻿/, "").replace(/\r\n?/g, "\n")].map((c) => (c === "\n" || c === "\t" || (c.codePointAt(0) ?? 0) >= 32 ? c : "\n")).join("").trim();

function componi(): { testo: string; pacchetti: Pacchetto[]; senzaTesto: string[]; testi: number } {
  const inventario = leggiInventario(INVENTARIO);
  const repo = repoDelNucleo(undefined);
  fermoSeEtichettaSpostata(repo, inventario);
  const delNucleo = (f: string): string => normalizza(new TextDecoder().decode(git(repo, "show", `${inventario.commit}:${f}`)));

  if (!existsSync(CARTELLA)) fermo("node_modules non c'è: bun install alla radice");
  const trovati = new Map<string, Pacchetto>();
  pacchettiIn(CARTELLA, trovati);
  const pacchetti = [...trovati.values()].sort((a, b) => (a.nome === b.nome ? a.versione.localeCompare(b.versione) : a.nome < b.nome ? -1 : 1));

  const testi: string[] = [delNucleo("LICENSE"), delNucleo("LICENSE-DOCS")];
  const numero = (t: string): number => {
    const i = testi.indexOf(t);
    if (i >= 0) return i + 1;
    testi.push(t);
    return testi.length;
  };
  const righe = pacchetti.map((p) => {
    const numeri = [...new Set(p.file.map((f) => numero(normalizza(readFileSync(join(p.cartella, f), "utf8")))))];
    const dove = numeri.length > 0 ? `testo ${numeri.map((n) => `[${n}]`).join(" ")}` : "nessun file di licenza nel pacchetto";
    return `${p.nome} ${p.versione}, licenza ${p.licenza}, ${p.repository}: ${dove}`;
  });

  const testo = [
    "MyDev: licenze di terze parti",
    "=============================",
    "",
    "MyDev incorpora il nucleo di AlgoDesign e usa strumenti scritti da altri, ognuno con la sua licenza. Per ogni pacchetto ci sono il",
    "nome, la versione, la licenza che dichiara, il suo repository e i numeri dei testi della licenza, che seguono l'elenco. Un testo uguale",
    "per più pacchetti compare una volta sola. Questo file è generato: non si modifica a mano.",
    "",
    "Il nucleo incorporato",
    "",
    `AlgoDesign, etichetta ${inventario.etichetta}, commit ${inventario.commit}, © 2026 Giuseppe Lancellotti: https://www.lancellotti.info/AlgoDesign/`,
    "Il codice ha la licenza MIT: testo [1]. La documentazione ha la licenza CC BY 4.0: testo [2].",
    "Le librerie dell'interfaccia e del programma di AlgoDesign non entrano in MyDev: il loro elenco è nel pacchetto di AlgoDesign, nel file LICENZE-DI-TERZE-PARTI.txt.",
    "",
    "Gli strumenti esterni: si usano per costruire e provare, e non sono nel repository né nel pacchetto",
    "",
    ...ESTERNI,
    "",
    `I pacchetti di sviluppo: ${pacchetti.length}. Si usano per costruire e provare, e non entrano nel pacchetto dell'estensione`,
    "",
    ...righe,
    "",
    "I testi delle licenze",
    "=====================",
    "",
    ...testi.flatMap((t, i) => [`[${i + 1}]`, "", t, ""]),
  ].join("\n");
  return { testo, pacchetti, senzaTesto: pacchetti.filter((p) => p.file.length === 0).map((p) => p.nome), testi: testi.length };
}

const { testo, pacchetti, senzaTesto, testi } = componi();

// L'àncora è l'elenco di chi ha installato, confrontato elemento per elemento. Quell'elenco conta anche le varianti per le altre
// piattaforme, che su questa macchina non sono su disco: sole ammesse a mancare, e contate.
const ALTRA_PIATTAFORMA = /-(aix|alpine|android|darwin|freebsd|linux|netbsd|openbsd|sunos|win32-arm64|win32-ia32)(-|$)/;
const elenco = Bun.spawnSync(["bun", "pm", "ls", "--all"], { cwd: RADICE, stdout: "pipe", stderr: "pipe" });
if (elenco.exitCode !== 0) fermo(`bun pm ls non risponde: ${elenco.stderr.toString()}`);
const righeDiBun = elenco.stdout.toString().split(/\r?\n/);
const secondoBun = righeDiBun.flatMap((r) => /([@\w./-]+@\d\S*)\s*$/.exec(r)?.[1] ?? []);
// Il totale lo stampa solo la forma senza `--all`.
const installati = /\((\d+) installed\)/.exec(Bun.spawnSync(["bun", "pm", "ls"], { cwd: RADICE, stdout: "pipe", stderr: "pipe" }).stdout.toString())?.[1];
if (installati === undefined || String(secondoBun.length) !== installati) fermo(`l'elenco di bun non torna col suo totale: ${secondoBun.length} voci, totale ${installati}`);
const { soloA: nonSuDisco, soloB: nonDaBun } = differenzeDegliElenchi(secondoBun, pacchetti.map((p) => `${p.nome}@${p.versione}`));
const altrePiattaforme = nonSuDisco.filter((v) => ALTRA_PIATTAFORMA.test(v.replace(/@[^@]*$/, "")));
const nonSpiegati = nonSuDisco.filter((v) => !altrePiattaforme.includes(v));

const perLicenza = new Map<string, number>();
for (const p of pacchetti) perLicenza.set(p.licenza, (perLicenza.get(p.licenza) ?? 0) + 1);
console.log(`pacchetti nell'elenco: ${pacchetti.length}; secondo bun: ${installati} = ${pacchetti.length - nonDaBun.length} su disco + ${altrePiattaforme.length} per altre piattaforme + ${nonSpiegati.length} non spiegati; su disco e non per bun: ${nonDaBun.length}`);
console.log(`testi distinti: ${testi}; byte: ${Buffer.byteLength(testo)}`);
console.log(`per licenza: ${[...perLicenza].sort((a, b) => b[1] - a[1]).map(([l, n]) => `${l} ${n}`).join(", ")}`);
console.log(`senza file di licenza: ${senzaTesto.length} [${senzaTesto.join(", ")}]; da leggere a parte: ${pacchetti.filter((p) => /^SEE LICENSE|non dichiarata/.test(p.licenza)).map((p) => `${p.nome} ${p.versione}`).join(", ")}`);

const difetti: string[] = [];
if (nonDaBun.length > 0) difetti.push(`su disco e non per bun: ${nonDaBun.join(", ")}`);
if (nonSpiegati.length > 0) difetti.push(`per bun e non su disco, senza essere di un'altra piattaforma: ${nonSpiegati.join(", ")}`);
if (altrePiattaforme.length === 0) difetti.push("controllo positivo: nessuna variante per altre piattaforme, eppure l'elenco di bun le ha sempre avute");
const inPiu = senzaTesto.filter((n) => !SENZA_TESTO.includes(n));
const nonPiu = SENZA_TESTO.filter((n) => !senzaTesto.includes(n));
if (inPiu.length > 0 || nonPiu.length > 0) difetti.push(`senza file di licenza, diversi da quelli dichiarati: in più ${inPiu.join(", ")}; non più ${nonPiu.join(", ")}`);
const composte = pacchetti.filter((p) => /\bAND\b/.test(p.licenza) && TESTI_ALTROVE[p.nome] === undefined).map((p) => `${p.nome} (${p.licenza})`);
if (composte.length > 0) difetti.push(`una licenza composta, senza una voce in TESTI_ALTROVE: ${composte.join(", ")}`);
const persi = CONTROLLI_POSITIVI.filter((c) => !testo.includes(c));
console.log(`controlli positivi: ${CONTROLLI_POSITIVI.length - persi.length}/${CONTROLLI_POSITIVI.length}`);
if (persi.length > 0) difetti.push(`l'elenco ha perso: ${persi.join("; ")}`);

if (VERIFICA) {
  if (!existsSync(USCITA)) fermo(`il file non c'è: ${USCITA}`);
  const diverso = (letto: string): boolean => letto !== testo;
  if (diverso(readFileSync(USCITA, "utf8"))) difetti.push("il file non è quello che si ricompone adesso: bun ricetta/licenze.ts");
  // Lo stesso confronto deve sapersi accendere, su una copia con un byte in più.
  if (!diverso(`${testo} `)) difetti.push("controllo positivo del confronto: un testo alterato risulta uguale");
} else if (difetti.length === 0) {
  writeFileSync(USCITA, testo);
  console.log(`scritto: ${USCITA}`);
}

for (const d of difetti) console.log(`ROSSO: ${d}`);
console.log(`ESITO: ${difetti.length === 0 ? "VERDE" : "ROSSO"}`);
process.exit(difetti.length === 0 ? 0 : 1);

// Estrae i file dell'inventario dal repository del nucleo, con `git archive`, e ne verifica ogni impronta.
//
//   bun ricetta/nucleo/estrai.ts                  estrae nella cartella ignorata e verifica (atteso verde)
//   bun ricetta/nucleo/estrai.ts --verifica       verifica soltanto ciò che è già estratto
//   opzioni: --repo <cartella>, --inventario <file>, --cartella <cartella vuota o assente>
//
// L'impronta dell'inventario è quella dei byte conservati dal repository; qui si misurano i byte usciti da `git
// archive`. Sono due letture distinte: se l'estrazione convertisse qualcosa, il confronto lo direbbe.
//
// Che cosa NON guarda: se l'inventario è giusto. Che corrisponda alla chiusura degli import lo dice `chiusura.ts`.

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join, relative } from "node:path";
import { parseArgs } from "node:util";
import { commitDellEtichetta, differenzeDegliElenchi, ESTRATTO, fermo, git, impronta, improntaDellInsieme, INVENTARIO, leggiInventario, repoDelNucleo, rosso } from "./comune";

const { values: opzioni } = parseArgs({
  args: Bun.argv.slice(2),
  options: { repo: { type: "string" }, inventario: { type: "string" }, cartella: { type: "string" }, verifica: { type: "boolean", default: false } },
  strict: true,
});

const inventario = leggiInventario(opzioni.inventario ?? INVENTARIO);
const cartella = opzioni.cartella ?? ESTRATTO;
console.log(`etichetta ${inventario.etichetta}, commit ${inventario.commit}, file ${inventario.file.length}`);
console.log(`forma dell'impronta: ${inventario.forma}`);
if (inventario.file.length === 0) fermo("l'inventario non ha file");

if (opzioni.verifica) {
  if (!existsSync(cartella)) fermo(`non c'è nulla da verificare: ${cartella}`);
} else {
  const repo = repoDelNucleo(opzioni.repo);
  const commit = commitDellEtichetta(repo, inventario.etichetta);
  if (commit !== inventario.commit) rosso(`il commit dell'inventario (${inventario.commit}) non è quello dell'etichetta ${inventario.etichetta} (${commit})`);
  // Prima i byte nuovi: se git non li dà, l'estratto che c'è resta intero.
  const archivio = git(repo, "archive", "--format=tar", commit, "--", ...inventario.file.map((v) => v.percorso));
  // La cartella predefinita si rifà da capo; una indicata a mano non si svuota mai.
  if (cartella === ESTRATTO) rmSync(cartella, { recursive: true, force: true });
  else if (existsSync(cartella) && readdirSync(cartella).length > 0) fermo(`la cartella non è vuota: ${cartella}`);
  mkdirSync(cartella, { recursive: true });
  await new Bun.Archive(archivio).extract(cartella);
}

const trovati = (readdirSync(cartella, { recursive: true, withFileTypes: true }) as import("node:fs").Dirent[])
  .filter((d) => d.isFile())
  .map((d) => relative(cartella, join(d.parentPath, d.name)).replaceAll("\\", "/"));
const { soloA: mancanti, soloB: inPiu } = differenzeDegliElenchi(inventario.file.map((v) => v.percorso), trovati);
console.log(`confronto con la cartella: inventario ${inventario.file.length} · cartella ${trovati.length} · mancanti ${mancanti.length} · in più ${inPiu.length}`);
if (mancanti.length > 0) rosso(`manca dalla cartella: ${mancanti[0]}`);
if (inPiu.length > 0) rosso(`in più nella cartella: ${inPiu[0]}`);

let verificati = 0;
for (const v of inventario.file) {
  const misurata = impronta(readFileSync(join(cartella, v.percorso)));
  if (misurata !== v.sha256) rosso(`l'impronta di ${v.percorso} non torna: inventario ${v.sha256}, cartella ${misurata}`);
  verificati++;
}
console.log(`impronte verificate: ${verificati}/${inventario.file.length}`);
console.log(`impronta dell'insieme: ${improntaDellInsieme(inventario.file)}`);
console.log(`totale: ${verificati}`);
console.log("ESITO: VERDE");

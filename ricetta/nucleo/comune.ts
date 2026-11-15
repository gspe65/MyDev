// Ciò che gli script della ricetta e le prove del collaudo hanno in comune: dove sono le cose, git, le impronte, l'inventario.
//
// Le uscite hanno tre valori: 0 verde, 1 rosso (la ricetta non torna), 2 fermo (non si è potuto misurare:
// repository assente, argomenti sbagliati, un comando che non parte). Un fermo non è mai un rosso del nucleo.
// Un'eccezione non catturata è un fermo anch'essa: lo fa questo file, per ogni script che lo importa.
//
// L'etichetta che non è più al commit dell'inventario è un rosso per la ricetta, che custodisce quel legame, e un fermo per
// le prove a valle, che senza quel commit non possono misurare. Mai un verde. Senza etichetta (il contratto dal commit) il commit
// dell'inventario è il riferimento: se nel repository non c'è più, è un fermo per tutti.

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { inflateRawSync } from "node:zlib";

export const RADICE = resolve(import.meta.dir, "..", "..");
export const INVENTARIO = join(import.meta.dir, "inventario.json");
export const ESTRATTO = join(import.meta.dir, "estratto");

/** La forma dell'impronta: dichiarata nell'inventario accanto ai numeri, perché chi verifica sappia che cosa ottenere. */
export const FORMA = "sha256 dei byte conservati dal repository (git show <commit>:<file>)";

export type VoceDelFile = { percorso: string; sha256: string };
/**
 * Il riferimento del nucleo è un'etichetta di AlgoDesign, che dà il commit. Senza `etichetta` il riferimento è il `commit`
 * stesso, scritto per intero: un'eccezione dichiarata (il contratto 1.1 dal commit, fino alla release che lo porta).
 */
export type Inventario = { etichetta?: string; commit: string; forma: string; file: VoceDelFile[] };

/** Il riferimento come si legge in una riga: l'etichetta, o il commit quando l'etichetta non c'è. */
export const riferimentoDi = (i: { etichetta?: string; commit: string }): string => (i.etichetta !== undefined ? i.etichetta : `commit ${i.commit}`);

/** Non si è potuto misurare. */
export function fermo(motivo: string): never {
  console.log(`FERMO: ${motivo}`);
  process.exit(2);
}

function crollo(e: unknown): never {
  fermo(`eccezione non catturata: ${e instanceof Error ? e.message : String(e)}`);
}
process.on("uncaughtException", crollo);
process.on("unhandledRejection", crollo);

/** La ricetta non torna. */
export function rosso(motivo: string): never {
  console.log(`ROSSO: ${motivo}`);
  console.log("ESITO: ROSSO");
  process.exit(1);
}

/** Il repository del nucleo: l'argomento, o la variabile d'ambiente, o la cartella accanto a questa. Mai un percorso scritto qui. */
export function repoDelNucleo(argomento: string | undefined): string {
  const repo = argomento ?? process.env.ALGODESIGN_REPO ?? join(RADICE, "..", "AlgoDesign");
  if (!existsSync(repo)) fermo(`il repository del nucleo non c'è: ${repo} (si indica con --repo o ALGODESIGN_REPO)`);
  return repo;
}

/** Un comando git sul repository del nucleo: i byte dello standard output, senza conversioni. Niente shell, così nessuno riscrive gli argomenti. */
export function git(repo: string, ...argomenti: string[]): Uint8Array {
  const p = Bun.spawnSync(["git", "-C", repo, ...argomenti], { stdout: "pipe", stderr: "pipe" });
  if (p.exitCode !== 0) fermo(`git ${argomenti.join(" ")}: ${p.stderr.toString().trim()}`);
  return p.stdout;
}

/** Il commit di un'etichetta. Un'etichetta assente è un fermo, e anche un ramo: si muove, e la ricetta non si fissa su ciò che si muove. */
export function commitDellEtichetta(repo: string, etichetta: string): string {
  const p = Bun.spawnSync(["git", "-C", repo, "rev-parse", "--verify", "-q", `refs/tags/${etichetta}^{commit}`], { stdout: "pipe", stderr: "pipe" });
  if (p.exitCode !== 0) fermo(`l'etichetta non c'è: ${etichetta}, in ${repo} ${p.stderr.toString().trim()}`.trim());
  return p.stdout.toString().trim();
}

/**
 * Un commit scritto per intero, che c'è nel repository. Un'abbreviazione o un nome di ramo sono un fermo: si muovono, o
 * possono diventare ambigui. Un commit che non c'è (una storia riscritta di là) è un fermo: non si può misurare.
 */
export function commitPresente(repo: string, commit: string): string {
  if (!/^[0-9a-f]{40}$/.test(commit)) fermo(`il commit non è scritto per intero: ${commit}`);
  const p = Bun.spawnSync(["git", "-C", repo, "rev-parse", "--verify", "-q", `${commit}^{commit}`], { stdout: "pipe", stderr: "pipe" });
  if (p.exitCode !== 0 || p.stdout.toString().trim() !== commit) fermo(`il commit non c'è: ${commit}, in ${repo}`);
  return commit;
}

/** Il commit del riferimento dell'inventario: quello dell'etichetta, o il commit stesso quando l'etichetta non c'è. */
export function commitDelRiferimento(repo: string, i: { etichetta?: string; commit: string }): string {
  return i.etichetta !== undefined ? commitDellEtichetta(repo, i.etichetta) : commitPresente(repo, i.commit);
}

/** Per le prove a valle: se l'etichetta non è più al commit dell'inventario, o il commit non c'è più, non si può misurare. */
export function fermoSeEtichettaSpostata(repo: string, inventario: Inventario): void {
  if (commitDelRiferimento(repo, inventario) !== inventario.commit) fermo(`l'etichetta ${inventario.etichetta} non è più al commit dell'inventario`);
}

export const impronta = (byte: Uint8Array): string => createHash("sha256").update(byte).digest("hex");

/** L'impronta di un insieme: uguale solo se percorsi e impronte sono tutti uguali. Serve a confrontare due estrazioni. */
export const improntaDellInsieme = (voci: VoceDelFile[]): string =>
  impronta(new TextEncoder().encode(voci.map((v) => `${v.sha256}  ${v.percorso}\n`).sort().join("")));

export function leggiInventario(percorso: string): Inventario {
  if (!existsSync(percorso)) fermo(`l'inventario non c'è: ${percorso}`);
  const i = JSON.parse(readFileSync(percorso, "utf8")) as Inventario;
  if ((i.etichetta !== undefined && typeof i.etichetta !== "string") || typeof i.commit !== "string" || !Array.isArray(i.file)) fermo(`inventario malformato: ${percorso}`);
  return i;
}

/** Una voce dello zip, letta dall'indice in coda al file: non dipende da quale `tar` c'è sulla macchina. */
export function vocedelloZip(archivio: Buffer, nome: string): Buffer | null {
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

/** Due elenchi si confrontano sugli elementi, nei due versi: il conteggio sta accanto, non al posto. */
export function differenzeDegliElenchi(a: Iterable<string>, b: Iterable<string>): { soloA: string[]; soloB: string[] } {
  const inA = new Set(a);
  const inB = new Set(b);
  return { soloA: [...inA].filter((x) => !inB.has(x)).sort(), soloB: [...inB].filter((x) => !inA.has(x)).sort() };
}

// Gli attesi della prova di conformità: i sorgenti estratti del nucleo, non impacchettati, sotto Bun, chiamati come li chiama
// lo strumento differenziale del nucleo. Scrive in un file l'esito di ogni combinazione di file, linguaggio e lingua.
//
//   bun collaudo/conformita/attesi.ts <cartella del corpus> <file di uscita>
//
// Questo file non importa mai l'adattatore, o la prova si autocertifica: `prova.ts` lo controlla. Può importare solo `node:`
// e l'estratto, che la costruzione verifica per impronta.
//
// A differenza dello strumento differenziale, non salta i file fuori tappa prima di generare: il rifiuto è un esito da confrontare.

import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tetti } from "../../ricetta/nucleo/estratto/app/core/controllo/controllo";
import { testoDelCodice } from "../../ricetta/nucleo/estratto/app/core/genera/forma";
import { linguaggi, type VoceDelLinguaggio } from "../../ricetta/nucleo/estratto/app/core/genera/linguaggi";
import type { LinguaDelCodice } from "../../ricetta/nucleo/estratto/app/core/genera/nomi";
import { apri } from "../../ricetta/nucleo/estratto/app/core/progetto/formato";
import { paroleDelloPseudocodice } from "../../ricetta/nucleo/estratto/app/ui/genera/parole";

const LINGUE: readonly LinguaDelCodice[] = ["it", "en"];

const [corpus, uscita] = process.argv.slice(2);
if (corpus === undefined || uscita === undefined) throw new Error("servono la cartella del corpus e il file di uscita");

/** L'esito di una combinazione: il testo, il rifiuto del generatore o di `apri` così come sono, o l'eccezione. */
function esito(testo: string, voce: VoceDelLinguaggio, lingua: LinguaDelCodice): unknown {
  try {
    const aperto = apri(testo);
    if (!aperto.ok) return { apriRifiuta: aperto };
    const g = voce.genera(aperto.progetto, tetti, lingua, paroleDelloPseudocodice(lingua));
    return g.generato ? { generato: true, testo: testoDelCodice(g.righe) } : g;
  } catch (e) {
    return { eccezione: (e as Error).message };
  }
}

const esiti: Record<string, unknown> = {};
for (const tappa of readdirSync(corpus, { withFileTypes: true }).filter((v) => v.isDirectory()).map((v) => v.name).sort())
  for (const f of readdirSync(join(corpus, tappa)).filter((f) => f.endsWith(".algo")).sort()) {
    const testo = readFileSync(join(corpus, tappa, f), "utf8");
    for (const lingua of LINGUE)
      for (const voce of linguaggi) esiti[`${tappa}/${f.slice(0, -".algo".length)} ${voce.id} ${lingua}`] = esito(testo, voce, lingua);
  }
writeFileSync(uscita, JSON.stringify(esiti));

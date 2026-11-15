// Gli attesi della prova di conformità: i sorgenti estratti del nucleo, non impacchettati, sotto Bun. Scrive due file:
// - l'esito di `genera` per ogni combinazione di file, linguaggio e lingua, chiamato come lo chiama lo strumento differenziale
//   del nucleo;
// - per il contratto 1.1, dal punto d'ingresso estratto: `controlla` di ogni file, `segnalazioni` di ogni file nelle due lingue,
//   e `disegna` di ogni funzione nelle due lingue, senza e coi bollini (`errori` = l'esito di `controlla`), con la misura fissa.
//
//   bun collaudo/conformita/attesi.ts <cartella del corpus> <file di uscita> <file di uscita del disegno>
//
// Questo file non importa mai l'adattatore, o la prova si autocertifica: `prova.ts` lo controlla. Può importare solo `node:`
// e l'estratto, che la costruzione verifica per impronta. Il punto d'ingresso estratto è il sorgente da cui il pacchetto si
// costruisce: qui gira non impacchettato.
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
import { apri as apriDalPuntoDIngresso, controlla, disegna, segnalazioni, type MisuraDelTesto } from "../../ricetta/nucleo/estratto/app/entrypoint/index";

const LINGUE: readonly LinguaDelCodice[] = ["it", "en"];

/**
 * La misura fissa del testo: la stessa del lato Node (`ottenuto.cjs`) e della prova di `disegna` di AlgoDesign. Ogni stile dà una
 * larghezza diversa, e il corsivo porta i mezzi pixel. Nella pagina la misura vera la dà un canvas.
 */
const misura: MisuraDelTesto = (t, stile) => t.length * 7 + (stile === "grassetto" ? t.length : stile === "corsivo" ? t.length / 2 : 0);
const CARATTERE = "system-ui, sans-serif";

const [corpus, uscita, uscitaDelDisegno] = process.argv.slice(2);
if (corpus === undefined || uscita === undefined || uscitaDelDisegno === undefined) throw new Error("servono la cartella del corpus e i due file di uscita");

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

/** Una chiamata del contratto 1.1: il suo risultato, o l'eccezione col messaggio. */
function chiamata(f: () => unknown): unknown {
  try {
    return f();
  } catch (e) {
    return { eccezione: (e as Error).message };
  }
}

const esiti: Record<string, unknown> = {};
const controlli: Record<string, unknown> = {};
const elenchi: Record<string, unknown> = {};
const disegni: Record<string, unknown> = {};
for (const tappa of readdirSync(corpus, { withFileTypes: true }).filter((v) => v.isDirectory()).map((v) => v.name).sort())
  for (const f of readdirSync(join(corpus, tappa)).filter((f) => f.endsWith(".algo")).sort()) {
    const nome = `${tappa}/${f.slice(0, -".algo".length)}`;
    const testo = readFileSync(join(corpus, tappa, f), "utf8");
    for (const lingua of LINGUE) for (const voce of linguaggi) esiti[`${nome} ${voce.id} ${lingua}`] = esito(testo, voce, lingua);

    const aperto = apriDalPuntoDIngresso(testo);
    if (!aperto.ok) {
      controlli[nome] = { apriRifiuta: aperto };
      continue;
    }
    const p = aperto.progetto;
    const errori = controlla(p);
    controlli[nome] = errori;
    for (const lingua of LINGUE) {
      elenchi[`${nome} ${lingua}`] = chiamata(() => segnalazioni(p, lingua));
      for (const funzione of p.functions) {
        disegni[`${nome} ${funzione.id} ${lingua} senza`] = chiamata(() => disegna(p, funzione.id, lingua, misura, CARATTERE));
        disegni[`${nome} ${funzione.id} ${lingua} bollini`] = chiamata(() => disegna(p, funzione.id, lingua, misura, CARATTERE, { errori }));
      }
    }
  }
writeFileSync(uscita, JSON.stringify(esiti));
writeFileSync(uscitaDelDisegno, JSON.stringify({ controlli, segnalazioni: elenchi, disegni }));

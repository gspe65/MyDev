// Il contratto col nucleo di AlgoDesign: cinque funzioni, e nessun'altra. Un'estensione conosce queste, non il nucleo:
// tetti, parole dello pseudocodice, formato del file e registro dei linguaggi restano qui dentro.
//
// Il codice generato segue lo stesso percorso dello strumento differenziale del nucleo, così la prova di conformità
// confronta due chiamate uguali. Il generatore rifiuta da solo un progetto con errori statici: non serve controllare prima.

import { controlla as controllaNelNucleo, tetti, type EsitoDelControllo } from "nucleo/core/controllo/controllo";
import { testoDelCodice, type Generato } from "nucleo/core/genera/forma";
import { linguaggi, type VoceDelLinguaggio } from "nucleo/core/genera/linguaggi";
import type { LinguaDelCodice } from "nucleo/core/genera/nomi";
import {
  aggiungiAllaLibreria as aggiungiNelNucleo,
  leggiAccademico as leggiNelNucleo,
  type Aggiunta,
  type Lettura,
  type OpzioniDellaLettura,
} from "nucleo/core/lettore/accademico";
import { progettoNuovo, type Risultato } from "nucleo/core/modifica/operazioni";
import { apri as apriNelNucleo, salva, type Esito } from "nucleo/core/progetto/formato";
import type { Progetto } from "nucleo/core/progetto/modello";
import { paroleDelloPseudocodice } from "nucleo/ui/genera/parole";

export type { Aggiunta, Esito, EsitoDelControllo, LinguaDelCodice, Lettura, OpzioniDellaLettura, Progetto };

/** Le lingue del nucleo: una nuova lì è un errore di tipo qui, prima che un rifiuto a run time. */
const LINGUE: Record<LinguaDelCodice, true> = { it: true, en: true };

/** Il testo del codice, o il rifiuto del generatore così come il nucleo lo dà. */
export type CodiceGenerato = { readonly generato: true; readonly testo: string } | Extract<Generato, { generato: false }>;

/** Una lettura riuscita: ciò che `aggiungiAllaLibreria` riceve. */
export type LetturaRiuscita = Extract<Lettura, { ok: true }>;

/** Dove si aggiunge: una libreria già aperta, o una nuova con questo nome. */
export type DoveAggiungere = Progetto | { readonly nome: string };

/** Il rifiuto del nucleo sul nome di una libreria nuova. */
type RifiutoDelNome = Extract<Risultato, { ok: false }>["rifiuto"];

/** L'aggiunta del nucleo, con il `testo` del file da scrivere; oppure i conflitti, o perché non si può aggiungere lì. */
export type LibreriaAggiornata =
  | (Extract<Aggiunta, { ok: true }> & { readonly testo: string })
  | Extract<Aggiunta, { ok: false }>
  | { readonly ok: false; readonly rifiuto: RifiutoDelNome | { readonly motivo: "non_e_una_libreria" } };

/** Il progetto contenuto nel testo di un file, o gli errori di apertura. */
export function apri(testo: string): Esito {
  return apriNelNucleo(testo);
}

/** Il controllo statico, con i tetti del nucleo. */
export function controlla(progetto: Progetto): EsitoDelControllo {
  return controllaNelNucleo(progetto, tetti);
}

/**
 * Il codice di un progetto in uno dei linguaggi del registro del nucleo, nella lingua data.
 * Un identificatore sconosciuto è un errore di chi chiama, non un esito del progetto: eccezione.
 */
export function genera(progetto: Progetto, linguaggio: string, lingua: LinguaDelCodice): CodiceGenerato {
  const voce: VoceDelLinguaggio | undefined = linguaggi.find((v) => v.id === linguaggio);
  if (voce === undefined) throw new Error(`linguaggio sconosciuto: ${linguaggio}`);
  if (!Object.hasOwn(LINGUE, lingua)) throw new Error(`lingua sconosciuta: ${lingua}`);
  const g = voce.genera(progetto, tetti, lingua, paroleDelloPseudocodice(lingua));
  return g.generato ? { generato: true, testo: testoDelCodice(g.righe) } : g;
}

/** Il flowchart che un testo in «Accademico» descrive. `libreria`: ciò che il testo può chiamare senza averlo. */
export function leggiAccademico(testo: string, opzioni?: OpzioniDellaLettura, libreria?: Progetto): Lettura {
  return leggiNelNucleo(testo, opzioni, libreria);
}

/**
 * Aggiunge ciò che è stato letto a una libreria aperta, o a una nuova. Il `testo` del risultato è il file da scrivere: chi
 * chiama decide se scriverlo, di norma dopo `controlla(risultato.progetto)`.
 */
export function aggiungiAllaLibreria(dove: DoveAggiungere, letto: LetturaRiuscita, rinomina: boolean): LibreriaAggiornata {
  let libreria: Progetto;
  if ("nome" in dove) {
    const nuova = progettoNuovo({ name: dove.nome, library: true });
    if (!nuova.ok) return { ok: false, rifiuto: nuova.rifiuto };
    libreria = nuova.progetto;
  } else {
    if (dove.metadata.library !== true) return { ok: false, rifiuto: { motivo: "non_e_una_libreria" } };
    libreria = dove;
  }
  const aggiunta = aggiungiNelNucleo(libreria, letto, rinomina);
  return aggiunta.ok ? { ...aggiunta, testo: salva(aggiunta.progetto) } : aggiunta;
}

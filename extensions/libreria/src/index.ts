// Il contratto col nucleo di AlgoDesign: sette funzioni, e nessun'altra. Un'estensione conosce queste, non il nucleo:
// tetti, parole dello pseudocodice, formato del file, registro dei linguaggi, parole e colori del disegno restano qui dentro.
//
// Il codice generato segue lo stesso percorso dello strumento differenziale del nucleo, così la prova di conformità
// confronta due chiamate uguali. Il generatore rifiuta da solo un progetto con errori statici: non serve controllare prima.
//
// Il flowchart disegnato (`disegna`) è quello che l'app esporta: la stessa composizione (`ui/disegno/disegno-della-funzione.ts`),
// i colori della carta dell'insieme scelto (senza le tinte dei generi delle Impostazioni, che non stanno nel progetto),
// nessun segno dell'esecuzione; con `errori` (l'esito di `controlla`) il contorno e il bollino di ogni blocco segnalato,
// come nella finestra dell'app, con gli attributi promessi `data-id`, `data-segno` e `data-codici` (i numeri dei codici
// separati da spazio, come in `segnalazioni`). L'elenco delle segnalazioni (`segnalazioni`) è quello della riga di stato
// dell'app (`ui/segnalazioni.ts`), coi testi interi e il posto come lo vede lo studente. Il testo lo misura chi chiama, col carattere che poi l'SVG scrive: nel browser un canvas,
// come fa l'app (`ui/disegno/misura.ts`). Il codice raggiungibile da qui non usa né il DOM né i globali di Node: il pacchetto
// gira anche in una pagina.

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
import { opzioniPredefinite, type MisuraDelTesto, type OpzioniDelDisegno, type StileDelTesto } from "nucleo/core/disegno/impaginazione";
import { svgDelDisegno } from "nucleo/core/disegno/svg";
import type { ModoDiColore } from "nucleo/core/disegno/tavolozza";
import { tavolozzeDellaCarta, type InsiemeDiColori } from "nucleo/core/disegno/tavolozze-della-carta";
import { geometriaPredefinita } from "nucleo/core/disegno/tema";
import { disegnoDellaFunzione } from "nucleo/ui/disegno/disegno-della-funzione";
import { segnalatiDelleVoci, vociDelControllo } from "nucleo/ui/segnalazioni";
import { numeroDelCodice, type Codice } from "nucleo/i18n/codici";

export type { Aggiunta, Esito, EsitoDelControllo, LinguaDelCodice, Lettura, OpzioniDellaLettura, Progetto };
export type { InsiemeDiColori, MisuraDelTesto, ModoDiColore, OpzioniDelDisegno, StileDelTesto };

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

/** Le scelte del disegno, tutte facoltative coi predefiniti dell'app: le forme del disegno (`OpzioniDelDisegno`), l'insieme
 * di colori (predefinito «tenue»), il modo dell'SVG (predefinito a colori), il riquadro dei cicli col fondo colorato,
 * lo sfondo trasparente e il prefisso degli identificatori (per due disegni nella stessa pagina). */
export interface OpzioniDiDisegna extends Partial<OpzioniDelDisegno> {
  readonly colori?: InsiemeDiColori;
  readonly modo?: ModoDiColore;
  readonly fondoDeiCicli?: boolean;
  readonly trasparente?: boolean;
  readonly id?: string;
  /** L'esito di `controlla` sul progetto: i blocchi segnalati hanno il contorno e il bollino. */
  readonly errori?: EsitoDelControllo;
}

/** Una voce dell'elenco delle segnalazioni, come la riga di stato dell'app la mostra. */
export interface Segnalazione {
  /** Il numero del codice: `E034` per un errore, `A002` per un avviso. */
  readonly numero: string;
  readonly genere: "errore" | "avviso";
  readonly codice: string;
  readonly breve: string;
  readonly accaduto: string;
  readonly suggerimento: string;
  /** Il posto come lo vede lo studente: il blocco col suo testo, il dato con la sua tabella, col nome della procedura o
   * della funzione davanti; mai un `id`. */
  readonly dove: string;
  /** L'`id` del blocco (o della fine di una funzione) che porta il bollino nel disegno; `null` per un dato o un record. */
  readonly blocco: string | null;
  /** L'`id` della funzione del blocco o del dato; assente per una costante comune o un record. */
  readonly funzione?: string;
}

/** Il file SVG del flowchart, con la sua misura in pixel al 100%. */
export interface FlowchartDisegnato {
  readonly svg: string;
  readonly larghezza: number;
  readonly altezza: number;
}

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

/**
 * Il flowchart di una funzione del progetto (il suo `id`), come l'app lo esporta, nella lingua data. `misura` dà la
 * larghezza di un testo su una riga nel `carattere` (una famiglia CSS), alla dimensione del disegno e nello stile chiesto;
 * l'SVG scrive lo stesso carattere. Una funzione, una lingua o un insieme di colori sconosciuti sono errori di chi chiama:
 * eccezione.
 */
export function disegna(progetto: Progetto, idDellaFunzione: string, lingua: LinguaDelCodice, misura: MisuraDelTesto, carattere: string, opzioni: OpzioniDiDisegna = {}): FlowchartDisegnato {
  const funzione = progetto.functions.find((f) => f.id === idDellaFunzione);
  if (funzione === undefined) throw new Error(`funzione sconosciuta: ${idDellaFunzione}`);
  if (!Object.hasOwn(LINGUE, lingua)) throw new Error(`lingua sconosciuta: ${lingua}`);
  const { colori = "tenue", modo = "colori", fondoDeiCicli = false, trasparente = false, id, errori, ...forme } = opzioni;
  if (!Object.hasOwn(tavolozzeDellaCarta, colori)) throw new Error(`insieme di colori sconosciuto: ${colori}`);
  if (!Object.hasOwn(MODI, modo)) throw new Error(`modo di colore sconosciuto: ${modo}`);
  // Una forma lasciata `undefined` resta quella predefinita.
  const scelte = Object.fromEntries(Object.entries(forme).filter(([, v]) => v !== undefined)) as Partial<OpzioniDelDisegno>;
  const d = disegnoDellaFunzione(progetto, funzione, misura, lingua, { ...opzioniPredefinite, ...scelte });
  const segnalati = errori === undefined ? undefined : segnalatiDelleVoci(vociDelControllo(progetto, errori, lingua, principaleDi(progetto)));
  const svg = svgDelDisegno(d, {
    geometria: geometriaPredefinita,
    tavolozza: tavolozzeDellaCarta[colori],
    modo,
    carattere,
    fondoDeiCicli,
    trasparente,
    ...(id === undefined ? {} : { id }),
    ...(segnalati === undefined ? {} : { segnalati }),
  });
  return { svg, larghezza: d.larghezza, altezza: d.altezza };
}

/** I modi dell'SVG: senza questo controllo un modo scritto male darebbe in silenzio il bianco e nero. */
const MODI: Readonly<Record<ModoDiColore, true>> = { colori: true, grigi: true, "bianco-e-nero": true };

/** L'`id` del programma principale: i comandi dell'app nominano i parametri da lì (qui non servono). */
const principaleDi = (p: Progetto) => p.functions.find((f) => f.kind === "main")?.id ?? "";

/** Le segnalazioni del controllo del progetto, come la riga di stato dell'app le mostra, nella lingua data: errori dei
 * record e dei dati, errori e avvisi dei blocchi, avvisi dei dati. Una lingua sconosciuta è un errore di chi chiama. */
export function segnalazioni(progetto: Progetto, lingua: LinguaDelCodice): Segnalazione[] {
  if (!Object.hasOwn(LINGUE, lingua)) throw new Error(`lingua sconosciuta: ${lingua}`);
  return vociDelControllo(progetto, controllaNelNucleo(progetto, tetti), lingua, principaleDi(progetto)).map((v) => ({
    numero: numeroDelCodice[v.codice as Codice],
    genere: v.genere,
    codice: v.codice,
    breve: v.breve,
    accaduto: v.accaduto,
    suggerimento: v.suggerimento,
    dove: v.dove,
    blocco: v.blocco ?? v.fine ?? null,
    ...(v.funzione === undefined ? {} : { funzione: v.funzione }),
  }));
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

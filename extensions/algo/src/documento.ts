// Il contenuto del documento che mostra il codice: il testo della libreria così com'è, o una frase che dice perché non c'è.
// Non importa l'editor: si prova senza finestra.
//
// I nomi delle mancanze restano quelli della libreria, non tradotti: le frasi del nucleo non fanno parte del contratto.

import type { CodiceGenerato, Esito, LinguaDelCodice, Progetto } from "../../libreria/src/index";

/** Le due funzioni della libreria che servono qui. */
export type Libreria = {
  apri(testo: string): Esito;
  genera(progetto: Progetto, linguaggio: string, lingua: LinguaDelCodice): CodiceGenerato;
};

export type Rifiuto = Extract<CodiceGenerato, { generato: false }>;

/** Il testo del documento, e il linguaggio con cui l'editor lo colora. */
export type Documento = { readonly testo: string; readonly idLinguaggio: string };

const COLORE: Readonly<Record<string, string>> = { python: "python", c: "c", typescript: "typescript" };
const SENZA_COLORE = "plaintext";

type Frasi = Record<Rifiuto["perche"] | "apri", string> & { readonly funzione: string; readonly blocco: string };

const FRASI: Record<LinguaDelCodice, Frasi> = {
  it: {
    apri: "Questo file non si apre: non contiene un programma valido.",
    "fuori-tappa": "Il programma usa costrutti fuori dalla sua tappa: il codice non si genera.",
    "errori-statici": "Il programma ha errori da correggere: il codice non si genera.",
    "non-ancora": "Il generatore di {linguaggio} non sa ancora scrivere questo programma:",
    "non-ci-sta": "Il programma non si scrive in {linguaggio}. Ecco che cosa cambiare:",
    funzione: "funzione",
    blocco: "blocco",
  },
  en: {
    apri: "This file cannot be opened: it does not contain a valid program.",
    "fuori-tappa": "The program uses constructs beyond its stage: no code is generated.",
    "errori-statici": "The program has errors to fix: no code is generated.",
    "non-ancora": "The {linguaggio} generator cannot write this program yet:",
    "non-ci-sta": "The program cannot be written in {linguaggio}. What to change:",
    funzione: "function",
    blocco: "block",
  },
};

/** Il testo di un rifiuto del generatore: la frase del motivo, e sotto ciò che il rifiuto elenca. */
export function testoDelRifiuto(r: Rifiuto, linguaggio: string, lingua: LinguaDelCodice): string {
  const f = FRASI[lingua];
  const righe = [f[r.perche].replace("{linguaggio}", linguaggio)];
  if (r.perche === "non-ancora") righe.push(`- ${r.costrutto}`);
  if (r.perche === "non-ci-sta")
    for (const m of r.mancanze) {
      const dove = [m.operatore, m.dato, m.funzione && `${f.funzione} ${m.funzione}`, m.blocco && `${f.blocco} ${m.blocco}`].filter(Boolean);
      righe.push(dove.length > 0 ? `- ${m.specie}: ${dove.join(", ")}` : `- ${m.specie}`);
    }
  return `${righe.join("\n")}\n`;
}

/** Il documento di un file, nel linguaggio e nella lingua dati. */
export function documento(libreria: Libreria, testo: string, linguaggio: string, lingua: LinguaDelCodice): Documento {
  // Le impostazioni accettano anche un valore fuori elenco: l'errore lo nomina, come fa la libreria.
  if (!Object.hasOwn(FRASI, lingua)) throw new Error(`lingua sconosciuta: ${lingua}`);
  const aperto = libreria.apri(testo);
  if (!aperto.ok) return { testo: `${FRASI[lingua].apri}\n`, idLinguaggio: SENZA_COLORE };
  const g = libreria.genera(aperto.progetto, linguaggio, lingua);
  if (!g.generato) return { testo: testoDelRifiuto(g, linguaggio, lingua), idLinguaggio: SENZA_COLORE };
  return { testo: g.testo, idLinguaggio: COLORE[linguaggio] ?? SENZA_COLORE };
}

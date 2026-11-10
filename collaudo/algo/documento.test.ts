// La logica dell'estensione, senza editor. Il pacchetto vero serve per un rifiuto di apertura, che nessun file del corpus produce.

import { describe, expect, test } from "bun:test";
import { join } from "node:path";
import { documento, type Libreria, type Rifiuto } from "../../extensions/algo/src/documento";

const vero = require(join(import.meta.dir, "..", "..", "extensions", "libreria", "dist", "libreria.cjs")) as Libreria;

/** Una libreria che apre tutto e genera ciò che le si dice. */
const finta = (esito: { generato: true; testo: string } | Rifiuto): Libreria => ({
  apri: () => ({ ok: true, progetto: {} as never }),
  genera: () => esito,
});

describe("il testo generato", () => {
  test("passa così com'è, senza aggiunte", () => {
    expect(documento(finta({ generato: true, testo: "x = 1\n" }), "", "python", "it").testo).toBe("x = 1\n");
  });
  test.each([
    ["python", "python"],
    ["c", "c"],
    ["typescript", "typescript"],
    ["pseudocodice", "plaintext"],
    ["accademico", "plaintext"],
  ])("%s si colora come %s", (linguaggio, atteso) => {
    expect(documento(finta({ generato: true, testo: "x" }), "", linguaggio, "it").idLinguaggio).toBe(atteso);
  });
});

describe("i rifiuti", () => {
  // Le mancanze di un file vero del corpus.
  const nonCiSta: Rifiuto = {
    generato: false,
    perche: "non-ci-sta",
    mancanze: [{ specie: "reale", dato: "a" }, { specie: "reale", dato: "b" }, { specie: "arrotondamento", operatore: "round", blocco: "b1" }],
  };
  test("non ci sta, in italiano", () => {
    const d = documento(finta(nonCiSta), "", "accademico", "it");
    expect(d.testo).toBe("Il programma non si scrive in accademico. Ecco che cosa cambiare:\n- reale: a\n- reale: b\n- arrotondamento: round, blocco b1\n");
    expect(d.idLinguaggio).toBe("plaintext");
  });
  test("non ci sta, in inglese", () => {
    expect(documento(finta(nonCiSta), "", "accademico", "en").testo).toBe("The program cannot be written in accademico. What to change:\n- reale: a\n- reale: b\n- arrotondamento: round, block b1\n");
  });
  test("una mancanza di una funzione, e una senza posto", () => {
    const r: Rifiuto = { generato: false, perche: "non-ci-sta", mancanze: [{ specie: "matrice", funzione: "f1" }, { specie: "pi" }] };
    expect(documento(finta(r), "", "accademico", "en").testo).toBe("The program cannot be written in accademico. What to change:\n- matrice: function f1\n- pi\n");
  });
  test("errori statici", () => {
    const r: Rifiuto = { generato: false, perche: "errori-statici" };
    expect(documento(finta(r), "", "c", "it").testo).toBe("Il programma ha errori da correggere: il codice non si genera.\n");
    expect(documento(finta(r), "", "c", "it").idLinguaggio).toBe("plaintext");
  });
  test("fuori tappa", () => {
    expect(documento(finta({ generato: false, perche: "fuori-tappa" }), "", "c", "en").testo).toBe("The program uses constructs beyond its stage: no code is generated.\n");
  });
  test("non ancora, col costrutto", () => {
    expect(documento(finta({ generato: false, perche: "non-ancora", costrutto: "record" }), "", "c", "it").testo).toBe("Il generatore di c non sa ancora scrivere questo programma:\n- record\n");
  });
  test("un testo che non è un file, col pacchetto vero", () => {
    const it = documento(vero, "questo non è un file", "python", "it");
    expect(it.testo).toBe("Questo file non si apre: non contiene un programma valido.\n");
    expect(it.idLinguaggio).toBe("plaintext");
    expect(documento(vero, "questo non è un file", "python", "en").testo).toBe("This file cannot be opened: it does not contain a valid program.\n");
  });
  test("una lingua fuori elenco è un errore col nome, anche su un file che non si apre", () => {
    expect(() => documento(vero, "questo non è un file", "python", "IT" as "it")).toThrow("lingua sconosciuta: IT");
    expect(() => documento(finta({ generato: false, perche: "errori-statici" }), "", "python", "IT" as "it")).toThrow("lingua sconosciuta: IT");
  });
  test("un file col BOM e coi fine riga CRLF dà lo stesso documento", () => {
    const tutta = vero as unknown as typeof import("../../extensions/libreria/src/index");
    const letta = tutta.leggiAccademico("function somma(a: integer, b: integer) → integer\n    return a + b\nend function\n");
    if (!letta.ok) throw new Error("la lettura non è riuscita");
    const nuova = tutta.aggiungiAllaLibreria({ nome: "prova" }, letta, false);
    if (!nuova.ok) throw new Error("l'aggiunta non è riuscita");
    const atteso = documento(vero, nuova.testo, "python", "en");
    expect(atteso.testo).toContain("somma");
    expect(documento(vero, String.fromCharCode(0xfeff) + nuova.testo.replaceAll("\n", "\r\n"), "python", "en")).toEqual(atteso);
  });
});

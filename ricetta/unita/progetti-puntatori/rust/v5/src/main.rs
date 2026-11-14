// L'archivio che cresce, in Rust.
//
// Fa le stesse cose della versione in C e supera gli stessi file di prova. Qui
// Vec e String crescono da soli e restituiscono la memoria da soli: non ci sono
// realloc, free e contatore.

use std::io::{self, BufRead};

const ERR_INTERO: &str = "ERR intero non valido";

struct Voce {
    chiave: String,
    valore: String,
}

struct Store {
    voci: Vec<Voce>,
}

impl Store {
    fn new() -> Store {
        Store { voci: Vec::new() }
    }

    // La posizione della voce con quella chiave, se c'e'.
    fn posizione(&self, chiave: &str) -> Option<usize> {
        for (i, voce) in self.voci.iter().enumerate() {
            if voce.chiave == chiave {
                return Some(i);
            }
        }
        None
    }

    fn leggi(&self, chiave: &str) -> Option<&str> {
        match self.posizione(chiave) {
            Some(i) => Some(&self.voci[i].valore),
            None => None,
        }
    }

    fn imposta(&mut self, chiave: &str, valore: &str) {
        match self.posizione(chiave) {
            Some(i) => self.voci[i].valore = valore.to_string(),
            None => self.voci.push(Voce {
                chiave: chiave.to_string(),
                valore: valore.to_string(),
            }),
        }
    }

    // Toglie la voce e dice se c'era.
    fn cancella(&mut self, chiave: &str) -> bool {
        match self.posizione(chiave) {
            Some(i) => {
                // Come nel C: l'ultima voce prende il posto di quella tolta.
                self.voci.swap_remove(i);
                true
            }
            None => false,
        }
    }

    // Aggiunge 1 al valore della chiave; una chiave assente vale 0.
    fn incrementa(&mut self, chiave: &str) -> Result<i64, String> {
        let numero: i64 = match self.leggi(chiave) {
            None => 0,
            Some(testo) => match testo.parse() {
                Ok(n) => n,
                Err(_) => return Err(ERR_INTERO.to_string()),
            },
        };
        let nuovo = match numero.checked_add(1) {
            Some(n) => n,
            None => return Err(ERR_INTERO.to_string()),
        };
        self.imposta(chiave, &nuovo.to_string());
        Ok(nuovo)
    }
}

fn uno_o_zero(vero: bool) -> String {
    if vero { "1".to_string() } else { "0".to_string() }
}

// Esegue il comando e restituisce la riga di risposta.
fn esegui(archivio: &mut Store, parole: &[&str]) -> String {
    let attese = match parole[0] {
        "SET" => 3,
        "GET" | "DEL" | "EXISTS" | "INCR" => 2,
        _ => return "ERR comando sconosciuto".to_string(),
    };
    if parole.len() != attese {
        return "ERR numero di argomenti".to_string();
    }

    match parole[0] {
        "SET" => {
            archivio.imposta(parole[1], parole[2]);
            "OK".to_string()
        }
        "GET" => match archivio.leggi(parole[1]) {
            Some(valore) => valore.to_string(),
            None => "(nil)".to_string(),
        },
        "DEL" => uno_o_zero(archivio.cancella(parole[1])),
        "EXISTS" => uno_o_zero(archivio.leggi(parole[1]).is_some()),
        _ => match archivio.incrementa(parole[1]) {
            Ok(numero) => numero.to_string(),
            Err(messaggio) => messaggio,
        },
    }
}

fn main() {
    let mut archivio = Store::new();

    for riga in io::stdin().lock().lines() {
        let riga = riga.expect("errore nella lettura dell'ingresso");
        let parole: Vec<&str> = riga.split_whitespace().collect();
        if parole.is_empty() {
            continue;
        }
        println!("{}", esegui(&mut archivio, &parole));
    }
}

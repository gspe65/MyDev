// L'archivio con la lista, in Rust.
//
// Fa le stesse cose della versione in C e supera gli stessi file di prova. Un
// nodo possiede il successivo: Option dice se c'e', Box lo tiene nell'heap.

use std::io::{self, BufRead};

const ERR_INTERO: &str = "ERR intero non valido";

struct Nodo {
    chiave: String,
    valore: String,
    successivo: Option<Box<Nodo>>,
}

struct Store {
    testa: Option<Box<Nodo>>,
}

impl Store {
    fn new() -> Store {
        Store { testa: None }
    }

    fn trova(&self, chiave: &str) -> Option<&Nodo> {
        let mut corrente = self.testa.as_deref();
        while let Some(nodo) = corrente {
            if nodo.chiave == chiave {
                return Some(nodo);
            }
            corrente = nodo.successivo.as_deref();
        }
        None
    }

    fn trova_per_modificare(&mut self, chiave: &str) -> Option<&mut Nodo> {
        let mut corrente = self.testa.as_deref_mut();
        while let Some(nodo) = corrente {
            if nodo.chiave == chiave {
                return Some(nodo);
            }
            corrente = nodo.successivo.as_deref_mut();
        }
        None
    }

    fn leggi(&self, chiave: &str) -> Option<&str> {
        match self.trova(chiave) {
            Some(nodo) => Some(&nodo.valore),
            None => None,
        }
    }

    // Una chiave nuova entra in testa alla lista.
    fn imposta(&mut self, chiave: &str, valore: &str) {
        match self.trova_per_modificare(chiave) {
            Some(nodo) => nodo.valore = valore.to_string(),
            None => {
                let nuovo = Box::new(Nodo {
                    chiave: chiave.to_string(),
                    valore: valore.to_string(),
                    successivo: self.testa.take(),
                });
                self.testa = Some(nuovo);
            }
        }
    }

    // Toglie il nodo e dice se c'era. In posto c'e' il collegamento che
    // arriva al nodo in esame: la testa, o il successivo del nodo prima.
    fn cancella(&mut self, chiave: &str) -> bool {
        let mut posto = &mut self.testa;
        loop {
            match posto {
                None => return false,
                Some(nodo) if nodo.chiave == chiave => {
                    *posto = nodo.successivo.take();
                    return true;
                }
                Some(nodo) => posto = &mut nodo.successivo,
            }
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

// Senza questo Drop ogni nodo libererebbe il successivo chiamando se stesso: con
// una lista lunga lo stack si esaurisce. Qui si procede un nodo alla volta.
impl Drop for Store {
    fn drop(&mut self) {
        let mut corrente = self.testa.take();
        while let Some(mut nodo) = corrente {
            corrente = nodo.successivo.take();
        }
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

#[cfg(test)]
mod prove {
    use super::*;

    #[test]
    fn una_lista_lunga_si_libera_senza_esaurire_lo_stack() {
        let mut archivio = Store::new();
        for _ in 0..1_000_000 {
            let nuovo = Box::new(Nodo {
                chiave: String::new(),
                valore: String::new(),
                successivo: archivio.testa.take(),
            });
            archivio.testa = Some(nuovo);
        }
    }
}

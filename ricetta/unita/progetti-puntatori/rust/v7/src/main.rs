// L'archivio con la tabella hash, in Rust.
//
// Fa le stesse cose della versione in C e supera gli stessi file di prova. I
// bucket sono scritti a mano, come nel C, per vedere come e' fatta una tabella
// hash: nel lavoro di tutti i giorni si usa HashMap.

use std::io::{self, BufRead};

const ERR_INTERO: &str = "ERR intero non valido";
const BUCKET_INIZIALI: usize = 4;

struct Nodo {
    chiave: String,
    valore: String,
    successivo: Option<Box<Nodo>>,
}

struct Store {
    bucket: Vec<Option<Box<Nodo>>>,
    quante: usize,
}

// Lo stesso calcolo del C. Il numero, se supera il massimo, riparte da zero: in
// Rust va chiesto apertamente, con wrapping_mul e wrapping_add.
fn hash(testo: &str) -> u32 {
    let mut risultato: u32 = 0;
    for byte in testo.bytes() {
        risultato = risultato.wrapping_mul(31).wrapping_add(byte as u32);
    }
    risultato
}

fn nuovi_bucket(numero: usize) -> Vec<Option<Box<Nodo>>> {
    let mut bucket = Vec::new();
    for _ in 0..numero {
        bucket.push(None);
    }
    bucket
}

impl Store {
    fn new() -> Store {
        Store {
            bucket: nuovi_bucket(BUCKET_INIZIALI),
            quante: 0,
        }
    }

    fn indice(&self, chiave: &str) -> usize {
        hash(chiave) as usize % self.bucket.len()
    }

    fn trova(&self, chiave: &str) -> Option<&Nodo> {
        let mut corrente = self.bucket[self.indice(chiave)].as_deref();
        while let Some(nodo) = corrente {
            if nodo.chiave == chiave {
                return Some(nodo);
            }
            corrente = nodo.successivo.as_deref();
        }
        None
    }

    fn trova_per_modificare(&mut self, chiave: &str) -> Option<&mut Nodo> {
        let indice = self.indice(chiave);
        let mut corrente = self.bucket[indice].as_deref_mut();
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

    // Raddoppia i bucket e sposta i nodi: nessun nodo si copia.
    fn ridimensiona(&mut self) {
        let nuovi = nuovi_bucket(self.bucket.len() * 2);
        let vecchi = std::mem::replace(&mut self.bucket, nuovi);

        for mut lista in vecchi {
            while let Some(mut nodo) = lista {
                lista = nodo.successivo.take();
                let indice = self.indice(&nodo.chiave);
                nodo.successivo = self.bucket[indice].take();
                self.bucket[indice] = Some(nodo);
            }
        }
    }

    // Una chiave nuova entra in testa al suo bucket.
    fn imposta(&mut self, chiave: &str, valore: &str) {
        match self.trova_per_modificare(chiave) {
            Some(nodo) => nodo.valore = valore.to_string(),
            None => {
                if self.quante == self.bucket.len() {
                    self.ridimensiona();
                }
                // Il bucket si sceglie dopo il ridimensionamento.
                let indice = self.indice(chiave);
                let nuovo = Box::new(Nodo {
                    chiave: chiave.to_string(),
                    valore: valore.to_string(),
                    successivo: self.bucket[indice].take(),
                });
                self.bucket[indice] = Some(nuovo);
                self.quante += 1;
            }
        }
    }

    // Toglie il nodo e dice se c'era. In posto c'e' il collegamento che
    // arriva al nodo in esame: la testa del bucket, o il successivo del nodo prima.
    fn cancella(&mut self, chiave: &str) -> bool {
        let indice = self.indice(chiave);
        let mut posto = &mut self.bucket[indice];
        loop {
            match posto {
                None => return false,
                Some(nodo) if nodo.chiave == chiave => {
                    *posto = nodo.successivo.take();
                    self.quante -= 1;
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
    fn i_bucket_raddoppiano_e_le_chiavi_si_ritrovano() {
        let mut archivio = Store::new();
        for i in 0..200 {
            archivio.imposta(&format!("chiave{i}"), "valore");
        }
        assert!(archivio.bucket.len() > BUCKET_INIZIALI);
        for i in 0..200 {
            assert!(archivio.leggi(&format!("chiave{i}")).is_some());
        }
    }

    #[test]
    fn lo_stesso_testo_da_lo_stesso_hash_del_c() {
        // 'a' vale 97, 'b' vale 98: 97 * 31 + 98 = 3105.
        assert_eq!(hash("ab"), 3105);
    }
}

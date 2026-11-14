// Quanto tempo serve a ritrovare tutte le chiavi: bucket scritti a mano e HashMap.
// Si puo' dare il numero delle chiavi sulla riga di comando: .\tempi 200000
// I millisecondi dipendono dal PC: per confrontarli si compila con -O.
use std::collections::HashMap;
use std::env;
use std::time::Instant;

struct Nodo {
    chiave: String,
    successivo: Option<Box<Nodo>>,
}

fn hash(testo: &str) -> u32 {
    let mut risultato: u32 = 0;
    for byte in testo.bytes() {
        risultato = risultato.wrapping_mul(31).wrapping_add(byte as u32);
    }
    risultato
}

fn presente(bucket: &[Option<Box<Nodo>>], chiave: &str) -> bool {
    let mut corrente = bucket[hash(chiave) as usize % bucket.len()].as_deref();
    while let Some(nodo) = corrente {
        if nodo.chiave == chiave {
            return true;
        }
        corrente = nodo.successivo.as_deref();
    }
    false
}

fn main() {
    let chiavi: usize = match env::args().nth(1) {
        Some(testo) => testo.parse().expect("numero di chiavi"),
        None => 20000,
    };
    let mut numero_bucket = 4;
    while numero_bucket < chiavi {
        numero_bucket *= 2;
    }
    let mut bucket = Vec::new();
    for _ in 0..numero_bucket {
        bucket.push(None);
    }
    let mut mappa = HashMap::new();
    let mut testi = Vec::new();
    for i in 0..chiavi {
        let testo = format!("chiave{i}");
        let indice = hash(&testo) as usize % numero_bucket;
        let nuovo = Box::new(Nodo {
            chiave: testo.clone(),
            successivo: bucket[indice].take(),
        });
        bucket[indice] = Some(nuovo);
        mappa.insert(testo.clone(), i);
        testi.push(testo);
    }

    let inizio = Instant::now();
    let mut trovate = 0;
    for testo in &testi {
        if presente(&bucket, testo) {
            trovate += 1;
        }
    }
    println!("a mano: {} ms, trovate {trovate}", inizio.elapsed().as_millis());

    let inizio = Instant::now();
    let mut trovate = 0;
    for testo in &testi {
        if mappa.contains_key(testo) {
            trovate += 1;
        }
    }
    println!("HashMap: {} ms, trovate {trovate}", inizio.elapsed().as_millis());
}

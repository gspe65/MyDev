// I bucket scritti a mano: un Vec di liste.
struct Nodo {
    chiave: String,
    successivo: Option<Box<Nodo>>,
}

const BUCKET: usize = 4;

fn hash(testo: &str) -> u32 {
    let mut risultato: u32 = 0;
    for byte in testo.bytes() {
        risultato = risultato.wrapping_mul(31).wrapping_add(byte as u32);
    }
    risultato
}

fn inserisci(bucket: &mut [Option<Box<Nodo>>], chiave: &str) {
    let i = hash(chiave) as usize % BUCKET;
    let nuovo = Box::new(Nodo {
        chiave: chiave.to_string(),
        successivo: bucket[i].take(),
    });
    bucket[i] = Some(nuovo);
}

fn presente(bucket: &[Option<Box<Nodo>>], chiave: &str) -> bool {
    let i = hash(chiave) as usize % BUCKET;
    let mut corrente = &bucket[i];
    while let Some(nodo) = corrente {
        if nodo.chiave == chiave {
            return true;
        }
        corrente = &nodo.successivo;
    }
    false
}

fn stampa(trovato: bool) {
    if trovato {
        println!("trovato");
    } else {
        println!("assente");
    }
}

fn main() {
    let mut bucket = [None, None, None, None];
    inserisci(&mut bucket, "anna");
    inserisci(&mut bucket, "bruno");
    inserisci(&mut bucket, "carla");
    inserisci(&mut bucket, "elena");
    stampa(presente(&bucket, "bruno"));
    stampa(presente(&bucket, "dario"));
}

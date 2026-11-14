// Senza wrapping_mul il numero non puo' superare il massimo.
fn hash(testo: &str) -> u32 {
    let mut risultato: u32 = 0;
    for byte in testo.bytes() {
        risultato = risultato * 31 + byte as u32;
    }
    risultato
}

fn main() {
    println!("{}", hash("ab"));
    println!("{}", hash("colore"));
    println!("{}", hash("archivio"));
}

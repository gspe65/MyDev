// Stesso calcolo del C: il ritorno a zero in Rust va chiesto apertamente.
fn hash(testo: &str) -> u32 {
    let mut risultato: u32 = 0;
    for byte in testo.bytes() {
        risultato = risultato.wrapping_mul(31).wrapping_add(byte as u32);
    }
    risultato
}

fn main() {
    println!("{}", hash("ab"));
    println!("{}", hash("ba"));
}

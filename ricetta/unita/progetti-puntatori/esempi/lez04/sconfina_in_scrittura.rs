// La stessa copia di strcpy, byte per byte: Rust controlla ogni indice.
fn main() {
    let mut destinazione = [0u8; 8];
    let testo = "una frase troppo lunga";
    let mut i = 0;
    for byte in testo.bytes() {
        destinazione[i] = byte;
        i += 1;
    }
    println!("copiati {i} byte in {}", destinazione.len());
}

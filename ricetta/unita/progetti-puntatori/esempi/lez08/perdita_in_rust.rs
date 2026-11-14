// Anche in Rust si puo' perdere memoria: il programma compila e gira.
fn main() {
    std::mem::forget(Box::new(5));
    println!("nessun errore");
}

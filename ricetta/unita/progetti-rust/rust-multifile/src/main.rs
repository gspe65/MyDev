// Un programma su due file: `mod utils` dice al compilatore di cercare src/utils.rs.
// Il C ha bisogno di utils.h per sapere che somma esiste; Rust no, il modulo porta con se' le firme.
mod utils;

fn main() {
    let (a, b) = (5, 3);
    println!("Somma: {}", utils::somma(a, b));
}

// La lunghezza sta dentro la &str: non si cerca nessun terminatore.
fn lunghezza(s: &str) -> usize {
    s.len()
}

fn main() {
    println!("{}", lunghezza("ciao"));
    println!("{}", lunghezza("perché"));
}

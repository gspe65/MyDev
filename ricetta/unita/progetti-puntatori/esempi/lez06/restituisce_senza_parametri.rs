// Senza parametri da cui possa dipendere, il riferimento restituito e' un errore.
fn locale() -> &i32 {
    let x = 5;
    &x
}

fn main() {
    println!("{}", locale());
}

// La Box esce dalla funzione: il proprietario diventa il main.
fn nuovo_intero(valore: i32) -> Box<i32> {
    Box::new(valore)
}

fn main() {
    let p = nuovo_intero(42);
    println!("{}", p);
}

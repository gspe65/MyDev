// Result dice se l'operazione e' riuscita, e match obbliga a guardare.
fn stampa(testo: &str) {
    let risultato: Result<i32, _> = testo.parse();
    match risultato {
        Ok(numero) => println!("{numero}"),
        Err(_) => println!("non e' un numero"),
    }
}

fn main() {
    stampa("42");
    stampa("ciao");
}

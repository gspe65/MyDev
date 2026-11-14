// checked_add non trabocca: dice se il risultato ci sta.
fn stampa(numero: i64) {
    match numero.checked_add(1) {
        Some(nuovo) => println!("{nuovo}"),
        None => println!("troppo grande"),
    }
}

fn main() {
    stampa(41);
    stampa(i64::MAX);
}

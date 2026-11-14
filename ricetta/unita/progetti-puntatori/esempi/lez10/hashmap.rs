// La tabella hash della libreria standard.
use std::collections::HashMap;

fn stampa(valore: Option<&i32>) {
    match valore {
        Some(numero) => println!("{numero}"),
        None => println!("assente"),
    }
}

fn main() {
    let mut archivio = HashMap::new();
    archivio.insert("anna", 1);
    archivio.insert("bruno", 2);
    stampa(archivio.get("anna"));
    stampa(archivio.get("dario"));
}

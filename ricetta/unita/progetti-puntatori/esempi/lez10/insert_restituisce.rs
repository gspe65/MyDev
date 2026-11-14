// insert restituisce il valore che c'era prima, se c'era.
use std::collections::HashMap;

fn stampa(valore: Option<i32>) {
    match valore {
        Some(numero) => println!("c'era {numero}"),
        None => println!("non c'era"),
    }
}

fn main() {
    let mut archivio = HashMap::new();
    stampa(archivio.insert("anna", 1));
    stampa(archivio.insert("anna", 2));
    println!("{}", archivio.len());
}

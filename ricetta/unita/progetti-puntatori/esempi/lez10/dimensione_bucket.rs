// Quante celle occupano un nodo con la sua chiave e l'array dei bucket.
use std::mem::size_of;

struct Nodo {
    _chiave: String,
    _successivo: Option<Box<Nodo>>,
}

fn main() {
    println!("Nodo: {} celle", size_of::<Nodo>());
    println!("bucket: {} celle", size_of::<[Option<Box<Nodo>>; 4]>());
}

// Option<Box<Nodo>> occupa le celle di un indirizzo: None non costa niente.
use std::mem::size_of;

struct Nodo {
    _valore: i32,
    _successivo: Option<Box<Nodo>>,
}

fn main() {
    println!("{}", size_of::<Option<Box<Nodo>>>());
    println!("{}", size_of::<Nodo>());
}

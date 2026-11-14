// Senza Box un nodo conterrebbe il successivo, che ne conterrebbe un altro.
struct Nodo {
    valore: i32,
    successivo: Option<Nodo>,
}

fn main() {
    let nodo = Nodo { valore: 1, successivo: None };
    println!("{}", nodo.valore);
}

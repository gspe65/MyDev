// Come in C si tiene il nodo precedente: ma quel nodo e' gia' in prestito.
struct Nodo {
    valore: i32,
    successivo: Option<Box<Nodo>>,
}

fn togli(testa: &mut Option<Box<Nodo>>, valore: i32) {
    let mut precedente: Option<&mut Box<Nodo>> = None;
    let mut corrente = testa.as_mut();
    while let Some(nodo) = corrente {
        if nodo.valore == valore {
            break;
        }
        corrente = nodo.successivo.as_mut();
        precedente = Some(nodo);
    }
    if let Some(nodo) = precedente {
        nodo.successivo = None;
    }
}

fn main() {
    let mut testa = Some(Box::new(Nodo { valore: 1, successivo: None }));
    togli(&mut testa, 1);
}

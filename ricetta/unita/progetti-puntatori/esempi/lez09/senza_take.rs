// Da un valore in prestito non si puo' portare via un pezzo: lascerebbe un buco.
struct Nodo {
    successivo: Option<Box<Nodo>>,
}

struct Lista {
    testa: Option<Box<Nodo>>,
}

impl Lista {
    fn inserisci(&mut self) {
        let nuovo = Box::new(Nodo { successivo: self.testa });
        self.testa = Some(nuovo);
    }
}

fn main() {
    let mut lista = Lista { testa: None };
    lista.inserisci();
}

// Le prove stanno accanto al programma: cargo test le esegue.
struct Nodo {
    valore: i32,
    successivo: Option<Box<Nodo>>,
}

fn inserisci(testa: Option<Box<Nodo>>, valore: i32) -> Option<Box<Nodo>> {
    Some(Box::new(Nodo { valore, successivo: testa }))
}

fn main() {
    match inserisci(None, 1) {
        Some(nodo) => println!("{} {}", nodo.valore, nodo.successivo.is_none()),
        None => println!("vuota"),
    }
}

#[cfg(test)]
mod prove {
    use super::*;

    #[test]
    fn il_nodo_nuovo_sta_in_testa() {
        match inserisci(inserisci(None, 1), 2) {
            Some(nodo) => assert_eq!(nodo.valore, 2),
            None => panic!("la lista e' vuota"),
        }
    }

    #[test]
    fn il_primo_nodo_non_ha_successivo() {
        match inserisci(None, 1) {
            Some(nodo) => assert!(nodo.successivo.is_none()),
            None => panic!("la lista e' vuota"),
        }
    }
}

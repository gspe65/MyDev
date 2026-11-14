// Option dice se il risultato c'e'; match obbliga a considerare i due casi.
fn cerca(v: &[i32], cercato: i32) -> Option<usize> {
    for (i, numero) in v.iter().enumerate() {
        if *numero == cercato {
            return Some(i);
        }
    }
    None
}

fn stampa(risultato: Option<usize>) {
    match risultato {
        Some(i) => println!("trovato in {i}"),
        None => println!("assente"),
    }
}

fn main() {
    let v = [10, 20, 30];
    stampa(cerca(&v, 20));
    stampa(cerca(&v, 99));
}

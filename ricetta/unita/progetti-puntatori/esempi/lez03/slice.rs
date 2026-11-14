// Una slice porta con se' indirizzo e lunghezza.
fn somma(v: &[i32]) -> i32 {
    let mut totale = 0;
    for numero in v {
        totale += numero;
    }
    totale
}

fn main() {
    let v = [1, 2, 3, 4];
    println!("{}", somma(&v));
    println!("{}", v.len());
    println!("{}", somma(&v[1..3]));
}

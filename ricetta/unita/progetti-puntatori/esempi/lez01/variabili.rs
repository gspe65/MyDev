// let dichiara, mut permette di cambiare, fn definisce una funzione.
fn doppio(x: i32) -> i32 {
    x * 2
}

fn main() {
    let mut numero: i32 = 21;
    println!("{numero}");
    numero = doppio(numero);
    println!("{numero}");
}

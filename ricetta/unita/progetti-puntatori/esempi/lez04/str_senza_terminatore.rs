// Una &str conosce la propria lunghezza: non c'e' terminatore.
fn main() {
    let parola = "ciao";
    println!("{}", &parola[0..3]);
    println!("{}", parola.len());
}

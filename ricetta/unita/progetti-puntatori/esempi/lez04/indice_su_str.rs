// Una &str non si indicizza con un numero: un carattere puo' occupare piu' byte.
fn main() {
    let parola = "ciao";
    println!("{}", parola[0]);
}

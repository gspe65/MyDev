// Una &str e' in UTF-8: una lettera accentata occupa due byte.
fn main() {
    let parola = "perché";
    println!("{}", parola.len());
    println!("{}", parola.chars().count());
}

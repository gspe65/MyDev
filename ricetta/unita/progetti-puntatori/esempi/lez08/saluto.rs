// La funzione riceve un testo in prestito e consegna una String nuova.
fn saluto(nome: &str) -> String {
    let mut s = String::from("ciao ");
    s.push_str(nome);
    s
}

fn main() {
    let s = saluto("anna");
    println!("{s}");
}

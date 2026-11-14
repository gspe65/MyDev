// take prende il valore e al suo posto lascia None.
fn mostra(nome: &str, valore: Option<i32>) {
    match valore {
        Some(n) => println!("{}: {}", nome, n),
        None => println!("{}: niente", nome),
    }
}

fn main() {
    let mut a = Some(5);
    let b = a.take();
    mostra("a", a);
    mostra("b", b);
}

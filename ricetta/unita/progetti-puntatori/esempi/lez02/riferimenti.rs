// Con & si legge attraverso il riferimento; con &mut si puo' anche scrivere.
fn doppio(x: &i32) -> i32 {
    *x * 2
}

fn azzera(x: &mut i32) {
    *x = 0;
}

fn main() {
    let mut numero = 7;
    let risultato = doppio(&numero);
    println!("doppio: {risultato}");
    azzera(&mut numero);
    println!("numero: {numero}");
}

// Con un parametro l'errore e' un altro: si restituisce un riferimento a una locale.
fn locale(a: &i32) -> &i32 {
    let x = *a + 1;
    &x
}

fn main() {
    let a = 5;
    println!("{}", locale(&a));
}

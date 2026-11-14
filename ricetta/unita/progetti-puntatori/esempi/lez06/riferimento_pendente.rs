// Il riferimento vivrebbe piu' a lungo della variabile: viene rifiutato.
fn main() {
    let r;
    {
        let x = 5;
        r = &x;
    }
    println!("{r}");
}

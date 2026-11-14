// La variabile ora vive piu' a lungo del riferimento: il compilatore accetta.
fn main() {
    let x = 5;
    let r;
    {
        r = &x;
    }
    println!("{r}");
}

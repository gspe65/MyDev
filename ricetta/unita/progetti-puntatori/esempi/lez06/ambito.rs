// Una variabile vive fino alla fine del suo blocco.
fn main() {
    let x = 1;
    {
        let x = 2;
        println!("{x}");
    }
    println!("{x}");
}

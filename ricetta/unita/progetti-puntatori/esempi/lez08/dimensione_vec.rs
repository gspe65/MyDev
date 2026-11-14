// Nello stack un Vec occupa tre numeri: indirizzo, lunghezza, capacita'.
fn main() {
    println!("{}", std::mem::size_of::<Vec<i32>>());
}

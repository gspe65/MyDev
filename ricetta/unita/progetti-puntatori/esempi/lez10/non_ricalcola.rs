// Anche in Rust, se i bucket raddoppiano, ogni chiave va ricalcolata: qui non si fa.
fn hash(testo: &str) -> u32 {
    let mut risultato: u32 = 0;
    for byte in testo.bytes() {
        risultato = risultato.wrapping_mul(31).wrapping_add(byte as u32);
    }
    risultato
}

fn presente(bucket: &[Vec<String>], chiave: &str) -> bool {
    let i = hash(chiave) as usize % bucket.len();
    bucket[i].contains(&chiave.to_string())
}

fn main() {
    let mut bucket: Vec<Vec<String>> = vec![Vec::new(); 4];
    for chiave in ["anna", "bruno"] {
        let i = hash(chiave) as usize % bucket.len();
        bucket[i].push(chiave.to_string());
    }

    // I bucket raddoppiano, ma ogni lista resta al suo indice.
    bucket.resize(8, Vec::new());

    println!("anna: {}", presente(&bucket, "anna"));
    println!("bruno: {}", presente(&bucket, "bruno"));
}

// lines legge una riga per volta, split_whitespace la divide in parole.
use std::io::{self, BufRead};

fn main() {
    for riga in io::stdin().lock().lines() {
        let riga = riga.expect("errore nella lettura");
        let parole: Vec<&str> = riga.split_whitespace().collect();
        println!("{} parole: {}", parole.len(), parole[0]);
    }
}

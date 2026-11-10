// 03 - Scrivere e rileggere un file di testo
//
// Solo libreria standard.
//
// Nota sui percorsi: il file viene creato nella cartella da cui LANCI il
// programma, non in quella dove sta il sorgente.
//
// Non c'e' nessuna fclose: il file si chiude da solo quando la variabile f
// esce dal suo blocco. E gli errori non si possono ignorare per sbaglio:
// ogni operazione torna un Result, e il punto interrogativo lo passa a chi chiama.

use std::fs::File;
use std::io::{self, BufRead, BufReader, Write};
use std::process::ExitCode;

const NOMEFILE: &str = "elenco.txt";

// scrive tre righe nel file
fn scrivi() -> io::Result<()> {
    let mut f = File::create(NOMEFILE)?; // come fopen con "w": crea o azzera

    writeln!(f, "mela")?;
    writeln!(f, "pera")?;
    writeln!(f, "arancia")?;

    Ok(())
}

// rilegge il file riga per riga e torna quante righe ha letto
fn leggi_e_conta() -> io::Result<usize> {
    let f = File::open(NOMEFILE)?; // come fopen con "r"
    let mut n = 0;

    // lines() toglie da solo l'a-capo finale
    for riga in BufReader::new(f).lines() {
        let riga = riga?;
        n += 1;
        println!("  riga {n}: {riga}");
    }

    Ok(n)
}

fn main() -> ExitCode {
    if let Err(e) = scrivi() {
        eprintln!("non riesco a creare {NOMEFILE}: {e}");
        return ExitCode::FAILURE;
    }

    println!("ho scritto {NOMEFILE}, ora lo rileggo:");

    match leggi_e_conta() {
        Ok(n) => {
            println!("righe totali: {n}");
            ExitCode::SUCCESS
        }
        Err(e) => {
            eprintln!("non riesco ad aprire {NOMEFILE}: {e}");
            ExitCode::FAILURE
        }
    }
}

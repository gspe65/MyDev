// 05 - struct e file binario
//
// Una struct tiene insieme dati di tipo diverso. Qui si salva e si rilegge
// cosi' com'e' in memoria, come fanno fwrite e fread: nessuna conversione in
// testo, quindi il file NON si legge con cat.
//
// #[repr(C)] obbliga il compilatore a disporre i campi come farebbe il C. Senza,
// Rust puo' riordinarli: la dimensione e il contenuto del file non sarebbero garantiti.

use std::fs::File;
use std::io::{Read, Write};
use std::mem;
use std::process::ExitCode;
use std::slice;

const NOMEFILE: &str = "studenti.dat";
const QUANTI: usize = 3;

#[repr(C)]
#[derive(Clone, Copy)]
struct Studente {
    nome: [u8; 32],
    voto: i32,
}

fn studente(nome: &str, voto: i32) -> Studente {
    let mut s = Studente {
        nome: [0; 32],
        voto,
    };
    s.nome[..nome.len()].copy_from_slice(nome.as_bytes());
    s
}

// il nome finisce al primo byte a zero, come una stringa del C
fn nome_di(s: &Studente) -> String {
    let fine = s.nome.iter().position(|&b| b == 0).unwrap_or(s.nome.len());
    String::from_utf8_lossy(&s.nome[..fine]).into_owned()
}

fn main() -> ExitCode {
    let classe = [
        studente("Anna", 8),
        studente("Bruno", 6),
        studente("Carla", 9),
    ];

    println!("una struct occupa {} byte", mem::size_of::<Studente>());

    // --- scrittura ---
    // SICUREZZA: leggo come byte la memoria di un array valido, che resta vivo
    // per tutta la vita di `byte`; la struct non ha buchi fra i campi (32 + 4 byte).
    let byte =
        unsafe { slice::from_raw_parts(classe.as_ptr().cast::<u8>(), mem::size_of_val(&classe)) };

    if let Err(e) = File::create(NOMEFILE).and_then(|mut f| f.write_all(byte)) {
        eprintln!("scrittura: {e}");
        return ExitCode::FAILURE;
    }
    println!("scritti {QUANTI} record in {NOMEFILE}");

    // --- rilettura ---
    let mut riletti = [studente("", 0); QUANTI];

    // SICUREZZA: come sopra; in piu' qualunque sequenza di byte e' un valore
    // valido sia per [u8; 32] sia per i32, quindi il file non puo' creare valori illegali.
    let byte = unsafe {
        slice::from_raw_parts_mut(
            riletti.as_mut_ptr().cast::<u8>(),
            mem::size_of_val(&riletti),
        )
    };

    if let Err(e) = File::open(NOMEFILE).and_then(|mut f| f.read_exact(byte)) {
        eprintln!("lettura: {e}");
        return ExitCode::FAILURE;
    }

    println!("riletti {QUANTI} record:");
    for s in &riletti {
        println!("  {:<10} voto {}", nome_di(s), s.voto);
    }

    ExitCode::SUCCESS
}

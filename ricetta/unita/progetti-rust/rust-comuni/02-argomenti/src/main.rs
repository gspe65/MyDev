// 02 - Argomenti della riga di comando e valore di uscita
//
// Due cose che servono subito:
//
//   env::args()   quello che l'utente ha scritto, nome del programma compreso
//   ExitCode      il "valore di uscita": la shell lo mette in $?
//
// Come in C, il primo elemento e' il nome del programma: gli argomenti veri
// partono dall'indice 1.

use std::env;
use std::process::ExitCode;

fn main() -> ExitCode {
    let argv: Vec<String> = env::args().collect();

    println!("mi chiamo          : {}", argv[0]);
    println!("argomenti ricevuti : {}", argv.len() - 1);

    for (i, argomento) in argv.iter().enumerate().skip(1) {
        println!("  argv[{i}] = {argomento}");
    }

    if argv.len() < 2 {
        // i messaggi d'errore vanno su stderr, non su stdout:
        // cosi' restano separati dal risultato del programma
        eprintln!("uso: {} <parola> [altre parole...]", argv[0]);
        return ExitCode::FAILURE; // vale 1: qualcosa non va
    }

    ExitCode::SUCCESS
}

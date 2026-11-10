// 06 - Redirezione: come fa la shell a eseguire  programma > file
//
// La libreria standard di Rust non ha dup2: qui si chiama quella del sistema,
// dichiarandola a mano nel blocco `unsafe extern "C"`.
//
// Ogni processo nasce con tre canali gia' aperti:
//     0  stdin    l'ingresso
//     1  stdout   l'uscita normale
//     2  stderr   i messaggi d'errore
//
// "Redirigere" vuol dire cambiare dove punta uno di questi numeri, e lo si fa
// con dup2(nuovo, vecchio): da quel momento tutto cio' che va sul canale
// "vecchio" finisce dove punta "nuovo".
//
// println! non se ne accorge nemmeno: continua a scrivere sul canale 1.
// E' esattamente cio' che fa la shell prima di lanciare un comando.

use std::ffi::{CStr, c_char, c_int, c_uint};
use std::io;
use std::process::ExitCode;

const STDOUT_FILENO: c_int = 1;
const O_WRONLY: c_int = 1;
const O_CREAT: c_int = 512;
const O_TRUNC: c_int = 1024;
const NOMEFILE: &CStr = c"uscita_dirottata.txt";

// Le dichiarazioni sono una promessa: il compilatore non le puo' controllare.
// I tre puntini dicono che open, come printf, accetta un numero variabile di argomenti.
unsafe extern "C" {
    fn open(percorso: *const c_char, opzioni: c_int, ...) -> c_int;
    fn dup(canale: c_int) -> c_int;
    fn dup2(da: c_int, a: c_int) -> c_int;
    fn close(canale: c_int) -> c_int;
}

// il perror del C: il nome della chiamata e il motivo che ha dato il sistema
fn errore(cosa: &str) -> ExitCode {
    eprintln!("{cosa}: {}", io::Error::last_os_error());
    ExitCode::FAILURE
}

fn main() -> ExitCode {
    println!("questa riga va sullo schermo");

    // 1) mi metto da parte una copia del canale 1, per poterlo ripristinare
    let copia_stdout = unsafe { dup(STDOUT_FILENO) };
    if copia_stdout < 0 {
        return errore("dup");
    }

    // 2) apro il file: creare se non c'e', azzerare se c'e'
    let fd = unsafe {
        open(
            NOMEFILE.as_ptr(),
            O_WRONLY | O_CREAT | O_TRUNC,
            0o644 as c_uint,
        )
    };
    if fd < 0 {
        return errore("open");
    }

    // 3) il canale 1 adesso punta al file
    if unsafe { dup2(fd, STDOUT_FILENO) } < 0 {
        return errore("dup2");
    }
    unsafe { close(fd) }; // il descrittore originale non serve piu'

    // 4) queste println! finiscono nel file, senza saperlo.
    //    println! svuota il buffer a ogni a-capo, anche verso un file: la fflush
    //    del C qui non serve.
    println!("questa riga finisce nel file");
    println!("e anche questa");

    // 5) rimetto il canale 1 dov'era
    if unsafe { dup2(copia_stdout, STDOUT_FILENO) } < 0 {
        return errore("dup2 di ritorno");
    }
    unsafe { close(copia_stdout) };

    println!("e siamo tornati sullo schermo");
    println!("guarda il file con:  cat {}", NOMEFILE.to_string_lossy());

    ExitCode::SUCCESS
}

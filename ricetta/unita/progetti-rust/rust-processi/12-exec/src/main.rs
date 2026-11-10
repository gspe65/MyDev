// 12 - exec(): il processo diventa un ALTRO programma
//
// fork() duplica. exec() sostituisce: il processo resta lo stesso (stesso
// PID) ma il codice, i dati e lo stack vengono buttati e rimpiazzati con
// quelli del programma nuovo.
//
// Conseguenza importante: se exec riesce, la riga dopo NON viene mai
// eseguita. Non c'e' ritorno. Per questo si controlla solo il fallimento.
//
// fork + exec insieme sono il modo in cui la shell lancia i comandi: si
// duplica, e la copia diventa il programma che hai scritto.
//
// La libreria standard fa lo stesso con std::process::Command, in una riga. Qui
// si chiamano le due funzioni del sistema per vedere che cosa c'e' sotto.

use std::ffi::{c_char, c_int};
use std::io;
use std::process::ExitCode;
use std::ptr;

unsafe extern "C" {
    fn fork() -> c_int;
    fn getpid() -> c_int;
    fn wait(stato: *mut c_int) -> c_int;
    fn execlp(programma: *const c_char, argv0: *const c_char, ...) -> c_int;
    fn _exit(valore: c_int) -> !;
}

fn main() -> ExitCode {
    println!("[padre] sono {}, ora creo un figlio", unsafe { getpid() });

    let f = unsafe { fork() };
    if f < 0 {
        eprintln!("fork: {}", io::Error::last_os_error());
        return ExitCode::FAILURE;
    }

    if f == 0 {
        println!(
            "  [figlio] sono {}, sto per diventare il comando 'date'",
            unsafe { getpid() }
        );

        // execlp: cerca il programma nel PATH.
        // Primo argomento: il programma da eseguire.
        // Secondo: quello che il programma vedra' come argv[0].
        // Poi gli argomenti veri, e in fondo un NULL che dice "ho finito".
        // Le stringhe si scrivono c"...": finiscono con lo zero che il C si aspetta.
        unsafe {
            execlp(
                c"date".as_ptr(),
                c"date".as_ptr(),
                c"+oggi e' il %d/%m/%Y".as_ptr(),
                ptr::null::<c_char>(),
            );
        }

        // Se siamo qui, execlp NON e' riuscita
        eprintln!("  [figlio] execlp: {}", io::Error::last_os_error());
        unsafe { _exit(127) }; // 127 e' il valore convenzionale per "comando non trovato"
    }

    let mut stato: c_int = 0;
    unsafe { wait(&mut stato) };

    println!(
        "[padre] il figlio {f} e' uscito con {}",
        (stato >> 8) & 0xff
    );
    println!("[padre] nota: il figlio aveva lo stesso PID prima e dopo exec");

    ExitCode::SUCCESS
}

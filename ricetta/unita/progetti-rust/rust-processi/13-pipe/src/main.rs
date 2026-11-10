// 13 - pipe(): due processi che si parlano
//
// Una pipe e' un tubo con due estremita':
//     fd[0]  si LEGGE
//     fd[1]  si SCRIVE
//
// Dopo la fork le hanno tutti e due i processi, e ognuno deve CHIUDERE quella
// che non usa. Se il padre non chiude fd[1], la sua read non finisce mai:
// resta in attesa di un dato che potrebbe arrivare da se stesso.
//
// Il figlio qui non scrive a mano: dirotta il proprio stdout dentro la pipe
// (dup2) e poi diventa "ls -l" (execlp). E' esattamente quello che fa la
// shell quando scrivi:   ls -l | qualcosa

use std::ffi::{c_char, c_int, c_void};
use std::io::{self, Write};
use std::process::ExitCode;
use std::ptr;

const STDOUT_FILENO: c_int = 1;

unsafe extern "C" {
    fn pipe(estremi: *mut c_int) -> c_int;
    fn fork() -> c_int;
    fn dup2(da: c_int, a: c_int) -> c_int;
    fn close(canale: c_int) -> c_int;
    fn read(canale: c_int, dove: *mut c_void, quanti: usize) -> isize;
    fn wait(stato: *mut c_int) -> c_int;
    fn execlp(programma: *const c_char, argv0: *const c_char, ...) -> c_int;
    fn _exit(valore: c_int) -> !;
}

fn errore(cosa: &str) -> ExitCode {
    eprintln!("{cosa}: {}", io::Error::last_os_error());
    ExitCode::FAILURE
}

fn main() -> ExitCode {
    let mut fd: [c_int; 2] = [0; 2];

    if unsafe { pipe(fd.as_mut_ptr()) } < 0 {
        return errore("pipe");
    }

    let figlio = unsafe { fork() };
    if figlio < 0 {
        return errore("fork");
    }

    if figlio == 0 {
        // ---------- FIGLIO: scrive nella pipe ----------
        unsafe {
            close(fd[0]); // non legge
            dup2(fd[1], STDOUT_FILENO); // il suo stdout diventa la pipe
            close(fd[1]); // la copia originale non serve piu'

            execlp(
                c"ls".as_ptr(),
                c"ls".as_ptr(),
                c"-l".as_ptr(),
                ptr::null::<c_char>(),
            );
        }

        // si arriva qui solo se execlp NON e' riuscita
        eprintln!("execlp: {}", io::Error::last_os_error());
        unsafe { _exit(127) };
    }

    // ---------- PADRE: legge dalla pipe ----------
    unsafe { close(fd[1]) }; // senza questa close la read non finirebbe mai

    let mut buffer = [0u8; 256];
    let mut righe = 0;

    println!("[padre] ecco cosa mi manda il figlio:");

    loop {
        // SICUREZZA: read scrive al massimo buffer.len() byte, dentro il buffer
        let letti = unsafe { read(fd[0], buffer.as_mut_ptr().cast(), buffer.len()) };
        if letti <= 0 {
            break;
        }

        let arrivati = &buffer[..letti as usize];
        io::stdout().write_all(arrivati).unwrap();
        righe += arrivati.iter().filter(|&&b| b == b'\n').count();
    }

    unsafe {
        close(fd[0]);
        wait(ptr::null_mut());
    }

    println!("[padre] righe ricevute: {righe}");
    ExitCode::SUCCESS
}

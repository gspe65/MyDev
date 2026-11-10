// 20 - Aspettare, ma non per sempre: poll() con scadenza
//
// L'altra faccia dell'asincronia: non "faccio partire e continuo" (progetto
// 19), ma "aspetto che arrivi qualcosa, pero' non oltre N millisecondi".
//
// Senza timeout un programma che legge da un tubo vuoto resta li' per sempre.
// poll() risolve: gli dai un elenco di canali e quanto sei disposto ad
// aspettare, e ti dice cosa e' pronto.
//
//   valore > 0   qualcosa e' pronto
//   valore = 0   e' scaduto il tempo, nessuno ha parlato
//   valore < 0   errore
//
// Rispetto ad alarm() (progetto 16) poll e' piu' preciso e piu' mirato: la
// scadenza e' in millisecondi e riguarda un canale specifico, non l'intero
// programma.

use std::ffi::{c_int, c_short, c_uint, c_void};
use std::io;
use std::process::ExitCode;
use std::ptr;

const MESSAGGI: i32 = 3;
const POLLIN: c_short = 1;

#[repr(C)]
struct PollFd {
    fd: c_int,
    events: c_short,
    revents: c_short,
}

unsafe extern "C" {
    fn pipe(estremi: *mut c_int) -> c_int;
    fn fork() -> c_int;
    fn close(canale: c_int) -> c_int;
    fn read(canale: c_int, dove: *mut c_void, quanti: usize) -> isize;
    fn write(canale: c_int, da: *const c_void, quanti: usize) -> isize;
    fn poll(canali: *mut PollFd, quanti: c_uint, millisecondi: c_int) -> c_int;
    fn sleep(secondi: c_uint) -> c_uint;
    fn wait(stato: *mut c_int) -> c_int;
    fn _exit(valore: c_int) -> !;
}

fn perror(cosa: &str) {
    eprintln!("{cosa}: {}", io::Error::last_os_error());
}

fn main() -> ExitCode {
    let mut fd: [c_int; 2] = [0; 2];

    if unsafe { pipe(fd.as_mut_ptr()) } < 0 {
        perror("pipe");
        return ExitCode::FAILURE;
    }

    let figlio = unsafe { fork() };
    if figlio < 0 {
        perror("fork");
        return ExitCode::FAILURE;
    }

    if figlio == 0 {
        // ---------- FIGLIO: parla ogni due secondi ----------
        unsafe { close(fd[0]) };

        for i in 1..=MESSAGGI {
            let riga = format!("messaggio numero {i}\n");

            unsafe { sleep(2) };
            if unsafe { write(fd[1], riga.as_ptr().cast(), riga.len()) } < 0 {
                perror("write");
                break;
            }
        }

        unsafe {
            close(fd[1]);
            _exit(0);
        }
    }

    // ---------- PADRE: aspetta al massimo un secondo per volta ----------
    unsafe { close(fd[1]) };

    let mut canale = PollFd {
        fd: fd[0],
        events: POLLIN, // mi interessa: "c'e' qualcosa da leggere"
        revents: 0,
    };

    let mut ricevuti = 0;
    let mut attese = 0;

    while ricevuti < MESSAGGI {
        let pronto = unsafe { poll(&mut canale, 1, 1000) }; // 1000 ms = 1 secondo

        if pronto < 0 {
            perror("poll");
            break;
        }

        if pronto == 0 {
            attese += 1;
            println!("  ...un secondo senza notizie, intanto faccio altro ({attese})");
            continue;
        }

        let mut buffer = [0u8; 128];
        // SICUREZZA: read scrive al massimo buffer.len() byte, dentro il buffer
        let letti = unsafe { read(fd[0], buffer.as_mut_ptr().cast(), buffer.len()) };

        if letti <= 0 {
            break; // il figlio ha chiuso il tubo
        }

        let testo = String::from_utf8_lossy(&buffer[..letti as usize]);
        ricevuti += 1;
        println!("-> ricevuto: {}", testo.split('\n').next().unwrap_or(""));
    }

    unsafe {
        close(fd[0]);
        wait(ptr::null_mut());
    }

    println!("\nmessaggi ricevuti: {ricevuti}, attese a vuoto: {attese}");
    ExitCode::SUCCESS
}

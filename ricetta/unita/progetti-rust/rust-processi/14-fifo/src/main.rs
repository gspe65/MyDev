// 14 - FIFO: una pipe con un nome sul disco
//
// La pipe del progetto 13 funziona solo fra processi imparentati: il figlio
// eredita i descrittori dal padre. Se due programmi diversi, lanciati da due
// terminali diversi, devono parlarsi, serve un punto d'incontro con un nome:
// la FIFO, creata con mkfifo.
//
// Una FIFO SEMBRA un file (la vedi con ls, ha un nome e dei permessi), ma non
// contiene niente: e' un tubo. Quello che scrivi da una parte esce dall'altra
// e poi sparisce.
//
// Attenzione: aprire una FIFO in lettura si BLOCCA finche' qualcuno non la
// apre in scrittura, e viceversa. E' voluto: serve a sincronizzare i due lati.

use std::ffi::{CStr, c_char, c_int, c_uint, c_void};
use std::io;
use std::process::ExitCode;
use std::ptr;

const TUBO: &CStr = c"mio_tubo";
const O_RDONLY: c_int = 0;
const O_WRONLY: c_int = 1;

unsafe extern "C" {
    fn mkfifo(percorso: *const c_char, permessi: c_uint) -> c_int;
    fn unlink(percorso: *const c_char) -> c_int;
    fn fork() -> c_int;
    fn open(percorso: *const c_char, opzioni: c_int, ...) -> c_int;
    fn close(canale: c_int) -> c_int;
    fn read(canale: c_int, dove: *mut c_void, quanti: usize) -> isize;
    fn write(canale: c_int, da: *const c_void, quanti: usize) -> isize;
    fn sleep(secondi: c_uint) -> c_uint;
    fn wait(stato: *mut c_int) -> c_int;
    fn _exit(valore: c_int) -> !;
}

fn perror(cosa: &str) {
    eprintln!("{cosa}: {}", io::Error::last_os_error());
}

fn main() -> ExitCode {
    unsafe { unlink(TUBO.as_ptr()) }; // se e' rimasto da una prova prima

    if unsafe { mkfifo(TUBO.as_ptr(), 0o600) } < 0 {
        // 0o600 = solo io posso leggerlo
        perror("mkfifo");
        return ExitCode::FAILURE;
    }
    println!(
        "ho creato la FIFO '{0}'. Guardala con:  ls -l {0}",
        TUBO.to_string_lossy()
    );
    println!("(la 'p' come primo carattere dei permessi vuol dire pipe)\n");

    let f = unsafe { fork() };
    if f < 0 {
        perror("fork");
        unsafe { unlink(TUBO.as_ptr()) };
        return ExitCode::FAILURE;
    }

    if f == 0 {
        // ---------- FIGLIO: scrive ----------
        // si blocca finche' il padre non apre in lettura
        let fd = unsafe { open(TUBO.as_ptr(), O_WRONLY) };
        if fd < 0 {
            perror("  [figlio] open in scrittura");
            unsafe { _exit(1) };
        }

        for parola in ["primo", "secondo", "terzo"] {
            let riga = format!("{parola} messaggio\n");

            if unsafe { write(fd, riga.as_ptr().cast(), riga.len()) } < 0 {
                perror("  [figlio] write");
                break;
            }
            unsafe { sleep(1) };
        }

        unsafe {
            close(fd);
            _exit(0);
        }
    }

    // ---------- PADRE: legge ----------
    // si sblocca quando il figlio apre in scrittura
    let fd = unsafe { open(TUBO.as_ptr(), O_RDONLY) };
    if fd < 0 {
        perror("[padre] open in lettura");
        unsafe { unlink(TUBO.as_ptr()) };
        return ExitCode::FAILURE;
    }

    let mut buffer = [0u8; 128];

    loop {
        // SICUREZZA: read scrive al massimo buffer.len() byte, dentro il buffer
        let letti = unsafe { read(fd, buffer.as_mut_ptr().cast(), buffer.len()) };
        if letti <= 0 {
            break; // read torna 0 quando l'ULTIMO scrittore chiude: e' la fine del tubo
        }

        let testo = String::from_utf8_lossy(&buffer[..letti as usize]);
        println!(
            "[padre] ricevuto: {}",
            testo.split('\n').next().unwrap_or("")
        );
    }

    unsafe {
        close(fd);
        wait(ptr::null_mut());
        unlink(TUBO.as_ptr()); // la FIFO va cancellata: e' un file vero
    }

    println!("[padre] il figlio ha chiuso, tubo rimosso.");
    ExitCode::SUCCESS
}

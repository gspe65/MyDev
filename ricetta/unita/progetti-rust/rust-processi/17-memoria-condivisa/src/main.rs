// 17 - Memoria condivisa fra padre e figlio
//
// Dopo una fork, padre e figlio hanno memoria SEPARATA: se il figlio cambia
// una variabile, il padre non se ne accorge. Questa e' la differenza piu'
// importante fra processi e thread (nel progetto 07 i thread condividevano
// tutto, e per questo serviva il mutex).
//
// Il programma lo dimostra due volte:
//   - con una variabile normale  -> il padre NON vede il cambiamento
//   - con una pagina da mmap     -> il padre lo vede, e' la stessa memoria
//
// Qui non serve nessun semaforo: il padre legge DOPO che il figlio e' finito,
// e ad aspettarlo ci pensa wait(). Quando invece i due lavorano INSIEME sulla
// stessa memoria il semaforo serve: e' il progetto 18.

use std::ffi::{c_int, c_void};
use std::io;
use std::mem;
use std::process::ExitCode;
use std::ptr;

const PROT_READ: c_int = 1;
const PROT_WRITE: c_int = 2;
const MAP_SHARED: c_int = 1;
const MAP_ANONYMOUS: c_int = 32;

#[repr(C)]
struct Condiviso {
    numero: c_int,
    messaggio: [u8; 64],
}

unsafe extern "C" {
    fn mmap(
        indirizzo: *mut c_void,
        quanti: usize,
        protezione: c_int,
        opzioni: c_int,
        canale: c_int,
        scostamento: i64,
    ) -> *mut c_void;
    fn munmap(indirizzo: *mut c_void, quanti: usize) -> c_int;
    fn fork() -> c_int;
    fn wait(stato: *mut c_int) -> c_int;
    fn _exit(valore: c_int) -> !;
}

fn scrivi(dest: &mut [u8; 64], testo: &str) {
    *dest = [0; 64];
    dest[..testo.len()].copy_from_slice(testo.as_bytes());
}

fn leggi(da: &[u8; 64]) -> String {
    let fine = da.iter().position(|&b| b == 0).unwrap_or(da.len());
    String::from_utf8_lossy(&da[..fine]).into_owned()
}

fn main() -> ExitCode {
    let mut normale = 100; // memoria NON condivisa, serve per il confronto
    let quanti = mem::size_of::<Condiviso>();

    // Una pagina di memoria che sopravvive alla fork ed e' la stessa per
    // tutti e due i processi. MAP_SHARED e' la parola chiave: con
    // MAP_PRIVATE ogni processo ne avrebbe una copia sua.
    let pagina = unsafe {
        mmap(
            ptr::null_mut(),
            quanti,
            PROT_READ | PROT_WRITE,
            MAP_SHARED | MAP_ANONYMOUS,
            -1,
            0,
        )
    };
    if pagina as isize == -1 {
        // e' il MAP_FAILED del C
        eprintln!("mmap: {}", io::Error::last_os_error());
        return ExitCode::FAILURE;
    }
    let c = pagina.cast::<Condiviso>();

    // SICUREZZA, per tutti gli accessi a *c qui sotto: mmap ha dato una pagina
    // valida e abbastanza grande, e i due processi non la toccano mai insieme,
    // perche' il padre aspetta il figlio con wait prima di guardarla.
    unsafe {
        (*c).numero = 100;
        scrivi(&mut (*c).messaggio, "(ancora niente)");
    }

    let figlio = unsafe { fork() };
    if figlio < 0 {
        eprintln!("fork: {}", io::Error::last_os_error());
        return ExitCode::FAILURE;
    }

    if figlio == 0 {
        // ---------- FIGLIO: cambia tutte e due le variabili ----------
        normale = 999;
        unsafe {
            (*c).numero = 999;
            scrivi(&mut (*c).messaggio, "scritto dal figlio");
            println!(
                "  [figlio] normale = {normale}   condiviso = {}",
                (*c).numero
            );
            _exit(0);
        }
    }

    // ---------- PADRE: aspetta e poi guarda ----------
    unsafe {
        wait(ptr::null_mut());

        println!("[padre]  normale   = {normale}  <- il figlio l'aveva messo a 999!");
        println!(
            "[padre]  condiviso = {}  <- questo si': e' la STESSA memoria",
            (*c).numero
        );
        println!("[padre]  messaggio = {}", leggi(&(*c).messaggio));

        munmap(pagina, quanti);
    }

    ExitCode::SUCCESS
}

// 21 - Socket TCP: due processi che si parlano attraverso la rete
//
// La pipe (13) e la FIFO (14) collegano processi sullo stesso computer.
// Il socket collega processi che possono stare su macchine diverse. Qui
// restiamo su "localhost" (127.0.0.1), cioe' il computer stesso, ma il codice
// e' identico a quello che useresti in rete.
//
// Le cinque mosse del SERVITORE:
//     socket()   creo il punto di comunicazione
//     bind()     gli do' un indirizzo e una porta
//     listen()   dichiaro che accetto chiamate
//     accept()   aspetto una chiamata (si blocca)
//     read/write parlo
//
// Le due mosse del CLIENTE:
//     socket()   creo il punto di comunicazione
//     connect()  chiamo il servitore
//
// La libreria standard fa le prime tre in una sola riga, TcpListener::bind. Qui
// si chiamano una per una, per vedere le mosse.
//
// Qui si usa la porta 0: vuol dire "sistema, scegli tu una porta libera".
// Cosi' il programma non va mai in conflitto con qualcos'altro.

use std::ffi::{c_int, c_void};
use std::io;
use std::mem;
use std::process::ExitCode;
use std::ptr;

const AF_INET: u16 = 2;
const SOCK_STREAM: c_int = 1;
const INADDR_LOOPBACK: u32 = 0x7f00_0001; // 127.0.0.1

// La stessa disposizione della struct sockaddr_in: 16 byte, misurati.
#[repr(C)]
struct SockaddrIn {
    sin_family: u16,
    sin_port: u16,
    sin_addr: u32,
    sin_zero: [u8; 8],
}

// Il C vuole `struct sockaddr *`: qui dichiariamo il puntatore del tipo che passiamo.
unsafe extern "C" {
    fn socket(famiglia: c_int, tipo: c_int, protocollo: c_int) -> c_int;
    fn bind(canale: c_int, indirizzo: *const SockaddrIn, lunghezza: c_int) -> c_int;
    fn getsockname(canale: c_int, indirizzo: *mut SockaddrIn, lunghezza: *mut c_int) -> c_int;
    fn listen(canale: c_int, in_coda: c_int) -> c_int;
    fn accept(canale: c_int, indirizzo: *mut SockaddrIn, lunghezza: *mut c_int) -> c_int;
    fn connect(canale: c_int, indirizzo: *const SockaddrIn, lunghezza: c_int) -> c_int;
    fn read(canale: c_int, dove: *mut c_void, quanti: usize) -> isize;
    fn write(canale: c_int, da: *const c_void, quanti: usize) -> isize;
    fn close(canale: c_int) -> c_int;
    fn fork() -> c_int;
    fn wait(stato: *mut c_int) -> c_int;
    fn _exit(valore: c_int) -> !;
}

fn perror(cosa: &str) {
    eprintln!("{cosa}: {}", io::Error::last_os_error());
}

fn errore(cosa: &str) -> ExitCode {
    perror(cosa);
    ExitCode::FAILURE
}

// legge una volta dal canale e torna il testo fino al primo a-capo
fn leggi_riga(canale: c_int) -> Option<String> {
    let mut buffer = [0u8; 128];
    // SICUREZZA: read scrive al massimo buffer.len() byte, dentro il buffer
    let letti = unsafe { read(canale, buffer.as_mut_ptr().cast(), buffer.len()) };
    if letti <= 0 {
        return None;
    }
    let testo = String::from_utf8_lossy(&buffer[..letti as usize]);
    Some(testo.split('\n').next().unwrap_or("").to_string())
}

fn main() -> ExitCode {
    let lunghezza_indirizzo = mem::size_of::<SockaddrIn>() as c_int;

    // ---------- SERVITORE: preparazione ----------
    let servitore = unsafe { socket(AF_INET as c_int, SOCK_STREAM, 0) };
    if servitore < 0 {
        return errore("socket");
    }

    // to_be ("to big endian") e' l'htonl e l'htons del C: l'ordine dei byte della rete
    let mut indirizzo = SockaddrIn {
        sin_family: AF_INET,
        sin_port: 0, // scegli tu
        sin_addr: INADDR_LOOPBACK.to_be(),
        sin_zero: [0; 8],
    };

    if unsafe { bind(servitore, &indirizzo, lunghezza_indirizzo) } < 0 {
        return errore("bind");
    }

    // mi faccio dire quale porta e' stata scelta
    let mut lunghezza = lunghezza_indirizzo;
    if unsafe { getsockname(servitore, &mut indirizzo, &mut lunghezza) } < 0 {
        return errore("getsockname");
    }

    if unsafe { listen(servitore, 1) } < 0 {
        return errore("listen");
    }

    println!(
        "[servitore] in ascolto su 127.0.0.1 porta {}",
        u16::from_be(indirizzo.sin_port)
    );

    let figlio = unsafe { fork() };
    if figlio < 0 {
        return errore("fork");
    }

    if figlio == 0 {
        // ---------- CLIENTE ----------
        unsafe { close(servitore) };

        let cliente = unsafe { socket(AF_INET as c_int, SOCK_STREAM, 0) };
        if cliente < 0 {
            perror("  [cliente] socket");
            unsafe { _exit(1) };
        }

        if unsafe { connect(cliente, &indirizzo, lunghezza_indirizzo) } < 0 {
            perror("  [cliente] connect");
            unsafe { _exit(1) };
        }

        let saluto = "ciao, sono il cliente\n";
        if unsafe { write(cliente, saluto.as_ptr().cast(), saluto.len()) } < 0 {
            perror("  [cliente] write");
        }

        if let Some(risposta) = leggi_riga(cliente) {
            println!("  [cliente] il servitore mi ha risposto: {risposta}");
        }

        unsafe {
            close(cliente);
            _exit(0);
        }
    }

    // ---------- SERVITORE: la conversazione ----------
    // si blocca qui
    let conversazione = unsafe { accept(servitore, ptr::null_mut(), ptr::null_mut()) };
    if conversazione < 0 {
        return errore("accept");
    }

    if let Some(messaggio) = leggi_riga(conversazione) {
        println!("[servitore] ho ricevuto: {messaggio}");
    }

    let risposta = "ricevuto forte e chiaro\n";
    if unsafe { write(conversazione, risposta.as_ptr().cast(), risposta.len()) } < 0 {
        perror("[servitore] write");
    }

    unsafe {
        close(conversazione);
        close(servitore);
        wait(ptr::null_mut());
    }

    println!("[servitore] conversazione chiusa.");
    ExitCode::SUCCESS
}

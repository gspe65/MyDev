/* 21 - Socket TCP: due processi che si parlano attraverso la rete
 *
 * SOLO con gcc: serve <sys/socket.h>, che per i programmi Windows di clang
 * non c'e' (li' si usa winsock2.h, con un'altra interfaccia).
 *
 * La pipe (13) e la FIFO (14) collegano processi sullo stesso computer.
 * Il socket collega processi che possono stare su macchine diverse. Qui
 * restiamo su "localhost" (127.0.0.1), cioe' il computer stesso, ma il codice
 * e' identico a quello che useresti in rete.
 *
 * Le cinque mosse del SERVITORE:
 *     socket()   creo il punto di comunicazione
 *     bind()     gli do' un indirizzo e una porta
 *     listen()   dichiaro che accetto chiamate
 *     accept()   aspetto una chiamata (si blocca)
 *     read/write parlo
 *
 * Le due mosse del CLIENTE:
 *     socket()   creo il punto di comunicazione
 *     connect()  chiamo il servitore
 *
 * Qui si usa la porta 0: vuol dire "sistema, scegli tu una porta libera".
 * Cosi' il programma non va mai in conflitto con qualcos'altro.
 */

#define _POSIX_C_SOURCE 200809L

#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <arpa/inet.h>
#include <sys/wait.h>

int main(void)
{
    /* ---------- SERVITORE: preparazione ---------- */
    int servitore = socket(AF_INET, SOCK_STREAM, 0);
    if (servitore < 0) {
        perror("socket");
        return 1;
    }

    struct sockaddr_in indirizzo;
    memset(&indirizzo, 0, sizeof indirizzo);
    indirizzo.sin_family      = AF_INET;
    indirizzo.sin_addr.s_addr = htonl(INADDR_LOOPBACK);  /* 127.0.0.1 */
    indirizzo.sin_port        = 0;                       /* scegli tu */

    if (bind(servitore, (struct sockaddr *)&indirizzo, sizeof indirizzo) < 0) {
        perror("bind");
        return 1;
    }

    /* mi faccio dire quale porta e' stata scelta */
    socklen_t lunghezza = sizeof indirizzo;
    if (getsockname(servitore, (struct sockaddr *)&indirizzo, &lunghezza) < 0) {
        perror("getsockname");
        return 1;
    }

    if (listen(servitore, 1) < 0) {
        perror("listen");
        return 1;
    }

    printf("[servitore] in ascolto su 127.0.0.1 porta %d\n",
           (int)ntohs(indirizzo.sin_port));
    fflush(stdout);

    pid_t figlio = fork();
    if (figlio < 0) {
        perror("fork");
        return 1;
    }

    if (figlio == 0) {
        /* ---------- CLIENTE ---------- */
        close(servitore);

        int cliente = socket(AF_INET, SOCK_STREAM, 0);
        if (cliente < 0) {
            perror("  [cliente] socket");
            _exit(1);
        }

        if (connect(cliente, (struct sockaddr *)&indirizzo,
                    sizeof indirizzo) < 0) {
            perror("  [cliente] connect");
            _exit(1);
        }

        const char *saluto = "ciao, sono il cliente\n";
        if (write(cliente, saluto, strlen(saluto)) < 0)
            perror("  [cliente] write");

        char risposta[128];
        int n = (int)read(cliente, risposta, sizeof risposta - 1);
        if (n > 0) {
            risposta[n] = '\0';
            risposta[strcspn(risposta, "\n")] = '\0';
            printf("  [cliente] il servitore mi ha risposto: %s\n", risposta);
        }

        fflush(stdout);
        close(cliente);
        _exit(0);
    }

    /* ---------- SERVITORE: la conversazione ---------- */
    int conversazione = accept(servitore, NULL, NULL);   /* si blocca qui */
    if (conversazione < 0) {
        perror("accept");
        return 1;
    }

    char messaggio[128];
    int n = (int)read(conversazione, messaggio, sizeof messaggio - 1);
    if (n > 0) {
        messaggio[n] = '\0';
        messaggio[strcspn(messaggio, "\n")] = '\0';
        printf("[servitore] ho ricevuto: %s\n", messaggio);
        fflush(stdout);
    }

    const char *risposta = "ricevuto forte e chiaro\n";
    if (write(conversazione, risposta, strlen(risposta)) < 0)
        perror("[servitore] write");

    close(conversazione);
    close(servitore);
    wait(NULL);

    printf("[servitore] conversazione chiusa.\n");
    return 0;
}

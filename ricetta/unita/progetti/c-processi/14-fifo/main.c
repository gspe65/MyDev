/* 14 - FIFO: una pipe con un nome sul disco
 *
 * SOLO con gcc.
 *
 * La pipe del progetto 13 funziona solo fra processi imparentati: il figlio
 * eredita i descrittori dal padre. Se due programmi diversi, lanciati da due
 * terminali diversi, devono parlarsi, serve un punto d'incontro con un nome:
 * la FIFO, creata con mkfifo.
 *
 * Una FIFO SEMBRA un file (la vedi con ls, ha un nome e dei permessi), ma non
 * contiene niente: e' un tubo. Quello che scrivi da una parte esce dall'altra
 * e poi sparisce.
 *
 * Attenzione: aprire una FIFO in lettura si BLOCCA finche' qualcuno non la
 * apre in scrittura, e viceversa. E' voluto: serve a sincronizzare i due lati.
 */

#define _POSIX_C_SOURCE 200809L

#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <fcntl.h>
#include <sys/stat.h>
#include <sys/wait.h>

#define TUBO "mio_tubo"

int main(void)
{
    unlink(TUBO);                     /* se e' rimasto da una prova prima */

    if (mkfifo(TUBO, 0600) < 0) {     /* 0600 = solo io posso leggerlo */
        perror("mkfifo");
        return 1;
    }
    printf("ho creato la FIFO '%s'. Guardala con:  ls -l %s\n", TUBO, TUBO);
    printf("(la 'p' come primo carattere dei permessi vuol dire pipe)\n\n");
    fflush(stdout);

    pid_t f = fork();
    if (f < 0) {
        perror("fork");
        unlink(TUBO);
        return 1;
    }

    if (f == 0) {
        /* ---------- FIGLIO: scrive ---------- */
        int fd = open(TUBO, O_WRONLY);    /* si blocca finche' il padre
                                             non apre in lettura */
        if (fd < 0) {
            perror("  [figlio] open in scrittura");
            _exit(1);
        }

        const char *messaggi[3] = { "primo", "secondo", "terzo" };

        for (int i = 0; i < 3; i++) {
            char riga[64];
            int n = snprintf(riga, sizeof riga, "%s messaggio\n", messaggi[i]);

            if (write(fd, riga, (size_t)n) < 0) {
                perror("  [figlio] write");
                break;
            }
            sleep(1);
        }

        close(fd);
        _exit(0);
    }

    /* ---------- PADRE: legge ---------- */
    int fd = open(TUBO, O_RDONLY);        /* si sblocca quando il figlio
                                             apre in scrittura */
    if (fd < 0) {
        perror("[padre] open in lettura");
        unlink(TUBO);
        return 1;
    }

    char buffer[128];
    int letti;

    while ((letti = (int)read(fd, buffer, sizeof buffer - 1)) > 0) {
        buffer[letti] = '\0';
        buffer[strcspn(buffer, "\n")] = '\0';
        printf("[padre] ricevuto: %s\n", buffer);
        fflush(stdout);
    }
    /* read torna 0 quando l'ULTIMO scrittore chiude: e' la fine del tubo */

    close(fd);
    wait(NULL);
    unlink(TUBO);            /* la FIFO va cancellata: e' un file vero */

    printf("[padre] il figlio ha chiuso, tubo rimosso.\n");
    return 0;
}

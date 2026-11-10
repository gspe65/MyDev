/* 20 - Aspettare, ma non per sempre: poll() con scadenza
 *
 * SOLO con gcc.
 *
 * L'altra faccia dell'asincronia: non "faccio partire e continuo" (progetto
 * 19), ma "aspetto che arrivi qualcosa, pero' non oltre N millisecondi".
 *
 * Senza timeout un programma che legge da un tubo vuoto resta li' per sempre.
 * poll() risolve: gli dai un elenco di canali e quanto sei disposto ad
 * aspettare, e ti dice cosa e' pronto.
 *
 *   valore > 0   qualcosa e' pronto
 *   valore = 0   e' scaduto il tempo, nessuno ha parlato
 *   valore < 0   errore
 *
 * Rispetto ad alarm() (progetto 16) poll e' piu' preciso e piu' mirato: la
 * scadenza e' in millisecondi e riguarda un canale specifico, non l'intero
 * programma.
 */

#define _POSIX_C_SOURCE 200809L

#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <poll.h>
#include <sys/wait.h>

#define MESSAGGI 3

int main(void)
{
    int fd[2];

    if (pipe(fd) < 0) {
        perror("pipe");
        return 1;
    }

    pid_t figlio = fork();
    if (figlio < 0) {
        perror("fork");
        return 1;
    }

    if (figlio == 0) {
        /* ---------- FIGLIO: parla ogni due secondi ---------- */
        close(fd[0]);

        for (int i = 1; i <= MESSAGGI; i++) {
            char riga[64];
            int n = snprintf(riga, sizeof riga, "messaggio numero %d\n", i);

            sleep(2);
            if (write(fd[1], riga, (size_t)n) < 0) {
                perror("write");
                break;
            }
        }

        close(fd[1]);
        _exit(0);
    }

    /* ---------- PADRE: aspetta al massimo un secondo per volta ---------- */
    close(fd[1]);

    struct pollfd canale;
    canale.fd = fd[0];
    canale.events = POLLIN;      /* mi interessa: "c'e' qualcosa da leggere" */

    int ricevuti = 0;
    int attese = 0;

    while (ricevuti < MESSAGGI) {
        int pronto = poll(&canale, 1, 1000);   /* 1000 ms = 1 secondo */

        if (pronto < 0) {
            perror("poll");
            break;
        }

        if (pronto == 0) {
            attese++;
            printf("  ...un secondo senza notizie, intanto faccio altro (%d)\n",
                   attese);
            fflush(stdout);
            continue;
        }

        char buffer[128];
        int letti = (int)read(fd[0], buffer, sizeof buffer - 1);

        if (letti <= 0)
            break;               /* il figlio ha chiuso il tubo */

        buffer[letti] = '\0';
        buffer[strcspn(buffer, "\n")] = '\0';
        ricevuti++;
        printf("-> ricevuto: %s\n", buffer);
        fflush(stdout);
    }

    close(fd[0]);
    wait(NULL);

    printf("\nmessaggi ricevuti: %d, attese a vuoto: %d\n", ricevuti, attese);
    return 0;
}

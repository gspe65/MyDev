/* 10 - fork(): un processo diventa due
 *
 * SOLO con gcc.
 * Con clang questo file non compila nemmeno: <sys/wait.h> per i programmi
 * Windows non esiste.
 *
 * fork() e' l'unica funzione che si chiama UNA volta e da cui si torna DUE
 * volte: una nel padre, una nel figlio. Da quel momento sono due programmi
 * separati che eseguono lo stesso codice.
 *
 * Il valore restituito e' l'unico modo per capire dove ci si trova:
 *
 *     > 0   sei il PADRE, e il numero e' il PID del figlio
 *     = 0   sei il FIGLIO
 *     < 0   la fork e' fallita
 */

#define _POSIX_C_SOURCE 200809L

#include <stdio.h>
#include <unistd.h>       /* fork, getpid, sleep */
#include <sys/wait.h>     /* wait, WIFEXITED, WEXITSTATUS */

int main(void)
{
    printf("prima della fork: sono il processo %d\n", (int)getpid());

    fflush(stdout);   /* IMPORTANTE: svuota il buffer PRIMA di duplicare il
                         processo. Senza, il figlio erediterebbe il buffer
                         pieno e la riga verrebbe stampata due volte. */

    pid_t figlio = fork();

    if (figlio < 0) {
        perror("fork");
        return 1;
    }

    if (figlio == 0) {
        /* ---------- da qui in giu' siamo nel FIGLIO ---------- */
        printf("  [figlio] sono %d, mio padre e' %d\n",
               (int)getpid(), (int)getppid());
        sleep(1);
        printf("  [figlio] esco con il valore 7\n");

        fflush(stdout);   /* SERVE: _exit() NON svuota il buffer di stdio.
                             Senza, mandando l'output in un file queste due
                             righe non compaiono affatto. Sullo schermo si
                             vedono lo stesso, perche' li' il buffer si
                             svuota a ogni a-capo: e' la trappola classica. */

        _exit(7);     /* _exit e non exit: il figlio non deve rifare le
                         pulizie di fine programma gia' previste dal padre */
    }

    /* ---------- da qui in giu' siamo nel PADRE ---------- */
    printf("[padre] ho creato il figlio %d, ora lo aspetto\n", (int)figlio);

    int stato = 0;
    pid_t finito = wait(&stato);    /* si blocca finche' un figlio non finisce */

    if (finito < 0) {
        perror("wait");
        return 1;
    }

    if (WIFEXITED(stato))
        printf("[padre] il figlio %d e' uscito con %d\n",
               (int)finito, WEXITSTATUS(stato));
    else
        printf("[padre] il figlio %d e' finito male\n", (int)finito);

    return 0;
}

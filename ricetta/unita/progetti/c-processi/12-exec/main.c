/* 12 - exec(): il processo diventa un ALTRO programma
 *
 * SOLO con gcc.
 *
 * fork() duplica. exec() sostituisce: il processo resta lo stesso (stesso
 * PID) ma il codice, i dati e lo stack vengono buttati e rimpiazzati con
 * quelli del programma nuovo.
 *
 * Conseguenza importante: se exec riesce, la riga dopo NON viene mai
 * eseguita. Non c'e' ritorno. Per questo si controlla solo il fallimento.
 *
 * fork + exec insieme sono il modo in cui la shell lancia i comandi: si
 * duplica, e la copia diventa il programma che hai scritto.
 */

#define _POSIX_C_SOURCE 200809L

#include <stdio.h>
#include <unistd.h>
#include <sys/wait.h>

int main(void)
{
    printf("[padre] sono %d, ora creo un figlio\n", (int)getpid());
    fflush(stdout);

    pid_t f = fork();
    if (f < 0) {
        perror("fork");
        return 1;
    }

    if (f == 0) {
        printf("  [figlio] sono %d, sto per diventare il comando 'date'\n",
               (int)getpid());
        fflush(stdout);

        /* execlp: cerca il programma nel PATH.
           Primo argomento: il programma da eseguire.
           Secondo: quello che il programma vedra' come argv[0].
           Poi gli argomenti veri, e in fondo un NULL che dice "ho finito". */
        execlp("date", "date", "+oggi e' il %d/%m/%Y", (char *)NULL);

        /* Se siamo qui, execlp NON e' riuscita */
        perror("  [figlio] execlp");
        fflush(stdout);
        _exit(127);          /* 127 e' il valore convenzionale per
                                "comando non trovato" */
    }

    int stato = 0;
    wait(&stato);

    printf("[padre] il figlio %d e' uscito con %d\n",
           (int)f, WEXITSTATUS(stato));
    printf("[padre] nota: il figlio aveva lo stesso PID prima e dopo exec\n");

    return 0;
}

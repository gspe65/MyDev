/* 13 - pipe(): due processi che si parlano
 *
 * SOLO con gcc.
 *
 * Una pipe e' un tubo con due estremita':
 *     fd[0]  si LEGGE
 *     fd[1]  si SCRIVE
 *
 * Dopo la fork le hanno tutti e due i processi, e ognuno deve CHIUDERE quella
 * che non usa. Se il padre non chiude fd[1], la sua read non finisce mai:
 * resta in attesa di un dato che potrebbe arrivare da se stesso.
 *
 * Il figlio qui non scrive a mano: dirotta il proprio stdout dentro la pipe
 * (dup2) e poi diventa "ls -l" (execlp). E' esattamente quello che fa la
 * shell quando scrivi:   ls -l | qualcosa
 */

#define _POSIX_C_SOURCE 200809L

#include <stdio.h>
#include <unistd.h>
#include <sys/wait.h>

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
        /* ---------- FIGLIO: scrive nella pipe ---------- */
        close(fd[0]);                   /* non legge */
        dup2(fd[1], STDOUT_FILENO);     /* il suo stdout diventa la pipe */
        close(fd[1]);                   /* la copia originale non serve piu' */

        execlp("ls", "ls", "-l", (char *)NULL);

        /* si arriva qui solo se execlp NON e' riuscita */
        perror("execlp");
        _exit(127);
    }

    /* ---------- PADRE: legge dalla pipe ---------- */
    close(fd[1]);        /* senza questa close la read non finirebbe mai */

    char buffer[256];
    int letti;
    int righe = 0;

    printf("[padre] ecco cosa mi manda il figlio:\n");

    while ((letti = (int)read(fd[0], buffer, sizeof buffer - 1)) > 0) {
        buffer[letti] = '\0';
        fputs(buffer, stdout);

        for (int i = 0; i < letti; i++)
            if (buffer[i] == '\n')
                righe++;
    }

    close(fd[0]);
    wait(NULL);

    printf("[padre] righe ricevute: %d\n", righe);
    return 0;
}

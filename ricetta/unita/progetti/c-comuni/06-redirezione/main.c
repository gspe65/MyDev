/* 06 - Redirezione: come fa la shell a eseguire  programma > file
 *
 * Funziona con ENTRAMBI i compilatori, ed e' una sorpresa utile: non tutto
 * cio' che sembra "roba da Unix" manca su Windows. I descrittori di file
 * (0, 1, 2), open, dup e dup2 ci sono anche li'. Cio' che manca davvero
 * sono i PROCESSI: fork, exec, pipe, segnali.
 *
 * Ogni processo nasce con tre canali gia' aperti:
 *     0  stdin    l'ingresso
 *     1  stdout   l'uscita normale
 *     2  stderr   i messaggi d'errore
 *
 * "Redirigere" vuol dire cambiare dove punta uno di questi numeri, e lo si fa
 * con dup2(nuovo, vecchio): da quel momento tutto cio' che va sul canale
 * "vecchio" finisce dove punta "nuovo".
 *
 * printf non se ne accorge nemmeno: continua a scrivere sul canale 1.
 * E' esattamente cio' che fa la shell prima di lanciare un comando.
 */

#define _POSIX_C_SOURCE 200809L

#include <stdio.h>
#include <unistd.h>
#include <fcntl.h>

#define NOMEFILE "uscita_dirottata.txt"

int main(void)
{
    printf("questa riga va sullo schermo\n");
    fflush(stdout);

    /* 1) mi metto da parte una copia del canale 1, per poterlo ripristinare */
    int copia_stdout = dup(STDOUT_FILENO);
    if (copia_stdout < 0) {
        perror("dup");
        return 1;
    }

    /* 2) apro il file: creare se non c'e', azzerare se c'e' */
    int fd = open(NOMEFILE, O_WRONLY | O_CREAT | O_TRUNC, 0644);
    if (fd < 0) {
        perror("open");
        return 1;
    }

    /* 3) il canale 1 adesso punta al file */
    if (dup2(fd, STDOUT_FILENO) < 0) {
        perror("dup2");
        return 1;
    }
    close(fd);              /* il descrittore originale non serve piu' */

    /* 4) queste printf finiscono nel file, senza saperlo */
    printf("questa riga finisce nel file\n");
    printf("e anche questa\n");
    fflush(stdout);         /* svuota il buffer PRIMA di rimettere a posto */

    /* 5) rimetto il canale 1 dov'era */
    if (dup2(copia_stdout, STDOUT_FILENO) < 0) {
        perror("dup2 di ritorno");
        return 1;
    }
    close(copia_stdout);

    printf("e siamo tornati sullo schermo\n");
    printf("guarda il file con:  cat %s\n", NOMEFILE);

    return 0;
}

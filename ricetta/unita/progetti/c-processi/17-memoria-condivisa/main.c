/* 17 - Memoria condivisa fra padre e figlio
 *
 * SOLO con gcc: serve <sys/mman.h>, che per i programmi Windows di clang
 * non esiste.
 *
 * Dopo una fork, padre e figlio hanno memoria SEPARATA: se il figlio cambia
 * una variabile, il padre non se ne accorge. Questa e' la differenza piu'
 * importante fra processi e thread (nel progetto 07 i thread condividevano
 * tutto, e per questo serviva il mutex).
 *
 * Il programma lo dimostra due volte:
 *   - con una variabile normale  -> il padre NON vede il cambiamento
 *   - con una pagina da mmap     -> il padre lo vede, e' la stessa memoria
 *
 * Qui non serve nessun semaforo: il padre legge DOPO che il figlio e' finito,
 * e ad aspettarlo ci pensa wait(). Quando invece i due lavorano INSIEME sulla
 * stessa memoria il semaforo serve: e' il progetto 18.
 */

#define _POSIX_C_SOURCE 200809L

#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <sys/mman.h>     /* mmap, munmap */
#include <sys/wait.h>

struct condiviso {
    int  numero;
    char messaggio[64];
};

int main(void)
{
    int normale = 100;    /* memoria NON condivisa, serve per il confronto */

    /* Una pagina di memoria che sopravvive alla fork ed e' la stessa per
       tutti e due i processi. MAP_SHARED e' la parola chiave: con
       MAP_PRIVATE ogni processo ne avrebbe una copia sua. */
    struct condiviso *c = mmap(NULL, sizeof *c,
                               PROT_READ | PROT_WRITE,
                               MAP_SHARED | MAP_ANONYMOUS, -1, 0);
    if (c == MAP_FAILED) {
        perror("mmap");
        return 1;
    }

    c->numero = 100;
    strcpy(c->messaggio, "(ancora niente)");

    pid_t figlio = fork();
    if (figlio < 0) {
        perror("fork");
        return 1;
    }

    if (figlio == 0) {
        /* ---------- FIGLIO: cambia tutte e due le variabili ---------- */
        normale   = 999;
        c->numero = 999;
        strcpy(c->messaggio, "scritto dal figlio");

        printf("  [figlio] normale = %d   condiviso = %d\n",
               normale, c->numero);

        fflush(stdout);   /* _exit() non svuota il buffer: senza questa riga,
                             mandando l'output in un file il messaggio del
                             figlio si perde */
        _exit(0);
    }

    /* ---------- PADRE: aspetta e poi guarda ---------- */
    wait(NULL);

    printf("[padre]  normale   = %d  <- il figlio l'aveva messo a 999!\n",
           normale);
    printf("[padre]  condiviso = %d  <- questo si': e' la STESSA memoria\n",
           c->numero);
    printf("[padre]  messaggio = %s\n", c->messaggio);

    munmap(c, sizeof *c);
    return 0;
}

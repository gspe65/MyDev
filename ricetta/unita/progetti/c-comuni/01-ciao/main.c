/* 01 - Ciao mondo
 *
 * Il programma piu' piccolo che fa qualcosa.
 * Serve a controllare che compilatore, Makefile e terminale funzionino.
 *
 * Compila con ENTRAMBI i compilatori e stampa la stessa identica cosa:
 * qui i due mondi non si distinguono.
 */

#include <stdio.h>     /* printf sta qui */

int main(void)
{
    printf("Ciao, mondo!\n");   /* \n vuol dire "vai a capo" */
    return 0;                   /* 0 = tutto bene */
}

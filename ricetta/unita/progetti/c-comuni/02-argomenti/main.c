/* 02 - Argomenti della riga di comando e valore di uscita
 *
 * Due cose che servono subito:
 *
 *   argc / argv   quello che l'utente ha scritto DOPO il nome del programma
 *   return        il "valore di uscita": la shell lo mette in $?
 *
 * Attenzione: argv[0] e' il nome del programma, quindi gli argomenti veri
 * partono da argv[1] e sono argc-1.
 */

#include <stdio.h>

int main(int argc, char *argv[])
{
    printf("mi chiamo          : %s\n", argv[0]);
    printf("argomenti ricevuti : %d\n", argc - 1);

    for (int i = 1; i < argc; i++)
        printf("  argv[%d] = %s\n", i, argv[i]);

    if (argc < 2) {
        /* i messaggi d'errore vanno su stderr, non su stdout:
           cosi' restano separati dal risultato del programma */
        fprintf(stderr, "uso: %s <parola> [altre parole...]\n", argv[0]);
        return 1;              /* 1 = qualcosa non va */
    }

    return 0;
}

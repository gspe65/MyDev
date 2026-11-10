/* 03 - Scrivere e rileggere un file di testo
 *
 * Solo libreria standard: nessuna differenza fra i due compilatori.
 *
 * Nota sui percorsi: il file viene creato nella cartella da cui LANCI il
 * programma, non in quella dove sta il sorgente.
 */

#include <stdio.h>
#include <string.h>

#define NOMEFILE "elenco.txt"

/* scrive tre righe nel file. Torna 0 se ok, -1 se qualcosa e' andato storto */
static int scrivi(void)
{
    FILE *f = fopen(NOMEFILE, "w");   /* "w" = scrivi, azzerando il file */
    if (f == NULL) {
        perror("non riesco a creare " NOMEFILE);
        return -1;
    }

    fprintf(f, "mela\n");
    fprintf(f, "pera\n");
    fprintf(f, "arancia\n");

    fclose(f);                        /* chiudere sempre: senza, i dati
                                         potrebbero restare nel buffer */
    return 0;
}

/* rilegge il file riga per riga. Torna quante righe ha letto, -1 se errore */
static int leggi_e_conta(void)
{
    FILE *f = fopen(NOMEFILE, "r");   /* "r" = leggi */
    if (f == NULL) {
        perror("non riesco ad aprire " NOMEFILE);
        return -1;
    }

    char riga[128];
    int n = 0;

    while (fgets(riga, sizeof riga, f) != NULL) {
        /* fgets tiene l'a-capo finale: lo tolgo per stampare pulito */
        riga[strcspn(riga, "\n")] = '\0';
        n++;
        printf("  riga %d: %s\n", n, riga);
    }

    fclose(f);
    return n;
}

int main(void)
{
    if (scrivi() < 0)
        return 1;

    printf("ho scritto %s, ora lo rileggo:\n", NOMEFILE);

    int n = leggi_e_conta();
    if (n < 0)
        return 1;

    printf("righe totali: %d\n", n);
    return 0;
}

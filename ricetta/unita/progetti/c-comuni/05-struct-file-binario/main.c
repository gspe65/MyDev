/* 05 - struct e file binario
 *
 * Funziona con ENTRAMBI i compilatori.
 *
 * Una struct tiene insieme dati di tipo diverso. Con fwrite/fread si salva e
 * si rilegge cosi' com'e' in memoria: nessuna conversione in testo, quindi il
 * file NON si legge con cat.
 *
 * Il file binario e' piu' veloce e compatto del testo, ma e' legato a come
 * quella macchina rappresenta i numeri: un file scritto qui potrebbe non
 * rileggersi su un computer diverso. E' il compromesso da conoscere.
 */

#include <stdio.h>
#include <string.h>

#define NOMEFILE "studenti.dat"
#define QUANTI   3

struct studente {
    char nome[32];
    int  voto;
};

int main(void)
{
    struct studente classe[QUANTI];

    strcpy(classe[0].nome, "Anna");   classe[0].voto = 8;
    strcpy(classe[1].nome, "Bruno");  classe[1].voto = 6;
    strcpy(classe[2].nome, "Carla");  classe[2].voto = 9;

    printf("una struct occupa %zu byte\n", sizeof(struct studente));

    /* --- scrittura: "wb" = write binary --- */
    FILE *f = fopen(NOMEFILE, "wb");
    if (f == NULL) {
        perror("apertura in scrittura");
        return 1;
    }

    size_t scritti = fwrite(classe, sizeof(struct studente), QUANTI, f);
    fclose(f);

    if (scritti != QUANTI) {
        fprintf(stderr, "ne ho scritti solo %zu su %d\n", scritti, QUANTI);
        return 1;
    }
    printf("scritti %zu record in %s\n", scritti, NOMEFILE);

    /* --- rilettura: "rb" = read binary --- */
    struct studente riletti[QUANTI];

    f = fopen(NOMEFILE, "rb");
    if (f == NULL) {
        perror("apertura in lettura");
        return 1;
    }

    size_t letti = fread(riletti, sizeof(struct studente), QUANTI, f);
    fclose(f);

    printf("riletti %zu record:\n", letti);
    for (size_t i = 0; i < letti; i++)
        printf("  %-10s voto %d\n", riletti[i].nome, riletti[i].voto);

    return 0;
}

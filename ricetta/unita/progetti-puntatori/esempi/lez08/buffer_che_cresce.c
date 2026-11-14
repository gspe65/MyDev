/* Il buffer raddoppia quando non basta piu'. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct {
    char *testo;
    size_t capacita;
} Buffer;

void aggiungi(Buffer *b, char *pezzo)
{
    size_t servono = strlen(b->testo) + strlen(pezzo) + 1;
    while (b->capacita < servono) {
        b->capacita = b->capacita * 2;
    }
    char *nuovo = realloc(b->testo, b->capacita);
    if (nuovo == NULL) {
        exit(1);
    }
    b->testo = nuovo;
    strcpy(b->testo + strlen(b->testo), pezzo);
}

int main(void)
{
    Buffer b;
    b.capacita = 2;
    b.testo = malloc(b.capacita);
    if (b.testo == NULL) {
        return 1;
    }
    b.testo[0] = '\0';

    aggiungi(&b, "ciao");
    aggiungi(&b, " mondo");
    printf("%s\n", b.testo);
    free(b.testo);
    return 0;
}

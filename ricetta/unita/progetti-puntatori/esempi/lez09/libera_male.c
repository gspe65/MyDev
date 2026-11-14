/* Dopo la free il nodo non si puo' piu' leggere, nemmeno il suo successivo. */
#include <stdlib.h>

typedef struct Nodo {
    struct Nodo *successivo;
} Nodo;

void libera_tutto(Nodo *testa)
{
    while (testa != NULL) {
        free(testa);
        testa = testa->successivo;
    }
}

int main(void)
{
    Nodo *secondo = malloc(sizeof(Nodo));
    Nodo *primo = malloc(sizeof(Nodo));
    if (primo == NULL || secondo == NULL) {
        return 1;
    }
    secondo->successivo = NULL;
    primo->successivo = secondo;
    libera_tutto(primo);
    return 0;
}

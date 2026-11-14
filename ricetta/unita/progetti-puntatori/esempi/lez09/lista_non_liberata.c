/* Liberare solo la testa lascia gli altri nodi: nessuno li raggiunge piu'. */
#include <stdlib.h>

typedef struct Nodo {
    struct Nodo *successivo;
} Nodo;

int main(void)
{
    Nodo *secondo = malloc(sizeof(Nodo));
    Nodo *primo = malloc(sizeof(Nodo));
    if (primo == NULL || secondo == NULL) {
        return 1;
    }
    secondo->successivo = NULL;
    primo->successivo = secondo;
    secondo = NULL;
    free(primo);
    return secondo != NULL;
}

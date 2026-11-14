/* Se prima si cambia la testa, il nodo nuovo punta a se stesso. */
#include <stdio.h>
#include <stdlib.h>

typedef struct Nodo {
    int valore;
    struct Nodo *successivo;
} Nodo;

int main(void)
{
    Nodo *testa = NULL;
    Nodo *nuovo = malloc(sizeof(Nodo));
    if (nuovo == NULL) {
        return 1;
    }
    nuovo->valore = 7;
    testa = nuovo;
    nuovo->successivo = testa;

    int giri = 0;
    for (Nodo *nodo = testa; nodo != NULL && giri < 3; nodo = nodo->successivo) {
        printf("%d\n", nodo->valore);
        giri++;
    }
    free(nuovo);
    return 0;
}

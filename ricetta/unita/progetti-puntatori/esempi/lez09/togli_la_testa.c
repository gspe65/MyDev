/* Per togliere il primo nodo non c'e' un precedente: serve un caso a parte. */
#include <stdio.h>
#include <stdlib.h>

typedef struct Nodo {
    int valore;
    struct Nodo *successivo;
} Nodo;

Nodo *togli(Nodo *testa, int valore)
{
    Nodo *precedente = NULL;
    Nodo *nodo = testa;
    while (nodo != NULL && nodo->valore != valore) {
        precedente = nodo;
        nodo = nodo->successivo;
    }
    if (nodo != NULL) {
        precedente->successivo = nodo->successivo;
        free(nodo);
    }
    return testa;
}

int main(void)
{
    Nodo *testa = malloc(sizeof(Nodo));
    if (testa == NULL) {
        return 1;
    }
    testa->valore = 1;
    testa->successivo = NULL;
    testa = togli(testa, 1);
    printf("%p\n", (void *) testa);
    return 0;
}

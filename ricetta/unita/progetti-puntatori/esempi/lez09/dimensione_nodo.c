/* Un nodo occupa le celle del valore, del riempimento e del puntatore. */
#include <stdio.h>
#include <stddef.h>

typedef struct Nodo {
    int valore;
    struct Nodo *successivo;
} Nodo;

int main(void)
{
    printf("Nodo: %zu celle, successivo alla %zu\n",
           sizeof(Nodo), offsetof(Nodo, successivo));
    return 0;
}

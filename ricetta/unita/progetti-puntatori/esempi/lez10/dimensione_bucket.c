/* Quante celle occupano un nodo con la sua chiave e l'array dei bucket. */
#include <stdio.h>

typedef struct Nodo {
    char *chiave;
    struct Nodo *successivo;
} Nodo;

int main(void)
{
    Nodo *bucket[4];
    printf("Nodo: %zu celle\n", sizeof(Nodo));
    printf("bucket: %zu celle\n", sizeof(bucket));
    return 0;
}

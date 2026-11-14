/* Un blocco nell'heap sopravvive alla funzione che lo ha chiesto. */
#include <stdio.h>
#include <stdlib.h>

int *nuovo_intero(int valore)
{
    int *p = malloc(sizeof(int));
    if (p == NULL) {
        exit(1);
    }
    *p = valore;
    return p;
}

int main(void)
{
    int *p = nuovo_intero(42);
    printf("%d\n", *p);
    free(p);
    return 0;
}

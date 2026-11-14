/* Due puntatori, un solo blocco: uno lo restituisce, l'altro lo usa. */
#include <stdio.h>
#include <stdlib.h>

int main(void)
{
    int *a = malloc(sizeof(int));
    if (a == NULL) {
        return 1;
    }
    *a = 5;
    int *b = a;
    free(b);
    printf("%d\n", *a);
    return 0;
}

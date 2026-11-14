/* realloc puo' allargare il blocco dov'e', oppure spostarlo. */
#include <stdio.h>
#include <stdlib.h>

int main(void)
{
    char *a = malloc(8);
    char *muro = malloc(8);
    if (a == NULL || muro == NULL) {
        return 1;
    }

    printf("prima: %p\n", (void *) a);
    char *nuovo = realloc(a, 4000);
    if (nuovo == NULL) {
        return 1;
    }
    printf("dopo:  %p\n", (void *) nuovo);

    free(nuovo);
    free(muro);
    return 0;
}

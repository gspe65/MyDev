/* Dopo free quella memoria non e' piu' nostra. */
#include <stdio.h>
#include <stdlib.h>

int main(void)
{
    int *p = malloc(sizeof(int));
    if (p == NULL) {
        return 1;
    }
    *p = 5;
    free(p);
    printf("%d\n", *p);
    return 0;
}

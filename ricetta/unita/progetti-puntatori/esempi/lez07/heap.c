/* malloc chiede un blocco, free lo restituisce. */
#include <stdio.h>
#include <stdlib.h>

int main(void)
{
    int *p = malloc(sizeof(int));
    if (p == NULL) {
        return 1;
    }
    *p = 5;
    printf("%d\n", *p);
    free(p);
    return 0;
}

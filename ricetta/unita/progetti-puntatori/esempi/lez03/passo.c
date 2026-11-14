/* Gli elementi stanno uno dopo l'altro: p + 1 e' l'elemento dopo, quattro celle piu' avanti. */
#include <stdio.h>

int main(void)
{
    int v[3] = {10, 20, 30};
    int *p = v;
    printf("%p\n", (void *) p);
    printf("%p\n", (void *) (p + 1));
    printf("%p\n", (void *) &v[1]);
    return 0;
}

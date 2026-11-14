/* p + 1 e' l'indirizzo dell'elemento dopo: p[2] e *(p + 2) sono la stessa cosa. */
#include <stdio.h>

int main(void)
{
    int v[3] = {10, 20, 30};
    int *p = v;
    printf("%d %d %d\n", *p, *(p + 1), p[2]);
    return 0;
}

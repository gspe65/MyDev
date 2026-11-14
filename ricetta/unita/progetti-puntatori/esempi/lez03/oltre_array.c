/* L'indice 4 e' oltre l'ultimo elemento: senza ASan non se ne accorge nessuno. */
#include <stdio.h>

int main(void)
{
    int v[4] = {1, 2, 3, 4};
    int i = 4;
    printf("%d\n", v[i]);
    return 0;
}

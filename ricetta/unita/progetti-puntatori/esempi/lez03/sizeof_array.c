/* Dove l'array e' dichiarato, sizeof ne conta tutte le celle. */
#include <stdio.h>

int main(void)
{
    int v[5] = {1, 2, 3, 4, 5};
    printf("%zu\n", sizeof(v));
    return 0;
}

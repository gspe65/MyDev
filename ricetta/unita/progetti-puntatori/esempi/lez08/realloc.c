/* Dopo realloc vale solo l'indirizzo restituito. */
#include <stdio.h>
#include <stdlib.h>

int main(void)
{
    int *v = malloc(2 * sizeof(int));
    if (v == NULL) {
        return 1;
    }
    v[0] = 1;
    v[1] = 2;

    int *nuovo = realloc(v, 4 * sizeof(int));
    if (nuovo == NULL) {
        free(v);
        return 1;
    }
    v = nuovo;
    v[2] = 3;
    v[3] = 4;

    printf("%d %d %d %d\n", v[0], v[1], v[2], v[3]);
    free(v);
    return 0;
}

/* realloc puo' spostare il blocco: il vecchio puntatore non vale piu'. */
#include <stdio.h>
#include <stdlib.h>

int main(void)
{
    char *vecchio = malloc(8);
    if (vecchio == NULL) {
        return 1;
    }
    vecchio[0] = 'a';

    char *nuovo = realloc(vecchio, 100000);
    if (nuovo == NULL) {
        return 1;
    }
    printf("%c\n", vecchio[0]);
    free(nuovo);
    return 0;
}

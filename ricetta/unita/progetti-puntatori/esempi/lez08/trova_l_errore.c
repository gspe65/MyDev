/* Dov'e' l'errore? Si compila, e senza sanitizer puo' sembrare giusto. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

char *raddoppia(char *testo)
{
    char *nuovo = malloc(2 * strlen(testo) + 1);
    if (nuovo == NULL) {
        exit(1);
    }
    strcpy(nuovo, testo);
    strcpy(nuovo + strlen(testo), testo);
    free(testo);
    return nuovo;
}

int main(void)
{
    char *t = malloc(5);
    if (t == NULL) {
        return 1;
    }
    strcpy(t, "ciao");

    char *doppio = raddoppia(t);
    printf("%zu %s\n", strlen(t), doppio);
    free(doppio);
    return 0;
}

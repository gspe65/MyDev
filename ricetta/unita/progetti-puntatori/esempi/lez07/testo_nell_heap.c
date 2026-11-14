/* Per copiare un testo serve un carattere in piu' per il terminatore. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

char *copia(char *testo)
{
    char *nuovo = malloc(strlen(testo) + 1);
    if (nuovo != NULL) {
        strcpy(nuovo, testo);
    }
    return nuovo;
}

int main(void)
{
    char *c = copia("ciao");
    if (c == NULL) {
        return 1;
    }
    printf("%s\n", c);
    free(c);
    return 0;
}

/* Un carattere in meno: il terminatore finisce fuori dal blocco. */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main(void)
{
    char *testo = "ciao";
    char *nuovo = malloc(strlen(testo));
    if (nuovo == NULL) {
        return 1;
    }
    strcpy(nuovo, testo);
    printf("%s\n", nuovo);
    free(nuovo);
    return 0;
}

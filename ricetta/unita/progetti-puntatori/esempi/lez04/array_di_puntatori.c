/* Ogni elemento dell'array e' l'indirizzo di una stringa. */
#include <stdio.h>

int main(void)
{
    char *nomi[2] = {"anna", "bruno"};
    for (int i = 0; i < 2; i++) {
        printf("%s\n", nomi[i]);
    }
    return 0;
}

/* In un array a due dimensioni il parametro dichiara la lunghezza delle righe. */
#include <stdio.h>

#define LUNGHEZZA 8

void stampa(char nomi[][LUNGHEZZA], int quanti)
{
    for (int i = 0; i < quanti; i++) {
        printf("%s\n", nomi[i]);
    }
}

int main(void)
{
    char nomi[3][LUNGHEZZA] = {"anna", "bruno", "carla"};
    stampa(nomi, 3);
    return 0;
}

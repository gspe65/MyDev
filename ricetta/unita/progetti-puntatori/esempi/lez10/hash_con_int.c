/* Con int il numero puo' diventare negativo: e l'indice anche. */
#include <stdio.h>

int hash(char *testo)
{
    int risultato = 0;
    while (*testo != '\0') {
        risultato = risultato * 31 + (unsigned char) *testo;
        testo++;
    }
    return risultato;
}

int main(void)
{
    int conteggi[4] = {0, 0, 0, 0};
    int i = hash("colore") % 4;
    printf("%d\n", i);
    conteggi[i]++;
    printf("%d\n", conteggi[0]);
    return 0;
}

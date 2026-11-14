/* Lo stesso testo da' sempre lo stesso numero; l'ordine delle lettere conta. */
#include <stdio.h>

unsigned int hash(char *testo)
{
    unsigned int risultato = 0;
    while (*testo != '\0') {
        risultato = risultato * 31 + (unsigned char) *testo;
        testo++;
    }
    return risultato;
}

int main(void)
{
    printf("%u\n", hash("ab"));
    printf("%u\n", hash("ba"));
    return 0;
}

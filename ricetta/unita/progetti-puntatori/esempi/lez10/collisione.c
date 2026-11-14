/* Con 4 bucket due chiavi diverse possono finire nello stesso. */
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
    printf("%u\n", hash("ad") % 4);
    printf("%u\n", hash("ba") % 4);
    return 0;
}

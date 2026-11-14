/* Raddoppiando i bucket, una chiave puo' cambiare bucket. */
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
    char *chiavi[5] = {"anna", "bruno", "carla", "dario", "elena"};
    for (int i = 0; i < 5; i++) {
        printf("%s: da %u a %u\n", chiavi[i], hash(chiavi[i]) % 4, hash(chiavi[i]) % 8);
    }
    return 0;
}

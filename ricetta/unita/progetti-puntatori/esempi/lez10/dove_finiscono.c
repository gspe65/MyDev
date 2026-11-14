/* In quale bucket finisce ogni chiave, con 4 bucket. */
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
        printf("%s: %u\n", chiavi[i], hash(chiavi[i]) % 4);
    }
    return 0;
}

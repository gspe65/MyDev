/* Il primo indirizzo viene sovrascritto: quel blocco e' perso. */
#include <stdlib.h>

int main(void)
{
    char *p = malloc(100);
    p[0] = 1;
    p = malloc(200);
    p[0] = 2;
    free(p);
    p = NULL;
    return p != NULL;
}

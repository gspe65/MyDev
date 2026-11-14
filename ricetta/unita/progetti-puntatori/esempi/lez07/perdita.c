/* Il blocco non si restituisce piu': nessuno conosce il suo indirizzo. */
#include <stdlib.h>

int main(void)
{
    char *p = malloc(100);
    p[0] = 1;
    p = NULL;
    return p != NULL;
}

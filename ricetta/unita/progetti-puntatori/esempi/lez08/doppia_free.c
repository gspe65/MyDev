/* Un blocco si restituisce una volta sola. */
#include <stdlib.h>

int main(void)
{
    int *p = malloc(sizeof(int));
    free(p);
    free(p);
    return 0;
}

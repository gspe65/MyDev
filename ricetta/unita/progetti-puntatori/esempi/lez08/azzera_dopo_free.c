/* Dopo la free il puntatore si azzera: free(NULL) non fa niente. */
#include <stdio.h>
#include <stdlib.h>

int main(void)
{
    int *p = malloc(sizeof(int));
    if (p == NULL) {
        return 1;
    }
    free(p);
    p = NULL;
    free(p);
    printf("nessun errore\n");
    return 0;
}

/* I due conteggi stanno in una struct: alla fine devono coincidere. */
#include <stdio.h>
#include <stdlib.h>

typedef struct {
    int allocazioni;
    int liberazioni;
} Contatore;

void *riserva(Contatore *c, size_t dimensione)
{
    c->allocazioni++;
    return malloc(dimensione);
}

void libera(Contatore *c, void *blocco)
{
    c->liberazioni++;
    free(blocco);
}

int main(void)
{
    Contatore c = {0, 0};
    void *a = riserva(&c, 8);
    void *b = riserva(&c, 16);
    libera(&c, a);
    libera(&c, b);
    printf("malloc %d, free %d\n", c.allocazioni, c.liberazioni);
    return 0;
}

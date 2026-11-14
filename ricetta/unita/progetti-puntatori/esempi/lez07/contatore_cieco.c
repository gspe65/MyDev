/* La free e' sparita, ma i due conteggi coincidono lo stesso. */
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
    (void)blocco;
}

int main(void)
{
    Contatore c = {0, 0};
    void *a = riserva(&c, 8);
    void *b = riserva(&c, 16);
    libera(&c, a);
    libera(&c, b);
    a = NULL;
    b = NULL;
    printf("malloc %d, free %d\n", c.allocazioni, c.liberazioni);
    return 0;
}

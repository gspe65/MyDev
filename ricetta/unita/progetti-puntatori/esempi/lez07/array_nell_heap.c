/* La lunghezza dell'array si conosce solo mentre il programma gira. */
#include <stdio.h>
#include <stdlib.h>

int main(void)
{
    int quanti;
    if (scanf("%d", &quanti) != 1 || quanti <= 0) {
        return 1;
    }
    int *v = malloc(quanti * sizeof(int));
    if (v == NULL) {
        return 1;
    }
    for (int i = 0; i < quanti; i++) {
        v[i] = i * i;
    }
    printf("%d\n", v[quanti - 1]);
    free(v);
    return 0;
}

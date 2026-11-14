/* Un indice sbagliato: il codice di uscita lo dice. */
#include <stdio.h>

int main(void)
{
    int voti[3] = {7, 8, 6};
    int i;
    if (scanf("%d", &i) != 1 || i < 0 || i >= 3) {
        printf("indice non valido\n");
        return 1;
    }
    printf("%d\n", voti[i]);
    return 0;
}

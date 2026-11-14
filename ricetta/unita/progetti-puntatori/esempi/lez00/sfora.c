/* L'indice arriva da fuori: nessuno controlla che stia nell'array. */
#include <stdio.h>

int main(void)
{
    int voti[3] = {7, 8, 6};
    int i;
    if (scanf("%d", &i) != 1) {
        return 1;
    }
    printf("%d\n", voti[i]);
    return 0;
}

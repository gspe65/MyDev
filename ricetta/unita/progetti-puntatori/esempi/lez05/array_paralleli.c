/* Due array con lo stesso indice: nulla li tiene legati. */
#include <stdio.h>

int main(void)
{
    char *nomi[2] = {"anna", "bruno"};
    int eta[2] = {17, 18};
    for (int i = 0; i < 2; i++) {
        printf("%s %d\n", nomi[i], eta[i]);
    }
    return 0;
}

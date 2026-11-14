/* Un unsigned int, oltre il massimo, riparte da zero. */
#include <limits.h>
#include <stdio.h>

int main(void)
{
    unsigned int n = UINT_MAX;
    printf("%u\n", n);
    n = n + 1;
    printf("%u\n", n);
    return 0;
}

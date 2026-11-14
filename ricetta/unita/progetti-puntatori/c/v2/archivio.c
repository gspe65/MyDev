/*
 * L'archivio che capisce le righe.
 *
 * Legge una riga intera e la divide in parole con un tokenizer scritto a mano:
 * ora puo' controllare quante sono le parole e quanto sono lunghe, invece di
 * fidarsi di chi scrive.
 */

#include <stdio.h>
#include <string.h>

#define CAPACITA 8
#define LUNGHEZZA 32 /* 31 caratteri piu' il terminatore */
#define RIGA 129     /* 127 caratteri, il fine riga e il terminatore */
#define MAX_PAROLE 3 /* il comando e due argomenti */

char *trova(char chiavi[][LUNGHEZZA], char valori[][LUNGHEZZA], int quante, char *chiave)
{
    for (int i = 0; i < quante; i++) {
        if (strcmp(chiavi[i], chiave) == 0) {
            return valori[i];
        }
    }
    return NULL;
}

int imposta(char chiavi[][LUNGHEZZA], char valori[][LUNGHEZZA], int *quante,
            char *chiave, char *valore)
{
    char *dove = trova(chiavi, valori, *quante, chiave);
    if (dove != NULL) {
        strcpy(dove, valore);
        return 1;
    }
    if (*quante == CAPACITA) {
        return 0;
    }
    strcpy(chiavi[*quante], chiave);
    strcpy(valori[*quante], valore);
    (*quante)++;
    return 1;
}

int e_spazio(char c)
{
    return c == ' ' || c == '\t' || c == '\n';
}

/*
 * Divide la riga in parole. Non copia niente: scrive un terminatore dopo ogni
 * parola e mette in parole[] l'indirizzo del suo primo carattere.
 * Restituisce quante parole ha trovato, anche se sono piu' di massimo.
 */
int dividi(char *riga, char *parole[], int massimo)
{
    int trovate = 0;
    char *p = riga;

    while (*p != '\0') {
        while (e_spazio(*p)) {
            p++;
        }
        if (*p == '\0') {
            break;
        }
        if (trovate < massimo) {
            parole[trovate] = p;
        }
        trovate++;
        while (*p != '\0' && !e_spazio(*p)) {
            p++;
        }
        if (*p != '\0') {
            *p = '\0';
            p++;
        }
    }
    return trovate;
}

/* Scarta i caratteri fino alla fine della riga corrente. */
void scarta_riga(void)
{
    int c = getchar();
    while (c != '\n' && c != EOF) {
        c = getchar();
    }
}

int troppo_lunga(char *parola)
{
    return strlen(parola) >= LUNGHEZZA;
}

int main(void)
{
    char chiavi[CAPACITA][LUNGHEZZA];
    char valori[CAPACITA][LUNGHEZZA];
    int quante = 0;

    char riga[RIGA];
    char *parole[MAX_PAROLE];

    while (fgets(riga, RIGA, stdin) != NULL) {
        /* Se il buffer e' pieno e manca il fine riga, la riga non ci e' stata. */
        if (strlen(riga) == RIGA - 1 && strchr(riga, '\n') == NULL) {
            scarta_riga();
            printf("ERR troppo lungo\n");
            continue;
        }

        int n = dividi(riga, parole, MAX_PAROLE);
        if (n == 0) {
            continue;
        }

        if (strcmp(parole[0], "SET") == 0) {
            if (n != 3) {
                printf("ERR numero di argomenti\n");
            } else if (troppo_lunga(parole[1]) || troppo_lunga(parole[2])) {
                printf("ERR troppo lungo\n");
            } else if (imposta(chiavi, valori, &quante, parole[1], parole[2])) {
                printf("OK\n");
            } else {
                printf("ERR pieno\n");
            }
        } else if (strcmp(parole[0], "GET") == 0) {
            if (n != 2) {
                printf("ERR numero di argomenti\n");
            } else if (troppo_lunga(parole[1])) {
                printf("ERR troppo lungo\n");
            } else {
                char *trovato = trova(chiavi, valori, quante, parole[1]);
                if (trovato != NULL) {
                    printf("%s\n", trovato);
                } else {
                    printf("(nil)\n");
                }
            }
        } else {
            printf("ERR comando sconosciuto\n");
        }
    }

    return 0;
}

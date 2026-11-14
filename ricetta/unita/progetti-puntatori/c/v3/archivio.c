/*
 * L'archivio con le strutture.
 *
 * Una chiave e il suo valore ora stanno insieme in una Voce, e le voci con il
 * loro contatore stanno in uno Store: le funzioni ricevono un solo indirizzo.
 */

#include <stdio.h>
#include <string.h>

#define CAPACITA 8
#define LUNGHEZZA 32 /* 31 caratteri piu' il terminatore */
#define RIGA 129     /* 127 caratteri, il fine riga e il terminatore */
#define MAX_PAROLE 3 /* il comando e due argomenti */

typedef struct {
    char chiave[LUNGHEZZA];
    char valore[LUNGHEZZA];
} Voce;

typedef struct {
    Voce voci[CAPACITA];
    int quante;
} Store;

/* Restituisce l'indirizzo della voce con quella chiave, oppure NULL. */
Voce *trova(Store *s, char *chiave)
{
    for (int i = 0; i < s->quante; i++) {
        if (strcmp(s->voci[i].chiave, chiave) == 0) {
            return &s->voci[i];
        }
    }
    return NULL;
}

/* Memorizza il valore. Restituisce 1 se ci e' riuscita, 0 se l'archivio e' pieno. */
int imposta(Store *s, char *chiave, char *valore)
{
    Voce *voce = trova(s, chiave);
    if (voce == NULL) {
        if (s->quante == CAPACITA) {
            return 0;
        }
        voce = &s->voci[s->quante];
        s->quante++;
        strcpy(voce->chiave, chiave);
    }
    strcpy(voce->valore, valore);
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
    Store archivio;
    archivio.quante = 0;

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
            } else if (imposta(&archivio, parole[1], parole[2])) {
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
                Voce *voce = trova(&archivio, parole[1]);
                if (voce != NULL) {
                    printf("%s\n", voce->valore);
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

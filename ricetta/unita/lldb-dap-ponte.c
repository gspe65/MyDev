/* Sta fra l'editor e lldb-dap dell'unita', e lo lancia col profilo dell'utente spostato dentro l'unita'.
 *
 * Compilazione: clang -O2 lldb-dap-ponte.c -o lldb-dap.exe -Wl,--no-insert-timestamp
 * Sta in bin\, che il lanciatore mette per primo nel PATH: l'estensione lldb-dap cerca lldb-dap.exe nel PATH e trova
 * questo, sia per F5 sia per il Passo passo di un'altra estensione.
 *
 * Perche': lldb, all'avvio, crea la cartella dei simboli di Windows (lldb\symstore) nella cartella locale dei dati
 * dell'utente, che Windows ricava da USERPROFILE; nessuna impostazione lo evita. Qui lldb-dap parte con USERPROFILE uguale
 * a <radice>\home, e la cartella nasce dentro l'unita'. Al programma che si segue passo passo torna il USERPROFILE vero,
 * con il comando di lldb "settings set target.env-vars", dato prima dell'inizializzazione.
 *
 * La radice e' la cartella sopra quella del ponte: nessun percorso scritto. Gli argomenti passano com'e', le uscite sono
 * ereditate; se il ponte viene chiuso, lldb-dap si chiude con lui. Uscita: quella di lldb-dap, 127 se non parte.
 *
 * Che cosa NON guarda: lldb lanciato a mano dal terminale, che crea ancora la cartella nel profilo dell'utente; un
 * USERPROFILE con un apostrofo, che al programma seguito passo passo resta quello dentro l'unita'. */

#define WIN32_LEAN_AND_MEAN
#include <wchar.h>
#include <windows.h>
#include <shellapi.h>

#define MASSIMO 32768

static wchar_t radice[MASSIMO];
static wchar_t vero[MASSIMO];
static wchar_t casa[MASSIMO];
static wchar_t programma[MASSIMO];
static wchar_t riga[MASSIMO * 2];

/* Aggiunge un argomento alla riga di comando con le regole di Windows: virgolette intorno, le barre prima di una
 * virgoletta raddoppiate. */
static void aggiungi(const wchar_t *a) {
    size_t n = wcslen(riga);
    if (n > 0) riga[n++] = L' ';
    riga[n++] = L'"';
    for (const wchar_t *p = a; *p; p++) {
        size_t barre = 0;
        while (*p == L'\\') { barre++; p++; }
        if (*p == L'\0') { for (size_t i = 0; i < barre * 2; i++) riga[n++] = L'\\'; break; }
        if (*p == L'"') { for (size_t i = 0; i < barre * 2 + 1; i++) riga[n++] = L'\\'; }
        else { for (size_t i = 0; i < barre; i++) riga[n++] = L'\\'; }
        riga[n++] = *p;
    }
    riga[n++] = L'"';
    riga[n] = L'\0';
}

int main(void) {
    DWORD n = GetModuleFileNameW(NULL, radice, MASSIMO);
    if (n == 0 || n >= MASSIMO) return 127;
    for (int i = 0; i < 2; i++) {
        wchar_t *b = wcsrchr(radice, L'\\');
        if (b == NULL) return 127;
        *b = L'\0';
    }
    swprintf(programma, MASSIMO, L"%ls\\llvm\\bin\\lldb-dap.exe", radice);
    swprintf(casa, MASSIMO, L"%ls\\home", radice);
    CreateDirectoryW(casa, NULL);

    riga[0] = L'\0';
    aggiungi(programma);
    DWORD m = GetEnvironmentVariableW(L"USERPROFILE", vero, MASSIMO);
    if (m > 0 && m < MASSIMO && wcschr(vero, L'\'') == NULL) {
        static wchar_t comando[MASSIMO];
        swprintf(comando, MASSIMO, L"settings set target.env-vars 'USERPROFILE=%ls'", vero);
        aggiungi(L"--pre-init-command");
        aggiungi(comando);
    }
    int argc;
    wchar_t **argv = CommandLineToArgvW(GetCommandLineW(), &argc);
    for (int i = 1; argv != NULL && i < argc; i++) aggiungi(argv[i]);
    SetEnvironmentVariableW(L"USERPROFILE", casa);

    HANDLE lavoro = CreateJobObjectW(NULL, NULL);
    JOBOBJECT_EXTENDED_LIMIT_INFORMATION limiti;
    ZeroMemory(&limiti, sizeof limiti);
    limiti.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
    if (lavoro != NULL) SetInformationJobObject(lavoro, JobObjectExtendedLimitInformation, &limiti, sizeof limiti);

    STARTUPINFOW si;
    PROCESS_INFORMATION pi;
    ZeroMemory(&si, sizeof si);
    si.cb = sizeof si;
    if (!CreateProcessW(programma, riga, NULL, NULL, TRUE, CREATE_SUSPENDED, NULL, NULL, &si, &pi)) return 127;
    if (lavoro != NULL) AssignProcessToJobObject(lavoro, pi.hProcess);
    ResumeThread(pi.hThread);
    WaitForSingleObject(pi.hProcess, INFINITE);
    DWORD uscita = 127;
    GetExitCodeProcess(pi.hProcess, &uscita);
    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);
    return (int)uscita;
}

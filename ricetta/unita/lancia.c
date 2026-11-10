/* I collegamenti alla radice dell'unita': avviano uno strumento della copia in cui si trovano.
 *
 * Un solo sorgente, compilato una volta per strumento con -DSTRUMENTO=<nome>:
 *   clang -O2 -municode -mwindows -DSTRUMENTO=VSCODIUM lancia.c -o VSCodium.exe -lshlwapi -Wl,--no-insert-timestamp
 *
 * La radice si ricava dalla posizione dell'eseguibile, mai dalla cartella di lavoro.
 * Uscite: 0 avviato, 2 percorso troppo lungo, 3 programma non avviato (con un avviso a video).
 *
 * Che cosa NON guarda: che lo strumento, una volta avviato, funzioni. */

#define WIN32_LEAN_AND_MEAN
#include <windows.h>
#include <shlwapi.h>
#include <stdarg.h>
#include <stdio.h>
#include <wchar.h>

/* Macro e non enum: il preprocessore vedrebbe un nome di enum come 0, e ogni #if sarebbe vero. */
#define VSCODIUM 1
#define ALGODESIGN 2
#define TERMINALE 3
#define NEOVIM 4
#define PROGETTI 5

#define MASSIMO 32768

static wchar_t radice[MASSIMO];
static wchar_t posix[MASSIMO];
static wchar_t comando[MASSIMO];
static wchar_t cartella[MASSIMO];
static wchar_t appoggio[MASSIMO];

static void avvisa(const wchar_t *testo) {
    MessageBoxW(NULL, testo, L"Avvio", MB_OK | MB_ICONERROR);
}

/* Compone in un buffer da MASSIMO caratteri; un testo troppo lungo chiude il programma. */
static void componi(wchar_t *dove, const wchar_t *formato, ...) {
    va_list a;
    va_start(a, formato);
    int n = _vsnwprintf(dove, MASSIMO, formato, a);
    va_end(a);
    if (n < 0 || n >= MASSIMO) {
        avvisa(L"Il percorso della cartella e' troppo lungo.");
        ExitProcess(2);
    }
}

static void imposta(const wchar_t *nome, const wchar_t *formato, ...) {
    va_list a;
    va_start(a, formato);
    int n = _vsnwprintf(appoggio, MASSIMO, formato, a);
    va_end(a);
    if (n < 0 || n >= MASSIMO) {
        avvisa(L"Il percorso della cartella e' troppo lungo.");
        ExitProcess(2);
    }
    SetEnvironmentVariableW(nome, appoggio);
}

/* Le variabili di un editor da cui si e' partiti cambierebbero il comportamento di quello dell'unita'. */
static void togli_variabili_editor(void) {
    wchar_t *blocco = GetEnvironmentStringsW();
    if (blocco == NULL) return;
    for (wchar_t *v = blocco; *v != L'\0'; v += wcslen(v) + 1) {
        if (_wcsnicmp(v, L"VSCODE_", 7) != 0) continue;
        const wchar_t *uguale = wcschr(v, L'=');
        if (uguale == NULL || uguale - v >= 256) continue;
        wchar_t nome[256];
        wcsncpy(nome, v, (size_t)(uguale - v));
        nome[uguale - v] = L'\0';
        SetEnvironmentVariableW(nome, NULL);
    }
    FreeEnvironmentStringsW(blocco);
    SetEnvironmentVariableW(L"ELECTRON_RUN_AS_NODE", NULL);
}

/* L'unita' estesa si riconosce dall'eseguibile che porta per il pannello git: la base non sa dell'aggiunta. */
static int estesa;

/* Le variabili dei programmi aggiunti. gh e' un programma Windows: forma Windows; cargo e' di MSYS: forma POSIX.
 * ProgramW6432 sposta sull'unita' la ricerca del git che l'editor fa in Program Files prima che nel PATH. */
static void prepara_estesa(const wchar_t *sistema) {
    imposta(L"ProgramW6432", L"%ls\\programmi", radice);
    imposta(L"PATH", L"%ls\\bin;%ls\\programmi\\Git\\cmd;%ls\\gh\\bin;%ls\\msys64\\usr\\bin;%ls\\llvm\\bin;%ls\\python;%ls\\python\\Scripts;%ls\\System32;%ls",
            radice, radice, radice, radice, radice, radice, radice, sistema, sistema);
    imposta(L"CARGO_HOME", L"%ls/home/.cargo", posix);
    imposta(L"GH_CONFIG_DIR", L"%ls\\home\\.config\\gh", radice);
    imposta(L"GH_TELEMETRY", L"false");
    imposta(L"GH_NO_UPDATE_NOTIFIER", L"1");
}

/* Il login di MSYS riscrive il PATH: le aggiunte stanno nella riga -c. L'ordine conta: llvm\bin dopo /usr/bin,
 * o "gcc" diventerebbe un involucro di clang. Il %ls e' l'aggiunta dell'unita' estesa. */
#define PATH_TERMINALE L"$MYDEV/bin:%ls$MYDEV/python:$MYDEV/python/Scripts:$PATH:$MYDEV/llvm/bin:$MYDEV/nvim/bin:."

static void prepara_terminale(const wchar_t *titolo, const wchar_t *dopo) {
    imposta(L"HOME", L"%ls/home", posix);
    imposta(L"XDG_CONFIG_HOME", L"%ls/home/.config", posix);
    imposta(L"XDG_DATA_HOME", L"%ls/home/.local/share", posix);
    componi(appoggio, L"%ls\\home", radice);
    CreateDirectoryW(appoggio, NULL);
    componi(comando,
            L"\"%ls\\msys64\\usr\\bin\\mintty.exe\" -t \"%ls\" --geometry=96x32 \"%ls\\msys64\\usr\\bin\\bash.exe\" --login -i "
            L"-c \"export PATH=\\\"" PATH_TERMINALE L"\\\" && cd \\\"$MYDEV/progetti\\\" && %ls\"",
            radice, titolo, radice, estesa ? L"$MYDEV/gh/bin:" : L"", dopo);
    componi(cartella, L"%ls\\progetti", radice);
}

int WINAPI wWinMain(HINSTANCE a, HINSTANCE b, PWSTR c, int d) {
    (void)a; (void)b; (void)c; (void)d;
    DWORD n = GetModuleFileNameW(NULL, radice, MASSIMO);
    if (n == 0 || n >= MASSIMO) return 2;
    PathRemoveFileSpecW(radice);
    size_t lunga = wcslen(radice);
    if (lunga > 0 && radice[lunga - 1] == L'\\') radice[--lunga] = L'\0';

    componi(posix, L"/%lc%ls", radice[0], radice + 2);
    for (wchar_t *p = posix; *p != L'\0'; p++) if (*p == L'\\') *p = L'/';

    wchar_t sistema[MAX_PATH];
    UINT m = GetWindowsDirectoryW(sistema, MAX_PATH);
    if (m == 0 || m >= MAX_PATH) return 2;

    togli_variabili_editor();
    imposta(L"MYDEV", L"%ls", posix);
    imposta(L"MYDEV_RADICE", L"%ls", radice);
    imposta(L"MYDEV_RADICE_POSIX", L"%ls", posix);
    imposta(L"MYDEV_MSYS", L"%ls\\msys64", radice);
    /* Stato, cache e cronologie dei programmi dell'unita', che senza queste variabili finiscono nel profilo
     * dell'utente (%LOCALAPPDATA%, %USERPROFILE%): Neovim, gh, pip, virtualenv, il Python interattivo. */
    imposta(L"XDG_STATE_HOME", L"%ls\\home\\.local\\state", radice);
    imposta(L"XDG_CACHE_HOME", L"%ls\\home\\.cache", radice);
    imposta(L"PIP_CACHE_DIR", L"%ls\\home\\.cache\\pip", radice);
    imposta(L"VIRTUALENV_OVERRIDE_APP_DATA", L"%ls\\home\\.cache\\virtualenv", radice);
    imposta(L"PYTHON_HISTORY", L"%ls\\home\\.python_history", radice);
    imposta(L"PATH", L"%ls\\bin;%ls\\msys64\\usr\\bin;%ls\\llvm\\bin;%ls\\python;%ls\\python\\Scripts;%ls\\System32;%ls",
            radice, radice, radice, radice, radice, sistema, sistema);
    componi(appoggio, L"%ls\\programmi\\Git\\cmd\\git.exe", radice);
    estesa = PathFileExistsW(appoggio);
    if (estesa) prepara_estesa(sistema);

#if STRUMENTO == VSCODIUM
    componi(comando, L"\"%ls\\vscodium\\VSCodium.exe\"", radice);
    componi(cartella, L"%ls\\progetti", radice);
#elif STRUMENTO == ALGODESIGN
    componi(comando, L"\"%ls\\algodesign\\AlgoDesign.exe\"", radice);
    componi(cartella, L"%ls\\algodesign", radice);
#elif STRUMENTO == TERMINALE
    prepara_terminale(L"Terminale", L"exec bash");
#elif STRUMENTO == NEOVIM
    prepara_terminale(L"Neovim", L"nvim");
#elif STRUMENTO == PROGETTI
    componi(comando, L"\"%ls\\explorer.exe\" \"%ls\\progetti\"", sistema, radice);
    componi(cartella, L"%ls", radice);
#else
#error "STRUMENTO sconosciuto"
#endif

    STARTUPINFOW si;
    PROCESS_INFORMATION pi;
    ZeroMemory(&si, sizeof si);
    si.cb = sizeof si;
    if (!CreateProcessW(NULL, comando, NULL, NULL, FALSE, 0, NULL, cartella, &si, &pi)) {
        DWORD e = GetLastError();
        componi(appoggio, L"Non si riesce ad avviare il programma (errore %lu):\n%ls", e, comando);
        avvisa(appoggio);
        return 3;
    }
    CloseHandle(pi.hThread);
    CloseHandle(pi.hProcess);
    return 0;
}

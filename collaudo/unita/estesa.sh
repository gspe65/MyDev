#!/bin/bash
# Rust, git e gh dal terminale dell'unita' estesa. Si lancia con terminale.bat <radice> <questo script>.
# Una sentinella e' un profilo finto: cio' che uno strumento scriverebbe fuori dall'unita' finisce li' e si conta.
# Non giudica: stampa una riga per passo, il verdetto e' in estesa.ps1.
# Le sentinelle spostano USERPROFILE, APPDATA e LOCALAPPDATA: valgono per i programmi Windows (gh). cargo, rustc e git
# di MSYS prendono la casa da HOME, che il terminale mette nell'unita': per loro lo zero dice solo che HOME e' quella.
L="$(cygpath -u "$ESTESA_OUT")"
cd "$L" || return 2
passo() { echo "PASSO $1: uscita $2"; }
sentinella() { S="$L/sentinella-$1"; rm -rf "$S"; mkdir -p "$S"; local w; w=$(cygpath -w "$S"); export USERPROFILE="$w" APPDATA="$w\\AppData" LOCALAPPDATA="$w\\Local"; }
conta() { echo "SENTINELLA $1: $(find "$S" -type f | wc -l)"; find "$S" -type f | sed "s|^$S/|  file: |"; }

echo "INIZIO estesa  MYDEV=$MYDEV"
echo "CARGO_HOME=$CARGO_HOME"
echo "rustc: $(command -v rustc)  cargo: $(command -v cargo)  git: $(command -v git)  gh: $(command -v gh)"

# --- Rust: senza rete, in una cartella con spazi doppi.
export CARGO_NET_OFFLINE=true
sentinella rust
rustc --version; passo "rustc" $?
cargo clippy -V; passo "clippy" $?
rustfmt -V; passo "rustfmt" $?
cargo new --vcs none --bin processi > /dev/null 2>&1; passo "cargo new" $?
cd processi || return 2
cp "$(cygpath -u "$ESTESA_KIT")/processi.rs" src/main.rs
cargo build; passo "cargo build" $?
cargo run -q; passo "cargo run" $?
cargo clippy; passo "cargo clippy" $?
cargo fmt --check; passo "cargo fmt" $?
cd "$L" || return 2
conta rust

# Il controllo positivo: una CARGO_HOME fuori dall'unita' deve riempire la sentinella.
sentinella cargo-fuori
CARGO_HOME="$S/cargo" cargo new --vcs none --bin fuori > /dev/null 2>&1
( cd fuori && CARGO_HOME="$S/cargo" cargo build -q )
conta cargo-fuori

# --- git: fra percorsi con spazi doppi.
sentinella git
G="$L/repo  git"; rm -rf "$G"; mkdir -p "$G"; cd "$G" || return 2
git init -q .; passo "git init" $?
echo ciao > a.txt; git add a.txt
git -c user.name=prova -c user.email=prova@example.invalid commit -q -m uno; passo "git commit" $?
cd "$L" || return 2
rm -rf "copia  git"
git clone -q "$G" "copia  git"; passo "git clone" $?
echo "non decide, vuole la rete: $(git ls-remote https://github.com/cli/cli HEAD 2>&1 | cut -c1-80)"
conta git

# --- gh: stato e configurazione dentro l'unita', telemetria spenta.
sentinella gh
gh --version; passo "gh" $?
# bin/gh ricava la radice da se', se il terminale non la da'.
env -u MYDEV gh --version > /dev/null 2>&1; passo "gh senza MYDEV" $?
echo "telemetria: GH_TELEMETRY=$GH_TELEMETRY GH_NO_UPDATE_NOTIFIER=$GH_NO_UPDATE_NOTIFIER"
conta gh

# Con la telemetria spenta gh non scrive lo stato: lo zero qui sopra non dice dove lo scriverebbe.
# GH_TELEMETRY=log lo fa scrivere senza inviare nulla: con XDG_STATE_HOME dentro l'unita', senza nel profilo.
sentinella gh-stato
GH_TELEMETRY=log gh --version > /dev/null 2>&1; passo "gh col registro" $?
[ -f "$XDG_STATE_HOME/gh/device-id" ]; passo "device-id dentro l'unita'" $?
conta gh-stato
sentinella gh-fuori
env -u XDG_STATE_HOME GH_TELEMETRY=log gh --version > /dev/null 2>&1; passo "gh senza stato" $?
conta gh-fuori
# --- Il comando gh dell'unita': si prova con uno strumento finto, per non toccare un login vero.
F="$L/gh  finto"; rm -rf "$F"; mkdir -p "$F/gh/bin"
cat > "$F/gh/bin/gh.exe" <<'FINTO'
#!/bin/bash
echo "ARGOMENTI $*"
if [ "$2" = login ]; then printf '\thelper = !%sC:\\\\x  y\\\\gh.exe%s auth git-credential\n' "'" "'" >> "$HOME/.gitconfig"; fi
FINTO
chmod +x "$F/gh/bin/gh.exe"
mkdir -p "$F/casa" "$F/casa-controllo"
# In forma Windows, come la da' il lanciatore: e' quella che gh-comando riceve davvero.
export GH_CONFIG_DIR_VERO="$GH_CONFIG_DIR" GH_CONFIG_DIR="$(cygpath -w "$F/casa/.config/gh")"
mkdir -p "$GH_CONFIG_DIR"
# Il file come lo lascia gh quando sul PC c'e' gia' un login dello stesso account: il token solo sotto users.
printf 'github.com:\n    users:\n        prova:\n            oauth_token: finto\n    user: prova\n' > "$GH_CONFIG_DIR/hosts.yml"
prima=$(grep -c '^    oauth_token:' "$GH_CONFIG_DIR/hosts.yml")
echo "login: $(HOME="$F/casa" MYDEV="$F" "$MYDEV/bin/gh" auth login --web)"
echo "token attivo: prima $prima, dopo $(grep -c '^    oauth_token: finto' "$GH_CONFIG_DIR/hosts.yml")"
echo "refresh: $(HOME="$F/casa" MYDEV="$F" "$MYDEV/bin/gh" auth refresh -s repo)"
echo "altro: $(HOME="$F/casa" MYDEV="$F" "$MYDEV/bin/gh" auth status)"
echo "gitconfig: percorsi $(grep -c 'gh\.exe' "$F/casa/.gitconfig"), nome $(grep -c 'helper = !gh auth git-credential' "$F/casa/.gitconfig")"
# Il controllo positivo: senza il comando dell'unita' il percorso assoluto resta.
HOME="$F/casa-controllo" "$F/gh/bin/gh.exe" auth login > /dev/null
echo "controllo percorso: $(grep -c 'gh\.exe' "$F/casa-controllo/.gitconfig")"
# Il logout non deve chiamare lo strumento vero, che cancellerebbe anche il login del PC.
uscita_logout=$(HOME="$F/casa" MYDEV="$F" "$MYDEV/bin/gh" auth logout)
echo "logout senza strumento: hosts $(find "$GH_CONFIG_DIR" -name hosts.yml | wc -l), ARGOMENTI $(echo "$uscita_logout" | grep -c ARGOMENTI)"
export GH_CONFIG_DIR="$GH_CONFIG_DIR_VERO"
echo "FINE estesa"

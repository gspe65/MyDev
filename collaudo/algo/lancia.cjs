// Avvia l'editor installato con l'estensione estratta dal pacchetto, e dentro `finestra.cjs`. Nessun download: l'eseguibile è dato.
//
//   node collaudo/algo/lancia.cjs <eseguibile> <estensione> <file .algo> <file di uscita> <cartella dei dati> <casi in JSON>

const { dirname, join } = require("node:path");
const { runTests } = require("@vscode/test-electron");

const [eseguibile, estensione, file, uscita, dati, casi] = process.argv.slice(2);

runTests({
  vscodeExecutablePath: eseguibile,
  extensionDevelopmentPath: estensione,
  extensionTestsPath: join(__dirname, "finestra.cjs"),
  extensionTestsEnv: { ALGO_FILE: file, ALGO_USCITA: uscita, ALGO_CASI: casi },
  launchArgs: [dirname(file), "--user-data-dir", join(dati, "profilo"), "--extensions-dir", join(dati, "estensioni"), "--disable-extensions"],
}).catch((e) => {
  console.error(String(e));
  process.exit(1);
});

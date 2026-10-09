const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const name = "Controle de Gastos.exe";
const source = path.join(root, "dist", name);
const destination = path.join(root, name);
const oldName = "Controle-de-Gastos-1.0.0-portable.exe";

if (!fs.existsSync(source)) {
  throw new Error(`Executável não encontrado após a compilação: ${source}`);
}

fs.copyFileSync(source, destination);
for (const obsolete of [path.join(root, oldName), path.join(root, "dist", oldName)]) {
  if (fs.existsSync(obsolete)) fs.rmSync(obsolete);
}
console.log(`Executável copiado para a pasta raiz: ${destination}`);

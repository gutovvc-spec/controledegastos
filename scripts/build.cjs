const fs = require("node:fs");
const path = require("node:path");
const JavaScriptObfuscator = require("javascript-obfuscator");

const root = path.join(__dirname, "..");
const output = path.join(root, "app-build");
const assets = [
  "manifest.webmanifest",
  "sw.js",
  "icon-192.png",
  "icon-512.png",
  "icon-maskable-512.png"
];

fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });

let html = fs.readFileSync(path.join(root, "index.html"), "utf8");
let scriptsProcessed = 0;
html = html.replace(/(<script\b[^>]*>)([\s\S]*?)(<\/script>)/gi, (match, start, source, end) => {
  if (!source.trim()) return match;
  scriptsProcessed += 1;
  const code = JavaScriptObfuscator.obfuscate(source, {
    compact: true,
    controlFlowFlattening: false,
    deadCodeInjection: false,
    identifierNamesGenerator: "hexadecimal",
    renameGlobals: false,
    selfDefending: false,
    stringArray: true,
    stringArrayThreshold: 0.75
  }).getObfuscatedCode();
  return `${start}${code}${end}`;
});
if (scriptsProcessed === 0) throw new Error("Nenhum script JavaScript encontrado para ofuscar.");
fs.writeFileSync(path.join(output, "index.html"), html);
for (const asset of assets) {
  fs.copyFileSync(path.join(root, asset), path.join(output, asset));
}
console.log(`Aplicativo preparado; ${scriptsProcessed} blocos JavaScript foram ofuscados.`);

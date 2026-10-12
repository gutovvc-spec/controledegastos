const { app, BrowserWindow, dialog } = require("electron");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const PORT = 47631;
const appFiles = path.join(__dirname, "..", "app-build");
const allowedFiles = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/index.html", ["index.html", "text/html; charset=utf-8"]],
  ["/manifest.webmanifest", ["manifest.webmanifest", "application/manifest+json"]],
  ["/sw.js", ["sw.js", "text/javascript; charset=utf-8"]],
  ["/icon-192.png", ["icon-192.png", "image/png"]],
  ["/icon-512.png", ["icon-512.png", "image/png"]],
  ["/icon-maskable-512.png", ["icon-maskable-512.png", "image/png"]]
]);

function createServer() {
  return http.createServer((req, res) => {
    const url = new URL(req.url, "http://127.0.0.1");
    const file = allowedFiles.get(url.pathname);
    if (req.method !== "GET" || !file) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      return res.end("Não encontrado");
    }

    try {
      const contents = fs.readFileSync(path.join(appFiles, file[0]));
      res.writeHead(200, {
        "Content-Type": file[1],
        "Cache-Control": "no-cache",
        "X-Content-Type-Options": "nosniff"
      });
      res.end(contents);
    } catch (error) {
      console.error("Não foi possível carregar um arquivo do app:", error);
      res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("Falha ao carregar o aplicativo");
    }
  });
}

let server;
let mainWindow;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.whenReady().then(() => {
    server = createServer();
    server.on("error", error => {
      console.error("Falha ao iniciar o servidor local:", error);
      dialog.showErrorBox("Controle de Gastos", "Não foi possível iniciar o aplicativo. Verifique se a porta local 47631 está livre.");
      app.quit();
    });
    server.listen(PORT, "127.0.0.1", () => {
      mainWindow = new BrowserWindow({
        width: 1200,
        height: 850,
        minWidth: 760,
        minHeight: 600,
        title: "Controle de Gastos da Família",
        autoHideMenuBar: true,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          sandbox: true
        }
      });
      mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
      mainWindow.webContents.on("will-navigate", (event, target) => {
        if (target !== `http://127.0.0.1:${PORT}/` &&
            !target.startsWith(`http://127.0.0.1:${PORT}/`)) event.preventDefault();
      });
      mainWindow.loadURL(`http://127.0.0.1:${PORT}/`);
    });
  });

  app.on("window-all-closed", () => {
    if (server) server.close();
    app.quit();
  });
}

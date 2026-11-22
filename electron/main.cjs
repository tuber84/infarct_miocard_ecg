const { app, BrowserWindow, Menu, protocol, shell } = require('electron');
const fs = require('fs');
const path = require('path');

// Регистрируем схему app:// до готовности приложения, чтобы работали Fetch API и ES-модули
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
};

const DIST_DIR = path.resolve(__dirname, '..', 'dist');

function resolveDistFile(requestUrl) {
  const parsed = new URL(requestUrl);
  let relPath = decodeURIComponent(parsed.pathname);
  if (relPath === '/' || relPath === '') {
    relPath = '/index.html';
  }
  const safePath = path.normalize(relPath).replace(/^(\.\.[/\\])+/, '');
  const fullPath = path.resolve(DIST_DIR, `.${path.sep}${safePath}`);
  if (!fullPath.startsWith(DIST_DIR)) {
    return null;
  }
  return fullPath;
}

function createMainWindow() {
  const iconIco = path.join(__dirname, '..', 'build', 'icon.ico');
  const iconPng = path.join(__dirname, '..', 'build', 'icon.png');
  const windowIcon = fs.existsSync(iconIco)
    ? iconIco
    : fs.existsSync(iconPng)
      ? iconPng
      : undefined;

  const win = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: 'КардиоАтлас ЭКГ — Локализатор ИМ и динамика STEMI',
    icon: windowIcon,
    backgroundColor: '#f8fafc',
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  // Запрещаем открытие сторонних окон внутри приложения — открываем во внешнем браузере
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  const devUrl = process.env.ELECTRON_DEV_URL;
  if (devUrl) {
    win.loadURL(devUrl);
  } else {
    win.loadURL('app://localhost/index.html');
  }
}

app.whenReady().then(() => {
  // Убираем стандартное меню Chromium для чистого десктопного интерфейса
  Menu.setApplicationMenu(null);

  protocol.handle('app', async (request) => {
    const filePath = resolveDistFile(request.url);
    if (!filePath) {
      return new Response('Forbidden', { status: 403 });
    }

    try {
      const data = await fs.promises.readFile(filePath);
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      return new Response(data, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'no-cache',
        },
      });
    } catch {
      return new Response('Not Found', { status: 404 });
    }
  });

  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

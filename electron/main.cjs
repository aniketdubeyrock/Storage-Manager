const { app, BrowserWindow, shell } = require('electron');
const path = require('path');
const { startCompanionServer } = require('./companionServer.cjs');

let mainWindow = null;
let companionServerInstance = null;

const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 1024,
    minHeight: 720,
    title: 'Storage Manager',
    backgroundColor: '#090d16',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  // Open external links in default browser instead of new Electron windows
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http:') || url.startsWith('https:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (isDev) {
    // In Dev mode: Load Vite server
    const devUrl = process.env.VITE_DEV_SERVER_URL || 'http://localhost:5173';
    await mainWindow.loadURL(devUrl);
  } else {
    // In Production mode: Start embedded companion server and load it
    const distPath = path.join(__dirname, '../dist');
    const { port, server } = await startCompanionServer(distPath, 5173);
    companionServerInstance = server;
    await mainWindow.loadURL(`http://localhost:${port}`);
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(async () => {
  await createWindow();

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (companionServerInstance) {
    try {
      companionServerInstance.close();
    } catch {}
  }
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


// main.js
import { app, BrowserWindow } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// 取代 __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      contextIsolation: true
    }
  });

  const url = isDev
    ? 'http://localhost:8080'
    : `file://${path.join(__dirname, '../dist/index.html')}`;
  win.loadURL(url);
}

app.whenReady().then(createWindow);

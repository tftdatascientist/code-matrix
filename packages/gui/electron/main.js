import { app, BrowserWindow, globalShortcut, Tray, Menu, nativeImage } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = !app.isPackaged;

let win = null;
let tray = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 600,
    minHeight: 400,
    backgroundColor: '#000000',
    frame: false,
    titleBarStyle: 'hidden',
    titleBarOverlay: false,
    transparent: false,
    alwaysOnTop: true,
    opacity: 0.95,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  // Keyboard shortcuts for window control
  win.webContents.on('before-input-event', (_event, input) => {
    if (input.control && input.key === '=') {
      win.setOpacity(Math.min(1, win.getOpacity() + 0.05));
    } else if (input.control && input.key === '-') {
      win.setOpacity(Math.max(0.3, win.getOpacity() - 0.05));
    } else if (input.control && input.key === '0') {
      win.setOpacity(0.95);
    } else if (input.control && input.key === 't') {
      win.setAlwaysOnTop(!win.isAlwaysOnTop());
    }
  });

  win.on('closed', () => {
    win = null;
  });
}

function createTray() {
  // Simple 16x16 green dot icon
  const icon = nativeImage.createFromBuffer(
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAMklEQVQ4T2Nk+M/wn4EKgJGBgYGJgRqAkYEB3QBkNYxUcQEjVcOAKi6g2DAa5AkAAPqNAgkMq1g6AAAAAElFTkSuQmCC',
      'base64'
    )
  );

  tray = new Tray(icon);
  tray.setToolTip('Matrix GUI');

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Show/Hide',
      click: () => {
        if (win) {
          win.isVisible() ? win.hide() : win.show();
        }
      },
    },
    {
      label: 'Always on Top',
      type: 'checkbox',
      checked: true,
      click: (menuItem) => {
        win?.setAlwaysOnTop(menuItem.checked);
      },
    },
    { type: 'separator' },
    {
      label: 'Opacity',
      submenu: [
        { label: '100%', click: () => win?.setOpacity(1.0) },
        { label: '95%', click: () => win?.setOpacity(0.95) },
        { label: '85%', click: () => win?.setOpacity(0.85) },
        { label: '70%', click: () => win?.setOpacity(0.7) },
        { label: '50%', click: () => win?.setOpacity(0.5) },
      ],
    },
    { type: 'separator' },
    { label: 'Quit', click: () => app.quit() },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (win) {
      win.isVisible() ? win.hide() : win.show();
    }
  });
}

app.whenReady().then(() => {
  createWindow();
  createTray();
});

app.on('window-all-closed', () => {
  app.quit();
});

app.on('will-quit', () => {
  tray?.destroy();
});

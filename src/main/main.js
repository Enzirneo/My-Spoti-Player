// Ponto de entrada do Electron: só cria a janela, a bandeja e conecta os módulos.
import { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, Tray } from 'electron';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTokenManager } from './auth.js';
import { registerIpc } from './ipc.js';
import { createStore } from './store.js';
import { restoreBounds } from './window-bounds.js';

const APP_ROOT = join(import.meta.dirname, '..', '..');
const DEFAULT_SIZE = { width: 340, height: 420 };
const MIN_SIZE = { width: 260, height: 320 };
const SAVE_BOUNDS_DELAY_MS = 400;

let mainWindow = null;
let tray = null;

function readClientId() {
  try {
    const config = JSON.parse(readFileSync(join(APP_ROOT, 'config.json'), 'utf-8'));
    return String(config.clientId ?? '').trim();
  } catch {
    // Sem config.json válido o app abre e avisa na tela que falta o clientId.
    return '';
  }
}

function createWindow(store) {
  const workAreas = screen.getAllDisplays().map((display) => display.workArea);
  const bounds = restoreBounds(store.get('bounds'), workAreas, DEFAULT_SIZE);

  const window = new BrowserWindow({
    ...bounds,
    minWidth: MIN_SIZE.width,
    minHeight: MIN_SIZE.height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: join(APP_ROOT, 'src', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.loadFile(join(APP_ROOT, 'src', 'renderer', 'index.html'));
  window.once('ready-to-show', () => window.show());
  rememberBounds(window, store);
  return window;
}

function rememberBounds(window, store) {
  let timer = null;
  const save = () => {
    clearTimeout(timer);
    timer = setTimeout(
      () => store.set('bounds', window.getBounds()),
      SAVE_BOUNDS_DELAY_MS
    );
  };
  window.on('resize', save);
  window.on('move', save);
}

function toggleWindow() {
  if (mainWindow.isVisible()) mainWindow.hide();
  else mainWindow.show();
}

function createTray() {
  const icon = nativeImage
    .createFromPath(join(APP_ROOT, 'assets', 'icon.png'))
    .resize({ width: 16, height: 16 });
  const trayIcon = new Tray(icon);
  trayIcon.setToolTip('My Spoti Player');
  trayIcon.on('click', toggleWindow);
  trayIcon.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Mostrar / ocultar', click: toggleWindow },
      { label: 'Sair', click: () => app.quit() },
    ])
  );
  return trayIcon;
}

function start() {
  const store = createStore({ filePath: join(app.getPath('userData'), 'store.json') });
  const clientId = readClientId();
  const tokens = createTokenManager({ store, clientId });

  registerIpc({ tokens, clientId });
  ipcMain.handle('window:hide', () => mainWindow.hide());
  ipcMain.handle('window:quit', () => app.quit());
  mainWindow = createWindow(store);
  tray = createTray();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => mainWindow?.show());
  app.on('before-quit', () => tray?.destroy());
  // Ocultar na bandeja usa hide() (a janela continua existindo); fechar encerra o app.
  app.on('window-all-closed', () => app.quit());
  app.whenReady().then(start);
}

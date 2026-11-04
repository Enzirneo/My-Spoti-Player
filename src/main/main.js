// Ponto de entrada do Electron: só cria a janela, a bandeja e conecta os módulos.
import { app, BrowserWindow, ipcMain, Menu, nativeImage, Tray } from 'electron';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTokenManager } from './auth.js';
import { createDebugLog } from './debug-log.js';
import { registerIpc } from './ipc.js';
import { createStore } from './store.js';
import { registerWindowDrag } from './window-drag.js';
import { createWindowMode, NORMAL_MIN } from './window-mode.js';

const APP_ROOT = join(import.meta.dirname, '..', '..');

let windowMode = null;
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

// O modo normal usa o fundo acrílico do Windows 11 (borra o que está atrás); a tag é
// transparente para poder ser uma pílula. Por isso são janelas diferentes (ver window-mode.js).
function createWindow(mode, bounds) {
  const isTag = mode === 'tag';
  const window = new BrowserWindow({
    ...bounds,
    ...(isTag ? {} : { minWidth: NORMAL_MIN.width, minHeight: NORMAL_MIN.height }),
    frame: false,
    transparent: isTag,
    backgroundColor: isTag ? undefined : '#00000000',
    backgroundMaterial: isTag ? 'none' : 'acrylic',
    alwaysOnTop: true,
    resizable: !isTag,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: join(APP_ROOT, 'src', 'preload', 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  window.loadFile(join(APP_ROOT, 'src', 'renderer', 'index.html'), { query: { mode } });
  window.once('ready-to-show', () => window.show());
  return window;
}

function toggleWindow() {
  const window = windowMode.getWindow();
  if (window.isVisible()) window.hide();
  else window.show();
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

  const debugLog = createDebugLog({
    filePath: join(app.getPath('userData'), 'debug.log'),
  });
  registerIpc({ tokens, clientId, debugLog });
  ipcMain.handle('window:hide', () => windowMode.getWindow().hide());
  ipcMain.handle('window:quit', () => app.quit());
  registerWindowDrag(() => windowMode.getWindow());
  windowMode = createWindowMode({ store, createWindow });
  ipcMain.handle('window:get-mode', () => windowMode.getMode());
  ipcMain.handle('window:set-mode', (_event, mode) => windowMode.setMode(mode));
  tray = createTray();
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => windowMode?.getWindow().show());
  app.on('before-quit', () => tray?.destroy());
  // Ocultar na bandeja usa hide() (a janela continua existindo); fechar encerra o app.
  app.on('window-all-closed', () => app.quit());
  app.whenReady().then(start);
}

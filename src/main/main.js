// Ponto de entrada do Electron: só cria a janela, a bandeja e conecta os módulos.
import { app, BrowserWindow, ipcMain, Menu, nativeImage, Tray } from 'electron';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createTokenManager } from './auth.js';
import { createDebugLog } from './debug-log.js';
import { registerIpc } from './ipc.js';
import { requestGuard } from '../shared/spotify.js';
import { createStore } from './store.js';
import { registerWindowDrag } from './window-drag.js';
import { createWindowMode, NORMAL_MIN } from './window-mode.js';

const APP_ROOT = join(import.meta.dirname, '..', '..');

let windowMode = null;
let debugLog = null;
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

// Se a tela da janela morrer (processo de renderização cai) ela fica só com o fundo acrílico,
// vazia. Registra no log e recarrega a página para o app se recuperar sozinho.
function watchWindowHealth(window) {
  const { webContents } = window;
  webContents.on('render-process-gone', (_event, details) => {
    debugLog?.write(`[janela] tela caiu (${details.reason}, código ${details.exitCode})`);
    if (details.reason !== 'clean-exit' && !window.isDestroyed()) {
      setTimeout(() => !window.isDestroyed() && webContents.reload(), 500);
    }
  });
  webContents.on('did-fail-load', (_event, code, description) => {
    debugLog?.write(`[janela] falha ao carregar (${code}) ${description}`);
  });
  window.on('unresponsive', () => debugLog?.write('[janela] sem resposta'));
  window.on('responsive', () => debugLog?.write('[janela] voltou a responder'));
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
    icon: join(APP_ROOT, 'assets', 'icon.png'),
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

  watchWindowHealth(window);
  window.loadFile(join(APP_ROOT, 'src', 'renderer', 'index.html'), { query: { mode } });
  // A janela só aparece quando a tela diz que está pronta (capa carregada); o timer evita
  // que ela fique escondida para sempre se algo falhar.
  window.once('ready-to-show', () =>
    setTimeout(() => showIfHidden(window), SHOW_FALLBACK_MS)
  );
  return window;
}

const SHOW_FALLBACK_MS = 1500;

function showIfHidden(window) {
  if (!window.isDestroyed() && !window.isVisible()) window.show();
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
  // O bloqueio do Spotify sobrevive a fechar e abrir o app; senão reabrir insistiria.
  requestGuard.restore(store.get('rateLimitedUntil'));
  requestGuard.listen((until) => store.set('rateLimitedUntil', until));

  debugLog = createDebugLog({
    filePath: join(app.getPath('userData'), 'debug.log'),
  });
  registerIpc({ tokens, clientId, debugLog });
  app.on('child-process-gone', (_event, details) =>
    debugLog.write(`[processo] ${details.type} caiu (${details.reason})`)
  );
  ipcMain.handle('window:quit', () => app.quit());
  ipcMain.on('window:content-ready', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) showIfHidden(window);
  });
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

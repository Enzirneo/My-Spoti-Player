// Arrastar a janela por código. O arrasto nativo do CSS (-webkit-app-region) bloqueia o
// hover e os cliques do elemento, então o renderer avisa o mouse e o main move a janela.
import { ipcMain } from 'electron';
import { movedBounds } from './window-bounds.js';

export function registerWindowDrag(window) {
  let drag = null;

  ipcMain.on('window:drag-start', (_event, mouse) => {
    drag = { startBounds: window.getBounds(), startMouse: mouse };
  });

  ipcMain.on('window:drag-move', (_event, mouse) => {
    if (!drag) return;
    // setBounds com o tamanho original evita que a janela "cresça" em telas com escala fracionada.
    window.setBounds(movedBounds(drag.startBounds, drag.startMouse, mouse));
  });

  ipcMain.on('window:drag-end', () => {
    drag = null;
  });
}

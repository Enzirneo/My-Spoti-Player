// Alterna a janela entre dois modos:
//   "normal": janelinha quadrada, redimensionável;
//   "tag": barra mini (capa, título, progresso e play/pause).
// Cada modo lembra a própria posição; o usuário pode mover os dois.
import { screen } from 'electron';
import { restoreBounds, restoreTagBounds } from './window-bounds.js';

const NORMAL_DEFAULT_SIZE = { width: 320, height: 400 };
const NORMAL_MIN_SIZE = { width: 260, height: 340 };
// A janela da tag é um pouco maior que a barra para sobrar espaço para a sombra.
const TAG_SIZE = { width: 330, height: 68 };
const TAG_TOP_MARGIN = 6;
const SAVE_DELAY_MS = 400;

const workAreas = () => screen.getAllDisplays().map((display) => display.workArea);

export function initialNormalBounds(store) {
  const primary = screen.getPrimaryDisplay().workArea;
  return restoreBounds(
    store.get('windowBounds'),
    workAreas(),
    NORMAL_DEFAULT_SIZE,
    primary
  );
}

export const NORMAL_MIN = NORMAL_MIN_SIZE;

/**
 * Controla os dois modos. Cada modo é uma janela própria, porque o "normal" usa o fundo
 * acrílico do Windows (borrado, não pode ser transparente) e a "tag" precisa ser transparente
 * para ter o formato de pílula. Ao trocar de modo, a janela nova abre e a antiga fecha.
 * `createWindow(mode, bounds)` é quem monta a BrowserWindow (ver main.js).
 */
export function createWindowMode({ store, createWindow }) {
  let mode = 'normal';
  let saveTimer = null;
  let window = null;

  function saveCurrentPosition() {
    if (mode === 'normal') {
      store.set('windowBounds', window.getBounds());
      return;
    }
    const { x, y } = window.getBounds();
    store.set('tagPosition', { x, y });
  }

  // Salva depois que o usuário para de mover/redimensionar (o modo é lido na hora de salvar).
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveCurrentPosition, SAVE_DELAY_MS);
  }

  function open(nextMode, bounds) {
    const created = createWindow(nextMode, bounds);
    created.on('move', scheduleSave);
    created.on('resize', scheduleSave);
    return created;
  }

  const currentWorkArea = () => screen.getDisplayMatching(window.getBounds()).workArea;

  const boundsFor = (nextMode) =>
    nextMode === 'tag'
      ? restoreTagBounds(
          store.get('tagPosition'),
          TAG_SIZE,
          workAreas(),
          currentWorkArea(),
          TAG_TOP_MARGIN
        )
      : restoreBounds(
          store.get('windowBounds'),
          workAreas(),
          NORMAL_DEFAULT_SIZE,
          currentWorkArea()
        );

  window = open('normal', initialNormalBounds(store));

  return {
    getMode: () => mode,
    getWindow: () => window,
    setMode(nextMode) {
      if (nextMode === mode) return mode;
      // Guarda onde o modo atual estava antes de trocar.
      clearTimeout(saveTimer);
      saveCurrentPosition();
      const bounds = boundsFor(nextMode);
      const previous = window;
      mode = nextMode;
      window = open(mode, bounds);
      // A janela antiga só some quando a nova já está na tela (sem piscar).
      window.once('show', () => previous.destroy());
      return mode;
    },
  };
}

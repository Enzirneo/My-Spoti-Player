// Alterna a janela entre os dois modos: cápsula (compacta, fixa no topo) e painel expandido.
import { screen } from 'electron';
import { capsuleBounds, expandedBounds } from './window-bounds.js';

// A janela é um pouco maior que a cápsula para sobrar espaço para a sombra.
export const CAPSULE_SIZE = { width: 400, height: 80 };
const EXPANDED_DEFAULT_SIZE = { width: 360, height: 480 };
const EXPANDED_MIN_SIZE = { width: 280, height: 380 };
const TOP_MARGIN = 6;
const SAVE_SIZE_DELAY_MS = 400;

export function initialCapsuleBounds() {
  return capsuleBounds(screen.getPrimaryDisplay().workArea, CAPSULE_SIZE, TOP_MARGIN);
}

export function createWindowMode({ window, store }) {
  let mode = 'capsule';
  let saveTimer = null;

  // Só o tamanho do painel é lembrado; a posição é sempre o topo, no centro.
  window.on('resize', () => {
    if (mode !== 'expanded') return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const [width, height] = window.getSize();
      store.set('expandedSize', { width, height });
    }, SAVE_SIZE_DELAY_MS);
  });

  function showCapsule(workArea) {
    window.setMinimumSize(0, 0);
    window.setBounds(capsuleBounds(workArea, CAPSULE_SIZE, TOP_MARGIN));
    window.setResizable(false);
  }

  function showExpanded(workArea) {
    const preferredSize = store.get('expandedSize') ?? EXPANDED_DEFAULT_SIZE;
    window.setResizable(true);
    window.setBounds(
      expandedBounds(workArea, preferredSize, EXPANDED_MIN_SIZE, TOP_MARGIN)
    );
    window.setMinimumSize(EXPANDED_MIN_SIZE.width, EXPANDED_MIN_SIZE.height);
  }

  return {
    getMode: () => mode,
    setMode(nextMode) {
      if (nextMode === mode) return mode;
      const { workArea } = screen.getDisplayMatching(window.getBounds());
      mode = nextMode;
      if (mode === 'capsule') showCapsule(workArea);
      else showExpanded(workArea);
      return mode;
    },
  };
}

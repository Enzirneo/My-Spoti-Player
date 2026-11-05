// Arrastar a janela clicando em qualquer área livre. O renderer só informa a posição do
// mouse na tela; quem move a janela é o main (ver src/main/window-drag.js).
// Um clique sem arrasto vira "toque" (onTap): é assim que a tag abre a janela normal.
const INTERACTIVE_SELECTOR = 'button, input, .progress__bar';
const TAP_MAX_DISTANCE_PX = 5; // acima disso o gesto é arrasto, não clique

/** Diz se o mouse mal se mexeu entre apertar e soltar (clique, não arrasto). */
export function isTap(start, end) {
  return Math.hypot(end.x - start.x, end.y - start.y) <= TAP_MAX_DISTANCE_PX;
}

export function enableWindowDrag(element, api, { onTap } = {}) {
  let startPosition = null;
  const mousePosition = (event) => ({ x: event.screenX, y: event.screenY });

  element.addEventListener('pointerdown', (event) => {
    if (event.button !== 0 || event.target.closest(INTERACTIVE_SELECTOR)) return;
    startPosition = mousePosition(event);
    element.setPointerCapture(event.pointerId);
    api.startWindowDrag(startPosition);
  });

  element.addEventListener('pointermove', (event) => {
    if (startPosition) api.dragWindow(mousePosition(event));
  });

  function stopDragging(event) {
    if (!startPosition) return;
    const wasTap =
      event.type === 'pointerup' && isTap(startPosition, mousePosition(event));
    startPosition = null;
    api.endWindowDrag();
    if (wasTap) onTap?.();
  }
  element.addEventListener('pointerup', stopDragging);
  element.addEventListener('pointercancel', stopDragging);
}
